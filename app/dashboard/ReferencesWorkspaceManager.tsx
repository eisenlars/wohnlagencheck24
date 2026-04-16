'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import FullscreenLoader from '@/components/ui/FullscreenLoader';
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
type ReferenceListFilter = 'all' | 'kauf' | 'miete';

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

function getReferencePreviewImageUrl(payload: Record<string, unknown>): string | null {
  return parseMediaAssets(payload).find((asset) => asset.kind === 'image')?.url ?? null;
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
  const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
  const title = asText(row.title);
  const description = getPayloadText(payload, ['description', 'reference_text_seed', 'short_description', 'long_description', 'title']);
  const location = getPayloadText(payload, ['location_text', 'location', 'region', 'city']);
  const features = getPayloadText(payload, ['features_text']);
  const highlights = getPayloadList(payload, 'highlights');
  return {
    partner_id: row.partner_id,
    source: row.provider,
    external_id: row.external_id,
    seo_title: override?.seo_title ?? title,
    seo_description: override?.seo_description ?? description,
    seo_h1: override?.seo_h1 ?? title,
    short_description: override?.short_description ?? description,
    long_description: override?.long_description ?? description,
    location_text: override?.location_text ?? location,
    features_text: override?.features_text ?? features,
    highlights: override?.highlights ?? highlights,
    image_alt_texts: override?.image_alt_texts ?? [],
    status: override?.status ?? 'draft',
  };
}

const shellStyle: CSSProperties = { display: 'grid', gap: '10px' };
const workspaceStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: '20px' };
const panelStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, background: '#fff' };
const panelTitleStyle: CSSProperties = { margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#0f172a' };
const searchInputStyle: CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 };
const listWrapStyle: CSSProperties = { display: 'grid', gap: 10, maxHeight: '62vh', overflowY: 'auto', marginTop: 12, paddingRight: 4 };
const statusBoxStyle: CSSProperties = { marginTop: 0, marginBottom: 12, fontSize: 12, color: '#334155' };
const summaryWrapStyle: CSSProperties = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 16 };
const summaryCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#f8fafc' };
const summaryHeaderStyle: CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700, marginBottom: 10 };
const summaryGridStyle: CSSProperties = { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' };
const summaryLabelStyle: CSSProperties = { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 };
const summaryValueStyle: CSSProperties = { fontSize: 13, color: '#0f172a', fontWeight: 600, lineHeight: 1.45 };
const tabsRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 };
const sectionCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, background: '#fff' };
const sectionHintStyle: CSSProperties = { color: '#64748b', fontSize: 12, lineHeight: 1.5 };
const fieldCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', padding: 14, display: 'grid', gap: 12 };
const fieldHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' };
const fieldHeaderActionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const customizedBadgeStyle: CSSProperties = { fontSize: 11, color: '#0f766e', fontWeight: 700 };
const resetButtonStyle = (active: boolean): CSSProperties => ({
  border: '1px solid #cbd5e1',
  borderRadius: 999,
  padding: '6px 10px',
  background: active ? '#eff6ff' : '#f8fafc',
  color: '#334155',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
});
const editorGridStyle: CSSProperties = { display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(260px, 0.75fr)' };
const textareaWrapperStyle: CSSProperties = { display: 'grid', gap: 10 };
const textareaStyle: CSSProperties = { minHeight: 150, border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px', fontSize: 14, lineHeight: 1.55, resize: 'vertical' };
const inputStyle: CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px', fontSize: 14 };
const aiActionsRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' };
const previewBoxStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: 12, display: 'grid', gap: 8 };
const previewHeaderStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' };
const previewContentStyle: CSSProperties = { fontSize: 13, color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-wrap' };
const previewGridStyle: CSSProperties = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
const previewCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: 12, display: 'grid', gap: 6 };
const previewLabelStyle: CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' };
const factsGridStyle: CSSProperties = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' };
const mediaStageStyle: CSSProperties = { position: 'relative', minHeight: 320, borderRadius: 14, overflow: 'hidden', background: '#e2e8f0' };
const mediaImageStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const mediaMetaStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', color: '#334155', fontSize: 13 };
const thumbRailStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const thumbButtonStyle = (active: boolean): CSSProperties => ({
  border: active ? '2px solid #0f766e' : '1px solid #cbd5e1',
  borderRadius: 10,
  overflow: 'hidden',
  padding: 0,
  width: 80,
  height: 60,
  background: '#fff',
  cursor: 'pointer',
});
const thumbImageStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const saveButtonStyle: CSSProperties = { padding: '10px 14px', borderRadius: 10, border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 600, cursor: 'pointer' };

function tabButtonStyle(active: boolean): CSSProperties {
  return {
    border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
    borderRadius: 999,
    padding: '8px 12px',
    background: active ? '#ecfeff' : '#fff',
    color: active ? '#0f172a' : '#334155',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
  };
}

function listRowStyle(active: boolean): CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    padding: 10,
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    backgroundColor: active ? '#f1f5f9' : '#fff',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '112px minmax(0, 1fr)',
    gap: 12,
    alignItems: 'center',
    minHeight: 84,
  };
}

const workspaceListHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
};

const workspaceDebugInfoButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#486b7a',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flex: '0 0 auto',
};

const workspaceDebugModalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.28)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
};

const workspaceDebugModalCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 340,
  borderRadius: 14,
  border: '1px solid #dbe5ea',
  background: '#ffffff',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
  padding: 16,
  display: 'grid',
  gap: 12,
};

const referenceOverviewInfoModalCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 720,
  borderRadius: 14,
  border: '1px solid #dbe5ea',
  background: '#ffffff',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
  padding: 16,
  display: 'grid',
  gap: 16,
};

const workspaceDebugModalHeadStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};

const workspaceDebugModalTitleStyle: CSSProperties = {
  fontSize: 14,
  color: '#0f172a',
};

const workspaceDebugModalCloseStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#64748b',
  fontSize: 20,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};

const workspaceDebugModalBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 13,
  color: '#334155',
};

const referenceRowMediaStyle: CSSProperties = {
  display: 'flex',
  width: 112,
  height: 84,
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: '#e2e8f0',
  border: '1px solid #cbd5e1',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};

const referenceRowImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const referenceRowImagePlaceholderStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const referenceRowContentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
  justifyContent: 'center',
};

const referenceRowTitleStyle: CSSProperties = {
  fontWeight: 600,
  color: '#0f172a',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.35,
};

const referenceRowMetaStyle: CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 700,
  textTransform: 'uppercase',
  lineHeight: 1.4,
};

const referenceOverviewHeaderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  rowGap: 12,
  columnGap: 12,
  marginBottom: 10,
  flexWrap: 'wrap',
};

const referenceOverviewHeaderActionsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  rowGap: 8,
  columnGap: 8,
  flexWrap: 'wrap',
};

const referenceOverviewInfoButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#334155',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const referenceOverviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  rowGap: 12,
  columnGap: 12,
};

const referenceListFilterRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 10,
  marginBottom: 12,
};

const filterButtonStyle = (active: boolean): CSSProperties => ({
  minWidth: 92,
  padding: '6px 14px',
  borderRadius: '999px',
  border: `1px solid ${active ? '#486b7a' : '#e2e8f0'}`,
  backgroundColor: active ? '#486b7a' : '#f8fafc',
  color: active ? '#fff' : '#1e293b',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
});

export default function ReferencesWorkspaceManager() {
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

  const mediaAssets = useMemo(() => parseMediaAssets(selectedPayload), [selectedPayload]);
  const imageAssets = useMemo(() => mediaAssets.filter((asset) => asset.kind === 'image'), [mediaAssets]);
  const documentAssets = useMemo(() => mediaAssets.filter((asset) => asset.kind === 'document'), [mediaAssets]);
  const activeImage = imageAssets[activeImageIndex] ?? imageAssets[0] ?? null;

  async function saveOverride(nextForm?: OverrideRow) {
    const payload = nextForm ?? form;
    if (!payload) return;
    setSaving(true);
    setStatus('Speichere Referenz-Overrides...');
    const upsertPayload = {
      ...payload,
      highlights: payload.highlights ?? [],
      image_alt_texts: payload.image_alt_texts ?? [],
      last_updated: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('partner_reference_overrides')
      .upsert(upsertPayload, { onConflict: 'partner_id,source,external_id' })
      .select('*')
      .single();
    if (error) {
      setStatus(`Speichern fehlgeschlagen (partner_reference_overrides): ${error.message}`);
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
    setStatus('Referenz-Overrides gespeichert.');
    setSaving(false);
  }

  async function runAiRewrite(key: keyof OverrideRow, label: string, customPrompt?: string) {
    if (!form || !selectedRow) return;
    const currentText = String(form[key] ?? '');
    if (!currentText.trim()) return;
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
          text: currentText,
          areaName: selectedRow.title || selectedRow.external_id,
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

  function resetField(key: keyof OverrideRow, rawValue: string | string[]) {
    updateField(key, rawValue);
  }

  function getStandardPromptText(label: string, areaName: string) {
    const lowerLabel = String(label || '').toLowerCase();
    if (lowerLabel.includes('referenz-titel') || lowerLabel.includes('h1')) {
      return `Formuliere einen prägnanten, sachlichen Referenz-Titel für ${areaName}. Maximal 60 Zeichen, keine Clickbait-Formulierungen, keine erfundenen Fakten, keine Übertreibungen.`;
    }
    if (lowerLabel.includes('seo-titel')) {
      return `Schreibe einen SEO-Titel für eine Immobilienreferenz in ${areaName}. Maximal 60 Zeichen, klar lesbar, ohne Keyword-Stapelung und ohne erfundene Fakten.`;
    }
    if (lowerLabel.includes('seo-description')) {
      return `Schreibe eine SEO-Description für eine Immobilienreferenz in ${areaName}. 140 bis 160 Zeichen, sachlich, kompakt und ohne neue Fakten.`;
    }
    if (lowerLabel.includes('teaser')) {
      return `Formuliere einen kurzen Teaser zur Referenz in ${areaName}. 1 bis 2 Sätze, sachlich, glaubwürdig und ohne Übertreibung.`;
    }
    if (lowerLabel.includes('langtext')) {
      return `Optimiere den Referenz-Langtext für bessere Lesbarkeit und Struktur. Sachlicher Stil, keine neuen Fakten, keine unnötigen Wiederholungen. Kontext: ${areaName}.`;
    }
    if (lowerLabel.includes('lage')) {
      return `Formuliere den Lage-Text für eine Referenz in ${areaName} klar und informativ. Fokus auf Ort, Umfeld und regionale Einordnung. Keine erfundenen Fakten.`;
    }
    if (lowerLabel.includes('ausstatt')) {
      return `Formuliere den Ausstattungs- oder Zusatztext für eine Referenz klar und sachlich. Nur aus den vorhandenen Referenzdaten ableitbare Aussagen verwenden.`;
    }
    if (lowerLabel.includes('highlights')) {
      return `Schreibe maximal 6 Highlights, jeweils 1 Zeile. Kurz, konkret, belegbar, keine Wiederholungen und keine vagen Werbeformulierungen.`;
    }
    if (lowerLabel.includes('alt-texte') || lowerLabel.includes('alttexte')) {
      return `Erstelle kurze, sachliche Alt-Texte, jeweils 1 Zeile pro Bild. Beschreibe das Motiv konkret, ohne erfundene Details und ohne Keyword-Stuffing.`;
    }
    return `Optimiere den Text für bessere Lesbarkeit, fachliche Klarheit und saubere Suchmaschinen-/Antwortsystem-Nutzung. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
  }

  const renderTextField = (
    label: string,
    key: keyof OverrideRow,
    rawValue: string,
    options?: { multiline?: boolean; placeholder?: string },
  ) => {
    if (!form) return null;
    const keyName = String(key);
    const value = String(form[key] ?? '');
    const isCustomized = value.trim() !== rawValue.trim();
    const isRewriting = rewritingKey === keyName;
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, selectedRow?.title || selectedRow?.external_id || 'Referenz');
    return (
      <div style={fieldCardStyle}>
        <div style={fieldHeaderStyle}>
          <h4 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>{label}</h4>
          <div style={fieldHeaderActionsStyle}>
            {isCustomized ? <span style={customizedBadgeStyle}>✓ Individuell angepasst</span> : null}
            <button type="button" onClick={() => resetField(key, rawValue)} style={resetButtonStyle(isCustomized)}>
              Original nutzen
            </button>
          </div>
        </div>
        <div style={editorGridStyle}>
          <div style={textareaWrapperStyle}>
            {options?.multiline === false ? (
              <input
                value={value}
                onChange={(event) => updateField(key, event.target.value)}
                style={inputStyle}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            ) : (
              <textarea
                value={value}
                onChange={(event) => updateField(key, event.target.value)}
                style={textareaStyle}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            )}
            <div style={aiActionsRowStyle}>
              <button
                type="button"
                style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
                onClick={() => void runAiRewrite(key, label, customPrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() => setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
                style={promptToggleStyle}
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
            </div>
            {showPrompt ? (
              <div style={promptPanelStyle}>
                <div style={promptLabelStyle}>Standard-Prompt</div>
                <div style={promptContentStyle}>{standardPrompt}</div>
                <label style={promptInputLabelStyle}>
                  Eigener Prompt (optional)
                  <textarea
                    value={customPrompt}
                    onChange={(event) => setCustomPromptMap((prev) => ({ ...prev, [keyName]: event.target.value }))}
                    style={promptInputStyle}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div style={previewBoxStyle}>
            <div style={previewHeaderStyle}>CRM-Original</div>
            <div style={previewContentStyle}>{rawValue || 'Keine CRM-Vorlage vorhanden.'}</div>
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
    const keyName = String(key);
    const currentList = Array.isArray(form[key]) ? (form[key] as string[]) : [];
    const value = currentList.join('\n');
    const rawValueText = rawValue.join('\n');
    const isCustomized = value.trim() !== rawValueText.trim();
    const isRewriting = rewritingKey === keyName;
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, selectedRow?.title || selectedRow?.external_id || 'Referenz');
    return (
      <div style={fieldCardStyle}>
        <div style={fieldHeaderStyle}>
          <h4 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>{label}</h4>
          <div style={fieldHeaderActionsStyle}>
            {isCustomized ? <span style={customizedBadgeStyle}>✓ Individuell angepasst</span> : null}
            <button type="button" onClick={() => resetField(key, rawValue)} style={resetButtonStyle(isCustomized)}>
              Original nutzen
            </button>
          </div>
        </div>
        <div style={editorGridStyle}>
          <div style={textareaWrapperStyle}>
            <textarea
              value={value}
              onChange={(event) => updateField(key, event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
              style={textareaStyle}
              placeholder={placeholder}
            />
            <div style={aiActionsRowStyle}>
              <button
                type="button"
                style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
                onClick={() => void runAiRewrite(key, label, customPrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() => setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
                style={promptToggleStyle}
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
            </div>
            {showPrompt ? (
              <div style={promptPanelStyle}>
                <div style={promptLabelStyle}>Standard-Prompt</div>
                <div style={promptContentStyle}>{standardPrompt}</div>
                <label style={promptInputLabelStyle}>
                  Eigener Prompt (optional)
                  <textarea
                    value={customPrompt}
                    onChange={(event) => setCustomPromptMap((prev) => ({ ...prev, [keyName]: event.target.value }))}
                    style={promptInputStyle}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div style={previewBoxStyle}>
            <div style={previewHeaderStyle}>CRM-Original</div>
            <div style={previewContentStyle}>{rawValueText || 'Keine CRM-Vorlage vorhanden.'}</div>
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
  const selectedLocation = getPayloadText(selectedPayload, ['location_text', 'location']) || [getPayloadText(selectedPayload, ['city']), getPayloadText(selectedPayload, ['district'])].filter(Boolean).join(' ') || '—';
  const selectedDescription = getPayloadText(selectedPayload, ['description', 'reference_text_seed']);
  const selectedSourceTitle = getPayloadText(selectedPayload, ['source_title']) || '—';
  const selectedStatus = getPayloadText(selectedPayload, ['status']) || '—';
  const selectedStatusId = getPayloadText(selectedPayload, ['status_id']) || '—';
  const selectedRegion = getPayloadText(selectedPayload, ['region']) || '—';
  const selectedLocationScope = getPayloadText(selectedPayload, ['location_scope']) || '—';
  const rawDescription = selectedDescription;
  const rawLocationText = getPayloadText(selectedPayload, ['location']) || [getPayloadText(selectedPayload, ['city']), getPayloadText(selectedPayload, ['district'])].filter(Boolean).join(' ');
  const rawFeatures = getPayloadText(selectedPayload, ['features_text']);
  const rawHighlights = getPayloadList(selectedPayload, 'highlights');

  if (loading) return <FullscreenLoader show label="Referenzen werden geladen..." />;

  return (
    <div style={shellStyle}>
      <section style={visibilityShellStyle}>
        <div style={visibilityCardStyle}>
          <div style={visibilityControlsRowStyle}>
            <div style={visibilityLabelStyle}>
              <div style={visibilityInfoTitleStyle}>KI-Arbeitsmodus für Referenzen</div>
              <div style={visibilityInfoTextStyle}>
                Wählen Sie das Modell zentral für den gesamten Referenz-Arbeitsbereich. Alle KI-Aktionen in den Tabs nutzen diese Auswahl.
              </div>
            </div>
            <div style={visibilityModelWrapStyle}>
              {llmOptions.length > 0 || !llmOptionsLoaded ? (
                <span style={visibilitySelectWrapStyle}>
                  <select
                    value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
                    onChange={(event) => setSelectedLlmIntegrationId(event.target.value)}
                    style={visibilityModelSelectStyle}
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
                  <span style={visibilitySelectChevronStyle} aria-hidden="true">▾</span>
                </span>
              ) : (
                <span style={aiMissingHintStyle}>Keine aktive LLM-Integration</span>
              )}
            </div>
          </div>
        </div>
      </section>
      <div style={workspaceStyle}>
        <section style={panelStyle}>
          <div style={workspaceListHeaderRowStyle}>
            <h3 style={panelTitleStyle}>{referenceLoadSummary ?? '0 Referenzen geladen'}</h3>
            <button
              type="button"
              style={workspaceDebugInfoButtonStyle}
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
            style={searchInputStyle}
          />
          <div style={referenceListFilterRowStyle}>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              style={filterButtonStyle(filterType === 'all')}
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => setFilterType('kauf')}
              style={filterButtonStyle(filterType === 'kauf')}
            >
              Kauf
            </button>
            <button
              type="button"
              onClick={() => setFilterType('miete')}
              style={filterButtonStyle(filterType === 'miete')}
            >
              Miete
            </button>
          </div>
          <div style={listWrapStyle}>
            {filteredRows.map((row) => {
              const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
              const previewImageUrl = getReferencePreviewImageUrl(payload);
              const marketingType = getPayloadText(payload, ['offer_type', 'vermarktungsart']) || '—';
              const objectType = getPayloadText(payload, ['object_type']) || '—';
              const location = getReferenceLocationLabel(payload);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  style={listRowStyle(selectedId === row.id)}
                >
                  <span style={referenceRowMediaStyle}>
                    {previewImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImageUrl}
                        alt={row.title || 'Referenzbild'}
                        style={referenceRowImageStyle}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span style={referenceRowImagePlaceholderStyle}>Kein Bild</span>
                    )}
                  </span>
                  <span style={referenceRowContentStyle}>
                    <span style={referenceRowTitleStyle}>{row.title || row.external_id}</span>
                    <span style={referenceRowMetaStyle}>
                      {`${marketingType} · ${objectType} · ${location}`}
                    </span>
                  </span>
                </button>
              );
            })}
            {!filteredRows.length ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>
                Keine Referenzen vorhanden. Nach dem CRM-Sync werden hier synchronisierte Referenzobjekte angezeigt.
              </div>
            ) : null}
          </div>
        </section>

        <section style={panelStyle}>
          {status.startsWith('Fehler') ? <p style={statusBoxStyle}>{status}</p> : null}
          {form && selectedRow ? (
            <>
              <div style={summaryWrapStyle}>
                <div style={summaryCardStyle}>
                  <div style={referenceOverviewHeaderRowStyle}>
                    <div style={summaryHeaderStyle}>Überblick</div>
                    <div style={referenceOverviewHeaderActionsStyle}>
                      <button
                        type="button"
                        onClick={() => setReferenceOverviewInfoOpen(true)}
                        style={referenceOverviewInfoButtonStyle}
                      >
                        Info
                      </button>
                    </div>
                  </div>
                  <div style={referenceOverviewGridStyle}>
                    <div>
                      <div style={summaryLabelStyle}>Referenz-ID</div>
                      <div style={summaryValueStyle}>{selectedRow.id}</div>
                    </div>
                    <div>
                      <div style={summaryLabelStyle}>Quelle</div>
                      <div style={summaryValueStyle}>{selectedRow.provider} · {selectedRow.external_id}</div>
                    </div>
                    <div>
                      <div style={summaryLabelStyle}>Aktualisiert</div>
                      <div style={summaryValueStyle}>{formatDateLabel(selectedRow.source_updated_at ?? selectedRow.updated_at)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={tabsRowStyle}>
                <button type="button" onClick={() => setActiveTab('texts')} style={tabButtonStyle(activeTab === 'texts')}>Texte</button>
                <button type="button" onClick={() => setActiveTab('seo')} style={tabButtonStyle(activeTab === 'seo')}>SEO / GEO</button>
                <button type="button" onClick={() => setActiveTab('facts')} style={tabButtonStyle(activeTab === 'facts')}>Referenzdaten</button>
                <button type="button" onClick={() => setActiveTab('media')} style={tabButtonStyle(activeTab === 'media')}>Medien</button>
              </div>

              {activeTab === 'texts' ? (
                <div style={{ display: 'grid', gap: 18 }}>
                  {renderTextField('Referenz-Titel', 'seo_h1', selectedRow.title ?? '', { multiline: false })}
                  {renderTextField('Teaser', 'short_description', rawDescription, { multiline: true })}
                  {renderTextField('Langtext', 'long_description', rawDescription, { multiline: true })}
                  {renderTextField('Lagetext', 'location_text', rawLocationText, { multiline: true })}
                  {renderTextField('Ausstattungs-/Zusatztext', 'features_text', rawFeatures, { multiline: true })}

                  <div style={previewGridStyle}>
                    <div style={previewCardStyle}>
                      <div style={previewLabelStyle}>Referenz-Titel</div>
                      <div style={previewContentStyle}>{form.seo_h1 || 'Kein Referenz-Titel gepflegt.'}</div>
                    </div>
                    <div style={previewCardStyle}>
                      <div style={previewLabelStyle}>Teaser</div>
                      <div style={previewContentStyle}>{form.short_description || 'Kein Teaser gepflegt.'}</div>
                    </div>
                    <div style={previewCardStyle}>
                      <div style={previewLabelStyle}>Langtext</div>
                      <div style={previewContentStyle}>{form.long_description || 'Kein Langtext gepflegt.'}</div>
                    </div>
                    <div style={previewCardStyle}>
                      <div style={previewLabelStyle}>Lage</div>
                      <div style={previewContentStyle}>{form.location_text || 'Kein Lage-Text gepflegt.'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => void saveOverride()} disabled={saving} style={saveButtonStyle}>
                      {saving ? 'Speichert...' : 'Referenztexte speichern'}
                    </button>
                  </div>
                </div>
              ) : null}

              {activeTab === 'seo' ? (
                <div style={{ display: 'grid', gap: 18 }}>
                  {renderTextField('SEO-Titel', 'seo_title', selectedRow.title ?? '', { multiline: false })}
                  {renderTextField('SEO-Description', 'seo_description', rawDescription, { multiline: true })}
                  {renderListField('Highlights', 'highlights', rawHighlights, 'Ein Highlight pro Zeile')}
                  {renderListField('Alt-Texte (eine Zeile = ein Bild)', 'image_alt_texts', [], 'Ein Alt-Text pro Zeile')}

                  <div style={sectionCardStyle}>
                    <div style={summaryHeaderStyle}>Snippet-Vorschau</div>
                    <div style={previewGridStyle}>
                      <div style={previewCardStyle}>
                        <div style={previewLabelStyle}>SEO-Titel</div>
                        <div style={previewContentStyle}>{form.seo_title || 'Kein SEO-Titel gepflegt.'}</div>
                      </div>
                      <div style={previewCardStyle}>
                        <div style={previewLabelStyle}>SEO-Description</div>
                        <div style={previewContentStyle}>{form.seo_description || 'Keine SEO-Description gepflegt.'}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => void saveOverride()} disabled={saving} style={saveButtonStyle}>
                      {saving ? 'Speichert...' : 'Referenztexte speichern'}
                    </button>
                  </div>
                </div>
              ) : null}

              {activeTab === 'facts' ? (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={sectionCardStyle}>
                    <div style={summaryHeaderStyle}>Strukturierte Referenzdaten</div>
                    <div style={factsGridStyle}>
                      <div>
                        <div style={summaryLabelStyle}>Transaktion</div>
                        <div style={summaryValueStyle}>{selectedTransaction}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Objektart</div>
                        <div style={summaryValueStyle}>{selectedType}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Vermarktung</div>
                        <div style={summaryValueStyle}>{selectedMode}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Zimmer</div>
                        <div style={summaryValueStyle}>{selectedRooms ?? '—'}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Fläche</div>
                        <div style={summaryValueStyle}>{selectedArea != null ? `${selectedArea} m²` : '—'}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Ort</div>
                        <div style={summaryValueStyle}>{selectedLocation}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Stadt</div>
                        <div style={summaryValueStyle}>{getPayloadText(selectedPayload, ['city']) || '—'}</div>
                      </div>
                      <div>
                        <div style={summaryLabelStyle}>Stadtteil / District</div>
                        <div style={summaryValueStyle}>{getPayloadText(selectedPayload, ['district']) || '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div style={sectionCardStyle}>
                    <div style={summaryHeaderStyle}>Referenztext-Basis</div>
                    <div style={previewContentStyle}>{selectedDescription || 'Kein Referenztext im normalisierten Payload vorhanden.'}</div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'media' ? (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={sectionCardStyle}>
                    <div style={summaryHeaderStyle}>Bildmaterial</div>
                    {activeImage ? (
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={mediaStageStyle}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            key={activeImage.url}
                            src={activeImage.url}
                            alt={activeImage.title ?? selectedRow.title ?? 'Referenzbild'}
                            style={mediaImageStyle}
                            loading="eager"
                            decoding="async"
                          />
                        </div>
                        <div style={mediaMetaStyle}>
                          <div>{activeImage.title ?? selectedRow.title ?? 'Referenzbild'}</div>
                          <div>{activeImageIndex + 1} / {imageAssets.length}</div>
                        </div>
                        {imageAssets.length > 1 ? (
                          <div style={thumbRailStyle}>
                            {imageAssets.map((asset, index) => (
                              <button
                                key={`${asset.url}-${index}`}
                                type="button"
                                onClick={() => setActiveImageIndex(index)}
                                style={thumbButtonStyle(index === activeImageIndex)}
                                aria-label={`Referenzbild ${index + 1} anzeigen`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={asset.url}
                                  alt={asset.title ?? `Referenzbild ${index + 1}`}
                                  style={thumbImageStyle}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={sectionHintStyle}>Im aktuellen Referenz-Payload ist kein Bildmaterial hinterlegt.</div>
                    )}
                  </div>
                  <div style={sectionCardStyle}>
                    <div style={summaryHeaderStyle}>Weitere Medien / Unterlagen</div>
                    {documentAssets.length > 0 ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {documentAssets.map((asset, index) => (
                          <a
                            key={`${asset.url}-${index}`}
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', color: '#0f172a', textDecoration: 'none', display: 'grid', gap: 4 }}
                          >
                            <span style={{ fontWeight: 700 }}>{asset.title ?? `Dokument ${index + 1}`}</span>
                            <span style={{ color: '#64748b', fontSize: 12 }}>Datei extern öffnen</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div style={sectionHintStyle}>Für Referenzen sind aktuell keine zusätzlichen Unterlagen erkannt.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              Keine Referenzen vorhanden. Nach dem CRM-Sync werden hier synchronisierte Referenzobjekte angezeigt.
            </p>
          )}
        </section>
      </div>
      {referenceOverviewInfoOpen && selectedRow ? (
        <div
          style={workspaceDebugModalOverlayStyle}
          onClick={() => setReferenceOverviewInfoOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setReferenceOverviewInfoOpen(false);
          }}
        >
          <div
            style={referenceOverviewInfoModalCardStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="references-overview-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div style={workspaceDebugModalHeadStyle}>
              <strong id="references-overview-info-title" style={workspaceDebugModalTitleStyle}>Referenzdetails</strong>
              <button
                type="button"
                style={workspaceDebugModalCloseStyle}
                onClick={() => setReferenceOverviewInfoOpen(false)}
                aria-label="Info-Modal schließen"
              >
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={summaryHeaderStyle}>CRM-Snapshot</div>
              <div style={summaryGridStyle}>
                <div>
                  <div style={summaryLabelStyle}>Quelltitel</div>
                  <div style={summaryValueStyle}>{selectedSourceTitle}</div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>Status</div>
                  <div style={summaryValueStyle}>{selectedStatus}</div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>Status-ID</div>
                  <div style={summaryValueStyle}>{selectedStatusId}</div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>Region</div>
                  <div style={summaryValueStyle}>{selectedRegion}</div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>Lagescope</div>
                  <div style={summaryValueStyle}>{selectedLocationScope}</div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>Aktualisiert</div>
                  <div style={summaryValueStyle}>{formatDateLabel(selectedRow.source_updated_at ?? selectedRow.updated_at)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {referenceDebugOpen && referenceLoadDebug ? (
        <div
          style={workspaceDebugModalOverlayStyle}
          onClick={() => setReferenceDebugOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setReferenceDebugOpen(false);
          }}
        >
          <div
            style={workspaceDebugModalCardStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="references-workspace-debug-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div style={workspaceDebugModalHeadStyle}>
              <strong id="references-workspace-debug-title" style={workspaceDebugModalTitleStyle}>Referenzen Debug</strong>
              <button
                type="button"
                style={workspaceDebugModalCloseStyle}
                onClick={() => setReferenceDebugOpen(false)}
                aria-label="Debug-Modal schließen"
              >
                ×
              </button>
            </div>
            <div style={workspaceDebugModalBodyStyle}>
              <div>references={referenceLoadDebug.references}</div>
              <div>overrides={referenceLoadDebug.overrides}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const visibilityShellStyle: CSSProperties = {
  width: '100%',
  padding: '0 0 0',
  marginBottom: 0,
};

const visibilityCardStyle: CSSProperties = {
  border: '1px solid #99f6b4',
  borderRadius: '12px',
  background: 'rgb(72, 107, 122)',
  padding: '14px 16px',
  display: 'grid',
  gap: '12px',
  marginBottom: '8px',
};

const visibilityControlsRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
  width: '100%',
};

const visibilityLabelStyle: CSSProperties = {
  display: 'block',
  flex: '1 1 420px',
};

const visibilityInfoTitleStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '4px',
};

const visibilityInfoTextStyle: CSSProperties = {
  color: 'rgba(248, 250, 252, 0.88)',
  fontSize: '12px',
  lineHeight: 1.45,
};

const visibilityModelWrapStyle: CSSProperties = {
  flex: '0 1 320px',
  marginLeft: 'auto',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
};

const visibilitySelectWrapStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const visibilitySelectStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  minHeight: '40px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.35)',
  background: '#ffffff',
  color: '#0f172a',
  padding: '0 40px 0 12px',
  fontSize: '13px',
  fontWeight: 600,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  minWidth: '420px',
};

const visibilityModelSelectStyle: CSSProperties = {
  ...visibilitySelectStyle,
  minWidth: '320px',
  maxWidth: '100%',
};

const visibilitySelectChevronStyle: CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '14px',
  lineHeight: 1,
  color: '#475569',
  pointerEvents: 'none',
};

const aiButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '9px 16px',
  backgroundColor: 'rgba(72, 107, 122, 0.12)',
  color: 'rgb(72, 107, 122)',
  border: '1px solid rgb(72, 107, 122)',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const aiButtonLoadingStyle: CSSProperties = {
  ...aiButtonStyle,
  opacity: 0.7,
  cursor: 'not-allowed',
};

const aiMissingHintStyle: CSSProperties = {
  fontSize: '12px',
  color: '#e2e8f0',
};

const promptToggleStyle: CSSProperties = {
  alignSelf: 'flex-start',
  backgroundColor: '#ffffff',
  border: '1px solid rgb(72, 107, 122)',
  color: 'rgb(72, 107, 122)',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  padding: '9px 16px',
  borderRadius: '8px',
};

const promptPanelStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '12px',
  backgroundColor: '#f8fafc',
};

const promptLabelStyle: CSSProperties = {
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  fontWeight: 700,
  marginBottom: '6px',
};

const promptContentStyle: CSSProperties = {
  fontSize: '12px',
  color: '#475569',
  marginBottom: '10px',
  lineHeight: 1.5,
};

const promptInputLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#1e293b',
};

const promptInputStyle: CSSProperties = {
  width: '100%',
  minHeight: '80px',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '12px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
};
