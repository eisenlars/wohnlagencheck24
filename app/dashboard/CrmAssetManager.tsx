'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import FullscreenLoader from '@/components/ui/FullscreenLoader';

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
  const description = getPayloadText(payload, ['long_description', 'description', 'title']);
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
      const hay = `${row.title ?? ''} ${row.external_id} ${row.provider} ${regions}`.toLowerCase();
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

  async function runAiRewrite(key: keyof OverrideRow, label: string) {
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

  const formStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 12,
    background: '#fff',
    display: 'grid',
    gap: 10,
  };

  const selectedType = asText(selectedPayload.object_type) || '—';
  const selectedMode = isRequestTable
    ? (asText(selectedPayload.request_type) || '—')
    : isReferenceTable
      ? (asText(selectedPayload.transaction_result) || '—')
      : (asText(selectedPayload.offer_type) || '—');
  const selectedRooms = asNumber(selectedPayload.rooms) ?? asNumber(selectedPayload.min_rooms);
  const selectedArea = asNumber(selectedPayload.area_sqm);
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

  if (loading) return <FullscreenLoader show label={`${title} werden geladen...`} />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 14 }}>
      <aside style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#f8fafc' }}>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#334155', fontWeight: 700 }}>{title}</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen..."
          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '62vh', overflowY: 'auto' }}>
          {filteredRows.map((row) => (
            <button
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              style={{
                textAlign: 'left',
                border: selectedId === row.id ? '1px solid #0f766e' : '1px solid #e2e8f0',
                background: selectedId === row.id ? '#ecfeff' : '#fff',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                display: 'grid',
                gap: 2,
              }}
            >
              <strong style={{ color: '#0f172a', fontSize: 13 }}>{row.title || row.external_id}</strong>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {row.provider} · {row.external_id}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>
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
            </button>
          ))}
          {!filteredRows.length ? <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{emptyHint}</p> : null}
        </div>
      </aside>

      <section>
        <p style={{ marginTop: 0, marginBottom: 10, fontSize: 12, color: '#334155' }}>{status}</p>
        {headerContent}
        {form && selectedRow ? (
          <div style={formStyle}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700, marginBottom: 8 }}>
                Datensatz-Übersicht
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Titel</div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedRow.title || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Quelle</div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedRow.provider} · {selectedRow.external_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Typ</div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedType}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    {isRequestTable ? 'Gesuchstyp' : isReferenceTable ? 'Transaktion' : 'Vermarktung'}
                  </div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedMode}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    {selectedMetricLabel}
                  </div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedMetricValue}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    {isRequestTable ? 'Zimmer min.' : 'Zimmer'}
                  </div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedRooms ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Fläche</div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                    {selectedArea ? `${selectedArea} m²` : '—'}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    {selectedLocationLabel}
                  </div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedLocation}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Aktualisiert</div>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{selectedUpdatedAt ?? '—'}</div>
                </div>
              </div>
            </div>
            {isRequestTable ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', background: '#f8fafc' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Zielregionen</div>
                <div style={{ fontSize: 12, color: '#0f172a' }}>
                  {getRegionTargetLabels((selectedRow.normalized_payload ?? {}) as Record<string, unknown>).join(', ') || '—'}
                </div>
              </div>
            ) : null}
            {isReferenceTable ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', background: '#f8fafc' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Referenztext</div>
                <div style={{ fontSize: 12, color: '#0f172a' }}>
                  {referenceDescription || 'Kein Referenztext im normalisierten Payload vorhanden.'}
                </div>
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>SEO Title</span>
                <input
                  value={form.seo_title ?? ''}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, seo_title: e.target.value } : prev))}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>SEO H1</span>
                <input
                  value={form.seo_h1 ?? ''}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, seo_h1: e.target.value } : prev))}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px' }}
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
              <label key={String(key)} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>{label}</span>
                <textarea
                  value={String(form[key] ?? '')}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
                  rows={3}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  {llmOptions.length > 0 || !llmOptionsLoaded ? (
                    <select
                      value={selectedLlmIntegrationId || llmOptions[0]?.id || ''}
                      onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                      style={{
                        minWidth: 220,
                        border: '1px solid #dbeafe',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#0f172a',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 10px',
                      }}
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
                    <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
                      Keine aktive LLM-Integration
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => runAiRewrite(key, label)}
                    disabled={rewritingKey === String(key) || llmOptionsLoading || (llmOptionsLoaded && llmOptions.length === 0)}
                    style={{
                      border: '1px solid #94a3b8',
                      borderRadius: 8,
                      padding: '6px 10px',
                      background: '#fff',
                      color: '#0f172a',
                      cursor: 'pointer',
                    }}
                  >
                    {rewritingKey === String(key) ? 'KI läuft...' : 'Mit KI optimieren'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultForm = buildDefaultForm(selectedRow, rawTable, null);
                      setForm((prev) => (prev ? { ...prev, [key]: defaultForm[key] } : prev));
                    }}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '6px 10px',
                      background: '#f8fafc',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    Original nutzen
                  </button>
                </div>
              </label>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={() => saveOverride()}
                disabled={saving}
                style={{
                  border: '1px solid #0f766e',
                  background: '#0f766e',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{emptyHint}</p>
        )}
      </section>
    </div>
  );
}
