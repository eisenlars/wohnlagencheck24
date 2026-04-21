'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import FullscreenLoader from '@/components/ui/FullscreenLoader';
import { formatRequestModeLabel, formatRequestObjectTypeLabel, formatRequestSubtypeLabel } from '@/lib/request-labels';
import { getRequestImageCatalog, matchRequestImage } from '@/lib/request-image-matching';
import { createClient } from '@/utils/supabase/client';
import workspaceStyles from './styles/workspace.module.css';

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

type RawRequestRow = {
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
  request_image_catalog_id?: string | null;
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

type WorkspaceTab = 'texts' | 'seo' | 'criteria';
type RequestListFilter = 'all' | 'haus' | 'wohnung';

const workspaceTabClassName = (active: boolean) =>
  active
    ? `${workspaceStyles.workspaceTab} ${workspaceStyles.workspaceTabActive}`
    : workspaceStyles.workspaceTab;
type RequestWorkspaceLoadDebug = {
  requests: number;
  overrides: number;
};
const REQUEST_LIST_VISIBLE_ROWS = 10;
const REQUEST_LIST_ROW_HEIGHT = 76;
const REQUEST_LIST_ROW_GAP = 8;

type RegionTarget = {
  city?: string;
  label?: string;
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

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRadiusContextSegment(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.startsWith('umkreis') || /^\d+\s*km\s+um\b/.test(normalized);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatEuro(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('de-DE').format(value)} €`;
}

function formatBudgetRange(minValue: number | null, maxValue: number | null): string {
  if (minValue != null && maxValue != null) return `${formatEuro(minValue)} bis ${formatEuro(maxValue)}`;
  if (minValue != null) return `ab ${formatEuro(minValue)}`;
  if (maxValue != null) return `bis ${formatEuro(maxValue)}`;
  return '—';
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

function getRegionTargetLabels(payload: Record<string, unknown>): string[] {
  const raw = payload.region_targets;
  if (!Array.isArray(raw)) return [];
  const labels: string[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const target = entry as RegionTarget;
    const city = String(target.city ?? '').trim();
    const label = String(target.label ?? '').trim();
    const labelParts = label
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !isRadiusContextSegment(part));
    if (labelParts.length > 0) {
      labels.push(...labelParts);
      continue;
    }
    if (city && !isRadiusContextSegment(city)) labels.push(city);
  }
  return dedupe(labels);
}

function getRangeCenterOrtLabel(payload: Record<string, unknown>): string {
  const rangeCenter = (payload.range_center as Record<string, unknown> | null) ?? null;
  return getPayloadText(rangeCenter ?? {}, ['ort', 'city']) || getPayloadText(payload, ['region', 'city', 'ort']);
}

function getRangeCenterFullLabel(payload: Record<string, unknown>): string {
  const rangeCenter = (payload.range_center as Record<string, unknown> | null) ?? null;
  const ort = getPayloadText(rangeCenter ?? {}, ['ort', 'city']) || getPayloadText(payload, ['region', 'city', 'ort']);
  const plz = getPayloadText(rangeCenter ?? {}, ['plz', 'zip_code', 'postal_code'])
    || getPayloadText(payload, ['zip_code', 'postal_code', 'plz']);
  return [ort, plz].filter(Boolean).join(' ');
}

function getTargetRegionLabel(payload: Record<string, unknown>): string {
  const regionLabels = getRegionTargetLabels(payload);
  if (regionLabels.length > 0) return regionLabels.join(', ');
  return getRangeCenterFullLabel(payload) || '—';
}

function getRadiusContextLabel(payload: Record<string, unknown>): string {
  const radius = asNumber(payload.radius_km);
  if (radius == null) return '—';
  const ort = getRangeCenterOrtLabel(payload);
  return ort ? `Umkreis ${radius} km um ${ort}` : `${radius} km`;
}

function getCompactLocationLabel(payload: Record<string, unknown>): string {
  return getTargetRegionLabel(payload);
}

function buildDefaultForm(row: RawRequestRow, override?: OverrideRow | null): OverrideRow {
  return {
    partner_id: row.partner_id,
    source: row.provider,
    external_id: row.external_id,
    seo_title: override?.seo_title ?? override?.seo_h1 ?? '',
    seo_description: override?.seo_description ?? '',
    seo_h1: override?.seo_h1 ?? override?.seo_title ?? '',
    short_description: override?.short_description ?? override?.long_description ?? '',
    long_description: override?.long_description ?? override?.short_description ?? '',
    location_text: override?.location_text ?? null,
    features_text: override?.features_text ?? null,
    highlights: override?.highlights ?? [],
    image_alt_texts: override?.image_alt_texts ?? [],
    request_image_catalog_id: override?.request_image_catalog_id ?? null,
    status: override?.status ?? 'draft',
  };
}

function isRequestReadyForPublish(value: OverrideRow | null | undefined): boolean {
  if (!value) return false;
  const title = asText(value.seo_h1) || asText(value.seo_title);
  const description = asText(value.long_description) || asText(value.short_description);
  return Boolean(title && description);
}

export default function RequestsWorkspaceManager(props: Props) {
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

  const [status, setStatus] = useState('Lade Gesuche...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [rows, setRows] = useState<RawRequestRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<OverrideRow | null>(null);
  const [query, setQuery] = useState('');
  const [listFilter, setListFilter] = useState<RequestListFilter>('all');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('texts');
  const [imageInfoOpen, setImageInfoOpen] = useState(false);
  const [requestNoteInfoOpen, setRequestNoteInfoOpen] = useState(false);
  const [imageSelectionStatus, setImageSelectionStatus] = useState<string | null>(null);
  const [pendingRequestImageSelectionId, setPendingRequestImageSelectionId] = useState<string | null>(null);
  const [requestLoadSummary, setRequestLoadSummary] = useState<string | null>(null);
  const [requestLoadDebug, setRequestLoadDebug] = useState<RequestWorkspaceLoadDebug | null>(null);
  const [requestDebugOpen, setRequestDebugOpen] = useState(false);
  const [promptOpenMap, setPromptOpenMap] = useState<Record<string, boolean>>({});
  const [customPromptMap, setCustomPromptMap] = useState<Record<string, string>>({});
  const [llmOptions, setLlmOptions] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState('');
  const [llmOptionsLoading, setLlmOptionsLoading] = useState(false);
  const [llmOptionsLoaded, setLlmOptionsLoaded] = useState(false);
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
      setStatus('Lade Gesuche...');
      setRequestLoadSummary(null);
      setRequestLoadDebug(null);
      const res = await fetch('/api/partner/crm-assets/workspace?kind=requests', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => null) as {
        rows?: RawRequestRow[];
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
      setStatus('');
      setRequestLoadSummary(`${nextRows.length} Gesuche geladen`);
      setRequestLoadDebug({
        requests: nextRows.length,
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
      const objectType = getPayloadText(payload, ['object_type']).toLowerCase();
      if (listFilter !== 'all' && objectType !== listFilter) return false;
      const regions = getRegionTargetLabels(payload).join(' ');
      const description = getPayloadText(payload, ['description', 'short_description', 'long_description', 'title']);
      const haystack = `${row.title ?? ''} ${row.external_id} ${row.provider} ${regions} ${description}`.toLowerCase();
      if (!term) return true;
      return haystack.includes(term);
    });
  }, [listFilter, rows, query]);

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
  }, [selectedOverride, selectedRow]);

  useEffect(() => {
    setImageSelectionStatus(null);
  }, [selectedId]);

  async function saveOverride(nextForm?: OverrideRow) {
    const payload = nextForm ?? form;
    if (!payload) return;
    setSaving(true);
    setStatus('Speichere Gesuch-Overrides...');
    setImageSelectionStatus(null);
    const normalizedTitle = String(payload.seo_h1 ?? payload.seo_title ?? '').trim();
    const normalizedDescription = String(
      payload.long_description
      ?? payload.short_description
      ?? payload.seo_description
      ?? '',
    ).trim();
    const normalizedSeoTitle = String(payload.seo_title ?? '').trim() || normalizedTitle;
    const normalizedSeoDescription = String(payload.seo_description ?? '').trim() || normalizedDescription;
    const normalizedRequestImageCatalogId = asText(payload.request_image_catalog_id);
    const nextStatus = normalizedTitle && normalizedDescription ? 'approved' : 'draft';
    const upsertPayload: Record<string, unknown> = {
      ...payload,
      seo_title: normalizedSeoTitle,
      seo_h1: normalizedTitle,
      seo_description: normalizedSeoDescription,
      short_description: normalizedDescription,
      long_description: normalizedDescription,
      highlights: payload.highlights ?? [],
      image_alt_texts: payload.image_alt_texts ?? [],
      status: nextStatus,
      last_updated: new Date().toISOString(),
    };
    if (normalizedRequestImageCatalogId) {
      upsertPayload.request_image_catalog_id = normalizedRequestImageCatalogId;
    } else if (selectedOverride?.request_image_catalog_id) {
      upsertPayload.request_image_catalog_id = null;
    } else {
      delete upsertPayload.request_image_catalog_id;
    }

    async function executeUpsert(candidatePayload: Record<string, unknown>) {
      return supabase
        .from('partner_request_overrides')
        .upsert(candidatePayload, { onConflict: 'partner_id,source,external_id' })
        .select('*')
        .single();
    }

    let { data, error } = await executeUpsert(upsertPayload);
    if (error && String(error.message || '').includes('request_image_catalog_id')) {
      delete upsertPayload.request_image_catalog_id;
      ({ data, error } = await executeUpsert(upsertPayload));
      if (!error) {
        setStatus('');
        setImageSelectionStatus('Die alternative Bildauswahl benötigt noch den SQL-Rollout für request_image_catalog_id.');
      }
    }
    if (error) {
      setStatus(`Speichern fehlgeschlagen (partner_request_overrides): ${error.message}`);
      setImageSelectionStatus(`Bildauswahl konnte nicht gespeichert werden: ${error.message}`);
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
    const rebuildRes = await fetch('/api/partner/public-projections/requests/rebuild', {
      method: 'POST',
    });
    if (!rebuildRes.ok) {
      setStatus('Gesuch-Overrides gespeichert, aber die öffentliche Projektion konnte nicht aktualisiert werden.');
      setSaving(false);
      return;
    }
    setStatus('');
    setSaving(false);
  }

  async function runAiRewrite(key: keyof OverrideRow, label: string, promptOverride?: string) {
    if (!form || !selectedRow) return;
    const currentText = String(form[key] ?? '').trim();
    const generationSeed =
      currentText ||
      '[Kein bestehender Text vorhanden. Bitte den Inhalt ausschließlich aus Suchkriterien, CRM-Notiz und Promptkontext neu erzeugen.]';
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
          text: generationSeed,
          areaName: selectedRow.title || selectedRow.external_id,
          type: 'general',
          sectionLabel: label,
          customPrompt: promptOverride || undefined,
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
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'KI-Optimierung fehlgeschlagen.');
    } finally {
      setRewritingKey(null);
    }
  }

  function updateField(key: keyof OverrideRow, value: string | string[]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function getStandardPromptText(label: string, areaName: string, factsContext: string, noteContext: string) {
    const lowerLabel = String(label || '').toLowerCase();
    const promptContext = [
      `Kontext: ${areaName}.`,
      `Harte Suchkriterien: ${factsContext || 'Keine strukturierten Kriterien verfügbar.'}`,
      `Weiche Informationen aus CRM-Notiz/Bemerkung: ${noteContext || 'Keine CRM-Notiz vorhanden.'}`,
    ].join(' ');
    if (lowerLabel.includes('gesuch-titel') || lowerLabel.includes('h1')) {
      return `Erstelle einen prägnanten Gesuch-Titel aus den strukturierten Suchkriterien und der CRM-Notiz. Nutze vorrangig Vermarktungsart, Objektart und Zielregion. Integriere weiche Anforderungen aus der Notiz nur, wenn sie konkret und relevant sind. Kein Clickbait, keine Maklerfloskeln, keine erfundenen Fakten, maximal 60 Zeichen. ${promptContext}`;
    }
    if (lowerLabel.includes('seo-titel')) {
      return `Schreibe einen SEO-Titel für ein Immobiliengesuch auf Basis der harten Suchkriterien und der CRM-Notiz. Nutze die wichtigsten Kriterien klar lesbar, ohne Keyword-Stapelung, ohne Übertreibung und ohne neue Fakten. Maximal 60 Zeichen. ${promptContext}`;
    }
    if (lowerLabel.includes('seo-description')) {
      return `Schreibe eine SEO-Description für ein Immobiliengesuch aus zwei Quellen: 1. harte Suchkriterien wie Vermarktungsart, Objektart, Region, Budget, Zimmer, Fläche, Radius; 2. weiche Informationen aus der CRM-Notiz. Verbinde beides zu einem klaren, glaubwürdigen Snippet. 140 bis 160 Zeichen, keine Maklerfloskeln, keine erfundenen Fakten. ${promptContext}`;
    }
    if (lowerLabel.includes('beschreibung')) {
      return `Formuliere eine hochwertige Gesuchsbeschreibung aus zwei Quellen: 1. harte Suchkriterien wie Vermarktungsart, Objektart, Region, Budget, Zimmer, Fläche und Radius; 2. weiche Informationen aus der CRM-Notiz. Verbinde beides zu einem klaren, sachlichen Fließtext. Keine neuen Fakten erfinden, keine Wiederholungen, keine Maklerfloskeln. Wenn die Notiz leer oder unbrauchbar ist, arbeite nur mit den harten Kriterien. ${promptContext}`;
    }
    return `Optimiere den Text für bessere Lesbarkeit, fachliche Klarheit und saubere Suchmaschinen-/Antwortsystem-Nutzung. Nutze harte Suchkriterien und die CRM-Notiz, ohne neue Fakten hinzuzufügen. ${promptContext}`;
  }

  const renderTextField = (
    label: string,
    key: keyof OverrideRow,
    options?: {
      multiline?: boolean;
      placeholder?: string;
    },
  ) => {
    if (!form) return null;
    const keyName = String(key);
    const value = String(form[key] ?? '');
    const isRewriting = rewritingKey === keyName;
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(
      label,
      selectedRow?.title || selectedRow?.external_id || 'Gesuch',
      selectedFactsPromptText,
      selectedNote,
    );
    const effectivePrompt = customPrompt.trim() || standardPrompt;
    return (
      <div className={workspaceStyles.workspaceFieldSubtle}>
        <div className={workspaceStyles.workspaceFieldHeader}>
          <h4 className={workspaceStyles.workspaceFieldTitle}>{label}</h4>
        </div>
        <div style={editorSingleColumnStyle}>
          <div className={workspaceStyles.workspaceFieldStack}>
            {options?.multiline === false ? (
              <input
                value={value}
                onChange={(event) => updateField(key, event.target.value)}
                className={`${workspaceStyles.workspaceFieldControl} ${workspaceStyles.workspaceFieldInput} ${workspaceStyles.workspaceFieldTextareaCompact}`}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            ) : (
              <textarea
                value={value}
                onChange={(event) => updateField(key, event.target.value)}
                className={`${workspaceStyles.workspaceFieldControl} ${workspaceStyles.workspaceFieldTextarea} ${workspaceStyles.workspaceFieldTextareaCompact}`}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            )}
            <div className={workspaceStyles.workspaceAiActions}>
              <button
                type="button"
                className={`${workspaceStyles.workspaceAiButton} ${
                  isRewriting ? workspaceStyles.workspaceAiButtonLoading : ''
                }`}
                onClick={() => void runAiRewrite(key, label, effectivePrompt)}
                disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
              </button>
              <button
                type="button"
                onClick={() => setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
                className={workspaceStyles.workspacePromptButton}
              >
                {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
              </button>
            </div>
            {showPrompt ? (
              <div className={workspaceStyles.workspacePromptPanel}>
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
        </div>
      </div>
    );
  };

  const selectedType = getPayloadText(selectedPayload, ['object_type']) || '—';
  const selectedMode = getPayloadText(selectedPayload, ['request_type']) || '—';
  const selectedMarketing = selectedMode;
  const selectedRoomsMin = asNumber(selectedPayload.min_rooms);
  const selectedRoomsMax = asNumber(selectedPayload.max_rooms);
  const selectedAreaMin = asNumber(selectedPayload.min_area_sqm) ?? asNumber(selectedPayload.min_living_area_sqm);
  const selectedAreaMax = asNumber(selectedPayload.max_area_sqm) ?? asNumber(selectedPayload.max_living_area_sqm);
  const selectedBudgetMin = asNumber(selectedPayload.min_price);
  const selectedBudget = asNumber(selectedPayload.max_price) ?? asNumber(selectedPayload.max_purchase_price) ?? asNumber(selectedPayload.max_rent);
  const selectedLocation = getTargetRegionLabel(selectedPayload);
  const selectedUpdatedAt = selectedRow?.source_updated_at ?? selectedRow?.updated_at ?? null;
  const selectedRadius = asNumber(selectedPayload.radius_km);
  const selectedSubtypes = getPayloadList(selectedPayload, 'object_subtypes');
  const selectedNote = getPayloadText(selectedPayload, ['publicnote', 'note', 'description']);
  const selectedBudgetLabel = formatBudgetRange(selectedBudgetMin, selectedBudget);
  const selectedRoomsLabel =
    selectedRoomsMin != null || selectedRoomsMax != null
      ? `${selectedRoomsMin ?? '—'} bis ${selectedRoomsMax ?? '—'}`
      : '—';
  const selectedAreaLabel =
    selectedAreaMin != null || selectedAreaMax != null
      ? `${selectedAreaMin ?? '—'} bis ${selectedAreaMax ?? '—'} m²`
      : '—';
  const selectedRadiusLabel = getRadiusContextLabel(selectedPayload);
  const selectedSubtypeLabel = getPayloadText(selectedPayload, ['object_subtype']) || selectedSubtypes.join(', ') || '—';
  const selectedMarketingDisplay = formatRequestModeLabel(selectedMarketing);
  const selectedTypeDisplay = selectedType === '—' ? '—' : formatRequestObjectTypeLabel(selectedType);
  const selectedSubtypeDisplay = selectedSubtypeLabel === '—'
    ? '—'
    : selectedSubtypeLabel
      .split(',')
      .map((value) => formatRequestSubtypeLabel(value.trim()))
      .filter(Boolean)
      .join(', ');
  const selectedFactsPromptText = [
    `Vermarktung: ${selectedMarketingDisplay}`,
    `Objektart: ${selectedTypeDisplay}`,
    `Objekt-Untertyp: ${selectedSubtypeDisplay}`,
    `Budget: ${selectedBudgetLabel}`,
    `Fläche: ${selectedAreaLabel}`,
    `Zimmer: ${selectedRoomsLabel}`,
    `Radius: ${selectedRadiusLabel}`,
    `Zielregionen: ${selectedLocation}`,
  ].join(' | ');
  const selectedImageMatch = useMemo(
    () =>
      matchRequestImage({
        requestType: selectedMode === '—' ? null : selectedMode,
        objectType: selectedType === '—' ? null : selectedType,
        objectSubtype: selectedSubtypeLabel === '—' ? null : selectedSubtypeLabel,
        minRooms: selectedRoomsMin,
        maxRooms: selectedRoomsMax,
        minAreaSqm: selectedAreaMin,
        maxAreaSqm: selectedAreaMax,
        maxPrice: selectedBudget,
        radiusKm: selectedRadius,
        regionLabels: selectedLocation === '—' ? [] : selectedLocation.split(',').map((value) => value.trim()).filter(Boolean),
        textContexts: [selectedRow?.title ?? '', selectedNote],
      }),
    [
      selectedAreaMax,
      selectedAreaMin,
      selectedBudget,
      selectedLocation,
      selectedMode,
      selectedNote,
      selectedRadius,
      selectedRoomsMax,
      selectedRoomsMin,
      selectedRow?.title,
      selectedSubtypeLabel,
      selectedType,
    ],
  );
  const requestImageCatalog = useMemo(() => getRequestImageCatalog(), []);
  const readyRequestImageChoices = useMemo(
    () => requestImageCatalog.items.filter((item) => item.active && item.asset_status === 'ready'),
    [requestImageCatalog],
  );
  const selectedRequestImageOverrideId = asText(form?.request_image_catalog_id);
  const selectedRequestImageOverride = useMemo(
    () => readyRequestImageChoices.find((item) => item.id === selectedRequestImageOverrideId) ?? null,
    [readyRequestImageChoices, selectedRequestImageOverrideId],
  );
  useEffect(() => {
    setPendingRequestImageSelectionId(selectedRequestImageOverrideId || null);
  }, [selectedRequestImageOverrideId, selectedId]);

  const pendingRequestImageOverride = useMemo(
    () => readyRequestImageChoices.find((item) => item.id === pendingRequestImageSelectionId) ?? null,
    [pendingRequestImageSelectionId, readyRequestImageChoices],
  );
  const effectiveRequestImagePreview = pendingRequestImageOverride
    ? {
        imageUrl: pendingRequestImageOverride.image_url,
        alt: pendingRequestImageOverride.alt_template,
        title: pendingRequestImageOverride.title,
      }
    : selectedRequestImageOverride
    ? {
        imageUrl: selectedRequestImageOverride.image_url,
        alt: selectedRequestImageOverride.alt_template,
        title: selectedRequestImageOverride.title,
      }
    : selectedImageMatch.primary;
  const hasPendingManualImageSelection = Boolean(pendingRequestImageSelectionId);
  const currentRequestTitle = asText(form?.seo_h1) || asText(form?.seo_title);
  const currentRequestDescription = asText(form?.long_description) || asText(form?.short_description);
  const canSaveRequest = Boolean(currentRequestTitle && currentRequestDescription);

  async function applyRequestImageSelection(catalogId: string | null) {
    if (!form) return;
    const next = { ...form, request_image_catalog_id: catalogId };
    setForm(next);
    await saveOverride(next);
  }

  async function resetRequestTextOverrides() {
    if (!form) return;
    const next: OverrideRow = {
      ...form,
      seo_title: '',
      seo_description: '',
      seo_h1: '',
      short_description: '',
      long_description: '',
      location_text: null,
      features_text: null,
      highlights: [],
      image_alt_texts: [],
      status: 'draft',
    };
    setForm(next);
    await saveOverride(next);
  }

  if (loading) return <FullscreenLoader show label="Gesuche werden geladen..." />;

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {visibilityConfig ? (
        <section className={workspaceStyles.workspaceControlShell}>
          <div className={workspaceStyles.workspaceControlCard}>
            <div className={workspaceStyles.workspaceControlRow}>
              <label className={`${workspaceStyles.workspaceControlGroup} ${workspaceStyles.workspaceControlGroupWide}`}>
                <span className={workspaceStyles.workspaceControlSelectWrap}>
                  <select
                    value={visibilityMode}
                    onChange={(event) => void onVisibilityModeChange?.(event.target.value as VisibilityMode)}
                    disabled={visibilityBusy}
                    className={`${workspaceStyles.workspaceControlSelect} ${workspaceStyles.workspaceControlSelectWide}`}
                  >
                    <option value="partner_wide">Regionale Ausspielung für Gesuche partnerweit (zeigt alle Gesuche des Partners im Gebiet)</option>
                    <option value="strict_local">Regionale Ausspielung für Gesuche nur lokal (nutzt nur lokal gematchte Gesuche)</option>
                  </select>
                  <span className={workspaceStyles.workspaceControlChevron} aria-hidden="true">▾</span>
                </span>
              </label>
              <div className={`${workspaceStyles.workspaceControlGroup} ${workspaceStyles.workspaceControlGroupModel}`}>
                {llmOptions.length > 0 || !llmOptionsLoaded ? (
                  <span className={workspaceStyles.workspaceControlSelectWrap}>
                    <select
                      value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
                      onChange={(event) => setSelectedLlmIntegrationId(event.target.value)}
                      className={`${workspaceStyles.workspaceControlSelect} ${workspaceStyles.workspaceControlSelectModel}`}
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
                    <span className={workspaceStyles.workspaceControlChevron} aria-hidden="true">▾</span>
                  </span>
                ) : (
                  <span className={workspaceStyles.workspaceControlMissingHint}>Keine aktive LLM-Integration</span>
                )}
              </div>
            </div>
            {visibilityMessage ? (
              <div
                className={`${workspaceStyles.workspaceControlMessage} ${
                  visibilityTone === 'success'
                    ? workspaceStyles.workspaceControlMessageSuccess
                    : visibilityTone === 'error'
                      ? workspaceStyles.workspaceControlMessageError
                      : workspaceStyles.workspaceControlMessageInfo
                }`}
              >
                {visibilityMessage}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: '20px' }}>
        <section style={panelStyle}>
          <div className={workspaceStyles.workspaceListHeader}>
            <h3 className={workspaceStyles.workspaceListTitle}>{requestLoadSummary ?? '0 Gesuche geladen'}</h3>
            <button
              type="button"
              className={workspaceStyles.workspaceListInfoButton}
              onClick={() => setRequestDebugOpen(true)}
              disabled={!requestLoadDebug}
              aria-label="Debug-Informationen anzeigen"
            >
              i
            </button>
          </div>
          <input
            placeholder="Suchen..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={workspaceStyles.workspaceSearchInput}
          />
          <div className={workspaceStyles.workspaceFilterBar}>
            <button
              type="button"
              onClick={() => setListFilter('all')}
              className={`${workspaceStyles.workspaceFilterButton} ${
                listFilter === 'all' ? workspaceStyles.workspaceFilterButtonActive : ''
              }`}
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => setListFilter('haus')}
              className={`${workspaceStyles.workspaceFilterButton} ${
                listFilter === 'haus' ? workspaceStyles.workspaceFilterButtonActive : ''
              }`}
            >
              Haus
            </button>
            <button
              type="button"
              onClick={() => setListFilter('wohnung')}
              className={`${workspaceStyles.workspaceFilterButton} ${
                listFilter === 'wohnung' ? workspaceStyles.workspaceFilterButtonActive : ''
              }`}
            >
              Wohnung
            </button>
          </div>
          <div
            className={workspaceStyles.workspaceList}
            style={{
              gap: REQUEST_LIST_ROW_GAP,
              maxHeight: REQUEST_LIST_VISIBLE_ROWS * REQUEST_LIST_ROW_HEIGHT + (REQUEST_LIST_VISIBLE_ROWS - 1) * REQUEST_LIST_ROW_GAP,
            }}
          >
            {filteredRows.map((row) => {
              const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
              const rowOverride = overrides.find(
                (entry) =>
                  entry.partner_id === row.partner_id &&
                  entry.source === row.provider &&
                  entry.external_id === row.external_id,
              ) ?? null;
              const rowIsReady = isRequestReadyForPublish(rowOverride);
              const locationLabel = getCompactLocationLabel(payload);
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`${workspaceStyles.workspaceListItem} ${workspaceStyles.workspaceListItemPlain} ${
                    selectedId === row.id ? workspaceStyles.workspaceListItemActive : ''
                  }`}
                >
                  <span className={workspaceStyles.workspaceListItemTitle}>{row.title || 'Gesuch'}</span>
                  <span className={workspaceStyles.workspaceListItemMeta}>
                    {`${formatRequestModeLabel(getPayloadText(payload, ['request_type']) || '—')} · ${formatRequestObjectTypeLabel(getPayloadText(payload, ['object_type']) || null)} · ${locationLabel !== '—' ? locationLabel : row.external_id}`}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`${workspaceStyles.workspaceStatusDot} ${workspaceStyles.workspaceListStatusDot} ${
                      rowIsReady ? workspaceStyles.workspaceStatusDotReady : workspaceStyles.workspaceStatusDotBlocked
                    }`}
                  />
                </button>
              );
            })}
            {filteredRows.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>Keine Gesuche gefunden.</div>
            ) : null}
          </div>
        </section>

        <section style={panelStyle}>
          {status ? <p style={{ marginTop: 0, marginBottom: 10, fontSize: 12, color: '#b91c1c' }}>{status}</p> : null}
          {!form || !selectedRow ? (
            <div style={{ color: '#94a3b8' }}>Kein Gesuch ausgewählt.</div>
          ) : (
            <>
              {(() => {
                const isReady = isRequestReadyForPublish(selectedOverride);
                return (
                  <>
                    <div className={workspaceStyles.workspaceOverviewCard}>
                      <div className={workspaceStyles.workspaceOverviewHeader}>
                        <div className={workspaceStyles.workspaceOverviewTitle}>Überblick</div>
                        <div
                          className={`${workspaceStyles.workspaceStatusBadge} ${
                            isReady
                              ? workspaceStyles.workspaceStatusBadgeReady
                              : workspaceStyles.workspaceStatusBadgeBlocked
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`${workspaceStyles.workspaceStatusDot} ${
                              isReady
                                ? workspaceStyles.workspaceStatusDotReady
                                : workspaceStyles.workspaceStatusDotBlocked
                            }`}
                          />
                          <span>{isReady ? 'Onlinefertig' : 'Nicht onlinefähig'}</span>
                        </div>
                      </div>
                      <div className={workspaceStyles.workspaceOverviewGrid}>
                        <div>
                          <div className={workspaceStyles.workspaceMetaLabel}>Gesuch-ID</div>
                          <div className={workspaceStyles.workspaceMetaValue}>{selectedRow.id}</div>
                        </div>
                        <div>
                          <div className={workspaceStyles.workspaceMetaLabel}>Quelle</div>
                          <div className={workspaceStyles.workspaceMetaValue}>{selectedRow.provider} · {selectedRow.external_id}</div>
                        </div>
                        <div>
                          <div className={workspaceStyles.workspaceMetaLabel}>Aktualisiert</div>
                          <div className={workspaceStyles.workspaceMetaValue}>{formatDateLabel(selectedUpdatedAt)}</div>
                        </div>
                      </div>
                    </div>

                    <div className={workspaceStyles.workspaceTabs}>
                      <button type="button" onClick={() => setActiveTab('texts')} className={workspaceTabClassName(activeTab === 'texts')}>
                        Texte
                      </button>
                      <button type="button" onClick={() => setActiveTab('seo')} className={workspaceTabClassName(activeTab === 'seo')}>
                        SEO / GEO
                      </button>
                      <button type="button" onClick={() => setActiveTab('criteria')} className={workspaceTabClassName(activeTab === 'criteria')}>
                        Suchkriterien
                      </button>
                    </div>

                    {activeTab === 'criteria' ? (
                      <div style={workspaceSectionStyle}>
                        <div style={offerSummaryTopCardStyle}>
                          <div style={offerSummaryHeaderStyle}>Suchkriterien</div>
                          <div style={offerSummaryGridStyle}>
                            <div>
                              <div style={offerSummaryLabelStyle}>Vermarktung</div>
                              <div style={offerSummaryValueStyle}>{selectedMarketingDisplay}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Objektart</div>
                              <div style={offerSummaryValueStyle}>{selectedTypeDisplay}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Objekt-Untertyp</div>
                              <div style={offerSummaryValueStyle}>{selectedSubtypeDisplay}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Budget</div>
                              <div style={offerSummaryValueStyle}>{selectedBudgetLabel}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Fläche</div>
                              <div style={offerSummaryValueStyle}>{selectedAreaLabel}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Zimmer</div>
                              <div style={offerSummaryValueStyle}>{selectedRoomsLabel}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Umkreis</div>
                              <div style={offerSummaryValueStyle}>{selectedRadiusLabel}</div>
                            </div>
                            <div>
                              <div style={offerSummaryLabelStyle}>Zielregionen</div>
                              <div style={offerSummaryValueStyle}>{selectedLocation}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeTab === 'texts' || activeTab === 'seo' ? (
                      <div style={workspaceSectionStyle}>
                        <div style={onlineCreateGridStyle}>
                          <div style={requestTextEditBlockStyle}>
                            <div style={offerSummaryHeaderStyle}>Online-Gesuch erstellen</div>
                            <div style={requestNoteHeadingRowStyle}>
                              <div style={requestNoteHeadingStyle}>CRM-Notiz</div>
                              <button
                                type="button"
                                onClick={() => setRequestNoteInfoOpen(true)}
                                style={requestNoteInfoButtonStyle}
                                aria-label="Information zur CRM-Notiz anzeigen"
                              >
                                i
                              </button>
                            </div>
                            <div style={textSourceNoteCardStyle}>
                              <div style={requestNoteBodyStyle}>
                                {selectedNote || 'Keine CRM-Notiz vorhanden.'}
                              </div>
                            </div>
                            {activeTab === 'texts' ? (
                              <div style={requestEditorFieldsGridStyle}>
                                {renderTextField('Gesuch-Titel', 'seo_h1', {
                                  multiline: false,
                                  placeholder: 'Titel wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                                })}
                                {renderTextField('Beschreibung', 'long_description', {
                                  multiline: true,
                                  placeholder: 'Beschreibung wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                                })}
                              </div>
                            ) : null}
                            {activeTab === 'seo' ? (
                              <div style={requestEditorFieldsGridStyle}>
                                {renderTextField('SEO‑Titel', 'seo_title', {
                                  multiline: false,
                                  placeholder: 'SEO-Titel wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                                })}
                                {renderTextField('SEO‑Description', 'seo_description', {
                                  multiline: true,
                                  placeholder: 'SEO-Description wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                                })}
                                <div style={previewCardStyle}>
                                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                                    SEO‑Vorschau
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '6px' }}>
                                    {form.seo_title || form.seo_h1 || selectedRow.title || 'SEO‑Titel'}
                                  </div>
                                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>
                                    {form.seo_description || form.long_description || 'SEO‑Description'}
                                  </div>
                                  <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px' }}>
                                    /immobiliengesuche/{form.external_id}_&lt;titel&gt;
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div style={offerSummaryTopCardStyle}>
                            <div style={cardHeaderRowStyle}>
                              <div style={offerSummaryHeaderStyle}>Motivwahl</div>
                              <button type="button" onClick={() => setImageInfoOpen(true)} style={infoLinkButtonStyle}>
                                Info
                              </button>
                            </div>
                            <div style={{ display: 'grid', gap: '10px' }}>
                              {effectiveRequestImagePreview?.imageUrl ? (
                                <div style={requestMatchPreviewWrapStyle}>
                                  <img
                                    src={effectiveRequestImagePreview.imageUrl}
                                    alt={effectiveRequestImagePreview.alt || effectiveRequestImagePreview.title}
                                    style={requestMatchPreviewImageStyle}
                                  />
                                </div>
                              ) : null}
                              <div style={{ display: 'grid', gap: '10px' }}>
                                <div style={offerSummaryLabelStyle}>Alternative Bildauswahl</div>
                                <div style={imageChoiceGridStyle}>
                                  {readyRequestImageChoices.map((item) => {
                                    const active = pendingRequestImageSelectionId === item.id;
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        style={imageChoiceCardStyle(active)}
                                        onClick={() => setPendingRequestImageSelectionId(item.id)}
                                      >
                                        <img
                                          src={item.thumbnail_url || item.image_url}
                                          alt={item.alt_template || item.title}
                                          style={imageChoiceImageStyle}
                                        />
                                        <span style={imageChoiceTitleStyle}>{item.title}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div style={imageChoiceActionsRowStyle}>
                                  <button
                                    type="button"
                                    style={imageChoicePrimaryButtonStyle(!hasPendingManualImageSelection || saving)}
                                    disabled={!hasPendingManualImageSelection || saving}
                                    onClick={() => void applyRequestImageSelection(pendingRequestImageSelectionId)}
                                  >
                                    Bild wählen
                                  </button>
                                  <button
                                    type="button"
                                    style={imageChoiceResetButtonStyle(!selectedRequestImageOverride && !pendingRequestImageSelectionId)}
                                    disabled={!selectedRequestImageOverride && !pendingRequestImageSelectionId}
                                    onClick={() => {
                                      setPendingRequestImageSelectionId(null);
                                      void applyRequestImageSelection(null);
                                    }}
                                  >
                                    Automatisches Matching
                                  </button>
                                </div>
                                {imageSelectionStatus ? (
                                  <div style={imageSelectionStatusStyle}>
                                    {imageSelectionStatus}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={requestSummaryBlockStyle}>
                          <div style={offerSummaryHeaderStyle}>Gesuch-Zusammenfassung vor Speichern</div>
                          <div style={requestSummaryGridStyle}>
                            <div style={{ display: 'grid', gap: '14px' }}>
                              <div style={contentPreviewCardStyle}>
                                <div style={contentPreviewLabelStyle}>Gesuch-Titel</div>
                                <div style={contentPreviewBodyStyle}>{currentRequestTitle || 'Kein Gesuch-Titel gepflegt.'}</div>
                              </div>
                              <div style={contentPreviewCardStyle}>
                                <div style={contentPreviewLabelStyle}>Beschreibung</div>
                                <div style={contentPreviewBodyStyle}>{currentRequestDescription || 'Keine Beschreibung gepflegt.'}</div>
                              </div>
                            </div>
                            <div style={contentPreviewCardStyle}>
                              <div style={contentPreviewLabelStyle}>Motiv</div>
                              {effectiveRequestImagePreview?.imageUrl ? (
                                <div style={{ display: 'grid', gap: '10px' }}>
                                  <div style={requestMatchPreviewWrapStyle}>
                                    <img
                                      src={effectiveRequestImagePreview.imageUrl}
                                      alt={effectiveRequestImagePreview.alt || effectiveRequestImagePreview.title}
                                      style={requestMatchPreviewImageStyle}
                                    />
                                  </div>
                                  <div style={contentPreviewBodyStyle}>{effectiveRequestImagePreview.title || 'Motiv gewählt'}</div>
                                </div>
                              ) : (
                                <div style={contentPreviewBodyStyle}>Kein Motiv gewählt.</div>
                              )}
                            </div>
                          </div>
                          <div style={requestActionButtonRowStyle}>
                            <button onClick={() => void saveOverride()} disabled={saving || !canSaveRequest} style={primaryButtonStyle(saving || !canSaveRequest)}>
                              {saving ? 'Speichern...' : 'Gesuchetexte speichern'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void resetRequestTextOverrides()}
                              disabled={saving || (!currentRequestTitle && !currentRequestDescription)}
                              style={secondaryActionButtonStyle(saving || (!currentRequestTitle && !currentRequestDescription))}
                            >
                              Gesuchetexte zurücksetzen
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}

            </>
          )}
        </section>
      </div>
      {requestDebugOpen && requestLoadDebug ? (
        <div
          style={modalOverlayStyle}
          onClick={() => setRequestDebugOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setRequestDebugOpen(false);
          }}
        >
          <div
            style={workspaceDebugModalCardStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-workspace-debug-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div style={cardHeaderRowStyle}>
              <div id="request-workspace-debug-title" style={offerSummaryHeaderStyle}>Gesuche Debug</div>
              <button
                type="button"
                onClick={() => setRequestDebugOpen(false)}
                style={modalCloseButtonStyle}
                aria-label="Debug-Modal schließen"
              >
                Schließen
              </button>
            </div>
            <div style={workspaceDebugModalBodyStyle}>
              <div>requests={requestLoadDebug.requests}</div>
              <div>overrides={requestLoadDebug.overrides}</div>
            </div>
          </div>
        </div>
      ) : null}
      {imageInfoOpen ? (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalCardStyle}>
            <div style={cardHeaderRowStyle}>
              <div style={offerSummaryHeaderStyle}>Matching-Info</div>
              <button type="button" onClick={() => setImageInfoOpen(false)} style={modalCloseButtonStyle}>
                Schließen
              </button>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div style={offerSummaryLabelStyle}>Erkannte Persona</div>
                <div style={offerSummaryValueStyle}>{selectedImageMatch.profile.persona.join(', ') || '—'}</div>
              </div>
              <div>
                <div style={offerSummaryLabelStyle}>Umfeld</div>
                <div style={offerSummaryValueStyle}>{selectedImageMatch.profile.environment.join(', ') || '—'}</div>
              </div>
              <div>
                <div style={offerSummaryLabelStyle}>Signale</div>
                <div style={offerSummaryValueStyle}>{selectedImageMatch.profile.signals.slice(0, 6).join(', ') || '—'}</div>
              </div>
              <div>
                <div style={offerSummaryLabelStyle}>Gematchtes Motiv</div>
                <div style={offerSummaryValueStyle}>
                  {selectedImageMatch.primary
                    ? `${selectedImageMatch.primary.title} (${selectedImageMatch.primary.score})`
                    : 'Kein Motiv gefunden'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {requestNoteInfoOpen ? (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalCardStyle}>
            <div style={cardHeaderRowStyle}>
              <div style={offerSummaryHeaderStyle}>CRM-Notiz</div>
              <button type="button" onClick={() => setRequestNoteInfoOpen(false)} style={modalCloseButtonStyle}>
                Schließen
              </button>
            </div>
            <div style={requestNoteInfoTextStyle}>
              Die CRM-Notiz und die Suchkriterien dienen der KI als Basis für die Formulierung von Titel und Beschreibung des Gesuchs.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const panelStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  background: '#fff',
  padding: '16px',
};

const editorSingleColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
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

const primaryButtonStyle = (disabled = false): CSSProperties => ({
  padding: '10px 14px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: disabled ? '#94a3b8' : '#0f172a',
  color: '#fff',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const secondaryActionButtonStyle = (disabled = false): CSSProperties => ({
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#334155',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.65 : 1,
});

const requestActionButtonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
};

const previewCardStyle: CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px',
  marginBottom: '16px',
};

const requestSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
  gap: '16px',
  marginBottom: '16px',
};

const contentPreviewCardStyle: CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '14px',
};

const contentPreviewLabelStyle: CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748b',
  fontWeight: 700,
  marginBottom: '8px',
};

const contentPreviewBodyStyle: CSSProperties = {
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
};

const onlineCreateGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
  gap: '14px',
};

const requestTextEditBlockStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const requestEditorFieldsGridStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const requestSummaryBlockStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const offerSummaryTopCardStyle: CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '14px',
};

const workspaceSectionStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginBottom: '18px',
};

const cardHeaderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '10px',
};

const offerSummaryHeaderStyle: CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748b',
  fontWeight: 700,
  marginBottom: '10px',
};

const offerSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '12px',
};

const offerSummaryLabelStyle: CSSProperties = {
  fontSize: '10px',
  color: '#94a3b8',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: '4px',
};

const offerSummaryValueStyle: CSSProperties = {
  fontSize: '13px',
  color: '#0f172a',
  fontWeight: 600,
  lineHeight: 1.45,
};

const requestNoteBodyStyle: CSSProperties = {
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
};

const requestNoteHeadingStyle: CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748b',
  fontWeight: 700,
};

const requestNoteHeadingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '8px',
  marginBottom: '8px',
};

const requestNoteInfoButtonStyle: CSSProperties = {
  width: '20px',
  height: '20px',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#486b7a',
  fontSize: '12px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
};

const requestNoteInfoTextStyle: CSSProperties = {
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.55,
};

const requestMatchPreviewWrapStyle: CSSProperties = {
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid #cbd5e1',
  backgroundColor: '#e2e8f0',
};

const requestMatchPreviewImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '180px',
  objectFit: 'cover',
};

const imageChoiceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '10px',
};

const imageChoiceCardStyle = (active: boolean): CSSProperties => ({
  display: 'grid',
  gap: '8px',
  padding: '8px',
  borderRadius: '12px',
  border: `1px solid ${active ? '#0f766e' : '#cbd5e1'}`,
  backgroundColor: active ? '#ecfeff' : '#fff',
  cursor: 'pointer',
  textAlign: 'left',
});

const imageChoiceImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '88px',
  objectFit: 'cover',
  borderRadius: '8px',
  backgroundColor: '#e2e8f0',
};

const imageChoiceTitleStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#0f172a',
  lineHeight: 1.35,
};

const imageChoiceResetButtonStyle = (active: boolean): CSSProperties => ({
  padding: '9px 12px',
  borderRadius: '10px',
  border: `1px solid ${active ? '#0f766e' : '#cbd5e1'}`,
  backgroundColor: active ? '#ecfeff' : '#fff',
  color: '#0f172a',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  opacity: active ? 0.7 : 1,
});

const imageChoicePrimaryButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '9px 12px',
  borderRadius: '10px',
  border: '1px solid transparent',
  backgroundColor: disabled ? '#94a3b8' : '#486b7a',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const imageChoiceActionsRowStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};

const imageSelectionStatusStyle: CSSProperties = {
  borderRadius: '10px',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  padding: '10px 12px',
  fontSize: '12px',
  lineHeight: 1.45,
};

const infoLinkButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#486b7a',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 70,
};

const modalCardStyle: CSSProperties = {
  width: 'min(520px, 100%)',
  borderRadius: '16px',
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
  padding: '18px',
  display: 'grid',
  gap: '14px',
};

const modalCloseButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  color: '#334155',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const workspaceDebugModalCardStyle: CSSProperties = {
  width: 'min(340px, 100%)',
  borderRadius: '16px',
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
  padding: '18px',
  display: 'grid',
  gap: '14px',
};

const workspaceDebugModalBodyStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
};

const textSourceNoteCardStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  backgroundColor: '#f8fafc',
  padding: '10px 12px',
  marginBottom: '6px',
  display: 'grid',
  gap: '6px',
};
