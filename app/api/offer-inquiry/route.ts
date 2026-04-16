import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { sendSmtpTextMail } from "@/lib/notifications/admin-review-email";
import { resolvePublicAdvisorContact } from "@/lib/public-advisor-contact";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type OfferInquiryPayload = {
  locale?: string | null;
  pagePath?: string | null;
  regionLabel?: string | null;
  offer?: {
    id?: string | null;
    title?: string | null;
    objectType?: string | null;
    address?: string | null;
  } | null;
  context?: {
    bundeslandSlug?: string | null;
    kreisSlug?: string | null;
    ortSlug?: string | null;
  } | null;
  contact?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  inquiry?: {
    location?: string | null;
    message?: string | null;
  } | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildRecipientSubject(locale: string, offerTitle: string, areaName: string): string {
  return locale === "en"
    ? `New inquiry for property ${offerTitle || areaName}`
    : `Neue Anfrage fuer Objekt ${offerTitle || areaName}`;
}

function buildRecipientText(args: {
  locale: string;
  leadId: string;
  areaName: string;
  pagePath: string;
  offerId: string;
  offerTitle: string;
  offerObjectType: string;
  offerAddress: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  message: string;
}) {
  if (args.locale === "en") {
    return [
      "A new public inquiry was submitted for a property listing.",
      "",
      `Lead ID: ${args.leadId}`,
      `Area: ${args.areaName}`,
      `Page: ${args.pagePath || "-"}`,
      "",
      "Property",
      `Offer ID: ${args.offerId || "-"}`,
      `Title: ${args.offerTitle || "-"}`,
      `Property type: ${args.offerObjectType || "-"}`,
      `Address: ${args.offerAddress || "-"}`,
      "",
      "Sender",
      `Name: ${args.senderName}`,
      `Email: ${args.senderEmail}`,
      `Phone: ${args.senderPhone || "-"}`,
      "",
      "Inquiry",
      `Message: ${args.message || "-"}`,
    ].join("\n");
  }

  return [
    "Zu einem oeffentlichen Immobilienangebot wurde eine Anfrage gestellt.",
    "",
    `Lead-ID: ${args.leadId}`,
    `Gebiet: ${args.areaName}`,
    `Seite: ${args.pagePath || "-"}`,
    "",
    "Objekt",
    `Objekt-ID: ${args.offerId || "-"}`,
    `Titel: ${args.offerTitle || "-"}`,
    `Objektart: ${args.offerObjectType || "-"}`,
    `Adresse: ${args.offerAddress || "-"}`,
    "",
    "Absender",
    `Name: ${args.senderName}`,
    `E-Mail: ${args.senderEmail}`,
    `Telefon: ${args.senderPhone || "-"}`,
    "",
    "Anfrage",
    `Nachricht: ${args.message || "-"}`,
  ].join("\n");
}

function buildSenderSubject(locale: string, areaName: string): string {
  return locale === "en"
    ? `Your property inquiry for ${areaName}`
    : `Ihre Immobilienanfrage fuer ${areaName}`;
}

function buildSenderText(args: { locale: string; areaName: string; advisorName: string }) {
  if (args.locale === "en") {
    return [
      "Thank you for your inquiry.",
      "",
      `Area: ${args.areaName}`,
      `Responsible contact: ${args.advisorName || "Advisor"}`,
      "",
      "Your inquiry has been forwarded successfully.",
    ].join("\n");
  }

  return [
    "Vielen Dank fuer Ihre Anfrage.",
    "",
    `Gebiet: ${args.areaName}`,
    `Zustaendiger Ansprechpartner: ${args.advisorName || "Berater"}`,
    "",
    "Ihre Anfrage wurde erfolgreich weitergeleitet.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as OfferInquiryPayload;
    const locale = normalizePublicLocale(body.locale);
    const senderName = [asText(body.contact?.firstName), asText(body.contact?.lastName)].filter(Boolean).join(" ")
      || asText(body.contact?.name);
    const senderEmail = asText(body.contact?.email).toLowerCase();
    const senderPhone = asText(body.contact?.phone);
    const message = asText(body.inquiry?.message);
    const bundeslandSlug = asText(body.context?.bundeslandSlug);
    const kreisSlug = asText(body.context?.kreisSlug);
    const ortSlug = asText(body.context?.ortSlug);

    if (!senderName || !senderEmail || !message || !bundeslandSlug || !kreisSlug) {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`offer_inquiry_submit:${ip}:${senderEmail}`, {
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
    const offerId = asText(body.offer?.id);
    const offerTitle = asText(body.offer?.title);
    const offerObjectType = asText(body.offer?.objectType);
    const offerAddress = asText(body.offer?.address);
    const pagePath = asText(body.pagePath);

    const recipientMail = await sendSmtpTextMail({
      to: [advisor.advisorEmail],
      subject: buildRecipientSubject(locale, offerTitle, advisor.areaName),
      text: buildRecipientText({
        locale,
        leadId,
        areaName: advisor.areaName,
        pagePath,
        offerId,
        offerTitle,
        offerObjectType,
        offerAddress,
        senderName,
        senderEmail,
        senderPhone,
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
      actorUserId: "public-offer-inquiry",
      actorRole: "system",
      eventType: "create",
      entityType: "other",
      entityId: leadId,
      payload: {
        action: "offer_inquiry_submit",
        area_id: advisor.areaId,
        partner_id: advisor.partnerId,
        offer_id: offerId || null,
        offer_title: offerTitle || null,
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
