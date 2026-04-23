'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import workspaceStyles from './styles/workspace.module.css';

type OfferRow = {
  id: string;
  partner_id: string;
  source?: string | null;
  external_id?: string | null;
  offer_type?: string | null;
  object_type?: string | null;
  title?: string | null;
  address?: string | null;
  price?: number | null;
  rent?: number | null;
  area_sqm?: number | null;
  rooms?: number | null;
  image_url?: string | null;
  raw?: Record<string, unknown> | null;
  updated_at?: string | null;
};

type OverrideRow = {
  id?: string;
  partner_id: string;
  source: string;
  external_id: string;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  location_text?: string | null;
  features_text?: string | null;
  answer_summary?: string | null;
  location_summary?: string | null;
  target_audience?: string | null;
  highlights?: string[] | null;
  image_alt_texts?: string[] | null;
};

type OfferAreaTargetRow = {
  offer_id: string;
  area_id: string;
  is_primary?: boolean | null;
  match_source?: string | null;
  match_confidence?: 'high' | 'medium' | 'low' | null;
  score?: number | null;
  matched_zip_code?: string | null;
  matched_city?: string | null;
  matched_region?: string | null;
  areas?: {
    name?: string | null;
  } | null;
};

type LlmIntegrationOption = {
  id: string;
  label: string;
};

type LlmOptionApiRow = {
  id?: string | null;
  provider?: string | null;
  model?: string | null;
  source?: string | null;
  label?: string | null;
};

type VisibilityMode = 'partner_wide' | 'strict_local';

type VisibilityTone = 'info' | 'success' | 'error';

type VisibilityConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type OffersWorkspaceLoadDebug = {
  offers: number;
  overrides: number;
  areaTargets: number;
};

type GalleryAsset = {
  url: string;
  title: string | null;
  position: number | null;
  kind: 'image' | 'floorplan' | 'location_map' | 'document';
};

type EnergySnapshot = {
  certificate_type?: string | null;
  value?: number | null;
  value_kind?: 'bedarf' | 'verbrauch' | null;
  construction_year?: number | null;
  heating_energy_source?: string | null;
  efficiency_class?: string | null;
  certificate_availability?: string | null;
  certificate_start_date?: string | null;
  certificate_end_date?: string | null;
  warm_water_included?: boolean | null;
  demand?: number | null;
  year?: number | null;
};

type DetailsSnapshot = {
  living_area_sqm?: number | null;
  usable_area_sqm?: number | null;
  plot_area_sqm?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor?: number | null;
  construction_year?: number | null;
  condition?: string | null;
  availability?: string | null;
  parking?: string | null;
  balcony?: boolean | null;
  terrace?: boolean | null;
  garden?: boolean | null;
  elevator?: boolean | null;
  address_hidden?: boolean | null;
};

type DocumentAsset = {
  url: string;
  title: string | null;
  name: string | null;
  position: number | null;
  kind: 'document' | 'floorplan' | 'video';
  is_exposee: boolean | null;
  on_landing_page: boolean | null;
};

type Props = {
  visibilityConfig?: VisibilityConfig | null;
  visibilityMode?: VisibilityMode;
  visibilityBusy?: boolean;
  visibilityMessage?: string | null;
  visibilityTone?: VisibilityTone;
  onVisibilityModeChange?: (value: VisibilityMode) => void | Promise<void>;
};

type WorkspaceTab = 'texts' | 'seo' | 'facts' | 'equipment' | 'media' | 'energy';
type OfferListFilter = 'all' | 'kauf' | 'miete';

function formatProviderLabel(provider: string): string {
  const p = String(provider ?? '').toLowerCase();
  if (p === 'openai') return 'OpenAI';
  if (p === 'anthropic') return 'Anthropic';
  if (p === 'google_gemini') return 'Gemini';
  if (p === 'azure_openai') return 'Azure OpenAI';
  if (p === 'mistral') return 'Mistral';
  return provider || 'LLM';
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readTextValue(value: unknown): string | null {
  const direct = asText(value);
  if (direct) return direct;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return asText(record.value) ?? asText(record.label);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseGalleryAssets(value: unknown): GalleryAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
      if (!record) return null;
      const url = asText(record.url);
      if (!url) return null;
      const normalizedKind = String(record.kind ?? '').trim().toLowerCase();
      const kind: GalleryAsset['kind'] = normalizedKind === 'floorplan'
        ? 'floorplan'
        : normalizedKind === 'location_map'
          ? 'location_map'
          : normalizedKind === 'document'
            ? 'document'
            : 'image';
      return {
        url,
        title: asText(record.title),
        position: asNumber(record.position),
        kind,
      } satisfies GalleryAsset;
    })
    .filter((entry): entry is GalleryAsset => Boolean(entry));
}

function parseEnergySnapshot(value: unknown): EnergySnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    certificate_type: asText(record.certificate_type),
    value: asNumber(record.value),
    value_kind: String(record.value_kind ?? '').trim().toLowerCase() === 'bedarf'
      ? 'bedarf'
      : String(record.value_kind ?? '').trim().toLowerCase() === 'verbrauch'
        ? 'verbrauch'
        : null,
    construction_year: asNumber(record.construction_year),
    heating_energy_source: asText(record.heating_energy_source),
    efficiency_class: asText(record.efficiency_class),
    certificate_availability: asText(record.certificate_availability),
    certificate_start_date: asText(record.certificate_start_date),
    certificate_end_date: asText(record.certificate_end_date),
    warm_water_included: parseBoolean(record.warm_water_included),
    demand: asNumber(record.demand),
    year: asNumber(record.year),
  };
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function normalizeOnOfficeFlag(value: unknown): '1' | '0' | null {
  if (typeof value === 'number') {
    if (value === 1) return '1';
    if (value === 0) return '0';
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized === '1') return '1';
    if (normalized === '0') return '0';
  }
  return null;
}

function formatOnOfficeFlagLabel(value: unknown): string {
  const normalized = normalizeOnOfficeFlag(value);
  if (normalized === '1') return 'ja';
  if (normalized === '0') return 'nein';
  const text = asText(value);
  return text ?? '—';
}

function classifyOnOfficeCandidate(raw: Record<string, unknown>): {
  label: string;
  tone: 'info' | 'success' | 'warning';
  detail: string;
} {
  const sold = normalizeOnOfficeFlag(raw.verkauft);
  const reserved = normalizeOnOfficeFlag(raw.reserviert);
  const marketingType = asText(raw.vermarktungsart);

  if (sold === '1') {
    return {
      label: marketingType === 'miete' ? 'Referenz-Kandidat: vermietet' : 'Referenz-Kandidat: verkauft',
      tone: 'warning',
      detail: 'onOffice meldet den Datensatz aktuell als abgeschlossen.',
    };
  }

  if (sold === '0' && reserved === '1') {
    return {
      label: 'Angebot-Kandidat: reserviert',
      tone: 'info',
      detail: 'Der Datensatz ist noch offen, aber bereits als reserviert markiert.',
    };
  }

  if (sold === '0') {
    return {
      label: 'Angebot-Kandidat: offen',
      tone: 'success',
      detail: 'Der Datensatz wirkt laut onOffice-Feldern wie ein aktives Angebot.',
    };
  }

  return {
    label: 'Kandidat prüfen',
    tone: 'info',
    detail: 'Die onOffice-Steuerfelder liefern aktuell keine eindeutige Einordnung.',
  };
}

function getEffectiveOfferType(offer: OfferRow | null | undefined): OfferListFilter | '' {
  const normalized = String(offer?.offer_type ?? '').trim().toLowerCase();
  if (normalized === 'kauf') return 'kauf';
  if (normalized === 'miete') return 'miete';
  return '';
}

function getOfferLocationLabel(offer: OfferRow | null | undefined): string {
  if (!offer) return '—';
  const raw = (offer.raw ?? {}) as Record<string, unknown>;
  const zipCode = readTextValue(raw.zip_code) ?? readTextValue(raw.plz) ?? readTextValue(raw.postal_code);
  const city = readTextValue(raw.city) ?? readTextValue(raw.ort);
  const locationLabel = [zipCode, city].filter(Boolean).join(' ');
  if (locationLabel) return locationLabel;

  const address = asText(offer.address);
  if (!address) return '—';
  const compactAddressMatch = address.match(/(\d{5})\s+(.+)$/);
  if (compactAddressMatch) {
    return `${compactAddressMatch[1]} ${compactAddressMatch[2].trim()}`;
  }
  return address;
}

function getOfferPreviewImageUrl(offer: OfferRow | null | undefined): string | null {
  if (!offer) return null;
  const direct = asText(offer.image_url);
  if (direct) return direct;

  const raw = (offer.raw ?? {}) as Record<string, unknown>;
  const galleryAssets = parseGalleryAssets(raw.gallery_assets);
  return galleryAssets.find((asset) => asset.kind === 'image')?.url ?? null;
}

function parseDetailsSnapshot(value: unknown): DetailsSnapshot | null {
  if (!value || typeof value !== 'object') return null;
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
    balcony: parseBoolean(record.balcony),
    terrace: parseBoolean(record.terrace),
    garden: parseBoolean(record.garden),
    elevator: parseBoolean(record.elevator),
    address_hidden: parseBoolean(record.address_hidden),
  };
}

function parseDocumentAssets(value: unknown): DocumentAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
      if (!record) return null;
      const url = asText(record.url);
      if (!url) return null;
      const normalizedKind = String(record.kind ?? '').trim().toLowerCase();
      const kind: DocumentAsset['kind'] = normalizedKind === 'floorplan'
        ? 'floorplan'
        : normalizedKind === 'video'
          ? 'video'
          : 'document';
      return {
        url,
        title: asText(record.title),
        name: asText(record.name),
        position: asNumber(record.position),
        kind,
        is_exposee: parseBoolean(record.is_exposee),
        on_landing_page: parseBoolean(record.on_landing_page),
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

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE').format(parsed);
}

function formatBooleanLabel(value: boolean | null | undefined): string {
  if (value == null) return '—';
  return value ? 'ja' : 'nein';
}

function formatMatchSourceLabel(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : '—';
}

function formatMatchConfidenceLabel(value: OfferAreaTargetRow['match_confidence']): string {
  if (value === 'high') return 'hoch';
  if (value === 'medium') return 'mittel';
  if (value === 'low') return 'niedrig';
  return '—';
}

export default function OffersManager(props: Props) {
  const {
    visibilityConfig = null,
    visibilityMode = 'partner_wide',
    visibilityBusy = false,
    visibilityMessage = null,
    visibilityTone = 'info',
    onVisibilityModeChange,
  } = props;
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [areaTargets, setAreaTargets] = useState<OfferAreaTargetRow[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<OfferListFilter>('all');
  const [promptOpenMap, setPromptOpenMap] = useState<Record<string, boolean>>({});
  const [customPromptMap, setCustomPromptMap] = useState<Record<string, string>>({});
  const [llmOptions, setLlmOptions] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState('');
  const [llmOptionsLoading, setLlmOptionsLoading] = useState(false);
  const [llmOptionsLoaded, setLlmOptionsLoaded] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeFloorplanIndex, setActiveFloorplanIndex] = useState(0);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('texts');
  const [offerLoadSummary, setOfferLoadSummary] = useState<string | null>(null);
  const [offerLoadDebug, setOfferLoadDebug] = useState<OffersWorkspaceLoadDebug | null>(null);
  const [offerDebugOpen, setOfferDebugOpen] = useState(false);
  const [offerOverviewInfoOpen, setOfferOverviewInfoOpen] = useState(false);
  const llmOptionsRequestRef = useRef<Promise<LlmIntegrationOption[]> | null>(null);

  const ensureLlmOptions = useCallback(async (): Promise<LlmIntegrationOption[]> => {
    if (llmOptionsLoaded) return llmOptions;
    if (llmOptionsRequestRef.current) return llmOptionsRequestRef.current;
    const request = (async () => {
      setLlmOptionsLoading(true);
      try {
        const integrationsRes = await fetch('/api/partner/llm/options');
        if (integrationsRes.ok) {
          const payload = await integrationsRes.json().catch(() => ({}));
          const items: LlmOptionApiRow[] = Array.isArray(payload?.options)
            ? (payload.options as LlmOptionApiRow[])
            : [];
          const llmItems: LlmIntegrationOption[] = items
            .map((entry) => {
              const id = String(entry?.id ?? '').trim();
              if (!id) return null;
              const provider = String(entry?.provider ?? '').trim() || 'LLM';
              const model = String(entry?.model ?? '').trim() || 'Standardmodell';
              const source = String(entry?.source ?? '').trim().toLowerCase() === 'global' ? 'global' : 'partner';
              return {
                id,
                label: String(entry?.label ?? '').trim() || `${formatProviderLabel(provider)} · ${model}${source === 'global' ? ' (Global)' : ' (Partner)'}`,
              };
            })
            .filter((entry): entry is LlmIntegrationOption => Boolean(entry));
          setLlmOptions(llmItems);
          setSelectedLlmIntegrationId((prev) => {
            if (prev && llmItems.some((item) => item.id === prev)) return prev;
            return llmItems[0]?.id ?? '';
          });
          setLlmOptionsLoaded(true);
          return llmItems;
        }
        setLlmOptions([]);
        setSelectedLlmIntegrationId('');
        setLlmOptionsLoaded(true);
        return [];
      } finally {
        setLlmOptionsLoading(false);
      }
    })();
    llmOptionsRequestRef.current = request;
    try {
      return await request;
    } finally {
      llmOptionsRequestRef.current = null;
    }
  }, [llmOptions, llmOptionsLoaded]);

  useEffect(() => {
    void ensureLlmOptions();
  }, [ensureLlmOptions]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setOfferLoadSummary(null);
      setOfferLoadDebug(null);
      const res = await fetch('/api/partner/offers/workspace', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => null) as {
        offers?: OfferRow[];
        overrides?: OverrideRow[];
        areaTargets?: OfferAreaTargetRow[];
      } | null;
      if (!res.ok) {
        setOffers([]);
        setOverrides([]);
        setAreaTargets([]);
        setSelectedOfferId(null);
        setLoading(false);
        return;
      }

      const offersData = Array.isArray(payload?.offers) ? payload.offers : [];
      const overridesData = Array.isArray(payload?.overrides) ? payload.overrides : [];
      const areaTargetsData = Array.isArray(payload?.areaTargets) ? payload.areaTargets : [];
      setOffers(offersData);
      setOverrides(overridesData);
      setAreaTargets(areaTargetsData);
      setSelectedOfferId(offersData[0]?.id ?? null);
      setOfferLoadSummary(`${offersData.length} Angebote geladen`);
      setOfferLoadDebug({
        offers: offersData.length,
        overrides: overridesData.length,
        areaTargets: areaTargetsData.length,
      });
      setLoading(false);
    }
    load();
  }, []);

  const filteredOffers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesType =
        filterType === 'all' ? true : getEffectiveOfferType(offer) === filterType;
      const matchesQuery = term.length === 0
        ? true
        : `${offer.title ?? ''} ${offer.address ?? ''}`.toLowerCase().includes(term);
      return matchesType && matchesQuery;
    });
  }, [offers, query, filterType]);

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;
  const selectedOfferAreaTargets = useMemo(
    () => areaTargets.filter((target) => target.offer_id === selectedOfferId),
    [areaTargets, selectedOfferId],
  );
  const selectedVisibilityAreaId = String(visibilityConfig?.area_id ?? '').trim();
  const selectedVisibilityAreaTarget = useMemo(
    () => selectedOfferAreaTargets.find((target) => target.area_id === selectedVisibilityAreaId) ?? null,
    [selectedOfferAreaTargets, selectedVisibilityAreaId],
  );
  const otherAreaTargets = useMemo(
    () => selectedOfferAreaTargets.filter((target) => target.area_id !== selectedVisibilityAreaId),
    [selectedOfferAreaTargets, selectedVisibilityAreaId],
  );
  const selectedRaw = useMemo(
    () => (selectedOffer?.raw ?? {}) as Record<string, unknown>,
    [selectedOffer],
  );
  const rawDescription = useMemo(
    () => readTextValue(selectedRaw.description) ?? '',
    [selectedRaw],
  );
  const rawLongDescription = useMemo(
    () => readTextValue(selectedRaw.long_description) ?? rawDescription,
    [selectedRaw, rawDescription],
  );
  const rawLocation = useMemo(() => {
    const locationText = readTextValue(selectedRaw.location);
    if (locationText) {
      return locationText;
    }
    return rawDescription;
  }, [selectedRaw, rawDescription]);
  const rawFeatures = useMemo(
    () => readTextValue(selectedRaw.features_note) ?? '',
    [selectedRaw],
  );
  const rawHighlights = useMemo(
    () => (
      Array.isArray(selectedRaw.highlights)
        ? selectedRaw.highlights.filter((item) => typeof item === 'string')
        : []
    ),
    [selectedRaw],
  );
  const rawImageAltTexts = useMemo(
    () => (
      Array.isArray(selectedRaw.image_alt_texts)
        ? selectedRaw.image_alt_texts.filter((item) => typeof item === 'string')
        : []
    ),
    [selectedRaw],
  );
  const galleryAssets = useMemo(
    () => parseGalleryAssets(selectedRaw.gallery_assets),
    [selectedRaw],
  );
  const photoAssets = useMemo(
    () => galleryAssets.filter((asset) => asset.kind === 'image'),
    [galleryAssets],
  );
  const floorplanAssets = useMemo(
    () => galleryAssets.filter((asset) => asset.kind === 'floorplan'),
    [galleryAssets],
  );
  const locationMapAssets = useMemo(
    () => galleryAssets.filter((asset) => asset.kind === 'location_map'),
    [galleryAssets],
  );
  const documentAssets = useMemo(
    () => galleryAssets.filter((asset) => asset.kind === 'document'),
    [galleryAssets],
  );
  const documentFiles = useMemo(
    () => parseDocumentAssets(selectedRaw.documents),
    [selectedRaw],
  );
  const onOfficeSnapshot = useMemo(() => {
    if (selectedOffer?.source !== 'onoffice') return null;
    return {
      exposeeId: readTextValue(selectedRaw.exposee_id),
      marketingType: readTextValue(selectedRaw.vermarktungsart) ?? selectedOffer.offer_type ?? null,
      objectType: readTextValue(selectedRaw.objektart) ?? selectedOffer.object_type ?? null,
      status: readTextValue(selectedRaw.status),
      status2: readTextValue(selectedRaw.status2),
      sold: selectedRaw.verkauft,
      rented: selectedRaw.vermietet,
      reserved: selectedRaw.reserviert,
      publish: selectedRaw.veroeffentlichen,
      sourceUpdatedAt: readTextValue(selectedRaw.geaendert_am),
      candidate: classifyOnOfficeCandidate(selectedRaw),
    };
  }, [selectedOffer, selectedRaw]);
  const combinedDocumentAssets = useMemo(
    () => uniqDocumentsByUrl([
      ...documentFiles,
      ...documentAssets.map((asset) => ({
        url: asset.url,
        title: asset.title,
        name: null,
        position: asset.position,
        kind: 'document' as const,
        is_exposee: null,
        on_landing_page: null,
      })),
    ]),
    [documentAssets, documentFiles],
  );
  const activePhotoAsset = photoAssets[activePhotoIndex] ?? null;
  const activeFloorplanAsset = floorplanAssets[activeFloorplanIndex] ?? null;
  const detailsSnapshot = useMemo(
    () => parseDetailsSnapshot(selectedRaw.details),
    [selectedRaw],
  );
  const energySnapshot = useMemo(
    () => parseEnergySnapshot(selectedRaw.energy),
    [selectedRaw],
  );
  const missingEnergyFields = useMemo(() => {
    const missing: string[] = [];
    if (!energySnapshot?.certificate_type) missing.push('Ausweisart');
    if (energySnapshot?.value == null) missing.push('Kennwert');
    if (!energySnapshot?.value_kind) missing.push('Bedarf/Verbrauch');
    if (!energySnapshot?.heating_energy_source) missing.push('Energieträger');
    if (energySnapshot?.construction_year == null) missing.push('Baujahr');
    if (!energySnapshot?.efficiency_class) missing.push('Effizienzklasse');
    return missing;
  }, [energySnapshot]);

  const normalizedSelectedExternalId = (selectedOffer?.external_id ?? '').trim();
  const normalizedSelectedSource = (selectedOffer?.source ?? '').trim();
  const effectiveSource = normalizedSelectedSource.length > 0 ? normalizedSelectedSource : 'manual';
  const effectiveExternalId =
    normalizedSelectedExternalId.length > 0 ? normalizedSelectedExternalId : selectedOffer?.id ?? '';

  const selectedOverride = selectedOffer && effectiveExternalId
    ? overrides.find(
        (o) => o.external_id === effectiveExternalId && o.source === effectiveSource,
      ) ?? null
    : null;

  const [form, setForm] = useState<OverrideRow | null>(null);

  useEffect(() => {
    if (!selectedOffer) {
      setForm(null);
      return;
    }
    setForm({
      partner_id: selectedOffer.partner_id,
      source: effectiveSource,
      external_id: effectiveExternalId,
      seo_title: selectedOverride?.seo_title ?? selectedOffer.title ?? '',
      seo_description:
        selectedOverride?.seo_description
        ?? selectedOverride?.answer_summary
        ?? selectedOverride?.short_description
        ?? rawDescription
        ?? '',
      seo_h1: selectedOverride?.seo_h1 ?? selectedOffer.title ?? '',
      short_description: selectedOverride?.short_description ?? rawDescription ?? '',
      long_description: selectedOverride?.long_description ?? rawLongDescription ?? '',
      location_text: selectedOverride?.location_text ?? rawLocation ?? '',
      features_text: selectedOverride?.features_text ?? rawFeatures ?? '',
      answer_summary: selectedOverride?.answer_summary ?? selectedOverride?.short_description ?? rawDescription ?? '',
      location_summary: selectedOverride?.location_summary ?? selectedOverride?.location_text ?? rawLocation ?? '',
      target_audience: selectedOverride?.target_audience ?? '',
      highlights: selectedOverride?.highlights ?? rawHighlights ?? [],
      image_alt_texts: selectedOverride?.image_alt_texts ?? rawImageAltTexts ?? [],
    });
  }, [selectedOffer, selectedOverride, effectiveExternalId, effectiveSource, rawDescription, rawLongDescription, rawLocation, rawFeatures, rawHighlights, rawImageAltTexts]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [selectedOfferId]);

  useEffect(() => {
    setActiveFloorplanIndex(0);
  }, [selectedOfferId]);

  useEffect(() => {
    if (activePhotoIndex >= photoAssets.length) {
      setActivePhotoIndex(0);
    }
  }, [activePhotoIndex, photoAssets.length]);

  useEffect(() => {
    if (activeFloorplanIndex >= floorplanAssets.length) {
      setActiveFloorplanIndex(0);
    }
  }, [activeFloorplanIndex, floorplanAssets.length]);

  const updateField = (key: keyof OverrideRow, value: OverrideRow[keyof OverrideRow]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveOverride = async (nextForm?: OverrideRow) => {
    const currentForm = nextForm ?? form;
    if (!currentForm) return;
    setSaving(true);
    const payload = {
      ...currentForm,
      highlights: currentForm.highlights ?? [],
      image_alt_texts: currentForm.image_alt_texts ?? [],
      last_updated: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('partner_property_overrides')
      .upsert(payload, { onConflict: 'partner_id,source,external_id' })
      .select('*')
      .single();

    if (!error && data) {
      setOverrides((prev) => {
        const filtered = prev.filter(
          (o) => !(o.external_id === data.external_id && o.source === data.source),
        );
        return [...filtered, data];
      });
    }
    setSaving(false);
  };

  const handleAiRewrite = async (
    key: keyof OverrideRow,
    currentText: string,
    label: string,
    customPrompt?: string,
  ) => {
    if (!form) return;
    const keyName = String(key);
    const isListField = keyName === 'highlights' || keyName === 'image_alt_texts';
    setRewritingKey(keyName);
    try {
      const availableOptions = llmOptions.length > 0 ? llmOptions : await ensureLlmOptions();
      if (availableOptions.length === 0) return;
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          areaName: selectedOffer?.address || selectedOffer?.title || 'Objekt',
          type: 'general',
          sectionLabel: label,
          customPrompt: customPrompt || undefined,
          llm_integration_id: selectedLlmIntegrationId || availableOptions[0]?.id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('AI rewrite failed:', data?.error ?? res.statusText);
        return;
      }
      if (data.optimizedText) {
        const nextValue = isListField
          ? String(data.optimizedText).split('\n').filter(Boolean)
          : data.optimizedText;
        const updated = { ...form, [key]: nextValue };
        setForm(updated);
        await saveOverride(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRewritingKey(null);
    }
  };

  const resetField = async (key: keyof OverrideRow, fallback: OverrideRow[keyof OverrideRow]) => {
    if (!form) return;
    const updated = { ...form, [key]: fallback };
    setForm(updated);
    await saveOverride(updated);
  };

  const resetOfferTextOverrides = async () => {
    if (!form) return;
    const updated: OverrideRow = {
      ...form,
      seo_h1: selectedOffer?.title ?? '',
      short_description: rawDescription ?? '',
      long_description: rawLongDescription ?? '',
      location_text: rawLocation ?? '',
      features_text: rawFeatures ?? '',
    };
    setForm(updated);
    await saveOverride(updated);
  };

  const getStandardPromptText = (label: string, areaName: string) => {
    const lowerLabel = String(label || '').toLowerCase();
    if (lowerLabel.includes('objekt-titel') || lowerLabel.includes('h1')) {
      return `Formuliere einen prägnanten, sachlichen Objekt-Titel für ${areaName}. Maximal 60 Zeichen, keine Clickbait-Formulierungen, keine erfundenen Fakten, keine Dopplung von Preis oder Adresse.`;
    }
    if (lowerLabel.includes('seo-title')) {
      return `Schreibe einen SEO-Titel für ein Immobilienangebot in ${areaName}. Maximal 60 Zeichen, primäres Objektmerkmal zuerst, sauber lesbar, keine erfundenen Fakten, keine Keyword-Stapelung.`;
    }
    if (lowerLabel.includes('seo-description')) {
      return `Schreibe eine SEO-Description für ein Immobilienangebot in ${areaName}. 140 bis 160 Zeichen, klarer Nutzen, wichtigste Fakten zuerst, keine Füllwörter, keine erfundenen Angaben.`;
    }
    if (lowerLabel.includes('teaser')) {
      return `Formuliere einen kurzen Teaser zum Objekt in ${areaName}. 1 bis 2 Sätze, sachlich, aufmerksamkeitsstark, aber ohne Übertreibung und ohne neue Fakten.`;
    }
    if (lowerLabel.includes('langtext')) {
      return `Optimiere den Langtext für das Exposé in ${areaName}. Saubere Absätze, gute Lesbarkeit, sachlicher Stil, keine neuen Fakten, keine Wiederholung des Titels in jedem Satz.`;
    }
    if (lowerLabel.includes('lage')) {
      if (lowerLabel.includes('in kürze')) {
        return `Fasse die Lage in 2 bis 3 prägnanten Sätzen zusammen. Fokus auf Mikrolage, Erreichbarkeit und Umfeld. Keine Floskeln, keine erfundenen Fakten. Kontext: ${areaName}.`;
      }
      return `Formuliere den Lage-Text klar und informativ. Fokus auf Lagequalität, Erreichbarkeit, Umfeld und Alltagstauglichkeit. Keine erfundenen Fakten, keine Übertreibungen. Kontext: ${areaName}.`;
    }
    if (lowerLabel.includes('kurzantwort')) {
      return `Schreibe eine knappe, sachliche Objekt-Kurzantwort in 2 bis 4 Sätzen für ${areaName}. Die Antwort soll direkt verständlich sein, die wichtigsten Merkmale bündeln und nur belegte Fakten verwenden.`;
    }
    if (lowerLabel.includes('geeignet für')) {
      return `Beschreibe kurz, für welche Zielgruppe das Objekt geeignet ist. Nur plausible, aus den Objektfakten ableitbare Aussagen verwenden. Keine leeren Marketingfloskeln und keine Zielgruppen erfinden, die nicht passen.`;
    }
    if (lowerLabel.includes('ausstatt')) {
      return `Formuliere den Ausstattungstext klar und strukturiert. Fokus auf echte Ausstattungs- und Zustandsmerkmale, keine neuen Features hinzufügen, keine Doppelungen aus dem Langtext.`;
    }
    if (lowerLabel.includes('highlights')) {
      return `Schreibe maximal 6 Highlights, jeweils 1 Zeile. Kurz, konkret, belegbar, keine Wiederholungen, keine vagen Adjektive ohne Substanz.`;
    }
    if (lowerLabel.includes('alt-texte') || lowerLabel.includes('alttexte')) {
      return `Erstelle kurze, sachliche Alt-Texte, jeweils 1 Zeile pro Bild. Beschreibe das Motiv konkret, ohne erfundene Details und ohne SEO-Keyword-Stuffing.`;
    }
    return `Optimiere den Text für bessere Lesbarkeit, fachliche Klarheit und saubere Suchmaschinen-/Antwortsystem-Nutzung. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
  };

  const renderTextField = (
    label: string,
    key: keyof OverrideRow,
    rawValue: string,
    options?: { multiline?: boolean; placeholder?: string },
  ) => {
    if (!form) return null;
    const isRewriting = rewritingKey === String(key);
    const keyName = String(key);
    const value = (form[key] as string | null) ?? '';
    const isCustomized = value.trim() !== (rawValue ?? '').trim();
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, selectedOffer?.address || selectedOffer?.title || 'Objekt');
    return (
      <div className="bg-white border rounded-4 p-3 d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <h4 className="m-0 fs-6 fw-bold text-dark">{label}</h4>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {isCustomized ? (
              <span className="small fw-bold text-success">✓ Individuell angepasst</span>
            ) : null}
            <button
              type="button"
              onClick={() => resetField(key, rawValue)}
              className={`btn btn-sm fw-semibold ${isCustomized ? 'btn-outline-secondary' : 'btn-outline-success'}`}
            >
              Original nutzen
            </button>
          </div>
        </div>
        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-7 d-flex flex-column gap-2">
            {options?.multiline ? (
              <textarea
                value={value}
                onChange={(e) => updateField(key, e.target.value)}
                onBlur={() => saveOverride()}
                className="form-control form-control-sm"
                rows={5}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            ) : (
              <input
                value={value}
                onChange={(e) => updateField(key, e.target.value)}
                onBlur={() => saveOverride()}
                className="form-control form-control-sm"
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            )}
            <div className="d-flex align-items-center flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary fw-semibold"
                onClick={() => handleAiRewrite(key, value, label, customPrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))
                }
                className="btn btn-sm btn-outline-secondary fw-semibold"
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
            </div>
            {showPrompt ? (
              <div className="border rounded-3 p-3 bg-light">
                <div className="small text-secondary text-uppercase fw-bold mb-2">Standard-Prompt</div>
                <div className="small text-secondary lh-base mb-2">{standardPrompt}</div>
                <label className="d-flex flex-column gap-1 small fw-semibold text-dark">
                  Eigener Prompt (optional)
                  <textarea
                    value={customPrompt}
                    onChange={(e) =>
                      setCustomPromptMap((prev) => ({ ...prev, [keyName]: e.target.value }))
                    }
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div className="col-12 col-xl-5">
            <div className="bg-light border rounded-3 p-3 h-100">
              <div className="small text-secondary text-uppercase fw-bold mb-2">CRM‑Original (System)</div>
              <div className="small text-secondary lh-base text-break">{rawValue || 'Keine CRM-Vorlage vorhanden.'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderListField = (
    label: string,
    key: keyof OverrideRow,
    rawValue: string[],
    placeholder: string,
  ) => {
    if (!form) return null;
    const isRewriting = rewritingKey === String(key);
    const keyName = String(key);
    const value = Array.isArray(form[key]) ? (form[key] as string[]).join('\n') : '';
    const rawValueText = Array.isArray(rawValue) ? rawValue.join('\n') : '';
    const isCustomized = value.trim() !== rawValueText.trim();
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, selectedOffer?.address || selectedOffer?.title || 'Objekt');
    return (
      <div className="bg-white border rounded-4 p-3 d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <h4 className="m-0 fs-6 fw-bold text-dark">{label}</h4>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {isCustomized ? (
              <span className="small fw-bold text-success">✓ Individuell angepasst</span>
            ) : null}
            <button
              type="button"
              onClick={() => resetField(key, rawValue)}
              className={`btn btn-sm fw-semibold ${isCustomized ? 'btn-outline-secondary' : 'btn-outline-success'}`}
            >
              Original nutzen
            </button>
          </div>
        </div>
        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-7 d-flex flex-column gap-2">
            <textarea
              value={value}
              onChange={(e) => updateField(key, e.target.value.split('\n').filter(Boolean))}
              onBlur={() => saveOverride()}
              className="form-control form-control-sm"
              rows={5}
              placeholder={placeholder}
            />
            <div className="d-flex align-items-center flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary fw-semibold"
                onClick={() => handleAiRewrite(key, value, label, customPrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))
                }
                className="btn btn-sm btn-outline-secondary fw-semibold"
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
            </div>
            {showPrompt ? (
              <div className="border rounded-3 p-3 bg-light">
                <div className="small text-secondary text-uppercase fw-bold mb-2">Standard-Prompt</div>
                <div className="small text-secondary lh-base mb-2">{standardPrompt}</div>
                <label className="d-flex flex-column gap-1 small fw-semibold text-dark">
                  Eigener Prompt (optional)
                  <textarea
                    value={customPrompt}
                    onChange={(e) =>
                      setCustomPromptMap((prev) => ({ ...prev, [keyName]: e.target.value }))
                    }
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div className="col-12 col-xl-5">
            <div className="bg-light border rounded-3 p-3 h-100">
              <div className="small text-secondary text-uppercase fw-bold mb-2">CRM‑Original (System)</div>
              <div className="small text-secondary lh-base text-break">
                {rawValue.length > 0 ? rawValue.join('\n') : 'Keine CRM-Vorlage vorhanden.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <FullscreenLoader show label="Immobilien werden geladen..." />;

  return (
    <div className="d-flex flex-column gap-2">
      {visibilityConfig ? (
        <section className="mb-2">
          <div className={workspaceStyles.workspaceTopControlCard}>
            <div className={workspaceStyles.workspaceTopControlRow}>
              <div className={workspaceStyles.workspaceTopControlFieldWide}>
                <select
                  value={visibilityMode}
                  onChange={(event) => void onVisibilityModeChange?.(event.target.value as VisibilityMode)}
                  disabled={visibilityBusy}
                  className={`form-select fw-semibold ${workspaceStyles.workspaceTopControlSelect}`}
                >
                  <option value="partner_wide">Regionale Ausspielung für Angebote partnerweit (zeigt alle Angebote des Partners im Gebiet)</option>
                  <option value="strict_local">Regionale Ausspielung für Angebote nur lokal (nutzt nur lokal gematchte Angebote)</option>
                </select>
              </div>
              <div className={workspaceStyles.workspaceTopControlFieldModel}>
                {llmOptions.length > 0 || !llmOptionsLoaded ? (
                  <select
                    value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
                    onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                    className={`form-select fw-semibold ${workspaceStyles.workspaceTopControlSelect}`}
                    aria-label="KI-Modell auswählen"
                    disabled={llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
                  >
                    {!llmOptionsLoaded || llmOptionsLoading ? <option value="">Modelle werden geladen...</option> : null}
                    {llmOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={workspaceStyles.workspaceTopControlHint}>Keine aktive LLM-Integration</span>
                )}
              </div>
            </div>
            {visibilityMessage ? (
              <div
                className={`rounded-pill px-3 py-2 small fw-semibold align-self-start ${
                  visibilityTone === 'success'
                    ? 'bg-success-subtle text-success border border-success-subtle'
                    : visibilityTone === 'error'
                      ? 'bg-danger-subtle text-danger border border-danger-subtle'
                      : 'bg-primary-subtle text-primary border border-primary-subtle'
                }`}
              >
                {visibilityMessage}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="row g-3 g-xl-4 align-items-start">
      <section className="col-12 col-xl-4">
        <div className="bg-white border rounded-4 p-3">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <h3 className="m-0 fs-6 fw-bold text-dark">{offerLoadSummary ?? '0 Angebote geladen'}</h3>
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-circle fw-bold lh-1"
            onClick={() => setOfferDebugOpen(true)}
            disabled={!offerLoadDebug}
            aria-label="Debug-Informationen anzeigen"
          >
            i
          </button>
        </div>
        <input
          placeholder="Suchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="form-control form-control-sm"
        />
        <div className="d-flex flex-wrap gap-2 mt-2 mb-3">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`btn btn-sm rounded-pill flex-fill fw-semibold ${filterType === 'all' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => setFilterType('kauf')}
            className={`btn btn-sm rounded-pill flex-fill fw-semibold ${filterType === 'kauf' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          >
            Kauf
          </button>
          <button
            type="button"
            onClick={() => setFilterType('miete')}
            className={`btn btn-sm rounded-pill flex-fill fw-semibold ${filterType === 'miete' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          >
            Miete
          </button>
        </div>
        <div className="d-flex flex-column gap-2 mt-3 pe-1 overflow-auto">
          {filteredOffers.map((offer) => {
            const normalizedExternalId = (offer.external_id ?? '').trim();
            const normalizedSource = (offer.source ?? '').trim();
            const effectiveExternalIdForOffer =
              normalizedExternalId.length > 0 ? normalizedExternalId : offer.id;
            const effectiveSourceForOffer = normalizedSource.length > 0 ? normalizedSource : 'manual';
            const previewImageUrl = getOfferPreviewImageUrl(offer);
            const locationLabel = getOfferLocationLabel(offer);
            const offerTypeLabel = getEffectiveOfferType(offer) === 'miete'
              ? 'Miete'
              : getEffectiveOfferType(offer) === 'kauf'
                ? 'Kauf'
                : 'Objekt';
            const hasOverride = overrides.some(
              (o) => o.external_id === effectiveExternalIdForOffer && o.source === effectiveSourceForOffer,
            );
            return (
              <button
                key={offer.id}
                onClick={() => setSelectedOfferId(offer.id)}
                className={`btn w-100 text-start p-2 pe-4 rounded-3 border position-relative ${selectedOfferId === offer.id ? 'bg-light' : 'bg-white'}`}
              >
                <div className="row g-2 align-items-center flex-nowrap">
                  <div className="col-3">
                    <div className="ratio ratio-1x1 rounded-2 overflow-hidden border bg-secondary-subtle">
                      {previewImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewImageUrl}
                          alt={offer.title || 'Objektbild'}
                          className="w-100 h-100 object-fit-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="d-flex align-items-center justify-content-center small text-secondary fw-bold text-uppercase">Kein Bild</span>
                      )}
                    </div>
                  </div>
                  <div className="col d-flex flex-column gap-1 overflow-hidden">
                    <span className="fw-semibold text-dark text-truncate lh-sm">{offer.title || 'Objekt'}</span>
                    <span className="small text-secondary fw-bold text-uppercase lh-sm text-truncate">
                      {`${filterType !== 'all' ? '' : `${offerTypeLabel} · `}${locationLabel}`}
                    </span>
                    {hasOverride ? (
                      <span className="small text-secondary fw-semibold text-truncate">
                        Override aktiv
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className={`position-absolute top-0 end-0 mt-2 me-2 badge rounded-pill p-1 ${
                    hasOverride ? 'bg-success' : 'bg-danger'
                  }`}
                />
              </button>
            );
          })}
          {filteredOffers.length === 0 ? (
            <div className="small text-secondary">Keine Angebote gefunden.</div>
          ) : null}
        </div>
        </div>
      </section>

      <section className="col-12 col-xl-8">
        <div className="bg-white border rounded-4 p-3">
        {!form ? (
          <div className="small text-secondary">
            Kein Objekt ausgewählt.
          </div>
        ) : (
          <>
            {selectedOffer && (!normalizedSelectedExternalId || !normalizedSelectedSource) ? (
              <div className="alert alert-warning small mb-3 py-2 px-3">
                Hinweis: Dieses Objekt hat keine externe ID/Quelle. Overrides werden lokal mit
                einer Fallback‑ID gespeichert.
              </div>
            ) : null}

            {selectedOffer ? (
              <div className="bg-light border rounded-4 p-3">
                <div className="d-flex align-items-center justify-content-between gap-3 mb-2 flex-wrap">
                  <div className="small text-uppercase text-secondary fw-bold mb-2">Überblick</div>
                  <div className="d-inline-flex align-items-center flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOfferOverviewInfoOpen(true)}
                      className="btn btn-sm btn-outline-secondary fw-semibold"
                    >
                      Info
                    </button>
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Objekt-ID</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{selectedOffer.id}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Quelle</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {`${selectedOffer.source || '—'} · ${selectedOffer.external_id || selectedOffer.id}`}
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Aktualisiert</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{formatDateLabel(selectedOffer.updated_at)}</div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="d-flex flex-wrap gap-2 my-4">
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('texts')}
                className={`btn btn-sm rounded-pill px-3 ${
                  activeWorkspaceTab === 'texts'
                    ? 'btn-secondary fw-bold'
                    : 'btn-outline-secondary fw-semibold'
                }`}
              >
                Texte
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('seo')}
                className={`btn btn-sm rounded-pill px-3 ${
                  activeWorkspaceTab === 'seo'
                    ? 'btn-secondary fw-bold'
                    : 'btn-outline-secondary fw-semibold'
                }`}
              >
                SEO / GEO
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('facts')}
                className={`btn btn-sm rounded-pill px-3 ${
                  activeWorkspaceTab === 'facts'
                    ? 'btn-secondary fw-bold'
                    : 'btn-outline-secondary fw-semibold'
                }`}
              >
                Objektmerkmale
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('equipment')}
                className={`btn btn-sm rounded-pill px-3 ${
                  activeWorkspaceTab === 'equipment'
                    ? 'btn-secondary fw-bold'
                    : 'btn-outline-secondary fw-semibold'
                }`}
              >
                Ausstattung
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('media')}
                className={`btn btn-sm rounded-pill px-3 ${
                  activeWorkspaceTab === 'media'
                    ? 'btn-secondary fw-bold'
                    : 'btn-outline-secondary fw-semibold'
                }`}
              >
                Medien
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('energy')}
                className={`btn btn-sm rounded-pill px-3 ${
                  activeWorkspaceTab === 'energy'
                    ? 'btn-secondary fw-bold'
                    : 'btn-outline-secondary fw-semibold'
                }`}
              >
                Energieausweis
              </button>
            </div>
            {activeWorkspaceTab === 'media' && selectedOffer ? (
              <div className="bg-light border rounded-4 p-3 d-flex flex-column gap-3">
                <div className="small text-uppercase text-secondary fw-bold">Medien</div>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2 fs-6 fw-bold text-dark">
                    Objektbilder
                    <span className="badge rounded-pill text-primary bg-primary-subtle">{photoAssets.length}</span>
                  </div>
                  <div className="small text-secondary lh-base">Die Fotostrecke zeigt nur echte Objektfotos in ihrer Reihenfolge.</div>
                  {activePhotoAsset ? (
                    <div className="d-flex flex-column gap-3">
                      <div className="row g-2 align-items-stretch">
                        <div className="col-auto">
                        <button
                          type="button"
                          onClick={() => setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1))}
                          className="btn btn-light border h-100 fs-3"
                          aria-label="Vorheriges Objektbild"
                        >
                          ‹
                        </button>
                        </div>
                        <div className="col">
                        <div className="ratio ratio-16x9 rounded-3 overflow-hidden border bg-secondary-subtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            key={activePhotoAsset.url}
                            src={activePhotoAsset.url}
                            alt={activePhotoAsset.title ?? `Objektbild ${activePhotoIndex + 1}`}
                            className="w-100 h-100 object-fit-contain"
                            loading="eager"
                            decoding="async"
                          />
                        </div>
                        </div>
                        <div className="col-auto">
                        <button
                          type="button"
                          onClick={() => setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1))}
                          className="btn btn-light border h-100 fs-3"
                          aria-label="Nächstes Objektbild"
                        >
                          ›
                        </button>
                        </div>
                      </div>
                      <div className="d-flex align-items-center justify-content-between gap-3 small">
                        <div className="fw-bold text-dark">
                          {activePhotoAsset.title ?? `Objektbild ${activePhotoIndex + 1}`}
                        </div>
                        <div className="text-secondary text-nowrap">
                          {activePhotoIndex + 1} / {photoAssets.length}
                        </div>
                      </div>
                      <div className="row row-cols-3 row-cols-sm-4 row-cols-lg-6 g-2">
                        {photoAssets.map((asset, index) => (
                          <div key={`${asset.url}-${index}`} className="col">
                            <button
                              type="button"
                              onClick={() => setActivePhotoIndex(index)}
                              className={`btn w-100 p-0 rounded-3 overflow-hidden border ${index === activePhotoIndex ? 'border-primary border-2' : 'btn-light'}`}
                              aria-label={`Objektbild ${index + 1} anzeigen`}
                            >
                              <span className="ratio ratio-1x1 bg-secondary-subtle">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={asset.url}
                                  alt={asset.title ?? `Objektbild ${index + 1}`}
                                  className="w-100 h-100 object-fit-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="small text-secondary py-2">Keine Objektbilder im CRM-Payload gefunden.</div>
                  )}
                </div>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2 fs-6 fw-bold text-dark">
                    Grundrisse
                    <span className="badge rounded-pill text-primary bg-primary-subtle">{floorplanAssets.length}</span>
                  </div>
                  <div className="small text-secondary lh-base">Grundrisse liegen separat unterhalb der Fotostrecke.</div>
                  {activeFloorplanAsset ? (
                    <div className="d-flex flex-column gap-3">
                      <div className="ratio ratio-16x9 rounded-3 overflow-hidden border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={activeFloorplanAsset.url}
                          src={activeFloorplanAsset.url}
                          alt={activeFloorplanAsset.title ?? `Grundriss ${activeFloorplanIndex + 1}`}
                          className="w-100 h-100 object-fit-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between gap-3 small">
                        <div className="fw-bold text-dark">
                          {activeFloorplanAsset.title ?? `Grundriss ${activeFloorplanIndex + 1}`}
                        </div>
                        <div className="text-secondary text-nowrap">
                          {activeFloorplanIndex + 1} / {floorplanAssets.length}
                        </div>
                      </div>
                      <div className="row row-cols-3 row-cols-sm-4 row-cols-lg-6 g-2">
                        {floorplanAssets.map((asset, index) => (
                          <div key={`${asset.url}-${index}`} className="col">
                            <button
                              type="button"
                              onClick={() => setActiveFloorplanIndex(index)}
                              className={`btn w-100 p-0 rounded-3 overflow-hidden border ${index === activeFloorplanIndex ? 'border-primary border-2' : 'btn-light'}`}
                              aria-label={`Grundriss ${index + 1} anzeigen`}
                            >
                              <span className="ratio ratio-1x1 bg-secondary-subtle">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={asset.url}
                                  alt={asset.title ?? `Grundriss ${index + 1}`}
                                  className="w-100 h-100 object-fit-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="small text-secondary py-2">Keine Grundrisse erkannt.</div>
                  )}
                </div>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2 fs-6 fw-bold text-dark">
                    Lagegrafiken
                    <span className="badge rounded-pill text-primary bg-primary-subtle">{locationMapAssets.length}</span>
                  </div>
                  <div className="small text-secondary lh-base">Standort-, Mikro- und Makrolagen werden separat geführt.</div>
                  {locationMapAssets.length > 0 ? (
                    <div className="d-flex flex-column gap-2">
                      {locationMapAssets.map((asset, index) => (
                        <a
                          key={`${asset.url}-${index}`}
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="border rounded-3 p-3 text-dark text-decoration-none d-flex align-items-center justify-content-between gap-3 bg-white"
                        >
                          <span className="small fw-bold">{asset.title ?? `Lagegrafik ${index + 1}`}</span>
                          <span className="small text-primary fw-semibold text-nowrap">Bild extern öffnen</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="small text-secondary py-2">Keine Lagegrafiken erkannt.</div>
                  )}
                </div>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2 fs-6 fw-bold text-dark">
                    Unterlagen
                    <span className="badge rounded-pill text-primary bg-primary-subtle">{combinedDocumentAssets.length}</span>
                  </div>
                  <div className="small text-secondary lh-base">CRM-Unterlagen, Exposés und weitere Dateien werden hier gesammelt.</div>
                  {combinedDocumentAssets.length > 0 ? (
                    <div className="d-flex flex-column gap-2">
                      {combinedDocumentAssets.map((asset, index) => (
                        <a
                          key={`${asset.url}-${index}`}
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="border rounded-3 p-3 text-dark text-decoration-none d-flex align-items-center justify-content-between gap-3 bg-white"
                        >
                          <span className="small fw-bold">{asset.title ?? asset.name ?? `Unterlage ${index + 1}`}</span>
                          <span className="small text-primary fw-semibold text-nowrap">
                            {asset.kind === 'video'
                              ? 'Video extern öffnen'
                              : asset.is_exposee
                                ? 'Exposé extern öffnen'
                                : 'Datei extern öffnen'}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="small text-secondary py-2">Keine zusätzlichen Unterlagen erkannt.</div>
                  )}
                </div>
              </div>
            ) : null}
            {activeWorkspaceTab === 'energy' && selectedOffer ? (
              <div className="bg-light border rounded-4 p-3 d-flex flex-column gap-3">
                <div className="small text-uppercase text-secondary fw-bold">Energieausweis</div>
                <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Ausweisart</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{energySnapshot?.certificate_type ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Kennwert</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {energySnapshot?.value != null ? `${energySnapshot.value}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Bedarf / Verbrauch</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{energySnapshot?.value_kind ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Baujahr</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {energySnapshot?.construction_year ?? energySnapshot?.year ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Energieträger</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{energySnapshot?.heating_energy_source ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Effizienzklasse</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{energySnapshot?.efficiency_class ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Ausweis vorhanden</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{energySnapshot?.certificate_availability ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Ausgestellt am</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{formatDateLabel(energySnapshot?.certificate_start_date)}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Gültig bis</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{formatDateLabel(energySnapshot?.certificate_end_date)}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Warmwasser enthalten</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{formatBooleanLabel(energySnapshot?.warm_water_included)}</div>
                  </div>
                </div>
                {missingEnergyFields.length > 0 ? (
                  <div className="alert alert-warning small mb-0 py-2 px-3">
                    <div className="fw-bold mb-1">Für eine rechtssichere öffentliche Energieanzeige fehlen aktuell:</div>
                    <div>{missingEnergyFields.join(' · ')}</div>
                  </div>
                ) : (
                  <div className="alert alert-success small fw-bold mb-0 py-2 px-3">Alle zentralen Energieangaben für die Anzeige sind aktuell befüllt.</div>
                )}
              </div>
            ) : null}
            {activeWorkspaceTab === 'texts' ? (
              <div className="d-flex flex-column gap-3">
                <div className="d-flex flex-column gap-3">
                  {renderTextField('Objekt-Titel', 'seo_h1', selectedOffer?.title ?? '', { multiline: false })}
                  {renderTextField('Teaser', 'short_description', rawDescription, { multiline: true })}
                  {renderTextField('Langtext', 'long_description', rawLongDescription, { multiline: true })}
                  {renderTextField('Lage‑Text', 'location_text', rawLocation, { multiline: true })}
                  {renderTextField('Ausstattungs‑Text', 'features_text', rawFeatures, { multiline: true })}
                </div>

                <div className="d-flex flex-column gap-2">
                  <div className="small text-uppercase text-secondary fw-bold">Angebot-Zusammenfassung vor Speichern</div>
                  <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Objekt-Titel</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.seo_h1 || 'Kein Objekt-Titel gepflegt.'}
                    </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Teaser</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.short_description || 'Kein Teaser gepflegt.'}
                    </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Langtext</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.long_description || 'Kein Langtext gepflegt.'}
                    </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Lage</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.location_text || 'Kein Lage-Text gepflegt.'}
                    </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Ausstattung</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.features_text || 'Kein Ausstattungs-Text gepflegt.'}
                    </div>
                    </div>
                  </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <button onClick={() => saveOverride()} disabled={saving} className="btn btn-dark btn-sm fw-semibold px-3 py-2">
                    {saving ? 'Speichern...' : 'Angebotstexte speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetOfferTextOverrides()}
                    disabled={saving}
                    className="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2"
                  >
                    Angebotstexte zurücksetzen
                  </button>
                </div>
              </div>
            ) : null}

            {activeWorkspaceTab === 'facts' ? (
              <div className="bg-light border rounded-4 p-3">
                <div className="small text-uppercase text-secondary fw-bold mb-3">Objektmerkmale</div>
                <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Preis / Miete</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {selectedOffer?.offer_type === 'miete'
                        ? (selectedOffer?.rent ? `${selectedOffer.rent} €` : '—')
                        : (selectedOffer?.price ? `${selectedOffer.price} €` : '—')}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Fläche</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {selectedOffer?.area_sqm ? `${selectedOffer.area_sqm} m²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Nutzfläche</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {detailsSnapshot?.usable_area_sqm != null ? `${detailsSnapshot.usable_area_sqm} m²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Grundstück</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {detailsSnapshot?.plot_area_sqm != null ? `${detailsSnapshot.plot_area_sqm} m²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Zimmer</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{selectedOffer?.rooms ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Schlafzimmer</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{detailsSnapshot?.bedrooms ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Badezimmer</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{detailsSnapshot?.bathrooms ?? '—'}</div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Baujahr</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">
                      {detailsSnapshot?.construction_year
                        ?? energySnapshot?.construction_year
                        ?? energySnapshot?.year
                        ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="small text-secondary text-uppercase fw-bold mb-1">Etage</div>
                    <div className="small text-dark fw-semibold lh-sm text-break">{detailsSnapshot?.floor ?? '—'}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeWorkspaceTab === 'equipment' ? (
              <div className="d-flex flex-column gap-3">
                <div className="bg-light border rounded-4 p-3">
                  <div className="small text-uppercase text-secondary fw-bold mb-3">Strukturierte Ausstattung</div>
                  <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Zustand</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{detailsSnapshot?.condition ?? '—'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Stellplatz</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{detailsSnapshot?.parking ?? '—'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Balkon</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{formatBooleanLabel(detailsSnapshot?.balcony)}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Terrasse</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{formatBooleanLabel(detailsSnapshot?.terrace)}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Garten</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{formatBooleanLabel(detailsSnapshot?.garden)}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Aufzug</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{formatBooleanLabel(detailsSnapshot?.elevator)}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Adresse im Portal</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">
                        {detailsSnapshot?.address_hidden === true
                          ? 'verborgen'
                          : detailsSnapshot?.address_hidden === false
                            ? 'sichtbar'
                            : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={() => saveOverride()} disabled={saving} className="btn btn-dark btn-sm fw-semibold px-3 py-2 align-self-start">
                  {saving ? 'Speichern...' : 'Ausstattung speichern'}
                </button>
              </div>
            ) : null}

            {activeWorkspaceTab === 'seo' ? (
              <div className="d-flex flex-column gap-3">
                <div className="bg-light border rounded-4 p-3">
                  <div className="small text-uppercase text-secondary fw-bold mb-2">Snippet</div>
                  <div className="small text-secondary lh-base">
                    Suchmaschinen-Snippet und Social-Vorschau für das Objekt.
                  </div>
                </div>
                <div className="d-flex flex-column gap-3">
                  {renderTextField('SEO‑Titel', 'seo_title', selectedOffer?.title ?? '', { multiline: false })}
                  {renderTextField('SEO‑Description', 'seo_description', form.answer_summary ?? form.short_description ?? rawDescription, { multiline: true })}
                </div>

                <div className="bg-light border rounded-4 p-3">
                  <div className="small text-uppercase text-secondary fw-bold mb-2">AEO / GEO</div>
                  <div className="small text-secondary lh-base">
                    Kompakte Antwort- und Lagebausteine für Such-, Antwort- und Kartenkontexte.
                  </div>
                </div>
                <div className="d-flex flex-column gap-3">
                  {renderTextField('Kurzantwort', 'answer_summary', form.short_description ?? rawDescription, { multiline: true })}
                  {renderTextField('Lage in Kürze', 'location_summary', form.location_text ?? rawLocation, { multiline: true })}
                  {renderTextField('Geeignet für', 'target_audience', '', { multiline: false, placeholder: 'z. B. Kapitalanleger, Paar, kleine Familie' })}
                </div>

                <div className="bg-light border rounded-4 p-3">
                  <div className="small text-uppercase text-secondary fw-bold mb-2">Highlights & Bildsprache</div>
                  <div className="small text-secondary lh-base">
                    Strukturierte Punkte für Snippets, Karten-Overlays und Bildkontext.
                  </div>
                </div>
                <div className="d-flex flex-column gap-3">
                  {renderListField('Highlights (eine Zeile = ein Punkt)', 'highlights', rawHighlights, 'Ein Punkt pro Zeile')}
                  {renderListField('Alt‑Texte (eine Zeile = ein Bild)', 'image_alt_texts', rawImageAltTexts, 'Ein Bildtitel pro Zeile')}
                </div>

                <div className="bg-light border rounded-4 p-3">
                  <div className="small text-uppercase text-secondary fw-bold mb-2">Zusammenfassung</div>
                  <div className="small text-secondary lh-base">
                    Hier sehen Sie, wie die aktuell gepflegten Snippet-, Antwort- und Social-Texte zusammenwirken.
                  </div>
                </div>

                <div className="bg-light border rounded-3 p-3">
                  <div className="small text-secondary text-uppercase fw-bold mb-2">
                    SEO‑Vorschau
                  </div>
                  <div className="fs-6 fw-bold mt-2">
                    {form.seo_title || form.seo_h1 || selectedOffer?.title || 'SEO‑Titel'}
                  </div>
                  <div className="small text-secondary mt-2">
                    {form.seo_description || form.short_description || form.long_description || 'SEO‑Description'}
                  </div>
                  <div className="small text-secondary mt-2">
                    /immobilienangebote/{form.external_id}_&lt;titel&gt;
                  </div>
                </div>

                <div className="bg-light border rounded-3 p-3">
                  <div className="small text-secondary text-uppercase fw-bold mb-2">
                    OG / Twitter Vorschau
                  </div>
                  <div className="fs-6 fw-bold mt-2">
                    {form.seo_title || form.seo_h1 || selectedOffer?.title || 'Titel für Social'}
                  </div>
                  <div className="small text-secondary mt-2">
                    {form.seo_description || form.short_description || form.long_description || 'Beschreibung für Social'}
                  </div>
                  <div className="small text-secondary mt-2">
                    {selectedOffer?.image_url ? `Bild: ${selectedOffer.image_url}` : 'Bild: (kein Bild gesetzt)'}
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Kurzantwort</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.answer_summary || 'Keine Kurzantwort gepflegt.'}
                    </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Lage in Kürze</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.location_summary || 'Keine Lage-Kurzfassung gepflegt.'}
                    </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="bg-light border rounded-3 p-3 h-100">
                    <div className="small text-secondary text-uppercase fw-bold mb-2">Geeignet für</div>
                    <div className="small text-secondary lh-base text-break">
                      {form.target_audience || 'Keine Zielgruppe gepflegt.'}
                    </div>
                    </div>
                  </div>
                </div>

                <button onClick={() => saveOverride()} disabled={saving} className="btn btn-dark btn-sm fw-semibold px-3 py-2 align-self-start">
                  {saving ? 'Speichern...' : 'SEO / GEO speichern'}
                </button>
              </div>
            ) : null}
          </>
        )}
        </div>
      </section>
      </div>
      {offerOverviewInfoOpen && selectedOffer ? (
        <div
          className="modal d-block bg-dark bg-opacity-50"
          tabIndex={-1}
          onClick={() => setOfferOverviewInfoOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOfferOverviewInfoOpen(false);
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offers-overview-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header">
                <strong id="offers-overview-info-title" className="modal-title fs-6">Angebotsdetails</strong>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setOfferOverviewInfoOpen(false)}
                  aria-label="Info-Modal schließen"
                />
              </div>
              <div className="modal-body d-flex flex-column gap-3">
                {onOfficeSnapshot ? (
                  <div className="d-flex flex-column gap-3">
                    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                      <div className="small text-uppercase text-secondary fw-bold">CRM-Snapshot</div>
                      <span
                        className={`badge rounded-pill border ${
                          onOfficeSnapshot.candidate.tone === 'success'
                            ? 'text-success bg-success-subtle border-success-subtle'
                            : onOfficeSnapshot.candidate.tone === 'warning'
                              ? 'text-warning bg-warning-subtle border-warning-subtle'
                              : 'text-primary bg-primary-subtle border-primary-subtle'
                        }`}
                      >
                        {onOfficeSnapshot.candidate.label}
                      </span>
                    </div>
                    <div className="small text-secondary lh-base">{onOfficeSnapshot.candidate.detail}</div>
                    <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Datensatz-ID</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{selectedOffer.id || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">onOffice-ID</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{selectedOffer.external_id || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Quelle</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{selectedOffer.source || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Exposé / Extern</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">
                          {onOfficeSnapshot.exposeeId || selectedOffer.external_id || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Quelltitel</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{readTextValue(selectedRaw.source_title) || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Vermarktungsart</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{onOfficeSnapshot.marketingType || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Objektart</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{onOfficeSnapshot.objectType || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">status</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{onOfficeSnapshot.status || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">status2</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{onOfficeSnapshot.status2 || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">verkauft</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{formatOnOfficeFlagLabel(onOfficeSnapshot.sold)}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">vermietet</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{formatOnOfficeFlagLabel(onOfficeSnapshot.rented)}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">reserviert</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{formatOnOfficeFlagLabel(onOfficeSnapshot.reserved)}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">veröffentlichen</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{formatOnOfficeFlagLabel(onOfficeSnapshot.publish)}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">Angebot aktualisiert</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{formatDateLabel(selectedOffer.updated_at) || '—'}</div>
                      </div>
                      <div>
                        <div className="small text-secondary text-uppercase fw-bold mb-1">CRM geändert am</div>
                        <div className="small text-dark fw-semibold lh-sm text-break">{formatDateLabel(onOfficeSnapshot.sourceUpdatedAt) || '—'}</div>
                      </div>
                    </div>
                    <div className="small text-secondary lh-base bg-light border rounded-3 p-3">
                      Angebote werden nur beim Angebots- oder Vollsync deaktiviert. Wenn ein Datensatz nach einem reinen Referenz-Sync hier weiter sichtbar ist, ist das meist ein alter Persistenzstand und kein aktueller Provider-Treffer.
                    </div>
                  </div>
                ) : null}
                <div className="d-flex flex-column gap-3">
                  <div className="small text-uppercase text-secondary fw-bold">Ausspielungs-Debug</div>
                  <div className="small text-secondary lh-base">
                    Zeigt den lokalen Match fuer das aktuell gewaehlte Ausspielgebiet und macht die Match-Quelle sichtbar.
                  </div>
                  <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Aktuelles Gebiet</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{visibilityConfig?.areas?.name || '—'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Lokaler Match</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{selectedVisibilityAreaTarget ? 'ja' : 'nein'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Match-Quelle</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{formatMatchSourceLabel(selectedVisibilityAreaTarget?.match_source)}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Confidence</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{formatMatchConfidenceLabel(selectedVisibilityAreaTarget?.match_confidence ?? null)}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Score</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{selectedVisibilityAreaTarget?.score ?? '—'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">PLZ</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{selectedVisibilityAreaTarget?.matched_zip_code || '—'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Ort</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{selectedVisibilityAreaTarget?.matched_city || '—'}</div>
                    </div>
                    <div>
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Region</div>
                      <div className="small text-dark fw-semibold lh-sm text-break">{selectedVisibilityAreaTarget?.matched_region || '—'}</div>
                    </div>
                  </div>
                  {otherAreaTargets.length > 0 ? (
                    <div className="d-flex flex-column gap-2">
                      <div className="small text-secondary text-uppercase fw-bold mb-1">Weitere gematchte Gebiete</div>
                      {otherAreaTargets.slice(0, 5).map((target) => (
                        <div key={`${target.offer_id}-${target.area_id}`} className="small text-secondary lh-base">
                          {(target.areas?.name ?? target.area_id)} · {formatMatchSourceLabel(target.match_source)} · Score {target.score ?? '—'}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {offerDebugOpen && offerLoadDebug ? (
        <div
          className="modal d-block bg-dark bg-opacity-50"
          tabIndex={-1}
          onClick={() => setOfferDebugOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOfferDebugOpen(false);
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offers-workspace-debug-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header">
                <strong id="offers-workspace-debug-title" className="modal-title fs-6">Angebote Debug</strong>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setOfferDebugOpen(false)}
                  aria-label="Debug-Modal schließen"
                />
              </div>
              <div className="modal-body d-flex flex-column gap-2 small text-secondary">
                <div>offers={offerLoadDebug.offers}</div>
                <div>overrides={offerLoadDebug.overrides}</div>
                <div>areaTargets={offerLoadDebug.areaTargets}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
