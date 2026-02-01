'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

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

export default function OffersManager() {
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

      setOffers(offersData || []);
      setOverrides(overridesData || []);
      setSelectedOfferId(offersData?.[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, []);

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
    () => (typeof selectedRaw.description === 'string' ? selectedRaw.description : ''),
    [selectedRaw],
  );
  const rawLocation = useMemo(() => {
    if (typeof selectedRaw.location === 'string' && selectedRaw.location) {
      return selectedRaw.location;
    }
    return rawDescription;
  }, [selectedRaw, rawDescription]);
  const rawFeatures = useMemo(
    () => (typeof selectedRaw.features_note === 'string' ? selectedRaw.features_note : ''),
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

  const updateField = (key: keyof OverrideRow, value: any) => {
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
        }),
      });
      const data = await res.json();
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

  const resetField = async (key: keyof OverrideRow, fallback: any) => {
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
            <button
              type="button"
              style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
              onClick={() => handleAiRewrite(key, value, label, customPrompt)}
              disabled={isRewriting}
            >
              {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
            </button>
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
            <button
              type="button"
              style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
              onClick={() => handleAiRewrite(key, value, label, customPrompt)}
              disabled={isRewriting}
            >
              {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
            </button>
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

  if (loading) return <div style={{ padding: '20px' }}>Immobilien werden geladen...</div>;

  return (
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
        <h3 style={panelTitleStyle}>SEO‑Overrides</h3>
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

            <button onClick={() => saveOverride()} disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Speichern...' : 'SEO-Overrides speichern'}
            </button>
          </>
        )}
      </section>
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
