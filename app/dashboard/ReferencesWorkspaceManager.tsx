'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import FullscreenLoader from '@/components/ui/FullscreenLoader';
import { formatReferenceChallengeCategory, type ReferenceChallengeCategory } from '@/lib/reference-challenges';
import { createClient } from '@/utils/supabase/client';
type RawReferenceRow = {
  id: string;
  partner_id: string;
  provider: string;
  external_id: string;
  title?: string | null;
  normalized_payload?: Record<string, unknown> | null;
  source_payload?: Record<string, unknown> | null;
  source_updated_at?: string | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean | null;
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
  highlights?: string[] | null;
  image_alt_texts?: string[] | null;
  image_url?: string | null;
  status?: string | null;
  last_updated?: string | null;
};

type LlmIntegrationOption = {
  id: string;
  source: 'partner' | 'global';
  provider: string;
  model: string;
  label: string;
  partnerIntegrationId: string | null;
  globalProviderId: string | null;
};

type LlmOptionApiRow = {
  id?: string;
  source?: string | null;
  provider?: string;
  model?: string | null;
  label?: string | null;
  partner_integration_id?: string | null;
  global_provider_id?: string | null;
};

type WorkspaceTab = 'texts' | 'seo' | 'facts' | 'media';

const workspaceTabClassName = (active: boolean) =>
  active
    ? 'btn btn-sm btn-secondary rounded-pill fw-bold px-3'
    : 'btn btn-sm btn-outline-secondary rounded-pill fw-semibold px-3';
const workspaceHeadingClassName = 'small text-uppercase text-secondary fw-bold';
const workspaceMetaLabelClassName = 'small text-secondary text-uppercase fw-bold mb-1';
const workspaceMetaValueClassName = 'small text-dark fw-semibold lh-sm text-break';
const workspacePreviewLabelClassName = 'small text-secondary text-uppercase fw-bold mb-2';
const workspacePreviewBodyClassName = 'small text-secondary lh-base text-break';
type ReferenceListFilter = 'all' | 'kauf' | 'miete';
type VisibilityMode = 'partner_wide' | 'strict_local';
type VisibilityTone = 'info' | 'success' | 'error';

type VisibilityConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type Props = {
  visibilityConfig?: VisibilityConfig | null;
  visibilityMode?: VisibilityMode;
  visibilityBusy?: boolean;
  visibilityMessage?: string | null;
  visibilityTone?: VisibilityTone;
  onVisibilityModeChange?: (value: VisibilityMode) => void | Promise<void>;
};

type ReferencesWorkspaceLoadDebug = {
  references: number;
  overrides: number;
};

type MediaAsset = {
  url: string;
  title: string | null;
  position: number | null;
  kind: 'image' | 'floorplan' | 'document';
};

function formatProviderLabel(provider: string): string {
  const p = String(provider ?? '').toLowerCase();
  if (p === 'openai') return 'OpenAI';
  if (p === 'anthropic') return 'Anthropic';
  if (p === 'google_gemini') return 'Gemini';
  if (p === 'azure_openai') return 'Azure OpenAI';
  if (p === 'mistral') return 'Mistral';
  return provider || 'LLM';
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDateLabel(value: string | null | undefined): string {
  const text = asText(value);
  if (!text) return '—';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatReferenceResult(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'verkauft') return 'Verkauft';
  if (normalized === 'vermietet') return 'Vermietet';
  if (normalized === 'reserviert') return 'Reserviert';
  return value || '—';
}

function getReferencePreviewImageUrl(
  payload: Record<string, unknown>,
  overrideImageUrl?: string | null,
  fallbackPayload?: Record<string, unknown>,
): string | null {
  const overrideUrl = asText(overrideImageUrl);
  if (overrideUrl) return overrideUrl;
  return (
    parseMediaAssets(payload).find((asset) => asset.kind === 'image')?.url ??
    (fallbackPayload ? parseMediaAssets(fallbackPayload).find((asset) => asset.kind === 'image')?.url : null) ??
    null
  );
}

function getReferenceZipCode(payload: Record<string, unknown>): string {
  return getPayloadText(payload, ['zip_code', 'postal_code', 'plz']);
}

function getReferenceCity(payload: Record<string, unknown>): string {
  return getPayloadText(payload, ['city', 'ort']);
}

function getReferenceLocationLabel(payload: Record<string, unknown>): string {
  const zipCode = getReferenceZipCode(payload);
  const city = getReferenceCity(payload);
  const location = [zipCode, city].filter(Boolean).join(' ');
  if (location) return location;
  return getPayloadText(payload, ['location', 'location_text', 'district']) || '—';
}

function getReferenceOfferType(payload: Record<string, unknown>): ReferenceListFilter | '' {
  const normalized = getPayloadText(payload, ['offer_type', 'vermarktungsart']).toLowerCase();
  if (normalized === 'kauf') return 'kauf';
  if (normalized === 'miete') return 'miete';
  return '';
}

function getPayloadText(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

function getPayloadList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMediaAssets(payload: Record<string, unknown>): MediaAsset[] {
  const seen = new Set<string>();
  const assets: MediaAsset[] = [];
  const galleryAssets = payload.gallery_assets;
  if (Array.isArray(galleryAssets)) {
    for (const entry of galleryAssets) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const url = asText(record.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const normalizedKind = asText(record.kind).toLowerCase();
      const kind: MediaAsset['kind'] =
        normalizedKind === 'floorplan'
          ? 'floorplan'
          : normalizedKind === 'document'
            ? 'document'
            : 'image';
      assets.push({
        url,
        title: asText(record.title) || null,
        position: asNumber(record.position),
        kind,
      });
    }
  }
  const gallery = payload.gallery;
  if (Array.isArray(gallery)) {
    for (const entry of gallery) {
      const url = asText(entry);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      assets.push({
        url,
        title: null,
        position: null,
        kind: 'image',
      });
    }
  }
  const imageUrl = getPayloadText(payload, ['image_url']);
  if (imageUrl && !seen.has(imageUrl)) {
    assets.unshift({
      url: imageUrl,
      title: null,
      position: 0,
      kind: 'image',
    });
  }
  return assets.sort((a, b) => {
    const left = a.position ?? Number.MAX_SAFE_INTEGER;
    const right = b.position ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}

function buildDefaultForm(row: RawReferenceRow, override?: OverrideRow | null): OverrideRow {
  return {
    partner_id: row.partner_id,
    source: row.provider,
    external_id: row.external_id,
    seo_title: override?.seo_title ?? '',
    seo_description: override?.seo_description ?? '',
    seo_h1: override?.seo_h1 ?? '',
    short_description: override?.short_description ?? '',
    long_description: override?.long_description ?? '',
    location_text: override?.location_text ?? '',
    features_text: override?.features_text ?? '',
    highlights: override?.highlights ?? [],
    image_alt_texts: override?.image_alt_texts ?? [],
    image_url: override?.image_url ?? null,
    status: override?.status ?? 'draft',
  };
}

function getReferenceSourceTitle(row: RawReferenceRow | null, payload: Record<string, unknown>): string {
  if (!row) return '';
  return getPayloadText(payload, ['source_title']) || asText(row.title);
}

function getReferenceRawText(payload: Record<string, unknown>): string {
  return asText(getPayloadText(payload, ['description', 'reference_text_seed']));
}

function getReferencePromptContext(row: RawReferenceRow | null, payload: Record<string, unknown>): string {
  if (!row) return 'Immobilienreferenz';
  const objectType = getPayloadText(payload, ['object_type']) || 'Immobilie';
  const location = getReferenceLocationLabel(payload);
  if (location && location !== '—') return `${objectType} in ${location}`;
  const sourceTitle = getReferenceSourceTitle(row, payload);
  if (sourceTitle) return sourceTitle;
  return `${objectType}-Referenz`;
}

function isReferenceReadyForPublish(row: RawReferenceRow, override?: OverrideRow | null): boolean {
  const curatedTitle = asText(override?.seo_h1);
  const curatedText = asText(override?.long_description);
  const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
  const rawTitle = getReferenceSourceTitle(row, payload);
  const rawText = getReferenceRawText(payload);
  return (
    curatedTitle.length > 0 &&
    curatedText.length > 0 &&
    curatedTitle !== rawTitle &&
    curatedText !== rawText
  );
}

function buildReferenceAiSourceContext(row: RawReferenceRow | null, payload: Record<string, unknown>): string {
  if (!row) return '';
  const categories = Array.isArray(payload.challenge_categories)
    ? payload.challenge_categories
        .filter((entry): entry is ReferenceChallengeCategory => typeof entry === 'string')
        .reduce<ReferenceChallengeCategory[]>((acc, entry) => {
          const normalized = entry.trim();
          if (normalized) acc.push(normalized as ReferenceChallengeCategory);
          return acc;
        }, [])
    : [];
  const facts = [
    ['Quelltitel', getReferenceSourceTitle(row, payload)],
    ['Vermarktungsart', getPayloadText(payload, ['offer_type', 'vermarktungsart'])],
    ['Objektart', getPayloadText(payload, ['object_type'])],
    ['Transaktion', getPayloadText(payload, ['transaction_result'])],
    ['Ort', getReferenceLocationLabel(payload)],
    ['Wohnfläche', asNumber(payload.area_sqm) != null ? `${asNumber(payload.area_sqm)} m²` : ''],
    ['Zimmer', asNumber(payload.rooms) != null ? String(asNumber(payload.rooms)) : ''],
    ['Referenztext-Quelle', getPayloadText(payload, ['description', 'reference_text_seed'])],
    ['Herausforderungs-Quelle', getPayloadText(payload, ['challenge_note_source'])],
    ['Abgeleitete Kategorien', categories.map((entry) => formatReferenceChallengeCategory(entry)).join(', ')],
  ]
    .filter(([, value]) => String(value).trim().length > 0)
    .map(([label, value]) => `${label}: ${value}`);
  return facts.join('\n');
}

export default function ReferencesWorkspaceManager(props: Props) {
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

  const [status, setStatus] = useState('Lade Referenzen...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [rows, setRows] = useState<RawReferenceRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<OverrideRow | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<ReferenceListFilter>('all');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('texts');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [pendingReferenceImageUrl, setPendingReferenceImageUrl] = useState<string | null>(null);
  const [referenceImageSelectionStatus, setReferenceImageSelectionStatus] = useState<string | null>(null);
  const [promptOpenMap, setPromptOpenMap] = useState<Record<string, boolean>>({});
  const [customPromptMap, setCustomPromptMap] = useState<Record<string, string>>({});
  const [llmOptions, setLlmOptions] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState('');
  const [llmOptionsLoading, setLlmOptionsLoading] = useState(false);
  const [llmOptionsLoaded, setLlmOptionsLoaded] = useState(false);
  const [referenceLoadSummary, setReferenceLoadSummary] = useState<string | null>(null);
  const [referenceLoadDebug, setReferenceLoadDebug] = useState<ReferencesWorkspaceLoadDebug | null>(null);
  const [referenceDebugOpen, setReferenceDebugOpen] = useState(false);
  const [referenceOverviewInfoOpen, setReferenceOverviewInfoOpen] = useState(false);
  const llmOptionsRequestRef = useRef<Promise<LlmIntegrationOption[]> | null>(null);

  const ensureLlmOptions = useCallback(async (): Promise<LlmIntegrationOption[]> => {
    if (llmOptionsLoaded) return llmOptions;
    if (llmOptionsRequestRef.current) return llmOptionsRequestRef.current;
    const request = (async () => {
      setLlmOptionsLoading(true);
      try {
        const integrationsRes = await fetch('/api/partner/llm/options');
        if (!integrationsRes.ok) {
          setLlmOptions([]);
          setSelectedLlmIntegrationId('');
          setLlmOptionsLoaded(true);
          return [];
        }
        const payload = await integrationsRes.json().catch(() => ({}));
        const llmModeDefault = String(payload?.llm_mode_default ?? '').trim().toLowerCase();
        const items: LlmOptionApiRow[] = Array.isArray(payload?.options) ? (payload.options as LlmOptionApiRow[]) : [];
        const nextOptions = items
          .map((entry) => {
            const id = String(entry?.id ?? '').trim();
            if (!id) return null;
            const provider = String(entry?.provider ?? '').trim() || 'LLM';
            const model = String(entry?.model ?? '').trim() || 'Standardmodell';
            const source = String(entry?.source ?? '').trim().toLowerCase() === 'global' ? 'global' : 'partner';
            return {
              id,
              source,
              provider,
              model,
              label: String(entry?.label ?? '').trim() || `${formatProviderLabel(provider)} · ${model}${source === 'global' ? ' (Global)' : ' (Partner)'}`,
              partnerIntegrationId: String(entry?.partner_integration_id ?? '').trim() || null,
              globalProviderId: String(entry?.global_provider_id ?? '').trim() || null,
            } satisfies LlmIntegrationOption;
          })
          .filter((entry): entry is LlmIntegrationOption => Boolean(entry));
        setLlmOptions(nextOptions);
        setSelectedLlmIntegrationId((prev) => {
          if (prev && nextOptions.some((item) => item.id === prev)) return prev;
          if (llmModeDefault === 'central_managed') return nextOptions.find((item) => item.source === 'global')?.id ?? nextOptions[0]?.id ?? '';
          if (llmModeDefault === 'partner_managed') return nextOptions.find((item) => item.source === 'partner')?.id ?? nextOptions[0]?.id ?? '';
          return nextOptions[0]?.id ?? '';
        });
        setLlmOptionsLoaded(true);
        return nextOptions;
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
      setStatus('Lade Referenzen...');
      setReferenceLoadSummary(null);
      setReferenceLoadDebug(null);
      const res = await fetch('/api/partner/crm-assets/workspace?kind=references', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => null) as {
        rows?: RawReferenceRow[];
        overrides?: OverrideRow[];
        error?: string;
      } | null;
      if (!res.ok) {
        setStatus(payload?.error ? `Fehler beim Laden: ${payload.error}` : 'Fehler beim Laden.');
        setLoading(false);
        return;
      }
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const nextOverrides = Array.isArray(payload?.overrides) ? payload.overrides : [];
      setRows(nextRows);
      setOverrides(nextOverrides);
      setSelectedId(nextRows[0]?.id ?? null);
      setStatus('Referenzen geladen.');
      setReferenceLoadSummary(`${nextRows.length} Referenzen geladen`);
      setReferenceLoadDebug({
        references: nextRows.length,
        overrides: nextOverrides.length,
      });
      setLoading(false);
    }
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
      const matchesType = filterType === 'all' ? true : getReferenceOfferType(payload) === filterType;
      const haystack = [
        row.title,
        row.external_id,
        row.provider,
        getPayloadText(payload, ['description', 'reference_text_seed', 'location', 'city', 'district', 'object_type', 'transaction_result', 'offer_type', 'plz', 'zip_code', 'postal_code']),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = term.length === 0 ? true : haystack.includes(term);
      return matchesType && matchesQuery;
    });
  }, [rows, query, filterType]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const selectedPayload = useMemo(
    () => ((selectedRow?.normalized_payload ?? {}) as Record<string, unknown>),
    [selectedRow],
  );

  const selectedOverride = useMemo(() => {
    if (!selectedRow) return null;
    return overrides.find(
      (entry) =>
        entry.partner_id === selectedRow.partner_id &&
        entry.source === selectedRow.provider &&
        entry.external_id === selectedRow.external_id,
    ) ?? null;
  }, [overrides, selectedRow]);

  useEffect(() => {
    if (!selectedRow) {
      setForm(null);
      return;
    }
    setForm(buildDefaultForm(selectedRow, selectedOverride));
    setActiveImageIndex(0);
  }, [selectedOverride, selectedRow]);

  useEffect(() => {
    setPendingReferenceImageUrl(asText(form?.image_url) || null);
    setReferenceImageSelectionStatus(null);
  }, [form?.image_url, selectedId]);

  const mediaAssets = useMemo(() => parseMediaAssets(selectedPayload), [selectedPayload]);
  const imageAssets = useMemo(() => mediaAssets.filter((asset) => asset.kind === 'image'), [mediaAssets]);
  const documentAssets = useMemo(() => mediaAssets.filter((asset) => asset.kind === 'document'), [mediaAssets]);
  const activeImage = imageAssets[activeImageIndex] ?? imageAssets[0] ?? null;
  const selectedReferenceImageOverrideUrl = asText(form?.image_url);
  const pendingReferenceImage =
    pendingReferenceImageUrl
      ? imageAssets.find((asset) => asset.url === pendingReferenceImageUrl) ?? { url: pendingReferenceImageUrl, title: 'Ausgewähltes Referenzbild' }
      : null;
  const selectedReferenceImage =
    selectedReferenceImageOverrideUrl
      ? imageAssets.find((asset) => asset.url === selectedReferenceImageOverrideUrl) ?? { url: selectedReferenceImageOverrideUrl, title: 'Ausgewähltes Referenzbild' }
      : null;
  const effectiveReferenceImage = pendingReferenceImage ?? selectedReferenceImage ?? activeImage;
  const hasPendingReferenceImageSelection = (pendingReferenceImageUrl ?? '') !== selectedReferenceImageOverrideUrl;

  async function saveOverride(nextForm?: OverrideRow, options?: { requireContent?: boolean }) {
    const payload = nextForm ?? form;
    if (!payload) return;
    const nextTitle = asText(payload.seo_h1);
    const nextDescription = asText(payload.long_description);
    const sourceTitle = getReferenceSourceTitle(selectedRow, selectedPayload);
    const sourceDescription = getReferenceRawText(selectedPayload);
    const requireContent = options?.requireContent !== false;
    if (
      requireContent &&
      (
        nextTitle.length === 0 ||
        nextDescription.length === 0 ||
        nextTitle === sourceTitle ||
        nextDescription === sourceDescription
      )
    ) {
      setStatus('Speichern nicht möglich: Referenz-Titel und Referenztext müssen als eigener Referenztext gepflegt sein.');
      return;
    }
    setSaving(true);
    setStatus('Speichere Referenz-Overrides...');
    const upsertPayload = {
      ...payload,
      highlights: payload.highlights ?? [],
      image_alt_texts: payload.image_alt_texts ?? [],
      last_updated: new Date().toISOString(),
    } as Record<string, unknown>;
    const normalizedImageUrl = asText(payload.image_url);
    if (normalizedImageUrl) {
      upsertPayload.image_url = normalizedImageUrl;
    } else if (selectedOverride?.image_url) {
      upsertPayload.image_url = null;
    } else {
      delete upsertPayload.image_url;
    }

    async function executeUpsert(candidatePayload: Record<string, unknown>) {
      return supabase
        .from('partner_reference_overrides')
        .upsert(candidatePayload, { onConflict: 'partner_id,source,external_id' })
        .select('*')
        .single();
    }

    let { data, error } = await executeUpsert(upsertPayload);
    if (error && String(error.message || '').includes('image_url')) {
      delete upsertPayload.image_url;
      ({ data, error } = await executeUpsert(upsertPayload));
      if (!error) {
        setReferenceImageSelectionStatus('Die alternative Referenzbildauswahl benötigt noch den SQL-Rollout für image_url.');
      }
    }
    if (error) {
      setStatus(`Speichern fehlgeschlagen (partner_reference_overrides): ${error.message}`);
      setReferenceImageSelectionStatus(`Bildauswahl konnte nicht gespeichert werden: ${error.message}`);
      setSaving(false);
      return;
    }
    setOverrides((prev) => {
      const filtered = prev.filter(
        (entry) =>
          !(
            entry.partner_id === payload.partner_id &&
            entry.source === payload.source &&
            entry.external_id === payload.external_id
          ),
      );
      return [...filtered, data as OverrideRow];
    });
    const rebuildRes = await fetch('/api/partner/public-projections/references/rebuild', {
      method: 'POST',
    });
    if (!rebuildRes.ok) {
      setStatus('Referenz-Overrides gespeichert, aber die öffentliche Projektion konnte nicht aktualisiert werden.');
      setSaving(false);
      return;
    }
    setStatus('Referenz-Overrides gespeichert.');
    setSaving(false);
  }

  async function resetReferenceTextOverrides() {
    if (!selectedRow || !form) return;
    setSaving(true);
    setStatus('Setze Referenztexte zurück...');
    const nextForm: OverrideRow = {
      ...form,
      seo_h1: '',
      long_description: '',
      features_text: '',
      last_updated: new Date().toISOString(),
    };
    const hasOtherContent =
      asText(nextForm.seo_title).length > 0 ||
      asText(nextForm.seo_description).length > 0 ||
      asText(nextForm.short_description).length > 0 ||
      asText(nextForm.location_text).length > 0 ||
      asText(nextForm.image_url).length > 0 ||
      (Array.isArray(nextForm.highlights) && nextForm.highlights.length > 0) ||
      (Array.isArray(nextForm.image_alt_texts) && nextForm.image_alt_texts.length > 0);
    if (!hasOtherContent && selectedOverride?.id) {
      const { error } = await supabase
        .from('partner_reference_overrides')
        .delete()
        .eq('partner_id', selectedRow.partner_id)
        .eq('source', selectedRow.provider)
        .eq('external_id', selectedRow.external_id);
      if (error) {
        setStatus(`Zurücksetzen fehlgeschlagen: ${error.message}`);
        setSaving(false);
        return;
      }
      setOverrides((prev) =>
        prev.filter(
          (entry) =>
            !(
              entry.partner_id === selectedRow.partner_id &&
              entry.source === selectedRow.provider &&
              entry.external_id === selectedRow.external_id
            ),
        ),
      );
      setForm(buildDefaultForm(selectedRow, null));
      setStatus('Referenztexte zurückgesetzt.');
      setSaving(false);
      return;
    }
    const { data, error } = await supabase
      .from('partner_reference_overrides')
      .upsert(nextForm, { onConflict: 'partner_id,source,external_id' })
      .select('*')
      .single();
    if (error) {
      setStatus(`Zurücksetzen fehlgeschlagen: ${error.message}`);
      setSaving(false);
      return;
    }
    setOverrides((prev) => {
      const filtered = prev.filter(
        (entry) =>
          !(
            entry.partner_id === nextForm.partner_id &&
            entry.source === nextForm.source &&
            entry.external_id === nextForm.external_id
          ),
      );
      return [...filtered, data as OverrideRow];
    });
    setForm(nextForm);
    setStatus('Referenztexte zurückgesetzt.');
    setSaving(false);
  }

  async function applyReferenceImageSelection(imageUrl: string | null) {
    if (!form) return;
    setReferenceImageSelectionStatus(null);
    const next: OverrideRow = { ...form, image_url: imageUrl };
    setForm(next);
    await saveOverride(next, { requireContent: false });
  }

  async function runAiRewrite(key: keyof OverrideRow, label: string, customPrompt?: string) {
    if (!form || !selectedRow) return;
    const currentText = String(form[key] ?? '');
    const sourceContext = buildReferenceAiSourceContext(selectedRow, selectedPayload);
    const generateFromSource = key === 'seo_h1' || key === 'long_description' || key === 'features_text';
    const inputText = generateFromSource ? sourceContext : currentText.trim() || sourceContext;
    if (!inputText.trim()) return;
    setRewritingKey(String(key));
    setStatus('KI-Optimierung läuft...');
    try {
      const availableOptions = llmOptions.length > 0 ? llmOptions : await ensureLlmOptions();
      if (availableOptions.length === 0) {
        setStatus('Keine aktive LLM-Integration verfügbar.');
        return;
      }
      const selectedOption = availableOptions.find((entry) => entry.id === selectedLlmIntegrationId) ?? availableOptions[0] ?? null;
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          areaName: getReferencePromptContext(selectedRow, selectedPayload),
          type: 'general',
          sectionLabel: label,
          customPrompt: customPrompt || undefined,
          llm_integration_id: selectedOption?.partnerIntegrationId || undefined,
          llm_global_provider_id: selectedOption?.globalProviderId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          setStatus('KI-Optimierung nicht erlaubt: bitte ein freigegebenes KI-Modell auswählen.');
        } else {
          setStatus(String(data?.error ?? 'KI-Optimierung fehlgeschlagen.'));
        }
        return;
      }
      const optimized = String(data?.optimizedText ?? '');
      if (!optimized.trim()) {
        setStatus('Keine KI-Antwort erhalten.');
        return;
      }
      const next = { ...form, [key]: optimized };
      setForm(next);
      await saveOverride(next);
      setStatus('KI-Optimierung gespeichert.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'KI-Optimierung fehlgeschlagen.');
    } finally {
      setRewritingKey(null);
    }
  }

  function updateField(key: keyof OverrideRow, value: string | string[]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function getStandardPromptText(label: string, contextLabel: string) {
    const lowerLabel = String(label || '').toLowerCase();
    if (lowerLabel.includes('referenz-titel') || lowerLabel.includes('h1')) {
      return `Formuliere einen hochwertigen Referenz-Titel für eine erfolgreich vermittelte Immobilie. Nutze dafür nur den folgenden Objektkontext: ${contextLabel}. Der Titel soll wie eine Erfolgsbotschaft wirken, nicht wie eine Objektbeschreibung, nicht wie ein Exposé und nicht wie eine Datenliste. Stelle die erfolgreiche Vermittlung in den Vordergrund und ordne Objektart und Ort natürlich ein. Nutze nur belegbare Fakten aus den importierten Referenzdaten. Keine Doppelpunkte, keine Schlagwortlisten, keine Übertreibungen, keine Clickbait-Formulierungen. Maximal 70 Zeichen. Gib ausschließlich den finalen Titel zurück. Keine Markdown-Formatierung, keine Anführungszeichen, keine Zusatzsätze.`;
    }
    if (lowerLabel.includes('seo-titel')) {
      return `Schreibe einen SEO-Titel für eine Immobilienreferenz. Nutze dafür nur den folgenden Objektkontext: ${contextLabel}. Maximal 60 Zeichen, klar lesbar, ohne Keyword-Stapelung und ohne erfundene Fakten. Gib ausschließlich den finalen SEO-Titel zurück. Keine Markdown-Formatierung und keine Zusatzsätze.`;
    }
    if (lowerLabel.includes('seo-description')) {
      return `Schreibe eine SEO-Description für eine Immobilienreferenz. Nutze dafür nur den folgenden Objektkontext: ${contextLabel}. 140 bis 160 Zeichen, sachlich, kompakt und ohne neue Fakten. Gib ausschließlich die finale SEO-Description zurück. Keine Markdown-Formatierung und keine Zusatzsätze.`;
    }
    if (lowerLabel.includes('referenztext')) {
      return `Schreibe einen hochwertigen Referenztext für eine erfolgreich vermittelte Immobilie. Nutze dafür nur den folgenden Objektkontext: ${contextLabel}. Der Text soll wie eine professionelle Erfolgsreferenz eines Maklers wirken, nicht wie eine Objektbeschreibung, kein Exposé und keine Datenliste.

Wichtige Regeln:
- 2 bis 4 flüssige Sätze
- Fokus auf erfolgreiche Vermittlung und Vermarktungsergebnis
- Objektart, Ort und bei Bedarf 1 bis 2 sinnvolle Merkmale natürlich einordnen
- keine Aufzählungen
- keine Überschriften
- keine Bulletpoints
- keine Formulierungen wie „Objektdaten auf einen Blick“
- keine Wiederholung des vollständigen Titels
- keine spekulativen Aussagen
- keine erfundenen Fakten
- Ton: sachlich, hochwertig, vertrauensbildend

Der Text soll Eigentümern zeigen, dass diese Immobilie erfolgreich vermarktet wurde. Vermeide ausdrücklich Exposé-Sprache, reine Merkmalsaufzählungen und werbliche Übertreibungen. Gib ausschließlich den finalen Referenztext zurück. Keine Markdown-Formatierung, keine Zwischenüberschrift, keine Listen und keine Zusatzhinweise.`;
    }
    if (lowerLabel.includes('herausforderung')) {
      return `Prüfe die importierten Hinweise auf belastbare Herausforderungen im Verkaufs- oder Vermietungsprozess. Wenn keine klaren Hinweise vorliegen, gib einen leeren String zurück. Wenn Hinweise vorliegen, formuliere maximal 1 bis 2 kurze, neutrale Sätze. Nenne sensible private Auslöser wie Scheidung, Trennung, Erbe oder Nachlass nicht direkt, sondern abstrahiere sie sachlich. Gib ausschließlich den finalen Text oder einen leeren String zurück. Keine Markdown-Formatierung und keine Zusatzhinweise.`;
    }
    if (lowerLabel.includes('highlights')) {
      return `Schreibe maximal 6 Highlights, jeweils 1 Zeile. Kurz, konkret, belegbar, keine Wiederholungen und keine vagen Werbeformulierungen.`;
    }
    if (lowerLabel.includes('alt-texte') || lowerLabel.includes('alttexte')) {
      return `Erstelle kurze, sachliche Alt-Texte, jeweils 1 Zeile pro Bild. Beschreibe das Motiv konkret, ohne erfundene Details und ohne Keyword-Stuffing.`;
    }
    return `Optimiere den Text für bessere Lesbarkeit, fachliche Klarheit und saubere Suchmaschinen-/Antwortsystem-Nutzung. Keine neuen Fakten hinzufügen. Kontext: ${contextLabel}.`;
  }

  const renderTextField = (
    label: string,
    key: keyof OverrideRow,
    rawValue: string,
    options?: { multiline?: boolean; placeholder?: string; showPreview?: boolean },
  ) => {
    if (!form) return null;
    const keyName = String(key);
    const value = String(form[key] ?? '');
    const isRewriting = rewritingKey === keyName;
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, getReferencePromptContext(selectedRow, selectedPayload));
    const effectivePrompt = customPrompt.trim() || standardPrompt;
    const showPreview = options?.showPreview ?? true;
    return (
      <div className={showPreview ? 'bg-white border rounded-4 p-3 d-flex flex-column gap-3' : 'd-flex flex-column gap-2'}>
        <div className="d-flex justify-content-between align-items-center gap-3">
          <h4 className="m-0 fs-6 fw-bold text-dark">{label}</h4>
        </div>
        <div className={showPreview ? 'row g-3 align-items-start' : 'd-flex flex-column gap-2'}>
          <div className={showPreview ? 'col-12 col-xl-7 d-flex flex-column gap-2' : 'd-flex flex-column gap-2'}>
            {options?.multiline === false ? (
              <input
                value={value}
                onChange={(event) => updateField(key, event.target.value)}
                className="form-control form-control-sm"
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            ) : (
              <textarea
                value={value}
                onChange={(event) => updateField(key, event.target.value)}
                className="form-control form-control-sm"
                rows={5}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            )}
            <div className="d-flex align-items-center flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary fw-semibold"
                onClick={() => void runAiRewrite(key, label, effectivePrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() => setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
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
                    onChange={(event) => setCustomPromptMap((prev) => ({ ...prev, [keyName]: event.target.value }))}
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          {showPreview ? (
            <div className="col-12 col-xl-5">
              <div className="bg-light border rounded-3 p-3 h-100">
                <div className={workspacePreviewLabelClassName}>CRM-Original</div>
                <div className={workspacePreviewBodyClassName}>{rawValue || 'Keine CRM-Vorlage vorhanden.'}</div>
              </div>
            </div>
          ) : null}
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
    const keyName = String(key);
    const currentList = Array.isArray(form[key]) ? (form[key] as string[]) : [];
    const value = currentList.join('\n');
    const rawValueText = rawValue.join('\n');
    const isRewriting = rewritingKey === keyName;
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, getReferencePromptContext(selectedRow, selectedPayload));
    const effectivePrompt = customPrompt.trim() || standardPrompt;
    return (
      <div className="bg-white border rounded-4 p-3 d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-center gap-3">
          <h4 className="m-0 fs-6 fw-bold text-dark">{label}</h4>
        </div>
        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-7 d-flex flex-column gap-2">
            <textarea
              value={value}
              onChange={(event) => updateField(key, event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
              className="form-control form-control-sm"
              rows={5}
              placeholder={placeholder}
            />
            <div className="d-flex align-items-center flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary fw-semibold"
                onClick={() => void runAiRewrite(key, label, effectivePrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() => setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
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
                    onChange={(event) => setCustomPromptMap((prev) => ({ ...prev, [keyName]: event.target.value }))}
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
              <div className={workspacePreviewLabelClassName}>CRM-Original</div>
              <div className={workspacePreviewBodyClassName}>{rawValueText || 'Keine CRM-Vorlage vorhanden.'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const selectedType = getPayloadText(selectedPayload, ['object_type']) || '—';
  const selectedTransaction = formatReferenceResult(getPayloadText(selectedPayload, ['transaction_result']) || '—');
  const selectedMode = getPayloadText(selectedPayload, ['offer_type']) || '—';
  const selectedArea = asNumber(selectedPayload.area_sqm);
  const selectedRooms = asNumber(selectedPayload.rooms);
  const selectedDescription = getPayloadText(selectedPayload, ['description', 'reference_text_seed']);
  const selectedSourceTitle = getPayloadText(selectedPayload, ['source_title']) || '—';
  const selectedStatus = getPayloadText(selectedPayload, ['status']) || '—';
  const selectedStatusId = getPayloadText(selectedPayload, ['status_id']) || '—';
  const selectedRegion = getPayloadText(selectedPayload, ['region']) || '—';
  const selectedLocation = getReferenceLocationLabel(selectedPayload) || '—';
  const selectedLocationScope = getPayloadText(selectedPayload, ['location_scope']) || '—';
  const selectedImageUrl = getPayloadText(selectedPayload, ['image_url']);
  const selectedGalleryCount = Array.isArray(selectedPayload.gallery) ? selectedPayload.gallery.length : 0;
  const selectedGalleryAssetCount = Array.isArray(selectedPayload.gallery_assets) ? selectedPayload.gallery_assets.length : 0;
  const selectedHasMainImage = selectedImageUrl.length > 0 || imageAssets.length > 0;
  const selectedOfferTypeDebug = getPayloadText(selectedPayload, ['offer_type', 'vermarktungsart']) || '—';
  const selectedTransactionDebug = getPayloadText(selectedPayload, ['transaction_result']) || '—';
  const selectedSoldFlag = getPayloadText(selectedPayload, ['verkauft']) || '—';
  const selectedRentedFlag = getPayloadText(selectedPayload, ['vermietet']) || '—';
  const selectedReservedFlag = getPayloadText(selectedPayload, ['reserviert']) || '—';
  const selectedPublishFlag = getPayloadText(selectedPayload, ['veroeffentlichen']) || '—';
  const rawDescription = getReferenceRawText(selectedPayload);
  const rawChallengeText = getPayloadText(selectedPayload, ['challenge_note_source']);
  const selectedChallengeCategories = Array.isArray(selectedPayload.challenge_categories)
    ? selectedPayload.challenge_categories
        .filter((entry): entry is ReferenceChallengeCategory => typeof entry === 'string')
        .reduce<ReferenceChallengeCategory[]>((acc, entry) => {
          const normalized = entry.trim();
          if (normalized) acc.push(normalized as ReferenceChallengeCategory);
          return acc;
        }, [])
    : [];
  const rawHighlights = getPayloadList(selectedPayload, 'highlights');
  const requiredReferenceTitle = asText(form?.seo_h1);
  const requiredReferenceText = asText(form?.long_description);
  const rawReferenceTitle = getReferenceSourceTitle(selectedRow, selectedPayload);
  const rawReferenceText = getReferenceRawText(selectedPayload);
  const canSaveReferenceContent =
    requiredReferenceTitle.length > 0 &&
    requiredReferenceText.length > 0 &&
    requiredReferenceTitle !== rawReferenceTitle &&
    requiredReferenceText !== rawReferenceText;
  const isReferenceReady = selectedRow && form ? isReferenceReadyForPublish(selectedRow, form) : false;

  if (loading) return <FullscreenLoader show label="Referenzen werden geladen..." />;

  return (
    <div className="d-flex flex-column gap-2">
      <section className="mb-2">
        <div className="border border-success rounded-3 p-3 d-flex flex-column gap-3 mb-2 bg-secondary">
          <div className="row g-3 align-items-center">
            {visibilityConfig ? (
              <div className="col-12 col-xl">
                <select
                  value={visibilityMode}
                  onChange={(event) => void onVisibilityModeChange?.(event.target.value as VisibilityMode)}
                  disabled={visibilityBusy}
                  className="form-select fw-semibold"
                >
                  <option value="partner_wide">Referenzen partnerweit anzeigen</option>
                  <option value="strict_local">Referenzen nur lokal anzeigen</option>
                </select>
              </div>
            ) : null}
            <div className="col-12 col-xl-4 ms-xl-auto">
              {llmOptions.length > 0 || !llmOptionsLoaded ? (
                <select
                  value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
                  onChange={(event) => setSelectedLlmIntegrationId(event.target.value)}
                  className="form-select fw-semibold"
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
                <span className="small text-light">Keine aktive LLM-Integration</span>
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
      <div className="row g-3 g-xl-4 align-items-start">
        <section className="col-12 col-xl-4">
          <div className="bg-white border rounded-4 p-3">
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
              <h3 className="m-0 fs-6 fw-bold text-dark">{referenceLoadSummary ?? '0 Referenzen geladen'}</h3>
              <button
                type="button"
                className="btn btn-sm btn-light border rounded-circle fw-bold lh-1"
                onClick={() => setReferenceDebugOpen(true)}
                disabled={!referenceLoadDebug}
                aria-label="Debug-Informationen anzeigen"
              >
                i
              </button>
            </div>
            <input
              placeholder="Suchen..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
              {filteredRows.map((row) => {
                const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
                const sourceTitle = getPayloadText(payload, ['source_title']) || row.title || row.external_id;
                const marketingType = getPayloadText(payload, ['offer_type', 'vermarktungsart']) || '—';
                const objectType = getPayloadText(payload, ['object_type']) || '—';
                const location = getReferenceLocationLabel(payload);
                const rowOverride = overrides.find(
                  (entry) =>
                    entry.partner_id === row.partner_id &&
                    entry.source === row.provider &&
                    entry.external_id === row.external_id,
                ) ?? null;
                const sourcePayload = (row.source_payload ?? {}) as Record<string, unknown>;
                const previewImageUrl = getReferencePreviewImageUrl(payload, rowOverride?.image_url, sourcePayload);
                const isReady = isReferenceReadyForPublish(row, rowOverride);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`btn w-100 text-start p-2 pe-4 rounded-3 border position-relative ${selectedId === row.id ? 'bg-light' : 'bg-white'}`}
                  >
                    <span className="row g-2 align-items-center flex-nowrap">
                      <span className="col-2">
                        <span className="ratio ratio-1x1 rounded-2 overflow-hidden border bg-secondary-subtle">
                          {previewImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={previewImageUrl}
                              alt={sourceTitle || 'Referenzbild'}
                              className="w-100 h-100 object-fit-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="d-flex align-items-center justify-content-center small text-secondary fw-bold text-uppercase">Kein Bild</span>
                          )}
                        </span>
                      </span>
                      <span className="col d-flex flex-column gap-1 overflow-hidden">
                        <span className="fw-semibold text-dark text-truncate lh-sm">{sourceTitle}</span>
                        <span className="small text-secondary fw-bold text-uppercase lh-sm text-truncate">
                          {`${marketingType} · ${objectType} · ${location}`}
                        </span>
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`position-absolute top-0 end-0 mt-2 me-2 badge rounded-pill p-1 ${isReady ? 'bg-success' : 'bg-danger'}`}
                    />
                  </button>
                );
              })}
              {!filteredRows.length ? (
                <div className="small text-secondary">
                  Keine Referenzen vorhanden. Nach dem CRM-Sync werden hier synchronisierte Referenzobjekte angezeigt.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="col-12 col-xl-8">
          <div className="bg-white border rounded-4 p-3">
            {status.startsWith('Fehler') ? <p className="small text-danger mb-2">{status}</p> : null}
            {form && selectedRow ? (
              <>
              <div className="bg-light border rounded-4 p-3">
                <div className="d-flex align-items-center justify-content-between gap-3 mb-2 flex-wrap">
                  <div className={`${workspaceHeadingClassName} mb-2`}>Überblick</div>
                  <div className="d-inline-flex align-items-center flex-wrap gap-2">
                    <span
                      className={`d-inline-flex align-items-center gap-2 rounded-pill px-2 py-1 small fw-bold border ${
                        isReferenceReady
                          ? 'text-success bg-success-subtle border-success-subtle'
                          : 'text-danger bg-danger-subtle border-danger-subtle'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`badge rounded-pill p-1 ${isReferenceReady ? 'bg-success' : 'bg-danger'}`}
                      />
                      <span>{isReferenceReady ? 'Onlinefertig' : 'Nicht onlinefertig'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReferenceOverviewInfoOpen(true)}
                      className="btn btn-sm btn-outline-secondary fw-semibold"
                    >
                      Info
                    </button>
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className={workspaceMetaLabelClassName}>Referenz-ID</div>
                    <div className={workspaceMetaValueClassName}>{selectedRow.id}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className={workspaceMetaLabelClassName}>Quelle</div>
                    <div className={workspaceMetaValueClassName}>{selectedRow.provider} · {selectedRow.external_id}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className={workspaceMetaLabelClassName}>Aktualisiert</div>
                    <div className={workspaceMetaValueClassName}>
                      {formatDateLabel(selectedRow.source_updated_at ?? selectedRow.updated_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 my-4">
                <button type="button" onClick={() => setActiveTab('texts')} className={workspaceTabClassName(activeTab === 'texts')}>Texte</button>
                <button type="button" onClick={() => setActiveTab('seo')} className={workspaceTabClassName(activeTab === 'seo')}>SEO / GEO</button>
                <button type="button" onClick={() => setActiveTab('facts')} className={workspaceTabClassName(activeTab === 'facts')}>Referenzdaten</button>
                <button type="button" onClick={() => setActiveTab('media')} className={workspaceTabClassName(activeTab === 'media')}>Medien</button>
              </div>

              {activeTab === 'texts' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="row g-3 align-items-start">
                    <div className="col-12 col-xl-7">
                      <div className={`${workspaceHeadingClassName} mb-3`}>Online Referenz erstellen</div>
                      <div className="d-flex flex-column gap-3">
                        {renderTextField('Referenz-Titel', 'seo_h1', getReferenceSourceTitle(selectedRow, selectedPayload), {
                          multiline: false,
                          showPreview: false,
                          placeholder: 'Titel wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                        })}
                        {renderTextField('Referenztext', 'long_description', rawDescription, {
                          multiline: true,
                          showPreview: false,
                          placeholder: 'Referenztext wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                        })}
                        {renderTextField('Herausforderungen (optional)', 'features_text', rawChallengeText, {
                          multiline: true,
                          showPreview: false,
                          placeholder: 'Optional: nur bei klar erkennbaren Herausforderungen befüllen',
                        })}
                        {selectedChallengeCategories.length > 0 ? (
                          <div className="bg-light border rounded-3 p-3">
                            <div className={`${workspaceHeadingClassName} mb-2`}>Erkannte Herausforderungskategorien</div>
                            <div className={workspacePreviewBodyClassName}>
                              {selectedChallengeCategories.map((entry) => formatReferenceChallengeCategory(entry)).join(' · ')}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-12 col-xl-5">
                      <div className="bg-light border rounded-4 p-3">
                        <div className={`${workspaceHeadingClassName} mb-2`}>Motivwahl</div>
                        <div className="d-flex flex-column gap-2">
                          {effectiveReferenceImage ? (
                            <div className="d-flex flex-column gap-2">
                              <div className="ratio ratio-16x9 rounded-3 overflow-hidden border bg-secondary-subtle">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={effectiveReferenceImage.url}
                                  alt={effectiveReferenceImage.title ?? selectedRow.title ?? 'Referenzbild'}
                                  className="w-100 h-100 object-fit-cover"
                                  loading="eager"
                                  decoding="async"
                                />
                              </div>
                              <div className={workspacePreviewBodyClassName}>
                                {effectiveReferenceImage.title ?? selectedRow.title ?? 'Objekthauptbild'}
                              </div>
                            </div>
                          ) : (
                            <div className="small text-secondary lh-base">Im aktuellen Referenz-Payload ist kein Objekthauptbild hinterlegt.</div>
                          )}
                          <div className="d-flex flex-column gap-2">
                            <div className={workspaceMetaLabelClassName}>Alternative Bildauswahl (übertragene Bilder)</div>
                            {imageAssets.length > 0 ? (
                              <>
                                <div className="row row-cols-2 row-cols-md-3 g-2">
                                  {imageAssets.map((asset, index) => {
                                    const active = pendingReferenceImageUrl
                                      ? pendingReferenceImageUrl === asset.url
                                      : selectedReferenceImageOverrideUrl === asset.url;
                                    return (
                                      <div key={`${asset.url}-${index}`} className="col">
                                        <button
                                          type="button"
                                          className={`btn w-100 d-grid gap-2 p-2 rounded-3 border text-start ${
                                            active ? 'btn-success bg-success-subtle text-dark border-success' : 'btn-light'
                                          }`}
                                          onClick={() => setPendingReferenceImageUrl(asset.url)}
                                        >
                                          <span className="ratio ratio-4x3 rounded-2 overflow-hidden bg-secondary-subtle">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={asset.url}
                                              alt={asset.title ?? `Referenzbild ${index + 1}`}
                                              className="w-100 h-100 object-fit-cover"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </span>
                                          <span className="small fw-semibold text-dark lh-sm">{asset.title ?? `Referenzbild ${index + 1}`}</span>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="d-flex flex-wrap justify-content-end gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm fw-bold px-3 py-2"
                                    disabled={!hasPendingReferenceImageSelection || saving}
                                    onClick={() => void applyReferenceImageSelection(pendingReferenceImageUrl)}
                                  >
                                    Bild wählen
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2 text-start"
                                    disabled={saving || (!selectedReferenceImageOverrideUrl && !pendingReferenceImageUrl)}
                                    onClick={() => {
                                      setPendingReferenceImageUrl(null);
                                      void applyReferenceImageSelection(null);
                                    }}
                                  >
                                    Objekthauptbild nutzen
                                  </button>
                                </div>
                                {referenceImageSelectionStatus ? (
                                  <div className="alert alert-danger small mb-0 py-2 px-3">{referenceImageSelectionStatus}</div>
                                ) : null}
                              </>
                            ) : (
                              <div className="small text-secondary lh-base">Im aktuellen Referenz-Payload sind keine übertragenen Bilder verfügbar.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <div className={workspaceHeadingClassName}>Referenz-Zusammenfassung vor speichern</div>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-xl-7 d-flex flex-column gap-3">
                        <div className="bg-light border rounded-3 p-3">
                          <div className={workspacePreviewLabelClassName}>Referenz-Titel</div>
                          <div className={workspacePreviewBodyClassName}>{form.seo_h1 || 'Kein Referenz-Titel gepflegt.'}</div>
                        </div>
                        <div className="bg-light border rounded-3 p-3">
                          <div className={workspacePreviewLabelClassName}>Referenztext</div>
                          <div className={workspacePreviewBodyClassName}>{form.long_description || 'Kein Referenztext gepflegt.'}</div>
                        </div>
                        <div className="bg-light border rounded-3 p-3">
                          <div className={workspacePreviewLabelClassName}>Herausforderungen</div>
                          <div className={workspacePreviewBodyClassName}>{form.features_text || 'Keine Herausforderungen gepflegt.'}</div>
                        </div>
                      </div>
                      <div className="col-12 col-xl-5">
                        <div className="bg-light border rounded-3 p-3">
                          <div className={workspacePreviewLabelClassName}>Motiv</div>
                          {effectiveReferenceImage ? (
                            <div className="d-flex flex-column gap-2">
                              <div className="ratio ratio-16x9 rounded-3 overflow-hidden border bg-secondary-subtle">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={effectiveReferenceImage.url}
                                  alt={effectiveReferenceImage.title ?? selectedRow.title ?? 'Referenzbild'}
                                  className="w-100 h-100 object-fit-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                              <div className={workspacePreviewBodyClassName}>
                                {effectiveReferenceImage.title ?? selectedRow.title ?? 'Motiv gewählt'}
                              </div>
                            </div>
                          ) : (
                            <div className={workspacePreviewBodyClassName}>Kein Motiv gewählt.</div>
                          )}
                        </div>
                      </div>
                    </div>
                    {!canSaveReferenceContent ? (
                      <div className="small text-secondary lh-base">
                        Für die Veröffentlichung und das Speichern werden ein eigener Referenz-Titel und ein eigener Referenztext benötigt. Rohdaten aus CRM-Titel oder Objektbeschreibung reichen nicht aus.
                      </div>
                    ) : null}
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveOverride()}
                        disabled={saving || !canSaveReferenceContent}
                        className="btn btn-dark btn-sm fw-semibold px-3 py-2"
                      >
                        {saving ? 'Speichert...' : 'Referenztexte speichern'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void resetReferenceTextOverrides()}
                        disabled={saving || (!requiredReferenceTitle && !requiredReferenceText && !asText(form.features_text))}
                        className="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2"
                      >
                        Referenztexte zurücksetzen
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'seo' ? (
                <div className="d-flex flex-column gap-3">
                  {renderTextField('SEO-Titel', 'seo_title', getReferenceSourceTitle(selectedRow, selectedPayload), { multiline: false })}
                  {renderTextField('SEO-Description', 'seo_description', rawDescription, { multiline: true })}
                  {renderListField('Highlights', 'highlights', rawHighlights, 'Ein Highlight pro Zeile')}
                  {renderListField('Alt-Texte (eine Zeile = ein Bild)', 'image_alt_texts', [], 'Ein Alt-Text pro Zeile')}

                  <div className="bg-white border rounded-4 p-3">
                    <div className={`${workspaceHeadingClassName} mb-2`}>Snippet-Vorschau</div>
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <div className="bg-light border rounded-3 p-3 h-100">
                          <div className={workspacePreviewLabelClassName}>SEO-Titel</div>
                          <div className={workspacePreviewBodyClassName}>{form.seo_title || 'Kein SEO-Titel gepflegt.'}</div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="bg-light border rounded-3 p-3 h-100">
                          <div className={workspacePreviewLabelClassName}>SEO-Description</div>
                          <div className={workspacePreviewBodyClassName}>{form.seo_description || 'Keine SEO-Description gepflegt.'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveOverride()}
                      disabled={saving || !canSaveReferenceContent}
                      className="btn btn-dark btn-sm fw-semibold px-3 py-2"
                    >
                      {saving ? 'Speichert...' : 'Referenztexte speichern'}
                    </button>
                  </div>
                </div>
              ) : null}

              {activeTab === 'facts' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="bg-white border rounded-4 p-3">
                    <div className={`${workspaceHeadingClassName} mb-3`}>Strukturierte Referenzdaten</div>
                    <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                      <div>
                        <div className={workspaceMetaLabelClassName}>Transaktion</div>
                        <div className={workspaceMetaValueClassName}>{selectedTransaction}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Objektart</div>
                        <div className={workspaceMetaValueClassName}>{selectedType}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Vermarktung</div>
                        <div className={workspaceMetaValueClassName}>{selectedMode}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Zimmer</div>
                        <div className={workspaceMetaValueClassName}>{selectedRooms ?? '—'}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Fläche</div>
                        <div className={workspaceMetaValueClassName}>{selectedArea != null ? `${selectedArea} m²` : '—'}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Ort</div>
                        <div className={workspaceMetaValueClassName}>{selectedLocation}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Stadt</div>
                        <div className={workspaceMetaValueClassName}>{getPayloadText(selectedPayload, ['city']) || '—'}</div>
                      </div>
                      <div>
                        <div className={workspaceMetaLabelClassName}>Stadtteil / District</div>
                        <div className={workspaceMetaValueClassName}>{getPayloadText(selectedPayload, ['district']) || '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border rounded-4 p-3">
                    <div className={`${workspaceHeadingClassName} mb-2`}>Referenztext-Basis</div>
                    <div className={workspacePreviewBodyClassName}>{selectedDescription || 'Kein Referenztext im normalisierten Payload vorhanden.'}</div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'media' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="bg-white border rounded-4 p-3">
                    <div className={`${workspaceHeadingClassName} mb-3`}>Bildmaterial</div>
                    {activeImage ? (
                      <div className="d-flex flex-column gap-3">
                        <div className="ratio ratio-16x9 rounded-3 overflow-hidden border bg-secondary-subtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            key={activeImage.url}
                            src={activeImage.url}
                            alt={activeImage.title ?? selectedRow.title ?? 'Referenzbild'}
                            className="w-100 h-100 object-fit-cover"
                            loading="eager"
                            decoding="async"
                          />
                        </div>
                        <div className="d-flex justify-content-between gap-3 small text-secondary fw-semibold">
                          <div>{activeImage.title ?? selectedRow.title ?? 'Referenzbild'}</div>
                          <div>{activeImageIndex + 1} / {imageAssets.length}</div>
                        </div>
                        {imageAssets.length > 1 ? (
                          <div className="row row-cols-3 row-cols-sm-4 row-cols-lg-6 g-2">
                            {imageAssets.map((asset, index) => (
                              <div key={`${asset.url}-${index}`} className="col">
                                <button
                                  type="button"
                                  onClick={() => setActiveImageIndex(index)}
                                  className={`btn w-100 p-0 rounded-3 overflow-hidden border ${
                                    index === activeImageIndex ? 'border-success border-2' : 'btn-light'
                                  }`}
                                  aria-label={`Referenzbild ${index + 1} anzeigen`}
                                >
                                  <span className="ratio ratio-4x3 bg-secondary-subtle">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={asset.url}
                                      alt={asset.title ?? `Referenzbild ${index + 1}`}
                                      className="w-100 h-100 object-fit-cover"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="small text-secondary lh-base">Im aktuellen Referenz-Payload ist kein Bildmaterial hinterlegt.</div>
                    )}
                  </div>
                  <div className="bg-white border rounded-4 p-3">
                    <div className={`${workspaceHeadingClassName} mb-3`}>Weitere Medien / Unterlagen</div>
                    {documentAssets.length > 0 ? (
                      <div className="d-flex flex-column gap-2">
                        {documentAssets.map((asset, index) => (
                          <a
                            key={`${asset.url}-${index}`}
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="border rounded-3 p-3 text-dark text-decoration-none d-flex flex-column gap-1"
                          >
                            <span className="fw-bold">{asset.title ?? `Dokument ${index + 1}`}</span>
                            <span className="small text-secondary">Datei extern öffnen</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="small text-secondary lh-base">Für Referenzen sind aktuell keine zusätzlichen Unterlagen erkannt.</div>
                    )}
                  </div>
                </div>
              ) : null}
              </>
            ) : (
              <p className="m-0 small text-secondary">
                Keine Referenzen vorhanden. Nach dem CRM-Sync werden hier synchronisierte Referenzobjekte angezeigt.
              </p>
            )}
          </div>
        </section>
      </div>
      {referenceOverviewInfoOpen && selectedRow ? (
        <div
          className="modal d-block bg-dark bg-opacity-50"
          tabIndex={-1}
          onClick={() => setReferenceOverviewInfoOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setReferenceOverviewInfoOpen(false);
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="references-overview-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header">
                <strong id="references-overview-info-title" className="modal-title fs-6">Referenzdetails</strong>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setReferenceOverviewInfoOpen(false)}
                  aria-label="Info-Modal schließen"
                />
              </div>
              <div className="modal-body d-flex flex-column gap-3">
                <div className={workspaceHeadingClassName}>CRM-Snapshot</div>
                <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                  <div>
                    <div className={workspaceMetaLabelClassName}>Provider</div>
                    <div className={workspaceMetaValueClassName}>{selectedRow.provider || '—'}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Extern-ID</div>
                    <div className={workspaceMetaValueClassName}>{selectedRow.external_id || '—'}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Quelltitel</div>
                    <div className={workspaceMetaValueClassName}>{selectedSourceTitle}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Status</div>
                    <div className={workspaceMetaValueClassName}>{selectedStatus}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Status-ID</div>
                    <div className={workspaceMetaValueClassName}>{selectedStatusId}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Region</div>
                    <div className={workspaceMetaValueClassName}>{selectedRegion}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Lagescope</div>
                    <div className={workspaceMetaValueClassName}>{selectedLocationScope}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Aktualisiert</div>
                    <div className={workspaceMetaValueClassName}>{formatDateLabel(selectedRow.source_updated_at ?? selectedRow.updated_at)}</div>
                  </div>
                </div>
                <div className={workspaceHeadingClassName}>Sync / Klassifizierung</div>
                <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                  <div>
                    <div className={workspaceMetaLabelClassName}>Transaktion</div>
                    <div className={workspaceMetaValueClassName}>{selectedTransactionDebug}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Vermarktungsart</div>
                    <div className={workspaceMetaValueClassName}>{selectedOfferTypeDebug}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>verkauft</div>
                    <div className={workspaceMetaValueClassName}>{selectedSoldFlag}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>vermietet</div>
                    <div className={workspaceMetaValueClassName}>{selectedRentedFlag}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>reserviert</div>
                    <div className={workspaceMetaValueClassName}>{selectedReservedFlag}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>veröffentlichen</div>
                    <div className={workspaceMetaValueClassName}>{selectedPublishFlag}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>source_updated_at</div>
                    <div className={workspaceMetaValueClassName}>{formatDateLabel(selectedRow.source_updated_at)}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>last_seen_at</div>
                    <div className={workspaceMetaValueClassName}>{formatDateLabel(selectedRow.last_seen_at)}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>workspace updated_at</div>
                    <div className={workspaceMetaValueClassName}>{formatDateLabel(selectedRow.updated_at)}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>is_active</div>
                    <div className={workspaceMetaValueClassName}>{selectedRow.is_active === true ? 'ja' : selectedRow.is_active === false ? 'nein' : '—'}</div>
                  </div>
                </div>
                <div className={workspaceHeadingClassName}>Medien-Diagnose</div>
                <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
                  <div>
                    <div className={workspaceMetaLabelClassName}>Objekthauptbild</div>
                    <div className={workspaceMetaValueClassName}>{selectedHasMainImage ? 'ja' : 'nein'}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>image_url</div>
                    <div className={workspaceMetaValueClassName}>{selectedImageUrl || '—'}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>gallery</div>
                    <div className={workspaceMetaValueClassName}>{selectedGalleryCount}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>gallery_assets</div>
                    <div className={workspaceMetaValueClassName}>{selectedGalleryAssetCount}</div>
                  </div>
                  <div>
                    <div className={workspaceMetaLabelClassName}>Bild-Assets gerendert</div>
                    <div className={workspaceMetaValueClassName}>{imageAssets.length}</div>
                  </div>
                </div>
                <div className="small text-secondary lh-base bg-light border rounded-3 p-3">
                  Wenn hier kein Objekthauptbild und keine Gallery-Assets auftauchen, ist im gespeicherten Referenz-Payload aktuell kein Bild angekommen. Dann sitzt das Problem upstream im CRM-Import oder im letzten Sync-Stand.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {referenceDebugOpen && referenceLoadDebug ? (
        <div
          className="modal d-block bg-dark bg-opacity-50"
          tabIndex={-1}
          onClick={() => setReferenceDebugOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setReferenceDebugOpen(false);
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="dialog"
            aria-modal="true"
            aria-labelledby="references-workspace-debug-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header">
                <strong id="references-workspace-debug-title" className="modal-title fs-6">Referenzen Debug</strong>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setReferenceDebugOpen(false)}
                  aria-label="Debug-Modal schließen"
                />
              </div>
              <div className="modal-body small text-secondary d-flex flex-column gap-2">
                <div>references={referenceLoadDebug.references}</div>
                <div>overrides={referenceLoadDebug.overrides}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
