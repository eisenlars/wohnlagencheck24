import { getApprovedReportTexts, getReportBySlugs, type Report, type SupabaseClientLike } from "@/lib/data";
import { loadPublicVisiblePartnerContextForArea } from "@/lib/public-partner-mappings";
import { asRecord, asString } from "@/utils/records";
import { createAdminClient } from "@/utils/supabase/admin";

type PublicAdvisorContactArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string | null;
};

export type PublicAdvisorContact = {
  areaId: string;
  areaName: string;
  partnerId: string | null;
  advisorName: string | null;
  advisorEmail: string | null;
  advisorPhone: string | null;
  brokerName: string | null;
  brokerEmail: string | null;
  brokerPhone: string | null;
};

function applyAdvisorOverrides(report: Report, overrides: Array<{ section_key: string; optimized_content: string | null }>): Report {
  if (overrides.length === 0) return report;
  const textBase = asRecord(report["text"]) ?? asRecord(asRecord(report.data)?.["text"]) ?? {};
  const beraterBase = asRecord(textBase["berater"]) ?? {};
  const maklerBase = asRecord(textBase["makler"]) ?? {};
  const berater = { ...beraterBase };
  const makler = { ...maklerBase };

  for (const entry of overrides) {
    const key = String(entry.section_key ?? "").trim();
    if (key.startsWith("berater_") || key === "media_berater_avatar") {
      berater[key] = String(entry.optimized_content ?? "");
      continue;
    }
    if (key.startsWith("makler_") || key === "media_makler_logo") {
      makler[key] = String(entry.optimized_content ?? "");
    }
  }

  return {
    ...report,
    text: {
      ...textBase,
      berater,
      makler,
    },
  };
}

export async function resolvePublicAdvisorContact(args: PublicAdvisorContactArgs): Promise<PublicAdvisorContact | null> {
  const slugs = [args.bundeslandSlug, args.kreisSlug, args.ortSlug ?? ""].map((value) => String(value ?? "").trim()).filter(Boolean);
  if (slugs.length < 2) return null;

  const report = await getReportBySlugs(slugs);
  if (!report) return null;

  const meta = asRecord(report.meta) ?? {};
  const areaId =
    asString(meta["ortslage_schluessel"]) ??
    asString(meta["ort_schluessel"]) ??
    asString(meta["kreis_schluessel"]) ??
    "";
  const areaName =
    asString(meta["ortslage_name"]) ??
    asString(meta["ort_name"]) ??
    asString(meta["kreis_name"]) ??
    slugs[slugs.length - 1];

  if (!areaId) return null;

  const admin = createAdminClient();
  const partnerContext = await loadPublicVisiblePartnerContextForArea(admin, areaId);

  let reportWithOverrides = report;
  if (partnerContext.partnerId && !partnerContext.isSystemDefault) {
    const overrides = await getApprovedReportTexts(
      admin as unknown as SupabaseClientLike,
      areaId,
      partnerContext.partnerId,
    );
    reportWithOverrides = applyAdvisorOverrides(report, overrides);
  }

  const text = asRecord(reportWithOverrides["text"]) ?? asRecord(asRecord(reportWithOverrides.data)?.["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};

  return {
    areaId,
    areaName,
    partnerId: partnerContext.partnerId,
    advisorName: asString(berater["berater_name"]) ?? null,
    advisorEmail: asString(berater["berater_email"]) ?? null,
    advisorPhone:
      asString(berater["berater_telefon_mobil"]) ??
      asString(berater["berater_telefon_fest"]) ??
      asString(berater["berater_telefon"]) ??
      "+49 351/287051-0",
    brokerName: asString(makler["makler_name"]) ?? null,
    brokerEmail:
      asString(makler["makler_email"]) ??
      asString(berater["berater_email"]) ??
      "kontakt@wohnlagencheck24.de",
    brokerPhone:
      asString(makler["makler_telefon_mobil"]) ??
      asString(makler["makler_telefon_fest"]) ??
      asString(makler["makler_telefon"]) ??
      "+49 351/287051-0",
  };
}
