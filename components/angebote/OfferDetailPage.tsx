'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { Offer, OfferMode, OfferOverrides } from "@/lib/angebote";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import { getPurchaseCostRates } from "@/lib/purchase-cost-rates";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { formatMetric } from "@/utils/format";
import { asRecord } from "@/utils/records";
import { OfferInquiryInlineForm } from "./OfferInquiryInlineForm";

type MediaAssetKind = "image" | "floorplan" | "location_map" | "document";

type MediaAsset = {
  url: string;
  title: string | null;
  position: number | null;
  kind: MediaAssetKind;
};

type DocumentAsset = {
  url: string;
  title: string | null;
  name: string | null;
  position: number | null;
  kind: "document" | "floorplan" | "video";
  is_exposee: boolean | null;
  on_landing_page: boolean | null;
};

type EnergySnapshot = {
  certificate_type: string | null;
  value: number | null;
  value_kind: "bedarf" | "verbrauch" | null;
  construction_year: number | null;
  heating_energy_source: string | null;
  efficiency_class: string | null;
  certificate_availability: string | null;
  certificate_start_date: string | null;
  certificate_end_date: string | null;
  warm_water_included: boolean | null;
  demand: number | null;
  year: number | null;
};

type DetailsSnapshot = {
  living_area_sqm: number | null;
  usable_area_sqm: number | null;
  plot_area_sqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  construction_year: number | null;
  condition: string | null;
  availability: string | null;
  parking: string | null;
  balcony: boolean | null;
  terrace: boolean | null;
  garden: boolean | null;
  elevator: boolean | null;
  address_hidden: boolean | null;
};

type NarrativeSection = {
  kicker: string;
  title: string;
  copy?: string;
  items?: string[];
};

type OfferDetailPageProps = {
  offer: Offer;
  overrides?: OfferOverrides | null;
  mode: OfferMode;
  texts: PortalSystemTextMap;
  formatProfile: PortalFormatProfile;
  pagePath: string;
  advisor: {
    name: string | null;
    phone: string | null;
    href: string | null;
  };
  breadcrumb: {
    tabs: { id: string; label: string }[];
    activeTabId: string;
    basePath: string;
    parentBasePath?: string;
    ctx?: {
      bundeslandSlug?: string;
      kreisSlug?: string;
      ortSlug?: string;
    };
    names?: {
      regionName?: string;
      bundeslandName?: string;
      kreisName?: string;
    };
  };
  listPath: string;
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readTextValue(value: unknown): string | null {
  const direct = asText(value);
  if (direct) return direct;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["value"]) ?? asText(record["label"]);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function parseMediaAssets(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!record) return null;
      const url = asText(record.url);
      if (!url) return null;
      const normalizedKind = String(record.kind ?? "").trim().toLowerCase();
      const kind: MediaAssetKind = normalizedKind === "floorplan"
        ? "floorplan"
        : normalizedKind === "location_map"
          ? "location_map"
          : normalizedKind === "document"
            ? "document"
            : "image";
      return {
        url,
        title: asText(record.title),
        position: asNumber(record.position),
        kind,
      } satisfies MediaAsset;
    })
    .filter((entry): entry is MediaAsset => Boolean(entry))
    .sort((left, right) => {
      if (left.position == null && right.position == null) return left.url.localeCompare(right.url);
      if (left.position == null) return 1;
      if (right.position == null) return -1;
      return left.position - right.position;
    });
}

function uniqByUrl(items: MediaAsset[]): MediaAsset[] {
  const seen = new Set<string>();
  const out: MediaAsset[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function parseDocumentAssets(value: unknown): DocumentAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!record) return null;
      const url = asText(record.url);
      if (!url) return null;
      const normalizedKind = String(record.kind ?? "").trim().toLowerCase();
      const kind: DocumentAsset["kind"] = normalizedKind === "floorplan"
        ? "floorplan"
        : normalizedKind === "video"
          ? "video"
          : "document";
      return {
        url,
        title: asText(record.title),
        name: asText(record.name),
        position: asNumber(record.position),
        kind,
        is_exposee: asBoolean(record.is_exposee),
        on_landing_page: asBoolean(record.on_landing_page),
      } satisfies DocumentAsset;
    })
    .filter((entry): entry is DocumentAsset => Boolean(entry))
    .sort((left, right) => {
      if (left.position == null && right.position == null) return left.url.localeCompare(right.url);
      if (left.position == null) return 1;
      if (right.position == null) return -1;
      return left.position - right.position;
    });
}

function uniqDocumentsByUrl(items: DocumentAsset[]): DocumentAsset[] {
  const seen = new Set<string>();
  const out: DocumentAsset[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function parseEnergySnapshot(value: unknown): EnergySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const normalizedValueKind = String(record.value_kind ?? "").trim().toLowerCase();
  return {
    certificate_type: asText(record.certificate_type),
    value: asNumber(record.value),
    value_kind: normalizedValueKind === "bedarf"
      ? "bedarf"
      : normalizedValueKind === "verbrauch"
        ? "verbrauch"
        : null,
    construction_year: asNumber(record.construction_year),
    heating_energy_source: asText(record.heating_energy_source),
    efficiency_class: asText(record.efficiency_class),
    certificate_availability: asText(record.certificate_availability),
    certificate_start_date: asText(record.certificate_start_date),
    certificate_end_date: asText(record.certificate_end_date),
    warm_water_included: asBoolean(record.warm_water_included),
    demand: asNumber(record.demand),
    year: asNumber(record.year),
  };
}

function parseDetailsSnapshot(value: unknown): DetailsSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    living_area_sqm: asNumber(record.living_area_sqm),
    usable_area_sqm: asNumber(record.usable_area_sqm),
    plot_area_sqm: asNumber(record.plot_area_sqm),
    rooms: asNumber(record.rooms),
    bedrooms: asNumber(record.bedrooms),
    bathrooms: asNumber(record.bathrooms),
    floor: asNumber(record.floor),
    construction_year: asNumber(record.construction_year),
    condition: asText(record.condition),
    availability: asText(record.availability),
    parking: asText(record.parking),
    balcony: asBoolean(record.balcony),
    terrace: asBoolean(record.terrace),
    garden: asBoolean(record.garden),
    elevator: asBoolean(record.elevator),
    address_hidden: asBoolean(record.address_hidden),
  };
}

function formatBooleanLabel(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Ja" : "Nein";
}

function toTelHref(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const compact = normalized.replace(/[^+\d]/g, "");
  return compact ? `tel:${compact}` : null;
}

function parsePercentValue(value: string | null | undefined): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (/provisionsfrei/i.test(normalized)) return 0;
  const match = normalized.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercentLabel(value: number): string {
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE").format(parsed);
}

export function OfferDetailPage(props: OfferDetailPageProps) {
  const { offer, mode, texts, formatProfile, pagePath, advisor, breadcrumb, listPath } = props;
  const isEnglish = String(formatProfile.locale).toLowerCase().startsWith("en");
  const priceLabel = mode === "miete" ? texts.warm_rent : texts.purchase_price;
  const priceSuffix = mode === "miete" ? texts.per_month : "";
  const formatCurrency = (value: number | null) => formatMetric(value, {
    kind: "currency",
    ctx: "kpi",
    unit: "eur",
    locale: formatProfile.locale,
    numberLocale: formatProfile.intlLocale,
    currencyCode: formatProfile.currencyCode,
    fractionDigits: 0,
  });
  const formatArea = (value: number | null) => formatMetric(value, {
    kind: "flaeche",
    ctx: "kpi",
    unit: "none",
    locale: formatProfile.locale,
    numberLocale: formatProfile.intlLocale,
    fractionDigits: 0,
  });
  const formatRooms = (value: number | null) => formatMetric(value, {
    kind: "anzahl",
    ctx: "kpi",
    unit: "none",
    locale: formatProfile.locale,
    numberLocale: formatProfile.intlLocale,
    fractionDigits: 0,
  });
  const raw = useMemo(() => asRecord(offer.raw) ?? {}, [offer.raw]);
  const gallery = useMemo(
    () => (Array.isArray(raw["gallery"]) ? (raw["gallery"] as string[]) : []),
    [raw],
  );
  const galleryAssets = useMemo(() => parseMediaAssets(raw["gallery_assets"]), [raw]);
  const fallbackPhotoAssets = useMemo(
    () =>
      gallery.length > 0
        ? gallery.map((url, index) => ({
            url,
            title: null,
            position: index + 1,
            kind: "image" as const,
          }))
        : offer.imageUrl
          ? [{ url: offer.imageUrl, title: null, position: 1, kind: "image" as const }]
          : [],
    [gallery, offer.imageUrl],
  );
  const photoAssets = useMemo(() => {
    const explicitPhotos = galleryAssets.filter((asset) => asset.kind === "image");
    return uniqByUrl(explicitPhotos.length > 0 ? explicitPhotos : fallbackPhotoAssets);
  }, [fallbackPhotoAssets, galleryAssets]);
  const floorplanAssets = useMemo(() => {
    const explicit = galleryAssets.filter((asset) => asset.kind === "floorplan");
    const legacyFloorplanUrl = asText(raw["floorplan_url"]);
    const legacy = legacyFloorplanUrl
      ? [{ url: legacyFloorplanUrl, title: texts.floor_plan, position: null, kind: "floorplan" as const }]
      : [];
    return uniqByUrl([...explicit, ...legacy]);
  }, [galleryAssets, raw, texts.floor_plan]);
  const locationMapAssets = useMemo(() => {
    const explicit = galleryAssets.filter((asset) => asset.kind === "location_map");
    const legacyMapUrl = asText(raw["map_url"]);
    const legacy = legacyMapUrl
      ? [{ url: legacyMapUrl, title: texts.location_map, position: null, kind: "location_map" as const }]
      : [];
    return uniqByUrl([...explicit, ...legacy]);
  }, [galleryAssets, raw, texts.location_map]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeFloorplanIndex, setActiveFloorplanIndex] = useState(0);
  const [activeLocationMapIndex, setActiveLocationMapIndex] = useState(0);
  const [isGalleryLightboxOpen, setIsGalleryLightboxOpen] = useState(false);
  const resolvedPhotoIndex = activePhotoIndex < photoAssets.length ? activePhotoIndex : 0;
  const resolvedFloorplanIndex = activeFloorplanIndex < floorplanAssets.length ? activeFloorplanIndex : 0;
  const resolvedLocationMapIndex =
    activeLocationMapIndex < locationMapAssets.length ? activeLocationMapIndex : 0;
  const activePhoto = photoAssets[resolvedPhotoIndex] ?? null;
  const activeFloorplan = floorplanAssets[resolvedFloorplanIndex] ?? null;
  const activeLocationMap = locationMapAssets[resolvedLocationMapIndex] ?? null;
  const mediaTabs = [
    { id: "images" as const, label: isEnglish ? "Images" : "Bilder", count: photoAssets.length },
    { id: "floorplans" as const, label: texts.floor_plan, count: floorplanAssets.length },
    { id: "maps" as const, label: texts.location_map, count: locationMapAssets.length },
  ].filter((tab) => tab.count > 0);
  const [activeMediaTab, setActiveMediaTab] = useState<"images" | "floorplans" | "maps">(
    mediaTabs[0]?.id ?? "images",
  );
  const features = Array.isArray(raw["features"]) ? (raw["features"] as string[]) : [];
  const energySnapshot = useMemo(() => parseEnergySnapshot(raw["energy"]), [raw]);
  const detailsSnapshot = useMemo(() => parseDetailsSnapshot(raw["details"]), [raw]);
  const rawDocuments = useMemo(() => parseDocumentAssets(raw["documents"]), [raw]);
  const documentAssets = useMemo(
    () => uniqDocumentsByUrl([
      ...rawDocuments,
      ...galleryAssets
        .filter((asset) => asset.kind === "document")
        .map((asset) => ({
          url: asset.url,
          title: asset.title,
          name: null,
          position: asset.position,
          kind: "document" as const,
          is_exposee: null,
          on_landing_page: null,
        })),
    ]),
    [galleryAssets, rawDocuments],
  );

  const title = offer.seoH1 || offer.title || texts.object_generic;
  const description =
    offer.longDescription ??
    readTextValue(raw["long_description"]) ??
    readTextValue(raw["description"]);
  const locationText =
    offer.locationText ??
    readTextValue(raw["location"]);
  const featuresText =
    offer.featuresText ??
    readTextValue(raw["features_note"]);
  const highlights =
    offer.highlights ?? (Array.isArray(raw["highlights"]) ? (raw["highlights"] as string[]) : []);
  const imageAltTexts = offer.imageAltTexts ?? [];
  const objectCommissionText =
    readTextValue(raw["external_commission"]) ??
    readTextValue(raw["internal_commission"]) ??
    readTextValue(raw["courtage"]) ??
    readTextValue(raw["courtage_note"]);
  const isCommissionFree = asBoolean(raw["free_commission"]);
  const displayPrice = mode === "miete" ? offer.rent : offer.price;
  const pricePerSqm =
    displayPrice != null && offer.areaSqm && Number.isFinite(offer.areaSqm) && offer.areaSqm > 0
      ? displayPrice / offer.areaSqm
      : null;
  const purchaseCostRates = useMemo(
    () => getPurchaseCostRates(breadcrumb.ctx?.bundeslandSlug),
    [breadcrumb.ctx?.bundeslandSlug],
  );
  const buyerCommissionRate = isCommissionFree ? 0 : parsePercentValue(objectCommissionText);
  const notaryCosts = mode === "kauf" && displayPrice != null ? displayPrice * (purchaseCostRates.notaryRate / 100) : null;
  const landRegistryCosts =
    mode === "kauf" && displayPrice != null ? displayPrice * (purchaseCostRates.landRegistryRate / 100) : null;
  const realEstateTransferTax =
    mode === "kauf" && displayPrice != null ? displayPrice * (purchaseCostRates.realEstateTransferTaxRate / 100) : null;
  const buyerCommissionCosts =
    mode === "kauf" && displayPrice != null && buyerCommissionRate != null
      ? displayPrice * (buyerCommissionRate / 100)
      : null;
  const totalPurchaseCosts =
    mode === "kauf" && displayPrice != null
      ? displayPrice +
        (notaryCosts ?? 0) +
        (landRegistryCosts ?? 0) +
        (realEstateTransferTax ?? 0) +
        (buyerCommissionCosts ?? 0)
      : null;
  const detailFacts = [
    detailsSnapshot?.usable_area_sqm != null ? { label: "Nutzfläche", value: `${formatArea(detailsSnapshot.usable_area_sqm)} m²` } : null,
    detailsSnapshot?.plot_area_sqm != null ? { label: "Grundstück", value: `${formatArea(detailsSnapshot.plot_area_sqm)} m²` } : null,
    detailsSnapshot?.bedrooms != null ? { label: "Schlafzimmer", value: formatRooms(detailsSnapshot.bedrooms) } : null,
    detailsSnapshot?.bathrooms != null ? { label: "Badezimmer", value: formatRooms(detailsSnapshot.bathrooms) } : null,
    detailsSnapshot?.floor != null ? { label: "Etage", value: String(detailsSnapshot.floor) } : null,
    (detailsSnapshot?.construction_year ?? energySnapshot?.construction_year ?? energySnapshot?.year) != null
      ? { label: "Baujahr", value: String(detailsSnapshot?.construction_year ?? energySnapshot?.construction_year ?? energySnapshot?.year) }
      : null,
    detailsSnapshot?.availability ? { label: "Verfügbarkeit", value: detailsSnapshot.availability } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const equipmentFacts = [
    detailsSnapshot?.condition ? { label: "Zustand", value: detailsSnapshot.condition } : null,
    detailsSnapshot?.parking ? { label: "Stellplatz", value: detailsSnapshot.parking } : null,
    detailsSnapshot?.balcony != null ? { label: "Balkon", value: formatBooleanLabel(detailsSnapshot.balcony) } : null,
    detailsSnapshot?.terrace != null ? { label: "Terrasse", value: formatBooleanLabel(detailsSnapshot.terrace) } : null,
    detailsSnapshot?.garden != null ? { label: "Garten", value: formatBooleanLabel(detailsSnapshot.garden) } : null,
    detailsSnapshot?.elevator != null ? { label: "Aufzug", value: formatBooleanLabel(detailsSnapshot.elevator) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const energyFacts = [
    { label: texts.energy_class, value: energySnapshot?.efficiency_class ?? "—" },
    {
      label: texts.energy_demand,
      value: energySnapshot?.value != null
        ? `${energySnapshot.value}${energySnapshot.value_kind ? ` (${energySnapshot.value_kind})` : ""}`
        : "—",
    },
    { label: texts.primary_energy_source, value: energySnapshot?.heating_energy_source ?? "—" },
    { label: "Ausweisart", value: energySnapshot?.certificate_type ?? "—" },
    { label: "Ausweis vorhanden", value: energySnapshot?.certificate_availability ?? "—" },
    { label: "Ausgestellt am", value: formatDateLabel(energySnapshot?.certificate_start_date) },
    { label: "Gültig bis", value: formatDateLabel(energySnapshot?.certificate_end_date) },
    { label: "Warmwasser enthalten", value: formatBooleanLabel(energySnapshot?.warm_water_included) },
  ].filter((item) => item.value !== "—");
  const priceFacts = [
    displayPrice != null ? { label: mode === "miete" ? texts.warm_rent : texts.purchase_price, value: formatCurrency(displayPrice) } : null,
    pricePerSqm != null ? { label: "Preis pro m²", value: `${formatCurrency(pricePerSqm)} / m²` } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const purchaseCostFacts = mode === "kauf"
    ? [
        notaryCosts != null
          ? {
              label: `Notarkosten (${formatPercentLabel(purchaseCostRates.notaryRate)})`,
              value: formatCurrency(notaryCosts),
            }
          : null,
        realEstateTransferTax != null
          ? {
              label: `Grunderwerbsteuer (${formatPercentLabel(purchaseCostRates.realEstateTransferTaxRate)})`,
              value: formatCurrency(realEstateTransferTax),
            }
          : null,
        buyerCommissionCosts != null
          ? {
              label: `Provision für Käufer (${formatPercentLabel(buyerCommissionRate ?? 0)})`,
              value: formatCurrency(buyerCommissionCosts),
            }
          : null,
        landRegistryCosts != null
          ? {
              label: `Grundbucheintrag (${formatPercentLabel(purchaseCostRates.landRegistryRate)})`,
              value: formatCurrency(landRegistryCosts),
            }
          : null,
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    : [];
  const hasPricingSection = priceFacts.length > 0 || purchaseCostFacts.length > 0 || mode === "kauf";
  const contactFormAnchor = "offer-contact-form";
  const energyModalId = `offer-energy-modal-${offer.id}`;
  const galleryLightboxId = `offer-gallery-lightbox-${offer.id}`;
  const [isEnergyModalOpen, setIsEnergyModalOpen] = useState(false);
  const advisorPhoneHref = useMemo(() => toTelHref(advisor.phone), [advisor.phone]);
  const brokerLinkHref =
    advisor.href ??
    (
      breadcrumb.ctx?.bundeslandSlug && breadcrumb.ctx?.kreisSlug
        ? `/immobilienmarkt/${breadcrumb.ctx.bundeslandSlug}/${breadcrumb.ctx.kreisSlug}/immobilienmakler`
        : null
    );
  const narrativeSectionCandidates = [
    description ? { kicker: texts.property_description, title: texts.property_description, copy: description } : null,
    locationText ? { kicker: texts.location_label, title: texts.location_label, copy: locationText } : null,
    featuresText ? { kicker: texts.features_label, title: texts.features_label, copy: featuresText } : null,
    highlights.length > 0 ? { kicker: texts.highlights_label, title: texts.highlights_label, items: highlights } : null,
  ];
  const narrativeSections = narrativeSectionCandidates.reduce<NarrativeSection[]>((accumulator, item) => {
    if (item) accumulator.push(item);
    return accumulator;
  }, []);

  useEffect(() => {
    if (!isEnergyModalOpen && !isGalleryLightboxOpen) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEnergyModalOpen(false);
        setIsGalleryLightboxOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnergyModalOpen, isGalleryLightboxOpen]);

  return (
    <div className="container text-dark">
      <div className="breadcrumb-sticky mb-3">
        <ImmobilienmarktBreadcrumb
          tabs={breadcrumb.tabs}
          activeTabId={breadcrumb.activeTabId}
          basePath={breadcrumb.basePath}
          parentBasePath={breadcrumb.parentBasePath}
          ctx={breadcrumb.ctx}
          names={breadcrumb.names}
          compact
          rootIconSrc="/logo/wohnlagencheck24.svg"
          texts={texts}
        />
      </div>

      <div className="offer-detail-back-link-wrap">
        <Link href={listPath} className="offer-detail-back-link">
          ← {texts.back_to_overview}
        </Link>
      </div>

      <section className="offer-detail-hero">
        <div className="offer-detail-hero-main">
          <span className="offer-detail-chip">{offer.objectType}</span>
          <h1 className="offer-detail-title">{title}</h1>
          {offer.address ? <p className="offer-detail-address">{offer.address}</p> : null}
          <div className="offer-detail-keyfacts">
            <div>
              <span className="offer-detail-label">{priceLabel}</span>
              <div className="offer-detail-price">
                {formatCurrency(mode === "miete" ? offer.rent : offer.price)}
                {priceSuffix ? <span className="offer-detail-suffix">{priceSuffix}</span> : null}
              </div>
            </div>
            <div>
              <span className="offer-detail-label">{texts.living_area}</span>
              <strong>{`${formatArea(offer.areaSqm)} m²`}</strong>
            </div>
            <div>
              <span className="offer-detail-label">{texts.rooms}</span>
              <strong>{formatRooms(offer.rooms)}</strong>
            </div>
          </div>
        </div>
        <aside className="offer-detail-cta">
          <div className="offer-detail-cta-card">
            <h2 className="h6 mb-2">{texts.interested_in_property}</h2>
            <p className="offer-detail-cta-note">Direkter Anbieterkontakt</p>
            {advisorPhoneHref && advisor.phone ? (
              <a className="btn btn-dark w-100 mb-2" href={advisorPhoneHref}>
                {advisor.phone}
              </a>
            ) : null}
            <a className="btn btn-outline-dark w-100" href={`#${contactFormAnchor}`}>
              {isEnglish ? "Go to contact form" : "Zum Kontaktformular"}
            </a>
          </div>
        </aside>
      </section>

      <section className="offer-detail-media offer-detail-section">
        <div className="offer-detail-media-head">
          <h2 className="h5 mb-0">{isEnglish ? "Media" : "Medien"}</h2>
          {mediaTabs.length > 1 ? (
            <div className="offer-detail-media-tabs" role="tablist" aria-label={isEnglish ? "Media categories" : "Medienkategorien"}>
              {mediaTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`offer-detail-media-tab${tab.id === activeMediaTab ? " is-active" : ""}`}
                  onClick={() => setActiveMediaTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="offer-detail-panel">
          {activeMediaTab === "images" ? (
            activePhoto ? (
              <div className="offer-detail-slideshow">
                <div className="offer-detail-slideshow-stage">
                  <button
                    type="button"
                    className="offer-detail-slideshow-nav"
                    onClick={() => setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1))}
                    aria-label="Vorheriges Bild anzeigen"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="offer-detail-gallery-stage-button"
                    onClick={() => setIsGalleryLightboxOpen(true)}
                    aria-haspopup="dialog"
                    aria-controls={galleryLightboxId}
                    aria-label="Bildergalerie in Vollbild öffnen"
                  >
                    <div className="offer-detail-gallery-hero">
                      <Image
                        key={activePhoto.url}
                        src={activePhoto.url}
                        alt={imageAltTexts[resolvedPhotoIndex] ?? activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                        fill
                        priority
                        quality={72}
                        sizes="(max-width: 991px) 100vw, 1100px"
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                  </button>
                  <button
                    type="button"
                    className="offer-detail-slideshow-nav"
                    onClick={() => setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1))}
                    aria-label="Nächstes Bild anzeigen"
                  >
                    ›
                  </button>
                </div>
                <div className="offer-detail-slideshow-meta">
                  <div className="offer-detail-slideshow-caption">
                    {activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                  </div>
                  <div className="offer-detail-slideshow-counter">
                    {resolvedPhotoIndex + 1} / {photoAssets.length}
                  </div>
                </div>
                {photoAssets.length > 1 ? (
                  <div className="offer-detail-gallery-thumbs">
                    {photoAssets.map((asset, index) => (
                      <button
                        key={`${asset.url}-${index}`}
                        type="button"
                        className={`offer-detail-gallery-thumb${index === resolvedPhotoIndex ? " is-active" : ""}`}
                        onClick={() => setActivePhotoIndex(index)}
                        aria-label={`Bild ${index + 1} anzeigen`}
                      >
                        <div className="offer-detail-thumb-frame">
                          <Image
                            src={asset.url}
                            alt={imageAltTexts[index] ?? asset.title ?? `${title} Bild ${index + 1}`}
                            fill
                            loading="lazy"
                            quality={56}
                            sizes="84px"
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="offer-detail-placeholder">{texts.no_images_available}</div>
            )
          ) : null}

          {activeMediaTab === "floorplans" ? (
            activeFloorplan ? (
              <div className="offer-detail-panel-media">
                <div className="offer-detail-panel-media-frame is-floorplan">
                  <Image
                    key={activeFloorplan.url}
                    src={activeFloorplan.url}
                      alt={activeFloorplan.title ?? texts.floor_plan}
                      fill
                      loading="lazy"
                      quality={72}
                      sizes="(max-width: 991px) 100vw, 72vw"
                      style={{ objectFit: "contain" }}
                    />
                </div>
                {floorplanAssets.length > 1 ? (
                  <div className="offer-detail-panel-thumbs">
                    {floorplanAssets.map((asset, index) => (
                      <button
                        key={`${asset.url}-${index}`}
                        type="button"
                        className={`offer-detail-panel-thumb${index === resolvedFloorplanIndex ? " is-active" : ""}`}
                        onClick={() => setActiveFloorplanIndex(index)}
                        aria-label={`Grundriss ${index + 1} anzeigen`}
                      >
                        <div className="offer-detail-thumb-frame">
                          <Image
                            src={asset.url}
                            alt={asset.title ?? `${texts.floor_plan} ${index + 1}`}
                            fill
                            loading="lazy"
                            quality={56}
                            sizes="84px"
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="offer-detail-placeholder">{texts.floor_plan_pending}</div>
            )
          ) : null}

          {activeMediaTab === "maps" ? (
            activeLocationMap ? (
              <div className="offer-detail-panel-media">
                <div className="offer-detail-panel-media-frame">
                  <Image
                    key={activeLocationMap.url}
                    src={activeLocationMap.url}
                      alt={activeLocationMap.title ?? texts.location_map}
                      fill
                      loading="lazy"
                      quality={72}
                      sizes="(max-width: 991px) 100vw, 72vw"
                      style={{ objectFit: "contain" }}
                    />
                </div>
                {locationMapAssets.length > 1 ? (
                  <div className="offer-detail-panel-thumbs">
                    {locationMapAssets.map((asset, index) => (
                      <button
                        key={`${asset.url}-${index}`}
                        type="button"
                        className={`offer-detail-panel-thumb${index === resolvedLocationMapIndex ? " is-active" : ""}`}
                        onClick={() => setActiveLocationMapIndex(index)}
                        aria-label={`Lagegrafik ${index + 1} anzeigen`}
                      >
                        <div className="offer-detail-thumb-frame">
                          <Image
                            src={asset.url}
                            alt={asset.title ?? `${texts.location_map} ${index + 1}`}
                            fill
                            loading="lazy"
                            quality={56}
                            sizes="84px"
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="offer-detail-placeholder">{texts.location_map_pending}</div>
            )
          ) : null}
        </div>
      </section>

      {detailFacts.length > 0 || equipmentFacts.length > 0 ? (
        <section className="offer-detail-grid offer-detail-section">
          {detailFacts.length > 0 ? (
            <div className="offer-detail-panel">
              <h2 className="h5 mb-3">Objektdetails</h2>
              <dl className="offer-detail-facts">
                {detailFacts.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {equipmentFacts.length > 0 ? (
            <div className="offer-detail-panel">
              <h2 className="h5 mb-3">Ausstattung</h2>
              <dl className="offer-detail-facts">
                {equipmentFacts.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>
      ) : null}

      {narrativeSections.length > 0 ? (
        <section className="offer-detail-section">
          <div className="offer-detail-panel offer-detail-panel--spacious">
            {narrativeSections.map((section) => (
              <div key={section.title} className="offer-detail-panel-section">
                <h2 className="h5 mb-3">{section.title}</h2>
                {section.copy ? <p className="offer-detail-panel-copy mb-0">{section.copy}</p> : null}
                {section.items ? (
                  <ul className="offer-detail-list offer-detail-highlight-list mb-0">
                    {section.items.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {features.length > 0 || energyFacts.length > 0 || hasPricingSection ? (
        <section className="offer-detail-grid offer-detail-section">
            <div className="offer-detail-panel offer-detail-panel--spacious">
              <div className="offer-detail-energy-panel__content">
                <h2 className="h5 mb-3">Energie und Bausubstanz</h2>
              {energyFacts.length > 0 ? (
                <dl className="offer-detail-energy">
                  {energyFacts.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="offer-detail-panel-copy mb-0">Energie- und Ausweisdaten werden ergänzt.</p>
              )}
              {features.length > 0 ? (
                <div className="offer-detail-energy-panel__features">
                  <h3 className="h6 mb-3">{texts.features_label}</h3>
                  <ul className="offer-detail-list mb-0">
                    {features.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="offer-detail-energy-panel__cta">
              <h3 className="h6 mb-2">Moechtest du Details zum Energieverbrauch?</h3>
              <p className="offer-detail-cta-note mb-3">
                Wir leiten deine Anfrage direkt an den zustaendigen Ansprechpartner fuer dieses Objekt weiter.
              </p>
              <button
                type="button"
                className="btn btn-outline-dark"
                onClick={() => setIsEnergyModalOpen(true)}
                aria-haspopup="dialog"
                aria-controls={energyModalId}
              >
                Infos zum Energieverbrauch
              </button>
            </div>
          </div>
          <div className="offer-detail-panel offer-detail-panel--spacious">
            <div>
              <h2 className="h5 mb-3">Preisdetails</h2>
              {priceFacts.length > 0 ? (
                <dl className="offer-detail-energy">
                  {priceFacts.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="offer-detail-panel-copy mb-0">Preisinformationen werden ergänzt.</p>
              )}
            </div>
            {mode === "kauf" ? (
              <>
                <div className="offer-detail-panel-section">
                  <h3 className="h6 mb-2">Kaufnebenkosten</h3>
                  {purchaseCostFacts.length > 0 ? (
                    <dl className="offer-detail-energy">
                      {purchaseCostFacts.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                      {totalPurchaseCosts != null ? (
                        <div>
                          <dt>Gesamtkosten</dt>
                          <dd>{formatCurrency(totalPurchaseCosts)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="offer-detail-panel-copy mb-0">Kaufnebenkosten werden ergänzt.</p>
                  )}
                </div>
                <div className="offer-detail-panel-section">
                  <p className="offer-detail-panel-copy mb-2">
                    Der angezeigte Wert ist eine automatisch berechnete Schätzung von Wohnlagencheck24.
                  </p>
                  <p className="offer-detail-panel-copy mb-0">
                    Bei den Angaben handelt es sich um ortsübliche Werte. Individuelle Kosten können abweichen.
                  </p>
                </div>
              </>
            ) : (
              <div className="offer-detail-panel-section">
                <h3 className="h6 mb-2">Kostenhinweis</h3>
                <p className="offer-detail-panel-copy mb-0">
                  Zusätzliche mietvertragliche Kosten und individuelle Konditionen können je nach Angebot gesondert anfallen.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {documentAssets.length > 0 ? (
        <section className="offer-detail-panel offer-detail-section">
          <h2 className="h5 mb-3">Unterlagen</h2>
          <div className="offer-detail-documents">
            {documentAssets.map((asset, index) => {
              const meta = [
                asset.kind === "video" ? "Video" : null,
                asset.is_exposee ? "Exposé" : null,
                asset.on_landing_page ? "Landingpage" : null,
              ].filter((item): item is string => Boolean(item));
              return (
                <a
                  key={`${asset.url}-${index}`}
                  className="offer-detail-document"
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="offer-detail-document-title">
                    {asset.title ?? asset.name ?? `Unterlage ${index + 1}`}
                  </span>
                  <span className="offer-detail-document-meta">
                    {meta.length > 0 ? meta.join(" · ") : "Datei extern öffnen"}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="offer-detail-contact" id={contactFormAnchor}>
        <div className="offer-detail-contact-card">
          <OfferInquiryInlineForm
            locale={formatProfile.locale}
            pagePath={pagePath}
            regionLabel={breadcrumb.names?.regionName ?? title}
            offer={{
              id: offer.id,
              title,
              objectType: offer.objectType,
              address: offer.address,
            }}
            context={breadcrumb.ctx ?? {}}
          />
        </div>
      </section>

      {brokerLinkHref || advisor.name || advisor.phone ? (
        <section className="offer-detail-section">
          <div className="offer-detail-broker-teaser">
            <div>
              <span className="offer-detail-panel-kicker">Makler vor Ort</span>
              <h2 className="h5 mb-2">{advisor.name ?? "Zustaendiger Ansprechpartner in der Region"}</h2>
              <p className="offer-detail-panel-copy mb-0">
                {advisor.phone
                  ? `Telefonisch erreichbar unter ${advisor.phone}.`
                  : "Weitere Informationen zum regionalen Ansprechpartner findest du auf der integrierten Maklerseite."}
              </p>
            </div>
            {brokerLinkHref ? (
              <Link href={brokerLinkHref} className="btn btn-outline-dark">
                Zur Maklerseite
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {isEnergyModalOpen ? (
        <div
          className="offer-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={energyModalId}
          onClick={() => setIsEnergyModalOpen(false)}
        >
          <div className="offer-detail-modal__card" onClick={(event) => event.stopPropagation()}>
            <div className="offer-detail-modal__header">
              <div>
                <span className="offer-detail-panel-kicker">Energie und Bausubstanz</span>
                <h2 className="h5 mb-2" id={energyModalId}>Infos zum Energieverbrauch</h2>
                <p className="offer-detail-panel-copy mb-0">
                  Nutze das Kontaktformular fuer Rueckfragen zu Energieverbrauch, Energieausweis oder Bausubstanz.
                </p>
              </div>
              <button
                type="button"
                className="offer-detail-modal__close"
                onClick={() => setIsEnergyModalOpen(false)}
                aria-label="Dialog schliessen"
              >
                ×
              </button>
            </div>
            <OfferInquiryInlineForm
              locale={formatProfile.locale}
              pagePath={pagePath}
              regionLabel={breadcrumb.names?.regionName ?? title}
              showHeader={false}
              offer={{
                id: `${offer.id}-energy`,
                title,
                objectType: offer.objectType,
                address: offer.address,
              }}
              context={breadcrumb.ctx ?? {}}
            />
          </div>
        </div>
      ) : null}

      {isGalleryLightboxOpen && activePhoto ? (
        <div
          className="offer-detail-modal offer-detail-modal--gallery"
          role="dialog"
          aria-modal="true"
          aria-labelledby={galleryLightboxId}
          onClick={() => setIsGalleryLightboxOpen(false)}
        >
          <div className="offer-detail-modal__card offer-detail-modal__card--gallery" onClick={(event) => event.stopPropagation()}>
            <div className="offer-detail-modal__header offer-detail-modal__header--gallery">
              <div>
                <h2 className="h5 mb-1" id={galleryLightboxId}>Bildergalerie</h2>
                <p className="offer-detail-panel-copy mb-0">
                  {activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                </p>
              </div>
              <button
                type="button"
                className="offer-detail-modal__close"
                onClick={() => setIsGalleryLightboxOpen(false)}
                aria-label="Vollbildgalerie schliessen"
              >
                ×
              </button>
            </div>
            <div className="offer-detail-lightbox">
              <div className="offer-detail-lightbox__stage">
                <button
                  type="button"
                  className="offer-detail-slideshow-nav"
                  onClick={() => setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1))}
                  aria-label="Vorheriges Bild anzeigen"
                >
                  ‹
                </button>
                <div className="offer-detail-lightbox__image">
                  <Image
                    key={`${activePhoto.url}-fullscreen`}
                    src={activePhoto.url}
                    alt={imageAltTexts[resolvedPhotoIndex] ?? activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                    fill
                    quality={84}
                    sizes="100vw"
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <button
                  type="button"
                  className="offer-detail-slideshow-nav"
                  onClick={() => setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1))}
                  aria-label="Nächstes Bild anzeigen"
                >
                  ›
                </button>
              </div>
              {photoAssets.length > 1 ? (
                <div className="offer-detail-gallery-thumbs">
                  {photoAssets.map((asset, index) => (
                    <button
                      key={`${asset.url}-fullscreen-${index}`}
                      type="button"
                      className={`offer-detail-gallery-thumb${index === resolvedPhotoIndex ? " is-active" : ""}`}
                      onClick={() => setActivePhotoIndex(index)}
                      aria-label={`Bild ${index + 1} anzeigen`}
                    >
                      <div className="offer-detail-thumb-frame">
                        <Image
                          src={asset.url}
                          alt={imageAltTexts[index] ?? asset.title ?? `${title} Bild ${index + 1}`}
                          fill
                          loading="lazy"
                          quality={56}
                          sizes="84px"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
