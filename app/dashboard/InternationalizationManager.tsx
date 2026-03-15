'use client';

import { useEffect, useMemo, useState } from 'react';
import NextImage from 'next/image';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import { createClient } from '@/utils/supabase/client';
import {
  resolveDisplayTextClass,
  displayTextClassLabel,
  displayTextBadgeStyle,
  type DisplayTextClass,
} from '@/lib/text-display-class';
import {
  I18N_CHANNEL_OPTIONS,
  I18N_SCOPE_OPTIONS,
  i18nWorkflowClassCycle,
  i18nWorkflowClassDescription,
  i18nWorkflowClassTitle,
  isDistrictArea,
  type I18nChannel,
  type I18nScope,
} from '@/lib/i18n-workflow';
import {
  estimateTranslationTotals,
  type I18nEstimatePricing,
} from '@/lib/i18n-cost-estimate';

type AreaConfig = {
  area_id: string;
  areas?: {
    name?: string;
    slug?: string;
    parent_slug?: string;
    bundesland_slug?: string;
  };
};

type TranslationRow = {
  area_id: string;
  area_name: string;
  section_key: string;
  source_content_de: string;
  source_status: string | null;
  source_updated_at: string | null;
  source_snapshot_hash?: string | null;
  translated_content: string | null;
  translated_status: string | null;
  translated_updated_at: string | null;
  translated_source_snapshot_hash?: string | null;
  translated_source_last_updated?: string | null;
  translation_is_stale?: boolean;
  effective_content: string;
  effective_source: 'translation' | 'de_fallback';
};

type Props = {
  config: AreaConfig;
  availableLocales: string[];
};

type LlmOption = {
  id: string;
  label: string;
  partner_integration_id: string | null;
  global_provider_id: string | null;
};

type PricingPreview = I18nEstimatePricing;
type ScopeArea = {
  area_id: string;
  area_name: string;
};

type SectionKind = 'general' | 'data_driven' | 'individual' | 'marketing';

const I18N_MOCK_TRANSLATION = process.env.NEXT_PUBLIC_I18N_MOCK_TRANSLATION === '1';

const I18N_TAB_ORDER = [
  { id: 'berater', label: 'Berater', icon: '👤' },
  { id: 'makler', label: 'Makler', icon: '🏢' },
  { id: 'marktueberblick', label: 'Marktüberblick', icon: '/icons/ws24_marktbericht_ueberblick.svg' },
  { id: 'immobilienpreise', label: 'Immobilienpreise', icon: '/icons/ws24_marktbericht_immobilienpreise.svg' },
  { id: 'mietpreise', label: 'Mietpreise', icon: '/icons/ws24_marktbericht_mietpreise.svg' },
  { id: 'mietrendite', label: 'Mietrendite', icon: '/icons/ws24_marktbericht_mietrendite.svg' },
  { id: 'wohnmarktsituation', label: 'Wohnmarktsituation', icon: '/icons/ws24_marktbericht_wohnmarktsituation.svg' },
  { id: 'wohnlagencheck', label: 'Lagecheck', icon: '/icons/ws24_marktbericht_wohnlagencheck.svg' },
  { id: 'wirtschaft', label: 'Wirtschaft', icon: '/icons/ws24_marktbericht_wirtschaft.svg' },
  { id: 'grundstueckspreise', label: 'Grundstücke', icon: '/icons/ws24_marktbericht_grundstueckspreise.svg' },
] as const;

const TAB_SECTION_CONFIG: Record<string, Array<{ key: string; label: string; type: SectionKind }>> = {
  berater: [
    { key: 'berater_name', label: 'Name', type: 'individual' },
    { key: 'berater_email', label: 'E-Mail', type: 'individual' },
    { key: 'berater_telefon_fest', label: 'Telefon (Festnetz)', type: 'individual' },
    { key: 'berater_telefon_mobil', label: 'Telefon (Mobil)', type: 'individual' },
    { key: 'berater_adresse_strasse', label: 'Straße', type: 'individual' },
    { key: 'berater_adresse_hnr', label: 'Hausnummer', type: 'individual' },
    { key: 'berater_adresse_plz', label: 'PLZ', type: 'individual' },
    { key: 'berater_adresse_ort', label: 'Ort', type: 'individual' },
    { key: 'berater_beschreibung', label: 'Kurz-Bio / Beschreibung', type: 'individual' },
    { key: 'berater_ausbildung', label: 'Qualifikationen / Ausbildung', type: 'individual' },
  ],
  makler: [
    { key: 'makler_name', label: 'Firma / Name', type: 'individual' },
    { key: 'makler_email', label: 'E-Mail', type: 'individual' },
    { key: 'makler_telefon_fest', label: 'Telefon (Festnetz)', type: 'individual' },
    { key: 'makler_telefon_mobil', label: 'Telefon (Mobil)', type: 'individual' },
    { key: 'makler_adresse_strasse', label: 'Straße', type: 'individual' },
    { key: 'makler_adresse_hnr', label: 'Hausnummer', type: 'individual' },
    { key: 'makler_adresse_plz', label: 'PLZ', type: 'individual' },
    { key: 'makler_adresse_ort', label: 'Ort', type: 'individual' },
    { key: 'makler_empfehlung', label: 'Empfehlungstext', type: 'individual' },
    { key: 'makler_beschreibung', label: 'Leistungsbeschreibung', type: 'individual' },
    { key: 'makler_benefits', label: 'Vorteile / Benefits', type: 'individual' },
    { key: 'makler_provision', label: 'Provisionshinweis', type: 'individual' },
  ],
  marktueberblick: [
    { key: 'immobilienmarkt_allgemein', label: 'Berater-Ansprache (Teaser)', type: 'general' },
    { key: 'immobilienmarkt_standort_teaser', label: 'Standort Teaser', type: 'general' },
    { key: 'immobilienmarkt_individuell_01', label: 'Experteneinschätzung Text 01', type: 'individual' },
    { key: 'immobilienmarkt_zitat', label: 'Experten-Zitat', type: 'individual' },
    { key: 'immobilienmarkt_individuell_02', label: 'Experteneinschätzung Text 02', type: 'individual' },
    { key: 'immobilienmarkt_beschreibung_01', label: 'Marktanalyse Teil 1', type: 'data_driven' },
    { key: 'immobilienmarkt_beschreibung_02', label: 'Marktanalyse Teil 2', type: 'data_driven' },
    { key: 'immobilienmarkt_besonderheiten', label: 'Kaufnebenkosten Info', type: 'general' },
    { key: 'immobilienmarkt_maklerempfehlung', label: 'Maklerempfehlung', type: 'individual' },
  ],
  immobilienpreise: [
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
  ],
  mietpreise: [
    { key: 'mietpreise_intro', label: 'Einleitung Mieten', type: 'general' },
    { key: 'mietpreise_allgemein', label: 'Mietmarkt Übersicht', type: 'data_driven' },
    { key: 'ueberschrift_mietpreise_wohnung', label: 'H2 Mietpreise Wohnung', type: 'individual' },
    { key: 'mietpreise_wohnung_allgemein', label: 'Wohnungsmieten Allgemein', type: 'data_driven' },
    { key: 'mietpreise_wohnung_nach_flaechen_und_zimmern', label: 'Mieten nach Segmenten', type: 'data_driven' },
    { key: 'mietpreise_wohnung_preisentwicklung', label: 'Preisentwicklung Miete (ETW)', type: 'data_driven' },
    { key: 'ueberschrift_mietpreise_haus', label: 'H2 Mietpreise Haus', type: 'individual' },
    { key: 'mietpreise_haus_allgemein', label: 'Hausmieten Allgemein', type: 'data_driven' },
    { key: 'mietpreise_haus_preisentwicklung', label: 'Preisentwicklung Miete (Haus)', type: 'data_driven' },
  ],
  mietrendite: [
    { key: 'mietrendite_intro', label: 'Einleitung Rendite', type: 'general' },
    { key: 'mietrendite_kaufpreisfaktor', label: 'Kaufpreisfaktor Info', type: 'general' },
    { key: 'ueberschrift_mietrendite_bruttomietrendite', label: 'H2 Bruttomietrendite', type: 'individual' },
    { key: 'mietrendite_allgemein', label: 'Rendite Analyse', type: 'data_driven' },
    { key: 'mietrendite_hinweis', label: 'Wichtiger Hinweis', type: 'general' },
    { key: 'mietrendite_etw', label: 'Rendite ETW', type: 'data_driven' },
    { key: 'mietrendite_efh', label: 'Rendite EFH', type: 'data_driven' },
    { key: 'mietrendite_mfh', label: 'Rendite MFH', type: 'data_driven' },
  ],
  wohnmarktsituation: [
    { key: 'wohnmarktsituation_intro', label: 'Einleitung Markt', type: 'general' },
    { key: 'wohnmarktsituation_wohnraumnachfrage', label: 'Nachfrage Introtext', type: 'general' },
    { key: 'wohnmarktsituation_wohnraumangebot_intro', label: 'Wohnraumangebot Introtext', type: 'general' },
    { key: 'wohnmarktsituation_wohnungsbestand_intro', label: 'Wohnungsbestand Introtext', type: 'general' },
    { key: 'wohnmarktsituation_baufertigstellungen_intro', label: 'Baufertigstellungen Introtext', type: 'general' },
    { key: 'wohnmarktsituation_baugenehmigungen_intro', label: 'Baugenehmigungen Introtext', type: 'general' },
    { key: 'wohnmarktsituation_bautaetigkeit_intro', label: 'Bautätigkeit Introtext', type: 'general' },
    { key: 'wohnmarktsituation_natuerlicher_saldo_intro', label: 'Natürlicher Saldo Introtext', type: 'general' },
    { key: 'wohnmarktsituation_wanderungssaldo_intro', label: 'Wanderungssaldo Introtext', type: 'general' },
    { key: 'wohnmarktsituation_jugendquotient_altenquotient_intro', label: 'Jugend-/Altenquotient Introtext', type: 'general' },
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
  ],
  wohnlagencheck: [
    { key: 'ueberschrift_wohnlagencheck_allgemein', label: 'H2 Wohnlagencheck', type: 'general' },
    { key: 'wohnlagencheck_allgemein', label: 'Allgemeine Lage', type: 'general' },
    { key: 'wohnlagencheck_lage', label: 'Detail-Lage', type: 'general' },
    { key: 'wohnlagencheck_standortfaktoren_intro', label: 'Standortfaktoren Intro', type: 'general' },
    { key: 'ueberschrift_wohnlagencheck_faktoren', label: 'H2 Standortfaktoren', type: 'individual' },
    { key: 'wohnlagencheck_faktor_mobilitaet', label: 'Mobilität', type: 'general' },
    { key: 'wohnlagencheck_faktor_bildung', label: 'Bildung', type: 'general' },
    { key: 'wohnlagencheck_faktor_gesundheit', label: 'Gesundheit', type: 'general' },
    { key: 'wohnlagencheck_faktor_nahversorgung', label: 'Nahversorgung', type: 'general' },
    { key: 'wohnlagencheck_faktor_naherholung', label: 'Naherholung', type: 'general' },
    { key: 'wohnlagencheck_faktor_kultur_freizeit', label: 'Kultur & Freizeit', type: 'general' },
    { key: 'wohnlagencheck_faktor_arbeitsplatz', label: 'Arbeitsplatz', type: 'general' },
    { key: 'wohnlagencheck_faktor_lebenserhaltungskosten', label: 'Lebenserhaltungskosten', type: 'general' },
    { key: 'wohnlagencheck_faktor_sicherheit', label: 'Sicherheit', type: 'general' },
  ],
  wirtschaft: [
    { key: 'wirtschaft_intro', label: 'Einleitung Wirtschaft', type: 'general' },
    { key: 'wirtschaft_arbeitsmarkt', label: 'Arbeitsmarkt Introtext', type: 'general' },
    { key: 'wirtschaft_gewerbesaldo', label: 'Gewerbesaldo Introtext', type: 'general' },
    { key: 'wirtschaft_arbeitslosendichte', label: 'Arbeitslosendichte Introtext', type: 'general' },
    { key: 'wirtschaft_sv_beschaeftigte_wohnort', label: 'SvB Wohnort Introtext', type: 'general' },
    { key: 'ueberschrift_wirtschaft_individuell', label: 'H2 Wirtschaft individuell', type: 'individual' },
    { key: 'wirtschaft_bruttoinlandsprodukt', label: 'BIP Analyse', type: 'data_driven' },
    { key: 'wirtschaft_einkommen', label: 'Einkommen', type: 'data_driven' },
    { key: 'ueberschrift_arbeitsmarkt_individuell', label: 'H2 Arbeitsmarkt individuell', type: 'individual' },
    { key: 'wirtschaft_arbeitsplatzzentralitaet', label: 'Zentralität', type: 'data_driven' },
    { key: 'wirtschaft_pendler', label: 'Pendlersaldo', type: 'data_driven' },
    { key: 'wirtschaft_sv_beschaeftigte_arbeitsort', label: 'Beschäftigte Arbeitsort', type: 'data_driven' },
    { key: 'wirtschaft_arbeitslosigkeit', label: 'Arbeitslosenquote', type: 'data_driven' },
  ],
  grundstueckspreise: [
    { key: 'grundstueckspreise_intro', label: 'Einleitung Grundstücke', type: 'general' },
    { key: 'ueberschrift_grundstueckspreise', label: 'H2 Grundstückspreise', type: 'individual' },
    { key: 'grundstueckspreise_allgemein', label: 'Grundstückspreise Daten', type: 'data_driven' },
    { key: 'grundstueckspreise_preisentwicklung', label: 'Entwicklung Grundstücke', type: 'data_driven' },
  ],
};

const SECTION_META_BY_KEY: Record<string, { label: string; type: SectionKind; tabId: string; order: number }> = Object.fromEntries(
  Object.entries(TAB_SECTION_CONFIG).flatMap(([tabId, sections]) =>
    sections.map((section, idx) => [section.key, { label: section.label, type: section.type, tabId, order: idx }]),
  ),
);

const MARKETING_SECTION_TO_TAB: Record<string, string> = {
  immobilienmarkt_ueberblick: 'marktueberblick',
  immobilienpreise: 'immobilienpreise',
  mietpreise: 'mietpreise',
  mietrendite: 'mietrendite',
  wohnmarktsituation: 'wohnmarktsituation',
  grundstueckspreise: 'grundstueckspreise',
  wohnlagencheck: 'wohnlagencheck',
  wirtschaft: 'wirtschaft',
};

const MARKETING_SECTION_LABELS: Record<string, string> = {
  immobilienmarkt_ueberblick: 'Marktüberblick',
  immobilienpreise: 'Immobilienpreise',
  mietpreise: 'Mietpreise',
  mietrendite: 'Mietrendite',
  wohnmarktsituation: 'Wohnmarktsituation',
  grundstueckspreise: 'Grundstückspreise',
  wohnlagencheck: 'Wohnlagencheck',
  wirtschaft: 'Wirtschaft',
};

const MARKETING_FIELD_LABELS: Record<string, string> = {
  title: 'SEO-Titel',
  description: 'Meta-Description',
  summary: 'Zusammenfassung',
  primary_keyword: 'Haupt-Keyword',
  secondary_keywords: 'Neben-Keywords',
  entities: 'Entitäten',
  cta: 'CTA',
};

function normalizeLocaleLabel(locale: string): string {
  const norm = String(locale ?? '').trim().toLowerCase();
  if (!norm) return 'Sprache';
  const [lang, region] = norm.split('-');
  if (!region) return lang.toUpperCase();
  return `${lang.toUpperCase()}-${region.toUpperCase()}`;
}

function isTranslatableSectionKey(sectionKey: string): boolean {
  const key = String(sectionKey ?? '').toLowerCase().trim();
  if (!key) return false;
  if (
    key.endsWith('_name')
    || key.endsWith('_email')
    || key.includes('telefon')
    || key.includes('adresse_')
    || key.endsWith('_plz')
    || key.endsWith('_hnr')
    || key.includes('logo')
    || key.includes('avatar')
    || key.includes('bild')
    || key.includes('image')
  ) {
    return false;
  }
  return true;
}

function isIconPath(value: string): boolean {
  return typeof value === 'string' && value.startsWith('/');
}

function resolveTabId(sectionKey: string): string {
  const key = String(sectionKey ?? '').trim().toLowerCase();
  if (!key) return 'marktueberblick';
  if (key.startsWith('marketing.')) {
    const [, section] = key.split('.');
    return MARKETING_SECTION_TO_TAB[section] ?? 'marktueberblick';
  }
  if (key.startsWith('berater_')) return 'berater';
  if (key.startsWith('makler_')) return 'makler';
  if (
    key.startsWith('immobilienmarkt_')
    || key === 'ueberschrift_immobilienmarkt'
    || key === 'ueberschrift_immobilienmarkt_ueberblick'
  ) return 'marktueberblick';
  if (key.startsWith('immobilienpreise_') || key.startsWith('ueberschrift_immobilienpreise_')) return 'immobilienpreise';
  if (key.startsWith('mietpreise_') || key.startsWith('ueberschrift_mietpreise_')) return 'mietpreise';
  if (key.startsWith('mietrendite_') || key.startsWith('ueberschrift_mietrendite_')) return 'mietrendite';
  if (key.startsWith('wohnmarktsituation_') || key.startsWith('ueberschrift_wohnmarktsituation_')) return 'wohnmarktsituation';
  if (key.startsWith('wohnlagencheck_') || key.startsWith('ueberschrift_wohnlagencheck_')) return 'wohnlagencheck';
  if (key.startsWith('wirtschaft_') || key.startsWith('ueberschrift_wirtschaft_') || key.startsWith('ueberschrift_arbeitsmarkt_')) return 'wirtschaft';
  if (key.startsWith('grundstueckspreise_') || key.startsWith('ueberschrift_grundstueckspreise')) return 'grundstueckspreise';
  return 'marktueberblick';
}

function resolveSectionMeta(sectionKey: string): { label: string; type: SectionKind; tabId: string; order: number } {
  const key = String(sectionKey ?? '').trim().toLowerCase();
  const known = SECTION_META_BY_KEY[key];
  if (known) return known;

  if (key.startsWith('marketing.')) {
    const parts = key.split('.');
    const section = parts[1] ?? '';
    const field = parts[2] ?? '';
    const sectionLabel = MARKETING_SECTION_LABELS[section] ?? section;
    const fieldLabel = MARKETING_FIELD_LABELS[field] ?? field;
    return {
      label: `${sectionLabel} · ${fieldLabel}`,
      type: 'marketing',
      tabId: MARKETING_SECTION_TO_TAB[section] ?? 'marktueberblick',
      order: Object.keys(MARKETING_FIELD_LABELS).indexOf(field) >= 0 ? Object.keys(MARKETING_FIELD_LABELS).indexOf(field) : 9999,
    };
  }

  return {
    label: key,
    type: 'general',
    tabId: resolveTabId(key),
    order: 9999,
  };
}

const DEFAULT_WORKFLOW_CLASSES: DisplayTextClass[] = ['general', 'profile', 'market_expert', 'data_driven'];
const MARKETING_WORKFLOW_CLASSES: DisplayTextClass[] = ['marketing'];

export default function InternationalizationManager({ config, availableLocales }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const locales = useMemo(() => {
    const unique = Array.from(
      new Set(
        (availableLocales ?? [])
          .map((v) => String(v ?? '').trim().toLowerCase())
          .filter((v) => /^[a-z]{2}(-[a-z]{2})?$/.test(v)),
      ),
    );
    if (unique.length === 0) return ['en'];
    return unique;
  }, [availableLocales]);

  const [locale, setLocale] = useState<string>(locales[0] ?? 'en');
  const [channel, setChannel] = useState<I18nChannel>('portal');
  const [scope, setScope] = useState<I18nScope>('current_area');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error' | null>(null);
  const [activeTab, setActiveTab] = useState<string>('marktueberblick');
  const [activeClass, setActiveClass] = useState<DisplayTextClass>('general');
  const [llmOptions, setLlmOptions] = useState<LlmOption[]>([]);
  const [selectedLlmOptionId, setSelectedLlmOptionId] = useState<string>('');
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [baselineByKey, setBaselineByKey] = useState<Record<string, string>>({});
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(null);
  const isDistrict = isDistrictArea(config?.area_id ?? '');
  const channelMeta = I18N_CHANNEL_OPTIONS.find((item) => item.value === channel) ?? I18N_CHANNEL_OPTIONS[0];
  const areaScopeLabel = isDistrict ? 'Kreis' : 'Ortslage';

  useEffect(() => {
    if (locales.includes(locale)) return;
    setLocale(locales[0] ?? 'en');
  }, [locales, locale]);

  async function resolveScopeAreas(nextScope: I18nScope): Promise<ScopeArea[]> {
    const current: ScopeArea = {
      area_id: String(config?.area_id ?? ''),
      area_name: String(config?.areas?.name ?? config?.area_id ?? ''),
    };
    if (!current.area_id) return [];
    if (nextScope !== 'kreis_ortslagen' || !isDistrict) return [current];

    const bundeslandSlug = String(config?.areas?.bundesland_slug ?? '').trim();
    const kreisSlug = String(config?.areas?.slug ?? '').trim();
    if (!bundeslandSlug || !kreisSlug) return [current];

    const { data, error } = await supabase
      .from('areas')
      .select('id, name, slug, parent_slug, bundesland_slug')
      .eq('bundesland_slug', bundeslandSlug)
      .eq('parent_slug', kreisSlug)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message || 'Ortslagen konnten nicht geladen werden.');

    const children = (data ?? [])
      .map((row) => ({
        area_id: String(row.id ?? '').trim(),
        area_name: String(row.name ?? row.slug ?? row.id ?? '').trim(),
      }))
      .filter((row) => row.area_id.length > 0);

    return [current, ...children];
  }

  async function loadRows(options?: { autoSync?: boolean; sectionKeys?: string[] }) {
    if (!config?.area_id) return;
    setLoading(true);
    try {
      const scopeAreas = await resolveScopeAreas(scope);
      const keys = Array.from(new Set((options?.sectionKeys ?? []).map((item) => String(item ?? '').trim()).filter(Boolean)));
      const results = await Promise.all(scopeAreas.map(async (scopeArea) => {
        const params = new URLSearchParams({
          area_id: scopeArea.area_id,
          locale,
          channel,
          auto_sync: options?.autoSync ? '1' : '0',
        });
        if (keys.length > 0) params.set('section_keys', keys.join(','));
        const res = await fetch(`/api/partner/i18n/texts?${params.toString()}`, { method: 'GET', cache: 'no-store' });
        const payload = await res.json().catch(() => null) as {
          rows?: Omit<TranslationRow, 'area_id' | 'area_name'>[];
          error?: string;
          summary?: {
            auto_synced?: number;
            auto_sync_failed?: number;
            mock_mode?: boolean;
            pricing_preview?: PricingPreview | null;
          };
        } | null;
        if (!res.ok) {
          throw new Error(String(payload?.error ?? `HTTP ${res.status}`));
        }
        return { scopeArea, payload };
      }));

      const nextRows = results.flatMap(({ scopeArea, payload }) => (
        Array.isArray(payload?.rows) ? payload.rows : []
      ).map((row) => {
        const fallback = String(row.effective_content ?? row.source_content_de ?? '').trim();
        return {
          ...row,
          area_id: scopeArea.area_id,
          area_name: scopeArea.area_name,
          translated_content: String(row.translated_content ?? '').trim() || fallback,
        };
      }));
      setRows(nextRows);
      const nextBaseline: Record<string, string> = {};
      for (const row of nextRows) {
        nextBaseline[`${row.area_id}::${row.section_key}`] = String(row.translated_content ?? '').trim();
      }
      setBaselineByKey(nextBaseline);
      const pricing = results.find((item) => item.payload?.summary?.pricing_preview)?.payload?.summary?.pricing_preview ?? null;
      setPricingPreview(pricing);
      const autoSynced = results.reduce((sum, item) => sum + Number(item.payload?.summary?.auto_synced ?? 0), 0);
      const autoFailed = results.reduce((sum, item) => sum + Number(item.payload?.summary?.auto_sync_failed ?? 0), 0);
      const isMock = results.some((item) => item.payload?.summary?.mock_mode === true) || I18N_MOCK_TRANSLATION;
      if (options?.autoSync && isMock) {
        setStatus(`Mock-Modus aktiv · automatisch aktualisiert: ${autoSynced} · Fehler: ${autoFailed} · Gebiete: ${scopeAreas.length}`);
      } else if (options?.autoSync) {
        setStatus(`Automatisch aktualisiert: ${autoSynced} · Fehler: ${autoFailed} · Gebiete: ${scopeAreas.length}`);
      } else {
        setStatus(`Übersetzungsstand geladen fuer ${scopeAreas.length} Gebiet(e). Es wurde noch kein automatischer Uebersetzungslauf gestartet.`);
      }
      setStatusTone('success');
    } catch (error) {
      setRows([]);
      setBaselineByKey({});
      setPricingPreview(null);
      setStatus(error instanceof Error ? error.message : 'Übersetzungen konnten nicht geladen werden.');
      setStatusTone('error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows({ autoSync: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.area_id, locale, channel, scope]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/partner/llm/options', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json().catch(() => null) as { options?: Array<Record<string, unknown>> } | null;
        const nextOptions = Array.isArray(payload?.options)
          ? payload.options.map((item) => ({
            id: String(item.id ?? ''),
            label: String(item.label ?? ''),
            partner_integration_id: item.partner_integration_id ? String(item.partner_integration_id) : null,
            global_provider_id: item.global_provider_id ? String(item.global_provider_id) : null,
          })).filter((item) => item.id && item.label)
          : [];
        if (I18N_MOCK_TRANSLATION && nextOptions.length === 0) {
          nextOptions.push({
            id: 'mock:i18n',
            label: 'Mock-Übersetzer (lokal)',
            partner_integration_id: null,
            global_provider_id: null,
          });
        }
        setLlmOptions(nextOptions);
        setSelectedLlmOptionId((prev) => {
          if (prev && nextOptions.some((opt) => opt.id === prev)) return prev;
          return nextOptions[0]?.id ?? '';
        });
      } catch {
        if (I18N_MOCK_TRANSLATION) {
          setLlmOptions([{
            id: 'mock:i18n',
            label: 'Mock-Übersetzer (lokal)',
            partner_integration_id: null,
            global_provider_id: null,
          }]);
          setSelectedLlmOptionId('mock:i18n');
        } else {
          setLlmOptions([]);
        }
      }
    })();
  }, []);

  const rowsByTab = useMemo(() => {
    const map = new Map<string, TranslationRow[]>();
    for (const row of rows) {
      const tabId = resolveTabId(row.section_key);
      const list = map.get(tabId) ?? [];
      list.push(row);
      map.set(tabId, list);
    }
    return map;
  }, [rows]);

  const workflowClasses = useMemo<DisplayTextClass[]>(
    () => (channel === 'marketing' ? MARKETING_WORKFLOW_CLASSES : DEFAULT_WORKFLOW_CLASSES),
    [channel],
  );

  useEffect(() => {
    if (I18N_TAB_ORDER.some((tab) => tab.id === activeTab)) return;
    setActiveTab('marktueberblick');
  }, [activeTab]);

  useEffect(() => {
    if (workflowClasses.includes(activeClass)) return;
    setActiveClass(workflowClasses[0] ?? 'general');
  }, [workflowClasses, activeClass]);

  useEffect(() => {
    if (isDistrict) return;
    if (scope !== 'kreis_ortslagen') return;
    setScope('current_area');
  }, [isDistrict, scope]);

  const classSummary = useMemo(() => {
    const summaryMap: Record<DisplayTextClass, {
      total: number;
      translated: number;
      fallback: number;
      stale: number;
    }> = {
      general: { total: 0, translated: 0, fallback: 0, stale: 0 },
      data_driven: { total: 0, translated: 0, fallback: 0, stale: 0 },
      market_expert: { total: 0, translated: 0, fallback: 0, stale: 0 },
      profile: { total: 0, translated: 0, fallback: 0, stale: 0 },
      marketing: { total: 0, translated: 0, fallback: 0, stale: 0 },
    };

    for (const row of rows) {
      if (!isTranslatableSectionKey(row.section_key)) continue;
      const meta = resolveSectionMeta(row.section_key);
      const displayClass = resolveDisplayTextClass(row.section_key, meta.type);
      const entry = summaryMap[displayClass];
      entry.total += 1;
      if (row.effective_source === 'translation') entry.translated += 1;
      else entry.fallback += 1;
      if (row.translation_is_stale) entry.stale += 1;
    }
    return summaryMap;
  }, [rows]);

  const classEstimateMap = useMemo(() => {
    const next: Record<DisplayTextClass, ReturnType<typeof estimateTranslationTotals>> = {
      general: estimateTranslationTotals([], pricingPreview),
      data_driven: estimateTranslationTotals([], pricingPreview),
      market_expert: estimateTranslationTotals([], pricingPreview),
      profile: estimateTranslationTotals([], pricingPreview),
      marketing: estimateTranslationTotals([], pricingPreview),
    };

    const groupedTexts: Record<DisplayTextClass, string[]> = {
      general: [],
      data_driven: [],
      market_expert: [],
      profile: [],
      marketing: [],
    };

    for (const row of rows) {
      if (!isTranslatableSectionKey(row.section_key)) continue;
      const meta = resolveSectionMeta(row.section_key);
      const displayClass = resolveDisplayTextClass(row.section_key, meta.type);
      if (row.translation_is_stale || row.effective_source === 'de_fallback') {
        groupedTexts[displayClass].push(String(row.source_content_de ?? ''));
      }
    }

    for (const displayClass of Object.keys(groupedTexts) as DisplayTextClass[]) {
      next[displayClass] = estimateTranslationTotals(groupedTexts[displayClass], pricingPreview);
    }
    return next;
  }, [rows, pricingPreview]);

  const filteredRows = useMemo(() => {
    const withIndex = (rowsByTab.get(activeTab) ?? [])
      .filter((row) => isTranslatableSectionKey(row.section_key))
      .filter((row) => {
        const meta = resolveSectionMeta(row.section_key);
        return resolveDisplayTextClass(row.section_key, meta.type) === activeClass;
      })
      .map((row, idx) => ({ row, idx }));
    withIndex.sort((a, b) => {
      const metaA = resolveSectionMeta(a.row.section_key);
      const metaB = resolveSectionMeta(b.row.section_key);
      const aKnown = metaA?.tabId === activeTab;
      const bKnown = metaB?.tabId === activeTab;
      if (aKnown && bKnown) return (metaA?.order ?? 9999) - (metaB?.order ?? 9999);
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return a.idx - b.idx;
    });
    return withIndex.map((item) => item.row);
  }, [rowsByTab, activeTab, activeClass]);

  const summary = useMemo(() => {
    const relevantRows = rows.filter((row) => isTranslatableSectionKey(row.section_key));
    const total = relevantRows.length;
    const translated = relevantRows.filter((row) => row.effective_source === 'translation').length;
    const fallback = total - translated;
    return { total, translated, fallback };
  }, [rows]);

  const hasEdits = useMemo(
    () => rows.some((row) => String(row.translated_content ?? '').trim() !== String(baselineByKey[`${row.area_id}::${row.section_key}`] ?? '').trim()),
    [rows, baselineByKey],
  );

  const selectedWorkflowKeys = useMemo(
    () => Array.from(new Set(rows
      .filter((row) => isTranslatableSectionKey(row.section_key))
      .filter((row) => {
        const meta = resolveSectionMeta(row.section_key);
        return resolveDisplayTextClass(row.section_key, meta.type) === activeClass;
      })
      .map((row) => row.section_key))),
    [rows, activeClass],
  );

  const activeEstimate = classEstimateMap[activeClass];

  function formatCost(value: number | null, currency: 'USD' | 'EUR'): string {
    if (value === null || !Number.isFinite(value)) return 'n/a';
    return `${value.toFixed(value < 1 ? 4 : 2)} ${currency}`;
  }

  async function saveRows() {
    if (!config?.area_id || rows.length === 0 || !hasEdits) return;
    setSaving(true);
    setStatus(null);
    setStatusTone(null);
    try {
      const changedRows = rows
        .filter((row) => String(row.translated_content ?? '').trim() !== String(baselineByKey[`${row.area_id}::${row.section_key}`] ?? '').trim()));
      if (changedRows.length === 0) {
        setStatus('Keine Änderungen zum Speichern.');
        setStatusTone('success');
        return;
      }
      const grouped = new Map<string, typeof changedRows>();
      for (const row of changedRows) {
        const list = grouped.get(row.area_id) ?? [];
        list.push(row);
        grouped.set(row.area_id, list);
      }
      let updatedSum = 0;
      for (const [areaId, areaRows] of grouped.entries()) {
        const res = await fetch('/api/partner/i18n/texts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            area_id: areaId,
            locale,
            channel,
            rows: areaRows.map((row) => ({
              section_key: row.section_key,
              translated_content: row.translated_content,
              status: 'approved' as const,
            })),
          }),
        });
        const payload = await res.json().catch(() => null) as { updated?: number; error?: string } | null;
        if (!res.ok) {
          throw new Error(String(payload?.error ?? `HTTP ${res.status}`));
        }
        updatedSum += Number(payload?.updated ?? 0);
      }
      setStatus(`${updatedSum} Übersetzungen gespeichert.`);
      setStatusTone('success');
      await loadRows({ autoSync: false });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
      setStatusTone('error');
    } finally {
      setSaving(false);
    }
  }

  async function rewriteViaAi(row: TranslationRow): Promise<string> {
    const selected = llmOptions.find((item) => item.id === selectedLlmOptionId) ?? null;
    const customPrompt =
      `Uebersetze den Text aus dem Deutschen nach ${normalizeLocaleLabel(locale)}.` +
      ' Behalte Fakten, Zahlen und Eigennamen exakt bei. Keine neuen Fakten erfinden.' +
      ' Nutze natuerliches, professionelles Wording fuer Immobilien- und Standorttexte.';
    const res = await fetch('/api/ai-rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: row.source_content_de,
        areaName: String(row.area_name ?? config.areas?.name ?? config.area_id),
        type: 'general',
        sectionLabel: row.section_key,
        customPrompt,
        mock_context: 'i18n',
        target_locale: locale,
        llm_integration_id: selected?.partner_integration_id ?? undefined,
        llm_global_provider_id: selected?.global_provider_id ?? undefined,
      }),
    });
    const payload = await res.json().catch(() => null) as { optimizedText?: string; error?: string } | null;
    if (!res.ok || !String(payload?.optimizedText ?? '').trim()) {
      throw new Error(String(payload?.error ?? `KI-Übersetzung fehlgeschlagen (${res.status})`));
    }
    return String(payload?.optimizedText ?? '').trim();
  }

  async function triggerWorkflowUpdate() {
    if (selectedWorkflowKeys.length === 0) {
      setStatus('Fuer diesen Texttyp sind aktuell keine uebersetzbaren Inhalte vorhanden.');
      setStatusTone('error');
      return;
    }
    setStatus(`Starte Uebersetzungsaktualisierung fuer ${i18nWorkflowClassTitle(activeClass)} im ${channelMeta.label}-Bereich …`);
    setStatusTone('success');
    await loadRows({ autoSync: true, sectionKeys: selectedWorkflowKeys });
  }

  return (
    <>
      <FullscreenLoader
        show={loading || saving || Boolean(rewritingKey)}
        label={
          loading
            ? 'Uebersetzungsstand wird geladen...'
            : saving
              ? 'Uebersetzungen werden gespeichert...'
              : 'Uebersetzung wird aktualisiert...'
        }
      />
      <section style={wrapStyle}>
        <div style={topCardStyle}>
          <div style={headStyle}>
            <h3 style={headTitleStyle}>Internationalisierung</h3>
            <p style={subStyle}>
              Arbeite die Uebersetzungen bewusst nach Bereich, Scope und Texttyp ab. Die deutschen Inhalte sollten vor jedem Lauf auf Vollstaendigkeit, Inhalt und Qualitaet geprueft sein.
            </p>
          </div>

          <div style={controlsStyle}>
            <label style={fieldStyle}>
              Sprache
              <select style={inputStyle} value={locale} onChange={(e) => setLocale(e.target.value)}>
                {locales.map((item) => (
                  <option key={item} value={item}>{normalizeLocaleLabel(item)}</option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              Bereich
              <select
                style={inputStyle}
                value={channel}
                onChange={(e) => setChannel(e.target.value as I18nChannel)}
              >
                {I18N_CHANNEL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label style={{ ...fieldStyle, minWidth: 320 }}>
              KI-Modell
              <select
                style={inputStyle}
                value={selectedLlmOptionId}
                onChange={(e) => setSelectedLlmOptionId(e.target.value)}
                disabled={llmOptions.length === 0 || loading || saving}
              >
                {llmOptions.length === 0 ? <option value="">Kein LLM verfügbar</option> : null}
                {llmOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={scopeBlockStyle}>
            <div style={scopeHeadStyle}>
              <strong>Scope</strong>
              <span style={scopeMetaStyle}>{areaScopeLabel}: {String(config.areas?.name ?? config.area_id)}</span>
            </div>
            <div style={scopeOptionsStyle}>
              {I18N_SCOPE_OPTIONS.map((item) => {
                const isDisabled = item.value === 'kreis_ortslagen' && !isDistrict;
                const isActive = scope === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    style={scopeButtonStyle(isActive, isDisabled)}
                    disabled={isDisabled}
                    onClick={() => setScope(item.value)}
                    title={item.description}
                  >
                    <span style={scopeButtonTitleStyle}>{item.value === 'current_area' ? item.label.replace('Dieses Gebiet', areaScopeLabel) : item.label}</span>
                    <span style={scopeButtonTextStyle}>{item.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={workflowNoticeStyle}>
            <div style={workflowNoticeHeadStyle}>
              <strong>{channelMeta.label}</strong>
              <span style={workflowNoticeMetaStyle}>{channelMeta.description}</span>
            </div>
            <p style={workflowNoticeTextStyle}>
              Freigaben der deutschen Inhalte und Uebersetzungslaeufe sind jetzt getrennt. Starte die Uebersetzung erst, wenn der deutsche Stand fachlich final ist.
            </p>
          </div>

          <div style={summaryStyle}>
            Gesamt: <strong>{summary.total}</strong> · Übersetzt: <strong>{summary.translated}</strong> · Deutsch-Fallback: <strong>{summary.fallback}</strong>
          </div>
          <div style={pricingMetaStyle}>
            Globales Uebersetzungsmodell:{' '}
            <strong>{pricingPreview?.provider && pricingPreview?.model ? `${pricingPreview.provider} / ${pricingPreview.model}` : 'nicht verfuegbar'}</strong>
            {pricingPreview?.input_cost_usd_per_1k !== null && pricingPreview?.output_cost_usd_per_1k !== null ? (
              <span>
                {' '}· Input {formatCost(pricingPreview.input_cost_usd_per_1k, 'USD')}/1k · Output {formatCost(pricingPreview.output_cost_usd_per_1k, 'USD')}/1k
              </span>
            ) : null}
          </div>
        </div>

      <div style={editorCardStyle}>
        <div style={workflowCardStyle}>
          <div style={workflowCardHeaderStyle}>
            <div>
              <h3 style={sectionTabsIntroTitleStyle}>Texttyp waehlen</h3>
              <p style={sectionTabsIntroTextStyle}>Priorisiere erst den Texttyp, dann den Themenbereich. So bleibt der Uebersetzungslauf steuerbar.</p>
            </div>
            <div style={workflowActionRowStyle}>
              <button
                type="button"
                style={secondaryActionButtonStyle}
                onClick={() => void loadRows({ autoSync: false })}
                disabled={loading || saving}
              >
                Uebersetzungsstand laden
              </button>
              <button
                type="button"
                style={primaryWorkflowButtonStyle(Boolean(selectedWorkflowKeys.length) && !loading && !saving)}
                onClick={() => void triggerWorkflowUpdate()}
                disabled={loading || saving || selectedWorkflowKeys.length === 0}
              >
                {activeClass === 'data_driven' ? 'Data-Driven aktualisieren' : 'Uebersetzung fuer Texttyp starten'}
              </button>
            </div>
          </div>

          <div style={classGridStyle}>
            {workflowClasses.map((displayClass) => {
              const stats = classSummary[displayClass];
              const active = activeClass === displayClass;
              return (
                <button
                  key={displayClass}
                  type="button"
                  style={classCardStyle(active)}
                  onClick={() => setActiveClass(displayClass)}
                >
                  <div style={classCardTopStyle}>
                    <span style={displayTextBadgeStyle(displayClass)}>{displayTextClassLabel(displayClass)}</span>
                    <span style={classCardCountStyle}>{stats.total}</span>
                  </div>
                  <strong style={classCardTitleStyle}>{i18nWorkflowClassTitle(displayClass)}</strong>
                  <p style={classCardTextStyle}>{i18nWorkflowClassDescription(displayClass)}</p>
                  <div style={classCardStatsStyle}>
                    <span>Uebersetzt: {stats.translated}</span>
                    <span>DE-Fallback: {stats.fallback}</span>
                    <span>Veraltet: {stats.stale}</span>
                    <span>Tokens ca.: {classEstimateMap[displayClass].total_tokens.toLocaleString('de-DE')}</span>
                  </div>
                  <div style={classCardCostStyle}>
                    <span>USD ca.: {formatCost(classEstimateMap[displayClass].estimated_cost_usd, 'USD')}</span>
                    <span>EUR ca.: {formatCost(classEstimateMap[displayClass].estimated_cost_eur, 'EUR')}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={selectedWorkflowCardStyle}>
            <div style={selectedWorkflowHeadStyle}>
              <strong>{i18nWorkflowClassTitle(activeClass)}</strong>
              <span style={selectedWorkflowMetaStyle}>{i18nWorkflowClassCycle(activeClass)}</span>
            </div>
            <p style={selectedWorkflowTextStyle}>{i18nWorkflowClassDescription(activeClass)}</p>
            <div style={estimatePanelStyle}>
              <div style={estimateItemStyle}>
                <span style={estimateLabelStyle}>Betroffene Texte</span>
                <strong>{classSummary[activeClass].fallback + classSummary[activeClass].stale}</strong>
              </div>
              <div style={estimateItemStyle}>
                <span style={estimateLabelStyle}>Tokenlast ca.</span>
                <strong>{activeEstimate.total_tokens.toLocaleString('de-DE')}</strong>
              </div>
              <div style={estimateItemStyle}>
                <span style={estimateLabelStyle}>Kosten ca. USD</span>
                <strong>{formatCost(activeEstimate.estimated_cost_usd, 'USD')}</strong>
              </div>
              <div style={estimateItemStyle}>
                <span style={estimateLabelStyle}>Kosten ca. EUR</span>
                <strong>{formatCost(activeEstimate.estimated_cost_eur, 'EUR')}</strong>
              </div>
            </div>
            <div style={qualityCheckBoxStyle(activeClass !== 'data_driven')}>
              <strong>{activeClass === 'data_driven' ? 'Automatisch aktuell halten' : 'Vor dem Uebersetzungslauf pruefen'}</strong>
              <span>
                {activeClass === 'data_driven'
                  ? 'Data-Driven-Texte sollten nach Daten-, KPI- oder Kontextaenderungen zeitnah nachgezogen werden, damit Tabellen und Charts sprachlich konsistent bleiben.'
                  : 'Bitte pruefe den deutschen Stand vor dem Lauf auf Vollstaendigkeit, inhaltliche Qualitaet und finale Aussage.'}
              </span>
            </div>
          </div>
        </div>

        <div style={sectionTabsIntroStyle}>
          <h3 style={sectionTabsIntroTitleStyle}>Themenbereich bearbeiten</h3>
          <p style={sectionTabsIntroTextStyle}>Innerhalb des gewaelten Texttyps kannst du die Uebersetzungen je Themenbereich pruefen und manuell nacharbeiten.</p>
        </div>
        <div style={tabContainerStyle}>
          {I18N_TAB_ORDER.map((tab) => (
            <button
              key={tab.id}
              type="button"
              style={tabButtonStyle(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              {isIconPath(tab.icon) ? (
                <NextImage src={tab.icon} alt="" aria-hidden="true" width={16} height={16} unoptimized style={tabIconImageStyle} />
              ) : (
                <span style={tabIconEmojiStyle}>{tab.icon}</span>
              )}
              <span style={tabLabelStyle}>{tab.label}</span>
            </button>
          ))}
        </div>

        {status ? <div style={statusTone === 'error' ? statusErrorBoxStyle : statusSuccessBoxStyle}>{status}</div> : null}

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '38%' }} />
              <col style={{ width: '38%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thStyle}>Bereich</th>
                <th style={thStyle}>Deutsch (Quelle)</th>
                <th style={thStyle}>Übersetzung</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={3}>In diesem Themenbereich sind fuer den gewaehlten Texttyp aktuell keine uebersetzbaren Inhalte vorhanden.</td>
                </tr>
              ) : filteredRows.map((row, idx) => (
                <tr key={`${row.area_id}:${row.section_key}:${idx}`}>
                  <td style={tdStyle}>
                    {(() => {
                      const meta = resolveSectionMeta(row.section_key);
                      const sectionLabel = meta?.label ?? row.section_key;
                      const sectionType: SectionKind = meta?.type ?? 'general';
                      const displayClass = resolveDisplayTextClass(row.section_key, sectionType);
                      return (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700 }}>{sectionLabel}</span>
                            <span style={displayTextBadgeStyle(displayClass)}>{displayTextClassLabel(displayClass)}</span>
                          </div>
                          {scope === 'kreis_ortslagen' ? (
                            <div style={areaMetaStyle}>{row.area_name}</div>
                          ) : null}
                          <div style={sectionKeyMetaStyle}>{row.section_key}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={tdStyle}>
                    <textarea style={textareaReadonlyStyle} value={row.source_content_de ?? ''} readOnly />
                  </td>
                  <td style={tdStyle}>
                    <textarea
                      style={textareaStyle}
                      value={row.translated_content ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        setRows((prev) => prev.map((item) => (
                          item.section_key === row.section_key
                            ? { ...item, translated_content: next }
                            : item
                        )));
                      }}
                    />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        style={smallGhostButtonStyle}
                        disabled={loading || saving || llmOptions.length === 0}
                        onClick={async () => {
                          try {
                            setRewritingKey(row.section_key);
                            setStatusTone(null);
                            setStatus(`KI übersetzt ${row.section_key} …`);
                            const translated = await rewriteViaAi(row);
                            setRows((prev) => prev.map((item) => (
                              item.section_key === row.section_key
                                ? { ...item, translated_content: translated }
                                : item
                            )));
                            setStatus(`KI-Übersetzung für ${row.section_key} abgeschlossen.`);
                            setStatusTone('success');
                          } catch (error) {
                            setStatus(error instanceof Error ? error.message : 'KI-Übersetzung fehlgeschlagen.');
                            setStatusTone('error');
                          } finally {
                            setRewritingKey(null);
                          }
                        }}
                      >
                        {rewritingKey === row.section_key ? 'Übersetzt …' : 'Mit KI übersetzen'}
                      </button>
                      {row.translation_is_stale ? (
                        <span style={staleBadgeStyle}>Quelle geändert</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={actionsBottomStyle}>
          <button
            type="button"
            style={buttonPrimaryStyle(!(loading || saving || rows.length === 0 || !hasEdits))}
            onClick={() => void saveRows()}
            disabled={loading || saving || rows.length === 0 || !hasEdits}
          >
            {saving ? 'Speichern …' : 'Übersetzungen speichern'}
          </button>
        </div>
      </div>
      </section>
    </>
  );
}

const wrapStyle: React.CSSProperties = {
  background: 'transparent',
  padding: 0,
  display: 'grid',
  gap: 14,
};

const topCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#fff',
  padding: 14,
  display: 'grid',
  gap: 10,
};

const headStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
};

const headTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: '#0f172a',
};

const subStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#475569',
};

const controlsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(140px, 240px) minmax(160px, 280px) 1fr',
  gap: 10,
  alignItems: 'end',
};

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: '#334155',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '9px 12px',
  paddingRight: 30,
  height: 42,
  fontSize: 13,
  lineHeight: 1.3,
  color: '#0f172a',
  backgroundColor: '#fff',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  boxShadow: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '12px',
};

const scopeBlockStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};

const scopeHeadStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
  fontSize: 12,
  color: '#334155',
};

const scopeMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
};

const scopeOptionsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
};

const scopeButtonStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  display: 'grid',
  gap: 6,
  textAlign: 'left',
  padding: 12,
  borderRadius: 12,
  border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
  background: active ? '#f0fdfa' : '#fff',
  color: disabled ? '#94a3b8' : '#0f172a',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.75 : 1,
});

const scopeButtonTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const scopeButtonTextStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  color: '#64748b',
};

const workflowNoticeStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #dbeafe',
  background: '#eff6ff',
};

const workflowNoticeHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  flexWrap: 'wrap',
};

const workflowNoticeMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#475569',
};

const workflowNoticeTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: '#1e3a8a',
};

const buttonPrimaryStyle = (active: boolean): React.CSSProperties => ({
  border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
  borderRadius: 10,
  background: active ? '#0f766e' : '#e2e8f0',
  color: active ? '#fff' : '#64748b',
  width: '300px',
  height: '54px',
  fontSize: 14,
  fontWeight: 700,
  cursor: active ? 'pointer' : 'not-allowed',
  opacity: active ? 1 : 0.75,
});

const primaryWorkflowButtonStyle = (active: boolean): React.CSSProperties => ({
  ...buttonPrimaryStyle(active),
  width: 'auto',
  minWidth: 240,
  height: 44,
  padding: '0 16px',
});

const secondaryActionButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  background: '#fff',
  color: '#334155',
  height: 44,
  padding: '0 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const smallGhostButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#fff',
  color: '#334155',
  padding: '6px 8px',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

const statusSuccessBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #bbf7d0',
  background: '#f0fdf4',
  fontSize: 12,
  color: '#166534',
};

const statusErrorBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  fontSize: 12,
  color: '#991b1b',
};

const staleBadgeStyle: React.CSSProperties = {
  border: '1px solid #fde68a',
  borderRadius: 999,
  background: '#fffbeb',
  color: '#92400e',
  padding: '2px 8px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const summaryStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#334155',
};

const pricingMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#475569',
  lineHeight: 1.5,
};

const editorCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#ffffff',
  padding: 14,
  marginTop: 6,
  display: 'grid',
  gap: 8,
};

const workflowCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#fff',
};

const workflowCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
};

const workflowActionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const classGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const classCardStyle = (active: boolean): React.CSSProperties => ({
  display: 'grid',
  gap: 10,
  textAlign: 'left',
  padding: 14,
  borderRadius: 12,
  border: active ? '1px solid #0f766e' : '1px solid #e2e8f0',
  background: active ? '#f0fdfa' : '#fff',
  cursor: 'pointer',
});

const classCardTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
};

const classCardCountStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#0f172a',
};

const classCardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  color: '#0f172a',
};

const classCardTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: '#475569',
};

const classCardStatsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  fontSize: 11,
  color: '#334155',
};

const classCardCostStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  fontSize: 11,
  color: '#0f766e',
  fontWeight: 700,
};

const selectedWorkflowCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};

const selectedWorkflowHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
};

const selectedWorkflowMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
};

const selectedWorkflowTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: '#334155',
};

const estimatePanelStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
};

const estimateItemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #dbeafe',
  background: '#fff',
};

const estimateLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const qualityCheckBoxStyle = (manualCheck: boolean): React.CSSProperties => ({
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 12,
  border: manualCheck ? '1px solid #fcd34d' : '1px solid #86efac',
  background: manualCheck ? '#fffbeb' : '#f0fdf4',
  color: manualCheck ? '#92400e' : '#166534',
});

const sectionTabsIntroStyle: React.CSSProperties = {
  marginTop: 2,
  marginBottom: 8,
};

const sectionTabsIntroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: '#0f172a',
};

const sectionTabsIntroTextStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  color: '#64748b',
};

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  backgroundColor: '#fff',
  padding: '8px 8px 0 8px',
  borderRadius: '12px 12px 0 0',
  borderBottom: '1px solid #e2e8f0',
};

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  minWidth: '118px',
  padding: '12px 14px',
  border: 'none',
  borderBottom: active ? '3px solid #3b82f6' : '3px solid transparent',
  backgroundColor: active ? '#f8fafc' : 'transparent',
  color: active ? '#2563eb' : '#64748b',
  fontWeight: active ? 700 : 500,
  fontSize: 13,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'all 0.2s',
  borderRadius: '8px 8px 0 0',
});

const tabIconImageStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  objectFit: 'contain',
  display: 'block',
};

const tabIconEmojiStyle: React.CSSProperties = {
  fontSize: 24,
  lineHeight: 1,
  display: 'block',
};

const tabLabelStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.2,
  textAlign: 'center',
};

const tableWrapStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  overflow: 'auto',
};

const actionsBottomStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 8,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 1160,
  tableLayout: 'fixed',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #e2e8f0',
  padding: '10px 12px',
  fontSize: 12,
  color: '#334155',
  background: '#f8fafc',
};

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
  padding: '10px 10px',
  fontSize: 12,
  color: '#0f172a',
  verticalAlign: 'top',
};

const sectionKeyMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  wordBreak: 'break-word',
};

const areaMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#0f766e',
  fontWeight: 700,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 165,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  lineHeight: 1.45,
  resize: 'vertical',
};

const textareaReadonlyStyle: React.CSSProperties = {
  ...textareaStyle,
  background: '#f8fafc',
};
