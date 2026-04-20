import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { sendSmtpTextMail } from "@/lib/notifications/admin-review-email";
import { resolvePublicAdvisorContact } from "@/lib/public-advisor-contact";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

type RequestOfferPayload = {
  locale?: string | null;
  sourceForm?: string | null;
  pagePath?: string | null;
  regionLabel?: string | null;
  request?: {
    id?: string | null;
    title?: string | null;
    objectType?: string | null;
  } | null;
  context?: {
    bundeslandSlug?: string | null;
    kreisSlug?: string | null;
    ortSlug?: string | null;
  } | null;
  contact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  property?: {
    location?: string | null;
    message?: string | null;
  } | null;
  consent?: {
    privacy?: boolean | null;
    forwarding?: boolean | null;
    tipTerms?: boolean | null;
  } | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildRecipientSubject(locale: string, requestTitle: string, areaName: string, isTip: boolean): string {
  if (locale === "en") {
    return isTip
      ? `New confidential tip for request ${requestTitle || areaName}`
      : `New property offer for request ${requestTitle || areaName}`;
  }
  return isTip
    ? `Neuer Tippgeber-Hinweis fuer Gesuch ${requestTitle || areaName}`
    : `Neues Objektangebot fuer Gesuch ${requestTitle || areaName}`;
}

function isTipMessage(value: string): boolean {
  return value.startsWith("[Tippgeber-Hinweis]");
}

function buildRecipientText(args: {
  locale: string;
  leadId: string;
  areaName: string;
  pagePath: string;
  requestId: string;
  requestTitle: string;
  requestObjectType: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  propertyLocation: string;
  message: string;
  consentSummary: string[];
  isTip: boolean;
}) {
  if (args.locale === "en") {
    return [
      args.isTip
        ? "A confidential tip was submitted for a public search request."
        : "A new property offer was submitted for a public search request.",
      "",
      `Lead ID: ${args.leadId}`,
      `Area: ${args.areaName}`,
      `Page: ${args.pagePath || "-"}`,
      "",
      "Request",
      `Request ID: ${args.requestId || "-"}`,
      `Title: ${args.requestTitle || "-"}`,
      `Property type: ${args.requestObjectType || "-"}`,
      "",
      "Sender",
      `Name: ${args.senderName}`,
      `Email: ${args.senderEmail}`,
      `Phone: ${args.senderPhone || "-"}`,
      "",
      args.isTip ? "Tip" : "Property",
      `Location: ${args.propertyLocation || "-"}`,
      `Message: ${args.message || "-"}`,
      "",
      "Consent",
      ...(args.consentSummary.length > 0 ? args.consentSummary : ["-"]),
    ].join("\n");
  }

  return [
    args.isTip
      ? "Zu einem oeffentlichen Immobiliengesuch wurde ein vertraulicher Tippgeber-Hinweis abgegeben."
      : "Zu einem oeffentlichen Immobiliengesuch wurde ein Objekt angeboten.",
    "",
    `Lead-ID: ${args.leadId}`,
    `Gebiet: ${args.areaName}`,
    `Seite: ${args.pagePath || "-"}`,
    "",
    "Gesuch",
    `Gesuch-ID: ${args.requestId || "-"}`,
    `Titel: ${args.requestTitle || "-"}`,
    `Objektart: ${args.requestObjectType || "-"}`,
    "",
    "Absender",
    `Name: ${args.senderName}`,
    `E-Mail: ${args.senderEmail}`,
    `Telefon: ${args.senderPhone || "-"}`,
    "",
    args.isTip ? "Tippgeber-Hinweis" : "Angebotenes Objekt",
    `Standort: ${args.propertyLocation || "-"}`,
    `Nachricht: ${args.message || "-"}`,
    "",
    "Zustimmungen",
    ...(args.consentSummary.length > 0 ? args.consentSummary : ["-"]),
  ].join("\n");
}

function buildSenderSubject(locale: string, areaName: string, isTip: boolean): string {
  if (locale === "en") {
    return isTip ? `Your confidential tip for ${areaName}` : `Your property offer for ${areaName}`;
  }
  return isTip ? `Ihr Tippgeber-Hinweis fuer ${areaName}` : `Ihr Objektangebot fuer ${areaName}`;
}

function buildSenderText(args: { locale: string; areaName: string; advisorName: string; isTip: boolean }) {
  if (args.locale === "en") {
    return [
      args.isTip ? "Thank you for your confidential tip." : "Thank you for your property offer.",
      "",
      `Area: ${args.areaName}`,
      `Responsible contact: ${args.advisorName || "Advisor"}`,
      "",
      args.isTip
        ? "Your tip has been forwarded successfully. Any possible tip commission will be reviewed separately."
        : "Your message has been forwarded successfully.",
    ].join("\n");
  }

  return [
    args.isTip ? "Vielen Dank fuer Ihren vertraulichen Hinweis." : "Vielen Dank fuer Ihr Objektangebot.",
    "",
    `Gebiet: ${args.areaName}`,
    `Zustaendiger Ansprechpartner: ${args.advisorName || "Berater"}`,
    "",
    args.isTip
      ? "Ihr Hinweis wurde erfolgreich weitergeleitet. Eine moegliche Tippgeberverguetung wird gesondert geprueft."
      : "Ihre Nachricht wurde erfolgreich weitergeleitet.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestOfferPayload;
    const locale = normalizePublicLocale(body.locale);
    const senderName = asText(body.contact?.name);
    const senderEmail = asText(body.contact?.email).toLowerCase();
    const senderPhone = asText(body.contact?.phone);
    const propertyLocation = asText(body.property?.location);
    const message = asText(body.property?.message);
    const isTip = isTipMessage(message);
    const bundeslandSlug = asText(body.context?.bundeslandSlug);
    const kreisSlug = asText(body.context?.kreisSlug);
    const ortSlug = asText(body.context?.ortSlug);

    if (!senderName || !senderEmail || !propertyLocation || !message || !bundeslandSlug || !kreisSlug) {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }
    if (!body.consent?.privacy || !body.consent?.forwarding || (isTip && !body.consent?.tipTerms)) {
      return NextResponse.json({ ok: false, error: "CONSENT_REQUIRED" }, { status: 400 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`request_offer_submit:${ip}:${senderEmail}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", retry_after_sec: limit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const advisor = await resolvePublicAdvisorContact({
      bundeslandSlug,
      kreisSlug,
      ortSlug: ortSlug || null,
    });

    if (!advisor?.advisorEmail) {
      return NextResponse.json({ ok: false, error: "ADVISOR_EMAIL_MISSING" }, { status: 409 });
    }

    const leadId = randomUUID();
    const requestId = asText(body.request?.id);
    const requestTitle = asText(body.request?.title);
    const requestObjectType = asText(body.request?.objectType);
    const pagePath = asText(body.pagePath);
    const sourceForm = asText(body.sourceForm) || (isTip ? "request_tip_modal" : "request_offer");
    const consentSubmittedAt = new Date().toISOString();
    const consentSummary = [
      "privacy=true",
      "forwarding=true",
      ...(isTip ? ["tip_terms=true"] : []),
      `submitted_at=${consentSubmittedAt}`,
    ];

    const recipientMail = await sendSmtpTextMail({
      to: [advisor.advisorEmail],
      subject: buildRecipientSubject(locale, requestTitle, advisor.areaName, isTip),
      text: buildRecipientText({
        locale,
        leadId,
        areaName: advisor.areaName,
        pagePath,
        requestId,
        requestTitle,
        requestObjectType,
        senderName,
        senderEmail,
        senderPhone,
        propertyLocation,
        message,
        consentSummary,
        isTip,
      }),
      replyTo: senderEmail,
    });

    if (!recipientMail.sent) {
      return NextResponse.json({ ok: false, error: "RECIPIENT_MAIL_FAILED" }, { status: 500 });
    }

    await sendSmtpTextMail({
      to: [senderEmail],
      subject: buildSenderSubject(locale, advisor.areaName, isTip),
      text: buildSenderText({
        locale,
        areaName: advisor.areaName,
        advisorName: advisor.advisorName ?? "",
        isTip,
      }),
    });

    await writeSecurityAuditLog({
      actorUserId: "public-request-offer",
      actorRole: "system",
      eventType: "create",
      entityType: "other",
      entityId: leadId,
      payload: {
        action: "request_offer_submit",
        area_id: advisor.areaId,
        partner_id: advisor.partnerId,
        request_id: requestId || null,
        request_title: requestTitle || null,
        request_intent: isTip ? "tip" : "offer",
        source_form: sourceForm,
        page_path: pagePath || null,
        region_label: asText(body.regionLabel) || advisor.areaName,
        locale,
        consent: isTip
          ? {
              privacy: true,
              forwarding: true,
              tip_terms: true,
              submitted_at: consentSubmittedAt,
            }
          : {
              privacy: true,
              forwarding: true,
              submitted_at: consentSubmittedAt,
            },
      },
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, lead_id: leadId });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
