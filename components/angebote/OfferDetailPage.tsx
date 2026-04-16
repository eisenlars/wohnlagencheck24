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

type FactItem = {
  label: string;
  value: string;
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
    logoUrl?: string | null;
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

function formatCountValue(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildZipCityLabel(raw: Record<string, unknown>): string | null {
  const zipCode = asText(raw["zip_code"]);
  const city = asText(raw["city"]);
  const parts = [zipCode, city].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
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
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<"images" | "floorplans" | "maps" | null>(null);
  const [photoSlideDirection, setPhotoSlideDirection] = useState<"prev" | "next" | null>(null);
  const resolvedPhotoIndex = activePhotoIndex < photoAssets.length ? activePhotoIndex : 0;
  const resolvedFloorplanIndex = activeFloorplanIndex < floorplanAssets.length ? activeFloorplanIndex : 0;
  const resolvedLocationMapIndex =
    activeLocationMapIndex < locationMapAssets.length ? activeLocationMapIndex : 0;
  const activePhoto = photoAssets[resolvedPhotoIndex] ?? null;
  const previousPhotoIndex =
    photoAssets.length > 1 ? (resolvedPhotoIndex <= 0 ? photoAssets.length - 1 : resolvedPhotoIndex - 1) : null;
  const nextPhotoIndex =
    photoAssets.length > 1 ? (resolvedPhotoIndex >= photoAssets.length - 1 ? 0 : resolvedPhotoIndex + 1) : null;
  const previousPhoto = previousPhotoIndex != null ? photoAssets[previousPhotoIndex] ?? null : null;
  const nextPhoto = nextPhotoIndex != null ? photoAssets[nextPhotoIndex] ?? null : null;
  const activeFloorplan = floorplanAssets[resolvedFloorplanIndex] ?? null;
  const activeLocationMap = locationMapAssets[resolvedLocationMapIndex] ?? null;
  const lightboxAsset = activeLightboxMedia === "floorplans"
    ? activeFloorplan
    : activeLightboxMedia === "maps"
      ? activeLocationMap
      : activePhoto;
  const lightboxTitle = activeLightboxMedia === "floorplans"
    ? "Grundriss"
    : activeLightboxMedia === "maps"
      ? texts.location_map
      : "Bildergalerie";
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
  const detailsExtra = useMemo(() => asRecord(raw["details_extra"]) ?? {}, [raw]);
  const equipmentSnapshot = useMemo(() => asRecord(raw["equipment"]) ?? {}, [raw]);

  const title = offer.seoH1 || offer.title || texts.object_generic;
  const lightboxCaption = activeLightboxMedia === "floorplans"
    ? (activeFloorplan?.title ?? texts.floor_plan)
    : activeLightboxMedia === "maps"
      ? (activeLocationMap?.title ?? texts.location_map)
      : (activePhoto?.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`);
  const description =
    offer.longDescription ??
    readTextValue(raw["long_description"]) ??
    readTextValue(raw["description"]);
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
  const buyerCommissionDisplay = isCommissionFree
    ? "Provisionsfrei"
    : (objectCommissionText ?? "Auf Anfrage");
  const buyerCommissionCalculationRate =
    isCommissionFree
      ? 0
      : (buyerCommissionRate ?? purchaseCostRates.buyerCommissionDefaultRate);
  const notaryCosts = mode === "kauf" && displayPrice != null ? displayPrice * (purchaseCostRates.notaryRate / 100) : null;
  const landRegistryCosts =
    mode === "kauf" && displayPrice != null ? displayPrice * (purchaseCostRates.landRegistryRate / 100) : null;
  const realEstateTransferTax =
    mode === "kauf" && displayPrice != null ? displayPrice * (purchaseCostRates.realEstateTransferTaxRate / 100) : null;
  const buyerCommissionCosts =
    mode === "kauf" && displayPrice != null
      ? displayPrice * (buyerCommissionCalculationRate / 100)
      : null;
  const totalPurchaseCosts =
    mode === "kauf" && displayPrice != null
      ? displayPrice +
        (notaryCosts ?? 0) +
        (landRegistryCosts ?? 0) +
        (realEstateTransferTax ?? 0) +
        (buyerCommissionCosts ?? 0)
      : null;
  const crmFeatureFacts = [
    offer.areaSqm != null ? { label: "Wohnfläche", value: `${formatArea(offer.areaSqm)} m²` } : null,
    detailsSnapshot?.usable_area_sqm != null ? { label: "Nutzfläche", value: `${formatArea(detailsSnapshot.usable_area_sqm)} m²` } : null,
    offer.rooms != null ? { label: "Anzahl Zimmer", value: formatRooms(offer.rooms) } : null,
    detailsSnapshot?.bedrooms != null ? { label: "Anzahl Schlafzimmer", value: formatRooms(detailsSnapshot.bedrooms) } : null,
    detailsSnapshot?.bathrooms != null ? { label: "Anzahl Badezimmer", value: formatRooms(detailsSnapshot.bathrooms) } : null,
    formatCountValue(asNumber(detailsExtra["separate_wc_count"])) ? { label: "Anzahl sep. WC", value: formatCountValue(asNumber(detailsExtra["separate_wc_count"])) as string } : null,
    formatCountValue(asNumber(detailsExtra["balcony_count"]) ?? asNumber(detailsExtra["balconies_count"])) ? { label: "Anzahl Balkone", value: formatCountValue(asNumber(detailsExtra["balcony_count"]) ?? asNumber(detailsExtra["balconies_count"])) as string } : null,
    formatCountValue(asNumber(detailsExtra["terrace_count"]) ?? asNumber(detailsExtra["terraces_count"])) ? { label: "Anzahl Terrassen", value: formatCountValue(asNumber(detailsExtra["terrace_count"]) ?? asNumber(detailsExtra["terraces_count"])) as string } : null,
  ].filter((item): item is FactItem => Boolean(item));
  const detailFactGroups = crmFeatureFacts.length > 0
    ? [{ title: "Objektmerkmale", items: crmFeatureFacts }]
    : [];
  const equipmentFacts = [
    readTextValue(equipmentSnapshot["internet_access_type"]) ? { label: "Internetanschluss", value: readTextValue(equipmentSnapshot["internet_access_type"]) as string } : null,
    readTextValue(equipmentSnapshot["fuel_type"]) ? { label: "Befeuerung", value: readTextValue(equipmentSnapshot["fuel_type"]) as string } : null,
    readTextValue(equipmentSnapshot["heating_type"]) ? { label: "Heizungsart", value: readTextValue(equipmentSnapshot["heating_type"]) as string } : null,
    formatCountValue(asNumber(equipmentSnapshot["floors_total"]) ?? asNumber(detailsExtra["floors_total"])) ? { label: "Etagenzahl", value: formatCountValue(asNumber(equipmentSnapshot["floors_total"]) ?? asNumber(detailsExtra["floors_total"])) as string } : null,
    (asBoolean(equipmentSnapshot["elevator"]) ?? detailsSnapshot?.elevator) === true ? { label: "Fahrstuhl", value: "Ja" } : null,
    asBoolean(equipmentSnapshot["cable_sat_tv"]) === true ? { label: "Kabel Sat TV", value: "Ja" } : null,
    (readTextValue(equipmentSnapshot["parking"]) ?? detailsSnapshot?.parking) ? { label: "Stellplätze", value: (readTextValue(equipmentSnapshot["parking"]) ?? detailsSnapshot?.parking) as string } : null,
    detailsSnapshot?.balcony === true ? { label: "Balkon", value: "Ja" } : null,
    detailsSnapshot?.terrace === true ? { label: "Terrasse", value: "Ja" } : null,
  ].filter((item): item is FactItem => Boolean(item));
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
              label: `Provision für Käufer (${formatPercentLabel(buyerCommissionCalculationRate)})`,
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
  const zipCityLabel = buildZipCityLabel(raw);
  const isAddressHidden = detailsSnapshot?.address_hidden === true;
  const displayAddress = isAddressHidden ? zipCityLabel : (offer.address ?? zipCityLabel);
  const inquiryLocation = displayAddress ?? zipCityLabel ?? "";
  const brokerLinkHref = advisor.href ?? null;
  const narrativeSectionCandidates = [
    description ? { kicker: texts.property_description, title: texts.property_description, copy: description } : null,
    featuresText ? { kicker: texts.features_label, title: texts.features_label, copy: featuresText } : null,
    highlights.length > 0 ? { kicker: texts.highlights_label, title: texts.highlights_label, items: highlights } : null,
  ];
  const narrativeSections = narrativeSectionCandidates.reduce<NarrativeSection[]>((accumulator, item) => {
    if (item) accumulator.push(item);
    return accumulator;
  }, []);

  function movePhotoPrev() {
    setPhotoSlideDirection("prev");
    setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1));
  }

  function movePhotoNext() {
    setPhotoSlideDirection("next");
    setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1));
  }

  useEffect(() => {
    if (!isEnergyModalOpen && !activeLightboxMedia) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEnergyModalOpen(false);
        setActiveLightboxMedia(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeLightboxMedia, isEnergyModalOpen]);

  useEffect(() => {
    if (!photoSlideDirection) return undefined;
    const timer = window.setTimeout(() => setPhotoSlideDirection(null), 220);
    return () => window.clearTimeout(timer);
  }, [photoSlideDirection]);

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
          {displayAddress ? <p className="offer-detail-address">{displayAddress}</p> : null}
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

        {activeMediaTab === "images" ? (
          activePhoto ? (
            <div className="offer-detail-slideshow">
              <div className={`offer-detail-slideshow-stage${photoSlideDirection ? ` is-moving-${photoSlideDirection}` : ""}`}>
                {previousPhoto ? (
                  <button
                    type="button"
                    className="offer-detail-gallery-card offer-detail-gallery-card--secondary"
                    onClick={movePhotoPrev}
                    aria-label="Vorheriges Bild anzeigen"
                  >
                    <div className="offer-detail-gallery-hero offer-detail-gallery-hero--edge-left">
                      <Image
                        key={`${previousPhoto.url}-previous`}
                        src={previousPhoto.url}
                        alt={imageAltTexts[previousPhotoIndex ?? 0] ?? previousPhoto.title ?? `${title} Bild ${(previousPhotoIndex ?? 0) + 1}`}
                        fill
                        loading="lazy"
                        quality={48}
                        sizes="(max-width: 991px) 100vw, 24vw"
                        style={{ objectFit: "cover" }}
                      />
                      <span className="offer-detail-gallery-card__overlay" aria-hidden="true">‹</span>
                    </div>
                  </button>
                ) : (
                  <div className="offer-detail-gallery-card offer-detail-gallery-card--empty" aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="offer-detail-gallery-card offer-detail-gallery-card--active"
                  onClick={() => setActiveLightboxMedia("images")}
                  aria-haspopup="dialog"
                  aria-controls={galleryLightboxId}
                  aria-label="Bildergalerie in Vollbild öffnen"
                >
                  <div className="offer-detail-gallery-hero offer-detail-gallery-hero--center">
                    <Image
                      key={activePhoto.url}
                      src={activePhoto.url}
                      alt={imageAltTexts[resolvedPhotoIndex] ?? activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                      fill
                      priority
                      quality={68}
                      sizes="(max-width: 991px) 100vw, 52vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                </button>
                {nextPhoto ? (
                  <button
                    type="button"
                    className="offer-detail-gallery-card offer-detail-gallery-card--secondary"
                    onClick={movePhotoNext}
                    aria-label="Nächstes Bild anzeigen"
                  >
                    <div className="offer-detail-gallery-hero offer-detail-gallery-hero--edge-right">
                      <Image
                        key={`${nextPhoto.url}-next`}
                        src={nextPhoto.url}
                        alt={imageAltTexts[nextPhotoIndex ?? 0] ?? nextPhoto.title ?? `${title} Bild ${(nextPhotoIndex ?? 0) + 1}`}
                        fill
                        loading="lazy"
                        quality={48}
                        sizes="(max-width: 991px) 100vw, 24vw"
                        style={{ objectFit: "cover" }}
                      />
                      <span className="offer-detail-gallery-card__overlay" aria-hidden="true">›</span>
                    </div>
                  </button>
                ) : (
                  <div className="offer-detail-gallery-card offer-detail-gallery-card--empty" aria-hidden="true" />
                )}
              </div>
              <div className="offer-detail-slideshow-meta">
                <div aria-hidden="true" />
                <div className="offer-detail-slideshow-caption">
                  {activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                </div>
                <div className="offer-detail-slideshow-counter">
                  {resolvedPhotoIndex + 1} / {photoAssets.length}
                </div>
              </div>
            </div>
          ) : (
            <div className="offer-detail-placeholder">{texts.no_images_available}</div>
          )
        ) : (
          <div className="offer-detail-panel">

            {activeMediaTab === "floorplans" ? (
              activeFloorplan ? (
                <div className="offer-detail-panel-media">
                  <button
                    type="button"
                    className="offer-detail-panel-media-frame offer-detail-panel-media-frame--interactive is-floorplan"
                    onClick={() => setActiveLightboxMedia("floorplans")}
                    aria-haspopup="dialog"
                    aria-controls={galleryLightboxId}
                    aria-label="Grundriss in Vollbild öffnen"
                  >
                    <Image
                      key={activeFloorplan.url}
                      src={activeFloorplan.url}
                        alt={activeFloorplan.title ?? texts.floor_plan}
                        fill
                        loading="lazy"
                        quality={64}
                        sizes="(max-width: 991px) 100vw, 72vw"
                        style={{ objectFit: "contain" }}
                      />
                  </button>
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
                              quality={42}
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
                  <button
                    type="button"
                    className="offer-detail-panel-media-frame offer-detail-panel-media-frame--interactive"
                    onClick={() => setActiveLightboxMedia("maps")}
                    aria-haspopup="dialog"
                    aria-controls={galleryLightboxId}
                    aria-label="Lagekarte in Vollbild öffnen"
                  >
                    <Image
                      key={activeLocationMap.url}
                      src={activeLocationMap.url}
                        alt={activeLocationMap.title ?? texts.location_map}
                        fill
                        loading="lazy"
                        quality={64}
                        sizes="(max-width: 991px) 100vw, 72vw"
                        style={{ objectFit: "contain" }}
                      />
                  </button>
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
                              quality={42}
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
        )}
      </section>

      {detailFactGroups.length > 0 || equipmentFacts.length > 0 ? (
        <section className="offer-detail-grid offer-detail-section">
          {detailFactGroups.length > 0 ? (
            <div className="offer-detail-panel">
              <h2 className="h5 mb-3">Objektmerkmale</h2>
              <div className="offer-detail-group-stack">
                {detailFactGroups.map((group) => (
                  <section key={group.title} className="offer-detail-fact-group">
                    <dl className="offer-detail-facts">
                      {group.items.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
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
                  {[...priceFacts, ...(mode === "kauf" ? [{ label: "Käuferprovision", value: buyerCommissionDisplay }] : [])].map((item) => (
                    item ? (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                    ) : null
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
          <div className="offer-detail-contact-intro">
            <h2 className="h5 mb-2">Sie wollen besichtigen oder haben Fragen zur Immobilie?</h2>
          </div>
          <OfferInquiryInlineForm
            locale={formatProfile.locale}
            pagePath={pagePath}
            showHeader={false}
              regionLabel={breadcrumb.names?.regionName ?? title}
              offer={{
                id: offer.id,
                title,
                objectType: offer.objectType,
                address: inquiryLocation,
              }}
              context={breadcrumb.ctx ?? {}}
            />
        </div>
      </section>

      {brokerLinkHref || advisor.name ? (
        <section className="offer-detail-section">
          <div className="offer-detail-broker-teaser">
            <div className="d-flex align-items-center gap-3">
              <Image
                src={advisor.logoUrl ?? "/logo/wohnlagencheck24.svg"}
                alt={advisor.name ?? "Maklerlogo"}
                className="offer-detail-broker-teaser__logo"
                width={96}
                height={96}
                unoptimized={Boolean(advisor.logoUrl)}
              />
              <div>
                <h2 className="h5 mb-0">{advisor.name ?? "Makler in der Region"}</h2>
              </div>
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
                address: inquiryLocation,
              }}
              context={breadcrumb.ctx ?? {}}
            />
          </div>
        </div>
      ) : null}

      {activeLightboxMedia && lightboxAsset ? (
        <div
          className="offer-detail-modal offer-detail-modal--gallery"
          role="dialog"
          aria-modal="true"
          aria-labelledby={galleryLightboxId}
          onClick={() => setActiveLightboxMedia(null)}
        >
          <div className="offer-detail-modal__card offer-detail-modal__card--gallery" onClick={(event) => event.stopPropagation()}>
            <div className="offer-detail-modal__header offer-detail-modal__header--gallery">
              <div>
                <h2 className="h5 mb-1" id={galleryLightboxId}>{lightboxTitle}</h2>
                <p className="offer-detail-panel-copy mb-0">
                  {lightboxCaption}
                </p>
              </div>
              <button
                type="button"
                className="offer-detail-modal__close"
                onClick={() => setActiveLightboxMedia(null)}
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
                  onClick={() => {
                    if (activeLightboxMedia === "floorplans") {
                      setActiveFloorplanIndex((current) => (current <= 0 ? floorplanAssets.length - 1 : current - 1));
                      return;
                    }
                    if (activeLightboxMedia === "maps") {
                      setActiveLocationMapIndex((current) => (current <= 0 ? locationMapAssets.length - 1 : current - 1));
                      return;
                    }
                    setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1));
                  }}
                  aria-label="Vorheriges Medium anzeigen"
                >
                  ‹
                </button>
                <div className="offer-detail-lightbox__image">
                  <Image
                    key={`${lightboxAsset.url}-${activeLightboxMedia}-fullscreen`}
                    src={lightboxAsset.url}
                    alt={activeLightboxMedia === "images"
                      ? (imageAltTexts[resolvedPhotoIndex] ?? lightboxAsset.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`)
                      : (lightboxAsset.title ?? lightboxTitle)}
                    fill
                    quality={78}
                    sizes="100vw"
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <button
                  type="button"
                  className="offer-detail-slideshow-nav"
                  onClick={() => {
                    if (activeLightboxMedia === "floorplans") {
                      setActiveFloorplanIndex((current) => (current >= floorplanAssets.length - 1 ? 0 : current + 1));
                      return;
                    }
                    if (activeLightboxMedia === "maps") {
                      setActiveLocationMapIndex((current) => (current >= locationMapAssets.length - 1 ? 0 : current + 1));
                      return;
                    }
                    setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1));
                  }}
                  aria-label="Nächstes Medium anzeigen"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
