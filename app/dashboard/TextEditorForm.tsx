// app/dashboard/TextEditorForm.tsx

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import NextImage from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { buildGlobalPromptPrefill } from '@/lib/text-prompt-generator';
import { GENERAL_REGION_FOCUS_KEYS, GENERAL_STANDARD_KEYS } from '@/lib/text-key-registry';
import { INDIVIDUAL_MANDATORY_KEYS } from '@/lib/text-key-registry';
import {
  MANDATORY_MEDIA_SPECS,
  type MandatoryMediaKey,
} from '@/lib/mandatory-media';
import FullscreenLoader from '@/components/ui/FullscreenLoader';

const SINGLE_LINE_TEXT_KEYS = new Set([
  'berater_name',
  'berater_email',
  'berater_telefon',
  'berater_telefon_fest',
  'berater_telefon_mobil',
  'berater_telefon_whatsApp',
  'berater_adresse_strasse',
  'berater_adresse_hnr',
  'berater_adresse_plz',
  'berater_adresse_ort',
  'makler_name',
  'makler_email',
  'makler_telefon_fest',
  'makler_telefon_mobil',
  'makler_telefon_whatsApp',
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
  if (sectionKey.includes('telefon') || sectionKey.includes('whatsApp')) return 'tel';
  return 'text';
}

function isIconPath(value: string): boolean {
  return typeof value === 'string' && value.startsWith('/');
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
const TAB_CONFIG = [
  { id: 'berater', label: 'Berater', icon: '👤', sections: [
    { key: 'berater_name', label: 'Name', type: 'individual' },
    { key: 'berater_email', label: 'E-Mail', type: 'individual' },
    { key: 'berater_telefon', label: 'Telefon', type: 'individual' },
    { key: 'berater_telefon_fest', label: 'Telefon (Festnetz)', type: 'individual' },
    { key: 'berater_telefon_mobil', label: 'Telefon (Mobil)', type: 'individual' },
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
    { key: 'makler_email', label: 'E-Mail', type: 'individual' },
    { key: 'makler_telefon_fest', label: 'Telefon (Festnetz)', type: 'individual' },
    { key: 'makler_telefon_mobil', label: 'Telefon (Mobil)', type: 'individual' },
    { key: 'makler_telefon_whatsApp', label: 'WhatsApp', type: 'individual' },
    { key: 'makler_adresse_strasse', label: 'Straße', type: 'individual' },
    { key: 'makler_adresse_hnr', label: 'Hausnummer', type: 'individual' },
    { key: 'makler_adresse_plz', label: 'PLZ', type: 'individual' },
    { key: 'makler_adresse_ort', label: 'Ort', type: 'individual' },
    { key: 'makler_empfehlung', label: 'Empfehlungstext', type: 'individual' },
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
    { key: 'mietrendite_kaufpreisfaktor', label: 'Kaufpreisfaktor Info', type: 'general' },
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
  provider: string;
  model: string;
};

type PartnerIntegrationRow = {
  id?: string;
  kind?: string;
  provider?: string;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
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
};

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
}: TextEditorFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const appliedInitialTabRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState('marktueberblick');
  const [loading, setLoading] = useState(true);
  const [baseTexts, setBaseTexts] = useState<{ text: Record<string, Record<string, string>> } | null>(null);
  const [standardTexts, setStandardTexts] = useState<{ text: Record<string, Record<string, string>> } | null>(null);
  const [dbTexts, setDbTexts] = useState<TextEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [generalBulkState, setGeneralBulkState] = useState<{
    scope: 'tab' | 'kreis_ortslagen';
    done: number;
    total: number;
  } | null>(null);
  const [showGlobalPrompts, setShowGlobalPrompts] = useState(false);
  const [tabGeneralPrompt, setTabGeneralPrompt] = useState('');
  const [globalKreisPrompt, setGlobalKreisPrompt] = useState('');
  const [globalOrtslagenPrompt, setGlobalOrtslagenPrompt] = useState('');
  const [globalBulkReport, setGlobalBulkReport] = useState<GlobalBulkReport | null>(null);
  const [mediaState, setMediaState] = useState<Record<MandatoryMediaKey, MediaFieldState>>({
    media_berater_avatar: { uploading: false, error: null },
    media_makler_logo: { uploading: false, error: null },
    media_makler_bild_01: { uploading: false, error: null },
    media_makler_bild_02: { uploading: false, error: null },
  });
  const [llmIntegrations, setLlmIntegrations] = useState<LlmIntegrationOption[]>([]);
  const [selectedLlmIntegrationId, setSelectedLlmIntegrationId] = useState<string>('');
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
      if (isMarketing) {
        const marketingRes = await fetch(`/api/marketing-defaults?area_id=${encodeURIComponent(config.area_id)}`);
        if (marketingRes.ok) {
          const marketingJson = await marketingRes.json();
          setBaseTexts({ text: { marketing: marketingJson?.marketing ?? {} } as Record<string, Record<string, string>> });
        } else {
          setBaseTexts({ text: { marketing: {} } as Record<string, Record<string, string>> });
        }
        setStandardTexts({ text: {} });
      } else {
        const standardScope = isOrtslage ? 'ortslage' : 'kreis';
        const standardRes = await fetch(`/api/fetch-text-standards?scope=${standardScope}`);
        if (standardRes.ok) {
          const standardJson = await standardRes.json();
          setStandardTexts({ text: standardJson?.text ?? {} });
        } else {
          setStandardTexts({ text: {} });
        }

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
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from(tableName)
        .select('*')
        .eq('area_id', config.area_id)
        .eq('partner_id', user?.id);
      setDbTexts(data || []);

      const integrationsRes = await fetch('/api/partner/integrations');
      if (integrationsRes.ok) {
        const integrationsPayload = await integrationsRes.json().catch(() => ({}));
        const items: PartnerIntegrationRow[] = Array.isArray(integrationsPayload?.integrations)
          ? (integrationsPayload.integrations as PartnerIntegrationRow[])
          : [];
        const llmItems: LlmIntegrationOption[] = items
          .filter((entry) => String(entry?.kind ?? '').toLowerCase() === 'llm' && entry?.is_active === true)
          .map((entry) => {
            const provider = String(entry?.provider ?? '').trim() || 'LLM';
            const settings = (entry?.settings ?? {}) as Record<string, unknown>;
            const model = String(settings?.model ?? settings?.model_name ?? '').trim() || 'Standardmodell';
            return {
              id: String(entry?.id ?? ''),
              provider,
              model,
            };
          })
          .filter((entry) => entry.id.length > 0);
        setLlmIntegrations(llmItems);
        setSelectedLlmIntegrationId((prev) => {
          if (prev && llmItems.some((item) => item.id === prev)) return prev;
          return llmItems[0]?.id ?? '';
        });
      } else {
        setLlmIntegrations([]);
        setSelectedLlmIntegrationId('');
      }
    } catch (err) { 
      console.error("Fehler beim Laden der JSON:", err); 
    } finally { 
      setLoading(false); 
    }
  }
  loadTexts();
}, [config, supabase, tableName, isOrtslage, isMarketing]);

  const tabConfig = isMarketing ? MARKETING_TAB_CONFIG : TAB_CONFIG;
  const hiddenTabIds = new Set(['berater', 'makler', 'marktueberblick']);
  if (isLocalSite && !isOrtslage) {
    hiddenTabIds.delete('marktueberblick');
  }
  const shouldHideTabs = !isMarketing && (isOrtslage || isLocalSite);
  let visibleTabs = shouldHideTabs
    ? tabConfig.filter((tab) => !hiddenTabIds.has(tab.id))
    : tabConfig;
  if (Array.isArray(allowedTabIds) && allowedTabIds.length > 0) {
    const allowed = new Set(allowedTabIds);
    visibleTabs = visibleTabs.filter((tab) => allowed.has(tab.id));
  }
  if (isMarketing && isOrtslage) {
    visibleTabs = visibleTabs.filter((tab) => tab.id !== 'immobilienmarkt_ueberblick');
  }
  const allowedSectionSet = useMemo(
    () => (Array.isArray(allowedSectionKeys) && allowedSectionKeys.length > 0 ? new Set(allowedSectionKeys) : null),
    [allowedSectionKeys],
  );
  const allowedGeneralKeys = useMemo(
    () =>
      new Set<string>([
        ...GENERAL_STANDARD_KEYS,
        ...GENERAL_REGION_FOCUS_KEYS,
      ]),
    [],
  );

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const exists = visibleTabs.some((tab) => tab.id === activeTab);
    if (!exists) setActiveTab(visibleTabs[0].id);
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!initialTabId) return;
    if (appliedInitialTabRef.current === initialTabId) return;
    const exists = visibleTabs.some((tab) => tab.id === initialTabId);
    if (exists) {
      setActiveTab(initialTabId);
      appliedInitialTabRef.current = initialTabId;
    }
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

  useEffect(() => {
    const areaName = config?.areas?.name || config?.area_id || 'Region';
    setTabGeneralPrompt(buildGlobalPromptPrefill(activeTab, 'tab_general', areaName));
    setGlobalKreisPrompt(buildGlobalPromptPrefill(activeTab, 'kreis_text', areaName));
    setGlobalOrtslagenPrompt(buildGlobalPromptPrefill(activeTab, 'ort_template', areaName));
  }, [activeTab, config?.area_id, config?.areas?.name]);

  const saveText = async (key: string, content: string, type: string, sourceGroup?: string | null) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const status = enableApproval ? 'draft' : 'approved';
      const { error } = await supabase.from(tableName).upsert({
        partner_id: user.id,
        area_id: config.area_id,
        section_key: key,
        text_type: type,
        raw_content: getRawTextFromJSON(key, sourceGroup),
        optimized_content: content,
        status,
        last_updated: new Date().toISOString()
      }, { onConflict: 'partner_id,area_id,section_key' });
      if (!error) {
        setDbTexts(prev => {
          const filtered = prev.filter(t => t.section_key !== key);
          return [...filtered, { section_key: key, optimized_content: content, status, text_type: type }];
        });
        onPersistSuccess?.();
      }
    }
    setSaving(false);
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

      const res = await fetch(`/api/partner/areas/${encodeURIComponent(config.area_id)}/media/upload`, {
        method: 'POST',
        body: form,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error ?? `Upload fehlgeschlagen (${res.status})`));
      }

      const url = String(payload?.url ?? '');
      if (!url) throw new Error('Upload erfolgreich, aber ohne URL.');

      setDbTexts((prev) => {
        const filtered = prev.filter((entry) => entry.section_key !== assetKey);
        return [
          ...filtered,
          {
            section_key: assetKey,
            optimized_content: url,
            status: 'draft',
            text_type: 'individual',
            last_updated: new Date().toISOString(),
          },
        ];
      });
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
  ) => {
    try {
      const res = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: currentText, 
          areaName: config?.areas?.name || config.area_id,
          area_id: config?.area_id,
          type: type,
          sectionLabel: label,
          customPrompt: customPrompt || undefined,
          llm_integration_id: selectedLlmIntegrationId || llmIntegrations[0]?.id || undefined,
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
    const optimizedText = await requestAiRewrite(key, currentText, type, label, customPrompt);
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

  const getCurrentTextForSection = (sectionKey: string, sectionGroup: string | null) => {
    const dbEntry = dbTexts.find((t) => t.section_key === sectionKey);
    return dbEntry?.optimized_content ?? getRawTextFromJSON(sectionKey, sectionGroup);
  };

  const runBulkGeneralAi = async (scope: 'tab' | 'kreis_ortslagen') => {
    if (generalBulkState || !visibleTabs.length) return;
    const active = visibleTabs.find((tab) => tab.id === activeTab);
    if (!active) return;
    const sectionGroup = resolveGroupForTab(active.id);
    const tasks = active.sections
      .filter((section) => section.type === 'general' && allowedGeneralKeys.has(section.key))
      .map((section) => ({
        key: section.key,
        label: section.label,
        type: section.type,
        sectionGroup,
      }));
    if (tasks.length === 0) return;

    const perTaskOps = scope === 'tab' ? 1 : 2;
    setGeneralBulkState({ scope, done: 0, total: tasks.length * perTaskOps });
    setGlobalBulkReport({ processed: [], skipped: [], failed: [] });
    try {
      let done = 0;
      for (let i = 0; i < tasks.length; i += 1) {
        const task = tasks[i];
        setRewritingKey(task.key);
        const sourceText = getCurrentTextForSection(task.key, task.sectionGroup);
        if (!String(sourceText || '').trim()) {
          done += perTaskOps;
          setGeneralBulkState((prev) => prev ? { ...prev, done } : null);
          setGlobalBulkReport((prev) =>
            prev
              ? { ...prev, skipped: [...prev.skipped, `${task.key} (kein Quelltext)`] }
              : prev,
          );
          continue;
        }
        const kreisTextPrompt = scope === 'kreis_ortslagen'
          ? (globalKreisPrompt || undefined)
          : (tabGeneralPrompt || undefined);
        const kreisText = await requestAiRewrite(
          task.key,
          sourceText,
          task.type,
          task.label,
          kreisTextPrompt,
        );
        if (kreisText) {
          try {
            await saveText(task.key, kreisText, task.type, task.sectionGroup);
            setGlobalBulkReport((prev) =>
              prev
                ? { ...prev, processed: [...prev.processed, `${task.key} (Kreis)`] }
                : prev,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : 'save failed';
            setGlobalBulkReport((prev) =>
              prev
                ? { ...prev, failed: [...prev.failed, { key: task.key, error: message }] }
                : prev,
            );
          }
        } else {
          setGlobalBulkReport((prev) =>
            prev
              ? { ...prev, failed: [...prev.failed, { key: task.key, error: 'KI-Antwort leer' }] }
              : prev,
          );
        }
        done += 1;
        setGeneralBulkState((prev) => prev ? { ...prev, done } : null);

        if (scope === 'kreis_ortslagen') {
          const ortTemplate = await requestAiRewrite(
            task.key,
            sourceText,
            task.type,
            `${task.label} (Ortslagen-Template)`,
            globalOrtslagenPrompt || undefined,
          );

          if (ortTemplate) {
            const bundeslandSlug = String(config?.areas?.bundesland_slug || '');
            const kreisSlug = String(config?.areas?.slug || '');
            const { data: ortAreas } = await supabase
              .from('areas')
              .select('id, name, slug, parent_slug, bundesland_slug')
              .eq('bundesland_slug', bundeslandSlug)
              .eq('parent_slug', kreisSlug);

            for (const ort of (ortAreas || []) as AreaListItem[]) {
              const ortName = String(ort.name || ort.slug || '').trim();
              const ortText = ortTemplate
                .replace(/\{ortsname\}/g, ortName)
                .replace(/\[\[ORTSLAGE_NAME\]\]/g, ortName);
              try {
                await upsertTextForArea(ort.id, task.key, ortText, task.type, sourceText);
              } catch (error) {
                const message = error instanceof Error ? error.message : 'upsert failed';
                setGlobalBulkReport((prev) =>
                  prev
                    ? { ...prev, failed: [...prev.failed, { key: `${task.key}:${ort.id}`, error: message }] }
                    : prev,
                );
              }
            }
            setGlobalBulkReport((prev) =>
              prev
                ? { ...prev, processed: [...prev.processed, `${task.key} (Ortslagen-Template)`] }
                : prev,
            );
          } else {
            setGlobalBulkReport((prev) =>
              prev
                ? { ...prev, failed: [...prev.failed, { key: `${task.key}:template`, error: 'KI-Template leer' }] }
                : prev,
            );
          }
          done += 1;
          setGeneralBulkState((prev) => prev ? { ...prev, done } : null);
        }
      }
    } finally {
      setRewritingKey(null);
      setGeneralBulkState(null);
    }
  };

  const getRawTextFromJSON = (key: string, preferredGroup?: string | null) => {
    if (!baseTexts?.text) return '';
    const fallbackText = standardTexts?.text ?? {};
    const allowStandardFallback = !isAdvisorOrBrokerKey(key);
    if (key.includes('.')) {
      const value = getValueByPath(baseTexts.text, key.split('.'));
      if (typeof value === 'string') return value;
      if (!allowStandardFallback) return '';
      const fallback = getValueByPath(fallbackText, key.split('.'));
      return typeof fallback === 'string' ? fallback : '';
    }
    if (preferredGroup && baseTexts.text[preferredGroup] && typeof baseTexts.text[preferredGroup] === 'object') {
      const preferred = baseTexts.text[preferredGroup][key];
      if (typeof preferred === 'string') return preferred;
      if (!allowStandardFallback) return '';
      const fallbackPreferred = fallbackText[preferredGroup]?.[key];
      if (typeof fallbackPreferred === 'string') return fallbackPreferred;
    }
    const groups = Object.keys(baseTexts.text);
    for (const group of groups) {
      const value = baseTexts.text[group]?.[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
    if (!allowStandardFallback) return '';
    const fallbackGroups = Object.keys(fallbackText);
    for (const group of fallbackGroups) {
      const value = fallbackText[group]?.[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
    return '';
  };

  if (loading) {
    return <FullscreenLoader show label="Sektionen werden geladen..." />;
  }

  const activeTabConfig = visibleTabs.find(t => t.id === activeTab);
  const sections = activeTabConfig?.sections ?? [];
  const activeSections = allowedSectionSet
    ? sections.filter((section) => allowedSectionSet.has(section.key))
    : sections;
  const activeTabGeneralCount = activeTabConfig?.sections.filter(
    (section) => section.type === 'general' && allowedGeneralKeys.has(section.key),
  ).length ?? 0;
  const isBulkRewriting = Boolean(generalBulkState);
  const showGeneralBulkActions = tableName === 'report_texts' && activeTabGeneralCount > 0 && !lockedToMandatory;
  const canRunKreisOrtslagen = showGeneralBulkActions && !isOrtslage;

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
            {isIconPath(tab.icon) ? (
              <NextImage src={tab.icon} alt="" aria-hidden="true" width={16} height={16} unoptimized style={tabIconImageStyle} />
            ) : (
              <span style={tabIconEmojiStyle}>{tab.icon}</span>
            )}
            <span style={tabLabelStyle}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div style={contentWrapperStyle}>
        {showGeneralBulkActions ? (
          <div>
            <div style={bulkActionBarStyle}>
              <button
                type="button"
                onClick={() => runBulkGeneralAi('tab')}
                disabled={isBulkRewriting}
                style={bulkActionButtonStyle(isBulkRewriting)}
              >
                {generalBulkState?.scope === 'tab'
                  ? `KI optimiert GENERAL (${generalBulkState.done}/${generalBulkState.total})`
                  : `KI optimiert GENERAL im Themenblock (${activeTabGeneralCount})`}
              </button>
              <button
                type="button"
                onClick={() => runBulkGeneralAi('kreis_ortslagen')}
                disabled={isBulkRewriting || !canRunKreisOrtslagen}
                style={bulkActionSecondaryButtonStyle(isBulkRewriting || !canRunKreisOrtslagen)}
              >
                {generalBulkState?.scope === 'kreis_ortslagen'
                  ? `GLOBAL Kreis + Ortslagen (${generalBulkState.done}/${generalBulkState.total})`
                  : 'GLOBAL Kreis + Ortslagen (GENERAL)'}
              </button>
              <button
                type="button"
                onClick={() => setShowGlobalPrompts((prev) => !prev)}
                disabled={isBulkRewriting}
                style={bulkActionSecondaryButtonStyle(isBulkRewriting)}
              >
                {showGlobalPrompts ? 'Global-Prompts ausblenden' : 'Global-Prompts anzeigen'}
              </button>
            </div>
            {showGlobalPrompts ? (
              <div style={globalPromptPanelStyle}>
                <label style={promptInputLabelStyle}>
                  Prompt: GENERAL im Themenblock
                  <textarea
                    value={tabGeneralPrompt}
                    onChange={(e) => setTabGeneralPrompt(e.target.value)}
                    style={promptInputStyle}
                    placeholder="Prompt für GENERAL im Themenblock"
                  />
                </label>
                <label style={promptInputLabelStyle}>
                  Prompt: GLOBAL Kreistext
                  <textarea
                    value={globalKreisPrompt}
                    onChange={(e) => setGlobalKreisPrompt(e.target.value)}
                    style={promptInputStyle}
                    placeholder="Prompt für Kreistext"
                  />
                </label>
                <label style={promptInputLabelStyle}>
                  Prompt: GLOBAL Ortslagen-Template
                  <textarea
                    value={globalOrtslagenPrompt}
                    onChange={(e) => setGlobalOrtslagenPrompt(e.target.value)}
                    style={promptInputStyle}
                    placeholder="Prompt für Ortslagen-Template"
                  />
                </label>
              </div>
            ) : null}
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
        ) : null}
        {activeSections.map((section) => {
          const sectionGroup = resolveGroupForTab(activeTabConfig?.id);
          const mediaKey = MEDIA_BY_SECTION_KEY[section.key];
          const mediaSpec = mediaKey ? MANDATORY_MEDIA_SPECS[mediaKey] : null;
          const mediaEntry = mediaKey ? getMediaEntry(mediaKey) : undefined;
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
            llmOptions={llmIntegrations.map((item) => ({
              id: item.id,
              label: `${formatProviderLabel(item.provider)} · ${item.model}`,
            }))}
            selectedLlmIntegrationId={selectedLlmIntegrationId}
            onSelectLlmIntegration={setSelectedLlmIntegrationId}
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
                    key={key}
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
  llmOptions?: Array<{ id: string; label: string }>;
  selectedLlmIntegrationId?: string;
  onSelectLlmIntegration?: (integrationId: string) => void;
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
    onAiRewrite,
    llmOptions = [],
    selectedLlmIntegrationId = '',
    onSelectLlmIntegration,
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
    const status = dbEntry?.status ?? null;
    const showStatus = enableApproval && Boolean(dbEntry?.status);
    const hasOverride = Boolean(dbEntry?.optimized_content);

    return (
        <div style={fieldCardStyle} id={`text-section-${sectionKey}`}>
            <div style={fieldHeaderGridStyle}>
              <div style={fieldHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{label}</h4>
                  <span style={typeTagStyle(type)}>{type.replace('_', ' ')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isMandatory ? (
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
              <div />
            </div>
            
            <div style={editorGridStyle}>
                <div style={textareaWrapperStyle}>
                    {isDataDriven ? (
                      <div style={dataDrivenHintStyle}>
                        Datengetriebener Text. Manuelle Änderungen können den Kontext verfälschen.
                      </div>
                    ) : null}
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
                    {isIndividual ? (
                      <div style={individualHintStyle}>
                        {`Hinweis: Bitte pflegen Sie hier „${label}“.`}
                      </div>
                    ) : null}
                    {showAiTools ? (
                      <div style={aiRewriteControlsStyle}>
                        {llmOptions.length > 0 ? (
                          <select
                            value={selectedLlmIntegrationId || llmOptions[0].id}
                            onChange={(e) => onSelectLlmIntegration?.(e.target.value)}
                            style={aiModelSelectStyle}
                            aria-label="KI-Modell auswählen"
                          >
                            {llmOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
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
                  <div style={previewBoxStyle}>
                      <div style={previewHeaderStyle}>ORIGINAL BASIS-TEXT (SYSTEM)</div>
                      <div style={previewContentStyle}>{rawText || 'Keine System-Vorlage vorhanden.'}</div>
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

const tabContainerStyle = { display: 'flex', backgroundColor: '#fff', padding: '8px 8px 0 8px', borderRadius: '12px 12px 0 0', borderBottom: '1px solid #e2e8f0', gap: '6px', overflowX: 'auto' as const };
const tabButtonStyle = (active: boolean) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  minWidth: '118px',
  padding: '12px 14px',
  border: 'none',
  borderBottom: active ? '3px solid #3b82f6' : '3px solid transparent',
  backgroundColor: active ? '#f8fafc' : 'transparent',
  color: active ? '#2563eb' : '#64748b',
  fontWeight: active ? '700' : '500',
  fontSize: '13px',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  transition: 'all 0.2s',
  borderRadius: '8px 8px 0 0',
});
const tabIconImageStyle: React.CSSProperties = { width: '30px', height: '30px', objectFit: 'contain', display: 'block' };
const tabIconEmojiStyle: React.CSSProperties = { fontSize: '24px', lineHeight: 1, display: 'block' };
const tabLabelStyle: React.CSSProperties = { fontSize: '14px', lineHeight: 1.2, textAlign: 'center' };
const contentWrapperStyle = { backgroundColor: '#fff', padding: '40px', borderRadius: '0 0 12px 12px', border: '1px solid #e2e8f0', borderTop: 'none' };
const fieldCardStyle = { marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' };
const fieldHeaderGridStyle = { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', marginBottom: '16px' };
const fieldHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const editorGridStyle = { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px' };
const textareaWrapperStyle = { display: 'flex', flexDirection: 'column' as const, gap: '12px' };
const inputStyle = (readOnly = false) => ({
  width: '100%',
  height: '44px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: readOnly ? '1px dashed #f59e0b' : '1px solid #cbd5e0',
  backgroundColor: readOnly ? '#fffbeb' : '#fff',
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
  border: readOnly ? '1px dashed #f59e0b' : '1px solid #cbd5e0',
  backgroundColor: readOnly ? '#fffbeb' : '#fff',
  fontSize: '14.5px',
  lineHeight: '1.6',
  fontFamily: 'inherit',
  color: '#334155',
});
const previewBoxStyle = { backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', height: 'fit-content' };
const previewHeaderStyle = { padding: '10px 15px', fontSize: '9px', fontWeight: '800', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', letterSpacing: '0.05em' };
const previewContentStyle = { padding: '15px', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5', fontStyle: 'italic' };
const aiRewriteControlsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap' as const,
};
const aiModelSelectStyle = {
  minWidth: '240px',
  maxWidth: '100%',
  height: '40px',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #dbeafe',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  fontSize: '12px',
  fontWeight: 600,
};
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
  color: '#92400e',
  backgroundColor: '#fef3c7',
  border: '1px solid #fde68a',
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
const dataDrivenHintStyle = {
  fontSize: '12px',
  color: '#92400e',
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '8px',
  padding: '10px 12px',
};
const individualHintStyle = {
  fontSize: '12px',
  color: '#475569',
  backgroundColor: '#f8fafc',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 12px',
};
const unlockButtonStyle = (unlocked: boolean) => ({
  alignSelf: 'flex-start',
  padding: '9px 14px',
  borderRadius: '8px',
  border: unlocked ? '1px solid #e2e8f0' : '1px solid #fcd34d',
  backgroundColor: unlocked ? '#f8fafc' : '#fef3c7',
  color: unlocked ? '#334155' : '#92400e',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
});
const bulkActionBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginBottom: '20px',
  flexWrap: 'wrap',
};
const globalPromptPanelStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  backgroundColor: '#f8fafc',
  padding: '12px',
  display: 'grid',
  gap: '10px',
  marginBottom: '20px',
};
const globalReportStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  backgroundColor: '#ffffff',
  padding: '10px 12px',
  marginBottom: '20px',
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
const bulkActionButtonStyle = (disabled: boolean): React.CSSProperties => ({
  borderRadius: '9px',
  border: '1px solid #bfdbfe',
  backgroundColor: disabled ? '#f1f5f9' : '#dbeafe',
  color: '#1e40af',
  padding: '10px 14px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
const bulkActionSecondaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  borderRadius: '9px',
  border: '1px solid #e2e8f0',
  backgroundColor: disabled ? '#f8fafc' : '#fff',
  color: '#334155',
  padding: '10px 14px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
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
