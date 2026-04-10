import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { sendSmtpTextMail } from "@/lib/notifications/admin-review-email";
import { resolvePublicAdvisorContact } from "@/lib/public-advisor-contact";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

type RequestOfferPayload = {
  locale?: string | null;
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
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildRecipientSubject(locale: string, requestTitle: string, areaName: string): string {
  return locale === "en"
    ? `New property offer for request ${requestTitle || areaName}`
    : `Neues Objektangebot fuer Gesuch ${requestTitle || areaName}`;
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
}) {
  if (args.locale === "en") {
    return [
      "A new property offer was submitted for a public search request.",
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
      "Property",
      `Location: ${args.propertyLocation || "-"}`,
      `Message: ${args.message || "-"}`,
    ].join("\n");
  }

  return [
    "Zu einem oeffentlichen Immobiliengesuch wurde ein Objekt angeboten.",
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
    "Angebotenes Objekt",
    `Standort: ${args.propertyLocation || "-"}`,
    `Nachricht: ${args.message || "-"}`,
  ].join("\n");
}

function buildSenderSubject(locale: string, areaName: string): string {
  return locale === "en"
    ? `Your property offer for ${areaName}`
    : `Ihr Objektangebot fuer ${areaName}`;
}

function buildSenderText(args: { locale: string; areaName: string; advisorName: string }) {
  if (args.locale === "en") {
    return [
      "Thank you for your property offer.",
      "",
      `Area: ${args.areaName}`,
      `Responsible contact: ${args.advisorName || "Advisor"}`,
      "",
      "Your message has been forwarded successfully.",
    ].join("\n");
  }

  return [
    "Vielen Dank fuer Ihr Objektangebot.",
    "",
    `Gebiet: ${args.areaName}`,
    `Zustaendiger Ansprechpartner: ${args.advisorName || "Berater"}`,
    "",
    "Ihre Nachricht wurde erfolgreich weitergeleitet.",
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
    const bundeslandSlug = asText(body.context?.bundeslandSlug);
    const kreisSlug = asText(body.context?.kreisSlug);
    const ortSlug = asText(body.context?.ortSlug);

    if (!senderName || !senderEmail || !propertyLocation || !message || !bundeslandSlug || !kreisSlug) {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
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

    const recipientMail = await sendSmtpTextMail({
      to: [advisor.advisorEmail],
      subject: buildRecipientSubject(locale, requestTitle, advisor.areaName),
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
      }),
      replyTo: senderEmail,
    });

    if (!recipientMail.sent) {
      return NextResponse.json({ ok: false, error: "RECIPIENT_MAIL_FAILED" }, { status: 500 });
    }

    await sendSmtpTextMail({
      to: [senderEmail],
      subject: buildSenderSubject(locale, advisor.areaName),
      text: buildSenderText({
        locale,
        areaName: advisor.areaName,
        advisorName: advisor.advisorName ?? "",
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
        page_path: pagePath || null,
        region_label: asText(body.regionLabel) || advisor.areaName,
        locale,
      },
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, lead_id: leadId });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
