'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import FullscreenLoader from '@/components/ui/FullscreenLoader';

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
  highlights?: string[] | null;
  image_alt_texts?: string[] | null;
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
  demand?: number | null;
  year?: number | null;
};

type Props = {
  visibilityConfig?: VisibilityConfig | null;
  visibilityMode?: VisibilityMode;
  visibilityBusy?: boolean;
  visibilityMessage?: string | null;
  visibilityTone?: VisibilityTone;
  onVisibilityModeChange?: (value: VisibilityMode) => void | Promise<void>;
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
    demand: asNumber(record.demand),
    year: asNumber(record.year),
  };
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
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'haus' | 'wohnung'>('all');
  const [promptOpenMap, setPromptOpenMap] = useState<Record<string, boolean>>({});
  const [customPromptMap, setCustomPromptMap] = useState<Record<string, string>>({});
  const [llmOptions, setLlmOptions] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState('');
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeFloorplanIndex, setActiveFloorplanIndex] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: offersData } = await supabase
        .from('partner_property_offers')
        .select('id, partner_id, source, external_id, offer_type, object_type, title, address, price, rent, area_sqm, rooms, image_url, raw, updated_at')
        .eq('partner_id', user.id)
        .order('updated_at', { ascending: false });

      const { data: overridesData } = await supabase
        .from('partner_property_overrides')
        .select('*')
        .eq('partner_id', user.id);

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
      } else {
        setLlmOptions([]);
        setSelectedLlmIntegrationId('');
      }

      setOffers(offersData || []);
      setOverrides(overridesData || []);
      setSelectedOfferId(offersData?.[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filteredOffers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesType =
        filterType === 'all' ? true : String(offer.object_type || '').toLowerCase() === filterType;
      const matchesQuery = term.length === 0
        ? true
        : `${offer.title ?? ''} ${offer.address ?? ''}`.toLowerCase().includes(term);
      return matchesType && matchesQuery;
    });
  }, [offers, query, filterType]);

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;
  const selectedRaw = useMemo(
    () => (selectedOffer?.raw ?? {}) as Record<string, unknown>,
    [selectedOffer],
  );
  const rawDescription = useMemo(
    () => readTextValue(selectedRaw.description) ?? '',
    [selectedRaw],
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
  const activePhotoAsset = photoAssets[activePhotoIndex] ?? null;
  const activeFloorplanAsset = floorplanAssets[activeFloorplanIndex] ?? null;
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
      seo_description: selectedOverride?.seo_description ?? rawDescription ?? '',
      seo_h1: selectedOverride?.seo_h1 ?? selectedOffer.title ?? '',
      short_description: selectedOverride?.short_description ?? rawDescription ?? '',
      long_description: selectedOverride?.long_description ?? rawDescription ?? '',
      location_text: selectedOverride?.location_text ?? rawLocation ?? '',
      features_text: selectedOverride?.features_text ?? rawFeatures ?? '',
      highlights: selectedOverride?.highlights ?? rawHighlights ?? [],
      image_alt_texts: selectedOverride?.image_alt_texts ?? rawImageAltTexts ?? [],
    });
  }, [selectedOffer, selectedOverride, effectiveExternalId, effectiveSource, rawDescription, rawLocation, rawFeatures, rawHighlights, rawImageAltTexts]);

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
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          areaName: selectedOffer?.address || selectedOffer?.title || 'Objekt',
          type: 'general',
          sectionLabel: label,
          customPrompt: customPrompt || undefined,
          llm_integration_id: selectedLlmIntegrationId || llmOptions[0]?.id || undefined,
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

  const getStandardPromptText = (label: string, areaName: string) => {
    const lowerLabel = String(label || '').toLowerCase();
    if (lowerLabel.includes('objekt-titel') || lowerLabel.includes('h1') || lowerLabel.includes('titel')) {
      return `Formuliere einen prägnanten Objekt-Titel (max. 60 Zeichen) für ${areaName}. Keine erfundenen Fakten.`;
    }
    if (lowerLabel.includes('seo-title')) {
      return `Schreibe einen SEO-Title (max. 60 Zeichen) für ein Immobilienangebot in ${areaName}. Fakten beibehalten.`;
    }
    if (lowerLabel.includes('seo-description')) {
      return `Schreibe eine SEO-Description (140–160 Zeichen) für ein Immobilienangebot in ${areaName}. Fakten beibehalten.`;
    }
    if (lowerLabel.includes('teaser')) {
      return `Formuliere einen kurzen Teaser (1–2 Sätze) zum Objekt in ${areaName}. Keine neuen Fakten.`;
    }
    if (lowerLabel.includes('langtext')) {
      return `Optimiere den Langtext für bessere Lesbarkeit und Struktur. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
    }
    if (lowerLabel.includes('langtext') || lowerLabel.includes('beschreibung')) {
      return `Optimiere den Text für bessere Lesbarkeit. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
    }
    if (lowerLabel.includes('lage')) {
      return `Formuliere den Lage-Text klar und informativ. Keine erfundenen Fakten, keine Übertreibungen. Kontext: ${areaName}.`;
    }
    if (lowerLabel.includes('ausstatt')) {
      return `Formuliere den Ausstattungstext klar und strukturiert. Keine neuen Features hinzufügen.`;
    }
    if (lowerLabel.includes('highlights')) {
      return `Schreibe max. 6 Highlights (je 1 Zeile), kurz und konkret. Nur belegte Fakten verwenden.`;
    }
    if (lowerLabel.includes('alt-texte') || lowerLabel.includes('alttexte')) {
      return `Erstelle kurze, sachliche Alt-Texte (1 Zeile je Bild). Keine erfundenen Details.`;
    }
    return `Optimiere den Text für bessere Lesbarkeit und SEO. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
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
      <div style={fieldCardStyle}>
        <div style={fieldHeaderStyle}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>{label}</h4>
          <div style={fieldHeaderActionsStyle}>
            {isCustomized ? (
              <span style={customizedBadgeStyle}>✓ Individuell angepasst</span>
            ) : null}
            <button
              type="button"
              onClick={() => resetField(key, rawValue)}
              style={resetButtonStyle(isCustomized)}
            >
              Original nutzen
            </button>
          </div>
        </div>
        <div style={editorGridStyle}>
          <div style={textareaWrapperStyle}>
            {options?.multiline ? (
              <textarea
                value={value}
                onChange={(e) => updateField(key, e.target.value)}
                onBlur={() => saveOverride()}
                style={textareaStyle}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            ) : (
              <input
                value={value}
                onChange={(e) => updateField(key, e.target.value)}
                onBlur={() => saveOverride()}
                style={inputStyle}
                placeholder={options?.placeholder ?? 'Inhalt bearbeiten...'}
              />
            )}
            <div style={aiActionsRowStyle}>
              {llmOptions.length > 0 ? (
                <select
                  value={selectedLlmIntegrationId || llmOptions[0].id}
                  onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                  style={aiSelectStyle}
                  aria-label="KI-Modell auswählen"
                >
                  {llmOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={aiMissingHintStyle}>Keine aktive LLM-Integration</span>
              )}
              <button
                type="button"
                style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
                onClick={() => handleAiRewrite(key, value, label, customPrompt)}
                disabled={isRewriting || llmOptions.length === 0}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))
              }
              style={promptToggleStyle}
            >
              {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
            </button>
            {showPrompt ? (
              <div style={promptPanelStyle}>
                <div style={promptLabelStyle}>Standard-Prompt</div>
                <div style={promptContentStyle}>{standardPrompt}</div>
                <label style={promptInputLabelStyle}>
                  Eigener Prompt (optional)
                  <textarea
                    value={customPrompt}
                    onChange={(e) =>
                      setCustomPromptMap((prev) => ({ ...prev, [keyName]: e.target.value }))
                    }
                    style={promptInputStyle}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div style={previewBoxStyle}>
            <div style={previewHeaderStyle}>CRM‑ORIGINAL (SYSTEM)</div>
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
    const isRewriting = rewritingKey === String(key);
    const keyName = String(key);
    const value = Array.isArray(form[key]) ? (form[key] as string[]).join('\n') : '';
    const rawValueText = Array.isArray(rawValue) ? rawValue.join('\n') : '';
    const isCustomized = value.trim() !== rawValueText.trim();
    const showPrompt = Boolean(promptOpenMap[keyName]);
    const customPrompt = customPromptMap[keyName] ?? '';
    const standardPrompt = getStandardPromptText(label, selectedOffer?.address || selectedOffer?.title || 'Objekt');
    return (
      <div style={fieldCardStyle}>
        <div style={fieldHeaderStyle}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>{label}</h4>
          <div style={fieldHeaderActionsStyle}>
            {isCustomized ? (
              <span style={customizedBadgeStyle}>✓ Individuell angepasst</span>
            ) : null}
            <button
              type="button"
              onClick={() => resetField(key, rawValue)}
              style={resetButtonStyle(isCustomized)}
            >
              Original nutzen
            </button>
          </div>
        </div>
        <div style={editorGridStyle}>
          <div style={textareaWrapperStyle}>
            <textarea
              value={value}
              onChange={(e) => updateField(key, e.target.value.split('\n').filter(Boolean))}
              onBlur={() => saveOverride()}
              style={textareaStyle}
              placeholder={placeholder}
            />
            <div style={aiActionsRowStyle}>
              {llmOptions.length > 0 ? (
                <select
                  value={selectedLlmIntegrationId || llmOptions[0].id}
                  onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                  style={aiSelectStyle}
                  aria-label="KI-Modell auswählen"
                >
                  {llmOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={aiMissingHintStyle}>Keine aktive LLM-Integration</span>
              )}
              <button
                type="button"
                style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
                onClick={() => handleAiRewrite(key, value, label, customPrompt)}
                disabled={isRewriting || llmOptions.length === 0}
              >
                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                setPromptOpenMap((prev) => ({ ...prev, [keyName]: !prev[keyName] }))
              }
              style={promptToggleStyle}
            >
              {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
            </button>
            {showPrompt ? (
              <div style={promptPanelStyle}>
                <div style={promptLabelStyle}>Standard-Prompt</div>
                <div style={promptContentStyle}>{standardPrompt}</div>
                <label style={promptInputLabelStyle}>
                  Eigener Prompt (optional)
                  <textarea
                    value={customPrompt}
                    onChange={(e) =>
                      setCustomPromptMap((prev) => ({ ...prev, [keyName]: e.target.value }))
                    }
                    style={promptInputStyle}
                    placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div style={previewBoxStyle}>
            <div style={previewHeaderStyle}>CRM‑ORIGINAL (SYSTEM)</div>
            <div style={previewContentStyle}>
              {rawValue.length > 0 ? rawValue.join('\n') : 'Keine CRM-Vorlage vorhanden.'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <FullscreenLoader show label="Immobilien werden geladen..." />;

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
                    <option value="partner_wide">Regionale Ausspielung für Angebote partnerweit (zeigt alle Angebote des Partners im Gebiet)</option>
                    <option value="strict_local">Regionale Ausspielung für Angebote nur lokal (nutzt nur lokal gematchte Angebote)</option>
                  </select>
                  <span style={visibilitySelectChevronStyle} aria-hidden="true">▾</span>
                </span>
              </label>
              <div style={visibilityModelWrapStyle}>
                {llmOptions.length > 0 ? (
                  <span style={visibilitySelectWrapStyle}>
                    <select
                      value={selectedLlmIntegrationId || llmOptions[0].id}
                      onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                      style={visibilitySelectStyle}
                      aria-label="KI-Modell auswählen"
                    >
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

      <div style={{ display: 'grid', gridTemplateColumns: '520px 1fr', gap: '20px' }}>
      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Angebote</h3>
        <input
          placeholder="Suchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', marginBottom: '12px' }}>
          <button
            onClick={() => setFilterType('all')}
            style={filterButtonStyle(filterType === 'all')}
          >
            Alle
          </button>
          <button
            onClick={() => setFilterType('haus')}
            style={filterButtonStyle(filterType === 'haus')}
          >
            Haus
          </button>
          <button
            onClick={() => setFilterType('wohnung')}
            style={filterButtonStyle(filterType === 'wohnung')}
          >
            Wohnung
          </button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {filteredOffers.map((offer) => {
            const normalizedExternalId = (offer.external_id ?? '').trim();
            const normalizedSource = (offer.source ?? '').trim();
            const effectiveExternalIdForOffer =
              normalizedExternalId.length > 0 ? normalizedExternalId : offer.id;
            const effectiveSourceForOffer = normalizedSource.length > 0 ? normalizedSource : 'manual';
            const hasOverride = overrides.some(
              (o) => o.external_id === effectiveExternalIdForOffer && o.source === effectiveSourceForOffer,
            );
            return (
              <button
                key={offer.id}
                onClick={() => setSelectedOfferId(offer.id)}
                style={offerRowStyle(selectedOfferId === offer.id)}
              >
                <span style={{ fontWeight: 600 }}>{offer.title || 'Objekt'}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{offer.address}</span>
                {hasOverride ? (
                  <span style={{ fontSize: '11px', color: '#486b7a', fontWeight: 600 }}>
                    Override aktiv
                  </span>
                ) : null}
              </button>
            );
          })}
          {filteredOffers.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>Keine Angebote gefunden.</div>
          ) : null}
        </div>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>Texte individualisieren</h3>
        {!form ? (
          <div style={{ color: '#94a3b8' }}>
            Kein Objekt ausgewählt.
          </div>
        ) : (
          <>
            {selectedOffer ? (
              <div style={offerSummaryCardStyle}>
                <div style={offerSummaryHeaderStyle}>Objekt-Übersicht</div>
                <div style={offerSummaryGridStyle}>
                  <div>
                    <div style={offerSummaryLabelStyle}>Objekt-ID</div>
                    <div style={offerSummaryValueStyle}>{selectedOffer.id}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Titel</div>
                    <div style={offerSummaryValueStyle}>{selectedOffer.title || 'Objekt'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Adresse</div>
                    <div style={offerSummaryValueStyle}>{selectedOffer.address || '—'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Objektart</div>
                    <div style={offerSummaryValueStyle}>{selectedOffer.object_type || '—'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Angebotstyp</div>
                    <div style={offerSummaryValueStyle}>{selectedOffer.offer_type || '—'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Zimmer</div>
                    <div style={offerSummaryValueStyle}>
                      {selectedOffer.rooms ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Fläche</div>
                    <div style={offerSummaryValueStyle}>
                      {selectedOffer.area_sqm ? `${selectedOffer.area_sqm} m²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Preis / Miete</div>
                    <div style={offerSummaryValueStyle}>
                      {selectedOffer.offer_type === 'miete'
                        ? (selectedOffer.rent ? `${selectedOffer.rent} €` : '—')
                        : (selectedOffer.price ? `${selectedOffer.price} €` : '—')}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {selectedOffer ? (
              <div style={mediaCardStyle}>
                <div style={offerSummaryHeaderStyle}>Medien</div>
                <div style={mediaSectionStyle}>
                  <div style={mediaSectionHeadStyle}>
                    Objektbilder
                    <span style={mediaCountBadgeStyle}>{photoAssets.length}</span>
                  </div>
                  <div style={mediaSectionHintStyle}>Die Fotostrecke zeigt nur echte Objektfotos in ihrer Reihenfolge.</div>
                  {activePhotoAsset ? (
                    <div style={slideshowCardStyle}>
                      <div style={slideshowStageStyle}>
                        <button
                          type="button"
                          onClick={() => setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1))}
                          style={slideshowNavButtonStyle}
                          aria-label="Vorheriges Objektbild"
                        >
                          ‹
                        </button>
                        <div style={slideshowImageFrameStyle}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            key={activePhotoAsset.url}
                            src={activePhotoAsset.url}
                            alt={activePhotoAsset.title ?? `Objektbild ${activePhotoIndex + 1}`}
                            style={slideshowImageStyle}
                            loading="eager"
                            decoding="async"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1))}
                          style={slideshowNavButtonStyle}
                          aria-label="Nächstes Objektbild"
                        >
                          ›
                        </button>
                      </div>
                      <div style={slideshowMetaStyle}>
                        <div style={slideshowCaptionStyle}>
                          {activePhotoAsset.title ?? `Objektbild ${activePhotoIndex + 1}`}
                        </div>
                        <div style={slideshowCounterStyle}>
                          {activePhotoIndex + 1} / {photoAssets.length}
                        </div>
                      </div>
                      <div style={thumbnailRailStyle}>
                        {photoAssets.map((asset, index) => (
                          <button
                            key={`${asset.url}-${index}`}
                            type="button"
                            onClick={() => setActivePhotoIndex(index)}
                            style={thumbnailButtonStyle(index === activePhotoIndex)}
                            aria-label={`Objektbild ${index + 1} anzeigen`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={asset.url}
                              alt={asset.title ?? `Objektbild ${index + 1}`}
                              style={thumbnailImageStyle}
                              loading="lazy"
                              decoding="async"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={mediaEmptyStyle}>Keine Objektbilder im CRM-Payload gefunden.</div>
                  )}
                </div>
                <div style={mediaSectionStyle}>
                  <div style={mediaSectionHeadStyle}>
                    Grundrisse
                    <span style={mediaCountBadgeStyle}>{floorplanAssets.length}</span>
                  </div>
                  <div style={mediaSectionHintStyle}>Grundrisse liegen separat unterhalb der Fotostrecke.</div>
                  {activeFloorplanAsset ? (
                    <div style={floorplanCardStyle}>
                      <div style={floorplanPreviewFrameStyle}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={activeFloorplanAsset.url}
                          src={activeFloorplanAsset.url}
                          alt={activeFloorplanAsset.title ?? `Grundriss ${activeFloorplanIndex + 1}`}
                          style={floorplanPreviewImageStyle}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div style={slideshowMetaStyle}>
                        <div style={slideshowCaptionStyle}>
                          {activeFloorplanAsset.title ?? `Grundriss ${activeFloorplanIndex + 1}`}
                        </div>
                        <div style={slideshowCounterStyle}>
                          {activeFloorplanIndex + 1} / {floorplanAssets.length}
                        </div>
                      </div>
                      <div style={thumbnailRailStyle}>
                        {floorplanAssets.map((asset, index) => (
                          <button
                            key={`${asset.url}-${index}`}
                            type="button"
                            onClick={() => setActiveFloorplanIndex(index)}
                            style={thumbnailButtonStyle(index === activeFloorplanIndex)}
                            aria-label={`Grundriss ${index + 1} anzeigen`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={asset.url}
                              alt={asset.title ?? `Grundriss ${index + 1}`}
                              style={thumbnailImageStyle}
                              loading="lazy"
                              decoding="async"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={mediaEmptyStyle}>Keine Grundrisse erkannt.</div>
                  )}
                </div>
                <div style={mediaSectionStyle}>
                  <div style={mediaSectionHeadStyle}>
                    Lagegrafiken
                    <span style={mediaCountBadgeStyle}>{locationMapAssets.length}</span>
                  </div>
                  <div style={mediaSectionHintStyle}>Standort-, Mikro- und Makrolagen werden separat geführt.</div>
                  {locationMapAssets.length > 0 ? (
                    <div style={mediaCompactListStyle}>
                      {locationMapAssets.map((asset, index) => (
                        <a
                          key={`${asset.url}-${index}`}
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          style={mediaLinkCardStyle}
                        >
                          <span style={mediaLinkTitleStyle}>{asset.title ?? `Lagegrafik ${index + 1}`}</span>
                          <span style={mediaLinkMetaStyle}>Bild extern öffnen</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={mediaEmptyStyle}>Keine Lagegrafiken erkannt.</div>
                  )}
                </div>
                <div style={mediaSectionStyle}>
                  <div style={mediaSectionHeadStyle}>
                    Unterlagen
                    <span style={mediaCountBadgeStyle}>{documentAssets.length}</span>
                  </div>
                  <div style={mediaSectionHintStyle}>Berechnungen und sonstige CRM-Grafiken werden hier gesammelt.</div>
                  {documentAssets.length > 0 ? (
                    <div style={mediaCompactListStyle}>
                      {documentAssets.map((asset, index) => (
                        <a
                          key={`${asset.url}-${index}`}
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          style={mediaLinkCardStyle}
                        >
                          <span style={mediaLinkTitleStyle}>{asset.title ?? `Unterlage ${index + 1}`}</span>
                          <span style={mediaLinkMetaStyle}>Datei extern öffnen</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={mediaEmptyStyle}>Keine zusätzlichen Unterlagen erkannt.</div>
                  )}
                </div>
              </div>
            ) : null}
            {selectedOffer ? (
              <div style={energyCardStyle}>
                <div style={offerSummaryHeaderStyle}>Energieausweis</div>
                <div style={energyGridStyle}>
                  <div>
                    <div style={offerSummaryLabelStyle}>Ausweisart</div>
                    <div style={offerSummaryValueStyle}>{energySnapshot?.certificate_type ?? '—'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Kennwert</div>
                    <div style={offerSummaryValueStyle}>
                      {energySnapshot?.value != null ? `${energySnapshot.value}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Bedarf / Verbrauch</div>
                    <div style={offerSummaryValueStyle}>{energySnapshot?.value_kind ?? '—'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Baujahr</div>
                    <div style={offerSummaryValueStyle}>
                      {energySnapshot?.construction_year ?? energySnapshot?.year ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Energieträger</div>
                    <div style={offerSummaryValueStyle}>{energySnapshot?.heating_energy_source ?? '—'}</div>
                  </div>
                  <div>
                    <div style={offerSummaryLabelStyle}>Effizienzklasse</div>
                    <div style={offerSummaryValueStyle}>{energySnapshot?.efficiency_class ?? '—'}</div>
                  </div>
                </div>
                {missingEnergyFields.length > 0 ? (
                  <div style={energyMissingWrapStyle}>
                    <div style={energyMissingHeadStyle}>Für eine rechtssichere öffentliche Energieanzeige fehlen aktuell:</div>
                    <div style={energyMissingListStyle}>{missingEnergyFields.join(' · ')}</div>
                  </div>
                ) : (
                  <div style={energyReadyStyle}>Alle zentralen Energieangaben für die Anzeige sind aktuell befüllt.</div>
                )}
              </div>
            ) : null}
            {selectedOffer && (!normalizedSelectedExternalId || !normalizedSelectedSource) ? (
              <div style={warningStyle}>
                Hinweis: Dieses Objekt hat keine externe ID/Quelle. Overrides werden lokal mit
                einer Fallback‑ID gespeichert.
              </div>
            ) : null}
            <div style={{ display: 'grid', gap: '18px', marginBottom: '16px' }}>
              {renderTextField('SEO‑Titel', 'seo_title', selectedOffer?.title ?? '', { multiline: false })}
              {renderTextField('SEO‑Description', 'seo_description', rawDescription, { multiline: true })}
              {renderTextField('Objekt-Titel', 'seo_h1', selectedOffer?.title ?? '', { multiline: false })}
              {renderTextField('Teaser', 'short_description', rawDescription, { multiline: true })}
              {renderTextField('Langtext', 'long_description', rawDescription, { multiline: true })}
              {renderTextField('Lage‑Text', 'location_text', rawLocation, { multiline: true })}
              {renderTextField('Ausstattungs‑Text', 'features_text', rawFeatures, { multiline: true })}
              {renderListField('Highlights (eine Zeile = ein Punkt)', 'highlights', rawHighlights, 'Ein Punkt pro Zeile')}
              {renderListField('Alt‑Texte (eine Zeile = ein Bild)', 'image_alt_texts', rawImageAltTexts, 'Ein Bildtitel pro Zeile')}
            </div>

            <div style={previewCardStyle}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                SEO‑Vorschau
              </div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '6px' }}>
                {form.seo_title || form.seo_h1 || selectedOffer?.title || 'SEO‑Titel'}
              </div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>
                {form.seo_description || form.short_description || form.long_description || 'SEO‑Description'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px' }}>
                /immobilienangebote/{form.external_id}_&lt;titel&gt;
              </div>
            </div>

            <div style={previewCardStyle}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                OG / Twitter Vorschau
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '6px' }}>
                {form.seo_title || form.seo_h1 || selectedOffer?.title || 'Titel für Social'}
              </div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>
                {form.seo_description || form.short_description || form.long_description || 'Beschreibung für Social'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px' }}>
                {selectedOffer?.image_url ? `Bild: ${selectedOffer.image_url}` : 'Bild: (kein Bild gesetzt)'}
              </div>
            </div>

            <div style={contentPreviewGridStyle}>
              <div style={contentPreviewCardStyle}>
                <div style={contentPreviewLabelStyle}>Teaser</div>
                <div style={contentPreviewBodyStyle}>
                  {form.short_description || 'Kein Teaser gepflegt.'}
                </div>
              </div>
              <div style={contentPreviewCardStyle}>
                <div style={contentPreviewLabelStyle}>Langtext</div>
                <div style={contentPreviewBodyStyle}>
                  {form.long_description || 'Kein Langtext gepflegt.'}
                </div>
              </div>
              <div style={contentPreviewCardStyle}>
                <div style={contentPreviewLabelStyle}>Lage</div>
                <div style={contentPreviewBodyStyle}>
                  {form.location_text || 'Kein Lage-Text gepflegt.'}
                </div>
              </div>
              <div style={contentPreviewCardStyle}>
                <div style={contentPreviewLabelStyle}>Ausstattung</div>
                <div style={contentPreviewBodyStyle}>
                  {form.features_text || 'Kein Ausstattungs-Text gepflegt.'}
                </div>
              </div>
            </div>

            <button onClick={() => saveOverride()} disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Speichern...' : 'SEO-Overrides speichern'}
            </button>
          </>
        )}
      </section>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '20px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const visibilityShellStyle: React.CSSProperties = {
  width: '100%',
  padding: '0 0 0',
  marginBottom: 0,
};

const panelTitleStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
  minHeight: '80px',
  resize: 'vertical' as const,
};

const fieldCardStyle: React.CSSProperties = {
  marginBottom: '8px',
  paddingBottom: '14px',
  borderBottom: '1px solid #f1f5f9',
};

const fieldHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const fieldHeaderActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const customizedBadgeStyle: React.CSSProperties = {
  color: '#10b981',
  fontSize: '11px',
  fontWeight: '700',
};

const editorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 280px',
  gap: '18px',
};

const textareaWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const filterButtonStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '6px 8px',
  borderRadius: '999px',
  border: `1px solid ${active ? '#486b7a' : '#e2e8f0'}`,
  backgroundColor: active ? '#486b7a' : '#f8fafc',
  color: active ? '#fff' : '#1e293b',
  fontSize: '12px',
  cursor: 'pointer',
});

const offerRowStyle = (active: boolean): React.CSSProperties => ({
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

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: '#0f172a',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const previewCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px',
  marginBottom: '16px',
};

const previewBoxStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  height: 'fit-content',
};

const previewHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '9px',
  fontWeight: 800,
  color: '#94a3b8',
  borderBottom: '1px solid #e2e8f0',
  letterSpacing: '0.05em',
};

const previewContentStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: '12.5px',
  color: '#64748b',
  lineHeight: 1.5,
  fontStyle: 'italic',
  whiteSpace: 'pre-wrap',
};

const contentPreviewGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginBottom: '16px',
};

const contentPreviewCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '14px',
};

const contentPreviewLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748b',
  fontWeight: 700,
  marginBottom: '8px',
};

const contentPreviewBodyStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.55,
  color: '#0f172a',
  whiteSpace: 'pre-wrap',
};

const offerSummaryCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '14px 16px',
  marginBottom: '16px',
};

const offerSummaryHeaderStyle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748b',
  fontWeight: 700,
  marginBottom: '10px',
};

const offerSummaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const offerSummaryLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  marginBottom: '4px',
  fontWeight: 700,
};

const offerSummaryValueStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#0f172a',
  fontWeight: 600,
  lineHeight: 1.4,
};

const mediaCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '14px 16px',
  marginBottom: '16px',
  display: 'grid',
  gap: '16px',
};

const mediaSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const mediaSectionHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#0f172a',
};

const mediaSectionHintStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#64748b',
};

const mediaCountBadgeStyle: React.CSSProperties = {
  borderRadius: '999px',
  background: '#e0f2fe',
  color: '#075985',
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 700,
};

const mediaCompactListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const mediaEmptyStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  padding: '12px 0 4px',
};

const slideshowCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '12px',
};

const slideshowStageStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr) 44px',
  gap: '12px',
  alignItems: 'stretch',
};

const slideshowNavButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '28px',
  lineHeight: 1,
  cursor: 'pointer',
};

const slideshowImageFrameStyle: React.CSSProperties = {
  minHeight: '340px',
  border: '1px solid #dbeafe',
  borderRadius: '12px',
  background: '#e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  padding: '10px',
};

const slideshowImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
};

const slideshowMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const slideshowCaptionStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.45,
  color: '#0f172a',
  fontWeight: 700,
};

const slideshowCounterStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#64748b',
  whiteSpace: 'nowrap',
};

const thumbnailRailStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
  gap: '10px',
};

const thumbnailButtonStyle = (active: boolean): React.CSSProperties => ({
  border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
  borderRadius: '10px',
  background: '#ffffff',
  padding: '4px',
  cursor: 'pointer',
  overflow: 'hidden',
});

const thumbnailImageStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'cover',
  display: 'block',
  borderRadius: '6px',
};

const floorplanCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '12px',
};

const floorplanPreviewFrameStyle: React.CSSProperties = {
  minHeight: '260px',
  border: '1px solid #dbeafe',
  borderRadius: '12px',
  background: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  padding: '12px',
};

const floorplanPreviewImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
};

const mediaLinkCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  border: '1px solid #dbeafe',
  borderRadius: '10px',
  background: '#ffffff',
  padding: '12px 14px',
  textDecoration: 'none',
};

const mediaLinkTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.45,
  fontWeight: 700,
  color: '#0f172a',
};

const mediaLinkMetaStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#2563eb',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const energyCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '14px 16px',
  marginBottom: '16px',
};

const energyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const energyMissingWrapStyle: React.CSSProperties = {
  marginTop: '14px',
  borderRadius: '10px',
  border: '1px solid #fde68a',
  background: '#fffbeb',
  padding: '12px 14px',
};

const energyMissingHeadStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#92400e',
  fontWeight: 700,
  marginBottom: '6px',
};

const energyMissingListStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#78350f',
};

const energyReadyStyle: React.CSSProperties = {
  marginTop: '14px',
  borderRadius: '10px',
  border: '1px solid #bbf7d0',
  background: '#f0fdf4',
  padding: '12px 14px',
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#166534',
  fontWeight: 700,
};

const aiButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '9px 16px',
  backgroundColor: '#eff6ff',
  color: '#2563eb',
  border: '1px solid #dbeafe',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const aiButtonLoadingStyle: React.CSSProperties = {
  ...aiButtonStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
  backgroundColor: '#f1f5f9',
};

const aiActionsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
};

const aiSelectStyle: React.CSSProperties = {
  minWidth: '240px',
  maxWidth: '100%',
  height: '38px',
  border: '1px solid #dbeafe',
  borderRadius: '8px',
  backgroundColor: '#fff',
  color: '#1e293b',
  fontSize: '12px',
  fontWeight: 600,
  padding: '6px 10px',
};

const aiMissingHintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
};

const promptToggleStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  color: '#2563eb',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};

const promptPanelStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '12px',
  backgroundColor: '#f8fafc',
};

const promptLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  fontWeight: 700,
  marginBottom: '6px',
};

const promptContentStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#475569',
  marginBottom: '10px',
  lineHeight: 1.5,
};

const promptInputLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#1e293b',
};

const promptInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '80px',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '12px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
};

const warningStyle: React.CSSProperties = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fdba74',
  color: '#9a3412',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '12px',
  marginBottom: '12px',
};

const resetButtonStyle = (hasOverride: boolean): React.CSSProperties => ({
  backgroundColor: hasOverride ? '#f1f5f9' : '#ecfdf3',
  color: hasOverride ? '#475569' : '#15803d',
  border: hasOverride ? '1px solid #e2e8f0' : '1px solid #bbf7d0',
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '10px',
  cursor: 'pointer',
});

const visibilityCardStyle: React.CSSProperties = {
  border: '1px solid #99f6b4',
  borderRadius: '12px',
  background: 'rgb(72, 107, 122)',
  padding: '14px 16px',
  display: 'grid',
  gap: '12px',
  marginBottom: '8px',
};

const visibilityControlsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const visibilityLabelStyle: React.CSSProperties = {
  display: 'block',
  flex: '1 1 420px',
};

const visibilityModelWrapStyle: React.CSSProperties = {
  flex: '0 1 320px',
};

const visibilitySelectWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const visibilitySelectStyle: React.CSSProperties = {
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

const visibilitySelectChevronStyle: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '14px',
  lineHeight: 1,
  color: '#475569',
  pointerEvents: 'none',
};

function visibilityMessageStyle(tone: VisibilityTone): React.CSSProperties {
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
