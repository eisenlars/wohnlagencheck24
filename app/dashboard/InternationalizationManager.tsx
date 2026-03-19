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
import { buildI18nPromptWithExtras, getI18nStandardPrompt } from '@/lib/i18n-prompts';
import { hashText } from '@/lib/text-hash';
import { getTextKeyLabel } from '@/lib/text-key-labels';
import { useSessionViewState } from '@/lib/ui/session-view-state';
import {
  workflowActionButtonStyle,
  workflowAreaContentStackStyle,
  workflowAreaContentWrapStyle,
  workflowAreaGridStyle,
  workflowAreaHeadlineStyle,
  workflowAreaListCardStyle,
  workflowAreaListRowStyle,
  workflowAreaListRowTopStyle,
  workflowAreaListWrapStyle,
  workflowAreaMetaLineStyle,
  workflowAreaTypeBadgeStyle,
  workflowAnchorLinkStyle,
  workflowClassActionRowStyle as classCardActionRowStyle,
  workflowClassCardStyle as classCardStyle,
  workflowClassCostStyle as classCardCostStyle,
  workflowCostInfoPopoverStyle,
  workflowCostInfoTriggerStyle,
  workflowCostInfoWrapStyle,
  workflowClassCycleStyle as classCardCycleStyle,
  workflowClassGridStyle as classGridStyle,
  workflowClassStatLineStyle as classCardStatLineStyle,
  workflowClassStatsStyle as classCardStatsStyle,
  workflowClassTextStyle as classCardTextStyle,
  workflowClassTopStyle as classCardTopStyle,
  workflowHeaderInlineStyle,
  workflowHeaderStyle as workflowCardHeaderStyle,
  workflowAnchorTargetStyle,
  workflowInlineFieldStyle,
  workflowInlineSelectStyle,
  workflowCardStackStyle,
  workflowPanelCardStyle,
  workflowPromptLabelStyle,
  workflowPromptTextareaStyle,
  workflowSectionIntroStyle as sectionTabsIntroStyle,
  workflowSectionIntroTitleStyle as sectionTabsIntroTitleStyle,
  workflowTabButtonStyle as tabButtonStyle,
  workflowTabContainerStyle as tabContainerStyle,
  workflowTabIconEmojiStyle as tabIconEmojiStyle,
  workflowTabIconImageStyle as tabIconImageStyle,
  workflowTabLabelStyle as tabLabelStyle,
} from '@/app/dashboard/workflow-ui';

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
  availableDomains?: I18nProductDomain[];
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
type PersistedI18nViewState = {
  locale?: string;
  channel?: I18nChannel;
  scope?: I18nScope;
  activeTab?: string;
  activeClass?: DisplayTextClass;
  activeDomain?: I18nProductDomainId;
  selectedScopeAreaId?: string;
  selectedBlogPostId?: string;
  selectedPropertyOfferId?: string;
  selectedReferenceId?: string;
  selectedRequestId?: string;
};
type I18nProductDomainId = 'immobilienmarkt' | 'blog' | 'immobilien' | 'referenzen' | 'gesuche';
export type I18nProductDomain = {
  id: I18nProductDomainId;
  label: string;
  description: string;
  enabled: boolean;
};

type BlogTranslationStatus = 'draft' | 'approved' | 'needs_review';

type BlogPostSourceRow = {
  id: string;
  headline: string | null;
  subline: string | null;
  body_md: string | null;
  status: 'draft' | 'active' | 'inactive';
  created_at: string | null;
  updated_at: string | null;
};

type BlogPostTranslationRow = {
  id?: string;
  post_id: string;
  translated_headline: string | null;
  translated_subline: string | null;
  translated_body_md: string | null;
  status: BlogTranslationStatus;
  source_snapshot_hash: string | null;
  source_last_updated: string | null;
  updated_at: string | null;
};

type BlogTranslationItem = {
  post_id: string;
  headline: string;
  subline: string;
  body_md: string;
  source_status: BlogPostSourceRow['status'];
  source_created_at: string | null;
  source_updated_at: string | null;
  source_snapshot_hash: string;
  translated_headline: string;
  translated_subline: string;
  translated_body_md: string;
  translation_status: BlogTranslationStatus;
  translation_id: string | null;
  translation_updated_at: string | null;
  translation_is_stale: boolean;
};

type PropertyOfferSourceRow = {
  id: string;
  partner_id: string;
  source?: string | null;
  external_id?: string | null;
  offer_type?: string | null;
  object_type?: string | null;
  title?: string | null;
  address?: string | null;
  raw?: Record<string, unknown> | null;
  updated_at?: string | null;
};

type PropertyOverrideRow = {
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

type PropertyOfferTranslationRow = {
  id?: string;
  offer_id: string;
  source: string;
  external_id: string;
  translated_seo_title: string | null;
  translated_seo_description: string | null;
  translated_seo_h1: string | null;
  translated_short_description: string | null;
  translated_long_description: string | null;
  translated_location_text: string | null;
  translated_features_text: string | null;
  translated_highlights: string[] | null;
  translated_image_alt_texts: string[] | null;
  status: BlogTranslationStatus;
  source_snapshot_hash: string | null;
  source_last_updated: string | null;
  updated_at: string | null;
};

type PropertyOfferTranslationItem = {
  offer_id: string;
  source: string;
  external_id: string;
  offer_type: string;
  object_type: string;
  title: string;
  address: string;
  source_updated_at: string | null;
  source_snapshot_hash: string;
  source_seo_title: string;
  source_seo_description: string;
  source_seo_h1: string;
  source_short_description: string;
  source_long_description: string;
  source_location_text: string;
  source_features_text: string;
  source_highlights: string[];
  source_image_alt_texts: string[];
  translated_seo_title: string;
  translated_seo_description: string;
  translated_seo_h1: string;
  translated_short_description: string;
  translated_long_description: string;
  translated_location_text: string;
  translated_features_text: string;
  translated_highlights: string[];
  translated_image_alt_texts: string[];
  translation_status: BlogTranslationStatus;
  translation_id: string | null;
  translation_updated_at: string | null;
  translation_is_stale: boolean;
};

type ReferenceSourceRow = {
  id: string;
  partner_id: string;
  provider?: string | null;
  external_id?: string | null;
  title?: string | null;
  normalized_payload?: Record<string, unknown> | null;
  source_updated_at?: string | null;
  updated_at?: string | null;
};

type ReferenceOverrideRow = {
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

type ReferenceTranslationRow = {
  id?: string;
  reference_id: string;
  source: string;
  external_id: string;
  translated_seo_title: string | null;
  translated_seo_description: string | null;
  translated_seo_h1: string | null;
  translated_short_description: string | null;
  translated_long_description: string | null;
  translated_location_text: string | null;
  translated_features_text: string | null;
  translated_highlights: string[] | null;
  translated_image_alt_texts: string[] | null;
  status: BlogTranslationStatus;
  source_snapshot_hash: string | null;
  source_last_updated: string | null;
  updated_at: string | null;
};

type ReferenceTranslationItem = {
  reference_id: string;
  source: string;
  external_id: string;
  title: string;
  region_label: string;
  source_updated_at: string | null;
  source_snapshot_hash: string;
  source_seo_title: string;
  source_seo_description: string;
  source_seo_h1: string;
  source_short_description: string;
  source_long_description: string;
  source_location_text: string;
  source_features_text: string;
  source_highlights: string[];
  source_image_alt_texts: string[];
  translated_seo_title: string;
  translated_seo_description: string;
  translated_seo_h1: string;
  translated_short_description: string;
  translated_long_description: string;
  translated_location_text: string;
  translated_features_text: string;
  translated_highlights: string[];
  translated_image_alt_texts: string[];
  translation_status: BlogTranslationStatus;
  translation_id: string | null;
  translation_updated_at: string | null;
  translation_is_stale: boolean;
};

type RequestSourceRow = {
  id: string;
  partner_id: string;
  provider?: string | null;
  external_id?: string | null;
  title?: string | null;
  normalized_payload?: Record<string, unknown> | null;
  source_updated_at?: string | null;
  updated_at?: string | null;
};

type RequestOverrideRow = {
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

type RequestTranslationRow = {
  id?: string;
  request_id: string;
  source: string;
  external_id: string;
  translated_seo_title: string | null;
  translated_seo_description: string | null;
  translated_seo_h1: string | null;
  translated_short_description: string | null;
  translated_long_description: string | null;
  translated_location_text: string | null;
  translated_features_text: string | null;
  translated_highlights: string[] | null;
  translated_image_alt_texts: string[] | null;
  status: BlogTranslationStatus;
  source_snapshot_hash: string | null;
  source_last_updated: string | null;
  updated_at: string | null;
};

type RequestTranslationItem = {
  request_id: string;
  source: string;
  external_id: string;
  title: string;
  request_type: string;
  object_type: string;
  region_label: string;
  source_updated_at: string | null;
  source_snapshot_hash: string;
  source_seo_title: string;
  source_seo_description: string;
  source_seo_h1: string;
  source_short_description: string;
  source_long_description: string;
  source_location_text: string;
  source_features_text: string;
  source_highlights: string[];
  source_image_alt_texts: string[];
  translated_seo_title: string;
  translated_seo_description: string;
  translated_seo_h1: string;
  translated_short_description: string;
  translated_long_description: string;
  translated_location_text: string;
  translated_features_text: string;
  translated_highlights: string[];
  translated_image_alt_texts: string[];
  translation_status: BlogTranslationStatus;
  translation_id: string | null;
  translation_updated_at: string | null;
  translation_is_stale: boolean;
};

const I18N_MOCK_TRANSLATION = process.env.NEXT_PUBLIC_I18N_MOCK_TRANSLATION === '1';
const I18N_VIEW_STATE_KEY_PREFIX = 'partner_i18n_view_state_v1';
const DEFAULT_I18N_DOMAINS: I18nProductDomain[] = [
  {
    id: 'immobilienmarkt',
    label: 'Immobilienmarkt',
    description: 'Berichte, Markttexte, lokale Website und marktnahe Partnerinhalte.',
    enabled: true,
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Beitragsbasierte Inhalte, die spaeter separat je Artikel und Sprache gepflegt werden.',
    enabled: true,
  },
  {
    id: 'immobilien',
    label: 'Immobilien',
    description: 'Objektinhalte aus Angebotsdaten und CRM-/Importstrecken.',
    enabled: false,
  },
  {
    id: 'referenzen',
    label: 'Referenzen',
    description: 'Referenzobjekte und Nachweis-Inhalte fuer mehrsprachige Ausspielung.',
    enabled: false,
  },
  {
    id: 'gesuche',
    label: 'Gesuche',
    description: 'Gesuche und Suchprofile fuer spaetere mehrsprachige Pflege.',
    enabled: false,
  },
];

const I18N_TAB_ORDER = [
  { id: 'berater', label: 'Berater', icon: '/icons/ws24_profile_black.svg' },
  { id: 'makler', label: 'Makler', icon: '/icons/ws24_profile_black.svg' },
  { id: 'marktueberblick', label: 'Marktüberblick', icon: '/icons/ws24_marktbericht_ueberblick.svg' },
  { id: 'immobilienpreise', label: 'Immobilienpreise', icon: '/icons/ws24_marktbericht_immobilienpreise.svg' },
  { id: 'mietpreise', label: 'Mietpreise', icon: '/icons/ws24_marktbericht_mietpreise.svg' },
  { id: 'mietrendite', label: 'Mietrendite', icon: '/icons/ws24_marktbericht_mietrendite.svg' },
  { id: 'wohnmarktsituation', label: 'Wohnmarktsituation', icon: '/icons/ws24_marktbericht_wohnmarktsituation.svg' },
  { id: 'wohnlagencheck', label: 'Lagecheck', icon: '/icons/ws24_marktbericht_wohnlagencheck.svg' },
  { id: 'wirtschaft', label: 'Wirtschaft', icon: '/icons/ws24_marktbericht_wirtschaft.svg' },
  { id: 'grundstueckspreise', label: 'Grundstücke', icon: '/icons/ws24_marktbericht_grundstueckspreise.svg' },
] as const;

const TAB_SECTION_CONFIG_RAW: Record<string, Array<{ key: string; label: string; type: SectionKind }>> = {
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

const TAB_SECTION_CONFIG: Record<string, Array<{ key: string; label: string; type: SectionKind }>> = Object.fromEntries(
  Object.entries(TAB_SECTION_CONFIG_RAW).map(([tabId, sections]) => [
    tabId,
    sections.map((section) => ({
      ...section,
      label: getTextKeyLabel(section.key, section.label),
    })),
  ]),
);

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

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getRegionTargetLabels(payload: Record<string, unknown>): string[] {
  const raw = payload.region_targets;
  if (!Array.isArray(raw)) return [];
  const labels: string[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const target = entry as { city?: unknown; district?: unknown; label?: unknown };
    const city = String(target.city ?? '').trim();
    const district = String(target.district ?? '').trim();
    const label = String(target.label ?? '').trim();
    const value = label || [city, district].filter(Boolean).join(' ');
    if (value) labels.push(value);
  }
  return labels;
}

function getPayloadText(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
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

const DEFAULT_WORKFLOW_CLASSES: DisplayTextClass[] = ['market_expert', 'data_driven', 'general', 'profile'];
const MARKETING_WORKFLOW_CLASSES: DisplayTextClass[] = ['marketing'];

export default function InternationalizationManager({ config, availableLocales, availableDomains }: Props) {
  const topicSectionAnchorId = 'i18n-topic-section';
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
  const productDomains = useMemo<I18nProductDomain[]>(() => {
    if (!Array.isArray(availableDomains) || availableDomains.length === 0) return DEFAULT_I18N_DOMAINS;
    const knownIds = new Set(DEFAULT_I18N_DOMAINS.map((item) => item.id));
    const mapped = availableDomains.filter((item) => knownIds.has(item.id));
    return mapped.length > 0 ? mapped : DEFAULT_I18N_DOMAINS;
  }, [availableDomains]);
  const i18nViewStateKey = useMemo(
    () => `${I18N_VIEW_STATE_KEY_PREFIX}:${String(config?.area_id ?? 'global')}`,
    [config?.area_id],
  );
  const i18nInitialViewState = useMemo<PersistedI18nViewState>(() => ({
    locale: locales[0] ?? 'en',
    channel: 'portal',
    scope: 'current_area',
    activeTab: 'marktueberblick',
    activeClass: 'general',
    activeDomain: 'immobilienmarkt',
  }), [locales]);
  const [i18nViewState, setI18nViewState] = useSessionViewState<PersistedI18nViewState>(
    i18nViewStateKey,
    i18nInitialViewState,
  );
  const locale = String(i18nViewState.locale ?? (locales[0] ?? 'en'));
  const setLocale = (nextLocale: string) => {
    setI18nViewState((prev) => ({ ...prev, locale: nextLocale }));
  };
  const channel = (i18nViewState.channel ?? 'portal') as I18nChannel;
  const setChannel = (nextChannel: I18nChannel) => {
    setI18nViewState((prev) => ({ ...prev, channel: nextChannel }));
  };
  const scope = (i18nViewState.scope ?? 'current_area') as I18nScope;
  const setScope = (nextScope: I18nScope) => {
    setI18nViewState((prev) => ({ ...prev, scope: nextScope }));
  };
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error' | null>(null);
  const [workflowConfirmOpen, setWorkflowConfirmOpen] = useState(false);
  const [workflowPromptDrafts, setWorkflowPromptDrafts] = useState<Record<string, string>>({});
  const [rowPromptOpenMap, setRowPromptOpenMap] = useState<Record<string, boolean>>({});
  const [rowCustomPromptMap, setRowCustomPromptMap] = useState<Record<string, string>>({});
  const [scopeAreaItems, setScopeAreaItems] = useState<ScopeArea[]>([]);
  const activeTab = String(i18nViewState.activeTab ?? 'marktueberblick');
  const setActiveTab = (nextTab: string) => {
    setI18nViewState((prev) => ({ ...prev, activeTab: nextTab }));
  };
  const activeClass = (i18nViewState.activeClass ?? 'general') as DisplayTextClass;
  const setActiveClass = (nextClass: DisplayTextClass) => {
    setI18nViewState((prev) => ({ ...prev, activeClass: nextClass }));
  };
  const activeDomain = (i18nViewState.activeDomain ?? 'immobilienmarkt') as I18nProductDomainId;
  const setActiveDomain = (nextDomain: I18nProductDomainId) => {
    setI18nViewState((prev) => ({ ...prev, activeDomain: nextDomain }));
  };
  const selectedScopeAreaId = String(i18nViewState.selectedScopeAreaId ?? '');
  const setSelectedScopeAreaId = (nextAreaId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedScopeAreaId: nextAreaId }));
  };
  const selectedBlogPostId = String(i18nViewState.selectedBlogPostId ?? '');
  const setSelectedBlogPostId = (postId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedBlogPostId: postId }));
  };
  const selectedPropertyOfferId = String(i18nViewState.selectedPropertyOfferId ?? '');
  const setSelectedPropertyOfferId = (offerId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedPropertyOfferId: offerId }));
  };
  const selectedReferenceId = String(i18nViewState.selectedReferenceId ?? '');
  const setSelectedReferenceId = (referenceId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedReferenceId: referenceId }));
  };
  const selectedRequestId = String(i18nViewState.selectedRequestId ?? '');
  const setSelectedRequestId = (requestId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedRequestId: requestId }));
  };
  const [llmOptions, setLlmOptions] = useState<LlmOption[]>([]);
  const [selectedLlmOptionId, setSelectedLlmOptionId] = useState<string>('');
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [baselineByKey, setBaselineByKey] = useState<Record<string, string>>({});
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(null);
  const [blogItems, setBlogItems] = useState<BlogTranslationItem[]>([]);
  const [blogBaselineByPostId, setBlogBaselineByPostId] = useState<Record<string, {
    translated_headline: string;
    translated_subline: string;
    translated_body_md: string;
    translation_status: BlogTranslationStatus;
  }>>({});
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogStatus, setBlogStatus] = useState<string | null>(null);
  const [blogStatusTone, setBlogStatusTone] = useState<'success' | 'error' | null>(null);
  const [propertyItems, setPropertyItems] = useState<PropertyOfferTranslationItem[]>([]);
  const [propertyBaselineByOfferId, setPropertyBaselineByOfferId] = useState<Record<string, {
    translated_seo_title: string;
    translated_seo_description: string;
    translated_seo_h1: string;
    translated_short_description: string;
    translated_long_description: string;
    translated_location_text: string;
    translated_features_text: string;
    translated_highlights: string[];
    translated_image_alt_texts: string[];
    translation_status: BlogTranslationStatus;
  }>>({});
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyStatus, setPropertyStatus] = useState<string | null>(null);
  const [propertyStatusTone, setPropertyStatusTone] = useState<'success' | 'error' | null>(null);
  const [referenceItems, setReferenceItems] = useState<ReferenceTranslationItem[]>([]);
  const [referenceBaselineById, setReferenceBaselineById] = useState<Record<string, {
    translated_seo_title: string;
    translated_seo_description: string;
    translated_seo_h1: string;
    translated_short_description: string;
    translated_long_description: string;
    translated_location_text: string;
    translated_features_text: string;
    translated_highlights: string[];
    translated_image_alt_texts: string[];
    translation_status: BlogTranslationStatus;
  }>>({});
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceSaving, setReferenceSaving] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  const [referenceStatusTone, setReferenceStatusTone] = useState<'success' | 'error' | null>(null);
  const [requestItems, setRequestItems] = useState<RequestTranslationItem[]>([]);
  const [requestBaselineById, setRequestBaselineById] = useState<Record<string, {
    translated_seo_title: string;
    translated_seo_description: string;
    translated_seo_h1: string;
    translated_short_description: string;
    translated_long_description: string;
    translated_location_text: string;
    translated_features_text: string;
    translated_highlights: string[];
    translated_image_alt_texts: string[];
    translation_status: BlogTranslationStatus;
  }>>({});
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requestStatusTone, setRequestStatusTone] = useState<'success' | 'error' | null>(null);
  const [costInfoOpenClass, setCostInfoOpenClass] = useState<DisplayTextClass | null>(null);
  const isDistrict = isDistrictArea(config?.area_id ?? '');
  const channelMeta = I18N_CHANNEL_OPTIONS.find((item) => item.value === channel) ?? I18N_CHANNEL_OPTIONS[0];
  const areaScopeLabel = isDistrict ? 'Kreis' : 'Ortslage';
  const activeDomainMeta = productDomains.find((domain) => domain.id === activeDomain) ?? productDomains[0] ?? DEFAULT_I18N_DOMAINS[0];
  const selectedBlogItem = useMemo(
    () => blogItems.find((item) => item.post_id === selectedBlogPostId) ?? blogItems[0] ?? null,
    [blogItems, selectedBlogPostId],
  );
  const selectedPropertyItem = useMemo(
    () => propertyItems.find((item) => item.offer_id === selectedPropertyOfferId) ?? propertyItems[0] ?? null,
    [propertyItems, selectedPropertyOfferId],
  );
  const selectedReferenceItem = useMemo(
    () => referenceItems.find((item) => item.reference_id === selectedReferenceId) ?? referenceItems[0] ?? null,
    [referenceItems, selectedReferenceId],
  );
  const selectedRequestItem = useMemo(
    () => requestItems.find((item) => item.request_id === selectedRequestId) ?? requestItems[0] ?? null,
    [requestItems, selectedRequestId],
  );

  useEffect(() => {
    if (locales.includes(locale)) return;
    setLocale(locales[0] ?? 'en');
  }, [locales, locale]);

  useEffect(() => {
    if (productDomains.some((domain) => domain.id === activeDomain)) return;
    setActiveDomain(productDomains[0]?.id ?? 'immobilienmarkt');
  }, [activeDomain, productDomains]);

  useEffect(() => {
    if (blogItems.length === 0) {
      if (selectedBlogPostId) setSelectedBlogPostId('');
      return;
    }
    if (blogItems.some((item) => item.post_id === selectedBlogPostId)) return;
    setSelectedBlogPostId(blogItems[0]?.post_id ?? '');
  }, [blogItems, selectedBlogPostId]);

  useEffect(() => {
    if (propertyItems.length === 0) {
      if (selectedPropertyOfferId) setSelectedPropertyOfferId('');
      return;
    }
    if (propertyItems.some((item) => item.offer_id === selectedPropertyOfferId)) return;
    setSelectedPropertyOfferId(propertyItems[0]?.offer_id ?? '');
  }, [propertyItems, selectedPropertyOfferId]);

  useEffect(() => {
    if (referenceItems.length === 0) {
      if (selectedReferenceId) setSelectedReferenceId('');
      return;
    }
    if (referenceItems.some((item) => item.reference_id === selectedReferenceId)) return;
    setSelectedReferenceId(referenceItems[0]?.reference_id ?? '');
  }, [referenceItems, selectedReferenceId]);

  useEffect(() => {
    if (requestItems.length === 0) {
      if (selectedRequestId) setSelectedRequestId('');
      return;
    }
    if (requestItems.some((item) => item.request_id === selectedRequestId)) return;
    setSelectedRequestId(requestItems[0]?.request_id ?? '');
  }, [requestItems, selectedRequestId]);

  function isMissingBlogI18nTable(error: unknown): boolean {
    const msg = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
    return msg.includes('partner_blog_post_i18n') && msg.includes('does not exist');
  }

  function isMissingPropertyI18nTable(error: unknown): boolean {
    const msg = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
    return msg.includes('partner_property_offer_i18n') && msg.includes('does not exist');
  }

  function isMissingReferenceI18nTable(error: unknown): boolean {
    const msg = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
    return msg.includes('partner_reference_i18n') && msg.includes('does not exist');
  }

  function isMissingRequestI18nTable(error: unknown): boolean {
    const msg = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
    return msg.includes('partner_request_i18n') && msg.includes('does not exist');
  }

  async function loadBlogItems() {
    if (!config?.area_id) return;
    setBlogLoading(true);
    setBlogStatus(null);
    setBlogStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const { data: postsData, error: postsError } = await supabase
        .from('partner_blog_posts')
        .select('id, headline, subline, body_md, status, created_at, updated_at')
        .eq('partner_id', user.id)
        .eq('area_id', config.area_id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      const posts = (postsData ?? []) as BlogPostSourceRow[];
      const postIds = posts.map((item) => String(item.id ?? '').trim()).filter(Boolean);

      let translationRows: BlogPostTranslationRow[] = [];
      if (postIds.length > 0) {
        const { data: translationsData, error: translationsError } = await supabase
          .from('partner_blog_post_i18n')
          .select('id, post_id, translated_headline, translated_subline, translated_body_md, status, source_snapshot_hash, source_last_updated, updated_at')
          .eq('partner_id', user.id)
          .eq('target_locale', locale)
          .in('post_id', postIds);

        if (translationsError) {
          if (isMissingBlogI18nTable(translationsError)) {
            throw new Error('Tabelle `partner_blog_post_i18n` fehlt. Bitte SQL-Migration ausführen.');
          }
          throw translationsError;
        }
        translationRows = (translationsData ?? []) as BlogPostTranslationRow[];
      }

      const translationByPostId = new Map(
        translationRows
          .map((row) => [String(row.post_id ?? '').trim(), row] as const)
          .filter(([postId]) => postId.length > 0),
      );

      const nextItems = posts.map((post) => {
        const postId = String(post.id ?? '').trim();
        const translation = translationByPostId.get(postId);
        const sourceSnapshotHash = hashText([
          String(post.headline ?? ''),
          String(post.subline ?? ''),
          String(post.body_md ?? ''),
        ].join('\n\n'));
        const storedHash = String(translation?.source_snapshot_hash ?? '').trim();
        return {
          post_id: postId,
          headline: String(post.headline ?? ''),
          subline: String(post.subline ?? ''),
          body_md: String(post.body_md ?? ''),
          source_status: post.status,
          source_created_at: post.created_at ?? null,
          source_updated_at: post.updated_at ?? null,
          source_snapshot_hash: sourceSnapshotHash,
          translated_headline: String(translation?.translated_headline ?? ''),
          translated_subline: String(translation?.translated_subline ?? ''),
          translated_body_md: String(translation?.translated_body_md ?? ''),
          translation_status: (translation?.status ?? 'draft') as BlogTranslationStatus,
          translation_id: translation?.id ? String(translation.id) : null,
          translation_updated_at: translation?.updated_at ?? null,
          translation_is_stale: Boolean(storedHash) && storedHash !== sourceSnapshotHash,
        } satisfies BlogTranslationItem;
      });

      const nextBaseline = Object.fromEntries(
        nextItems.map((item) => [item.post_id, {
          translated_headline: item.translated_headline,
          translated_subline: item.translated_subline,
          translated_body_md: item.translated_body_md,
          translation_status: item.translation_status,
        }]),
      );

      setBlogItems(nextItems);
      setBlogBaselineByPostId(nextBaseline);
      setBlogStatus(nextItems.length === 0
        ? 'Keine Blogartikel im aktuellen Gebiet vorhanden.'
        : `Blog-Übersetzungsstand für ${nextItems.length} Beitrag/Beiträge geladen.`);
      setBlogStatusTone('success');
    } catch (error) {
      setBlogItems([]);
      setBlogBaselineByPostId({});
      setBlogStatus(error instanceof Error ? error.message : 'Blog-Übersetzungen konnten nicht geladen werden.');
      setBlogStatusTone('error');
    } finally {
      setBlogLoading(false);
    }
  }

  async function saveSelectedBlogItem() {
    if (!selectedBlogItem) return;
    setBlogSaving(true);
    setBlogStatus(null);
    setBlogStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const payload = {
        partner_id: user.id,
        post_id: selectedBlogItem.post_id,
        area_id: config.area_id,
        target_locale: locale,
        translated_headline: selectedBlogItem.translated_headline.trim() || null,
        translated_subline: selectedBlogItem.translated_subline.trim() || null,
        translated_body_md: selectedBlogItem.translated_body_md.trim() || null,
        status: selectedBlogItem.translation_status,
        source_snapshot_hash: selectedBlogItem.source_snapshot_hash,
        source_last_updated: selectedBlogItem.source_updated_at,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('partner_blog_post_i18n')
        .upsert(payload, { onConflict: 'partner_id,post_id,target_locale' });

      if (error) {
        if (isMissingBlogI18nTable(error)) {
          throw new Error('Tabelle `partner_blog_post_i18n` fehlt. Bitte SQL-Migration ausführen.');
        }
        throw error;
      }

      setBlogBaselineByPostId((prev) => ({
        ...prev,
        [selectedBlogItem.post_id]: {
          translated_headline: selectedBlogItem.translated_headline,
          translated_subline: selectedBlogItem.translated_subline,
          translated_body_md: selectedBlogItem.translated_body_md,
          translation_status: selectedBlogItem.translation_status,
        },
      }));
      setBlogItems((prev) => prev.map((item) => (
        item.post_id === selectedBlogItem.post_id
          ? {
              ...item,
              translation_is_stale: false,
              translation_updated_at: payload.updated_at,
            }
          : item
      )));
      setBlogStatus('Blog-Übersetzung gespeichert.');
      setBlogStatusTone('success');
    } catch (error) {
      setBlogStatus(error instanceof Error ? error.message : 'Blog-Übersetzung konnte nicht gespeichert werden.');
      setBlogStatusTone('error');
    } finally {
      setBlogSaving(false);
    }
  }

  async function loadPropertyItems() {
    if (!config?.area_id) return;
    setPropertyLoading(true);
    setPropertyStatus(null);
    setPropertyStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const { data: offersData, error: offersError } = await supabase
        .from('partner_property_offers')
        .select('id, partner_id, source, external_id, offer_type, object_type, title, address, raw, updated_at')
        .eq('partner_id', user.id)
        .eq('area_id', config.area_id)
        .order('updated_at', { ascending: false });

      if (offersError) throw offersError;

      const offers = (offersData ?? []) as PropertyOfferSourceRow[];
      const sources = Array.from(new Set(offers.map((item) => String(item.source ?? '').trim()).filter(Boolean)));
      const externalIds = Array.from(new Set(offers.map((item) => String(item.external_id ?? '').trim()).filter(Boolean)));
      const offerIds = offers.map((item) => String(item.id ?? '').trim()).filter(Boolean);

      let overrideRows: PropertyOverrideRow[] = [];
      if (sources.length > 0 && externalIds.length > 0) {
        const { data: overridesData, error: overridesError } = await supabase
          .from('partner_property_overrides')
          .select('partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, highlights, image_alt_texts')
          .eq('partner_id', user.id)
          .in('source', sources)
          .in('external_id', externalIds);

        if (overridesError) throw overridesError;
        overrideRows = (overridesData ?? []) as PropertyOverrideRow[];
      }

      let translationRows: PropertyOfferTranslationRow[] = [];
      if (offerIds.length > 0) {
        const { data: translationsData, error: translationsError } = await supabase
          .from('partner_property_offer_i18n')
          .select('id, offer_id, source, external_id, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_highlights, translated_image_alt_texts, status, source_snapshot_hash, source_last_updated, updated_at')
          .eq('partner_id', user.id)
          .eq('target_locale', locale)
          .in('offer_id', offerIds);

        if (translationsError) {
          if (isMissingPropertyI18nTable(translationsError)) {
            throw new Error('Tabelle `partner_property_offer_i18n` fehlt. Bitte SQL-Migration ausführen.');
          }
          throw translationsError;
        }
        translationRows = (translationsData ?? []) as PropertyOfferTranslationRow[];
      }

      const overrideByKey = new Map(
        overrideRows.map((row) => [`${String(row.source ?? '').trim()}::${String(row.external_id ?? '').trim()}`, row] as const),
      );
      const translationByOfferId = new Map(
        translationRows
          .map((row) => [String(row.offer_id ?? '').trim(), row] as const)
          .filter(([offerId]) => offerId.length > 0),
      );

      const nextItems = offers.map((offer) => {
        const offerId = String(offer.id ?? '').trim();
        const source = String(offer.source ?? '').trim() || 'manual';
        const externalId = String(offer.external_id ?? '').trim() || offerId;
        const raw = (offer.raw ?? {}) as Record<string, unknown>;
        const override = overrideByKey.get(`${source}::${externalId}`);
        const translation = translationByOfferId.get(offerId);
        const rawDescription = typeof raw.description === 'string' ? raw.description : '';
        const rawLocation = typeof raw.location === 'string' && raw.location ? raw.location : rawDescription;
        const rawFeatures = typeof raw.features_note === 'string' ? raw.features_note : '';
        const rawHighlights = toStringArray(raw.highlights);
        const rawImageAltTexts = toStringArray(raw.image_alt_texts);
        const sourceSeoTitle = String(override?.seo_title ?? offer.title ?? '');
        const sourceSeoDescription = String(override?.seo_description ?? rawDescription ?? '');
        const sourceSeoH1 = String(override?.seo_h1 ?? offer.title ?? '');
        const sourceShortDescription = String(override?.short_description ?? rawDescription ?? '');
        const sourceLongDescription = String(override?.long_description ?? rawDescription ?? '');
        const sourceLocationText = String(override?.location_text ?? rawLocation ?? '');
        const sourceFeaturesText = String(override?.features_text ?? rawFeatures ?? '');
        const sourceHighlights = override?.highlights ?? rawHighlights;
        const sourceImageAltTexts = override?.image_alt_texts ?? rawImageAltTexts;
        const sourceSnapshotHash = hashText(JSON.stringify({
          sourceSeoTitle,
          sourceSeoDescription,
          sourceSeoH1,
          sourceShortDescription,
          sourceLongDescription,
          sourceLocationText,
          sourceFeaturesText,
          sourceHighlights,
          sourceImageAltTexts,
        }));
        const storedHash = String(translation?.source_snapshot_hash ?? '').trim();

        return {
          offer_id: offerId,
          source,
          external_id: externalId,
          offer_type: String(offer.offer_type ?? ''),
          object_type: String(offer.object_type ?? ''),
          title: String(offer.title ?? ''),
          address: String(offer.address ?? ''),
          source_updated_at: offer.updated_at ?? null,
          source_snapshot_hash: sourceSnapshotHash,
          source_seo_title: sourceSeoTitle,
          source_seo_description: sourceSeoDescription,
          source_seo_h1: sourceSeoH1,
          source_short_description: sourceShortDescription,
          source_long_description: sourceLongDescription,
          source_location_text: sourceLocationText,
          source_features_text: sourceFeaturesText,
          source_highlights: sourceHighlights,
          source_image_alt_texts: sourceImageAltTexts,
          translated_seo_title: String(translation?.translated_seo_title ?? ''),
          translated_seo_description: String(translation?.translated_seo_description ?? ''),
          translated_seo_h1: String(translation?.translated_seo_h1 ?? ''),
          translated_short_description: String(translation?.translated_short_description ?? ''),
          translated_long_description: String(translation?.translated_long_description ?? ''),
          translated_location_text: String(translation?.translated_location_text ?? ''),
          translated_features_text: String(translation?.translated_features_text ?? ''),
          translated_highlights: translation?.translated_highlights ?? [],
          translated_image_alt_texts: translation?.translated_image_alt_texts ?? [],
          translation_status: (translation?.status ?? 'draft') as BlogTranslationStatus,
          translation_id: translation?.id ? String(translation.id) : null,
          translation_updated_at: translation?.updated_at ?? null,
          translation_is_stale: Boolean(storedHash) && storedHash !== sourceSnapshotHash,
        } satisfies PropertyOfferTranslationItem;
      });

      const nextBaseline = Object.fromEntries(
        nextItems.map((item) => [item.offer_id, {
          translated_seo_title: item.translated_seo_title,
          translated_seo_description: item.translated_seo_description,
          translated_seo_h1: item.translated_seo_h1,
          translated_short_description: item.translated_short_description,
          translated_long_description: item.translated_long_description,
          translated_location_text: item.translated_location_text,
          translated_features_text: item.translated_features_text,
          translated_highlights: [...item.translated_highlights],
          translated_image_alt_texts: [...item.translated_image_alt_texts],
          translation_status: item.translation_status,
        }]),
      );

      setPropertyItems(nextItems);
      setPropertyBaselineByOfferId(nextBaseline);
      setPropertyStatus(nextItems.length === 0
        ? 'Keine Immobilienangebote im aktuellen Gebiet vorhanden.'
        : `Immobilien-Übersetzungsstand für ${nextItems.length} Angebot/Angebote geladen.`);
      setPropertyStatusTone('success');
    } catch (error) {
      setPropertyItems([]);
      setPropertyBaselineByOfferId({});
      setPropertyStatus(error instanceof Error ? error.message : 'Immobilien-Übersetzungen konnten nicht geladen werden.');
      setPropertyStatusTone('error');
    } finally {
      setPropertyLoading(false);
    }
  }

  async function saveSelectedPropertyItem() {
    if (!selectedPropertyItem) return;
    setPropertySaving(true);
    setPropertyStatus(null);
    setPropertyStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const payload = {
        partner_id: user.id,
        offer_id: selectedPropertyItem.offer_id,
        area_id: config.area_id,
        source: selectedPropertyItem.source,
        external_id: selectedPropertyItem.external_id,
        target_locale: locale,
        translated_seo_title: selectedPropertyItem.translated_seo_title.trim() || null,
        translated_seo_description: selectedPropertyItem.translated_seo_description.trim() || null,
        translated_seo_h1: selectedPropertyItem.translated_seo_h1.trim() || null,
        translated_short_description: selectedPropertyItem.translated_short_description.trim() || null,
        translated_long_description: selectedPropertyItem.translated_long_description.trim() || null,
        translated_location_text: selectedPropertyItem.translated_location_text.trim() || null,
        translated_features_text: selectedPropertyItem.translated_features_text.trim() || null,
        translated_highlights: selectedPropertyItem.translated_highlights,
        translated_image_alt_texts: selectedPropertyItem.translated_image_alt_texts,
        status: selectedPropertyItem.translation_status,
        source_snapshot_hash: selectedPropertyItem.source_snapshot_hash,
        source_last_updated: selectedPropertyItem.source_updated_at,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('partner_property_offer_i18n')
        .upsert(payload, { onConflict: 'partner_id,offer_id,target_locale' });

      if (error) {
        if (isMissingPropertyI18nTable(error)) {
          throw new Error('Tabelle `partner_property_offer_i18n` fehlt. Bitte SQL-Migration ausführen.');
        }
        throw error;
      }

      setPropertyBaselineByOfferId((prev) => ({
        ...prev,
        [selectedPropertyItem.offer_id]: {
          translated_seo_title: selectedPropertyItem.translated_seo_title,
          translated_seo_description: selectedPropertyItem.translated_seo_description,
          translated_seo_h1: selectedPropertyItem.translated_seo_h1,
          translated_short_description: selectedPropertyItem.translated_short_description,
          translated_long_description: selectedPropertyItem.translated_long_description,
          translated_location_text: selectedPropertyItem.translated_location_text,
          translated_features_text: selectedPropertyItem.translated_features_text,
          translated_highlights: [...selectedPropertyItem.translated_highlights],
          translated_image_alt_texts: [...selectedPropertyItem.translated_image_alt_texts],
          translation_status: selectedPropertyItem.translation_status,
        },
      }));
      setPropertyItems((prev) => prev.map((item) => (
        item.offer_id === selectedPropertyItem.offer_id
          ? {
              ...item,
              translation_is_stale: false,
              translation_updated_at: payload.updated_at,
            }
          : item
      )));
      setPropertyStatus('Immobilien-Übersetzung gespeichert.');
      setPropertyStatusTone('success');
    } catch (error) {
      setPropertyStatus(error instanceof Error ? error.message : 'Immobilien-Übersetzung konnte nicht gespeichert werden.');
      setPropertyStatusTone('error');
    } finally {
      setPropertySaving(false);
    }
  }

  async function loadReferenceItems() {
    setReferenceLoading(true);
    setReferenceStatus(null);
    setReferenceStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const { data: refsData, error: refsError } = await supabase
        .from('partner_references')
        .select('id, partner_id, provider, external_id, title, normalized_payload, source_updated_at, updated_at')
        .eq('partner_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (refsError) throw refsError;

      const refs = (refsData ?? []) as ReferenceSourceRow[];
      const sources = Array.from(new Set(refs.map((item) => String(item.provider ?? '').trim()).filter(Boolean)));
      const externalIds = Array.from(new Set(refs.map((item) => String(item.external_id ?? '').trim()).filter(Boolean)));
      const referenceIds = refs.map((item) => String(item.id ?? '').trim()).filter(Boolean);

      let overrideRows: ReferenceOverrideRow[] = [];
      if (sources.length > 0 && externalIds.length > 0) {
        const { data: overridesData, error: overridesError } = await supabase
          .from('partner_reference_overrides')
          .select('partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, highlights, image_alt_texts')
          .eq('partner_id', user.id)
          .in('source', sources)
          .in('external_id', externalIds);

        if (overridesError) throw overridesError;
        overrideRows = (overridesData ?? []) as ReferenceOverrideRow[];
      }

      let translationRows: ReferenceTranslationRow[] = [];
      if (referenceIds.length > 0) {
        const { data: translationsData, error: translationsError } = await supabase
          .from('partner_reference_i18n')
          .select('id, reference_id, source, external_id, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_highlights, translated_image_alt_texts, status, source_snapshot_hash, source_last_updated, updated_at')
          .eq('partner_id', user.id)
          .eq('target_locale', locale)
          .in('reference_id', referenceIds);

        if (translationsError) {
          if (isMissingReferenceI18nTable(translationsError)) {
            throw new Error('Tabelle `partner_reference_i18n` fehlt. Bitte SQL-Migration ausführen.');
          }
          throw translationsError;
        }
        translationRows = (translationsData ?? []) as ReferenceTranslationRow[];
      }

      const overrideByKey = new Map(
        overrideRows.map((row) => [`${String(row.source ?? '').trim()}::${String(row.external_id ?? '').trim()}`, row] as const),
      );
      const translationByReferenceId = new Map(
        translationRows
          .map((row) => [String(row.reference_id ?? '').trim(), row] as const)
          .filter(([referenceId]) => referenceId.length > 0),
      );

      const nextItems = refs.map((ref) => {
        const referenceId = String(ref.id ?? '').trim();
        const source = String(ref.provider ?? '').trim();
        const externalId = String(ref.external_id ?? '').trim();
        const payload = (ref.normalized_payload ?? {}) as Record<string, unknown>;
        const override = overrideByKey.get(`${source}::${externalId}`);
        const translation = translationByReferenceId.get(referenceId);
        const description = getPayloadText(payload, ['long_description', 'description', 'reference_text_seed', 'title']);
        const regionLabels = getRegionTargetLabels(payload);
        const regionLabel = regionLabels.join(', ') || getPayloadText(payload, ['city', 'district', 'location_text', 'location']);
        const features = getPayloadText(payload, ['features_text', 'features_note']);
        const highlights = toStringArray(payload.highlights);
        const imageAltTexts = toStringArray(payload.image_alt_texts);
        const sourceSeoTitle = String(override?.seo_title ?? ref.title ?? '');
        const sourceSeoDescription = String(override?.seo_description ?? description ?? '');
        const sourceSeoH1 = String(override?.seo_h1 ?? ref.title ?? '');
        const sourceShortDescription = String(override?.short_description ?? description ?? '');
        const sourceLongDescription = String(override?.long_description ?? description ?? '');
        const sourceLocationText = String(override?.location_text ?? regionLabel ?? '');
        const sourceFeaturesText = String(override?.features_text ?? features ?? '');
        const sourceHighlights = override?.highlights ?? highlights;
        const sourceImageAltTexts = override?.image_alt_texts ?? imageAltTexts;
        const sourceSnapshotHash = hashText(JSON.stringify({
          sourceSeoTitle,
          sourceSeoDescription,
          sourceSeoH1,
          sourceShortDescription,
          sourceLongDescription,
          sourceLocationText,
          sourceFeaturesText,
          sourceHighlights,
          sourceImageAltTexts,
        }));
        const storedHash = String(translation?.source_snapshot_hash ?? '').trim();

        return {
          reference_id: referenceId,
          source,
          external_id: externalId,
          title: String(ref.title ?? ''),
          region_label: regionLabel,
          source_updated_at: ref.source_updated_at ?? ref.updated_at ?? null,
          source_snapshot_hash: sourceSnapshotHash,
          source_seo_title: sourceSeoTitle,
          source_seo_description: sourceSeoDescription,
          source_seo_h1: sourceSeoH1,
          source_short_description: sourceShortDescription,
          source_long_description: sourceLongDescription,
          source_location_text: sourceLocationText,
          source_features_text: sourceFeaturesText,
          source_highlights: sourceHighlights,
          source_image_alt_texts: sourceImageAltTexts,
          translated_seo_title: String(translation?.translated_seo_title ?? ''),
          translated_seo_description: String(translation?.translated_seo_description ?? ''),
          translated_seo_h1: String(translation?.translated_seo_h1 ?? ''),
          translated_short_description: String(translation?.translated_short_description ?? ''),
          translated_long_description: String(translation?.translated_long_description ?? ''),
          translated_location_text: String(translation?.translated_location_text ?? ''),
          translated_features_text: String(translation?.translated_features_text ?? ''),
          translated_highlights: translation?.translated_highlights ?? [],
          translated_image_alt_texts: translation?.translated_image_alt_texts ?? [],
          translation_status: (translation?.status ?? 'draft') as BlogTranslationStatus,
          translation_id: translation?.id ? String(translation.id) : null,
          translation_updated_at: translation?.updated_at ?? null,
          translation_is_stale: Boolean(storedHash) && storedHash !== sourceSnapshotHash,
        } satisfies ReferenceTranslationItem;
      });

      const nextBaseline = Object.fromEntries(
        nextItems.map((item) => [item.reference_id, {
          translated_seo_title: item.translated_seo_title,
          translated_seo_description: item.translated_seo_description,
          translated_seo_h1: item.translated_seo_h1,
          translated_short_description: item.translated_short_description,
          translated_long_description: item.translated_long_description,
          translated_location_text: item.translated_location_text,
          translated_features_text: item.translated_features_text,
          translated_highlights: [...item.translated_highlights],
          translated_image_alt_texts: [...item.translated_image_alt_texts],
          translation_status: item.translation_status,
        }]),
      );

      setReferenceItems(nextItems);
      setReferenceBaselineById(nextBaseline);
      setReferenceStatus(nextItems.length === 0
        ? 'Keine Referenzen für den aktuellen Partner vorhanden.'
        : `Referenz-Übersetzungsstand für ${nextItems.length} Objekt(e) geladen.`);
      setReferenceStatusTone('success');
    } catch (error) {
      setReferenceItems([]);
      setReferenceBaselineById({});
      setReferenceStatus(error instanceof Error ? error.message : 'Referenz-Übersetzungen konnten nicht geladen werden.');
      setReferenceStatusTone('error');
    } finally {
      setReferenceLoading(false);
    }
  }

  async function saveSelectedReferenceItem() {
    if (!selectedReferenceItem) return;
    setReferenceSaving(true);
    setReferenceStatus(null);
    setReferenceStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const payload = {
        partner_id: user.id,
        reference_id: selectedReferenceItem.reference_id,
        area_id: config.area_id,
        source: selectedReferenceItem.source,
        external_id: selectedReferenceItem.external_id,
        target_locale: locale,
        translated_seo_title: selectedReferenceItem.translated_seo_title.trim() || null,
        translated_seo_description: selectedReferenceItem.translated_seo_description.trim() || null,
        translated_seo_h1: selectedReferenceItem.translated_seo_h1.trim() || null,
        translated_short_description: selectedReferenceItem.translated_short_description.trim() || null,
        translated_long_description: selectedReferenceItem.translated_long_description.trim() || null,
        translated_location_text: selectedReferenceItem.translated_location_text.trim() || null,
        translated_features_text: selectedReferenceItem.translated_features_text.trim() || null,
        translated_highlights: selectedReferenceItem.translated_highlights,
        translated_image_alt_texts: selectedReferenceItem.translated_image_alt_texts,
        status: selectedReferenceItem.translation_status,
        source_snapshot_hash: selectedReferenceItem.source_snapshot_hash,
        source_last_updated: selectedReferenceItem.source_updated_at,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('partner_reference_i18n')
        .upsert(payload, { onConflict: 'partner_id,reference_id,target_locale' });

      if (error) {
        if (isMissingReferenceI18nTable(error)) {
          throw new Error('Tabelle `partner_reference_i18n` fehlt. Bitte SQL-Migration ausführen.');
        }
        throw error;
      }

      setReferenceBaselineById((prev) => ({
        ...prev,
        [selectedReferenceItem.reference_id]: {
          translated_seo_title: selectedReferenceItem.translated_seo_title,
          translated_seo_description: selectedReferenceItem.translated_seo_description,
          translated_seo_h1: selectedReferenceItem.translated_seo_h1,
          translated_short_description: selectedReferenceItem.translated_short_description,
          translated_long_description: selectedReferenceItem.translated_long_description,
          translated_location_text: selectedReferenceItem.translated_location_text,
          translated_features_text: selectedReferenceItem.translated_features_text,
          translated_highlights: [...selectedReferenceItem.translated_highlights],
          translated_image_alt_texts: [...selectedReferenceItem.translated_image_alt_texts],
          translation_status: selectedReferenceItem.translation_status,
        },
      }));
      setReferenceItems((prev) => prev.map((item) => (
        item.reference_id === selectedReferenceItem.reference_id
          ? {
              ...item,
              translation_is_stale: false,
              translation_updated_at: payload.updated_at,
            }
          : item
      )));
      setReferenceStatus('Referenz-Übersetzung gespeichert.');
      setReferenceStatusTone('success');
    } catch (error) {
      setReferenceStatus(error instanceof Error ? error.message : 'Referenz-Übersetzung konnte nicht gespeichert werden.');
      setReferenceStatusTone('error');
    } finally {
      setReferenceSaving(false);
    }
  }

  async function loadRequestItems() {
    setRequestLoading(true);
    setRequestStatus(null);
    setRequestStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const { data: requestsData, error: requestsError } = await supabase
        .from('partner_requests')
        .select('id, partner_id, provider, external_id, title, normalized_payload, source_updated_at, updated_at')
        .eq('partner_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (requestsError) throw new Error(`requests query failed: ${String(requestsError.message ?? requestsError.code ?? 'unknown error')}`);

      const requests = (requestsData ?? []) as RequestSourceRow[];
      const sources = Array.from(new Set(requests.map((item) => String(item.provider ?? '').trim()).filter(Boolean)));
      const externalIds = Array.from(new Set(requests.map((item) => String(item.external_id ?? '').trim()).filter(Boolean)));
      const requestIds = requests.map((item) => String(item.id ?? '').trim()).filter(Boolean);

      let overrideRows: RequestOverrideRow[] = [];
      if (sources.length > 0 && externalIds.length > 0) {
        const { data: overridesData, error: overridesError } = await supabase
          .from('partner_request_overrides')
          .select('partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, highlights, image_alt_texts')
          .eq('partner_id', user.id)
          .in('source', sources)
          .in('external_id', externalIds);

        if (overridesError) throw new Error(`request overrides query failed: ${String(overridesError.message ?? overridesError.code ?? 'unknown error')}`);
        overrideRows = (overridesData ?? []) as RequestOverrideRow[];
      }

      let translationRows: RequestTranslationRow[] = [];
      if (requestIds.length > 0) {
        const { data: translationsData, error: translationsError } = await supabase
          .from('partner_request_i18n')
          .select('id, request_id, source, external_id, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_highlights, translated_image_alt_texts, status, source_snapshot_hash, source_last_updated, updated_at')
          .eq('partner_id', user.id)
          .eq('target_locale', locale)
          .in('request_id', requestIds);

        if (translationsError) {
          if (isMissingRequestI18nTable(translationsError)) {
            throw new Error('Tabelle `partner_request_i18n` fehlt. Bitte SQL-Migration ausführen.');
          }
          throw new Error(`request translations query failed: ${String(translationsError.message ?? translationsError.code ?? 'unknown error')}`);
        }
        translationRows = (translationsData ?? []) as RequestTranslationRow[];
      }

      const overrideByKey = new Map(
        overrideRows.map((row) => [`${String(row.source ?? '').trim()}::${String(row.external_id ?? '').trim()}`, row] as const),
      );
      const translationByRequestId = new Map(
        translationRows
          .map((row) => [String(row.request_id ?? '').trim(), row] as const)
          .filter(([requestId]) => requestId.length > 0),
      );

      const nextItems = requests.map((request) => {
        const requestId = String(request.id ?? '').trim();
        const source = String(request.provider ?? '').trim();
        const externalId = String(request.external_id ?? '').trim();
        const payload = (request.normalized_payload ?? {}) as Record<string, unknown>;
        const override = overrideByKey.get(`${source}::${externalId}`);
        const translation = translationByRequestId.get(requestId);
        const description = getPayloadText(payload, ['long_description', 'description', 'title']);
        const regionLabel = getRegionTargetLabels(payload).join(', ') || getPayloadText(payload, ['region', 'location_text', 'location']);
        const features = getPayloadText(payload, ['features_text', 'features_note']);
        const highlights = toStringArray(payload.highlights);
        const imageAltTexts = toStringArray(payload.image_alt_texts);
        const sourceSeoTitle = String(override?.seo_title ?? request.title ?? '');
        const sourceSeoDescription = String(override?.seo_description ?? description ?? '');
        const sourceSeoH1 = String(override?.seo_h1 ?? request.title ?? '');
        const sourceShortDescription = String(override?.short_description ?? description ?? '');
        const sourceLongDescription = String(override?.long_description ?? description ?? '');
        const sourceLocationText = String(override?.location_text ?? regionLabel ?? '');
        const sourceFeaturesText = String(override?.features_text ?? features ?? '');
        const sourceHighlights = override?.highlights ?? highlights;
        const sourceImageAltTexts = override?.image_alt_texts ?? imageAltTexts;
        const sourceSnapshotHash = hashText(JSON.stringify({
          sourceSeoTitle,
          sourceSeoDescription,
          sourceSeoH1,
          sourceShortDescription,
          sourceLongDescription,
          sourceLocationText,
          sourceFeaturesText,
          sourceHighlights,
          sourceImageAltTexts,
        }));
        const storedHash = String(translation?.source_snapshot_hash ?? '').trim();

        return {
          request_id: requestId,
          source,
          external_id: externalId,
          title: String(request.title ?? ''),
          request_type: getPayloadText(payload, ['request_type']),
          object_type: getPayloadText(payload, ['object_type']),
          region_label: regionLabel,
          source_updated_at: request.source_updated_at ?? request.updated_at ?? null,
          source_snapshot_hash: sourceSnapshotHash,
          source_seo_title: sourceSeoTitle,
          source_seo_description: sourceSeoDescription,
          source_seo_h1: sourceSeoH1,
          source_short_description: sourceShortDescription,
          source_long_description: sourceLongDescription,
          source_location_text: sourceLocationText,
          source_features_text: sourceFeaturesText,
          source_highlights: sourceHighlights,
          source_image_alt_texts: sourceImageAltTexts,
          translated_seo_title: String(translation?.translated_seo_title ?? ''),
          translated_seo_description: String(translation?.translated_seo_description ?? ''),
          translated_seo_h1: String(translation?.translated_seo_h1 ?? ''),
          translated_short_description: String(translation?.translated_short_description ?? ''),
          translated_long_description: String(translation?.translated_long_description ?? ''),
          translated_location_text: String(translation?.translated_location_text ?? ''),
          translated_features_text: String(translation?.translated_features_text ?? ''),
          translated_highlights: translation?.translated_highlights ?? [],
          translated_image_alt_texts: translation?.translated_image_alt_texts ?? [],
          translation_status: (translation?.status ?? 'draft') as BlogTranslationStatus,
          translation_id: translation?.id ? String(translation.id) : null,
          translation_updated_at: translation?.updated_at ?? null,
          translation_is_stale: Boolean(storedHash) && storedHash !== sourceSnapshotHash,
        } satisfies RequestTranslationItem;
      });

      const nextBaseline = Object.fromEntries(
        nextItems.map((item) => [item.request_id, {
          translated_seo_title: item.translated_seo_title,
          translated_seo_description: item.translated_seo_description,
          translated_seo_h1: item.translated_seo_h1,
          translated_short_description: item.translated_short_description,
          translated_long_description: item.translated_long_description,
          translated_location_text: item.translated_location_text,
          translated_features_text: item.translated_features_text,
          translated_highlights: [...item.translated_highlights],
          translated_image_alt_texts: [...item.translated_image_alt_texts],
          translation_status: item.translation_status,
        }]),
      );

      setRequestItems(nextItems);
      setRequestBaselineById(nextBaseline);
      setRequestStatus(nextItems.length === 0
        ? `Keine Gesuche für den aktuellen Partner vorhanden. Debug: requests=${requests.length}, overrides=${overrideRows.length}, translations=${translationRows.length}, next=${nextItems.length}`
        : `Gesuche-Übersetzungsstand für ${nextItems.length} Datensatz/Datensätze geladen. Debug: requests=${requests.length}, overrides=${overrideRows.length}, translations=${translationRows.length}`);
      setRequestStatusTone('success');
    } catch (error) {
      setRequestItems([]);
      setRequestBaselineById({});
      setRequestStatus(error instanceof Error ? error.message : `Gesuche-Übersetzungen konnten nicht geladen werden: ${JSON.stringify(error)}`);
      setRequestStatusTone('error');
    } finally {
      setRequestLoading(false);
    }
  }

  async function saveSelectedRequestItem() {
    if (!selectedRequestItem) return;
    setRequestSaving(true);
    setRequestStatus(null);
    setRequestStatusTone(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Nicht angemeldet.');

      const payload = {
        partner_id: user.id,
        request_id: selectedRequestItem.request_id,
        area_id: config.area_id,
        source: selectedRequestItem.source,
        external_id: selectedRequestItem.external_id,
        target_locale: locale,
        translated_seo_title: selectedRequestItem.translated_seo_title.trim() || null,
        translated_seo_description: selectedRequestItem.translated_seo_description.trim() || null,
        translated_seo_h1: selectedRequestItem.translated_seo_h1.trim() || null,
        translated_short_description: selectedRequestItem.translated_short_description.trim() || null,
        translated_long_description: selectedRequestItem.translated_long_description.trim() || null,
        translated_location_text: selectedRequestItem.translated_location_text.trim() || null,
        translated_features_text: selectedRequestItem.translated_features_text.trim() || null,
        translated_highlights: selectedRequestItem.translated_highlights,
        translated_image_alt_texts: selectedRequestItem.translated_image_alt_texts,
        status: selectedRequestItem.translation_status,
        source_snapshot_hash: selectedRequestItem.source_snapshot_hash,
        source_last_updated: selectedRequestItem.source_updated_at,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('partner_request_i18n')
        .upsert(payload, { onConflict: 'partner_id,request_id,target_locale' });

      if (error) {
        if (isMissingRequestI18nTable(error)) {
          throw new Error('Tabelle `partner_request_i18n` fehlt. Bitte SQL-Migration ausführen.');
        }
        throw error;
      }

      setRequestBaselineById((prev) => ({
        ...prev,
        [selectedRequestItem.request_id]: {
          translated_seo_title: selectedRequestItem.translated_seo_title,
          translated_seo_description: selectedRequestItem.translated_seo_description,
          translated_seo_h1: selectedRequestItem.translated_seo_h1,
          translated_short_description: selectedRequestItem.translated_short_description,
          translated_long_description: selectedRequestItem.translated_long_description,
          translated_location_text: selectedRequestItem.translated_location_text,
          translated_features_text: selectedRequestItem.translated_features_text,
          translated_highlights: [...selectedRequestItem.translated_highlights],
          translated_image_alt_texts: [...selectedRequestItem.translated_image_alt_texts],
          translation_status: selectedRequestItem.translation_status,
        },
      }));
      setRequestItems((prev) => prev.map((item) => (
        item.request_id === selectedRequestItem.request_id
          ? {
              ...item,
              translation_is_stale: false,
              translation_updated_at: payload.updated_at,
            }
          : item
      )));
      setRequestStatus('Gesuche-Übersetzung gespeichert.');
      setRequestStatusTone('success');
    } catch (error) {
      setRequestStatus(error instanceof Error ? error.message : 'Gesuche-Übersetzung konnte nicht gespeichert werden.');
      setRequestStatusTone('error');
    } finally {
      setRequestSaving(false);
    }
  }

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

  function workflowPromptStorageKey(displayClass: DisplayTextClass): string {
    return `${locale}:${displayClass}`;
  }

  function rowPromptStorageKey(row: TranslationRow): string {
    return `${locale}:${row.area_id}:${row.section_key}`;
  }

  function getWorkflowPrompt(displayClass: DisplayTextClass): string {
    return workflowPromptDrafts[workflowPromptStorageKey(displayClass)] ?? getI18nStandardPrompt(displayClass, locale);
  }

  function getRowDisplayClass(row: TranslationRow): DisplayTextClass {
    const meta = resolveSectionMeta(row.section_key);
    const sectionType: SectionKind = meta?.type ?? 'general';
    return resolveDisplayTextClass(row.section_key, sectionType);
  }

  async function loadRows(options?: { autoSync?: boolean; sectionKeys?: string[]; workflowClass?: DisplayTextClass; promptTemplate?: string }) {
    if (!config?.area_id) return;
    setLoading(true);
    try {
      const scopeAreas = await resolveScopeAreas(scope);
      setScopeAreaItems(scopeAreas);
      const keys = Array.from(new Set((options?.sectionKeys ?? []).map((item) => String(item ?? '').trim()).filter(Boolean)));
      const results = await Promise.all(scopeAreas.map(async (scopeArea) => {
        const params = new URLSearchParams({
          area_id: scopeArea.area_id,
          locale,
          channel,
          auto_sync: options?.autoSync ? '1' : '0',
        });
        if (keys.length > 0) params.set('section_keys', keys.join(','));
        if (options?.autoSync && options?.workflowClass) params.set('workflow_class', options.workflowClass);
        if (options?.autoSync && options?.promptTemplate) params.set('prompt_template', options.promptTemplate);
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
    if (activeDomain !== 'immobilienmarkt') return;
    void loadRows({ autoSync: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, config?.area_id, locale, channel, scope]);

  useEffect(() => {
    if (activeDomain !== 'blog') return;
    void loadBlogItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, config?.area_id, locale]);

  useEffect(() => {
    if (activeDomain !== 'immobilien' || !activeDomainMeta.enabled) return;
    void loadPropertyItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, activeDomainMeta.enabled, config?.area_id, locale]);

  useEffect(() => {
    if (activeDomain !== 'referenzen' || !activeDomainMeta.enabled) return;
    void loadReferenceItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, activeDomainMeta.enabled, config?.area_id, locale]);

  useEffect(() => {
    if (activeDomain !== 'gesuche' || !activeDomainMeta.enabled) return;
    void loadRequestItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain, activeDomainMeta.enabled, config?.area_id, locale]);

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

  useEffect(() => {
    if (scopeAreaItems.length === 0) return;
    if (scopeAreaItems.some((item) => item.area_id === selectedScopeAreaId)) return;
    setSelectedScopeAreaId(scopeAreaItems[0]?.area_id ?? '');
  }, [scopeAreaItems, selectedScopeAreaId]);

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
      next[displayClass] = estimateTranslationTotals(groupedTexts[displayClass], pricingPreview, {
        promptText: getWorkflowPrompt(displayClass),
        fixedPromptOverheadTokens: 48,
      });
    }
    return next;
  }, [rows, pricingPreview, locale, workflowPromptDrafts]);

  const filteredRows = useMemo(() => {
    const withIndex = (rowsByTab.get(activeTab) ?? [])
      .filter((row) => isTranslatableSectionKey(row.section_key))
      .filter((row) => (scope === 'kreis_ortslagen' ? row.area_id === selectedScopeAreaId : true))
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
  }, [rowsByTab, activeTab, activeClass, scope, selectedScopeAreaId]);

  const hasEdits = useMemo(
    () => rows.some((row) => String(row.translated_content ?? '').trim() !== String(baselineByKey[`${row.area_id}::${row.section_key}`] ?? '').trim()),
    [rows, baselineByKey],
  );

  const blogHasEdits = useMemo(() => {
    if (!selectedBlogItem) return false;
    const baseline = blogBaselineByPostId[selectedBlogItem.post_id];
    if (!baseline) {
      return (
        selectedBlogItem.translated_headline.trim().length > 0
        || selectedBlogItem.translated_subline.trim().length > 0
        || selectedBlogItem.translated_body_md.trim().length > 0
        || selectedBlogItem.translation_status !== 'draft'
      );
    }
    return (
      selectedBlogItem.translated_headline !== baseline.translated_headline
      || selectedBlogItem.translated_subline !== baseline.translated_subline
      || selectedBlogItem.translated_body_md !== baseline.translated_body_md
      || selectedBlogItem.translation_status !== baseline.translation_status
    );
  }, [blogBaselineByPostId, selectedBlogItem]);

  const propertyHasEdits = useMemo(() => {
    if (!selectedPropertyItem) return false;
    const baseline = propertyBaselineByOfferId[selectedPropertyItem.offer_id];
    if (!baseline) {
      return (
        selectedPropertyItem.translated_seo_title.trim().length > 0
        || selectedPropertyItem.translated_seo_description.trim().length > 0
        || selectedPropertyItem.translated_seo_h1.trim().length > 0
        || selectedPropertyItem.translated_short_description.trim().length > 0
        || selectedPropertyItem.translated_long_description.trim().length > 0
        || selectedPropertyItem.translated_location_text.trim().length > 0
        || selectedPropertyItem.translated_features_text.trim().length > 0
        || selectedPropertyItem.translated_highlights.length > 0
        || selectedPropertyItem.translated_image_alt_texts.length > 0
        || selectedPropertyItem.translation_status !== 'draft'
      );
    }
    return (
      selectedPropertyItem.translated_seo_title !== baseline.translated_seo_title
      || selectedPropertyItem.translated_seo_description !== baseline.translated_seo_description
      || selectedPropertyItem.translated_seo_h1 !== baseline.translated_seo_h1
      || selectedPropertyItem.translated_short_description !== baseline.translated_short_description
      || selectedPropertyItem.translated_long_description !== baseline.translated_long_description
      || selectedPropertyItem.translated_location_text !== baseline.translated_location_text
      || selectedPropertyItem.translated_features_text !== baseline.translated_features_text
      || JSON.stringify(selectedPropertyItem.translated_highlights) !== JSON.stringify(baseline.translated_highlights)
      || JSON.stringify(selectedPropertyItem.translated_image_alt_texts) !== JSON.stringify(baseline.translated_image_alt_texts)
      || selectedPropertyItem.translation_status !== baseline.translation_status
    );
  }, [propertyBaselineByOfferId, selectedPropertyItem]);

  const referenceHasEdits = useMemo(() => {
    if (!selectedReferenceItem) return false;
    const baseline = referenceBaselineById[selectedReferenceItem.reference_id];
    if (!baseline) {
      return (
        selectedReferenceItem.translated_seo_title.trim().length > 0
        || selectedReferenceItem.translated_seo_description.trim().length > 0
        || selectedReferenceItem.translated_seo_h1.trim().length > 0
        || selectedReferenceItem.translated_short_description.trim().length > 0
        || selectedReferenceItem.translated_long_description.trim().length > 0
        || selectedReferenceItem.translated_location_text.trim().length > 0
        || selectedReferenceItem.translated_features_text.trim().length > 0
        || selectedReferenceItem.translated_highlights.length > 0
        || selectedReferenceItem.translated_image_alt_texts.length > 0
        || selectedReferenceItem.translation_status !== 'draft'
      );
    }
    return (
      selectedReferenceItem.translated_seo_title !== baseline.translated_seo_title
      || selectedReferenceItem.translated_seo_description !== baseline.translated_seo_description
      || selectedReferenceItem.translated_seo_h1 !== baseline.translated_seo_h1
      || selectedReferenceItem.translated_short_description !== baseline.translated_short_description
      || selectedReferenceItem.translated_long_description !== baseline.translated_long_description
      || selectedReferenceItem.translated_location_text !== baseline.translated_location_text
      || selectedReferenceItem.translated_features_text !== baseline.translated_features_text
      || JSON.stringify(selectedReferenceItem.translated_highlights) !== JSON.stringify(baseline.translated_highlights)
      || JSON.stringify(selectedReferenceItem.translated_image_alt_texts) !== JSON.stringify(baseline.translated_image_alt_texts)
      || selectedReferenceItem.translation_status !== baseline.translation_status
    );
  }, [referenceBaselineById, selectedReferenceItem]);

  const requestHasEdits = useMemo(() => {
    if (!selectedRequestItem) return false;
    const baseline = requestBaselineById[selectedRequestItem.request_id];
    if (!baseline) {
      return (
        selectedRequestItem.translated_seo_title.trim().length > 0
        || selectedRequestItem.translated_seo_description.trim().length > 0
        || selectedRequestItem.translated_seo_h1.trim().length > 0
        || selectedRequestItem.translated_short_description.trim().length > 0
        || selectedRequestItem.translated_long_description.trim().length > 0
        || selectedRequestItem.translated_location_text.trim().length > 0
        || selectedRequestItem.translated_features_text.trim().length > 0
        || selectedRequestItem.translated_highlights.length > 0
        || selectedRequestItem.translated_image_alt_texts.length > 0
        || selectedRequestItem.translation_status !== 'draft'
      );
    }
    return (
      selectedRequestItem.translated_seo_title !== baseline.translated_seo_title
      || selectedRequestItem.translated_seo_description !== baseline.translated_seo_description
      || selectedRequestItem.translated_seo_h1 !== baseline.translated_seo_h1
      || selectedRequestItem.translated_short_description !== baseline.translated_short_description
      || selectedRequestItem.translated_long_description !== baseline.translated_long_description
      || selectedRequestItem.translated_location_text !== baseline.translated_location_text
      || selectedRequestItem.translated_features_text !== baseline.translated_features_text
      || JSON.stringify(selectedRequestItem.translated_highlights) !== JSON.stringify(baseline.translated_highlights)
      || JSON.stringify(selectedRequestItem.translated_image_alt_texts) !== JSON.stringify(baseline.translated_image_alt_texts)
      || selectedRequestItem.translation_status !== baseline.translation_status
    );
  }, [requestBaselineById, selectedRequestItem]);

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

  const showScopeAreaSidebar = scope === 'kreis_ortslagen' && scopeAreaItems.length > 1;
  const selectedScopeArea = useMemo(
    () => scopeAreaItems.find((item) => item.area_id === selectedScopeAreaId) ?? scopeAreaItems[0] ?? null,
    [scopeAreaItems, selectedScopeAreaId],
  );
  const scrollToTopicSection = () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(topicSectionAnchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
        .filter((row) => String(row.translated_content ?? '').trim() !== String(baselineByKey[`${row.area_id}::${row.section_key}`] ?? '').trim());
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
    const displayClass = getRowDisplayClass(row);
    const standardPrompt = getWorkflowPrompt(displayClass);
    const customPrompt = buildI18nPromptWithExtras(standardPrompt, rowCustomPromptMap[rowPromptStorageKey(row)]);
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
    await loadRows({
      autoSync: true,
      sectionKeys: selectedWorkflowKeys,
      workflowClass: activeClass,
      promptTemplate: getWorkflowPrompt(activeClass),
    });
  }

  return (
    <>
      <FullscreenLoader
        show={loading || saving || Boolean(rewritingKey) || blogLoading || blogSaving || propertyLoading || propertySaving || referenceLoading || referenceSaving || requestLoading || requestSaving}
        label={
          requestLoading
            ? 'Gesuche-Übersetzungen werden geladen...'
            : requestSaving
              ? 'Gesuche-Übersetzung wird gespeichert...'
          : referenceLoading
            ? 'Referenz-Übersetzungen werden geladen...'
            : referenceSaving
              ? 'Referenz-Übersetzung wird gespeichert...'
          : propertyLoading
            ? 'Immobilien-Übersetzungen werden geladen...'
            : propertySaving
              ? 'Immobilien-Übersetzung wird gespeichert...'
          : blogLoading
            ? 'Blog-Übersetzungen werden geladen...'
            : blogSaving
              ? 'Blog-Übersetzung wird gespeichert...'
            : loading
            ? 'Uebersetzungsstand wird geladen...'
            : saving
              ? 'Uebersetzungen werden gespeichert...'
              : 'Uebersetzung wird aktualisiert...'
        }
      />
      {workflowConfirmOpen ? (
        <div
          style={workflowConfirmOverlayStyle}
          onClick={() => setWorkflowConfirmOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setWorkflowConfirmOpen(false);
          }}
        >
          <div
            style={workflowConfirmCardStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="i18n-workflow-confirm-title"
            aria-describedby="i18n-workflow-confirm-text"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="i18n-workflow-confirm-title" style={workflowConfirmTitleStyle}>Vor dem Übersetzungslauf prüfen</h3>
            <p id="i18n-workflow-confirm-text" style={workflowConfirmTextStyle}>
              Bitte prüfe den deutschen Stand vor dem Übersetzungslauf auf Vollständigkeit und Qualität, um Korrekturläufe und Kosten zu sparen!
            </p>
            <div style={workflowConfirmActionRowStyle}>
              <button type="button" style={workflowConfirmCancelButtonStyle} onClick={() => setWorkflowConfirmOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                style={workflowConfirmProceedButtonStyle}
                onClick={() => {
                  setWorkflowConfirmOpen(false);
                  void triggerWorkflowUpdate();
                }}
              >
                Übersetzung starten
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <section style={wrapStyle}>
        <div style={topCardStyle}>
          <div style={controlsStyle}>
            <label style={fieldStyle}>
              <select style={inputStyle} value={locale} onChange={(e) => setLocale(e.target.value)}>
                {locales.map((item) => (
                  <option key={item} value={item}>{normalizeLocaleLabel(item)}</option>
                ))}
              </select>
            </label>

            {activeDomain === 'immobilienmarkt' ? (
              <>
                <label style={{ ...fieldStyle, minWidth: 320 }}>
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
              </>
            ) : null}
          </div>
        </div>

        <div style={domainTabGridStyle}>
          {productDomains.map((domain) => (
            <button
              key={domain.id}
              type="button"
              style={domainTabStyle(activeDomain === domain.id)}
              onClick={() => setActiveDomain(domain.id)}
            >
              <div style={domainTabTopStyle}>
                <strong style={domainTabTitleStyle}>{domain.label}</strong>
                <span
                  style={domainTabStatusDotStyle(domain.enabled)}
                  aria-label={domain.enabled ? `${domain.label} verfügbar` : `${domain.label} nicht verfügbar`}
                  title={domain.enabled ? 'Verfügbar' : 'Nicht verfügbar'}
                />
              </div>
            </button>
          ))}
        </div>

	      {activeDomain === 'immobilienmarkt' ? (
	      <div style={workflowCardStackStyle}>
	      <div style={{ ...workflowPanelCardStyle, marginBottom: 0 }}>
	        <div style={workflowCardHeaderStyle}>
	          <div style={workflowHeaderInlineStyle}>
	            <h3 style={sectionTabsIntroTitleStyle}>Bereich wählen -&gt;</h3>
	            <div style={workflowInlineControlsStyle}>
	              <label style={workflowInlineFieldStyle}>
	                <select
	                  style={workflowInlineSelectStyle}
	                  value={channel}
	                  onChange={(e) => setChannel(e.target.value as I18nChannel)}
	                >
	                  {I18N_CHANNEL_OPTIONS.map((item) => (
	                    <option key={item.value} value={item.value}>{item.label}</option>
	                  ))}
	                </select>
	              </label>
	              <label style={workflowInlineFieldStyle}>
	                <select
	                  style={workflowInlineSelectStyle}
	                  value={scope}
	                  onChange={(e) => setScope(e.target.value as I18nScope)}
	                >
	                  {I18N_SCOPE_OPTIONS.map((item) => (
	                    <option key={item.value} value={item.value} disabled={item.value === 'kreis_ortslagen' && !isDistrict}>
	                      {item.value === 'current_area' ? item.label.replace('Dieses Gebiet', areaScopeLabel) : item.label}
	                    </option>
	                  ))}
	                </select>
	              </label>
	              {status ? (
	                <div style={statusTone === 'error' ? workflowStatusErrorStyle : workflowStatusSuccessStyle}>{status}</div>
	              ) : (
	                <div style={workflowScopeHintStyle}>Themenbereiche prüfen oder bei Bedarf nacharbeiten</div>
	              )}
	            </div>
	          </div>
	        </div>

	        <div style={classGridStyle}>
	          {workflowClasses.map((displayClass) => {
	            const stats = classSummary[displayClass];
	            const active = activeClass === displayClass;
	            const buttonDisabled = loading || saving || (active && selectedWorkflowKeys.length === 0);
	            return (
	              <button
	                key={displayClass}
	                type="button"
	                style={classCardStyle(active)}
	                onClick={() => setActiveClass(displayClass)}
	              >
	                <div style={classCardTopStyle}>
	                  <span style={workflowClassBadgeStyle(displayClass)}>{displayTextClassLabel(displayClass)}</span>
	                  <span style={classCardCountStyle}>{stats.total}</span>
	                </div>
	                <p style={classCardTextStyle}>{i18nWorkflowClassDescription(displayClass)}</p>
	                <p style={classCardCycleStyle}>{i18nWorkflowClassCycle(displayClass)}</p>
	                <div style={classCardStatsStyle}>
	                  <div style={classCardStatLineStyle}>
	                    <span>Uebersetzt: {stats.translated}</span>
	                    <span>DE-Fallback: {stats.fallback}</span>
	                    <span>Tokens ca.: {classEstimateMap[displayClass].total_tokens.toLocaleString('de-DE')}</span>
	                  </div>
	                  {stats.stale > 0 ? (
	                    <div style={classCardStatLineStyle}>
	                      <span>Veraltet: {stats.stale}</span>
	                    </div>
	                  ) : null}
	                </div>
	                <div style={classCardCostStyle}>
	                  <span style={classCardStatLineStyle}>USD ca.: {formatCost(classEstimateMap[displayClass].estimated_cost_usd, 'USD')}</span>
	                  <span style={classCardStatLineStyle}>EUR ca.: {formatCost(classEstimateMap[displayClass].estimated_cost_eur, 'EUR')}</span>
	                  <span style={workflowCostInfoWrapStyle}>
	                    <button
	                      type="button"
	                      style={workflowCostInfoTriggerStyle}
	                      onClick={(e) => {
	                        e.stopPropagation();
	                        setCostInfoOpenClass((prev) => (prev === displayClass ? null : displayClass));
	                      }}
	                      aria-label="Hinweis zur Kostenberechnung"
	                    >
	                      i
	                    </button>
	                    {costInfoOpenClass === displayClass ? (
	                      <span style={workflowCostInfoPopoverStyle}>
	                        Unverbindliche Schätzung auf Basis von Textlänge, Prompt, Modellpreisen und pauschalem Request-Overhead. Tatsächliche API-Kosten können abweichen.
	                      </span>
	                    ) : null}
	                  </span>
	                </div>
	                <label style={workflowPromptLabelStyle}>
	                  Standardprompt (anpassbar)
	                  <textarea
	                    value={getWorkflowPrompt(displayClass)}
	                    onChange={(e) => {
	                      const next = e.target.value;
	                      setWorkflowPromptDrafts((prev) => ({
	                        ...prev,
	                        [workflowPromptStorageKey(displayClass)]: next,
	                      }));
	                    }}
	                    style={workflowPromptTextareaStyle}
	                    placeholder={getI18nStandardPrompt(displayClass, locale)}
	                  />
	                </label>
	                <div style={classCardActionRowStyle}>
	                  <button
	                    type="button"
	                    style={workflowAnchorLinkStyle(String(displayTextBadgeStyle(displayClass).color ?? '#486b7a'))}
	                    onClick={(e) => {
	                      e.stopPropagation();
	                      scrollToTopicSection();
	                    }}
	                  >
	                    Einzeltexte
	                  </button>
	                  <button
	                    type="button"
	                    style={workflowActionButtonStyle({
	                      borderColor: String(displayTextBadgeStyle(displayClass).borderColor ?? '#cbd5e1'),
	                      background: String(displayTextBadgeStyle(displayClass).background ?? '#f8fafc'),
	                      color: String(displayTextBadgeStyle(displayClass).color ?? '#475569'),
	                      disabled: buttonDisabled,
	                    })}
	                    onClick={() => {
	                      if (!active) {
	                        setActiveClass(displayClass);
	                        return;
	                      }
	                      setWorkflowConfirmOpen(true);
	                    }}
	                    disabled={buttonDisabled}
	                  >
	                    {activeClass === 'data_driven' && active ? 'Data-Driven aktualisieren' : 'Alle Texte KI-übersetzen'}
	                  </button>
	                </div>
	              </button>
	            );
	          })}
	        </div>
	      </div>

	      <div style={{ ...workflowPanelCardStyle, marginBottom: 0 }}>
	        <div id={topicSectionAnchorId} style={{ ...sectionTabsIntroStyle, ...workflowAnchorTargetStyle }}>
          <h3 style={sectionTabsIntroTitleStyle}>Themenbereiche prüfen oder bei Bedarf nacharbeiten</h3>
        </div>
        {showScopeAreaSidebar ? (
          <div style={workflowAreaGridStyle}>
            <aside style={workflowAreaListCardStyle}>
              <div style={workflowAreaListWrapStyle}>
                {scopeAreaItems.map((item) => {
                  const isDistrictItem = item.area_id.split('-').length <= 3;
                  const active = selectedScopeArea?.area_id === item.area_id;
                  return (
                    <button
                      key={item.area_id}
                      type="button"
                      style={workflowAreaListRowStyle(active)}
                      onClick={() => setSelectedScopeAreaId(item.area_id)}
                    >
                      <div style={workflowAreaListRowTopStyle}>
                        <strong style={workflowAreaHeadlineStyle}>{item.area_name}</strong>
                        <span style={workflowAreaTypeBadgeStyle(!isDistrictItem)}>{isDistrictItem ? 'Kreis' : 'Ortslage'}</span>
                      </div>
                      <div style={workflowAreaMetaLineStyle}>{item.area_id}</div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div style={workflowAreaContentWrapStyle}>
              <div style={workflowAreaContentStackStyle}>
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
                          <td style={tdStyle} colSpan={3}>In diesem Themenbereich sind für das gewählte Gebiet und den gewählten Texttyp aktuell keine übersetzbaren Inhalte vorhanden.</td>
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
                                  item.area_id === row.area_id && item.section_key === row.section_key
                                    ? { ...item, translated_content: next }
                                    : item
                                )));
                              }}
                            />
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={smallGhostButtonStyle}
                                disabled={loading || saving || llmOptions.length === 0}
                                onClick={async () => {
                                  try {
                                    setRewritingKey(`${row.area_id}:${row.section_key}`);
                                    setStatusTone(null);
                                    setStatus(`KI übersetzt ${row.section_key} …`);
                                    const translated = await rewriteViaAi(row);
                                    setRows((prev) => prev.map((item) => (
                                      item.area_id === row.area_id && item.section_key === row.section_key
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
                                {rewritingKey === `${row.area_id}:${row.section_key}` ? 'Übersetzt …' : 'Mit KI übersetzen'}
                              </button>
                              <button
                                type="button"
                                style={promptToggleStyle}
                                onClick={() => {
                                  const promptKey = rowPromptStorageKey(row);
                                  setRowPromptOpenMap((prev) => ({
                                    ...prev,
                                    [promptKey]: !prev[promptKey],
                                  }));
                                }}
                              >
                                {rowPromptOpenMap[rowPromptStorageKey(row)] ? 'Prompt ausblenden' : 'Prompt anzeigen'}
                              </button>
                              {row.translation_is_stale ? (
                                <span style={staleBadgeStyle}>Quelle geändert</span>
                              ) : null}
                            </div>
                            {rowPromptOpenMap[rowPromptStorageKey(row)] ? (
                              <div style={promptPanelStyle}>
                                <div style={promptLabelStyle}>Standard-Prompt</div>
                                <div style={promptContentStyle}>{getWorkflowPrompt(getRowDisplayClass(row))}</div>
                                <label style={promptInputLabelStyle}>
                                  Eigener Prompt (optional)
                                  <textarea
                                    value={rowCustomPromptMap[rowPromptStorageKey(row)] ?? ''}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      const promptKey = rowPromptStorageKey(row);
                                      setRowCustomPromptMap((prev) => ({
                                        ...prev,
                                        [promptKey]: next,
                                      }));
                                    }}
                                    style={promptInputStyle}
                                    placeholder="Eigene Zusatzvorgaben (werden zum Standard-Prompt ergänzt)"
                                  />
                                </label>
                              </div>
                            ) : null}
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
            </div>
          </div>
        ) : (
          <>
            <div style={workflowAreaContentStackStyle}>
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
                                item.area_id === row.area_id && item.section_key === row.section_key
                                  ? { ...item, translated_content: next }
                                  : item
                              )));
                            }}
                          />
                          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={smallGhostButtonStyle}
                              disabled={loading || saving || llmOptions.length === 0}
                              onClick={async () => {
                                try {
                                  setRewritingKey(`${row.area_id}:${row.section_key}`);
                                  setStatusTone(null);
                                  setStatus(`KI übersetzt ${row.section_key} …`);
                                  const translated = await rewriteViaAi(row);
                                  setRows((prev) => prev.map((item) => (
                                    item.area_id === row.area_id && item.section_key === row.section_key
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
                              {rewritingKey === `${row.area_id}:${row.section_key}` ? 'Übersetzt …' : 'Mit KI übersetzen'}
                            </button>
                            <button
                              type="button"
                              style={promptToggleStyle}
                              onClick={() => {
                                const promptKey = rowPromptStorageKey(row);
                                setRowPromptOpenMap((prev) => ({
                                  ...prev,
                                  [promptKey]: !prev[promptKey],
                                }));
                              }}
                            >
                              {rowPromptOpenMap[rowPromptStorageKey(row)] ? 'Prompt ausblenden' : 'Prompt anzeigen'}
                            </button>
                            {row.translation_is_stale ? (
                              <span style={staleBadgeStyle}>Quelle geändert</span>
                            ) : null}
                          </div>
                          {rowPromptOpenMap[rowPromptStorageKey(row)] ? (
                            <div style={promptPanelStyle}>
                              <div style={promptLabelStyle}>Standard-Prompt</div>
                              <div style={promptContentStyle}>{getWorkflowPrompt(getRowDisplayClass(row))}</div>
                              <label style={promptInputLabelStyle}>
                                Eigener Prompt (optional)
                                <textarea
                                  value={rowCustomPromptMap[rowPromptStorageKey(row)] ?? ''}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    const promptKey = rowPromptStorageKey(row);
                                    setRowCustomPromptMap((prev) => ({
                                      ...prev,
                                      [promptKey]: next,
                                    }));
                                  }}
                                  style={promptInputStyle}
                                  placeholder="Eigene Zusatzvorgaben (werden zum Standard-Prompt ergänzt)"
                                />
                              </label>
                            </div>
                          ) : null}
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
          </>
        )}
	      </div>
	      </div>
	      ) : activeDomain === 'blog' ? (
      <div style={editorCardStyle}>
        {blogStatus ? <div style={blogStatusTone === 'error' ? statusErrorBoxStyle : statusSuccessBoxStyle}>{blogStatus}</div> : null}
        <div style={blogGridStyle}>
          <aside style={blogListCardStyle}>
            <div style={blogListHeadStyle}>
              <h3 style={sectionTabsIntroTitleStyle}>Beiträge</h3>
              <button
                type="button"
                style={secondaryActionButtonStyle}
                onClick={() => void loadBlogItems()}
                disabled={blogLoading || blogSaving}
              >
                Stand laden
              </button>
            </div>
            <div style={blogListMetaStyle}>
              Je Beitrag werden Headline, Subline und Markdown-Text in der Zielsprache gepflegt.
            </div>
            {blogItems.length === 0 ? (
              <div style={blogEmptyStateStyle}>Im aktuellen Gebiet gibt es noch keine Blogbeiträge.</div>
            ) : (
              <div style={blogListWrapStyle}>
                {blogItems.map((item) => {
                  const translated = Boolean(
                    item.translated_headline.trim()
                    || item.translated_subline.trim()
                    || item.translated_body_md.trim(),
                  );
                  return (
                    <button
                      key={item.post_id}
                      type="button"
                      style={blogListRowStyle(selectedBlogItem?.post_id === item.post_id)}
                      onClick={() => setSelectedBlogPostId(item.post_id)}
                    >
                      <div style={blogListRowTopStyle}>
                        <strong style={blogListHeadlineStyle}>{item.headline || 'Ohne Titel'}</strong>
                        <span style={blogTranslationBadgeStyle(item.translation_is_stale, translated)}>
                          {item.translation_is_stale ? 'Veraltet' : translated ? 'Übersetzt' : 'Fehlt'}
                        </span>
                      </div>
                      <div style={blogListSublineStyle}>{item.subline || 'Keine Subline'}</div>
                      <div style={blogListMetaLineStyle}>
                        DE-Status: {item.source_status} · {item.source_created_at ? new Date(item.source_created_at).toLocaleDateString('de-DE') : 'ohne Datum'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div style={blogEditorWrapStyle}>
            {selectedBlogItem ? (
              <>
                <div style={blogEditorHeadStyle}>
                  <div>
                    <h3 style={sectionTabsIntroTitleStyle}>{selectedBlogItem.headline || 'Ohne Titel'}</h3>
                    <p style={blogEditorIntroStyle}>
                      Übersetze Headline, Subline und den Markdown-Text dieses Beitrags separat. Der deutsche Blog-Workflow bleibt im Bereich „Blog“.
                    </p>
                  </div>
                  <span style={blogTranslationBadgeStyle(selectedBlogItem.translation_is_stale, Boolean(
                    selectedBlogItem.translated_headline.trim()
                    || selectedBlogItem.translated_subline.trim()
                    || selectedBlogItem.translated_body_md.trim(),
                  ))}>
                    {selectedBlogItem.translation_is_stale ? 'Quelle geändert' : selectedBlogItem.translation_status}
                  </span>
                </div>

                <div style={blogSummaryGridStyle}>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Deutscher Beitrag</span>
                    <strong>{selectedBlogItem.source_status}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Übersetzungsstatus</span>
                    <strong>{selectedBlogItem.translation_status}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Zuletzt aktualisiert</span>
                    <strong>{selectedBlogItem.translation_updated_at ? new Date(selectedBlogItem.translation_updated_at).toLocaleString('de-DE') : 'Noch nicht gespeichert'}</strong>
                  </div>
                </div>

                <div style={blogColumnGridStyle}>
                  <div style={blogSourceCardStyle}>
                    <div style={blogColumnHeadStyle}>Deutsch (Quelle)</div>
                    <label style={fieldStyle}>
                      Headline
                      <input style={inputStyle} value={selectedBlogItem.headline} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Subline
                      <input style={inputStyle} value={selectedBlogItem.subline} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Markdown-Text
                      <textarea style={blogReadonlyTextareaStyle} value={selectedBlogItem.body_md} readOnly />
                    </label>
                  </div>

                  <div style={blogTargetCardStyle}>
                    <div style={blogColumnHeadStyle}>Übersetzung</div>
                    <label style={fieldStyle}>
                      Headline
                      <input
                        style={inputStyle}
                        value={selectedBlogItem.translated_headline}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBlogItems((prev) => prev.map((item) => (
                            item.post_id === selectedBlogItem.post_id ? { ...item, translated_headline: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Subline
                      <input
                        style={inputStyle}
                        value={selectedBlogItem.translated_subline}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBlogItems((prev) => prev.map((item) => (
                            item.post_id === selectedBlogItem.post_id ? { ...item, translated_subline: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Markdown-Text
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedBlogItem.translated_body_md}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBlogItems((prev) => prev.map((item) => (
                            item.post_id === selectedBlogItem.post_id ? { ...item, translated_body_md: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Status
                      <select
                        style={inputStyle}
                        value={selectedBlogItem.translation_status}
                        onChange={(e) => {
                          const next = e.target.value as BlogTranslationStatus;
                          setBlogItems((prev) => prev.map((item) => (
                            item.post_id === selectedBlogItem.post_id ? { ...item, translation_status: next } : item
                          )));
                        }}
                      >
                        <option value="draft">Entwurf</option>
                        <option value="approved">Freigegeben</option>
                        <option value="needs_review">Prüfen</option>
                      </select>
                    </label>
                    <div style={blogActionRowStyle}>
                      <button
                        type="button"
                        style={secondaryActionButtonStyle}
                        onClick={() => {
                          setBlogItems((prev) => prev.map((item) => (
                            item.post_id === selectedBlogItem.post_id
                              ? {
                                  ...item,
                                  translated_headline: item.headline,
                                  translated_subline: item.subline,
                                  translated_body_md: item.body_md,
                                }
                              : item
                          )));
                        }}
                        disabled={blogSaving}
                      >
                        Deutsch übernehmen
                      </button>
                      <button
                        type="button"
                        style={buttonPrimaryStyle(blogHasEdits && !blogSaving)}
                        onClick={() => void saveSelectedBlogItem()}
                        disabled={!blogHasEdits || blogSaving}
                      >
                        {blogSaving ? 'Speichern …' : 'Blog-Übersetzung speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={blogEmptyDetailStyle}>Wähle links einen Blogbeitrag, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : activeDomain === 'immobilien' && activeDomainMeta.enabled ? (
      <div style={editorCardStyle}>
        {propertyStatus ? <div style={propertyStatusTone === 'error' ? statusErrorBoxStyle : statusSuccessBoxStyle}>{propertyStatus}</div> : null}
        <div style={blogGridStyle}>
          <aside style={blogListCardStyle}>
            <div style={blogListHeadStyle}>
              <h3 style={sectionTabsIntroTitleStyle}>Angebote</h3>
              <button
                type="button"
                style={secondaryActionButtonStyle}
                onClick={() => void loadPropertyItems()}
                disabled={propertyLoading || propertySaving}
              >
                Stand laden
              </button>
            </div>
            <div style={blogListMetaStyle}>
              Je Angebot werden SEO-, Beschreibungs- und Bildtexte in der Zielsprache getrennt vom deutschen Exposé gepflegt.
            </div>
            {propertyItems.length === 0 ? (
              <div style={blogEmptyStateStyle}>Im aktuellen Gebiet gibt es noch keine Partner-Immobilien.</div>
            ) : (
              <div style={blogListWrapStyle}>
                {propertyItems.map((item) => {
                  const translated = Boolean(
                    item.translated_seo_title.trim()
                    || item.translated_seo_description.trim()
                    || item.translated_seo_h1.trim()
                    || item.translated_short_description.trim()
                    || item.translated_long_description.trim()
                    || item.translated_location_text.trim()
                    || item.translated_features_text.trim()
                    || item.translated_highlights.length > 0
                    || item.translated_image_alt_texts.length > 0,
                  );
                  return (
                    <button
                      key={item.offer_id}
                      type="button"
                      style={blogListRowStyle(selectedPropertyItem?.offer_id === item.offer_id)}
                      onClick={() => setSelectedPropertyOfferId(item.offer_id)}
                    >
                      <div style={blogListRowTopStyle}>
                        <strong style={blogListHeadlineStyle}>{item.title || 'Ohne Titel'}</strong>
                        <span style={blogTranslationBadgeStyle(item.translation_is_stale, translated)}>
                          {item.translation_is_stale ? 'Veraltet' : translated ? 'Übersetzt' : 'Fehlt'}
                        </span>
                      </div>
                      <div style={blogListSublineStyle}>{item.address || `${item.offer_type || 'angebot'} · ${item.object_type || 'Objekt'}`}</div>
                      <div style={blogListMetaLineStyle}>
                        {item.offer_type || 'angebot'} · {item.object_type || 'Objekt'} · {item.source_updated_at ? new Date(item.source_updated_at).toLocaleDateString('de-DE') : 'ohne Datum'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div style={blogEditorWrapStyle}>
            {selectedPropertyItem ? (
              <>
                <div style={blogEditorHeadStyle}>
                  <div>
                    <h3 style={sectionTabsIntroTitleStyle}>{selectedPropertyItem.title || 'Ohne Titel'}</h3>
                    <p style={blogEditorIntroStyle}>
                      Übersetze hier die objektbezogenen Texte, die derzeit über die deutschen Override-Felder ausgespielt werden. Die deutsche Angebotsbearbeitung bleibt im Bereich „Immobilien“.
                    </p>
                  </div>
                  <span style={blogTranslationBadgeStyle(selectedPropertyItem.translation_is_stale, Boolean(
                    selectedPropertyItem.translated_seo_title.trim()
                    || selectedPropertyItem.translated_seo_description.trim()
                    || selectedPropertyItem.translated_seo_h1.trim()
                    || selectedPropertyItem.translated_short_description.trim()
                    || selectedPropertyItem.translated_long_description.trim()
                    || selectedPropertyItem.translated_location_text.trim()
                    || selectedPropertyItem.translated_features_text.trim()
                    || selectedPropertyItem.translated_highlights.length > 0
                    || selectedPropertyItem.translated_image_alt_texts.length > 0,
                  ))}>
                    {selectedPropertyItem.translation_is_stale ? 'Quelle geändert' : selectedPropertyItem.translation_status}
                  </span>
                </div>

                <div style={blogSummaryGridStyle}>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Objekttyp</span>
                    <strong>{selectedPropertyItem.object_type || 'Objekt'}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Angebotsart</span>
                    <strong>{selectedPropertyItem.offer_type || 'Angebot'}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Übersetzungsstatus</span>
                    <strong>{selectedPropertyItem.translation_status}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Zuletzt aktualisiert</span>
                    <strong>{selectedPropertyItem.translation_updated_at ? new Date(selectedPropertyItem.translation_updated_at).toLocaleString('de-DE') : 'Noch nicht gespeichert'}</strong>
                  </div>
                </div>

                <div style={blogColumnGridStyle}>
                  <div style={blogSourceCardStyle}>
                    <div style={blogColumnHeadStyle}>Deutsch (Quelle)</div>
                    <label style={fieldStyle}>
                      SEO-Titel
                      <input style={inputStyle} value={selectedPropertyItem.source_seo_title} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Meta-Description
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_seo_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      H1
                      <input style={inputStyle} value={selectedPropertyItem.source_seo_h1} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Kurzbeschreibung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_short_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Langbeschreibung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_long_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Lage
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_location_text} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Ausstattung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_features_text} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Highlights
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_highlights.join('\n')} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Bild-Alt-Texte
                      <textarea style={blogReadonlyTextareaStyle} value={selectedPropertyItem.source_image_alt_texts.join('\n')} readOnly />
                    </label>
                  </div>

                  <div style={blogTargetCardStyle}>
                    <div style={blogColumnHeadStyle}>Übersetzung</div>
                    <label style={fieldStyle}>
                      SEO-Titel
                      <input
                        style={inputStyle}
                        value={selectedPropertyItem.translated_seo_title}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_seo_title: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Meta-Description
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_seo_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_seo_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      H1
                      <input
                        style={inputStyle}
                        value={selectedPropertyItem.translated_seo_h1}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_seo_h1: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Kurzbeschreibung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_short_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_short_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Langbeschreibung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_long_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_long_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Lage
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_location_text}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_location_text: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Ausstattung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_features_text}
                        onChange={(e) => {
                          const next = e.target.value;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_features_text: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Highlights
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_highlights.join('\n')}
                        onChange={(e) => {
                          const next = e.target.value.split('\n').map((value) => value.trim()).filter(Boolean);
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_highlights: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Bild-Alt-Texte
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedPropertyItem.translated_image_alt_texts.join('\n')}
                        onChange={(e) => {
                          const next = e.target.value.split('\n').map((value) => value.trim()).filter(Boolean);
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translated_image_alt_texts: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Status
                      <select
                        style={inputStyle}
                        value={selectedPropertyItem.translation_status}
                        onChange={(e) => {
                          const next = e.target.value as BlogTranslationStatus;
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id ? { ...item, translation_status: next } : item
                          )));
                        }}
                      >
                        <option value="draft">Entwurf</option>
                        <option value="approved">Freigegeben</option>
                        <option value="needs_review">Prüfen</option>
                      </select>
                    </label>
                    <div style={blogActionRowStyle}>
                      <button
                        type="button"
                        style={secondaryActionButtonStyle}
                        onClick={() => {
                          setPropertyItems((prev) => prev.map((item) => (
                            item.offer_id === selectedPropertyItem.offer_id
                              ? {
                                  ...item,
                                  translated_seo_title: item.source_seo_title,
                                  translated_seo_description: item.source_seo_description,
                                  translated_seo_h1: item.source_seo_h1,
                                  translated_short_description: item.source_short_description,
                                  translated_long_description: item.source_long_description,
                                  translated_location_text: item.source_location_text,
                                  translated_features_text: item.source_features_text,
                                  translated_highlights: [...item.source_highlights],
                                  translated_image_alt_texts: [...item.source_image_alt_texts],
                                }
                              : item
                          )));
                        }}
                        disabled={propertySaving}
                      >
                        Deutsch übernehmen
                      </button>
                      <button
                        type="button"
                        style={buttonPrimaryStyle(propertyHasEdits && !propertySaving)}
                        onClick={() => void saveSelectedPropertyItem()}
                        disabled={!propertyHasEdits || propertySaving}
                      >
                        {propertySaving ? 'Speichern …' : 'Immobilien-Übersetzung speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={blogEmptyDetailStyle}>Wähle links ein Immobilienangebot, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : activeDomain === 'referenzen' && activeDomainMeta.enabled ? (
      <div style={editorCardStyle}>
        {referenceStatus ? <div style={referenceStatusTone === 'error' ? statusErrorBoxStyle : statusSuccessBoxStyle}>{referenceStatus}</div> : null}
        <div style={blogGridStyle}>
          <aside style={blogListCardStyle}>
            <div style={blogListHeadStyle}>
              <h3 style={sectionTabsIntroTitleStyle}>Referenzobjekte</h3>
              <button
                type="button"
                style={secondaryActionButtonStyle}
                onClick={() => void loadReferenceItems()}
                disabled={referenceLoading || referenceSaving}
              >
                Stand laden
              </button>
            </div>
            <div style={blogListMetaStyle}>
              Für Referenzen werden SEO-, Kurz- und Langtexte je Sprache separat gepflegt.
            </div>
            {referenceItems.length === 0 ? (
              <div style={blogEmptyStateStyle}>Für diesen Partner sind aktuell keine Referenzobjekte vorhanden.</div>
            ) : (
              <div style={blogListWrapStyle}>
                {referenceItems.map((item) => {
                  const translated = Boolean(
                    item.translated_seo_title.trim()
                    || item.translated_seo_description.trim()
                    || item.translated_seo_h1.trim()
                    || item.translated_short_description.trim()
                    || item.translated_long_description.trim()
                    || item.translated_location_text.trim()
                    || item.translated_features_text.trim()
                    || item.translated_highlights.length > 0
                    || item.translated_image_alt_texts.length > 0,
                  );
                  return (
                    <button
                      key={item.reference_id}
                      type="button"
                      style={blogListRowStyle(selectedReferenceItem?.reference_id === item.reference_id)}
                      onClick={() => setSelectedReferenceId(item.reference_id)}
                    >
                      <div style={blogListRowTopStyle}>
                        <strong style={blogListHeadlineStyle}>{item.title || 'Ohne Titel'}</strong>
                        <span style={blogTranslationBadgeStyle(item.translation_is_stale, translated)}>
                          {item.translation_is_stale ? 'Veraltet' : translated ? 'Übersetzt' : 'Fehlt'}
                        </span>
                      </div>
                      <div style={blogListSublineStyle}>{item.region_label || 'Ohne Regionsangabe'}</div>
                      <div style={blogListMetaLineStyle}>
                        {item.source_updated_at ? new Date(item.source_updated_at).toLocaleDateString('de-DE') : 'ohne Datum'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div style={blogEditorWrapStyle}>
            {selectedReferenceItem ? (
              <>
                <div style={blogEditorHeadStyle}>
                  <div>
                    <h3 style={sectionTabsIntroTitleStyle}>{selectedReferenceItem.title || 'Ohne Titel'}</h3>
                    <p style={blogEditorIntroStyle}>
                      Übersetze hier die Referenztexte, die aktuell über die deutschen Override-Felder ausgespielt werden. Die deutsche Bearbeitung bleibt im Bereich „Referenzen“.
                    </p>
                  </div>
                  <span style={blogTranslationBadgeStyle(selectedReferenceItem.translation_is_stale, Boolean(
                    selectedReferenceItem.translated_seo_title.trim()
                    || selectedReferenceItem.translated_seo_description.trim()
                    || selectedReferenceItem.translated_seo_h1.trim()
                    || selectedReferenceItem.translated_short_description.trim()
                    || selectedReferenceItem.translated_long_description.trim()
                    || selectedReferenceItem.translated_location_text.trim()
                    || selectedReferenceItem.translated_features_text.trim()
                    || selectedReferenceItem.translated_highlights.length > 0
                    || selectedReferenceItem.translated_image_alt_texts.length > 0,
                  ))}>
                    {selectedReferenceItem.translation_is_stale ? 'Quelle geändert' : selectedReferenceItem.translation_status}
                  </span>
                </div>

                <div style={blogSummaryGridStyle}>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Region</span>
                    <strong>{selectedReferenceItem.region_label || 'Nicht gesetzt'}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Übersetzungsstatus</span>
                    <strong>{selectedReferenceItem.translation_status}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Zuletzt aktualisiert</span>
                    <strong>{selectedReferenceItem.translation_updated_at ? new Date(selectedReferenceItem.translation_updated_at).toLocaleString('de-DE') : 'Noch nicht gespeichert'}</strong>
                  </div>
                </div>

                <div style={blogColumnGridStyle}>
                  <div style={blogSourceCardStyle}>
                    <div style={blogColumnHeadStyle}>Deutsch (Quelle)</div>
                    <label style={fieldStyle}>
                      SEO-Titel
                      <input style={inputStyle} value={selectedReferenceItem.source_seo_title} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Meta-Description
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_seo_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      H1
                      <input style={inputStyle} value={selectedReferenceItem.source_seo_h1} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Kurzbeschreibung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_short_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Langbeschreibung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_long_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Lage
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_location_text} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Ausstattung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_features_text} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Highlights
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_highlights.join('\n')} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Bild-Alt-Texte
                      <textarea style={blogReadonlyTextareaStyle} value={selectedReferenceItem.source_image_alt_texts.join('\n')} readOnly />
                    </label>
                  </div>

                  <div style={blogTargetCardStyle}>
                    <div style={blogColumnHeadStyle}>Übersetzung</div>
                    <label style={fieldStyle}>
                      SEO-Titel
                      <input
                        style={inputStyle}
                        value={selectedReferenceItem.translated_seo_title}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_seo_title: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Meta-Description
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_seo_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_seo_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      H1
                      <input
                        style={inputStyle}
                        value={selectedReferenceItem.translated_seo_h1}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_seo_h1: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Kurzbeschreibung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_short_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_short_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Langbeschreibung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_long_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_long_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Lage
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_location_text}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_location_text: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Ausstattung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_features_text}
                        onChange={(e) => {
                          const next = e.target.value;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_features_text: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Highlights
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_highlights.join('\n')}
                        onChange={(e) => {
                          const next = e.target.value.split('\n').map((value) => value.trim()).filter(Boolean);
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_highlights: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Bild-Alt-Texte
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedReferenceItem.translated_image_alt_texts.join('\n')}
                        onChange={(e) => {
                          const next = e.target.value.split('\n').map((value) => value.trim()).filter(Boolean);
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translated_image_alt_texts: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Status
                      <select
                        style={inputStyle}
                        value={selectedReferenceItem.translation_status}
                        onChange={(e) => {
                          const next = e.target.value as BlogTranslationStatus;
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id ? { ...item, translation_status: next } : item
                          )));
                        }}
                      >
                        <option value="draft">Entwurf</option>
                        <option value="approved">Freigegeben</option>
                        <option value="needs_review">Prüfen</option>
                      </select>
                    </label>
                    <div style={blogActionRowStyle}>
                      <button
                        type="button"
                        style={secondaryActionButtonStyle}
                        onClick={() => {
                          setReferenceItems((prev) => prev.map((item) => (
                            item.reference_id === selectedReferenceItem.reference_id
                              ? {
                                  ...item,
                                  translated_seo_title: item.source_seo_title,
                                  translated_seo_description: item.source_seo_description,
                                  translated_seo_h1: item.source_seo_h1,
                                  translated_short_description: item.source_short_description,
                                  translated_long_description: item.source_long_description,
                                  translated_location_text: item.source_location_text,
                                  translated_features_text: item.source_features_text,
                                  translated_highlights: [...item.source_highlights],
                                  translated_image_alt_texts: [...item.source_image_alt_texts],
                                }
                              : item
                          )));
                        }}
                        disabled={referenceSaving}
                      >
                        Deutsch übernehmen
                      </button>
                      <button
                        type="button"
                        style={buttonPrimaryStyle(referenceHasEdits && !referenceSaving)}
                        onClick={() => void saveSelectedReferenceItem()}
                        disabled={!referenceHasEdits || referenceSaving}
                      >
                        {referenceSaving ? 'Speichern …' : 'Referenz-Übersetzung speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={blogEmptyDetailStyle}>Wähle links ein Referenzobjekt, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : activeDomain === 'gesuche' && activeDomainMeta.enabled ? (
      <div style={editorCardStyle}>
        {requestStatus ? <div style={requestStatusTone === 'error' ? statusErrorBoxStyle : statusSuccessBoxStyle}>{requestStatus}</div> : null}
        <div style={blogGridStyle}>
          <aside style={blogListCardStyle}>
            <div style={blogListHeadStyle}>
              <h3 style={sectionTabsIntroTitleStyle}>Gesuche</h3>
              <button
                type="button"
                style={secondaryActionButtonStyle}
                onClick={() => void loadRequestItems()}
                disabled={requestLoading || requestSaving}
              >
                Stand laden
              </button>
            </div>
            <div style={blogListMetaStyle}>
              Für Gesuche werden SEO-, Kurz- und Langtexte je Sprache separat gepflegt.
            </div>
            {requestItems.length === 0 ? (
              <div style={blogEmptyStateStyle}>Für diesen Partner sind aktuell keine Gesuche vorhanden.</div>
            ) : (
              <div style={blogListWrapStyle}>
                {requestItems.map((item) => {
                  const translated = Boolean(
                    item.translated_seo_title.trim()
                    || item.translated_seo_description.trim()
                    || item.translated_seo_h1.trim()
                    || item.translated_short_description.trim()
                    || item.translated_long_description.trim()
                    || item.translated_location_text.trim()
                    || item.translated_features_text.trim()
                    || item.translated_highlights.length > 0
                    || item.translated_image_alt_texts.length > 0,
                  );
                  return (
                    <button
                      key={item.request_id}
                      type="button"
                      style={blogListRowStyle(selectedRequestItem?.request_id === item.request_id)}
                      onClick={() => setSelectedRequestId(item.request_id)}
                    >
                      <div style={blogListRowTopStyle}>
                        <strong style={blogListHeadlineStyle}>{item.title || 'Ohne Titel'}</strong>
                        <span style={blogTranslationBadgeStyle(item.translation_is_stale, translated)}>
                          {item.translation_is_stale ? 'Veraltet' : translated ? 'Übersetzt' : 'Fehlt'}
                        </span>
                      </div>
                      <div style={blogListSublineStyle}>{item.region_label || 'Ohne Zielregion'}</div>
                      <div style={blogListMetaLineStyle}>
                        {(item.request_type || 'Gesuch')} · {(item.object_type || 'Objekt')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div style={blogEditorWrapStyle}>
            {selectedRequestItem ? (
              <>
                <div style={blogEditorHeadStyle}>
                  <div>
                    <h3 style={sectionTabsIntroTitleStyle}>{selectedRequestItem.title || 'Ohne Titel'}</h3>
                    <p style={blogEditorIntroStyle}>
                      Übersetze hier die Gesuchstexte, die aktuell über die deutschen Override-Felder ausgespielt werden. Die deutsche Bearbeitung bleibt im Bereich „Gesuche“.
                    </p>
                  </div>
                  <span style={blogTranslationBadgeStyle(selectedRequestItem.translation_is_stale, Boolean(
                    selectedRequestItem.translated_seo_title.trim()
                    || selectedRequestItem.translated_seo_description.trim()
                    || selectedRequestItem.translated_seo_h1.trim()
                    || selectedRequestItem.translated_short_description.trim()
                    || selectedRequestItem.translated_long_description.trim()
                    || selectedRequestItem.translated_location_text.trim()
                    || selectedRequestItem.translated_features_text.trim()
                    || selectedRequestItem.translated_highlights.length > 0
                    || selectedRequestItem.translated_image_alt_texts.length > 0,
                  ))}>
                    {selectedRequestItem.translation_is_stale ? 'Quelle geändert' : selectedRequestItem.translation_status}
                  </span>
                </div>

                <div style={blogSummaryGridStyle}>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Gesuchstyp</span>
                    <strong>{selectedRequestItem.request_type || 'Nicht gesetzt'}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Objekttyp</span>
                    <strong>{selectedRequestItem.object_type || 'Nicht gesetzt'}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Zielregion</span>
                    <strong>{selectedRequestItem.region_label || 'Nicht gesetzt'}</strong>
                  </div>
                  <div style={blogSummaryItemStyle}>
                    <span style={estimateLabelStyle}>Übersetzungsstatus</span>
                    <strong>{selectedRequestItem.translation_status}</strong>
                  </div>
                </div>

                <div style={blogColumnGridStyle}>
                  <div style={blogSourceCardStyle}>
                    <div style={blogColumnHeadStyle}>Deutsch (Quelle)</div>
                    <label style={fieldStyle}>
                      SEO-Titel
                      <input style={inputStyle} value={selectedRequestItem.source_seo_title} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Meta-Description
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_seo_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      H1
                      <input style={inputStyle} value={selectedRequestItem.source_seo_h1} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Kurzbeschreibung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_short_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Langbeschreibung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_long_description} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Lage
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_location_text} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Ausstattung
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_features_text} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Highlights
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_highlights.join('\n')} readOnly />
                    </label>
                    <label style={fieldStyle}>
                      Bild-Alt-Texte
                      <textarea style={blogReadonlyTextareaStyle} value={selectedRequestItem.source_image_alt_texts.join('\n')} readOnly />
                    </label>
                  </div>

                  <div style={blogTargetCardStyle}>
                    <div style={blogColumnHeadStyle}>Übersetzung</div>
                    <label style={fieldStyle}>
                      SEO-Titel
                      <input
                        style={inputStyle}
                        value={selectedRequestItem.translated_seo_title}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_seo_title: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Meta-Description
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_seo_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_seo_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      H1
                      <input
                        style={inputStyle}
                        value={selectedRequestItem.translated_seo_h1}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_seo_h1: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Kurzbeschreibung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_short_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_short_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Langbeschreibung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_long_description}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_long_description: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Lage
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_location_text}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_location_text: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Ausstattung
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_features_text}
                        onChange={(e) => {
                          const next = e.target.value;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_features_text: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Highlights
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_highlights.join('\n')}
                        onChange={(e) => {
                          const next = e.target.value.split('\n').map((value) => value.trim()).filter(Boolean);
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_highlights: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Bild-Alt-Texte
                      <textarea
                        style={blogTextareaStyle}
                        value={selectedRequestItem.translated_image_alt_texts.join('\n')}
                        onChange={(e) => {
                          const next = e.target.value.split('\n').map((value) => value.trim()).filter(Boolean);
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translated_image_alt_texts: next } : item
                          )));
                        }}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Status
                      <select
                        style={inputStyle}
                        value={selectedRequestItem.translation_status}
                        onChange={(e) => {
                          const next = e.target.value as BlogTranslationStatus;
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id ? { ...item, translation_status: next } : item
                          )));
                        }}
                      >
                        <option value="draft">Entwurf</option>
                        <option value="approved">Freigegeben</option>
                        <option value="needs_review">Prüfen</option>
                      </select>
                    </label>
                    <div style={blogActionRowStyle}>
                      <button
                        type="button"
                        style={secondaryActionButtonStyle}
                        onClick={() => {
                          setRequestItems((prev) => prev.map((item) => (
                            item.request_id === selectedRequestItem.request_id
                              ? {
                                  ...item,
                                  translated_seo_title: item.source_seo_title,
                                  translated_seo_description: item.source_seo_description,
                                  translated_seo_h1: item.source_seo_h1,
                                  translated_short_description: item.source_short_description,
                                  translated_long_description: item.source_long_description,
                                  translated_location_text: item.source_location_text,
                                  translated_features_text: item.source_features_text,
                                  translated_highlights: [...item.source_highlights],
                                  translated_image_alt_texts: [...item.source_image_alt_texts],
                                }
                              : item
                          )));
                        }}
                        disabled={requestSaving}
                      >
                        Deutsch übernehmen
                      </button>
                      <button
                        type="button"
                        style={buttonPrimaryStyle(requestHasEdits && !requestSaving)}
                        onClick={() => void saveSelectedRequestItem()}
                        disabled={!requestHasEdits || requestSaving}
                      >
                        {requestSaving ? 'Speichern …' : 'Gesuche-Übersetzung speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={blogEmptyDetailStyle}>Wähle links ein Gesuch, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : (
      <div style={editorCardStyle}>
        <div style={domainPlaceholderCardStyle}>
          <div style={domainPlaceholderHeadStyle}>
            <div>
              <h3 style={sectionTabsIntroTitleStyle}>{activeDomainMeta.label}</h3>
              <p style={domainPlaceholderTextStyle}>{activeDomainMeta.description}</p>
            </div>
            <span style={domainPlaceholderBadgeStyle(activeDomainMeta.enabled)}>
              {activeDomainMeta.enabled ? 'Anbindung folgt' : 'Nicht freigeschaltet'}
            </span>
          </div>
          <div style={domainPlaceholderGridStyle}>
            <div style={domainPlaceholderItemStyle}>
              <span style={estimateLabelStyle}>Status</span>
              <strong>{activeDomainMeta.enabled ? 'Produktbereich wird als eigener I18N-Workflow vorbereitet.' : 'Produkt ist für diesen Partner aktuell nicht freigeschaltet.'}</strong>
            </div>
            <div style={domainPlaceholderItemStyle}>
              <span style={estimateLabelStyle}>Nächster Ausbau</span>
              <strong>Datensatzbasierte Sprachpflege inkl. Status, Kosten und Aktualität.</strong>
            </div>
          </div>
          <div style={qualityCheckBoxStyle(false)}>
            <strong>Produktbereich in Vorbereitung</strong>
            <span>
              {activeDomainMeta.enabled
                ? 'Die Tab-Struktur ist bereits vorbereitet. Die eigentliche Übersetzungslogik für diesen Bereich wird im nächsten Schritt separat an Datenmodell und UI angebunden.'
                : 'Sobald das Produkt freigeschaltet ist, kann hier die passende Sprachpflege mit eigenem Workflow eingebunden werden.'}
            </span>
          </div>
        </div>
      </div>
      )}
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
  border: '1px solid rgb(72, 107, 122)',
  borderRadius: 12,
  background: 'rgb(72, 107, 122)',
  padding: 14,
  display: 'grid',
  gap: 10,
};

const controlsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 280px))',
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

const workflowStatusSuccessStyle: React.CSSProperties = {
  ...statusSuccessBoxStyle,
  maxWidth: 420,
  padding: 0,
  fontSize: 11,
  lineHeight: 1.4,
  border: 'none',
  background: 'transparent',
};

const workflowStatusErrorStyle: React.CSSProperties = {
  ...statusErrorBoxStyle,
  maxWidth: 420,
  padding: '8px 10px',
  fontSize: 11,
  lineHeight: 1.4,
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

const editorCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#ffffff',
  padding: 14,
  marginTop: 6,
  display: 'grid',
  gap: 8,
};

const workflowInlineControlsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
};

const workflowScopeHintStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#0f172a',
  lineHeight: 1.35,
  maxWidth: 360,
};

const workflowClassBadgeStyle = (displayClass: DisplayTextClass): React.CSSProperties => ({
  ...displayTextBadgeStyle(displayClass),
  fontSize: 16,
  lineHeight: 1,
  padding: '10px 20px',
  borderRadius: 999,
  fontWeight: 700,
  letterSpacing: '0.01em',
});

const classCardCountStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#0f172a',
};

const estimateLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const promptToggleStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  color: 'rgb(72, 107, 122)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};

const promptPanelStyle: React.CSSProperties = {
  marginTop: 10,
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 12,
  backgroundColor: '#f8fafc',
  display: 'grid',
  gap: 10,
};

const promptLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  fontWeight: 700,
};

const promptContentStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#475569',
  lineHeight: 1.5,
};

const promptInputLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  color: '#1e293b',
};

const promptInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 80,
  padding: 10,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  lineHeight: 1.4,
  fontFamily: 'inherit',
  resize: 'vertical',
  background: '#ffffff',
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

const blogGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)',
  gap: 16,
  alignItems: 'start',
};

const blogListCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};

const blogListHeadStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const blogListMetaStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: '#64748b',
};

const blogListWrapStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
};

const blogListRowStyle = (active: boolean): React.CSSProperties => ({
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 12,
  border: active ? '1px solid #93c5fd' : '1px solid #e2e8f0',
  background: active ? '#eff6ff' : '#ffffff',
  textAlign: 'left',
  boxShadow: active ? '0 10px 20px rgba(37, 99, 235, 0.08)' : 'none',
  cursor: 'pointer',
});

const blogListRowTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
};

const blogListHeadlineStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#0f172a',
};

const blogListSublineStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#475569',
  lineHeight: 1.45,
};

const scopeAreaTypeBadgeStyle = (isDistrictItem: boolean): React.CSSProperties => ({
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  background: isDistrictItem ? '#e2e8f0' : '#f1f5f9',
  color: '#475569',
});

const blogListMetaLineStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
};

const blogTranslationBadgeStyle = (stale: boolean, translated: boolean): React.CSSProperties => ({
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  background: stale ? '#fef3c7' : translated ? '#dcfce7' : '#e2e8f0',
  color: stale ? '#92400e' : translated ? '#166534' : '#475569',
});

const blogEditorWrapStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
};

const blogEditorHeadStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
};

const blogEditorIntroStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 13,
  lineHeight: 1.55,
  color: '#64748b',
  maxWidth: 760,
};

const blogSummaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
};

const blogSummaryItemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #dbeafe',
  background: '#ffffff',
};

const blogColumnGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
};

const blogSourceCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};

const blogTargetCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 16,
  border: '1px solid #dbeafe',
  background: '#ffffff',
};

const blogColumnHeadStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#0f172a',
};

const blogReadonlyTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 260,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  fontSize: 12,
  lineHeight: 1.5,
  color: '#475569',
  resize: 'vertical',
};

const blogTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 260,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: '#fff',
  fontSize: 13,
  lineHeight: 1.55,
  color: '#0f172a',
  resize: 'vertical',
};

const blogActionRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
};

const blogEmptyStateStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: '1px dashed #cbd5e1',
  background: '#fff',
  fontSize: 12,
  color: '#64748b',
};

const blogEmptyDetailStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 16,
  border: '1px dashed #cbd5e1',
  background: '#ffffff',
  fontSize: 14,
  color: '#64748b',
  lineHeight: 1.6,
};

const domainTabGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const domainTabStyle = (active: boolean): React.CSSProperties => ({
  borderRadius: 16,
  border: active ? '1px solid rgba(15, 23, 42, 0.18)' : '1px solid #e2e8f0',
  background: active ? 'rgb(255, 224, 0)' : '#fff',
  padding: '14px 16px',
  display: 'grid',
  gap: 6,
  textAlign: 'left',
  boxShadow: active ? 'none' : '0 10px 24px rgba(15, 23, 42, 0.06)',
  cursor: 'pointer',
});

const domainTabTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
};

const domainTabTitleStyle: React.CSSProperties = {
  fontSize: 15,
  color: '#0f172a',
};

const domainTabStatusDotStyle = (enabled: boolean): React.CSSProperties => ({
  borderRadius: 999,
  width: 10,
  height: 10,
  flex: '0 0 auto',
  background: enabled ? '#16a34a' : '#dc2626',
  boxShadow: enabled ? '0 0 0 4px rgba(22, 163, 74, 0.12)' : '0 0 0 4px rgba(220, 38, 38, 0.1)',
});

const domainPlaceholderCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 20,
  borderRadius: 16,
  border: '1px dashed #cbd5e1',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const domainPlaceholderHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};

const domainPlaceholderBadgeStyle = (enabled: boolean): React.CSSProperties => ({
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  background: enabled ? '#dcfce7' : '#e2e8f0',
  color: enabled ? '#166534' : '#475569',
  alignSelf: 'flex-start',
});

const domainPlaceholderTextStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 14,
  lineHeight: 1.65,
  color: '#475569',
  maxWidth: 760,
};

const domainPlaceholderGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const domainPlaceholderItemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#0f172a',
};

const workflowConfirmOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  background: 'rgba(15, 23, 42, 0.52)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const workflowConfirmCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  borderRadius: 18,
  background: '#ffffff',
  border: '1px solid #fde68a',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
  padding: '22px 22px 18px',
  display: 'grid',
  gap: 14,
};

const workflowConfirmTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  color: '#0f172a',
};

const workflowConfirmTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: '#334155',
};

const workflowConfirmActionRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
};

const workflowConfirmCancelButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 999,
  background: '#ffffff',
  color: '#334155',
  height: 40,
  padding: '0 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const workflowConfirmProceedButtonStyle: React.CSSProperties = {
  border: '1px solid #facc15',
  borderRadius: 999,
  background: '#facc15',
  color: '#0f172a',
  height: 40,
  padding: '0 16px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
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
