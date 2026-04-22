import { notFound } from "next/navigation";

import { getApprovedReportTexts, getReportBySlugs, type SupabaseClientLike } from "@/lib/data";
import { ImmobilienmaklerSection } from "@/features/immobilienmarkt/sections/ImmobilienmaklerSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getVisibleReferencesForKreis } from "@/lib/referenzen";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";
import { loadPublicVisiblePartnerContextForArea } from "@/lib/public-partner-mappings";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { getOffers, type Offer } from "@/lib/angebote";
import { getRegionalRequestsForKreis, type RegionalRequest } from "@/lib/gesuche";

type PageParams = { bundesland?: string; kreis?: string };
type PageProps = { params: Promise<PageParams> };

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return null;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickStableItem<T extends { id: string }>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  return items[stableHash(seed) % items.length] ?? null;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

async function loadFeaturedMarketItems(args: {
  bundeslandSlug: string;
  kreisSlug: string;
}): Promise<{
  featuredBuyOffer: Offer | null;
  featuredRentOffer: Offer | null;
  featuredBuyRequest: RegionalRequest | null;
  featuredRentRequest: RegionalRequest | null;
}> {
  const [buyOffers, rentOffers, buyRequests, rentRequests] = await Promise.all([
    getOffers({ ...args, mode: "kauf", pageSize: 6, locale: "de" }),
    getOffers({ ...args, mode: "miete", pageSize: 6, locale: "de" }),
    getRegionalRequestsForKreis({ ...args, mode: "kauf", pageSize: 6, limit: 48, locale: "de" }),
    getRegionalRequestsForKreis({ ...args, mode: "miete", pageSize: 6, limit: 48, locale: "de" }),
  ]);
  const daySeed = new Date().toISOString().slice(0, 10);
  const buyOfferCandidates = uniqueById([...buyOffers.topOffers, ...buyOffers.offers]);
  const rentOfferCandidates = uniqueById([...rentOffers.topOffers, ...rentOffers.offers]);
  const buyRequestCandidates = uniqueById(buyRequests.requests);
  const rentRequestCandidates = uniqueById(rentRequests.requests);

  return {
    featuredBuyOffer: pickStableItem(buyOfferCandidates, `${args.bundeslandSlug}:${args.kreisSlug}:buy-offer:${daySeed}`),
    featuredRentOffer: pickStableItem(rentOfferCandidates, `${args.bundeslandSlug}:${args.kreisSlug}:rent-offer:${daySeed}`),
    featuredBuyRequest: pickStableItem(buyRequestCandidates, `${args.bundeslandSlug}:${args.kreisSlug}:buy-request:${daySeed}`),
    featuredRentRequest: pickStableItem(rentRequestCandidates, `${args.bundeslandSlug}:${args.kreisSlug}:rent-request:${daySeed}`),
  };
}

export default async function ImmobilienmaklerPage({ params }: PageProps) {
  const resolvedParams = await params;
  const bundeslandSlug = resolvedParams.bundesland ?? "";
  const kreisSlug = resolvedParams.kreis ?? "";

  if (!bundeslandSlug || !kreisSlug) notFound();

  const report = await getReportBySlugs([bundeslandSlug, kreisSlug]);
  if (!report) notFound();

  const meta = asRecord(report.meta) ?? {};
  let reportWithMedia = report;
  const areaId = asString(meta["kreis_schluessel"]) ?? "";
  if (areaId) {
    const admin = createAdminClient() as unknown as SupabaseClientLike & {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => Promise<{ data?: Array<{ auth_user_id?: string | null }> | null }>;
          };
        };
      };
    };
    const partnerContext = await loadPublicVisiblePartnerContextForArea(admin, areaId);
    if (partnerContext.isSystemDefault) {
      notFound();
    }
    if (partnerContext.partnerId) {
      const overrides = await getApprovedReportTexts(admin, areaId, partnerContext.partnerId);
      if (overrides.length > 0) {
        const textBase = asRecord(report["text"]) ?? {};
        const makler = asRecord(textBase["makler"]) ?? {};
        for (const entry of overrides) {
          const key = String(entry.section_key ?? "");
          const value = String(entry.optimized_content ?? "");
          if ((key.startsWith("makler_") || key.startsWith("media_makler_")) && value) {
            makler[key] = value;
          }
        }
        reportWithMedia = {
          ...report,
          text: {
            ...textBase,
            makler,
          },
        };
      }
    }
  }

  const text = asRecord(reportWithMedia["text"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? formatRegionFallback(kreisSlug);
  const bundeslandNameRaw = asString(meta["bundesland_name"]) ?? "";
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : formatRegionFallback(bundeslandSlug);
  const name = firstNonEmpty(asString(makler["makler_name"])) ?? "Maklerempfehlung";
  const logoOverride = asString(makler["media_makler_logo"]) ?? "";
  const email =
    firstNonEmpty(
      asString(makler["makler_email"]),
      asString(berater["berater_email"]),
    ) ??
    "kontakt@wohnlagencheck24.de";

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];
  const breadcrumbTabs = [
    ...tabs,
    { id: "immobilienmakler", label: "Immobilienmakler" },
  ];
  const [references, texts, featuredMarketItems] = await Promise.all([
    getVisibleReferencesForKreis({
      bundeslandSlug,
      kreisSlug,
    }),
    getPortalSystemTexts("de"),
    loadFeaturedMarketItems({ bundeslandSlug, kreisSlug }),
  ]);

  return (
    <>
      <KontaktContextSetter
        vm={{
          scope: "makler",
          title: "Maklerkontakt",
          name,
          email,
          imageSrc: resolveMandatoryMediaSrc("media_makler_logo", logoOverride),
          regionLabel: `Maklerempfehlung – ${kreisSlug}`,
          subjectDefault: `Makleranfrage – ${kreisSlug}`,
        }}
      />
      <div className="container text-dark">
        <div className="breadcrumb-sticky mb-3">
          <ImmobilienmarktBreadcrumb
            tabs={breadcrumbTabs}
            activeTabId="immobilienmakler"
            basePath={basePath}
            texts={texts}
            ctx={{ bundeslandSlug, kreisSlug }}
            names={{ regionName: kreisName, bundeslandName, kreisName }}
            compact
            rootIconSrc="/logo/wohnlagencheck24.svg"
          />
        </div>
        <ImmobilienmaklerSection
          report={reportWithMedia}
          bundeslandSlug={bundeslandSlug}
          kreisSlug={kreisSlug}
          basePath={basePath}
          references={references}
          featuredBuyOffer={featuredMarketItems.featuredBuyOffer}
          featuredRentOffer={featuredMarketItems.featuredRentOffer}
          featuredBuyRequest={featuredMarketItems.featuredBuyRequest}
          featuredRentRequest={featuredMarketItems.featuredRentRequest}
        />
      </div>
    </>
  );
}
