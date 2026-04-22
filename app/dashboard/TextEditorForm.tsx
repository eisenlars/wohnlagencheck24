// app/dashboard/TextEditorForm.tsx

'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { INDIVIDUAL_MANDATORY_KEYS } from '@/lib/text-key-registry';
import { resolveFieldHint, type HintTable } from '@/lib/text-field-hints';
import {
  resolveDisplayTextClass,
  displayTextClassLabel,
  displayTextBadgeStyle,
} from '@/lib/text-display-class';
import { estimateTokensFromText } from '@/lib/i18n-cost-estimate';
import {
  MANDATORY_MEDIA_KEYS,
  MANDATORY_MEDIA_SPECS,
  type MandatoryMediaKey,
} from '@/lib/mandatory-media';
import { getTextKeyLabel } from '@/lib/text-key-labels';
import { useSessionViewState } from '@/lib/ui/session-view-state';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import {
  workflowActionButtonStyle,
  workflowAreaContentStackStyle,
  workflowAreaContentWrapStyle as textAreaEditorWrapStyle,
  workflowAreaGridStyle as textEditorGridStyle,
  workflowAreaHeadlineStyle as textAreaListHeadlineStyle,
  workflowAreaListCardStyle as textAreaListCardStyle,
  workflowAreaListRowStyle as textAreaListRowStyle,
  workflowAreaListRowTopStyle as textAreaListRowTopStyle,
  workflowAreaListWrapStyle as textAreaListWrapStyle,
  workflowAreaMetaLineStyle as textAreaListMetaLineStyle,
  workflowAreaTypeBadgeStyle as textAreaTypeBadgeStyle,
  workflowAnchorLinkStyle,
  workflowClassActionRowStyle as textWorkflowClassActionRowStyle,
  workflowClassCardStyle as textWorkflowClassCardStyle,
  workflowClassCostStyle as textWorkflowClassCostStyle,
  workflowCostInfoPopoverStyle,
  workflowCostInfoTriggerStyle,
  workflowCostInfoWrapStyle,
  workflowClassCycleStyle as textWorkflowClassCycleStyle,
  workflowClassGridStyle as textWorkflowClassGridStyle,
  workflowClassStatLineStyle as textWorkflowClassStatLineStyle,
  workflowClassStatsStyle as textWorkflowClassStatsStyle,
  workflowClassTextStyle as textWorkflowClassTextStyle,
  workflowClassTopStyle as textWorkflowClassTopStyle,
  workflowHeaderInlineStyle as textWorkflowHeaderInlineStyle,
  workflowHeaderStyle as textWorkflowHeaderStyle,
  workflowAnchorTargetStyle,
  workflowInlineFieldStyle as textWorkflowInlineFieldStyle,
  workflowInlineSelectStyle as textWorkflowInlineSelectStyle,
  workflowTopCardStyle as textWorkflowTopCardStyle,
  workflowTopControlsStyle as textWorkflowTopControlsStyle,
  workflowTopFieldStyle as textWorkflowTopFieldStyle,
  workflowTopSelectStyle as textWorkflowTopSelectStyle,
  workflowCardStackStyle,
  workflowPanelCardStyle as textWorkflowCardStyle,
  workflowPromptLabelStyle as textWorkflowPromptLabelStyle,
  workflowPromptTextareaStyle as textWorkflowPromptTextareaStyle,
  workflowSectionIntroStyle as sectionTabsIntroStyle,
  workflowSectionIntroTitleStyle as sectionTabsIntroTitleStyle,
  workflowTabButtonStyle as tabButtonStyle,
  workflowTabContainerStyle as tabContainerStyle,
  workflowTabLabelStyle as tabLabelStyle,
} from '@/app/dashboard/workflow-ui';

const SINGLE_LINE_TEXT_KEYS = new Set([
  'berater_name',
  'berater_email',
  'berater_telefon_fest',
  'berater_telefon_mobil',
  'berater_adresse_strasse',
  'berater_adresse_hnr',
  'berater_adresse_plz',
  'berater_adresse_ort',
  'makler_name',
  'makler_email',
  'makler_telefon_fest',
  'makler_telefon_mobil',
  'makler_adresse_strasse',
  'makler_adresse_hnr',
  'makler_adresse_plz',
  'makler_adresse_ort',
]);

function isAdvisorOrBrokerKey(key: string) {
  return key.startsWith('berater_') || key.startsWith('makler_');
}

function resolveInputType(sectionKey: string): 'text' | 'email' | 'tel' {
  if (sectionKey.endsWith('_email')) return 'email';
  if (sectionKey.includes('telefon')) return 'tel';
  return 'text';
}

function formatProviderLabel(provider: string): string {
  const p = String(provider ?? '').toLowerCase();
  if (p === 'openai') return 'OpenAI';
  if (p === 'anthropic') return 'Anthropic';
  if (p === 'google_gemini') return 'Gemini';
  if (p === 'azure_openai') return 'Azure OpenAI';
  if (p === 'mistral') return 'Mistral';
  return provider || 'LLM';
}

// 1. Die vollständige Konfiguration basierend auf deinen Vorgaben
const RAW_TAB_CONFIG = [
  { id: 'berater', label: 'Berater', icon: '👤', sections: [
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
  ]},
  { id: 'makler', label: 'Makler', icon: '🏢', sections: [
    { key: 'makler_name', label: 'Firma / Name', type: 'individual' },
    { key: 'makler_empfehlung', label: 'Intro', type: 'individual' },
    { key: 'makler_email', label: 'E-Mail', type: 'individual' },
    { key: 'makler_telefon_fest', label: 'Telefon (Festnetz)', type: 'individual' },
    { key: 'makler_telefon_mobil', label: 'Telefon (Mobil)', type: 'individual' },
    { key: 'makler_adresse_strasse', label: 'Straße', type: 'individual' },
    { key: 'makler_adresse_hnr', label: 'Hausnummer', type: 'individual' },
    { key: 'makler_adresse_plz', label: 'PLZ', type: 'individual' },
    { key: 'makler_adresse_ort', label: 'Ort', type: 'individual' },
    { key: 'makler_beschreibung', label: 'Leistungsbeschreibung', type: 'individual' },
    { key: 'makler_benefits', label: 'Vorteile / Benefits', type: 'individual' },
    { key: 'makler_provision', label: 'Provisionshinweis', type: 'individual' },
  ]},
  { id: 'marktueberblick', label: 'Marktüberblick', icon: '/icons/ws24_marktbericht_ueberblick.svg', sections: [
    { key: 'immobilienmarkt_allgemein', label: 'Berater-Ansprache (Teaser)', type: 'general' },
    { key: 'immobilienmarkt_standort_teaser', label: 'Standort Teaser', type: 'general' },
    { key: 'immobilienmarkt_individuell_01', label: 'Experteneinschätzung Text 01', type: 'individual' },
    { key: 'immobilienmarkt_zitat', label: 'Experten-Zitat', type: 'individual' },
    { key: 'immobilienmarkt_individuell_02', label: 'Experteneinschätzung Text 02', type: 'individual' },
    { key: 'immobilienmarkt_beschreibung_01', label: 'Marktanalyse Teil 1', type: 'data_driven' },
    { key: 'immobilienmarkt_beschreibung_02', label: 'Marktanalyse Teil 2', type: 'data_driven' },
    { key: 'immobilienmarkt_besonderheiten', label: 'Kaufnebenkosten Info', type: 'general' },
    { key: 'immobilienmarkt_maklerempfehlung', label: 'Maklerempfehlung', type: 'individual' },
  ]},
  { id: 'immobilienpreise', label: 'Immobilienpreise', icon: '/icons/ws24_marktbericht_immobilienpreise.svg', sections: [
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
  { id: 'mietpreise', label: 'Mietpreise', icon: '/icons/ws24_marktbericht_mietpreise.svg', sections: [
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
  { id: 'mietrendite', label: 'Mietrendite', icon: '/icons/ws24_marktbericht_mietrendite.svg', sections: [
    { key: 'mietrendite_intro', label: 'Einleitung Rendite', type: 'general' },
    { key: 'mietrendite_kaufpreisfaktor', label: 'Kaufpreisfaktor Info', type: 'data_driven' },
    { key: 'ueberschrift_mietrendite_bruttomietrendite', label: 'H2 Bruttomietrendite', type: 'individual' },
    { key: 'mietrendite_allgemein', label: 'Rendite Analyse', type: 'data_driven' },
    { key: 'mietrendite_hinweis', label: 'Wichtiger Hinweis', type: 'general' },
    { key: 'mietrendite_etw', label: 'Rendite ETW', type: 'data_driven' },
    { key: 'mietrendite_efh', label: 'Rendite EFH', type: 'data_driven' },
    { key: 'mietrendite_mfh', label: 'Rendite MFH', type: 'data_driven' },
  ]},
  { id: 'wohnmarktsituation', label: 'Wohnmarkt', icon: '/icons/ws24_marktbericht_wohnmarktsituation.svg', sections: [
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
  ]},
  { id: 'wohnlagencheck', label: 'Lagecheck', icon: '/icons/ws24_marktbericht_wohnlagencheck.svg', sections: [
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
  ]},
  { id: 'wirtschaft', label: 'Wirtschaft', icon: '/icons/ws24_marktbericht_wirtschaft.svg', sections: [
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
  ]},
  { id: 'grundstueckspreise', label: 'Grundstücke', icon: '/icons/ws24_marktbericht_grundstueckspreise.svg', sections: [
    { key: 'grundstueckspreise_intro', label: 'Einleitung Grundstücke', type: 'general' },
    { key: 'ueberschrift_grundstueckspreise', label: 'H2 Grundstückspreise', type: 'individual' },
    { key: 'grundstueckspreise_allgemein', label: 'Grundstückspreise Daten', type: 'data_driven' },
    { key: 'grundstueckspreise_preisentwicklung', label: 'Entwicklung Grundstücke', type: 'data_driven' },
  ]}
];

const TAB_CONFIG = RAW_TAB_CONFIG.map((tab) => ({
  ...tab,
  sections: tab.sections.map((section) => ({
    ...section,
    label: getTextKeyLabel(section.key, section.label),
  })),
}));

const MARKETING_TAB_CONFIG = [
  {
    id: 'immobilienmarkt_ueberblick',
    label: 'Marktüberblick',
    icon: '/icons/ws24_marktbericht_ueberblick.svg',
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
    icon: '/icons/ws24_marktbericht_immobilienpreise.svg',
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
    icon: '/icons/ws24_marktbericht_mietpreise.svg',
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
    icon: '/icons/ws24_marktbericht_mietrendite.svg',
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
    icon: '/icons/ws24_marktbericht_wohnmarktsituation.svg',
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
    icon: '/icons/ws24_marktbericht_grundstueckspreise.svg',
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
    icon: '/icons/ws24_marktbericht_wohnlagencheck.svg',
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
    icon: '/icons/ws24_marktbericht_wirtschaft.svg',
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

type MediaFieldState = {
  uploading: boolean;
  error: string | null;
};

const MEDIA_BY_SECTION_KEY: Partial<Record<string, MandatoryMediaKey>> = {
  berater_name: 'media_berater_avatar',
  makler_name: 'media_makler_logo',
};

const MAKLER_MEDIA_KEYS: MandatoryMediaKey[] = ['media_makler_bild_01', 'media_makler_bild_02'];
const INDIVIDUAL_MANDATORY_KEY_SET = new Set<string>(INDIVIDUAL_MANDATORY_KEYS);

type AreaListItem = {
  id: string;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type GlobalBulkReport = {
  processed: string[];
  skipped: string[];
  failed: Array<{ key: string; error: string }>;
};

type BulkScope = 'kreis' | 'kreis_ortslagen';
type GlobalClassKey = 'general' | 'data_driven' | 'market_expert' | 'profile';

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

type LlmIntegrationOption = {
  id: string;
  source: 'partner' | 'global';
  provider: string;
  model: string;
  inputCostUsdPer1k: number | null;
  outputCostUsdPer1k: number | null;
  inputCostEurPer1k: number | null;
  outputCostEurPer1k: number | null;
  partnerIntegrationId: string | null;
  globalProviderId: string | null;
};

type LlmOptionApiRow = {
  id?: string;
  source?: 'partner' | 'global';
  provider?: string;
  model?: string;
  input_cost_usd_per_1k?: number | null;
  output_cost_usd_per_1k?: number | null;
  input_cost_eur_per_1k?: number | null;
  output_cost_eur_per_1k?: number | null;
  partner_integration_id?: string | null;
  global_provider_id?: string | null;
};

type TextEditorFormProps = {
    config: PartnerAreaConfig;
    tableName?: 'report_texts' | 'partner_local_site_texts' | 'partner_marketing_texts';
    enableApproval?: boolean;
    initialTabId?: string;
    focusSectionKey?: string;
    onFocusHandled?: () => void;
    lockedToMandatory?: boolean;
    allowedTabIds?: string[];
    allowedSectionKeys?: string[];
    onPersistSuccess?: () => void;
    onMandatoryProgressChange?: (payload: { areaId: string; completed: number; total: number; percent?: number }) => void;
    onMandatoryProgressLoadingChange?: (loading: boolean) => void;
};

type PersistedTextEditorViewState = {
  activeTab?: string;
  selectedScopeAreaId?: string;
  activeBulkClass?: GlobalClassKey;
  bulkScope?: BulkScope;
};

type TextAreaData = {
  baseTexts: { text: Record<string, Record<string, string>> };
  standardTexts: { text: Record<string, Record<string, string>> };
  dbTexts: TextEntry[];
};

type TextEditorBootstrapPayload = {
  area_id?: string | null;
  root_area_id?: string | null;
  scope_items?: unknown;
  requested_data?: unknown;
  root_data?: unknown;
  mandatory_progress?: {
    completed?: number | null;
    total?: number | null;
    percent?: number | null;
  } | null;
};

const DEBUG_TIMING_STORAGE_KEY = 'debug_timing';

function isDebugTimingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEBUG_TIMING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function withDebugTimingUrl(path: string): string {
  if (!isDebugTimingEnabled() || typeof window === 'undefined') return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set('debug_timing', '1');
  return `${url.pathname}${url.search}`;
}

function logDebugTiming(label: string, durationMs: number, payload: unknown) {
  if (!isDebugTimingEnabled()) return;
  const debugTimings = (
    payload
    && typeof payload === 'object'
    && 'debug_timings' in payload
    && typeof (payload as { debug_timings?: unknown }).debug_timings === 'object'
  )
    ? ((payload as { debug_timings?: Record<string, unknown> }).debug_timings ?? {})
    : {};
  console.table([{
    request: label,
    client_total_ms: Number(durationMs.toFixed(2)),
    ...debugTimings,
  }]);
}

const TEXT_EDITOR_VIEW_STATE_KEY_PREFIX = 'partner_text_editor_view_state_v1';

const GLOBAL_CLASS_ORDER: GlobalClassKey[] = ['market_expert', 'data_driven', 'general', 'profile'];

const GLOBAL_CLASS_META: Record<GlobalClassKey, {
  title: string;
  description: string;
  cycle: string;
  defaultPrompt: string;
}> = {
  general: {
    title: 'General',
    description: 'Einleitungs-, Erklaerungstext',
    cycle: 'einmal, punktuell',
    defaultPrompt: 'Optimiere den General-Text klar, professionell und verständlich. Keine neuen Fakten erfinden.',
  },
  data_driven: {
    title: 'Data-Driven',
    description: 'Datenbasierender Text',
    cycle: 'quartal',
    defaultPrompt: 'Optimiere den data-driven Text sprachlich. Zahlen, Fakten und Aussagen müssen exakt erhalten bleiben.',
  },
  market_expert: {
    title: 'Market Expert',
    description: 'Expertentext zu Markt/Region',
    cycle: 'quartal',
    defaultPrompt: 'Formuliere die Experteneinschätzung präzise und hochwertig. Keine neuen Fakten ergänzen.',
  },
  profile: {
    title: 'Profile',
    description: 'Vorstellungstext Berater, Makler',
    cycle: 'einmal, punktuell',
    defaultPrompt: 'Optimiere den Profiltext professionell, vertrauenswürdig und prägnant. Faktentreu bleiben.',
  },
};

function sanitizeTextNode(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    const nextValue = sanitizeTextNode(entryValue);
    if (typeof nextValue !== 'undefined') out[key] = nextValue;
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeTextTree(value: unknown): Record<string, Record<string, string>> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([groupKey, groupValue]) => {
    const normalizedGroup = sanitizeTextNode(groupValue);
    if (normalizedGroup && typeof normalizedGroup === 'object') {
      out[groupKey] = normalizedGroup;
    }
  });
  return out as Record<string, Record<string, string>>;
}

function normalizeTextEntries(value: unknown): TextEntry[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<TextEntry[]>((acc, entry) => {
      if (!entry || typeof entry !== 'object') return acc;
      const rec = entry as Record<string, unknown>;
      const sectionKey = String(rec.section_key ?? '').trim();
      if (!sectionKey) return acc;
      acc.push({
        section_key: sectionKey,
        optimized_content: typeof rec.optimized_content === 'string' ? rec.optimized_content : null,
        status: typeof rec.status === 'string' ? rec.status : null,
        text_type: typeof rec.text_type === 'string' ? rec.text_type : null,
        last_updated: typeof rec.last_updated === 'string' ? rec.last_updated : null,
      } satisfies TextEntry);
      return acc;
    }, []);
}

function normalizeTextAreaData(value: unknown): TextAreaData {
  const rec = (value && typeof value === 'object') ? (value as Record<string, unknown>) : {};
  const baseTexts = (rec.baseTexts && typeof rec.baseTexts === 'object')
    ? (rec.baseTexts as Record<string, unknown>)
    : {};
  const standardTexts = (rec.standardTexts && typeof rec.standardTexts === 'object')
    ? (rec.standardTexts as Record<string, unknown>)
    : {};
  return {
    baseTexts: { text: normalizeTextTree(baseTexts.text) },
    standardTexts: { text: normalizeTextTree(standardTexts.text) },
    dbTexts: normalizeTextEntries(rec.dbTexts),
  };
}

function normalizeScopeAreaItems(value: unknown, fallbackConfig: PartnerAreaConfig): PartnerAreaConfig[] {
  if (!Array.isArray(value)) return [fallbackConfig];
  const items = value.reduce<PartnerAreaConfig[]>((acc, entry) => {
      if (!entry || typeof entry !== 'object') return acc;
      const rec = entry as Record<string, unknown>;
      const areaId = String(rec.area_id ?? '').trim();
      if (!areaId) return acc;
      const areaRec = (rec.areas && typeof rec.areas === 'object')
        ? (rec.areas as Record<string, unknown>)
        : {};
      acc.push({
        area_id: areaId,
        areas: {
          name: typeof areaRec.name === 'string' ? areaRec.name : undefined,
          slug: typeof areaRec.slug === 'string' ? areaRec.slug : undefined,
          parent_slug: typeof areaRec.parent_slug === 'string' ? areaRec.parent_slug : undefined,
          bundesland_slug: typeof areaRec.bundesland_slug === 'string' ? areaRec.bundesland_slug : undefined,
        },
      } satisfies PartnerAreaConfig);
      return acc;
    }, []);
  return items.length > 0 ? items : [fallbackConfig];
}

export default function TextEditorForm({
    config,
    tableName = 'report_texts',
    enableApproval = false,
    initialTabId,
    focusSectionKey,
    onFocusHandled,
    lockedToMandatory = false,
    allowedTabIds,
    allowedSectionKeys,
    onPersistSuccess,
    onMandatoryProgressChange,
    onMandatoryProgressLoadingChange,
}: TextEditorFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const appliedInitialTabRef = useRef<string | null>(null);
  const textEditorViewStateKey = useMemo(() => {
    const areaId = String(config?.area_id ?? 'global');
    const table = String(tableName ?? 'report_texts');
    const tabScope = Array.isArray(allowedTabIds) && allowedTabIds.length > 0 ? allowedTabIds.join(',') : 'all';
    return `${TEXT_EDITOR_VIEW_STATE_KEY_PREFIX}:${table}:${areaId}:${tabScope}:${lockedToMandatory ? 'mandatory' : 'default'}`;
  }, [allowedTabIds, config?.area_id, lockedToMandatory, tableName]);
  const textEditorInitialViewState = useMemo<PersistedTextEditorViewState>(() => ({
    activeTab: 'marktueberblick',
  }), []);
  const [textEditorViewState, setTextEditorViewState] = useSessionViewState<PersistedTextEditorViewState>(
    textEditorViewStateKey,
    textEditorInitialViewState,
  );
  const activeTab = String(textEditorViewState.activeTab ?? 'marktueberblick');
  const setActiveTab = useCallback((nextTab: string) => {
    setTextEditorViewState((prev) => ({ ...prev, activeTab: nextTab }));
  }, [setTextEditorViewState]);
  const selectedScopeAreaId = String(textEditorViewState.selectedScopeAreaId ?? '');
  const setSelectedScopeAreaId = useCallback((nextAreaId: string) => {
    setTextEditorViewState((prev) => ({ ...prev, selectedScopeAreaId: nextAreaId }));
  }, [setTextEditorViewState]);
  const activeBulkClass = (textEditorViewState.activeBulkClass ?? 'general') as GlobalClassKey;
  const setActiveBulkClass = useCallback((nextClass: GlobalClassKey) => {
    setTextEditorViewState((prev) => ({ ...prev, activeBulkClass: nextClass }));
  }, [setTextEditorViewState]);
  const bulkScope = (textEditorViewState.bulkScope ?? 'kreis') as BulkScope;
  const setBulkScope = useCallback((nextScope: BulkScope) => {
    setTextEditorViewState((prev) => ({ ...prev, bulkScope: nextScope }));
  }, [setTextEditorViewState]);
  const [loading, setLoading] = useState(true);
  const [scopeAreaItems, setScopeAreaItems] = useState<PartnerAreaConfig[]>([]);
  const [areaDataById, setAreaDataById] = useState<Record<string, TextAreaData>>({});
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [classBulkState, setClassBulkState] = useState<{
    classKey: GlobalClassKey;
    scope: BulkScope;
    done: number;
    total: number;
  } | null>(null);
  const [globalPrompts, setGlobalPrompts] = useState<Record<GlobalClassKey, string>>({
    general: GLOBAL_CLASS_META.general.defaultPrompt,
    data_driven: GLOBAL_CLASS_META.data_driven.defaultPrompt,
    market_expert: GLOBAL_CLASS_META.market_expert.defaultPrompt,
    profile: GLOBAL_CLASS_META.profile.defaultPrompt,
  });
  const [globalBulkReport, setGlobalBulkReport] = useState<GlobalBulkReport | null>(null);
  const [costInfoOpenClass, setCostInfoOpenClass] = useState<GlobalClassKey | null>(null);
  const [mediaState, setMediaState] = useState<Record<MandatoryMediaKey, MediaFieldState>>({
    media_berater_avatar: { uploading: false, error: null },
    media_makler_logo: { uploading: false, error: null },
    media_makler_bild_01: { uploading: false, error: null },
    media_makler_bild_02: { uploading: false, error: null },
  });
  const [llmIntegrations, setLlmIntegrations] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState<string>('');
  const [llmOptionsLoading, setLlmOptionsLoading] = useState(false);
  const [llmOptionsLoaded, setLlmOptionsLoaded] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string>('Bereit.');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishDone, setPublishDone] = useState(0);
  const [publishTotal, setPublishTotal] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const topicSectionAnchorId = 'text-editor-topic-section';
  const parts = config?.area_id ? config.area_id.split('-') : [];
  const rootAreaId = String(config?.area_id ?? '').trim();
  const isOrtslage = parts.length > 3;
  const isMarketing = tableName === 'partner_marketing_texts';
  const isLocalSite = tableName === 'partner_local_site_texts';
  const visibleScopeAreaItems = useMemo<PartnerAreaConfig[]>(() => {
    if (bulkScope !== 'kreis' || isOrtslage) return scopeAreaItems;
    const districtItems = scopeAreaItems.filter((item) => String(item.area_id ?? '').trim() === rootAreaId);
    return districtItems.length > 0 ? districtItems : [config];
  }, [bulkScope, config, isOrtslage, rootAreaId, scopeAreaItems]);
  const selectedAreaConfig = useMemo<PartnerAreaConfig>(() => (
    visibleScopeAreaItems.find((item) => item.area_id === selectedScopeAreaId) ?? visibleScopeAreaItems[0] ?? config
  ), [config, selectedScopeAreaId, visibleScopeAreaItems]);
  const selectedAreaIsOrtslage = useMemo(
    () => String(selectedAreaConfig?.area_id ?? '').split('-').length > 3,
    [selectedAreaConfig],
  );
  const selectedAreaData = areaDataById[String(selectedAreaConfig?.area_id ?? '')] ?? null;
  const dbTexts = useMemo(() => selectedAreaData?.dbTexts ?? [], [selectedAreaData]);
  const hasPublishableChanges = useMemo(
    () => dbTexts.some((entry) => (
      Boolean(String(entry?.optimized_content ?? '').trim())
      && String(entry?.status ?? '').trim().toLowerCase() !== 'approved'
    )),
    [dbTexts],
  );
  const mandatoryProgressByAreaRef = useRef<Record<string, { completed: number; total: number; percent?: number }>>({});

  const emitMandatoryProgress = useCallback((areaId: string, progress: { completed: number; total: number; percent?: number }) => {
    mandatoryProgressByAreaRef.current[areaId] = progress;
    onMandatoryProgressChange?.({
      areaId,
      completed: progress.completed,
      total: progress.total,
      percent: progress.percent,
    });
  }, [onMandatoryProgressChange]);

  const emitDerivedMandatoryProgress = useCallback((areaId: string, entries: TextEntry[]) => {
    if (tableName !== 'report_texts') return;
    const uniqueFilled = new Set<string>();
    for (const entry of entries) {
      const key = String(entry.section_key ?? '');
      const isMandatoryText = INDIVIDUAL_MANDATORY_KEYS.includes(key as (typeof INDIVIDUAL_MANDATORY_KEYS)[number]);
      const isMandatoryMedia = MANDATORY_MEDIA_KEYS.includes(key as (typeof MANDATORY_MEDIA_KEYS)[number]);
      if (!isMandatoryText && !isMandatoryMedia) continue;
      const value = String(entry.optimized_content ?? '').trim();
      if (value) uniqueFilled.add(key);
    }
    const total = INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length;
    const completed = uniqueFilled.size;
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0;
    emitMandatoryProgress(areaId, { completed, total, percent });
  }, [emitMandatoryProgress, tableName]);

  const loadAreaTextData = useCallback(async (areaConfig: PartnerAreaConfig): Promise<TextAreaData> => {
    const areaId = String(areaConfig?.area_id ?? '').trim();
    const rootAreaId = String(config?.area_id ?? '').trim();
    const params = new URLSearchParams({
      area_id: areaId,
      root_area_id: rootAreaId,
      table: tableName,
    });
    const requestUrl = withDebugTimingUrl(`/api/partner/text-editor/bootstrap?${params.toString()}`);
    const startedAt = performance.now();
    const res = await fetch(requestUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => null) as TextEditorBootstrapPayload | null;
    logDebugTiming(requestUrl, performance.now() - startedAt, payload);
    if (!res.ok) {
      throw new Error(String(payload && typeof payload === 'object' && 'error' in payload ? payload.error : 'Texteditor-Bootstrap fehlgeschlagen'));
    }

    const nextScopeItems = normalizeScopeAreaItems(payload?.scope_items, config);
    const requestedAreaId = String(payload?.area_id ?? areaId).trim() || areaId;
    const nextRequestedData = normalizeTextAreaData(payload?.requested_data);
    const nextRootAreaId = String(payload?.root_area_id ?? rootAreaId).trim() || rootAreaId;
    const nextRootData = payload?.root_data ? normalizeTextAreaData(payload.root_data) : null;
    const nextMandatoryProgress = payload?.mandatory_progress && typeof payload.mandatory_progress === 'object'
      ? {
          completed: Number(payload.mandatory_progress.completed ?? 0),
          total: Number(payload.mandatory_progress.total ?? (INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length)),
          percent: Number(payload.mandatory_progress.percent ?? 0),
        }
      : null;

    setScopeAreaItems(nextScopeItems);
    setAreaDataById((prev) => {
      const next = { ...prev, [requestedAreaId]: nextRequestedData };
      if (nextRootData && nextRootAreaId) {
        next[nextRootAreaId] = nextRootData;
      }
      return next;
    });
    if (tableName === 'report_texts' && nextMandatoryProgress) {
      emitMandatoryProgress(requestedAreaId, nextMandatoryProgress);
    }

    return nextRequestedData;
  }, [config, emitMandatoryProgress, tableName]);

  const ensureAreaTextData = useCallback(async (areaConfig: PartnerAreaConfig, options?: { force?: boolean }) => {
    const areaId = String(areaConfig?.area_id ?? '').trim();
    if (!areaId) return null;
    if (!options?.force && areaDataById[areaId] && (scopeAreaItems.length > 0 || isOrtslage)) return areaDataById[areaId];
    const nextData = await loadAreaTextData(areaConfig);
    return nextData;
  }, [areaDataById, isOrtslage, loadAreaTextData, scopeAreaItems.length]);

  const llmOptionsRequestRef = useRef<Promise<LlmIntegrationOption[]> | null>(null);

  const ensureLlmOptions = useCallback(async (): Promise<LlmIntegrationOption[]> => {
    if (llmOptionsLoaded) return llmIntegrations;
    if (llmOptionsRequestRef.current) return llmOptionsRequestRef.current;
    const request = (async () => {
      setLlmOptionsLoading(true);
      const requestUrl = withDebugTimingUrl('/api/partner/llm/options');
      const startedAt = performance.now();
      try {
        const integrationsRes = await fetch(requestUrl);
        if (integrationsRes.ok) {
          const integrationsPayload = await integrationsRes.json().catch(() => ({}));
          logDebugTiming(requestUrl, performance.now() - startedAt, integrationsPayload);
          const items: LlmOptionApiRow[] = Array.isArray(integrationsPayload?.options)
            ? (integrationsPayload.options as LlmOptionApiRow[])
            : [];
          const llmModeDefault = String(integrationsPayload?.llm_mode_default ?? '').trim().toLowerCase();
          const llmItems: LlmIntegrationOption[] = items
            .reduce<LlmIntegrationOption[]>((acc, entry) => {
              const id = String(entry?.id ?? '').trim();
              if (!id) return acc;
              const provider = String(entry?.provider ?? '').trim() || 'LLM';
              const model = String(entry?.model ?? '').trim() || 'Standardmodell';
              const source = String(entry?.source ?? '').toLowerCase() === 'global' ? 'global' : 'partner';
              acc.push({
                id,
                source,
                provider,
                model,
                inputCostUsdPer1k: typeof entry?.input_cost_usd_per_1k === 'number' ? entry.input_cost_usd_per_1k : null,
                outputCostUsdPer1k: typeof entry?.output_cost_usd_per_1k === 'number' ? entry.output_cost_usd_per_1k : null,
                inputCostEurPer1k: typeof entry?.input_cost_eur_per_1k === 'number' ? entry.input_cost_eur_per_1k : null,
                outputCostEurPer1k: typeof entry?.output_cost_eur_per_1k === 'number' ? entry.output_cost_eur_per_1k : null,
                partnerIntegrationId: String(entry?.partner_integration_id ?? '').trim() || null,
                globalProviderId: String(entry?.global_provider_id ?? '').trim() || null,
              } satisfies LlmIntegrationOption);
              return acc;
            }, []);
          setLlmIntegrations(llmItems);
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
        logDebugTiming(requestUrl, performance.now() - startedAt, null);
        setLlmIntegrations([]);
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
  }, [llmIntegrations, llmOptionsLoaded]);

  useEffect(() => {
    if (!rootAreaId) return;
    if (visibleScopeAreaItems.length === 0) return;
    if (visibleScopeAreaItems.some((item) => item.area_id === selectedScopeAreaId)) return;
    setSelectedScopeAreaId(rootAreaId);
  }, [rootAreaId, selectedScopeAreaId, setSelectedScopeAreaId, visibleScopeAreaItems]);

  useEffect(() => {
    let cancelled = false;

    async function loadEditorData() {
      if (!selectedAreaConfig?.area_id) return;
      const areaId = String(selectedAreaConfig.area_id);
      if (areaDataById[areaId]) {
        onMandatoryProgressLoadingChange?.(false);
        setLoading(false);
      } else {
        onMandatoryProgressLoadingChange?.(true);
        setLoading(true);
        try {
          await ensureAreaTextData(selectedAreaConfig);
        } catch (error) {
          console.error('Fehler beim Laden der Bereichstexte:', error);
        } finally {
          onMandatoryProgressLoadingChange?.(false);
          if (!cancelled) setLoading(false);
        }
      }
    }

    void loadEditorData();
    return () => {
      cancelled = true;
    };
  }, [areaDataById, config, ensureAreaTextData, onMandatoryProgressLoadingChange, selectedAreaConfig]);

  useEffect(() => {
    if (tableName !== 'report_texts') return;
    const areaId = String(selectedAreaConfig?.area_id ?? '').trim();
    if (!areaId) return;
    const cached = mandatoryProgressByAreaRef.current[areaId];
    if (cached) {
      onMandatoryProgressChange?.({
        areaId,
        completed: cached.completed,
        total: cached.total,
        percent: cached.percent,
      });
      return;
    }
    if (selectedAreaData) {
      emitDerivedMandatoryProgress(areaId, selectedAreaData.dbTexts ?? []);
    }
  }, [emitDerivedMandatoryProgress, onMandatoryProgressChange, selectedAreaConfig, selectedAreaData, tableName]);

  const tabConfig = isMarketing ? MARKETING_TAB_CONFIG : TAB_CONFIG;
  const visibleGlobalClassOrder = useMemo(
    () => (isLocalSite ? GLOBAL_CLASS_ORDER.filter((classKey) => classKey !== 'profile') : GLOBAL_CLASS_ORDER),
    [isLocalSite],
  );
  const resolveVisibleTabs = useCallback((areaIsOrtslage: boolean) => {
    const hiddenTabIds = new Set(['berater', 'makler', 'marktueberblick']);
    const shouldHideTabs = !isMarketing && areaIsOrtslage;
    let nextVisibleTabs = shouldHideTabs
      ? tabConfig.filter((tab) => !hiddenTabIds.has(tab.id))
      : tabConfig;
    if (isLocalSite) {
      nextVisibleTabs = nextVisibleTabs.filter((tab) => tab.id !== 'berater' && tab.id !== 'makler');
    }
    if (Array.isArray(allowedTabIds) && allowedTabIds.length > 0) {
      const allowed = new Set(allowedTabIds);
      nextVisibleTabs = nextVisibleTabs.filter((tab) => allowed.has(tab.id));
    }
    if (isMarketing && areaIsOrtslage) {
      nextVisibleTabs = nextVisibleTabs.filter((tab) => tab.id !== 'immobilienmarkt_ueberblick');
    }
    return nextVisibleTabs;
  }, [allowedTabIds, isLocalSite, isMarketing, tabConfig]);
  const rootVisibleTabs = useMemo(() => resolveVisibleTabs(isOrtslage), [isOrtslage, resolveVisibleTabs]);
  const visibleTabs = useMemo(
    () => resolveVisibleTabs(selectedAreaIsOrtslage),
    [resolveVisibleTabs, selectedAreaIsOrtslage],
  );
  const allowedSectionSet = useMemo(
    () => (Array.isArray(allowedSectionKeys) && allowedSectionKeys.length > 0 ? new Set(allowedSectionKeys) : null),
    [allowedSectionKeys],
  );
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const exists = visibleTabs.some((tab) => tab.id === activeTab);
    if (!exists) setActiveTab(visibleTabs[0].id);
  }, [activeTab, setActiveTab, visibleTabs]);

  useEffect(() => {
    if (visibleGlobalClassOrder.includes(activeBulkClass)) return;
    setActiveBulkClass(visibleGlobalClassOrder[0] ?? 'general');
  }, [activeBulkClass, setActiveBulkClass, visibleGlobalClassOrder]);

  useEffect(() => {
    if (!initialTabId) return;
    if (appliedInitialTabRef.current === initialTabId) return;
    const exists = visibleTabs.some((tab) => tab.id === initialTabId);
    if (exists) {
      setActiveTab(initialTabId);
      appliedInitialTabRef.current = initialTabId;
    }
  }, [initialTabId, setActiveTab, visibleTabs]);

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

  const scrollToTopicSection = () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(topicSectionAnchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateAreaDbTexts = (
    areaId: string,
    updater: (prev: TextEntry[]) => TextEntry[],
  ) => {
    setAreaDataById((prev) => {
      const current = prev[areaId];
      if (!current) return prev;
      return {
        ...prev,
        [areaId]: {
          ...current,
          dbTexts: updater(current.dbTexts),
        },
      };
    });
  };

  const getRawTextFromDataset = useCallback((
    dataset: TextAreaData | null,
    areaIsOrtslage: boolean,
    key: string,
    preferredGroup?: string | null,
  ) => {
    if (areaIsOrtslage && !isMarketing && isOrtslageMarketExpertHeadingKey(key)) {
      return '';
    }
    const currentBaseTexts = dataset?.baseTexts?.text ?? {};
    const fallbackText = dataset?.standardTexts?.text ?? {};
    const allowStandardFallback = !isAdvisorOrBrokerKey(key);
    if (key.includes('.')) {
      const value = getValueByPath(currentBaseTexts, key.split('.'));
      if (typeof value === 'string') return value;
      if (!allowStandardFallback) return '';
      const fallback = getValueByPath(fallbackText, key.split('.'));
      return typeof fallback === 'string' ? fallback : '';
    }
    if (preferredGroup && currentBaseTexts[preferredGroup] && typeof currentBaseTexts[preferredGroup] === 'object') {
      const preferred = currentBaseTexts[preferredGroup][key];
      if (typeof preferred === 'string') return preferred;
      if (!allowStandardFallback) return '';
      const fallbackPreferred = fallbackText[preferredGroup]?.[key];
      if (typeof fallbackPreferred === 'string') return fallbackPreferred;
    }
    const groups = Object.keys(currentBaseTexts);
    for (const group of groups) {
      const value = currentBaseTexts[group]?.[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
    if (!allowStandardFallback) return '';
    const fallbackGroups = Object.keys(fallbackText);
    for (const group of fallbackGroups) {
      const value = fallbackText[group]?.[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
    return '';
  }, [isMarketing]);

  const saveText = async (key: string, content: string, type: string, sourceGroup?: string | null) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const status = enableApproval ? 'draft' : 'approved';
      const areaId = String(selectedAreaConfig?.area_id ?? config.area_id);
      const { error } = await supabase.from(tableName).upsert({
        partner_id: user.id,
        area_id: areaId,
        section_key: key,
        text_type: type,
        raw_content: getRawTextFromDataset(selectedAreaData, selectedAreaIsOrtslage, key, sourceGroup),
        optimized_content: content,
        status,
        last_updated: new Date().toISOString()
      }, { onConflict: 'partner_id,area_id,section_key' });
      if (!error) {
        const nextEntries = (() => {
          const prev = selectedAreaData?.dbTexts ?? [];
          const filtered = prev.filter(t => t.section_key !== key);
          return [...filtered, { section_key: key, optimized_content: content, status, text_type: type }];
        })();
        updateAreaDbTexts(areaId, () => nextEntries);
        emitDerivedMandatoryProgress(areaId, nextEntries);
        onPersistSuccess?.();
      }
    }
    setSaving(false);
  };

  const resetTextToSystem = async (key: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const areaId = String(selectedAreaConfig?.area_id ?? config.area_id);
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('partner_id', user.id)
        .eq('area_id', areaId)
        .eq('section_key', key);
      if (!error) {
        const nextEntries = (selectedAreaData?.dbTexts ?? []).filter((entry) => entry.section_key !== key);
        updateAreaDbTexts(areaId, () => nextEntries);
        emitDerivedMandatoryProgress(areaId, nextEntries);
        onPersistSuccess?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const approveAllTextsStrict = async (): Promise<{ approvedCount: number; changedKeys: string[] }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { approvedCount: 0, changedKeys: [] };
    const areaId = String(selectedAreaConfig?.area_id ?? config.area_id);
    const { data: currentRows } = await supabase
      .from(tableName)
      .select('section_key, optimized_content, status, text_type')
      .eq('area_id', areaId)
      .eq('partner_id', user.id);
    const rows = Array.isArray(currentRows) ? (currentRows as TextEntry[]) : [];
    const nowIso = new Date().toISOString();
    const changedRows = rows.filter((entry) => (
      Boolean(String(entry.optimized_content ?? '').trim())
      && String(entry.status ?? '').trim().toLowerCase() !== 'approved'
    ));
    const changedKeys = changedRows.map((entry) => String(entry.section_key ?? '').trim()).filter(Boolean);
    const entriesToApprove = changedRows
      .filter((entry) => Boolean(String(entry.optimized_content ?? '').trim()))
      .map((entry) => ({
        partner_id: user.id,
        area_id: areaId,
        section_key: entry.section_key,
        text_type: entry.text_type ?? null,
        raw_content: getRawTextFromDataset(selectedAreaData, selectedAreaIsOrtslage, entry.section_key),
        optimized_content: String(entry.optimized_content ?? ''),
        status: 'approved',
        last_updated: nowIso,
      }));
    if (entriesToApprove.length === 0) return { approvedCount: 0, changedKeys: [] };
    const { error } = await supabase
      .from(tableName)
      .upsert(entriesToApprove, { onConflict: 'partner_id,area_id,section_key' });
    if (error) throw error;
    updateAreaDbTexts(areaId, (prev) =>
      prev.map((entry) =>
        String(entry.optimized_content ?? '').trim()
          ? { ...entry, status: 'approved', last_updated: nowIso }
          : entry,
      ),
    );
    return { approvedCount: entriesToApprove.length, changedKeys };
  };

  const handleSaveAndApprove = async () => {
    if (publishing) return;
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
    setPublishModalOpen(true);
    setPublishError(null);
    setPublishDone(0);
    setPublishTotal(1);
    setPublishStatus('Deutsche Inhalte werden gespeichert und freigegeben …');
    setPublishing(true);
    setSaving(true);
    try {
      const { approvedCount, changedKeys } = await approveAllTextsStrict();
      setPublishDone(1);
      if (changedKeys.length === 0) {
        setPublishStatus('Keine geänderten Textfelder gefunden. Es wurden keine deutschen Freigaben aktualisiert.');
        onPersistSuccess?.();
        return;
      }
      setPublishStatus(
        `${approvedCount} Textfelder wurden freigegeben.`,
      );
      onPersistSuccess?.();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Speichern & Freigeben fehlgeschlagen.');
      setPublishStatus('Der Vorgang wurde mit Fehler beendet.');
    } finally {
      setPublishing(false);
      setSaving(false);
    }
  };

  const getMediaEntry = (key: MandatoryMediaKey): TextEntry | undefined =>
    dbTexts.find((entry) => entry.section_key === key);

  const compressImageToWebp = async (
    file: File,
    maxWidth: number,
    maxHeight: number,
    maxUploadBytes: number,
  ): Promise<File> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Bild konnte nicht gelesen werden.'));
      };
      img.src = objectUrl;
    });
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar.');
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const qualitySteps = [0.84, 0.76, 0.68, 0.6];
    let bestBlob: Blob | null = null;

    for (const quality of qualitySteps) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((next) => resolve(next), 'image/webp', quality),
      );
      if (!blob) continue;
      bestBlob = blob;
      if (blob.size <= maxUploadBytes) break;
    }

    if (!bestBlob) throw new Error('Bildkonvertierung fehlgeschlagen.');
    return new File([bestBlob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.webp', { type: 'image/webp' });
  };

  const uploadMandatoryMedia = async (assetKey: MandatoryMediaKey, rawFile: File) => {
    const spec = MANDATORY_MEDIA_SPECS[assetKey];
    setMediaState((prev) => ({ ...prev, [assetKey]: { uploading: true, error: null } }));
    try {
      const file = await compressImageToWebp(rawFile, spec.maxWidth, spec.maxHeight, spec.maxUploadBytes);
      if (file.size > spec.maxUploadBytes) {
        throw new Error(
          `Datei zu groß nach Konvertierung (${Math.round(file.size / 1024)} KB). Ziel: max. ${Math.round(
            spec.maxUploadBytes / 1024,
          )} KB.`,
        );
      }

      const form = new FormData();
      form.append('asset_key', assetKey);
      form.append('file', file);
      const areaId = String(selectedAreaConfig?.area_id ?? config.area_id);

      const res = await fetch(`/api/partner/areas/${encodeURIComponent(areaId)}/media/upload`, {
        method: 'POST',
        body: form,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error ?? `Upload fehlgeschlagen (${res.status})`));
      }

      const url = String(payload?.url ?? '');
      if (!url) throw new Error('Upload erfolgreich, aber ohne URL.');

      const nextEntries = [
        ...(selectedAreaData?.dbTexts ?? []).filter((entry) => entry.section_key !== assetKey),
        {
          section_key: assetKey,
          optimized_content: url,
          status: 'draft',
          text_type: 'individual',
          last_updated: new Date().toISOString(),
        },
      ];
      updateAreaDbTexts(areaId, () => nextEntries);
      emitDerivedMandatoryProgress(areaId, nextEntries);
      onPersistSuccess?.();
      setMediaState((prev) => ({ ...prev, [assetKey]: { uploading: false, error: null } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload fehlgeschlagen.';
      setMediaState((prev) => ({ ...prev, [assetKey]: { uploading: false, error: message } }));
    }
  };

  const requestAiRewrite = async (
    key: string,
    currentText: string,
    type: string,
    label: string,
    customPrompt?: string,
    areaConfigOverride?: PartnerAreaConfig,
  ) => {
    const availableOptions = llmIntegrations.length > 0 ? llmIntegrations : await ensureLlmOptions();
    const selectedOption = availableOptions.find((item) => item.id === (selectedLlmIntegrationId || availableOptions[0]?.id));
    if (!selectedOption) return null;
    const targetAreaConfig = areaConfigOverride ?? selectedAreaConfig ?? config;
    try {
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: currentText, 
          areaName: targetAreaConfig?.areas?.name || targetAreaConfig.area_id,
          area_id: targetAreaConfig?.area_id,
          type: type,
          sectionLabel: label,
          customPrompt: customPrompt || undefined,
          llm_integration_id: selectedOption?.partnerIntegrationId || undefined,
          llm_global_provider_id: selectedOption?.globalProviderId || undefined,
        }),
      });
      const data = await res.json();
      if (typeof data?.optimizedText === 'string' && data.optimizedText.trim().length > 0) {
        return data.optimizedText;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleAiRewrite = async (
    key: string,
    currentText: string,
    type: string,
    label: string,
    customPrompt?: string,
  ) => {
    setRewritingKey(key);
    const optimizedText = await requestAiRewrite(key, currentText, type, label, customPrompt, selectedAreaConfig);
    if (optimizedText) {
      await saveText(key, optimizedText, type);
    }
    setRewritingKey(null);
  };

  const upsertTextForArea = async (
    areaId: string,
    key: string,
    content: string,
    type: string,
    rawContent: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const status = enableApproval ? 'draft' : 'approved';
    await supabase.from(tableName).upsert({
      partner_id: user.id,
      area_id: areaId,
      section_key: key,
      text_type: type,
      raw_content: rawContent,
      optimized_content: content,
      status,
      last_updated: new Date().toISOString()
    }, { onConflict: 'partner_id,area_id,section_key' });
  };

  const getCurrentTextForDataset = useCallback((
    dataset: TextAreaData | null,
    areaIsOrtslage: boolean,
    sectionKey: string,
    sectionGroup: string | null,
  ) => {
    const dbEntry = dataset?.dbTexts.find((t) => t.section_key === sectionKey);
    return dbEntry?.optimized_content ?? getRawTextFromDataset(dataset, areaIsOrtslage, sectionKey, sectionGroup);
  }, [getRawTextFromDataset]);

  const isProfileAiEligible = (sectionKey: string): boolean => {
    const key = String(sectionKey ?? '').toLowerCase();
    if (!key) return false;
    if (
      key.endsWith('_name')
      || key.endsWith('_email')
      || key.includes('telefon')
      || key.includes('adresse_')
      || key.endsWith('_plz')
      || key.endsWith('_hnr')
    ) return false;
    return true;
  };

  const collectBulkTasks = useCallback((classKey: GlobalClassKey) => {
    const tasks: Array<{ key: string; label: string; type: string; sectionGroup: string | null }> = [];
    const dedupe = new Set<string>();
    for (const tab of rootVisibleTabs) {
      const sectionGroup = resolveGroupForTab(tab.id);
      for (const section of tab.sections) {
        if (allowedSectionSet && !allowedSectionSet.has(section.key)) continue;
        if (dedupe.has(section.key)) continue;
        const displayClass = resolveDisplayTextClass(section.key, section.type);
        if (displayClass !== classKey) continue;
        if (classKey === 'profile' && !isProfileAiEligible(section.key)) continue;
        dedupe.add(section.key);
        tasks.push({ key: section.key, label: section.label, type: section.type, sectionGroup });
      }
    }
    return tasks;
  }, [allowedSectionSet, rootVisibleTabs]);

  const selectedLlmOption = useMemo(
    () => llmIntegrations.find((item) => item.id === (selectedLlmIntegrationId || llmIntegrations[0]?.id)) ?? null,
    [llmIntegrations, selectedLlmIntegrationId],
  );

  const classEstimateMap = useMemo(() => {
    const areaMultiplier = bulkScope === 'kreis_ortslagen' && !isOrtslage ? Math.max(1, scopeAreaItems.length) : 1;
    return visibleGlobalClassOrder.reduce((acc, classKey) => {
      const tasks = collectBulkTasks(classKey);
      const texts = tasks.flatMap((task) => {
        const source = getCurrentTextForDataset(
          areaDataById[String(config?.area_id ?? '')] ?? null,
          isOrtslage,
          task.key,
          task.sectionGroup,
        );
        if (!String(source ?? '').trim()) return [];
        return Array.from({ length: areaMultiplier }, () => source);
      });
      const totals = texts.reduce(
        (sum, text) => {
          const estimate = estimateTokensFromText(text);
          return {
            promptTokens: sum.promptTokens + estimate.prompt_tokens,
            completionTokens: sum.completionTokens + estimate.completion_tokens,
            totalTokens: sum.totalTokens + estimate.total_tokens,
          };
        },
        { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      );
      const inputCostUsdPer1k = selectedLlmOption?.inputCostUsdPer1k ?? null;
      const outputCostUsdPer1k = selectedLlmOption?.outputCostUsdPer1k ?? null;
      const inputCostEurPer1k = selectedLlmOption?.inputCostEurPer1k ?? null;
      const outputCostEurPer1k = selectedLlmOption?.outputCostEurPer1k ?? null;
      const promptOverheadEstimate = estimateTokensFromText(String(globalPrompts[classKey] ?? '').trim());
      const promptOverheadPerTask = promptOverheadEstimate.prompt_tokens + 48;
      const adjustedPromptTokens = totals.promptTokens + (tasks.length * areaMultiplier * promptOverheadPerTask);
      const adjustedTotalTokens = adjustedPromptTokens + totals.completionTokens;
      const estimatedCostUsd = inputCostUsdPer1k !== null && outputCostUsdPer1k !== null
        ? Number((
          (adjustedPromptTokens / 1000) * inputCostUsdPer1k
          + (totals.completionTokens / 1000) * outputCostUsdPer1k
        ).toFixed(4))
        : null;
      const estimatedCostEur = inputCostEurPer1k !== null && outputCostEurPer1k !== null
        ? Number((
          (adjustedPromptTokens / 1000) * inputCostEurPer1k
          + (totals.completionTokens / 1000) * outputCostEurPer1k
        ).toFixed(4))
        : null;
      acc[classKey] = {
        totalTexts: tasks.length,
        areaMultiplier,
        totalTokens: adjustedTotalTokens,
        estimatedCostUsd,
        estimatedCostEur,
      };
      return acc;
    }, {} as Record<GlobalClassKey, {
        totalTexts: number;
        areaMultiplier: number;
        totalTokens: number;
        estimatedCostUsd: number | null;
        estimatedCostEur: number | null;
      }>);
  }, [areaDataById, bulkScope, collectBulkTasks, config?.area_id, getCurrentTextForDataset, globalPrompts, isOrtslage, scopeAreaItems.length, selectedLlmOption, visibleGlobalClassOrder]);

  const runBulkByTextClass = async (classKey: GlobalClassKey) => {
    if (classBulkState) return;
    const rootData = areaDataById[String(config.area_id)] ?? await ensureAreaTextData(config);
    const tasks = collectBulkTasks(classKey);
    if (tasks.length === 0) return;
    const scope = bulkScope;
    const withOrtslagen = scope === 'kreis_ortslagen' && !isOrtslage;
    try {
      let done = 0;
      const customPrompt = String(globalPrompts[classKey] ?? '').trim() || undefined;
      let ortAreas: AreaListItem[] = [];
      if (withOrtslagen) {
        const bundeslandSlug = String(config?.areas?.bundesland_slug || '');
        const kreisSlug = String(config?.areas?.slug || '');
        const { data } = await supabase
          .from('areas')
          .select('id, name, slug, parent_slug, bundesland_slug')
          .eq('bundesland_slug', bundeslandSlug)
          .eq('parent_slug', kreisSlug);
        ortAreas = (data ?? []) as AreaListItem[];
      }
      const total = withOrtslagen ? (tasks.length * (1 + ortAreas.length)) : tasks.length;
      setClassBulkState({ classKey, scope, done: 0, total });
      setGlobalBulkReport({ processed: [], skipped: [], failed: [] });
      for (const task of tasks) {
        setRewritingKey(task.key);
        const sourceText = getCurrentTextForDataset(rootData, isOrtslage, task.key, task.sectionGroup);
        if (!String(sourceText || '').trim()) {
          done += withOrtslagen ? (1 + ortAreas.length) : 1;
          setClassBulkState((prev) => prev ? { ...prev, done } : null);
          setGlobalBulkReport((prev) => prev ? { ...prev, skipped: [...prev.skipped, `${task.key} (kein Quelltext)`] } : prev);
          continue;
        }
        const kreisText = await requestAiRewrite(task.key, sourceText, task.type, task.label, customPrompt, config);
        if (kreisText) {
          try {
            const rawContent = getRawTextFromDataset(rootData, isOrtslage, task.key, task.sectionGroup);
            await upsertTextForArea(config.area_id, task.key, kreisText, task.type, rawContent);
            updateAreaDbTexts(config.area_id, (prev) => {
              const filtered = prev.filter((entry) => entry.section_key !== task.key);
              return [...filtered, { section_key: task.key, optimized_content: kreisText, status: enableApproval ? 'draft' : 'approved', text_type: task.type }];
            });
            setGlobalBulkReport((prev) => prev ? { ...prev, processed: [...prev.processed, `${task.key} (Kreis)`] } : prev);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'save failed';
            setGlobalBulkReport((prev) => prev ? { ...prev, failed: [...prev.failed, { key: task.key, error: message }] } : prev);
          }
        } else {
          setGlobalBulkReport((prev) => prev ? { ...prev, failed: [...prev.failed, { key: task.key, error: 'KI-Antwort leer' }] } : prev);
        }
        done += 1;
        setClassBulkState((prev) => prev ? { ...prev, done } : null);

        if (withOrtslagen) {
          for (const ort of ortAreas) {
            const ortName = String(ort.name || ort.slug || '').trim();
            const ortText = String(kreisText ?? '')
              .replace(/\{ortsname\}/g, ortName)
              .replace(/\[\[ORTSLAGE_NAME\]\]/g, ortName);
            if (!ortText.trim()) continue;
            try {
              await upsertTextForArea(ort.id, task.key, ortText, task.type, sourceText);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'upsert failed';
              setGlobalBulkReport((prev) =>
                prev ? { ...prev, failed: [...prev.failed, { key: `${task.key}:${ort.id}`, error: message }] } : prev,
              );
            }
            done += 1;
            setClassBulkState((prev) => prev ? { ...prev, done } : null);
          }
          setGlobalBulkReport((prev) => prev ? { ...prev, processed: [...prev.processed, `${task.key} (Ortslagen)`] } : prev);
        }
      }
      const selectedAreaId = String(selectedAreaConfig?.area_id ?? config.area_id);
      if (selectedAreaId && selectedAreaId !== config.area_id) {
        await ensureAreaTextData(selectedAreaConfig, { force: true });
      }
      await ensureAreaTextData(config, { force: true });
    } finally {
      setRewritingKey(null);
      setClassBulkState(null);
    }
  };

  const getRawTextFromJSON = (key: string, preferredGroup?: string | null) =>
    getRawTextFromDataset(selectedAreaData, selectedAreaIsOrtslage, key, preferredGroup);

  function formatEstimatedCost(value: number | null, currency: 'USD' | 'EUR'): string {
    if (value === null || !Number.isFinite(value)) return `n/a ${currency}`;
    return `${value.toFixed(value < 1 ? 4 : 2)} ${currency}`;
  }

  const showTopLlmCard = !lockedToMandatory;

  useEffect(() => {
    if (!showTopLlmCard) return;
    void ensureLlmOptions();
  }, [ensureLlmOptions, showTopLlmCard]);

  if (loading) {
    return <FullscreenLoader show label="Sektionen werden geladen..." />;
  }

  const activeTabConfig = visibleTabs.find(t => t.id === activeTab);
  const sections = activeTabConfig?.sections ?? [];
  const activeSections = sections.filter((section) => {
    if (allowedSectionSet && !allowedSectionSet.has(section.key)) return false;
    if (lockedToMandatory) return true;
    if (isMarketing) return true;
    return resolveDisplayTextClass(section.key, section.type) === activeBulkClass;
  });
  const isBulkRewriting = Boolean(classBulkState);
  const showGlobalClassActions = !isMarketing && !lockedToMandatory;
  const showScopeAreaSidebar = !lockedToMandatory && !isOrtslage && visibleScopeAreaItems.length > 1;

  return (
    <div style={{ width: '100%' }}>
      <div style={showTopLlmCard || showGlobalClassActions ? workflowCardStackStyle : undefined}>
      {showTopLlmCard ? (
        <>
          <div style={textWorkflowTopCardStyle}>
            <div style={textWorkflowTopControlsStyle}>
              <label style={textWorkflowTopFieldStyle}>
                <select
                  value={selectedLlmIntegrationId || llmIntegrations[0]?.id || ''}
                  onChange={(e) => setSelectedLlmIntegrationId(e.target.value)}
                  style={textWorkflowTopSelectStyle}
                  aria-label="KI-Modell auswählen"
                  disabled={llmOptionsLoading || (llmOptionsLoaded && llmIntegrations.length === 0)}
                >
                  {!llmOptionsLoaded || llmOptionsLoading ? <option value="">Modelle werden geladen...</option> : null}
                  {llmOptionsLoaded && llmIntegrations.length === 0 ? <option value="">Kein LLM verfügbar</option> : null}
                  {llmIntegrations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${formatProviderLabel(item.provider)} · ${item.model}${item.source === 'global' ? ' (Global)' : ''}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </>
      ) : null}
      {showGlobalClassActions ? (
        <>
          <div style={{ ...textWorkflowCardStyle, marginBottom: 0 }}>
            <div style={textWorkflowHeaderStyle}>
              <div style={textWorkflowHeaderInlineStyle}>
                <h3 style={sectionTabsIntroTitleStyle}>Bereich wählen -&gt;</h3>
                <label style={textWorkflowInlineFieldStyle}>
                  <select
                    value={bulkScope}
                    onChange={(e) => setBulkScope(e.target.value as BulkScope)}
                    style={textWorkflowInlineSelectStyle}
                    disabled={isBulkRewriting || isOrtslage}
                  >
                    <option value="kreis">Nur Kreis</option>
                    <option value="kreis_ortslagen" disabled={isOrtslage}>Kreis + Ortslagen</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={isLocalSite ? localSiteClassGridStyle : textWorkflowClassGridStyle}>
              {visibleGlobalClassOrder.map((classKey) => {
                const meta = GLOBAL_CLASS_META[classKey];
                const active = activeBulkClass === classKey;
                const estimate = classEstimateMap[classKey];
                const isRunningThisCard = classBulkState?.classKey === classKey;
                const buttonDisabled = isBulkRewriting && !isRunningThisCard;
                return (
                  <div
                    key={classKey}
                    style={textWorkflowClassCardStyle(active)}
                    onClick={() => setActiveBulkClass(classKey)}
                  >
                    <div style={textWorkflowClassTopStyle}>
                      <span style={textWorkflowClassBadgeStyle(classKey)}>{meta.title}</span>
                    </div>
                    <p style={textWorkflowClassTextStyle}>Texttyp: {meta.description}</p>
                    <p style={textWorkflowClassCycleStyle}>Zyklus: {meta.cycle}</p>
                    <div style={textWorkflowClassStatsStyle}>
                      <span style={textWorkflowClassStatLineStyle}>
                        Gebiete: {estimate.areaMultiplier} Texte: {estimate.totalTexts} Tokens ca.: {estimate.totalTokens.toLocaleString('de-DE')}
                      </span>
                    </div>
                    <div style={textWorkflowClassCostStyle}>
                      <span style={textWorkflowClassStatLineStyle}>USD ca.: {formatEstimatedCost(estimate.estimatedCostUsd, 'USD')}</span>
                      <span style={textWorkflowClassStatLineStyle}>EUR ca.: {formatEstimatedCost(estimate.estimatedCostEur, 'EUR')}</span>
                      <span style={workflowCostInfoWrapStyle}>
                        <button
                          type="button"
                          style={workflowCostInfoTriggerStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCostInfoOpenClass((prev) => (prev === classKey ? null : classKey));
                          }}
                          aria-label="Hinweis zur Kostenberechnung"
                        >
                          i
                        </button>
                        {costInfoOpenClass === classKey ? (
                          <span style={workflowCostInfoPopoverStyle}>
                            Unverbindliche Schätzung auf Basis von Textlänge, Prompt, Modellpreisen und pauschalem Request-Overhead. Tatsächliche API-Kosten können abweichen.
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <label style={textWorkflowPromptLabelStyle}>
                      Standardprompt (anpassbar)
                      <textarea
                        value={globalPrompts[classKey]}
                        onChange={(e) =>
                          setGlobalPrompts((prev) => ({
                            ...prev,
                            [classKey]: e.target.value,
                          }))
                        }
                        style={textWorkflowPromptTextareaStyle}
                        placeholder={meta.defaultPrompt}
                      />
                    </label>
                    <div style={textWorkflowClassActionRowStyle}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToTopicSection();
                        }}
                        style={workflowAnchorLinkStyle(String(displayTextBadgeStyle(classKey).color ?? '#486b7a'))}
                      >
                        Einzeltexte
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!active) {
                            setActiveBulkClass(classKey);
                            return;
                          }
                          void runBulkByTextClass(classKey);
                        }}
                        disabled={buttonDisabled}
                        style={workflowActionButtonStyle({
                          borderColor: String((displayTextBadgeStyle(classKey) as Record<string, unknown>).borderColor ?? '#cbd5e1'),
                          background: String(displayTextBadgeStyle(classKey).background ?? '#f8fafc'),
                          color: String(displayTextBadgeStyle(classKey).color ?? '#475569'),
                          disabled: buttonDisabled,
                        })}
                      >
                        {isRunningThisCard
                          ? `${meta.title} wird optimiert (${classBulkState?.done ?? 0}/${classBulkState?.total ?? 0})`
                          : 'Alle Texte KI-optimieren'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {globalBulkReport ? (
              <div style={globalReportStyle}>
                <div style={globalReportTitleStyle}>Laufbericht</div>
                <div style={globalReportRowStyle}>
                  <strong>Verarbeitet:</strong> {globalBulkReport.processed.length}
                </div>
                <div style={globalReportRowStyle}>
                  <strong>Übersprungen:</strong> {globalBulkReport.skipped.length}
                </div>
                <div style={globalReportRowStyle}>
                  <strong>Fehler:</strong> {globalBulkReport.failed.length}
                </div>
                {globalBulkReport.failed.length > 0 ? (
                  <div style={globalReportErrorListStyle}>
                    {globalBulkReport.failed.slice(0, 8).map((item) => (
                      <div key={`${item.key}:${item.error}`}>- {item.key}: {item.error}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div style={sectionEditorCardStyle}>
        {/* TABS */}
        <div id={topicSectionAnchorId} style={{ ...sectionTabsIntroStyle, ...workflowAnchorTargetStyle }}>
          <h3 style={sectionTabsIntroTitleStyle}>Themenbereiche prüfen oder bei Bedarf nacharbeiten</h3>
        </div>

        {/* CONTENT AREA */}
        <div style={showScopeAreaSidebar ? textEditorGridStyle : undefined}>
          {showScopeAreaSidebar ? (
            <aside style={textAreaListCardStyle}>
              <div style={textAreaListWrapStyle}>
                {visibleScopeAreaItems.map((item) => {
                  const itemIsOrtslage = String(item.area_id ?? '').split('-').length > 3;
                  const active = item.area_id === selectedAreaConfig?.area_id;
                  return (
                    <button
                      key={item.area_id}
                      type="button"
                      style={textAreaListRowStyle(active)}
                      onClick={() => setSelectedScopeAreaId(item.area_id)}
                    >
                      <div style={textAreaListRowTopStyle}>
                        <strong style={textAreaListHeadlineStyle}>{item.areas?.name || item.area_id}</strong>
                        <span style={textAreaTypeBadgeStyle(itemIsOrtslage)}>{itemIsOrtslage ? 'Ortslage' : 'Kreis'}</span>
                      </div>
                      <div style={textAreaListMetaLineStyle}>{item.area_id}</div>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <div style={showScopeAreaSidebar ? textAreaEditorWrapStyle : undefined}>
            <div style={workflowAreaContentStackStyle}>
              <div style={tabContainerStyle}>
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={tabButtonStyle(activeTab === tab.id)}
                  >
                    <span style={tabLabelStyle}>{tab.label}</span>
                  </button>
                ))}
              </div>
              <div style={contentWrapperStyle}>
                {activeSections.length === 0 ? (
                  <div style={textWorkflowEmptyStateStyle}>
                    Fuer diesen Themenbereich gibt es im gewaehlten Texttyp aktuell keine Texte.
                  </div>
                ) : activeSections.map((section) => {
                  const sectionGroup = resolveGroupForTab(activeTabConfig?.id);
                  const mediaKey = MEDIA_BY_SECTION_KEY[section.key];
                  const mediaSpec = mediaKey ? MANDATORY_MEDIA_SPECS[mediaKey] : null;
                  const mediaEntry = mediaKey ? getMediaEntry(mediaKey) : undefined;
                  return (
                    <TextEditorField
                      key={`${selectedAreaConfig?.area_id}:${section.key}:${dbTexts.find((t) => t.section_key === section.key)?.optimized_content ?? getRawTextFromJSON(section.key, sectionGroup) ?? ''}`}
                      label={section.label}
                      sectionKey={section.key}
                      sectionGroup={sectionGroup}
                      type={section.type}
                      rawText={getRawTextFromJSON(section.key, sectionGroup)}
                      dbEntry={dbTexts.find((t) => t.section_key === section.key)}
                      areaName={selectedAreaConfig?.areas?.name || selectedAreaConfig?.area_id || config?.areas?.name || config.area_id}
                      onSave={saveText}
                      onResetToSystem={resetTextToSystem}
                      onAiRewrite={handleAiRewrite}
                      tableName={tableName as HintTable}
                      enableApproval={enableApproval}
                      isRewriting={rewritingKey === section.key}
                      isMandatory={INDIVIDUAL_MANDATORY_KEY_SET.has(section.key)}
                      mediaUpload={mediaSpec && tableName === 'report_texts' ? {
                        key: mediaSpec.key,
                        label: mediaSpec.label,
                        maxWidth: mediaSpec.maxWidth,
                        maxHeight: mediaSpec.maxHeight,
                        maxUploadBytes: mediaSpec.maxUploadBytes,
                        currentUrl: String(mediaEntry?.optimized_content ?? ''),
                        hasOverride: Boolean(mediaEntry?.optimized_content),
                        uploading: mediaState[mediaSpec.key]?.uploading ?? false,
                        error: mediaState[mediaSpec.key]?.error ?? null,
                        onUpload: uploadMandatoryMedia,
                      } : null}
                    />
                  );
                })}
                {tableName === 'report_texts' && activeTab === 'makler' ? (
                  <div style={mediaBottomWrapStyle}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Makler-Bilder (Pflicht)</h4>
                    <div style={mediaBottomGridStyle}>
                      {MAKLER_MEDIA_KEYS.map((key) => {
                        const spec = MANDATORY_MEDIA_SPECS[key];
                        const mediaEntry = getMediaEntry(key);
                        return (
                          <MandatoryMediaUploadCard
                            key={`${selectedAreaConfig?.area_id}:${key}`}
                            label={spec.label}
                            assetKey={spec.key}
                            maxWidth={spec.maxWidth}
                            maxHeight={spec.maxHeight}
                            maxUploadBytes={spec.maxUploadBytes}
                            currentUrl={String(mediaEntry?.optimized_content ?? '')}
                            hasOverride={Boolean(mediaEntry?.optimized_content)}
                            uploading={mediaState[key]?.uploading ?? false}
                            error={mediaState[key]?.error ?? null}
                            onUpload={uploadMandatoryMedia}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {enableApproval ? (
                  <div style={approvalFooterStyle}>
                    <button
                      type="button"
                      onClick={handleSaveAndApprove}
                      style={approveAllButtonStyle(!publishing && hasPublishableChanges)}
                      disabled={publishing || !hasPublishableChanges}
                    >
                      {publishing ? 'Speichern & Freigeben …' : 'Speichern & Freigeben'}
                    </button>
                    <span style={approvalHintStyle}>
                      Speichert den aktuellen Stand und setzt die deutschen Inhalte auf „freigegeben“.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {saving && <div style={saveIndicatorStyle}>Speichere Änderungen...</div>}
      {publishModalOpen ? (
        <div style={publishOverlayStyle}>
          <div style={publishModalStyle}>
            <h3 style={publishTitleStyle}>Deutsche Freigabe laeuft</h3>
            <p style={publishTextStyle}>{publishStatus}</p>
            <p style={publishProgressStyle}>
              Fortschritt: {publishDone}/{publishTotal}
            </p>
            {publishError ? <p style={publishErrorStyle}>{publishError}</p> : null}
            <div style={publishActionsStyle}>
              <button
                type="button"
                style={publishCloseButtonStyle}
                onClick={() => setPublishModalOpen(false)}
                disabled={publishing}
              >
                {publishing ? 'Bitte warten …' : 'Schließen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    if (lowerLabel.includes('intro')) {
        return `Formuliere einen kurzen Introtext für die Maklerseite in ${areaName}. 2–3 Sätze, regionaler Bezug, professionell und vertrauenswürdig. Keine langen Empfehlungsabschnitte, keine neuen Fakten.`;
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

function isOrtslageMarketExpertHeadingKey(sectionKey: string): boolean {
  const key = String(sectionKey ?? '').trim().toLowerCase();
  if (!key.startsWith('ueberschrift_')) return false;
  if (key.startsWith('ueberschrift_berater_') || key.startsWith('ueberschrift_makler_')) return false;
  return true;
}

function FieldInfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={fieldInfoWrapStyle}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={text}
    >
      <span style={fieldInfoIconStyle}>i</span>
      {open ? <span style={fieldInfoTooltipStyle}>{text}</span> : null}
    </span>
  );
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
  onResetToSystem: (key: string) => Promise<void>;
  onAiRewrite: (key: string, currentText: string, type: string, label: string, customPrompt?: string) => void;
  tableName: HintTable;
  enableApproval: boolean;
  isRewriting: boolean;
  isMandatory: boolean;
  mediaUpload?: {
    key: MandatoryMediaKey;
    label: string;
    maxWidth: number;
    maxHeight: number;
    maxUploadBytes: number;
    currentUrl: string;
    hasOverride: boolean;
    uploading: boolean;
    error: string | null;
    onUpload: (assetKey: MandatoryMediaKey, file: File) => Promise<void>;
  } | null;
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
    onResetToSystem,
    onAiRewrite,
    tableName,
    enableApproval,
    isRewriting,
    isMandatory,
    mediaUpload = null,
}: TextEditorFieldProps) {
    const [localValue, setLocalValue] = useState<string | null>(dbEntry?.optimized_content ?? null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isDataDrivenUnlocked, setIsDataDrivenUnlocked] = useState(false);
    
    const currentText = localValue ?? rawText ?? '';
    const isIndividual = type === 'individual';
    const isDataDriven = type === 'data_driven';
    const isLockedDataDriven = isDataDriven && !isDataDrivenUnlocked;
    const isAdvisorOrBroker = isAdvisorOrBrokerKey(sectionKey);
    const isSingleLine = SINGLE_LINE_TEXT_KEYS.has(sectionKey);
    const showAiTools = !isAdvisorOrBroker;
    const standardPrompt = getStandardPromptText(label, type, areaName);
    const displayClass = resolveDisplayTextClass(sectionKey, type);
    const fieldHint = resolveFieldHint({ tableName, type, sectionKey });
    const showSourceState = !isIndividual && (type === 'general' || type === 'data_driven' || type === 'marketing');
    const status = dbEntry?.status ?? null;
    const showStatus = enableApproval && Boolean(dbEntry?.status);
    const hasOverride = Boolean(dbEntry?.optimized_content);

    return (
        <div style={fieldCardStyle} id={`text-section-${sectionKey}`}>
            <div style={fieldHeaderGridStyle}>
              <div style={fieldHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{label}</h4>
                  <span style={displayTextBadgeStyle(displayClass)}>{displayTextClassLabel(displayClass)}</span>
                  {fieldHint ? (
                    <FieldInfoHint text={fieldHint} />
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isMandatory && displayClass === 'profile' ? (
                    <span style={statePillStyle(hasOverride)}>
                      {hasOverride ? '✓ Individuell angepasst' : 'Pflichtfeld offen'}
                    </span>
                  ) : null}
                  {showStatus ? (
                    <span style={statusBadgeStyle(status === 'approved')}>
                      {status === 'approved' ? 'Freigegeben' : 'Entwurf'}
                    </span>
                  ) : null}
                  {isLockedDataDriven ? (
                    <span style={lockedBadgeStyle}>Gesperrt (Data-Driven)</span>
                  ) : null}
                </div>
              </div>
              <div style={headerRightSlotStyle}>
                {showSourceState ? (
                  <div style={previewSourceRowStyle}>
                    <span style={previewSourceLabelStyle}>
                      Quelle:{' '}
                      <span style={hasOverride ? sourceOverrideTextStyle : sourceSystemTextStyle}>
                        {hasOverride ? 'Individuell angepasst' : 'System'}
                      </span>
                    </span>
                    {hasOverride ? (
                      <button
                        type="button"
                        style={previewResetButtonStyle}
                        title="Systemtext nutzen"
                        aria-label="Systemtext nutzen"
                        onClick={async () => {
                          await onResetToSystem(sectionKey);
                          setLocalValue(null);
                        }}
                      >
                        ↺
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            
            <div style={editorGridStyle}>
                <div style={textareaWrapperStyle}>
                    {isSingleLine ? (
                      <input
                        type={resolveInputType(sectionKey)}
                        value={currentText}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={(e) => onSave(sectionKey, e.target.value, type, sectionGroup)}
                        style={inputStyle(isLockedDataDriven)}
                        readOnly={isLockedDataDriven}
                        placeholder="Inhalt bearbeiten..."
                      />
                    ) : (
                      <textarea 
                          value={currentText}
                          onChange={(e) => setLocalValue(e.target.value)}
                          onBlur={(e) => onSave(sectionKey, e.target.value, type, sectionGroup)}
                          style={textareaStyle(isLockedDataDriven)}
                          readOnly={isLockedDataDriven}
                          placeholder="Inhalt bearbeiten..."
                      />
                    )}
                    {isDataDriven ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isDataDrivenUnlocked) {
                            setIsDataDrivenUnlocked(false);
                            return;
                          }
                          const ok = window.confirm(
                            'Achtung: Kontextverlust moeglich. Manuelle Aenderung von Data-Driven Texten ist nicht erwuenscht. Wirklich freischalten?',
                          );
                          if (ok) setIsDataDrivenUnlocked(true);
                        }}
                        style={unlockButtonStyle(isDataDrivenUnlocked)}
                      >
                        {isDataDrivenUnlocked ? 'Bearbeitung sperren' : 'Manuelle Bearbeitung freischalten'}
                      </button>
                    ) : null}
                    {showAiTools ? (
                      <div style={aiRewriteControlsStyle}>
                        <button
                            style={isRewriting ? aiButtonLoadingStyle : aiButtonStyle}
                            onClick={() => onAiRewrite(sectionKey, currentText, type, label, customPrompt)}
                            disabled={isRewriting}
                        >
                            {isRewriting ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln (Fakten bleiben erhalten)'}
                        </button>
                      </div>
                    ) : null}
                    {showAiTools ? (
                      <button
                          type="button"
                          onClick={() => setShowPrompt((prev) => !prev)}
                          style={promptToggleStyle}
                      >
                          {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
                      </button>
                    ) : null}
                    {showAiTools && showPrompt ? (
                        <>
                            <div style={promptPanelStyle}>
                                <div style={promptLabelStyle}>Standard-Prompt</div>
                                <div style={promptContentStyle}>{standardPrompt}</div>
                                <label style={promptInputLabelStyle}>
                                    Eigener Prompt (optional)
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        style={promptInputStyle}
                                        placeholder="Eigenen Prompt eingeben (zusatzlich zum Standard-Prompt)"
                                    />
                                </label>
                            </div>
                        </>
                    ) : null}
                </div>
                {mediaUpload ? (
                  <MandatoryMediaUploadCard
                    label={mediaUpload.label}
                    assetKey={mediaUpload.key}
                    maxWidth={mediaUpload.maxWidth}
                    maxHeight={mediaUpload.maxHeight}
                    maxUploadBytes={mediaUpload.maxUploadBytes}
                    currentUrl={mediaUpload.currentUrl}
                    hasOverride={mediaUpload.hasOverride}
                    uploading={mediaUpload.uploading}
                    error={mediaUpload.error}
                    onUpload={mediaUpload.onUpload}
                  />
                ) : !isIndividual ? (
                  <div style={previewPaneStyle}>
                    <div style={previewBoxStyle}>
                      <div style={previewHeaderStyle}>ORIGINAL BASIS-TEXT (SYSTEM)</div>
                      <div style={previewContentStyle}>{rawText || 'Keine System-Vorlage vorhanden.'}</div>
                    </div>
                  </div>
                ) : null}
            </div>
        </div>
    );
}

type MandatoryMediaUploadCardProps = {
  label: string;
  assetKey: MandatoryMediaKey;
  maxWidth: number;
  maxHeight: number;
  maxUploadBytes: number;
  currentUrl: string;
  hasOverride: boolean;
  uploading: boolean;
  error: string | null;
  onUpload: (assetKey: MandatoryMediaKey, file: File) => Promise<void>;
};

function MandatoryMediaUploadCard(props: MandatoryMediaUploadCardProps) {
  const {
    label,
    assetKey,
    maxWidth,
    maxHeight,
    maxUploadBytes,
    currentUrl,
    hasOverride,
    uploading,
    error,
    onUpload,
  } = props;
  const inputId = `media-upload-${assetKey}`;
  const maxKb = Math.round(maxUploadBytes / 1024);

  return (
    <div style={mandatoryMediaCardStyle}>
      <div style={mandatoryMediaCardHeaderStyle}>
        <div style={mandatoryMediaCardTitleStyle}>{label}</div>
        <span style={statePillStyle(hasOverride)}>
          {hasOverride ? '✓ Individuell angepasst' : 'Pflichtfeld offen'}
        </span>
      </div>
      {currentUrl ? (
        <NextImage src={currentUrl} alt={label} width={maxWidth} height={maxHeight} unoptimized style={mandatoryMediaPreviewStyle} />
      ) : (
        <div style={mandatoryMediaEmptyStyle}>Noch kein Upload vorhanden.</div>
      )}
      <div style={mandatoryMediaMetaStyle}>
        Ziel: {maxWidth} × {maxHeight} px
      </div>
      <div style={mandatoryMediaMetaStyle}>Format: WebP · max. {maxKb} KB</div>
      <label htmlFor={inputId} style={mandatoryMediaUploadButtonStyle(uploading)}>
        {uploading ? 'Upload läuft...' : 'Bild auswählen'}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={uploading}
          style={mandatoryMediaInputHiddenStyle}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void onUpload(assetKey, file);
            e.currentTarget.value = '';
          }}
        />
      </label>
      {!uploading ? <div style={mandatoryMediaHintStyle}>Datei wird automatisch skaliert und komprimiert.</div> : null}
      {error ? <div style={mandatoryMediaErrorStyle}>{error}</div> : null}
    </div>
  );
}

// --- STYLES (FULL WIDTH) ---

const sectionEditorCardStyle: React.CSSProperties = {
  ...textWorkflowCardStyle,
  marginBottom: 0,
};
const contentWrapperStyle = { backgroundColor: '#fff', padding: '40px 20px 0', border: 'none' };
const textWorkflowClassBadgeStyle = (classKey: GlobalClassKey): React.CSSProperties => ({
  ...displayTextBadgeStyle(classKey),
  fontSize: 16,
  lineHeight: 1,
  padding: '10px 20px',
  borderRadius: 999,
  fontWeight: 700,
  letterSpacing: '0.01em',
});
const textWorkflowEmptyStateStyle: React.CSSProperties = {
  border: '1px dashed #cbd5e1',
  borderRadius: 12,
  padding: '16px 18px',
  fontSize: 13,
  color: '#64748b',
  background: '#f8fafc',
};
const localSiteClassGridStyle: React.CSSProperties = {
  ...textWorkflowClassGridStyle,
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
};
const fieldCardStyle = { marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' };
const fieldHeaderGridStyle = { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', marginBottom: '16px' };
const fieldHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const headerRightSlotStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  minHeight: 24,
};
const editorGridStyle = { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'stretch' as const };
const textareaWrapperStyle = { display: 'flex', flexDirection: 'column' as const, gap: '12px', height: '100%' };
const inputStyle = (readOnly = false) => ({
  width: '100%',
  height: '44px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: readOnly ? '1px dashed #ef4444' : '1px solid #cbd5e0',
  backgroundColor: readOnly ? '#fef2f2' : '#fff',
  fontSize: '14px',
  lineHeight: '1.4',
  fontFamily: 'inherit',
  color: '#334155',
});
const textareaStyle = (readOnly = false) => ({
  width: '100%',
  minHeight: '200px',
  padding: '18px',
  borderRadius: '10px',
  border: readOnly ? '1px dashed #ef4444' : '1px solid #cbd5e0',
  backgroundColor: readOnly ? '#fef2f2' : '#fff',
  fontSize: '14.5px',
  lineHeight: '1.6',
  fontFamily: 'inherit',
  color: '#334155',
});
const previewPaneStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  height: '100%',
};
const previewSourceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};
const previewSourceLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 600,
};
const sourceSystemTextStyle: React.CSSProperties = {
  color: '#64748b',
  fontWeight: 700,
};
const sourceOverrideTextStyle: React.CSSProperties = {
  color: '#047857',
  fontWeight: 700,
};
const previewResetButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  color: '#334155',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
const previewBoxStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};
const previewHeaderStyle = { padding: '10px 15px', fontSize: '9px', fontWeight: '800', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', letterSpacing: '0.05em' };
const previewContentStyle: React.CSSProperties = {
  padding: '15px',
  fontSize: '12.5px',
  color: '#64748b',
  lineHeight: '1.5',
  fontStyle: 'italic',
  minHeight: 200,
  flex: 1,
};
const aiRewriteControlsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap' as const,
};
const aiButtonStyle = { alignSelf: 'flex-start', padding: '10px 18px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' };
const aiButtonLoadingStyle = { ...aiButtonStyle, opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#f1f5f9' };
const promptToggleStyle = { alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 };
const promptPanelStyle = { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#f8fafc' };
const promptLabelStyle = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#94a3b8', fontWeight: '700', marginBottom: '6px' };
const promptContentStyle = { fontSize: '12px', color: '#475569', marginBottom: '10px', lineHeight: 1.5 };
const promptInputLabelStyle = { display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '11px', fontWeight: '600', color: '#1e293b' };
const promptInputStyle = { width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', lineHeight: '1.4', fontFamily: 'inherit' };
const statePillStyle = (completed: boolean): React.CSSProperties => ({
  fontSize: '10px',
  fontWeight: 700,
  borderRadius: '999px',
  padding: '4px 9px',
  border: completed ? '1px solid #86efac' : '1px solid #fca5a5',
  backgroundColor: completed ? '#dcfce7' : '#fee2e2',
  color: completed ? '#166534' : '#991b1b',
});
const lockedBadgeStyle = {
  color: '#991b1b',
  backgroundColor: '#fee2e2',
  border: '1px solid #fecaca',
  fontSize: '10px',
  fontWeight: 700,
  borderRadius: '6px',
  padding: '3px 8px',
};
const statusBadgeStyle = (approved: boolean) => ({
  fontSize: '10px',
  padding: '2px 6px',
  borderRadius: '6px',
  backgroundColor: approved ? '#dcfce7' : '#fef3c7',
  color: approved ? '#166534' : '#92400e',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
});
const fieldInfoIconStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  color: '#64748b',
  backgroundColor: '#f8fafc',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'help',
  userSelect: 'none',
};
const fieldInfoWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  zIndex: 3,
  outline: 'none',
};
const fieldInfoTooltipStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  minWidth: 240,
  maxWidth: 360,
  padding: '9px 10px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#334155',
  fontSize: 12,
  lineHeight: 1.4,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
  whiteSpace: 'normal',
};
const approvalFooterStyle: React.CSSProperties = {
  marginTop: '24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '12px',
};
const approveAllButtonStyle = (active: boolean): React.CSSProperties => ({
  width: '300px',
  height: '54px',
  borderRadius: '10px',
  border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
  backgroundColor: active ? '#0f766e' : '#e2e8f0',
  color: active ? '#fff' : '#64748b',
  fontSize: '14px',
  fontWeight: 700,
  cursor: active ? 'pointer' : 'not-allowed',
  opacity: active ? 1 : 0.75,
});
const approvalHintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  textAlign: 'right',
};
const unlockButtonStyle = (unlocked: boolean) => ({
  alignSelf: 'flex-start',
  padding: '9px 14px',
  borderRadius: '8px',
  border: unlocked ? '1px solid #e2e8f0' : '1px solid #fca5a5',
  backgroundColor: unlocked ? '#f8fafc' : '#fee2e2',
  color: unlocked ? '#334155' : '#991b1b',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
});
const globalReportStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  backgroundColor: '#ffffff',
  padding: '10px 12px',
  marginTop: '4px',
};
const globalReportTitleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '6px',
};
const globalReportRowStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#334155',
  marginBottom: '3px',
};
const globalReportErrorListStyle: React.CSSProperties = {
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px dashed #e2e8f0',
  fontSize: '11px',
  color: '#b91c1c',
  display: 'grid',
  gap: '3px',
};
const mediaBottomWrapStyle: React.CSSProperties = {
  borderTop: '1px solid #e2e8f0',
  paddingTop: '14px',
  marginTop: '14px',
  display: 'grid',
  gap: '12px',
};
const mediaBottomGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};
const mandatoryMediaCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  height: 'fit-content',
  padding: '12px',
};
const mandatoryMediaCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
  gap: '8px',
};
const mandatoryMediaCardTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#1e293b',
};
const mandatoryMediaPreviewStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: '210px',
  objectFit: 'cover',
  borderRadius: '10px',
  marginBottom: '10px',
  border: '1px solid #e2e8f0',
};
const mandatoryMediaEmptyStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '10px',
  border: '1px dashed #cbd5e1',
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '10px',
  backgroundColor: '#fff',
};
const mandatoryMediaMetaStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  marginBottom: '4px',
};
const mandatoryMediaUploadButtonStyle = (disabled: boolean): React.CSSProperties => ({
  marginTop: '10px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: '10px',
  border: disabled ? '1px solid #cbd5e1' : '1px solid #93c5fd',
  backgroundColor: disabled ? '#e2e8f0' : '#dbeafe',
  color: disabled ? '#64748b' : '#1e40af',
  fontWeight: 700,
  fontSize: '12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
});
const mandatoryMediaInputHiddenStyle: React.CSSProperties = {
  display: 'none',
};
const mandatoryMediaHintStyle: React.CSSProperties = {
  marginTop: '8px',
  fontSize: '11px',
  color: '#475569',
};
const mandatoryMediaErrorStyle: React.CSSProperties = {
  marginTop: '8px',
  fontSize: '11px',
  borderRadius: '8px',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  padding: '8px 10px',
  color: '#b91c1c',
};
const saveIndicatorStyle: React.CSSProperties = { position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', zIndex: 100, fontSize: '13px' };

const publishOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.48)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const publishModalStyle: React.CSSProperties = {
  width: 'min(620px, 96vw)',
  background: '#ffffff',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 48px rgba(2, 6, 23, 0.22)',
  padding: 18,
  display: 'grid',
  gap: 12,
};

const publishTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: '#0f172a',
};

const publishTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: '#334155',
  lineHeight: 1.45,
};

const publishProgressStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#0f172a',
  fontWeight: 700,
};

const publishErrorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#b91c1c',
};

const publishActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

const publishCloseButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#fff',
  color: '#0f172a',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
