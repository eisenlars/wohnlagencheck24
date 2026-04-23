'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import styles from './styles/crm-asset-manager.module.css';

type RawAssetRow = {
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

type Props = {
  title: string;
  rawTable: 'partner_references' | 'partner_requests';
  overrideTable: 'partner_reference_overrides' | 'partner_request_overrides';
  emptyHint: string;
  headerContent?: React.ReactNode;
};

type RegionTarget = {
  city?: string;
  district?: string | null;
  label?: string;
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
  return typeof value === 'string' ? value : '';
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

function getPayloadText(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
}

function getPayloadList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

function buildDefaultForm(row: RawAssetRow, rawTable: Props['rawTable'], override?: OverrideRow | null): OverrideRow {
  const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
  const title = asText(row.title);
  const description = getPayloadText(payload, ['description', 'short_description', 'long_description', 'title']);
  const regionTargets = getRegionTargetLabels(payload);
  const regionTargetsText = regionTargets.join(', ');
  const location = rawTable === 'partner_requests'
    ? (regionTargetsText || getPayloadText(payload, ['location_text', 'location', 'region', 'address']))
    : getPayloadText(payload, ['location_text', 'location', 'region', 'address']);
  const features = getPayloadText(payload, ['features_text', 'features_note']);
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

export default function CrmAssetManager(props: Props) {
  const { title, rawTable, overrideTable, emptyHint, headerContent } = props;
  const isRequestTable = rawTable === 'partner_requests';
  const isReferenceTable = rawTable === 'partner_references';
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [status, setStatus] = useState('Lade Daten...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [rows, setRows] = useState<RawAssetRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<OverrideRow | null>(null);
  const [query, setQuery] = useState('');
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
        if (integrationsRes.ok) {
          const payload = await integrationsRes.json().catch(() => ({}));
          const llmModeDefault = String(payload?.llm_mode_default ?? '').trim().toLowerCase();
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
                source,
                provider,
                model,
                label: String(entry?.label ?? '').trim() || `${formatProviderLabel(provider)} · ${model}${source === 'global' ? ' (Global)' : ' (Partner)'}`,
                partnerIntegrationId: String(entry?.partner_integration_id ?? '').trim() || null,
                globalProviderId: String(entry?.global_provider_id ?? '').trim() || null,
              } satisfies LlmIntegrationOption;
            })
            .filter((entry): entry is LlmIntegrationOption => Boolean(entry));
          setLlmOptions(llmItems);
          setSelectedLlmIntegrationId((prev) => {
            if (prev && llmItems.some((item) => item.id === prev)) return prev;
            if (llmModeDefault === 'central_managed') {
              return llmItems.find((item) => item.source === 'global')?.id ?? llmItems[0]?.id ?? '';
            }
            if (llmModeDefault === 'partner_managed') {
              return llmItems.find((item) => item.source === 'partner')?.id ?? llmItems[0]?.id ?? '';
            }
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
      setStatus('Lade Daten...');
      const kind = rawTable === 'partner_references' ? 'references' : 'requests';
      const res = await fetch(`/api/partner/crm-assets/workspace?kind=${kind}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => null) as {
        rows?: RawAssetRow[];
        overrides?: OverrideRow[];
        error?: string;
      } | null;
      if (!res.ok) {
        setStatus(payload?.error ? `Fehler beim Laden: ${payload.error}` : 'Fehler beim Laden.');
        setLoading(false);
        return;
      }

      setStatus('Daten geladen.');
      const list = Array.isArray(payload?.rows) ? payload.rows : [];
      setRows(list);
      setOverrides(Array.isArray(payload?.overrides) ? payload.overrides : []);
      setSelectedId(list[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, [rawTable]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
      const regions = getRegionTargetLabels(payload).join(' ');
      const description = getPayloadText(payload, ['description', 'short_description', 'long_description', 'title']);
      const hay = `${row.title ?? ''} ${row.external_id} ${row.provider} ${regions} ${description}`.toLowerCase();
      return hay.includes(term);
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
    return (
      overrides.find(
        (entry) =>
          entry.partner_id === selectedRow.partner_id &&
          entry.source === selectedRow.provider &&
          entry.external_id === selectedRow.external_id,
      ) ?? null
    );
  }, [overrides, selectedRow]);

  useEffect(() => {
    if (!selectedRow) {
      setForm(null);
      return;
    }
    setForm(buildDefaultForm(selectedRow, rawTable, selectedOverride));
  }, [selectedRow, selectedOverride, rawTable]);

  async function saveOverride(nextForm?: OverrideRow) {
    const payload = nextForm ?? form;
    if (!payload) return;
    setSaving(true);
    setStatus('Speichere...');
    const upsertPayload = {
      ...payload,
      highlights: payload.highlights ?? [],
      image_alt_texts: payload.image_alt_texts ?? [],
      last_updated: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(overrideTable)
      .upsert(upsertPayload, { onConflict: 'partner_id,source,external_id' })
      .select('*')
      .single();

    if (error) {
      setStatus(`Speichern fehlgeschlagen (${overrideTable}): ${error.message}`);
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
    setStatus('Gespeichert.');
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
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setStatus('KI-Optimierung nicht erlaubt: bitte ein freigegebenes KI-Modell auswählen.');
        } else {
          setStatus(String(data?.error ?? 'KI-Optimierung fehlgeschlagen.'));
        }
        return;
      }
      const optimized = String(data?.optimizedText ?? '');
      if (!optimized) {
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

  function getStandardPromptText(label: string, areaName: string) {
    const lowerLabel = String(label || '').toLowerCase();
    if (lowerLabel.includes('seo title') || lowerLabel.includes('seo-title')) {
      return `Schreibe einen SEO-Titel für ein Immobiliengesuch in ${areaName}. Maximal 60 Zeichen, klar lesbar, ohne Keyword-Stapelung und ohne erfundene Fakten.`;
    }
    if (lowerLabel.includes('seo description') || lowerLabel.includes('seo-description')) {
      return `Schreibe eine SEO-Description für ein Immobiliengesuch in ${areaName}. 140 bis 160 Zeichen, sachlich, kompakt und ohne neue Fakten.`;
    }
    if (lowerLabel.includes('kurzbeschreibung')) {
      return `Formuliere einen kurzen Teaser zum Gesuch in ${areaName}. 1 bis 2 Sätze, sachlich, glaubwürdig und ohne Übertreibung.`;
    }
    if (lowerLabel.includes('langbeschreibung')) {
      return `Optimiere die Gesuchs-Beschreibung für bessere Lesbarkeit und Struktur. Sachlicher Stil, keine neuen Fakten, keine unnötigen Wiederholungen. Kontext: ${areaName}.`;
    }
    if (lowerLabel.includes('lagetext')) {
      return `Formuliere den Lage-Text für ein Immobiliengesuch in ${areaName} klar und informativ. Fokus auf Zielregion, Umfeld und regionale Einordnung. Keine erfundenen Fakten.`;
    }
    if (lowerLabel.includes('ausstattung')) {
      return `Formuliere den Ausstattungs- oder Zusatztext für ein Immobiliengesuch klar und sachlich. Nur aus den vorhandenen Gesuchsdaten ableitbare Aussagen verwenden.`;
    }
    return `Optimiere den Text für bessere Lesbarkeit, fachliche Klarheit und saubere Suchmaschinen-/Antwortsystem-Nutzung. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
  }

  const selectedType = asText(selectedPayload.object_type) || '—';
  const selectedMode = isRequestTable
    ? (asText(selectedPayload.request_type) || '—')
    : isReferenceTable
      ? (asText(selectedPayload.transaction_result) || '—')
      : (asText(selectedPayload.offer_type) || '—');
  const selectedRooms = asNumber(selectedPayload.rooms) ?? asNumber(selectedPayload.min_rooms);
  const selectedArea = asNumber(selectedPayload.area_sqm) ?? asNumber(selectedPayload.min_area_sqm) ?? asNumber(selectedPayload.min_living_area_sqm);
  const selectedBudget = asNumber(selectedPayload.max_price) ?? asNumber(selectedPayload.price) ?? asNumber(selectedPayload.rent);
  const selectedLocation = isRequestTable
    ? (getRegionTargetLabels(selectedPayload).join(', ') || asText(selectedPayload.region) || '—')
    : (asText(selectedPayload.location) || [asText(selectedPayload.city), asText(selectedPayload.district)].filter(Boolean).join(' ') || '—');
  const selectedMetricLabel = isRequestTable
    ? 'Max. Budget'
    : isReferenceTable
      ? 'Ergebnis'
      : 'Preis/Miete';
  const selectedMetricValue = isReferenceTable
    ? (asText(selectedPayload.transaction_result) || '—')
    : formatEuro(selectedBudget);
  const selectedLocationLabel = isRequestTable ? 'Zielregionen' : isReferenceTable ? 'Ort' : 'Lage';
  const selectedUpdatedAt = selectedRow?.source_updated_at ?? selectedRow?.updated_at ?? null;
  const referenceDescription = isReferenceTable
    ? getPayloadText(selectedPayload, ['description', 'reference_text_seed'])
    : '';
  const requestDescription = isRequestTable
    ? getPayloadText(selectedPayload, ['description', 'short_description', 'long_description', 'title'])
    : '';

  if (loading) return <FullscreenLoader show label={`${title} werden geladen...`} />;

  return (
    <div className="row g-3">
      <aside className="col-12 col-xl-4">
        <div className="border rounded-3 p-2 bg-light">
          <div className={`mb-2 fw-bold ${styles.sidebarTitle}`}>{title}</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen..."
            className="form-control form-control-sm mb-2"
          />
          <div className={`d-flex flex-column gap-2 overflow-auto ${styles.assetList}`}>
            {filteredRows.map((row) => (
              <button
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`btn text-start border rounded-3 d-grid gap-1 px-2 py-2 ${selectedId === row.id ? styles.assetListItemActive : styles.assetListItem}`}
              >
                <strong className={styles.assetListTitle}>{row.title || row.external_id}</strong>
                <span className={styles.assetListMeta}>
                  {row.provider} · {row.external_id}
                </span>
                <span className={styles.assetListMeta}>
                  {isRequestTable
                    ? `${asText(((row.normalized_payload ?? {}) as Record<string, unknown>).request_type) || '—'} · ${
                        asText(((row.normalized_payload ?? {}) as Record<string, unknown>).object_type) || '—'
                      }`
                    : isReferenceTable
                      ? `${asText(((row.normalized_payload ?? {}) as Record<string, unknown>).transaction_result) || '—'} · ${
                          asText(((row.normalized_payload ?? {}) as Record<string, unknown>).object_type) || '—'
                        }`
                    : `${asText(((row.normalized_payload ?? {}) as Record<string, unknown>).offer_type) || '—'} · ${
                        asText(((row.normalized_payload ?? {}) as Record<string, unknown>).object_type) || '—'
                      }`}
                </span>
                {isRequestTable ? (
                  <span className={styles.assetListDescription}>
                    {getPayloadText(((row.normalized_payload ?? {}) as Record<string, unknown>), ['description', 'short_description', 'long_description']).slice(0, 120) || 'Keine Beschreibung'}
                  </span>
                ) : null}
              </button>
            ))}
            {!filteredRows.length ? <p className={`m-0 ${styles.emptyHint}`}>{emptyHint}</p> : null}
          </div>
        </div>
      </aside>

      <section className="col-12 col-xl-8">
        <p className={`mt-0 mb-2 ${styles.statusText}`}>{status}</p>
        {headerContent}
        {form && selectedRow ? (
          <div className="border rounded-3 p-3 bg-white d-grid gap-2">
            <div className="border rounded-3 px-3 py-2 bg-light">
              <div className={styles.sectionLabel}>
                Datensatz-Übersicht
              </div>
              <div className="row row-cols-1 row-cols-md-2 row-cols-xxl-3 g-2">
                <div className="col">
                  <div className={styles.metaLabel}>Titel</div>
                  <div className={styles.metaValue}>{selectedRow.title || '—'}</div>
                </div>
                <div className="col">
                  <div className={styles.metaLabel}>Quelle</div>
                  <div className={styles.metaValue}>{selectedRow.provider} · {selectedRow.external_id}</div>
                </div>
                <div className="col">
                  <div className={styles.metaLabel}>Typ</div>
                  <div className={styles.metaValue}>{selectedType}</div>
                </div>
                <div className="col">
                  <div className={styles.metaLabel}>
                    {isRequestTable ? 'Gesuchstyp' : isReferenceTable ? 'Transaktion' : 'Vermarktung'}
                  </div>
                  <div className={styles.metaValue}>{selectedMode}</div>
                </div>
                <div className="col">
                  <div className={styles.metaLabel}>
                    {selectedMetricLabel}
                  </div>
                  <div className={styles.metaValue}>{selectedMetricValue}</div>
                </div>
                <div className="col">
                  <div className={styles.metaLabel}>
                    {isRequestTable ? 'Zimmer min.' : 'Zimmer'}
                  </div>
                  <div className={styles.metaValue}>{selectedRooms ?? '—'}</div>
                </div>
                <div className="col">
                  <div className={styles.metaLabel}>Fläche</div>
                  <div className={styles.metaValue}>
                    {selectedArea ? `${selectedArea} m²` : '—'}
                  </div>
                </div>
                <div className="col-12">
                  <div className={styles.metaLabel}>
                    {selectedLocationLabel}
                  </div>
                  <div className={styles.metaValue}>{selectedLocation}</div>
                </div>
                <div className="col-12">
                  <div className={styles.metaLabel}>Aktualisiert</div>
                  <div className={styles.metaValue}>{selectedUpdatedAt ?? '—'}</div>
                </div>
              </div>
            </div>
            {isRequestTable ? (
              <div className="border rounded-3 px-2 py-2 bg-light">
                <div className={styles.cardTitle}>Zielregionen</div>
                <div className={styles.cardText}>
                  {getRegionTargetLabels((selectedRow.normalized_payload ?? {}) as Record<string, unknown>).join(', ') || '—'}
                </div>
              </div>
            ) : null}
            {isRequestTable ? (
              <div className="border rounded-3 px-2 py-2 bg-light">
                <div className={styles.cardTitle}>Gesuchsbeschreibung</div>
                <div className={styles.cardText}>
                  {requestDescription || 'Keine Beschreibung im normalisierten Payload vorhanden.'}
                </div>
              </div>
            ) : null}
            {isReferenceTable ? (
              <div className="border rounded-3 px-2 py-2 bg-light">
                <div className={styles.cardTitle}>Referenztext</div>
                <div className={styles.cardText}>
                  {referenceDescription || 'Kein Referenztext im normalisierten Payload vorhanden.'}
                </div>
              </div>
            ) : null}
            <div className="row g-2">
              <label className="col-12 col-md-6 d-grid gap-1">
                <span className={styles.fieldLabel}>SEO Title</span>
                <input
                  value={form.seo_title ?? ''}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, seo_title: e.target.value } : prev))}
                  className="form-control form-control-sm"
                />
              </label>
              <label className="col-12 col-md-6 d-grid gap-1">
                <span className={styles.fieldLabel}>SEO H1</span>
                <input
                  value={form.seo_h1 ?? ''}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, seo_h1: e.target.value } : prev))}
                  className="form-control form-control-sm"
                />
              </label>
            </div>

            {(
              [
                ['seo_description', 'SEO Description'],
                ['short_description', 'Kurzbeschreibung'],
                ['long_description', 'Langbeschreibung'],
                ['location_text', 'Lagetext'],
                ['features_text', 'Ausstattung'],
              ] as Array<[keyof OverrideRow, string]>
            ).map(([key, label]) => (
              (() => {
                const keyName = String(key);
                const showPrompt = Boolean(promptOpenMap[keyName]);
                const customPrompt = customPromptMap[keyName] ?? '';
                const standardPrompt = getStandardPromptText(label, selectedRow.title || selectedRow.external_id);
                const isRewriting = rewritingKey === keyName;
                return (
                  <label key={keyName} className="d-grid gap-1">
                    <span className={styles.fieldLabel}>{label}</span>
                    <textarea
                      value={String(form[key] ?? '')}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
                      rows={3}
                      className="form-control form-control-sm"
                    />
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => runAiRewrite(key, label, customPrompt)}
                        disabled={isRewriting || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
                        className={`btn fw-semibold ${styles.aiButton} ${isRewriting ? styles.aiButtonLoading : ''}`}
                      >
                        {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
                        className={`btn fw-semibold ${styles.promptToggleButton}`}
                      >
                        {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const defaultForm = buildDefaultForm(selectedRow, rawTable, null);
                          setForm((prev) => (prev ? { ...prev, [key]: defaultForm[key] } : prev));
                        }}
                        className="btn btn-light border btn-sm text-secondary"
                      >
                        Original nutzen
                      </button>
                    </div>
                    {showPrompt ? (
                      <div className={`border rounded-3 p-3 bg-light ${styles.promptPanel}`}>
                        <div className={styles.promptLabel}>Standard-Prompt</div>
                        <div className={styles.promptContent}>{standardPrompt}</div>
                        <label className={`d-flex flex-column gap-2 ${styles.promptInputLabel}`}>
                          Eigener Prompt (optional)
                          <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPromptMap((prev) => ({ ...prev, [keyName]: e.target.value }))}
                            className={`form-control form-control-sm ${styles.promptInput}`}
                            placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                          />
                        </label>
                      </div>
                    ) : null}
                  </label>
                );
              })()
            ))}

            <div className="d-flex gap-2 mt-1">
              <button
                onClick={() => saveOverride()}
                disabled={saving}
                className={`btn fw-semibold ${styles.saveButton}`}
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        ) : (
          <p className={`m-0 ${styles.emptyHint}`}>{emptyHint}</p>
        )}
      </section>
    </div>
  );
}
