// app/dashboard/TextEditorForm.tsx

'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

// 1. Die vollständige Konfiguration basierend auf deinen Vorgaben
const TAB_CONFIG = [
  { id: 'berater', label: 'Berater', icon: '👤', sections: [
    { key: 'berater_name', label: 'Name', type: 'individual' },
    { key: 'berater_email', label: 'E-Mail', type: 'individual' },
    { key: 'berater_telefon', label: 'Telefon', type: 'individual' },
    { key: 'berater_telefon_whatsApp', label: 'WhatsApp', type: 'individual' },
    { key: 'berater_adresse_strasse', label: 'Straße', type: 'individual' },
    { key: 'berater_adresse_hnr', label: 'Hausnummer', type: 'individual' },
    { key: 'berater_adresse_plz', label: 'PLZ', type: 'individual' },
    { key: 'berater_adresse_ort', label: 'Ort', type: 'individual' },
    { key: 'berater_beschreibung', label: 'Kurz-Bio / Beschreibung', type: 'individual' },
    { key: 'berater_ausbildung', label: 'Qualifikationen / Ausbildung', type: 'individual' },
  ]},
  { id: 'makler', label: 'Makler', icon: '🏢', sections: [
    { key: 'makler_name', label: 'Firma / Name', type: 'individual' },
    { key: 'makler_empfehlung', label: 'Empfehlungstext', type: 'individual' },
    { key: 'makler_beschreibung', label: 'Leistungsbeschreibung', type: 'individual' },
    { key: 'makler_benefits', label: 'Vorteile / Benefits', type: 'individual' },
    { key: 'makler_provision', label: 'Provisionshinweis', type: 'individual' },
  ]},
  { id: 'marktueberblick', label: 'Marktüberblick', icon: '📊', sections: [
    { key: 'immobilienmarkt_allgemein', label: 'Berater-Ansprache (Teaser)', type: 'general' },
    { key: 'immobilienmarkt_standort_teaser', label: 'Standort Teaser', type: 'general' },
    { key: 'immobilienmarkt_individuell_01', label: 'Individueller Text 01', type: 'individual' },
    { key: 'immobilienmarkt_zitat', label: 'Experten-Zitat', type: 'individual' },
    { key: 'immobilienmarkt_individuell_02', label: 'Individueller Text 02', type: 'individual' },
    { key: 'immobilienmarkt_beschreibung_01', label: 'Marktanalyse Teil 1', type: 'data_driven' },
    { key: 'immobilienmarkt_beschreibung_02', label: 'Marktanalyse Teil 2', type: 'data_driven' },
    { key: 'immobilienmarkt_besonderheiten', label: 'Kaufnebenkosten Info', type: 'general' },
    { key: 'immobilienmarkt_maklerempfehlung', label: 'Maklerempfehlung', type: 'individual' },
  ]},
  { id: 'immobilienpreise', label: 'Immobilienpreise', icon: '🏠', sections: [
    { key: 'immobilienpreise_intro', label: 'Einleitung Preise', type: 'general' },
    { key: 'ueberschrift_immobilienpreise_haus', label: 'H2 Überschrift Haus', type: 'individual' },
    { key: 'immobilienpreise_haus_intro', label: 'Intro Hauspreise', type: 'general' },
    { key: 'immobilienpreise_haus_allgemein', label: 'Hauspreise Allgemein', type: 'data_driven' },
    { key: 'immobilienpreise_haus_lage', label: 'Einfluss der Lage', type: 'data_driven' },
    { key: 'immobilienpreise_haus_haustypen', label: 'Preise nach Haustypen', type: 'data_driven' },
    { key: 'immobilienpreise_haus_preisentwicklung', label: 'Preisentwicklung Haus', type: 'data_driven' },
    { key: 'ueberschrift_immobilienpreise_wohnung', label: 'H2 Überschrift Wohnung', type: 'individual' },
    { key: 'immobilienpreise_wohnung_intro', label: 'Intro Wohnungspreise', type: 'general' },
    { key: 'immobilienpreise_wohnung_allgemein', label: 'Wohnungspreise Allgemein', type: 'data_driven' },
    { key: 'immobilienpreise_wohnung_lage', label: 'Lagefaktoren Wohnung', type: 'data_driven' },
    { key: 'immobilienpreise_wohnung_preisentwicklung', label: 'Preisentwicklung Wohnung', type: 'data_driven' },
    { key: 'immobilienpreise_wohnung_nach_flaechen_und_zimmern', label: 'Preise nach Zimmer/Fläche', type: 'data_driven' },
  ]},
  { id: 'mietpreise', label: 'Mietpreise', icon: '🔑', sections: [
    { key: 'mietpreise_intro', label: 'Einleitung Mieten', type: 'general' },
    { key: 'mietpreise_allgemein', label: 'Mietmarkt Übersicht', type: 'data_driven' },
    { key: 'ueberschrift_mietpreise_wohnung', label: 'H2 Mietpreise Wohnung', type: 'individual' },
    { key: 'mietpreise_wohnung_allgemein', label: 'Wohnungsmieten Allgemein', type: 'data_driven' },
    { key: 'mietpreise_wohnung_nach_flaechen_und_zimmern', label: 'Mieten nach Segmenten', type: 'data_driven' },
    { key: 'mietpreise_wohnung_preisentwicklung', label: 'Preisentwicklung Miete (ETW)', type: 'data_driven' },
    { key: 'ueberschrift_mietpreise_haus', label: 'H2 Mietpreise Haus', type: 'individual' },
    { key: 'mietpreise_haus_allgemein', label: 'Hausmieten Allgemein', type: 'data_driven' },
    { key: 'mietpreise_haus_preisentwicklung', label: 'Preisentwicklung Miete (Haus)', type: 'data_driven' },
  ]},
  { id: 'mietrendite', label: 'Mietrendite', icon: '📈', sections: [
    { key: 'mietrendite_intro', label: 'Einleitung Rendite', type: 'general' },
    { key: 'mietrendite_kaufpreisfaktor', label: 'Kaufpreisfaktor Info', type: 'general' },
    { key: 'ueberschrift_mietrendite_bruttomietrendite', label: 'H2 Bruttomietrendite', type: 'individual' },
    { key: 'mietrendite_allgemein', label: 'Rendite Analyse', type: 'data_driven' },
    { key: 'mietrendite_hinweis', label: 'Wichtiger Hinweis', type: 'general' },
    { key: 'mietrendite_etw', label: 'Rendite ETW', type: 'data_driven' },
    { key: 'mietrendite_efh', label: 'Rendite EFH', type: 'data_driven' },
    { key: 'mietrendite_mfh', label: 'Rendite MFH', type: 'data_driven' },
  ]},
  { id: 'wohnmarktsituation', label: 'Wohnmarkt', icon: '🏢', sections: [
    { key: 'wohnmarktsituation_intro', label: 'Einleitung Markt', type: 'general' },
    { key: 'ueberschrift_wohnmarktsituation_wohnraumnachfrage_individuell', label: 'H2 Nachfrage individuell', type: 'individual' },
    { key: 'wohnmarktsituation_allgemein', label: 'Nachfrage Analyse', type: 'data_driven' },
    { key: 'wohnmarktsituation_bevoelkerungsentwicklung', label: 'Bevölkerung', type: 'data_driven' },
    { key: 'wohnmarktsituation_haushalte', label: 'Haushalte', type: 'data_driven' },
    { key: 'wohnmarktsituation_natuerlicher_saldo', label: 'Nat. Saldo Daten', type: 'data_driven' },
    { key: 'wohnmarktsituation_wanderungssaldo', label: 'Wanderung Daten', type: 'data_driven' },
    { key: 'wohnmarktsituation_alterstruktur', label: 'Altersstruktur', type: 'data_driven' },
    { key: 'wohnmarktsituation_jugendquotient_altenquotient', label: 'Quotienten Daten', type: 'data_driven' },
    { key: 'wohnmarktsituation_wohnungsbestand_anzahl', label: 'Anzahl Wohnungen', type: 'data_driven' },
    { key: 'wohnmarktsituation_wohnungsbestand_wohnflaeche', label: 'Wohnfläche Bestand', type: 'data_driven' },
    { key: 'wohnmarktsituation_baufertigstellungen', label: 'Fertigstellungen Daten', type: 'data_driven' },
    { key: 'wohnmarktsituation_baugenehmigungen', label: 'Genehmigungen Daten', type: 'data_driven' },
    { key: 'wohnmarktsituation_bauueberhang_baufortschritt', label: 'Bauüberhang', type: 'data_driven' },
  ]},
  { id: 'wohnlagencheck', label: 'Lagecheck', icon: '📍', sections: [
    { key: 'ueberschrift_wohnlagencheck_allgemein', label: 'H2 Wohnlagencheck', type: 'general' },
    { key: 'wohnlagencheck_allgemein', label: 'Allgemeine Lage', type: 'general' },
    { key: 'wohnlagencheck_lage', label: 'Detail-Lage', type: 'general' },
    { key: 'ueberschrift_wohnlagencheck_faktoren', label: 'H2 Standortfaktoren', type: 'individual' },
    { key: 'wohnlagencheck_faktor_mobilitaet', label: 'Mobilität', type: 'general' },
    { key: 'wohnlagencheck_faktor_bildung', label: 'Bildung', type: 'general' },
    { key: 'wohnlagencheck_faktor_gesundheit', label: 'Gesundheit', type: 'general' },
    { key: 'wohnlagencheck_faktor_nahversorgung', label: 'Nahversorgung', type: 'general' },
    { key: 'wohnlagencheck_faktor_naherholung', label: 'Naherholung', type: 'general' },
    { key: 'wohnlagencheck_faktor_kultur_freizeit', label: 'Kultur & Freizeit', type: 'general' },
  ]},
  { id: 'wirtschaft', label: 'Wirtschaft', icon: '🏭', sections: [
    { key: 'wirtschaft_intro', label: 'Einleitung Wirtschaft', type: 'general' },
    { key: 'ueberschrift_wirtschaft_individuell', label: 'H2 Wirtschaft individuell', type: 'individual' },
    { key: 'wirtschaft_bruttoinlandsprodukt', label: 'BIP Analyse', type: 'data_driven' },
    { key: 'wirtschaft_einkommen', label: 'Einkommen', type: 'data_driven' },
    { key: 'ueberschrift_arbeitsmarkt_individuell', label: 'H2 Arbeitsmarkt individuell', type: 'individual' },
    { key: 'wirtschaft_arbeitsplatzzentralitaet', label: 'Zentralität', type: 'data_driven' },
    { key: 'wirtschaft_pendler', label: 'Pendlersaldo', type: 'data_driven' },
    { key: 'wirtschaft_sv_beschaeftigte_arbeitsort', label: 'Beschäftigte Arbeitsort', type: 'data_driven' },
    { key: 'wirtschaft_arbeitslosigkeit', label: 'Arbeitslosenquote', type: 'data_driven' },
  ]},
  { id: 'grundstueckspreise', label: 'Grundstücke', icon: '🌱', sections: [
    { key: 'grundstueckspreise_intro', label: 'Einleitung Grundstücke', type: 'general' },
    { key: 'ueberschrift_grundstueckspreise', label: 'H2 Grundstückspreise', type: 'individual' },
    { key: 'grundstueckspreise_allgemein', label: 'Grundstückspreise Daten', type: 'data_driven' },
    { key: 'grundstueckspreise_preisentwicklung', label: 'Entwicklung Grundstücke', type: 'data_driven' },
  ]}
];

export default function TextEditorForm({ config }: { config: any }) {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState('marktueberblick');
  const [loading, setLoading] = useState(true);
  const [baseTexts, setBaseTexts] = useState<any>(null);
  const [dbTexts, setDbTexts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const parts = config?.area_id ? config.area_id.split('-') : [];
  const isOrtslage = parts.length > 3;

  useEffect(() => {
  async function loadTexts() {
    if (!config?.area_id) return;
    setLoading(true);
    
    const bundeslandSlug = String(config?.areas?.bundesland_slug || '');
    const kreisSlug = isOrtslage ? String(config?.areas?.parent_slug || '') : String(config?.areas?.slug || '');
    const ortSlug = isOrtslage ? String(config?.areas?.slug || '') : '';

    try {
      if (bundeslandSlug && kreisSlug) {
        const res = await fetch('/api/fetch-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              bundesland: bundeslandSlug,
              kreis: kreisSlug,
              ortslage: ortSlug || null
          }),
        });
        
        const jsonTexts = await res.json();
        // Wir setzen das ganze Objekt, da dein API-Endpunkt direkt `jsonData.text` zurückgibt
        setBaseTexts({ text: jsonTexts });
      } else {
        setBaseTexts({ text: {} });
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('report_texts')
        .select('*')
        .eq('area_id', config.area_id)
        .eq('partner_id', user?.id);
      setDbTexts(data || []);
    } catch (err) { 
      console.error("Fehler beim Laden der JSON:", err); 
    } finally { 
      setLoading(false); 
    }
  }
  loadTexts();
}, [config, supabase]);

  const hiddenTabIds = new Set(['berater', 'makler', 'marktueberblick']);
  const visibleTabs = isOrtslage
    ? TAB_CONFIG.filter((tab) => !hiddenTabIds.has(tab.id))
    : TAB_CONFIG;

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const exists = visibleTabs.some((tab) => tab.id === activeTab);
    if (!exists) setActiveTab(visibleTabs[0].id);
  }, [activeTab, visibleTabs]);

  const saveText = async (key: string, content: string, type: string) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('report_texts').upsert({
        partner_id: user.id,
        area_id: config.area_id,
        section_key: key,
        text_type: type,
        optimized_content: content,
        last_updated: new Date().toISOString()
      }, { onConflict: 'partner_id,area_id,section_key' });
      setDbTexts(prev => {
        const filtered = prev.filter(t => t.section_key !== key);
        return [...filtered, { section_key: key, optimized_content: content }];
      });
    }
    setSaving(false);
  };

  const resetToOriginal = async (key: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !config?.area_id) return;
    await supabase
      .from('report_texts')
      .delete()
      .eq('area_id', config.area_id)
      .eq('section_key', key);
    setDbTexts((prev) => prev.filter((t) => t.section_key !== key));
  };

  const handleAiRewrite = async (key: string, currentText: string, type: string, label: string) => {
    setRewritingKey(key);
    try {
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: currentText, 
          areaName: config?.areas?.name || config.area_id,
          type: type,
          sectionLabel: label 
        }),
      });
      const data = await res.json();
      if (data.optimizedText) {
        saveText(key, data.optimizedText, type);
      }
    } catch (err) { console.error(err); }
    finally { setRewritingKey(null); }
  };

  const getRawTextFromJSON = (key: string) => {
    if (!baseTexts?.text) return '';
    const groups = Object.keys(baseTexts.text);
    for (const group of groups) {
      if (baseTexts.text[group][key]) return baseTexts.text[group][key];
    }
    return '';
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Sektionen werden geladen...</div>;

  const activeTabConfig = visibleTabs.find(t => t.id === activeTab);

  return (
    <div style={{ width: '100%' }}>
      {/* TABS */}
      <div style={tabContainerStyle}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={tabButtonStyle(activeTab === tab.id)}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div style={contentWrapperStyle}>
        {activeTabConfig?.sections.map((section) => (
          <TextEditorField 
            key={section.key}
            label={section.label}
            sectionKey={section.key}
            type={section.type}
            rawText={getRawTextFromJSON(section.key)}
            dbEntry={dbTexts.find(t => t.section_key === section.key)}
            onSave={saveText}
            onAiRewrite={handleAiRewrite}
            onReset={resetToOriginal}
            isRewriting={rewritingKey === section.key}
          />
        ))}
      </div>

      {saving && <div style={saveIndicatorStyle}>Speichere Änderungen...</div>}
    </div>
  );
}

// --- SUB-KOMPONENTE FÜR EINZELNE TEXTFELDER ---

function TextEditorField({ label, sectionKey, type, rawText, dbEntry, onSave, onAiRewrite, onReset, isRewriting }: any) {
    const [localValue, setLocalValue] = useState(dbEntry?.optimized_content ?? rawText ?? '');
    
    // Update local state when DB entry changes (e.g. after AI rewrite)
    useEffect(() => {
        if (dbEntry?.optimized_content !== undefined && dbEntry?.optimized_content !== null) {
            setLocalValue(dbEntry.optimized_content);
        } else {
            setLocalValue(rawText ?? '');
        }
    }, [dbEntry, rawText]);

    const currentText = localValue || rawText;
    const isIndividual = type === 'individual';

    return (
        <div style={fieldCardStyle}>
            <div style={fieldHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{label}</h4>
                    <span style={typeTagStyle(type)}>{type.replace('_', ' ')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {dbEntry && <span style={savedBadgeStyle}>✓ Individuell angepasst</span>}
                    <button
                        type="button"
                        onClick={() => onReset(sectionKey)}
                        style={resetButtonStyle(Boolean(dbEntry))}
                    >
                        Original nutzen
                    </button>
                </div>
            </div>
            
            <div style={editorGridStyle}>
                <div style={textareaWrapperStyle}>
                    <textarea 
                        value={currentText}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={(e) => onSave(sectionKey, e.target.value, type)}
                        style={textareaStyle}
                        placeholder="Inhalt bearbeiten..."
                    />
                    {!isIndividual && (
                        <button 
                            style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle} 
                            onClick={() => onAiRewrite(sectionKey, currentText, type, label)}
                            disabled={isRewriting}
                        >
                            {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
                        </button>
                    )}
                </div>
                
                <div style={previewBoxStyle}>
                    <div style={previewHeaderStyle}>ORIGINAL BASIS-TEXT (SYSTEM)</div>
                    <div style={previewContentStyle}>{rawText || 'Keine System-Vorlage vorhanden.'}</div>
                </div>
            </div>
        </div>
    );
}

// --- STYLES (FULL WIDTH) ---

const tabContainerStyle = { display: 'flex', backgroundColor: '#fff', padding: '8px 8px 0 8px', borderRadius: '12px 12px 0 0', borderBottom: '1px solid #e2e8f0', gap: '4px', overflowX: 'auto' as const };
const tabButtonStyle = (active: boolean) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 24px', border: 'none', borderBottom: active ? '3px solid #3b82f6' : '3px solid transparent', backgroundColor: active ? '#f8fafc' : 'transparent', color: active ? '#2563eb' : '#64748b', fontWeight: active ? '700' : '500', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'all 0.2s', borderRadius: '8px 8px 0 0' });
const contentWrapperStyle = { backgroundColor: '#fff', padding: '40px', borderRadius: '0 0 12px 12px', border: '1px solid #e2e8f0', borderTop: 'none' };
const fieldCardStyle = { marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' };
const fieldHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
const editorGridStyle = { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px' };
const textareaWrapperStyle = { display: 'flex', flexDirection: 'column' as const, gap: '12px' };
const textareaStyle = { width: '100%', minHeight: '200px', padding: '18px', borderRadius: '10px', border: '1px solid #cbd5e0', fontSize: '14.5px', lineHeight: '1.6', fontFamily: 'inherit', color: '#334155' };
const previewBoxStyle = { backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', height: 'fit-content' };
const previewHeaderStyle = { padding: '10px 15px', fontSize: '9px', fontWeight: '800', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', letterSpacing: '0.05em' };
const previewContentStyle = { padding: '15px', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5', fontStyle: 'italic' };
const aiButtonStyle = { alignSelf: 'flex-start', padding: '10px 18px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };
const aiButtonLoadingStyle = { ...aiButtonStyle, opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#f1f5f9' };
const typeTagStyle = (type: string) => ({ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', backgroundColor: type === 'individual' ? '#fef3c7' : (type === 'data_driven' ? '#dcfce7' : '#f1f5f9'), color: type === 'individual' ? '#92400e' : (type === 'data_driven' ? '#166534' : '#64748b'), fontWeight: '700', textTransform: 'uppercase' as const });
const savedBadgeStyle = { color: '#10b981', fontSize: '11px', fontWeight: '700' };
const resetButtonStyle = (hasOverride: boolean) => ({
  backgroundColor: hasOverride ? '#f1f5f9' : '#ecfdf3',
  color: hasOverride ? '#475569' : '#15803d',
  border: hasOverride ? '1px solid #e2e8f0' : '1px solid #bbf7d0',
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '10px',
  cursor: 'pointer',
});
const saveIndicatorStyle: React.CSSProperties = { position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', zIndex: 100, fontSize: '13px' };
