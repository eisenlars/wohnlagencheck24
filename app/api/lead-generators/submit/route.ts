import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { sendSmtpTextMail } from "@/lib/notifications/admin-review-email";
import { loadSinglePublicVisiblePartnerIdForArea } from "@/lib/public-partner-mappings";
import { normalizeLeadGeneratorLocale, type LeadGeneratorSubmissionPayload } from "@/features/lead-generators/core/types";

type PartnerRow = {
  id?: string | null;
  company_name?: string | null;
  contact_email?: string | null;
  contact_first_name?: string | null;
};

type AreaRow = {
  id?: string | null;
  name?: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function buildRecipientSubject(locale: string, areaName: string): string {
  return locale === "en"
    ? `New valuation inquiry for ${areaName}`
    : `Neue Bewertungsanfrage fuer ${areaName}`;
}

function buildRecipientMailText(args: {
  locale: string;
  areaName: string;
  partnerName: string;
  leadId: string;
  payload: LeadGeneratorSubmissionPayload;
}): string {
  const answers = asObject(args.payload.answers);
  const derived = asObject(args.payload.derivedData);
  const propertyType = asText(answers.propertyType);
  const livingArea = String(answers.livingArea ?? "").trim();
  const rooms = String(answers.rooms ?? "").trim();
  const yearBuilt = String(answers.yearBuilt ?? "").trim();
  const condition = asText(answers.condition);
  const entryMode = asText(answers.entryMode);
  const features = asText(answers.features);
  const address = asText(answers.address);
  const postalOrCity = asText(answers.postalOrCity);

  if (args.locale === "en") {
    return [
      "A new valuation inquiry was submitted via Wohnlagencheck24.",
      "",
      `Lead ID: ${args.leadId}`,
      `Area: ${args.areaName}`,
      `Partner: ${args.partnerName}`,
      `Flow: ${args.payload.flowKey}`,
      `Variant: ${args.payload.variantKey}`,
      `Page: ${args.payload.pagePath}`,
      "",
      "Contact",
      `Name: ${args.payload.contact.name}`,
      `Email: ${args.payload.contact.email}`,
      `Phone: ${args.payload.contact.phone ?? "not provided"}`,
      "",
      "Property details",
      `Property type: ${propertyType || "-"}`,
      `Living area: ${livingArea || "-"}`,
      `Rooms: ${rooms || "-"}`,
      `Year built: ${yearBuilt || "-"}`,
      `Condition: ${condition || "-"}`,
      `Entry mode: ${entryMode || "-"}`,
      `ZIP/City: ${postalOrCity || "-"}`,
      `Address: ${address || "-"}`,
      `Features: ${features || "-"}`,
      "",
      "Indicative range",
      `Min price: ${derived.estimated_min_price ?? "-"}`,
      `Avg price: ${derived.estimated_avg_price ?? "-"}`,
      `Max price: ${derived.estimated_max_price ?? "-"}`,
      `Min price/sqm: ${derived.estimated_min_price_per_sqm ?? "-"}`,
      `Max price/sqm: ${derived.estimated_max_price_per_sqm ?? "-"}`,
    ].join("\n");
  }

  return [
    "Ueber Wohnlagencheck24 wurde eine neue Bewertungsanfrage eingereicht.",
    "",
    `Lead-ID: ${args.leadId}`,
    `Gebiet: ${args.areaName}`,
    `Partner: ${args.partnerName}`,
    `Flow: ${args.payload.flowKey}`,
    `Variante: ${args.payload.variantKey}`,
    `Seite: ${args.payload.pagePath}`,
    "",
    "Kontakt",
    `Name: ${args.payload.contact.name}`,
    `E-Mail: ${args.payload.contact.email}`,
    `Telefon: ${args.payload.contact.phone ?? "nicht angegeben"}`,
    "",
    "Objektdaten",
    `Objektart: ${propertyType || "-"}`,
    `Wohnflaeche: ${livingArea || "-"}`,
    `Zimmer: ${rooms || "-"}`,
    `Baujahr: ${yearBuilt || "-"}`,
    `Zustand: ${condition || "-"}`,
    `Einstieg: ${entryMode || "-"}`,
    `PLZ/Ort: ${postalOrCity || "-"}`,
    `Adresse: ${address || "-"}`,
    `Besonderheiten: ${features || "-"}`,
    "",
    "Orientierungsrange",
    `Preis min.: ${derived.estimated_min_price ?? "-"}`,
    `Preis avg.: ${derived.estimated_avg_price ?? "-"}`,
    `Preis max.: ${derived.estimated_max_price ?? "-"}`,
    `Preis/m² min.: ${derived.estimated_min_price_per_sqm ?? "-"}`,
    `Preis/m² max.: ${derived.estimated_max_price_per_sqm ?? "-"}`,
  ].join("\n");
}

function buildSenderSubject(locale: string, areaName: string): string {
  return locale === "en"
    ? `Your valuation inquiry for ${areaName}`
    : `Ihre Bewertungsanfrage fuer ${areaName}`;
}

function buildSenderMailText(args: {
  locale: string;
  areaName: string;
  recipientLabel: string;
}): string {
  if (args.locale === "en") {
    return [
      "Thank you for your valuation inquiry.",
      "",
      `Area: ${args.areaName}`,
      `Responsible contact: ${args.recipientLabel}`,
      "",
      "Your inquiry has been forwarded and will now be reviewed.",
    ].join("\n");
  }

  return [
    "Vielen Dank fuer Ihre Bewertungsanfrage.",
    "",
    `Gebiet: ${args.areaName}`,
    `Zustaendiger Ansprechpartner: ${args.recipientLabel}`,
    "",
    "Ihre Anfrage wurde weitergeleitet und wird nun geprueft.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<LeadGeneratorSubmissionPayload>;
    const payload = body as LeadGeneratorSubmissionPayload;
    const locale = normalizeLeadGeneratorLocale(payload.locale);
    const email = asText(payload.contact?.email);
    const name = asText(payload.contact?.name);
    const sourceAreaId = asText(payload.sourceAreaId);
    const targetAreaId = asText(payload.targetAreaId) || sourceAreaId;
    const generatorType = asText(payload.generatorType);
    const flowKey = asText(payload.flowKey);

    if (generatorType !== "immobilienbewertung" || flowKey !== "bewertung_range_local_v1") {
      return NextResponse.json({ ok: false, error: "FLOW_NOT_SUPPORTED" }, { status: 400 });
    }
    if (!sourceAreaId || !targetAreaId || sourceAreaId !== targetAreaId) {
      return NextResponse.json({ ok: false, error: "INVALID_AREA_SCOPE" }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ ok: false, error: "CONTACT_REQUIRED" }, { status: 400 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`lead_generator_submit:${ip}:${email}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", retry_after_sec: limit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const admin = createAdminClient();
    const resolvedPartnerId = await loadSinglePublicVisiblePartnerIdForArea(admin, sourceAreaId);
    if (!resolvedPartnerId || resolvedPartnerId !== asText(payload.partnerId)) {
      return NextResponse.json({ ok: false, error: "AREA_PARTNER_UNAVAILABLE" }, { status: 409 });
    }

    const [partnerRes, areaRes] = await Promise.all([
      admin
        .from("partners")
        .select("id, company_name, contact_email, contact_first_name")
        .eq("id", resolvedPartnerId)
        .maybeSingle(),
      admin
        .from("areas")
        .select("id, name")
        .eq("id", sourceAreaId)
        .maybeSingle(),
    ]);

    if (partnerRes.error) {
      return NextResponse.json({ ok: false, error: "PARTNER_LOOKUP_FAILED" }, { status: 500 });
    }
    if (areaRes.error) {
      return NextResponse.json({ ok: false, error: "AREA_LOOKUP_FAILED" }, { status: 500 });
    }

    const partner = (partnerRes.data ?? {}) as PartnerRow;
    const area = (areaRes.data ?? {}) as AreaRow;
    const recipientEmail = asText(partner.contact_email);
    const partnerName = asText(partner.company_name) || resolvedPartnerId;
    const recipientLabel = asText(payload.leadRecipientLabel) || asText(partner.contact_first_name) || partnerName;
    const areaName = asText(area.name) || asText(payload.regionLabel) || sourceAreaId;
    if (!recipientEmail) {
      return NextResponse.json({ ok: false, error: "PARTNER_EMAIL_MISSING" }, { status: 409 });
    }

    const leadId = randomUUID();
    const recipientMail = await sendSmtpTextMail({
      to: [recipientEmail],
      subject: buildRecipientSubject(locale, areaName),
      text: buildRecipientMailText({
        locale,
        areaName,
        partnerName,
        leadId,
        payload,
      }),
      replyTo: email,
    });
    if (!recipientMail.sent) {
      return NextResponse.json({ ok: false, error: "RECIPIENT_MAIL_FAILED" }, { status: 500 });
    }

    const senderMail = await sendSmtpTextMail({
      to: [email],
      subject: buildSenderSubject(locale, areaName),
      text: buildSenderMailText({
        locale,
        areaName,
        recipientLabel,
      }),
    });

    await writeSecurityAuditLog({
      actorUserId: "public-lead-generator",
      actorRole: "system",
      eventType: "create",
      entityType: "other",
      entityId: leadId,
      payload: {
        action: "lead_generator_submit",
        generator_type: generatorType,
        flow_key: flowKey,
        area_id: sourceAreaId,
        partner_id: resolvedPartnerId,
        locale,
        sender_mail_sent: senderMail.sent,
        sender_mail_reason: senderMail.reason ?? null,
      },
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, lead_id: leadId });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
