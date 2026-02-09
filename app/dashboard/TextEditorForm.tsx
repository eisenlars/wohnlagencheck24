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

const MARKETING_TAB_CONFIG = [
  {
    id: 'immobilienmarkt_ueberblick',
    label: 'Marktüberblick',
    icon: '🧭',
    sections: [
      { key: 'marketing.immobilienmarkt_ueberblick.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.immobilienmarkt_ueberblick.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.immobilienmarkt_ueberblick.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.immobilienmarkt_ueberblick.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.immobilienmarkt_ueberblick.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.immobilienmarkt_ueberblick.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.immobilienmarkt_ueberblick.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'immobilienpreise',
    label: 'Immobilienpreise',
    icon: '🏠',
    sections: [
      { key: 'marketing.immobilienpreise.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.immobilienpreise.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.immobilienpreise.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.immobilienpreise.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.immobilienpreise.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.immobilienpreise.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.immobilienpreise.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'mietpreise',
    label: 'Mietpreise',
    icon: '🔑',
    sections: [
      { key: 'marketing.mietpreise.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.mietpreise.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.mietpreise.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.mietpreise.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.mietpreise.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.mietpreise.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.mietpreise.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'mietrendite',
    label: 'Mietrendite',
    icon: '📈',
    sections: [
      { key: 'marketing.mietrendite.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.mietrendite.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.mietrendite.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.mietrendite.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.mietrendite.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.mietrendite.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.mietrendite.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'wohnmarktsituation',
    label: 'Wohnmarktsituation',
    icon: '🏢',
    sections: [
      { key: 'marketing.wohnmarktsituation.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.wohnmarktsituation.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.wohnmarktsituation.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.wohnmarktsituation.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.wohnmarktsituation.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.wohnmarktsituation.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.wohnmarktsituation.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'grundstueckspreise',
    label: 'Grundstücke',
    icon: '🌱',
    sections: [
      { key: 'marketing.grundstueckspreise.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.grundstueckspreise.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.grundstueckspreise.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.grundstueckspreise.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.grundstueckspreise.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.grundstueckspreise.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.grundstueckspreise.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'wohnlagencheck',
    label: 'Wohnlagencheck',
    icon: '📍',
    sections: [
      { key: 'marketing.wohnlagencheck.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.wohnlagencheck.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.wohnlagencheck.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.wohnlagencheck.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.wohnlagencheck.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.wohnlagencheck.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.wohnlagencheck.cta', label: 'CTA', type: 'marketing' },
    ],
  },
  {
    id: 'wirtschaft',
    label: 'Wirtschaft',
    icon: '🏭',
    sections: [
      { key: 'marketing.wirtschaft.title', label: 'Title', type: 'marketing' },
      { key: 'marketing.wirtschaft.description', label: 'Description', type: 'marketing' },
      { key: 'marketing.wirtschaft.summary', label: 'Summary', type: 'marketing' },
      { key: 'marketing.wirtschaft.primary_keyword', label: 'Primary Keyword', type: 'marketing' },
      { key: 'marketing.wirtschaft.secondary_keywords', label: 'Secondary Keywords (CSV)', type: 'marketing' },
      { key: 'marketing.wirtschaft.entities', label: 'Entities (CSV)', type: 'marketing' },
      { key: 'marketing.wirtschaft.cta', label: 'CTA', type: 'marketing' },
    ],
  },
];

type TextEntry = {
    section_key: string;
    optimized_content?: string | null;
    status?: string | null;
    text_type?: string | null;
    last_updated?: string | null;
};

type PartnerArea = {
  id?: string;
  name?: string;
  slug?: string;
  parent_slug?: string;
  bundesland_slug?: string;
};

type PartnerAreaConfig = {
  area_id: string;
  areas?: PartnerArea;
  [key: string]: unknown;
};

type TextEditorFormProps = {
    config: PartnerAreaConfig;
    tableName?: 'report_texts' | 'partner_local_site_texts' | 'partner_marketing_texts';
    enableApproval?: boolean;
    initialTabId?: string;
    focusSectionKey?: string;
    onFocusHandled?: () => void;
};

export default function TextEditorForm({
    config,
    tableName = 'report_texts',
    enableApproval = false,
    initialTabId,
    focusSectionKey,
    onFocusHandled,
}: TextEditorFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState('marktueberblick');
  const [loading, setLoading] = useState(true);
  const [baseTexts, setBaseTexts] = useState<{ text: Record<string, Record<string, string>> } | null>(null);
  const [dbTexts, setDbTexts] = useState<TextEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const parts = config?.area_id ? config.area_id.split('-') : [];
  const isOrtslage = parts.length > 3;
  const isMarketing = tableName === 'partner_marketing_texts';
  const isLocalSite = tableName === 'partner_local_site_texts';

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
        .from(tableName)
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
}, [config, supabase, tableName, isOrtslage]);

  const tabConfig = isMarketing ? MARKETING_TAB_CONFIG : TAB_CONFIG;
  const hiddenTabIds = new Set(['berater', 'makler', 'marktueberblick']);
  if (isLocalSite && !isOrtslage) {
    hiddenTabIds.delete('marktueberblick');
  }
  const shouldHideTabs = !isMarketing && (isOrtslage || isLocalSite);
  let visibleTabs = shouldHideTabs
    ? tabConfig.filter((tab) => !hiddenTabIds.has(tab.id))
    : tabConfig;
  if (isMarketing && isOrtslage) {
    visibleTabs = visibleTabs.filter((tab) => tab.id !== 'immobilienmarkt_ueberblick');
  }

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const exists = visibleTabs.some((tab) => tab.id === activeTab);
    if (!exists) setActiveTab(visibleTabs[0].id);
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!initialTabId) return;
    const exists = visibleTabs.some((tab) => tab.id === initialTabId);
    if (exists) setActiveTab(initialTabId);
  }, [initialTabId, visibleTabs]);

  useEffect(() => {
    if (!focusSectionKey) return;
    const id = `text-section-${focusSectionKey}`;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onFocusHandled?.();
        return true;
      }
      return false;
    };
    if (tryScroll()) return;
    const t = window.setTimeout(() => {
      tryScroll();
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusSectionKey, onFocusHandled]);

  const saveText = async (key: string, content: string, type: string, sourceGroup?: string | null) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const status = enableApproval ? 'draft' : 'approved';
      await supabase.from(tableName).upsert({
        partner_id: user.id,
        area_id: config.area_id,
        section_key: key,
        text_type: type,
        raw_content: getRawTextFromJSON(key, sourceGroup),
        optimized_content: content,
        status,
        last_updated: new Date().toISOString()
      }, { onConflict: 'partner_id,area_id,section_key' });
      setDbTexts(prev => {
        const filtered = prev.filter(t => t.section_key !== key);
        return [...filtered, { section_key: key, optimized_content: content, status, text_type: type }];
      });
    }
    setSaving(false);
  };

  const resetToOriginal = async (key: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !config?.area_id) return;
    await supabase
      .from(tableName)
      .delete()
      .eq('area_id', config.area_id)
      .eq('section_key', key);
    setDbTexts((prev) => prev.filter((t) => t.section_key !== key));
  };

  const approveAllTexts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const entriesToApprove = dbTexts
      .filter((entry) => Boolean(entry.optimized_content))
      .map((entry) => ({
        partner_id: user.id,
        area_id: config.area_id,
        section_key: entry.section_key,
        text_type: entry.text_type ?? null,
        raw_content: getRawTextFromJSON(entry.section_key),
        optimized_content: entry.optimized_content ?? '',
        status: 'approved',
        last_updated: new Date().toISOString(),
      }));
    if (entriesToApprove.length === 0) return;
    await supabase
      .from(tableName)
      .upsert(entriesToApprove, { onConflict: 'partner_id,area_id,section_key' });
    setDbTexts((prev) =>
      prev.map((entry) =>
        entry.optimized_content
          ? { ...entry, status: 'approved' }
          : entry,
      ),
    );
  };

  const handleAiRewrite = async (
    key: string,
    currentText: string,
    type: string,
    label: string,
    customPrompt?: string,
  ) => {
    setRewritingKey(key);
    try {
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: currentText, 
          areaName: config?.areas?.name || config.area_id,
          type: type,
          sectionLabel: label,
          customPrompt: customPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (data.optimizedText) {
        saveText(key, data.optimizedText, type);
      }
    } catch (err) { console.error(err); }
    finally { setRewritingKey(null); }
  };

  const getRawTextFromJSON = (key: string, preferredGroup?: string | null) => {
    if (!baseTexts?.text) return '';
    if (key.includes('.')) {
      const value = getValueByPath(baseTexts.text, key.split('.'));
      return typeof value === 'string' ? value : '';
    }
    if (preferredGroup && baseTexts.text[preferredGroup] && typeof baseTexts.text[preferredGroup] === 'object') {
      const preferred = baseTexts.text[preferredGroup][key];
      if (typeof preferred === 'string') return preferred;
    }
    const groups = Object.keys(baseTexts.text);
    for (const group of groups) {
      const value = baseTexts.text[group]?.[key];
      if (typeof value === 'string' && value.length > 0) return value;
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
        {activeTabConfig?.sections.map((section) => {
          const sectionGroup = resolveGroupForTab(activeTabConfig?.id);
          return (
          <TextEditorField 
            key={`${section.key}:${dbTexts.find(t => t.section_key === section.key)?.optimized_content ?? getRawTextFromJSON(section.key, sectionGroup) ?? ''}`}
            label={section.label}
            sectionKey={section.key}
            sectionGroup={sectionGroup}
            type={section.type}
            rawText={getRawTextFromJSON(section.key, sectionGroup)}
            dbEntry={dbTexts.find(t => t.section_key === section.key)}
            areaName={config?.areas?.name || config.area_id}
            onSave={saveText}
            onAiRewrite={handleAiRewrite}
            onReset={resetToOriginal}
            enableApproval={enableApproval}
            isRewriting={rewritingKey === section.key}
          />
          );
        })}
      </div>

      {enableApproval ? (
        <div style={approvalFooterStyle}>
          <button type="button" onClick={approveAllTexts} style={approveAllButtonStyle}>
            Texte freigeben
          </button>
          <span style={approvalHintStyle}>
            Freigabe setzt alle geänderten Textblöcke dieser Region auf „approved“.
          </span>
        </div>
      ) : null}

      {saving && <div style={saveIndicatorStyle}>Speichere Änderungen...</div>}
    </div>
  );
}

// --- SUB-KOMPONENTE FÜR EINZELNE TEXTFELDER ---

function getStandardPromptText(label: string, type: string, areaName: string) {
    const lowerLabel = String(label || '').toLowerCase();
    if (type === 'marketing') {
        if (lowerLabel.includes('primary keyword')) {
            return `Gib ein prägnantes Haupt-Keyword für ${areaName}. Keine Zahlen.`;
        }
        if (lowerLabel.includes('secondary keywords')) {
            return `Gib 3–6 sekundäre Keywords als CSV für ${areaName}. Keine Zahlen.`;
        }
        if (lowerLabel.includes('entities')) {
            return `Gib relevante Entitäten als CSV (Ort, Kreis, Bundesland, Thema). Kontext: ${areaName}.`;
        }
        if (lowerLabel.includes('summary')) {
            return `Schreibe eine 2–3 Sätze Zusammenfassung für ${areaName}. Keine Zahlen, keine neuen Fakten.`;
        }
        if (lowerLabel.includes('cta')) {
            return `Schreibe eine kurze, neutrale Handlungsaufforderung für ${areaName}.`;
        }
        if (lowerLabel.includes('description')) {
            return `Schreibe eine Meta-Description (140–160 Zeichen) mit lokalem Bezug für ${areaName}. Keine Zahlen.`;
        }
        if (lowerLabel.includes('title')) {
            return `Formuliere einen prägnanten SEO-Title (max. 60 Zeichen) für ${areaName}. Keine Zahlen.`;
        }
        return `Optimiere den Marketing-Text klar und prägnant. Kontext: ${areaName}. Keine neuen Fakten.`;
    }
    if (lowerLabel.includes('überschrift') || lowerLabel.includes('headline')) {
        return `Formuliere eine prägnante Überschrift (40–60 Zeichen), ohne neue Fakten.`;
    }
    if (lowerLabel.includes('titel')) {
        return `Formuliere einen prägnanten Titel (max. 60 Zeichen) für ${areaName}. Keine erfundenen Fakten.`;
    }
    if (lowerLabel.includes('description')) {
        return `Schreibe eine SEO-Description (140–160 Zeichen) für ${areaName}. Fakten beibehalten.`;
    }
    if (type === 'data_driven') {
        return `Formuliere den Text flüssiger. Alle Zahlen und Fakten müssen exakt gleich bleiben.`;
    }
    if (type === 'individual') {
        return `Formuliere den Text professionell und leicht individuell. Keine neuen Fakten hinzufügen.`;
    }
    return `Optimiere den Text für bessere Lesbarkeit und SEO. Keine neuen Fakten hinzufügen. Kontext: ${areaName}.`;
}

function getValueByPath(root: unknown, pathParts: string[]) {
    let current: unknown = root;
    for (const part of pathParts) {
        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function resolveGroupForTab(tabId: string | undefined): string | null {
  if (!tabId) return null;
  const map: Record<string, string> = {
    marktueberblick: 'immobilienmarkt_ueberblick',
    immobilienpreise: 'immobilienpreise',
    mietpreise: 'mietpreise',
    mietrendite: 'mietrendite',
    wohnmarktsituation: 'wohnmarktsituation',
    wohnlagencheck: 'wohnlagencheck',
    wirtschaft: 'wirtschaft',
    grundstueckspreise: 'grundstueckspreise',
  };
  return map[tabId] ?? null;
}

type TextEditorFieldProps = {
  label: string;
  sectionKey: string;
  sectionGroup: string | null;
  type: string;
  rawText: string;
  dbEntry?: TextEntry;
  areaName: string;
  onSave: (key: string, content: string, type: string, sourceGroup?: string | null) => void;
  onAiRewrite: (key: string, currentText: string, type: string, label: string, customPrompt?: string) => void;
  onReset: (key: string) => void;
  enableApproval: boolean;
  isRewriting: boolean;
};

function TextEditorField({
    label,
    sectionKey,
    sectionGroup,
    type,
    rawText,
    dbEntry,
    areaName,
    onSave,
    onAiRewrite,
    onReset,
    enableApproval,
    isRewriting,
}: TextEditorFieldProps) {
    const [localValue, setLocalValue] = useState(dbEntry?.optimized_content ?? rawText ?? '');
    const [showPrompt, setShowPrompt] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    
    const currentText = localValue || rawText;
    const isIndividual = type === 'individual';
    const standardPrompt = getStandardPromptText(label, type, areaName);
    const status = dbEntry?.status ?? null;
    const showStatus = enableApproval && Boolean(dbEntry?.status);
    const hasOverride = Boolean(dbEntry?.optimized_content);

    return (
        <div style={fieldCardStyle} id={`text-section-${sectionKey}`}>
            <div style={fieldHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{label}</h4>
                    <span style={typeTagStyle(type)}>{type.replace('_', ' ')}</span>
                    {showStatus ? (
                        <span style={statusBadgeStyle(status === 'approved')}>
                            {status === 'approved' ? 'Freigegeben' : 'Entwurf'}
                        </span>
                    ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {hasOverride && <span style={savedBadgeStyle}>✓ Individuell angepasst</span>}
                    <button
                        type="button"
                        onClick={() => onReset(sectionKey)}
                        style={resetButtonStyle(hasOverride)}
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
                        onBlur={(e) => onSave(sectionKey, e.target.value, type, sectionGroup)}
                        style={textareaStyle}
                        placeholder="Inhalt bearbeiten..."
                    />
                    {!isIndividual && (
                        <>
                            <button 
                                style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle} 
                                onClick={() => onAiRewrite(sectionKey, currentText, type, label, customPrompt)}
                                disabled={isRewriting}
                            >
                                {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPrompt((prev) => !prev)}
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
                                            onChange={(e) => setCustomPrompt(e.target.value)}
                                            style={promptInputStyle}
                                            placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
                                        />
                                    </label>
                                </div>
                            ) : null}
                        </>
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
const promptToggleStyle = { alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 };
const promptPanelStyle = { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#f8fafc' };
const promptLabelStyle = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#94a3b8', fontWeight: '700', marginBottom: '6px' };
const promptContentStyle = { fontSize: '12px', color: '#475569', marginBottom: '10px', lineHeight: 1.5 };
const promptInputLabelStyle = { display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '11px', fontWeight: '600', color: '#1e293b' };
const promptInputStyle = { width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', lineHeight: '1.4', fontFamily: 'inherit' };
const typeTagStyle = (type: string) => ({
  fontSize: '9px',
  padding: '2px 7px',
  borderRadius: '4px',
  backgroundColor:
    type === 'individual'
      ? '#fef3c7'
      : type === 'data_driven'
        ? '#dcfce7'
        : type === 'marketing'
          ? '#e0f2fe'
          : '#f1f5f9',
  color:
    type === 'individual'
      ? '#92400e'
      : type === 'data_driven'
        ? '#166534'
        : type === 'marketing'
          ? '#0369a1'
          : '#64748b',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
});
const savedBadgeStyle = { color: '#10b981', fontSize: '11px', fontWeight: '700' };
const statusBadgeStyle = (approved: boolean) => ({
  fontSize: '10px',
  padding: '2px 6px',
  borderRadius: '6px',
  backgroundColor: approved ? '#dcfce7' : '#fef3c7',
  color: approved ? '#166534' : '#92400e',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
});
const resetButtonStyle = (hasOverride: boolean) => ({
  backgroundColor: hasOverride ? '#f1f5f9' : '#ecfdf3',
  color: hasOverride ? '#475569' : '#15803d',
  border: hasOverride ? '1px solid #e2e8f0' : '1px solid #bbf7d0',
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '10px',
  cursor: 'pointer',
});
const approvalFooterStyle: React.CSSProperties = {
  marginTop: '24px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};
const approveAllButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: '#0f172a',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const approvalHintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
};
const saveIndicatorStyle: React.CSSProperties = { position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', zIndex: 100, fontSize: '13px' };
