'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import FullscreenLoader from '@/components/ui/FullscreenLoader';
import { matchRequestImage } from '@/lib/request-image-matching';
import { createClient } from '@/utils/supabase/client';

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

type RegionTarget = {
  city?: string;
  district?: string | null;
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
    const district = String(target.district ?? '').trim();
    const label = String(target.label ?? '').trim();
    const value = label || [city, district].filter(Boolean).join(' ');
    if (value) labels.push(value);
  }
  return labels;
}

function buildDefaultForm(row: RawRequestRow, override?: OverrideRow | null): OverrideRow {
  return {
    partner_id: row.partner_id,
    source: row.provider,
    external_id: row.external_id,
    seo_title: override?.seo_title ?? '',
    seo_description: override?.seo_description ?? '',
    seo_h1: override?.seo_h1 ?? '',
    short_description: override?.short_description ?? '',
    long_description: override?.long_description ?? '',
    location_text: override?.location_text ?? null,
    features_text: override?.features_text ?? null,
    highlights: override?.highlights ?? [],
    image_alt_texts: override?.image_alt_texts ?? [],
    status: override?.status ?? 'draft',
  };
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('texts');
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
      setRows(nextRows);
      setOverrides(Array.isArray(payload?.overrides) ? payload.overrides : []);
      setSelectedId(nextRows[0]?.id ?? null);
      setStatus('Gesuche geladen.');
      setLoading(false);
    }
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
      const regions = getRegionTargetLabels(payload).join(' ');
      const description = getPayloadText(payload, ['description', 'short_description', 'long_description', 'title']);
      const haystack = `${row.title ?? ''} ${row.external_id} ${row.provider} ${regions} ${description}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, query]);

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

  async function saveOverride(nextForm?: OverrideRow) {
    const payload = nextForm ?? form;
    if (!payload) return;
    setSaving(true);
    setStatus('Speichere Gesuch-Overrides...');
    const normalizedTitle = String(payload.seo_h1 ?? payload.seo_title ?? '').trim();
    const normalizedDescription = String(
      payload.long_description ?? payload.short_description ?? payload.seo_description ?? '',
    ).trim();
    const normalizedSeoTitle = String(payload.seo_title ?? '').trim() || normalizedTitle;
    const normalizedSeoDescription = String(payload.seo_description ?? '').trim() || normalizedDescription;
    const upsertPayload = {
      ...payload,
      seo_title: normalizedSeoTitle,
      seo_h1: normalizedTitle,
      seo_description: normalizedSeoDescription,
      short_description: normalizedDescription,
      long_description: normalizedDescription,
      highlights: payload.highlights ?? [],
      image_alt_texts: payload.image_alt_texts ?? [],
      last_updated: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('partner_request_overrides')
      .upsert(upsertPayload, { onConflict: 'partner_id,source,external_id' })
      .select('*')
      .single();
    if (error) {
      setStatus(`Speichern fehlgeschlagen (partner_request_overrides): ${error.message}`);
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
    setStatus('Gesuch-Overrides gespeichert.');
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
      <div style={fieldCardStyle}>
        <div style={fieldHeaderStyle}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>{label}</h4>
        </div>
        <div style={editorSingleColumnStyle}>
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
                onClick={() => void runAiRewrite(key, label, effectivePrompt)}
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
        </div>
      </div>
    );
  };

  const selectedType = getPayloadText(selectedPayload, ['object_type']) || '—';
  const selectedMode = getPayloadText(selectedPayload, ['request_type']) || '—';
  const selectedMarketing = getPayloadText(selectedPayload, ['marketing_type']) || '—';
  const selectedRoomsMin = asNumber(selectedPayload.min_rooms);
  const selectedRoomsMax = asNumber(selectedPayload.max_rooms);
  const selectedAreaMin = asNumber(selectedPayload.min_area_sqm) ?? asNumber(selectedPayload.min_living_area_sqm);
  const selectedAreaMax = asNumber(selectedPayload.max_area_sqm) ?? asNumber(selectedPayload.max_living_area_sqm);
  const selectedBudget = asNumber(selectedPayload.max_price) ?? asNumber(selectedPayload.max_purchase_price) ?? asNumber(selectedPayload.max_rent);
  const selectedLocation = getRegionTargetLabels(selectedPayload).join(', ') || getPayloadText(selectedPayload, ['region']) || '—';
  const selectedUpdatedAt = selectedRow?.source_updated_at ?? selectedRow?.updated_at ?? null;
  const selectedRadius = asNumber(selectedPayload.radius_km);
  const selectedSubtypes = getPayloadList(selectedPayload, 'object_subtypes');
  const selectedNote = getPayloadText(selectedPayload, ['publicnote', 'note', 'description']);
  const selectedBudgetLabel = formatEuro(selectedBudget);
  const selectedRoomsLabel =
    selectedRoomsMin != null || selectedRoomsMax != null
      ? `${selectedRoomsMin ?? '—'} bis ${selectedRoomsMax ?? '—'}`
      : '—';
  const selectedAreaLabel =
    selectedAreaMin != null || selectedAreaMax != null
      ? `${selectedAreaMin ?? '—'} bis ${selectedAreaMax ?? '—'} m²`
      : '—';
  const selectedRadiusLabel = selectedRadius != null ? `${selectedRadius} km` : '—';
  const selectedSubtypeLabel = getPayloadText(selectedPayload, ['object_subtype']) || selectedSubtypes.join(', ') || '—';
  const selectedFactsPromptText = [
    `Vermarktung: ${selectedMarketing}`,
    `Objektart: ${selectedType}`,
    `Objekt-Untertyp: ${selectedSubtypeLabel}`,
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

  if (loading) return <FullscreenLoader show label="Gesuche werden geladen..." />;

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {visibilityConfig ? (
        <section style={visibilityShellStyle}>
          <div style={visibilityCardStyle}>
            <div style={visibilityControlsRowStyle}>
              <label style={visibilityLabelStyle}>
                <span style={visibilitySelectWrapStyle}>
                  <select
                    value={visibilityMode}
                    onChange={(event) => void onVisibilityModeChange?.(event.target.value as VisibilityMode)}
                    disabled={visibilityBusy}
                    style={visibilitySelectStyle}
                  >
                    <option value="partner_wide">Regionale Ausspielung für Gesuche partnerweit (zeigt alle Gesuche des Partners im Gebiet)</option>
                    <option value="strict_local">Regionale Ausspielung für Gesuche nur lokal (nutzt nur lokal gematchte Gesuche)</option>
                  </select>
                  <span style={visibilitySelectChevronStyle} aria-hidden="true">▾</span>
                </span>
              </label>
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
            {visibilityMessage ? (
              <div style={visibilityMessageStyle(visibilityTone)}>{visibilityMessage}</div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: '20px' }}>
        <section style={panelStyle}>
          <h3 style={panelTitleStyle}>Gesuche</h3>
          <input
            placeholder="Suchen..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={inputStyle}
          />
          <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: '12px' }}>
            {filteredRows.map((row) => {
              const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
              const regionText = getRegionTargetLabels(payload).join(', ') || getPayloadText(payload, ['region']);
              const hasOverride = overrides.some(
                (entry) =>
                  entry.partner_id === row.partner_id &&
                  entry.source === row.provider &&
                  entry.external_id === row.external_id,
              );
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  style={offerRowStyle(selectedId === row.id)}
                >
                  <span style={{ fontWeight: 600 }}>{row.title || 'Gesuch'}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{regionText || row.external_id}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {getPayloadText(payload, ['request_type']) || '—'} · {getPayloadText(payload, ['object_type']) || '—'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>
                    {getPayloadText(payload, ['description', 'short_description', 'long_description']).slice(0, 120) || 'Keine Beschreibung'}
                  </span>
                  {hasOverride ? (
                    <span style={{ fontSize: '11px', color: '#486b7a', fontWeight: 600 }}>Override aktiv</span>
                  ) : null}
                </button>
              );
            })}
            {filteredRows.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>Keine Gesuche gefunden.</div>
            ) : null}
          </div>
        </section>

        <section style={panelStyle}>
          <p style={{ marginTop: 0, marginBottom: 10, fontSize: 12, color: '#334155' }}>{status}</p>
          {!form || !selectedRow ? (
            <div style={{ color: '#94a3b8' }}>Kein Gesuch ausgewählt.</div>
          ) : (
            <>
              <div style={offerSummaryTopWrapStyle}>
                <div style={offerSummaryTopCardStyle}>
                  <div style={offerSummaryHeaderStyle}>Übertragene Felder</div>
                  <div style={offerSummaryGridStyle}>
                    <div>
                      <div style={offerSummaryLabelStyle}>Gesuch-ID</div>
                      <div style={offerSummaryValueStyle}>{selectedRow.id}</div>
                    </div>
                    <div>
                      <div style={offerSummaryLabelStyle}>Quelle</div>
                      <div style={offerSummaryValueStyle}>{selectedRow.provider} · {selectedRow.external_id}</div>
                    </div>
                    <div>
                      <div style={offerSummaryLabelStyle}>Aktualisiert</div>
                      <div style={offerSummaryValueStyle}>{formatDateLabel(selectedUpdatedAt)}</div>
                    </div>
                    <div>
                      <div style={offerSummaryLabelStyle}>Vermarktung</div>
                      <div style={offerSummaryValueStyle}>{selectedMarketing}</div>
                    </div>
                    <div>
                      <div style={offerSummaryLabelStyle}>Objektart</div>
                      <div style={offerSummaryValueStyle}>{selectedType}</div>
                    </div>
                    <div>
                      <div style={offerSummaryLabelStyle}>Objekt-Untertyp</div>
                      <div style={offerSummaryValueStyle}>{selectedSubtypeLabel}</div>
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
                      <div style={offerSummaryLabelStyle}>Radius</div>
                      <div style={offerSummaryValueStyle}>{selectedRadiusLabel}</div>
                    </div>
                    <div>
                      <div style={offerSummaryLabelStyle}>Zielregionen</div>
                      <div style={offerSummaryValueStyle}>{selectedLocation}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={offerSummaryTopCardStyle}>
                    <div style={offerSummaryHeaderStyle}>CRM-Notiz</div>
                    <div style={mediaSectionHintStyle}>Weiche Anforderungen und Hinweise aus Bemerkung/Notiz des CRM.</div>
                    <div style={noteCardBodyStyle}>
                      {selectedNote || 'Keine CRM-Notiz vorhanden.'}
                    </div>
                  </div>
                  <div style={offerSummaryTopCardStyle}>
                    <div style={offerSummaryHeaderStyle}>Motiv-Match</div>
                    <div style={mediaSectionHintStyle}>Zentrale Motivlogik fuer Portalpartner und Netzwerkpartner auf Basis von Kriterien und Notizsignalen.</div>
                    <div style={{ display: 'grid', gap: '10px' }}>
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
                          {selectedImageMatch.primary ? `${selectedImageMatch.primary.title} (${selectedImageMatch.primary.score})` : 'Kein Motiv gefunden'}
                        </div>
                      </div>
                      <div>
                        <div style={offerSummaryLabelStyle}>Asset-Status</div>
                        <div style={offerSummaryValueStyle}>{selectedImageMatch.primary?.assetStatus ?? '—'}</div>
                      </div>
                      <div>
                        <div style={offerSummaryLabelStyle}>Letzter Bildprompt</div>
                        <div style={noteCardBodyStyle}>
                          {selectedImageMatch.primary?.lastPrompt || 'Kein Prompt hinterlegt.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={workspaceTabsRowStyle}>
                <button type="button" onClick={() => setActiveTab('texts')} style={workspaceTabStyle(activeTab === 'texts')}>
                  Texte
                </button>
                <button type="button" onClick={() => setActiveTab('seo')} style={workspaceTabStyle(activeTab === 'seo')}>
                  SEO / GEO
                </button>
                <button type="button" onClick={() => setActiveTab('criteria')} style={workspaceTabStyle(activeTab === 'criteria')}>
                  Suchkriterien
                </button>
              </div>

              {activeTab === 'texts' ? (
                <>
                  <div style={{ display: 'grid', gap: '18px', marginBottom: '16px' }}>
                    {renderTextField('Gesuch-Titel', 'seo_h1', {
                      multiline: false,
                      placeholder: 'Titel wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                    })}
                    {renderTextField('Beschreibung', 'long_description', {
                      multiline: true,
                      placeholder: 'Beschreibung wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                    })}
                  </div>

                  <div style={contentPreviewGridStyle}>
                    <div style={contentPreviewCardStyle}>
                      <div style={contentPreviewLabelStyle}>Gesuch-Titel</div>
                      <div style={contentPreviewBodyStyle}>{form.seo_h1 || 'Kein Gesuch-Titel gepflegt.'}</div>
                    </div>
                    <div style={contentPreviewCardStyle}>
                      <div style={contentPreviewLabelStyle}>Beschreibung</div>
                      <div style={contentPreviewBodyStyle}>{form.long_description || 'Keine Beschreibung gepflegt.'}</div>
                    </div>
                  </div>

                  <button onClick={() => void saveOverride()} disabled={saving} style={primaryButtonStyle}>
                    {saving ? 'Speichern...' : 'Texte speichern'}
                  </button>
                </>
              ) : null}

              {activeTab === 'seo' ? (
                <>
                  <div style={offerSummaryCardStyle}>
                    <div style={offerSummaryHeaderStyle}>Snippet</div>
                    <div style={mediaSectionHintStyle}>Suchmaschinen-Snippet und Antwortbausteine für das Gesuch.</div>
                  </div>

                  <div style={{ display: 'grid', gap: '18px', marginBottom: '16px' }}>
                    {renderTextField('SEO‑Titel', 'seo_title', {
                      multiline: false,
                      placeholder: 'SEO-Titel wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                    })}
                    {renderTextField('SEO‑Description', 'seo_description', {
                      multiline: true,
                      placeholder: 'SEO-Description wird bei Bedarf durch KI erzeugt oder manuell gepflegt.',
                    })}
                  </div>

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

                  <button onClick={() => void saveOverride()} disabled={saving} style={primaryButtonStyle}>
                    {saving ? 'Speichern...' : 'SEO / GEO speichern'}
                  </button>
                </>
              ) : null}

              {activeTab === 'criteria' ? (
                <div style={offerSummaryCardStyle}>
                  <div style={offerSummaryHeaderStyle}>Suchkriterien</div>
                  <div style={offerSummaryStackStyle}>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Gesuchstyp</div>
                      <div style={offerSummaryValueStyle}>{selectedMode}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Vermarktung</div>
                      <div style={offerSummaryValueStyle}>{selectedMarketing}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Objektart</div>
                      <div style={offerSummaryValueStyle}>{selectedType}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Objekt-Untertyp</div>
                      <div style={offerSummaryValueStyle}>{getPayloadText(selectedPayload, ['object_subtype']) || selectedSubtypes.join(', ') || '—'}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Zimmer</div>
                      <div style={offerSummaryValueStyle}>
                        {selectedRoomsMin != null || selectedRoomsMax != null
                          ? `${selectedRoomsMin ?? '—'} bis ${selectedRoomsMax ?? '—'}`
                          : '—'}
                      </div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Fläche</div>
                      <div style={offerSummaryValueStyle}>
                        {selectedAreaMin != null || selectedAreaMax != null
                          ? `${selectedAreaMin ?? '—'} bis ${selectedAreaMax ?? '—'} m²`
                          : '—'}
                      </div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Budget</div>
                      <div style={offerSummaryValueStyle}>{formatEuro(selectedBudget)}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Radius</div>
                      <div style={offerSummaryValueStyle}>{selectedRadius != null ? `${selectedRadius} km` : '—'}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Zielregionen</div>
                      <div style={offerSummaryValueStyle}>{selectedLocation}</div>
                    </div>
                    <div style={offerSummaryStackRowStyle}>
                      <div style={offerSummaryLabelStyle}>Zentrum</div>
                      <div style={offerSummaryValueStyle}>
                        {getPayloadText(selectedPayload, ['region']) || getPayloadText((selectedPayload.range_center as Record<string, unknown>) ?? {}, ['ort']) || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  background: '#fff',
  padding: '16px',
};

const panelTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: 700,
};

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

function visibilityMessageStyle(tone: VisibilityTone): CSSProperties {
  if (tone === 'success') {
    return {
      borderRadius: '999px',
      background: '#ecfdf5',
      color: '#166534',
      padding: '8px 12px',
      fontSize: '12px',
      fontWeight: 600,
      width: 'fit-content',
    };
  }
  if (tone === 'error') {
    return {
      borderRadius: '999px',
      background: '#fef2f2',
      color: '#b91c1c',
      padding: '8px 12px',
      fontSize: '12px',
      fontWeight: 600,
      width: 'fit-content',
    };
  }
  return {
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    width: 'fit-content',
  };
}

const aiMissingHintStyle: CSSProperties = {
  fontSize: '12px',
  color: '#e2e8f0',
};

const workspaceTabsRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '18px',
  marginBottom: '16px',
};

const workspaceTabStyle = (active: boolean): CSSProperties => ({
  border: `1px solid ${active ? '#486b7a' : '#dbe5ea'}`,
  backgroundColor: active ? '#486b7a' : '#f8fafc',
  color: active ? '#ffffff' : '#334155',
  borderRadius: '999px',
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: active ? 700 : 600,
  cursor: 'pointer',
});

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
  minHeight: '80px',
  resize: 'vertical',
};

const fieldCardStyle: CSSProperties = {
  marginBottom: '8px',
  paddingBottom: '14px',
  borderBottom: '1px solid #f1f5f9',
};

const fieldHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const editorSingleColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
};

const textareaWrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const aiActionsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
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

const offerRowStyle = (active: boolean): CSSProperties => ({
  width: '100%',
  textAlign: 'left',
  padding: '10px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  backgroundColor: active ? '#f1f5f9' : '#fff',
  marginBottom: '8px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

const primaryButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: '#0f172a',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const previewCardStyle: CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px',
  marginBottom: '16px',
};

const contentPreviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
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

const offerSummaryTopWrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
  marginBottom: '16px',
};

const offerSummaryTopCardStyle: CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '14px',
};

const offerSummaryCardStyle: CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '14px',
  marginBottom: '16px',
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

const offerSummaryStackStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const offerSummaryStackRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  paddingBottom: '10px',
  borderBottom: '1px solid #e2e8f0',
};

const mediaSectionHintStyle: CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  lineHeight: 1.5,
  marginBottom: '12px',
};

const noteCardBodyStyle: CSSProperties = {
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
};
