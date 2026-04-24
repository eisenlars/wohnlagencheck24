'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import { createClient } from '@/utils/supabase/client';
import {
  resolveDisplayTextClass,
  displayTextClassLabel,
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
import { formatRequestModeLabel, formatRequestObjectTypeLabel } from '@/lib/request-labels';
import WorkspacePillTabs from './WorkspacePillTabs';
import workspaceStyles from './styles/workspace.module.css';
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

type BlogBaseline = {
  translated_headline: string;
  translated_subline: string;
  translated_body_md: string;
  translation_status: BlogTranslationStatus;
};

type BlogFieldDefinition = {
  key: string;
  label: string;
  sourceKey: keyof BlogTranslationItem;
  targetKey: keyof BlogBaseline;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
};

const BLOG_FIELD_DEFINITIONS: BlogFieldDefinition[] = [
  {
    key: 'headline',
    label: 'Headline',
    sourceKey: 'headline',
    targetKey: 'translated_headline',
    placeholder: 'Headline in der Zielsprache',
  },
  {
    key: 'subline',
    label: 'Subline',
    sourceKey: 'subline',
    targetKey: 'translated_subline',
    placeholder: 'Subline in der Zielsprache',
  },
  {
    key: 'body_md',
    label: 'Markdown-Text',
    sourceKey: 'body_md',
    targetKey: 'translated_body_md',
    multiline: true,
    rows: 12,
    placeholder: 'Markdown-Text in der Zielsprache',
  },
];

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
  answer_summary?: string | null;
  location_summary?: string | null;
  target_audience?: string | null;
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
  translated_answer_summary: string | null;
  translated_location_summary: string | null;
  translated_target_audience: string | null;
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
  source_answer_summary: string;
  source_location_summary: string;
  source_target_audience: string;
  source_highlights: string[];
  source_image_alt_texts: string[];
  translated_seo_title: string;
  translated_seo_description: string;
  translated_seo_h1: string;
  translated_short_description: string;
  translated_long_description: string;
  translated_location_text: string;
  translated_features_text: string;
  translated_answer_summary: string;
  translated_location_summary: string;
  translated_target_audience: string;
  translated_highlights: string[];
  translated_image_alt_texts: string[];
  translation_status: BlogTranslationStatus;
  translation_id: string | null;
  translation_updated_at: string | null;
  translation_is_stale: boolean;
};

type PropertyEditorTab = 'texts' | 'seo';
type PropertyComputedStatus = 'open' | 'in_progress' | 'translated';

type PropertyFieldDefinition = {
  key: string;
  label: string;
  tab: PropertyEditorTab;
  sourceKey: keyof PropertyOfferTranslationItem;
  targetKey: keyof PropertyOfferTranslationItem;
  displayClass: DisplayTextClass;
  multiline?: boolean;
  list?: boolean;
  placeholder?: string;
};

const PROPERTY_FIELD_DEFINITIONS: PropertyFieldDefinition[] = [
  {
    key: 'seo_h1',
    label: 'H1',
    tab: 'texts',
    sourceKey: 'source_seo_h1',
    targetKey: 'translated_seo_h1',
    displayClass: 'general',
  },
  {
    key: 'short_description',
    label: 'Kurzbeschreibung',
    tab: 'texts',
    sourceKey: 'source_short_description',
    targetKey: 'translated_short_description',
    displayClass: 'general',
    multiline: true,
  },
  {
    key: 'long_description',
    label: 'Langbeschreibung',
    tab: 'texts',
    sourceKey: 'source_long_description',
    targetKey: 'translated_long_description',
    displayClass: 'general',
    multiline: true,
  },
  {
    key: 'location_text',
    label: 'Lage',
    tab: 'texts',
    sourceKey: 'source_location_text',
    targetKey: 'translated_location_text',
    displayClass: 'general',
    multiline: true,
  },
  {
    key: 'features_text',
    label: 'Ausstattung',
    tab: 'texts',
    sourceKey: 'source_features_text',
    targetKey: 'translated_features_text',
    displayClass: 'general',
    multiline: true,
  },
  {
    key: 'seo_title',
    label: 'SEO-Titel',
    tab: 'seo',
    sourceKey: 'source_seo_title',
    targetKey: 'translated_seo_title',
    displayClass: 'marketing',
  },
  {
    key: 'seo_description',
    label: 'Meta-Description',
    tab: 'seo',
    sourceKey: 'source_seo_description',
    targetKey: 'translated_seo_description',
    displayClass: 'marketing',
    multiline: true,
  },
  {
    key: 'answer_summary',
    label: 'Kurzantwort',
    tab: 'seo',
    sourceKey: 'source_answer_summary',
    targetKey: 'translated_answer_summary',
    displayClass: 'marketing',
    multiline: true,
  },
  {
    key: 'location_summary',
    label: 'Lage in Kürze',
    tab: 'seo',
    sourceKey: 'source_location_summary',
    targetKey: 'translated_location_summary',
    displayClass: 'marketing',
    multiline: true,
  },
  {
    key: 'target_audience',
    label: 'Geeignet für',
    tab: 'seo',
    sourceKey: 'source_target_audience',
    targetKey: 'translated_target_audience',
    displayClass: 'marketing',
    placeholder: 'z. B. Kapitalanleger, Paar, kleine Familie',
  },
  {
    key: 'highlights',
    label: 'Highlights',
    tab: 'seo',
    sourceKey: 'source_highlights',
    targetKey: 'translated_highlights',
    displayClass: 'marketing',
    multiline: true,
    list: true,
  },
  {
    key: 'image_alt_texts',
    label: 'Bild-Alt-Texte',
    tab: 'seo',
    sourceKey: 'source_image_alt_texts',
    targetKey: 'translated_image_alt_texts',
    displayClass: 'marketing',
    multiline: true,
    list: true,
  },
];

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

type ReferenceBaseline = {
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
};

type ReferenceFieldDefinition = {
  key: string;
  label: string;
  sourceKey: keyof ReferenceTranslationItem;
  targetKey: keyof ReferenceBaseline;
  multiline?: boolean;
  list?: boolean;
  placeholder?: string;
};

const REFERENCE_FIELD_DEFINITIONS: ReferenceFieldDefinition[] = [
  {
    key: 'seo_title',
    label: 'SEO-Titel',
    sourceKey: 'source_seo_title',
    targetKey: 'translated_seo_title',
    placeholder: 'SEO-Titel in der Zielsprache',
  },
  {
    key: 'seo_description',
    label: 'Meta-Description',
    sourceKey: 'source_seo_description',
    targetKey: 'translated_seo_description',
    multiline: true,
    placeholder: 'Meta-Description in der Zielsprache',
  },
  {
    key: 'seo_h1',
    label: 'H1',
    sourceKey: 'source_seo_h1',
    targetKey: 'translated_seo_h1',
    placeholder: 'H1 in der Zielsprache',
  },
  {
    key: 'short_description',
    label: 'Kurzbeschreibung',
    sourceKey: 'source_short_description',
    targetKey: 'translated_short_description',
    multiline: true,
    placeholder: 'Kurzbeschreibung in der Zielsprache',
  },
  {
    key: 'long_description',
    label: 'Langbeschreibung',
    sourceKey: 'source_long_description',
    targetKey: 'translated_long_description',
    multiline: true,
    placeholder: 'Langbeschreibung in der Zielsprache',
  },
  {
    key: 'location_text',
    label: 'Lage',
    sourceKey: 'source_location_text',
    targetKey: 'translated_location_text',
    multiline: true,
    placeholder: 'Lagetext in der Zielsprache',
  },
  {
    key: 'features_text',
    label: 'Ausstattung',
    sourceKey: 'source_features_text',
    targetKey: 'translated_features_text',
    multiline: true,
    placeholder: 'Ausstattung in der Zielsprache',
  },
  {
    key: 'highlights',
    label: 'Highlights',
    sourceKey: 'source_highlights',
    targetKey: 'translated_highlights',
    multiline: true,
    list: true,
    placeholder: 'Eine Zeile pro Highlight',
  },
  {
    key: 'image_alt_texts',
    label: 'Bild-Alt-Texte',
    sourceKey: 'source_image_alt_texts',
    targetKey: 'translated_image_alt_texts',
    multiline: true,
    list: true,
    placeholder: 'Eine Zeile pro Bild-Alt-Text',
  },
];

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
  source_note: string;
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

type RequestBaseline = {
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
};

type RequestLoadDebug = {
  requests: number;
  overrides: number;
  translations: number;
};

type RequestEditorTab = 'texts' | 'seo';
type RequestListFilter = 'all' | 'haus' | 'wohnung';

type RequestFieldDefinition = {
  key: string;
  label: string;
  tab: RequestEditorTab;
  sourceKey: keyof RequestTranslationItem;
  targetKey: keyof RequestBaseline;
  multiline?: boolean;
  placeholder?: string;
};

const REQUEST_FIELD_DEFINITIONS: RequestFieldDefinition[] = [
  {
    key: 'seo_h1',
    label: 'Gesuch-Titel',
    tab: 'texts',
    sourceKey: 'source_seo_h1',
    targetKey: 'translated_seo_h1',
    placeholder: 'Gesuch-Titel in der Zielsprache',
  },
  {
    key: 'long_description',
    label: 'Beschreibung',
    tab: 'texts',
    sourceKey: 'source_long_description',
    targetKey: 'translated_long_description',
    multiline: true,
    placeholder: 'Beschreibung in der Zielsprache',
  },
  {
    key: 'seo_title',
    label: 'SEO-Titel',
    tab: 'seo',
    sourceKey: 'source_seo_title',
    targetKey: 'translated_seo_title',
    placeholder: 'SEO-Titel in der Zielsprache',
  },
  {
    key: 'seo_description',
    label: 'SEO-Description',
    tab: 'seo',
    sourceKey: 'source_seo_description',
    targetKey: 'translated_seo_description',
    multiline: true,
    placeholder: 'SEO-Description in der Zielsprache',
  },
];

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
    { key: 'berater_ausbildung', label: 'Meine Qualifikation & Erfahrung', type: 'individual' },
  ],
  makler: [
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
    { key: 'mietrendite_kaufpreisfaktor', label: 'Kaufpreisfaktor Info', type: 'data_driven' },
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
    const value = readTextValue(payload[key]);
    if (value) return value;
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
const LOCAL_SITE_WORKFLOW_CLASSES: DisplayTextClass[] = ['market_expert', 'data_driven', 'general'];
const MARKETING_WORKFLOW_CLASSES: DisplayTextClass[] = ['marketing'];
const ORTSLAGE_HIDDEN_TAB_IDS = new Set(['berater', 'makler', 'marktueberblick']);

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
  const setLocale = useCallback((nextLocale: string) => {
    setI18nViewState((prev) => ({ ...prev, locale: nextLocale }));
  }, [setI18nViewState]);
  const channel = (i18nViewState.channel ?? 'portal') as I18nChannel;
  const setChannel = useCallback((nextChannel: I18nChannel) => {
    setI18nViewState((prev) => ({ ...prev, channel: nextChannel }));
  }, [setI18nViewState]);
  const scope = (i18nViewState.scope ?? 'current_area') as I18nScope;
  const setScope = useCallback((nextScope: I18nScope) => {
    setI18nViewState((prev) => ({ ...prev, scope: nextScope }));
  }, [setI18nViewState]);
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
  const setActiveTab = useCallback((nextTab: string) => {
    setI18nViewState((prev) => ({ ...prev, activeTab: nextTab }));
  }, [setI18nViewState]);
  const activeClass = (i18nViewState.activeClass ?? 'general') as DisplayTextClass;
  const setActiveClass = useCallback((nextClass: DisplayTextClass) => {
    setI18nViewState((prev) => ({ ...prev, activeClass: nextClass }));
  }, [setI18nViewState]);
  const activeDomain = (i18nViewState.activeDomain ?? 'immobilienmarkt') as I18nProductDomainId;
  const setActiveDomain = useCallback((nextDomain: I18nProductDomainId) => {
    setI18nViewState((prev) => ({ ...prev, activeDomain: nextDomain }));
  }, [setI18nViewState]);
  const selectedScopeAreaId = String(i18nViewState.selectedScopeAreaId ?? '');
  const setSelectedScopeAreaId = useCallback((nextAreaId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedScopeAreaId: nextAreaId }));
  }, [setI18nViewState]);
  const selectedBlogPostId = String(i18nViewState.selectedBlogPostId ?? '');
  const setSelectedBlogPostId = useCallback((postId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedBlogPostId: postId }));
  }, [setI18nViewState]);
  const selectedPropertyOfferId = String(i18nViewState.selectedPropertyOfferId ?? '');
  const setSelectedPropertyOfferId = useCallback((offerId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedPropertyOfferId: offerId }));
  }, [setI18nViewState]);
  const selectedReferenceId = String(i18nViewState.selectedReferenceId ?? '');
  const setSelectedReferenceId = useCallback((referenceId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedReferenceId: referenceId }));
  }, [setI18nViewState]);
  const selectedRequestId = String(i18nViewState.selectedRequestId ?? '');
  const setSelectedRequestId = useCallback((requestId: string) => {
    setI18nViewState((prev) => ({ ...prev, selectedRequestId: requestId }));
  }, [setI18nViewState]);
  const [llmOptions, setLlmOptions] = useState<LlmOption[]>([]);
  const [selectedLlmOptionId, setSelectedLlmOptionId] = useState<string>('');
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);
  const [baselineByKey, setBaselineByKey] = useState<Record<string, string>>({});
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(null);
  const [blogItems, setBlogItems] = useState<BlogTranslationItem[]>([]);
  const [blogBaselineByPostId, setBlogBaselineByPostId] = useState<Record<string, BlogBaseline>>({});
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
    translated_answer_summary: string;
    translated_location_summary: string;
    translated_target_audience: string;
    translated_highlights: string[];
    translated_image_alt_texts: string[];
    translation_status: BlogTranslationStatus;
  }>>({});
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyStatus, setPropertyStatus] = useState<string | null>(null);
  const [propertyStatusTone, setPropertyStatusTone] = useState<'success' | 'error' | null>(null);
  const [propertyEditorTab, setPropertyEditorTab] = useState<PropertyEditorTab>('texts');
  const [requestEditorTab, setRequestEditorTab] = useState<RequestEditorTab>('texts');
  const [propertyAiKey, setPropertyAiKey] = useState<string | null>(null);
  const [propertyBulkAiRunning, setPropertyBulkAiRunning] = useState(false);
  const [requestAiKey, setRequestAiKey] = useState<string | null>(null);
  const [requestPromptOpenMap, setRequestPromptOpenMap] = useState<Record<string, boolean>>({});
  const [requestCustomPromptMap, setRequestCustomPromptMap] = useState<Record<string, string>>({});
  const [referenceItems, setReferenceItems] = useState<ReferenceTranslationItem[]>([]);
  const [referenceBaselineById, setReferenceBaselineById] = useState<Record<string, ReferenceBaseline>>({});
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceSaving, setReferenceSaving] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  const [referenceStatusTone, setReferenceStatusTone] = useState<'success' | 'error' | null>(null);
  const [requestItems, setRequestItems] = useState<RequestTranslationItem[]>([]);
  const [requestBaselineById, setRequestBaselineById] = useState<Record<string, RequestBaseline>>({});
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requestStatusTone, setRequestStatusTone] = useState<'success' | 'error' | null>(null);
  const [requestListSearch, setRequestListSearch] = useState('');
  const [requestListFilter, setRequestListFilter] = useState<RequestListFilter>('all');
  const [requestLoadSummary, setRequestLoadSummary] = useState<string | null>(null);
  const [requestLoadDebug, setRequestLoadDebug] = useState<RequestLoadDebug | null>(null);
  const [requestDebugOpen, setRequestDebugOpen] = useState(false);
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
  const filteredRequestItems = useMemo(() => {
    const query = requestListSearch.trim().toLowerCase();
    return requestItems.filter((item) => {
      const objectType = String(item.object_type ?? '').trim().toLowerCase();
      if (requestListFilter === 'haus' && objectType !== 'haus') return false;
      if (requestListFilter === 'wohnung' && objectType !== 'wohnung') return false;
      if (!query) return true;
      const haystack = `${item.title} ${item.region_label} ${item.request_type} ${item.object_type}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [requestItems, requestListFilter, requestListSearch]);
  const selectedRequestItem = useMemo(
    () => filteredRequestItems.find((item) => item.request_id === selectedRequestId) ?? filteredRequestItems[0] ?? null,
    [filteredRequestItems, selectedRequestId],
  );
  const requestVisibleFieldDefinitions = useMemo(
    () => REQUEST_FIELD_DEFINITIONS.filter((definition) => definition.tab === requestEditorTab),
    [requestEditorTab],
  );

  useEffect(() => {
    if (locales.includes(locale)) return;
    setLocale(locales[0] ?? 'en');
  }, [locales, locale, setLocale]);

  useEffect(() => {
    if (productDomains.some((domain) => domain.id === activeDomain)) return;
    setActiveDomain(productDomains[0]?.id ?? 'immobilienmarkt');
  }, [activeDomain, productDomains, setActiveDomain]);

  useEffect(() => {
    if (blogItems.length === 0) {
      if (selectedBlogPostId) setSelectedBlogPostId('');
      return;
    }
    if (blogItems.some((item) => item.post_id === selectedBlogPostId)) return;
    setSelectedBlogPostId(blogItems[0]?.post_id ?? '');
  }, [blogItems, selectedBlogPostId, setSelectedBlogPostId]);

  useEffect(() => {
    if (propertyItems.length === 0) {
      if (selectedPropertyOfferId) setSelectedPropertyOfferId('');
      return;
    }
    if (propertyItems.some((item) => item.offer_id === selectedPropertyOfferId)) return;
    setSelectedPropertyOfferId(propertyItems[0]?.offer_id ?? '');
  }, [propertyItems, selectedPropertyOfferId, setSelectedPropertyOfferId]);

  useEffect(() => {
    if (referenceItems.length === 0) {
      if (selectedReferenceId) setSelectedReferenceId('');
      return;
    }
    if (referenceItems.some((item) => item.reference_id === selectedReferenceId)) return;
    setSelectedReferenceId(referenceItems[0]?.reference_id ?? '');
  }, [referenceItems, selectedReferenceId, setSelectedReferenceId]);

  useEffect(() => {
    if (filteredRequestItems.length === 0) {
      if (selectedRequestId) setSelectedRequestId('');
      return;
    }
    if (filteredRequestItems.some((item) => item.request_id === selectedRequestId)) return;
    setSelectedRequestId(filteredRequestItems[0]?.request_id ?? '');
  }, [filteredRequestItems, selectedRequestId, setSelectedRequestId]);

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
          .select('partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, answer_summary, location_summary, target_audience, highlights, image_alt_texts')
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
          .select('id, offer_id, source, external_id, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_answer_summary, translated_location_summary, translated_target_audience, translated_highlights, translated_image_alt_texts, status, source_snapshot_hash, source_last_updated, updated_at')
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
        const rawDescription = readTextValue(raw.description) ?? '';
        const rawLongDescription = readTextValue(raw.long_description) ?? rawDescription;
        const rawLocation = readTextValue(raw.location) ?? rawDescription;
        const rawFeatures = readTextValue(raw.features_note) ?? '';
        const rawHighlights = toStringArray(raw.highlights);
        const rawImageAltTexts = toStringArray(raw.image_alt_texts);
        const sourceSeoTitle = String(override?.seo_title ?? offer.title ?? '');
        const sourceSeoDescription = String(override?.seo_description ?? rawDescription ?? '');
        const sourceSeoH1 = String(override?.seo_h1 ?? offer.title ?? '');
        const sourceShortDescription = String(override?.short_description ?? rawDescription ?? '');
        const sourceLongDescription = String(override?.long_description ?? rawLongDescription ?? '');
        const sourceLocationText = String(override?.location_text ?? rawLocation ?? '');
        const sourceFeaturesText = String(override?.features_text ?? rawFeatures ?? '');
        const sourceAnswerSummary = String(override?.answer_summary ?? sourceShortDescription ?? '');
        const sourceLocationSummary = String(override?.location_summary ?? sourceLocationText ?? '');
        const sourceTargetAudience = String(override?.target_audience ?? '');
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
          sourceAnswerSummary,
          sourceLocationSummary,
          sourceTargetAudience,
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
          source_answer_summary: sourceAnswerSummary,
          source_location_summary: sourceLocationSummary,
          source_target_audience: sourceTargetAudience,
          source_highlights: sourceHighlights,
          source_image_alt_texts: sourceImageAltTexts,
          translated_seo_title: String(translation?.translated_seo_title ?? ''),
          translated_seo_description: String(translation?.translated_seo_description ?? ''),
          translated_seo_h1: String(translation?.translated_seo_h1 ?? ''),
          translated_short_description: String(translation?.translated_short_description ?? ''),
          translated_long_description: String(translation?.translated_long_description ?? ''),
          translated_location_text: String(translation?.translated_location_text ?? ''),
          translated_features_text: String(translation?.translated_features_text ?? ''),
          translated_answer_summary: String(translation?.translated_answer_summary ?? ''),
          translated_location_summary: String(translation?.translated_location_summary ?? ''),
          translated_target_audience: String(translation?.translated_target_audience ?? ''),
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
          translated_answer_summary: item.translated_answer_summary,
          translated_location_summary: item.translated_location_summary,
          translated_target_audience: item.translated_target_audience,
          translated_highlights: [...item.translated_highlights],
          translated_image_alt_texts: [...item.translated_image_alt_texts],
          translation_status: item.translation_status,
        }]),
      );

      setPropertyItems(nextItems);
      setPropertyBaselineByOfferId(nextBaseline);
      setPropertyStatus(nextItems.length === 0
        ? 'Keine Immobilienangebote für den aktuellen Partner vorhanden.'
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

      const computedStatus = getComputedPropertyStatus(selectedPropertyItem);
      const payload = {
        partner_id: user.id,
        offer_id: selectedPropertyItem.offer_id,
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
        translated_answer_summary: selectedPropertyItem.translated_answer_summary.trim() || null,
        translated_location_summary: selectedPropertyItem.translated_location_summary.trim() || null,
        translated_target_audience: selectedPropertyItem.translated_target_audience.trim() || null,
        translated_highlights: selectedPropertyItem.translated_highlights,
        translated_image_alt_texts: selectedPropertyItem.translated_image_alt_texts,
        status: computedStatus.code,
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
          translated_answer_summary: selectedPropertyItem.translated_answer_summary,
          translated_location_summary: selectedPropertyItem.translated_location_summary,
          translated_target_audience: selectedPropertyItem.translated_target_audience,
          translated_highlights: [...selectedPropertyItem.translated_highlights],
          translated_image_alt_texts: [...selectedPropertyItem.translated_image_alt_texts],
          translation_status: computedStatus.code,
        },
      }));
      setPropertyItems((prev) => prev.map((item) => (
        item.offer_id === selectedPropertyItem.offer_id
          ? {
              ...item,
              translation_status: computedStatus.code,
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
    setRequestLoadSummary(null);
    setRequestLoadDebug(null);
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
        const description = getPayloadText(payload, ['description', 'long_description', 'title']);
        const regionLabel = getRegionTargetLabels(payload).join(', ') || getPayloadText(payload, ['region', 'location_text', 'location']);
        const sourceNote = getPayloadText(payload, ['publicnote', 'note']);
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
          source_note: sourceNote,
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
      setRequestLoadSummary(`${nextItems.length} Gesuche geladen`);
      setRequestLoadDebug({
        requests: requests.length,
        overrides: overrideRows.length,
        translations: translationRows.length,
      });
    } catch (error) {
      setRequestItems([]);
      setRequestBaselineById({});
      setRequestLoadSummary(null);
      setRequestLoadDebug(null);
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

  const workflowPromptStorageKey = useCallback(
    (displayClass: DisplayTextClass): string => `${locale}:${displayClass}`,
    [locale],
  );

  const rowPromptStorageKey = useCallback(
    (row: TranslationRow): string => `${locale}:${row.area_id}:${row.section_key}`,
    [locale],
  );

  const getWorkflowPrompt = useCallback(
    (displayClass: DisplayTextClass): string => (
      workflowPromptDrafts[workflowPromptStorageKey(displayClass)] ?? getI18nStandardPrompt(displayClass, locale)
    ),
    [locale, workflowPromptDrafts, workflowPromptStorageKey],
  );

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
      const params = new URLSearchParams({
        area_ids: scopeAreas.map((scopeArea) => scopeArea.area_id).join(','),
        locale,
        channel,
        auto_sync: options?.autoSync ? '1' : '0',
      });
      if (keys.length > 0) params.set('section_keys', keys.join(','));
      if (options?.autoSync && options?.workflowClass) params.set('workflow_class', options.workflowClass);
      if (options?.autoSync && options?.promptTemplate) params.set('prompt_template', options.promptTemplate);
      const requestUrl = withDebugTimingUrl(`/api/partner/i18n/texts?${params.toString()}`);
      const startedAt = performance.now();
      const res = await fetch(requestUrl, { method: 'GET', cache: 'no-store' });
      const payload = await res.json().catch(() => null) as {
        areas?: Array<{
          area_id?: string;
          rows?: Omit<TranslationRow, 'area_id' | 'area_name'>[];
          summary?: {
            auto_synced?: number;
            auto_sync_failed?: number;
            mock_mode?: boolean;
            pricing_preview?: PricingPreview | null;
          };
        }>;
        error?: string;
        summary?: {
          auto_synced?: number;
          auto_sync_failed?: number;
          mock_mode?: boolean;
          pricing_preview?: PricingPreview | null;
        };
        debug_timings?: Record<string, number>;
      } | null;
      logDebugTiming(requestUrl, performance.now() - startedAt, payload);
      if (!res.ok) {
        throw new Error(String(payload?.error ?? `HTTP ${res.status}`));
      }

      const scopeAreaById = new Map(scopeAreas.map((scopeArea) => [scopeArea.area_id, scopeArea] as const));
      const areaPayloads = Array.isArray(payload?.areas) ? payload.areas : [];
      const nextRows = areaPayloads.flatMap((areaPayload) => {
        const areaId = String(areaPayload?.area_id ?? '').trim();
        const scopeArea = scopeAreaById.get(areaId);
        return (Array.isArray(areaPayload?.rows) ? areaPayload.rows : []).map((row) => {
          const fallback = String(row.effective_content ?? row.source_content_de ?? '').trim();
          return {
            ...row,
            area_id: areaId,
            area_name: scopeArea?.area_name ?? areaId,
            translated_content: String(row.translated_content ?? '').trim() || fallback,
          };
        });
      });
      setRows(nextRows);
      const nextBaseline: Record<string, string> = {};
      for (const row of nextRows) {
        nextBaseline[`${row.area_id}::${row.section_key}`] = String(row.translated_content ?? '').trim();
      }
      setBaselineByKey(nextBaseline);
      const pricing = payload?.summary?.pricing_preview ?? null;
      setPricingPreview(pricing);
      const autoSynced = Number(payload?.summary?.auto_synced ?? 0);
      const autoFailed = Number(payload?.summary?.auto_sync_failed ?? 0);
      const isMock = payload?.summary?.mock_mode === true || I18N_MOCK_TRANSLATION;
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
        const requestUrl = withDebugTimingUrl('/api/partner/llm/options');
        const startedAt = performance.now();
        const res = await fetch(requestUrl, { method: 'GET', cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json().catch(() => null) as { options?: Array<Record<string, unknown>> } | null;
        logDebugTiming(requestUrl, performance.now() - startedAt, payload);
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
    () => (
      channel === 'marketing'
        ? MARKETING_WORKFLOW_CLASSES
        : channel === 'local_site'
          ? LOCAL_SITE_WORKFLOW_CLASSES
          : DEFAULT_WORKFLOW_CLASSES
    ),
    [channel],
  );
  const selectedScopeAreaIsOrtslage = useMemo(
    () => String(selectedScopeAreaId || config?.area_id || '').split('-').length > 3,
    [config?.area_id, selectedScopeAreaId],
  );
  const visibleWorkflowTabs = useMemo(
    () => {
      let nextTabs = selectedScopeAreaIsOrtslage
        ? I18N_TAB_ORDER.filter((tab) => !ORTSLAGE_HIDDEN_TAB_IDS.has(tab.id))
        : I18N_TAB_ORDER;
      if (channel === 'local_site') {
        nextTabs = nextTabs.filter((tab) => tab.id !== 'berater' && tab.id !== 'makler');
      }
      return nextTabs;
    },
    [channel, selectedScopeAreaIsOrtslage],
  );

  useEffect(() => {
    if (visibleWorkflowTabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(visibleWorkflowTabs[0]?.id ?? 'immobilienpreise');
  }, [activeTab, setActiveTab, visibleWorkflowTabs]);

  useEffect(() => {
    if (workflowClasses.includes(activeClass)) return;
    setActiveClass(workflowClasses[0] ?? 'general');
  }, [activeClass, setActiveClass, workflowClasses]);

  useEffect(() => {
    if (isDistrict) return;
    if (scope !== 'kreis_ortslagen') return;
    setScope('current_area');
  }, [isDistrict, scope, setScope]);

  useEffect(() => {
    if (scopeAreaItems.length === 0) return;
    if (scopeAreaItems.some((item) => item.area_id === selectedScopeAreaId)) return;
    setSelectedScopeAreaId(scopeAreaItems[0]?.area_id ?? '');
  }, [scopeAreaItems, selectedScopeAreaId, setSelectedScopeAreaId]);

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
  }, [getWorkflowPrompt, pricingPreview, rows]);

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
        BLOG_FIELD_DEFINITIONS.some((definition) => getBlogFieldText(selectedBlogItem, definition.targetKey).trim().length > 0)
        || selectedBlogItem.translation_status !== 'draft'
      );
    }
    return (
      BLOG_FIELD_DEFINITIONS.some((definition) => getBlogFieldText(selectedBlogItem, definition.targetKey) !== baseline[definition.targetKey])
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
        || selectedPropertyItem.translated_answer_summary.trim().length > 0
        || selectedPropertyItem.translated_location_summary.trim().length > 0
        || selectedPropertyItem.translated_target_audience.trim().length > 0
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
      || selectedPropertyItem.translated_answer_summary !== baseline.translated_answer_summary
      || selectedPropertyItem.translated_location_summary !== baseline.translated_location_summary
      || selectedPropertyItem.translated_target_audience !== baseline.translated_target_audience
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
        REFERENCE_FIELD_DEFINITIONS.some((definition) => getReferenceFieldText(selectedReferenceItem, definition.targetKey).trim().length > 0)
        || selectedReferenceItem.translation_status !== 'draft'
      );
    }
    return (
      REFERENCE_FIELD_DEFINITIONS.some((definition) => {
        const baselineValue = baseline[definition.targetKey];
        const baselineText = Array.isArray(baselineValue) ? baselineValue.join('\n') : baselineValue;
        return getReferenceFieldText(selectedReferenceItem, definition.targetKey) !== baselineText;
      })
      || selectedReferenceItem.translation_status !== baseline.translation_status
    );
  }, [referenceBaselineById, selectedReferenceItem]);

  const requestHasEdits = useMemo(() => {
    if (!selectedRequestItem) return false;
    const baseline = requestBaselineById[selectedRequestItem.request_id];
    const trackedDefinitions = REQUEST_FIELD_DEFINITIONS;
    if (!baseline) {
      return (
        trackedDefinitions.some((definition) => String(selectedRequestItem[definition.targetKey] ?? '').trim().length > 0)
        || selectedRequestItem.translation_status !== 'draft'
      );
    }
    return (
      trackedDefinitions.some((definition) => selectedRequestItem[definition.targetKey] !== baseline[definition.targetKey])
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

  const propertyVisibleFieldDefinitions = useMemo(
    () => PROPERTY_FIELD_DEFINITIONS.filter((field) => field.tab === propertyEditorTab),
    [propertyEditorTab],
  );

  const propertyDraftItemsCount = useMemo(
    () => propertyItems.filter((item) => item.translation_status === 'draft').length,
    [propertyItems],
  );

  function getPropertyFieldText(item: PropertyOfferTranslationItem, key: keyof PropertyOfferTranslationItem): string {
    const value = item[key];
    if (Array.isArray(value)) return value.join('\n');
    return typeof value === 'string' ? value : '';
  }

  function updatePropertyField(
    offerId: string,
    key: keyof PropertyOfferTranslationItem,
    nextValue: string,
    isList = false,
  ) {
    setPropertyItems((prev) => prev.map((item) => {
      if (item.offer_id !== offerId) return item;
      return {
        ...item,
        [key]: isList
          ? nextValue.split('\n').map((value) => value.trim()).filter(Boolean)
          : nextValue,
      };
    }));
  }

  function getPropertyRequiredDefinitions(item: PropertyOfferTranslationItem): PropertyFieldDefinition[] {
    return PROPERTY_FIELD_DEFINITIONS.filter((definition) => getPropertyFieldText(item, definition.sourceKey).trim().length > 0);
  }

  function getComputedPropertyStatus(item: PropertyOfferTranslationItem): {
    code: BlogTranslationStatus;
    visual: PropertyComputedStatus;
    label: string;
    shortLabel: string;
    requiredCount: number;
    translatedCount: number;
  } {
    const requiredDefinitions = getPropertyRequiredDefinitions(item);
    const translatedCount = requiredDefinitions.filter((definition) => getPropertyFieldText(item, definition.targetKey).trim().length > 0).length;
    if (requiredDefinitions.length === 0 || translatedCount === 0) {
      return {
        code: 'draft',
        visual: 'open',
        label: 'Übersetzung offen',
        shortLabel: 'offen',
        requiredCount: requiredDefinitions.length,
        translatedCount,
      };
    }
    if (item.translation_is_stale || translatedCount < requiredDefinitions.length) {
      return {
        code: 'needs_review',
        visual: 'in_progress',
        label: 'Übersetzung in Arbeit',
        shortLabel: 'in Arbeit',
        requiredCount: requiredDefinitions.length,
        translatedCount,
      };
    }
    return {
      code: 'approved',
      visual: 'translated',
      label: 'Übersetzt',
      shortLabel: 'fertig',
      requiredCount: requiredDefinitions.length,
      translatedCount,
    };
  }

  function getPropertyStatusBadgeClass(status: PropertyComputedStatus): string {
    if (status === 'translated') return 'badge rounded-pill text-success bg-success-subtle border border-success-subtle fw-bold px-3 py-2';
    if (status === 'in_progress') return 'badge rounded-pill text-warning bg-warning-subtle border border-warning-subtle fw-bold px-3 py-2';
    return 'badge rounded-pill text-danger bg-danger-subtle border border-danger-subtle fw-bold px-3 py-2';
  }

  function getI18nListRowClass(active: boolean): string {
    return `btn w-100 text-start rounded-3 border p-3 d-flex flex-column gap-2 ${active ? 'bg-light border-secondary' : 'bg-white border-secondary-subtle'}`;
  }

  function getI18nTranslationBadgeClass(stale: boolean, translated: boolean): string {
    if (stale) return 'badge rounded-pill text-warning bg-warning-subtle border border-warning-subtle fw-bold px-3 py-2';
    if (translated) return 'badge rounded-pill text-success bg-success-subtle border border-success-subtle fw-bold px-3 py-2';
    return 'badge rounded-pill text-danger bg-danger-subtle border border-danger-subtle fw-bold px-3 py-2';
  }

  function getBlogFieldText(item: BlogTranslationItem, key: keyof BlogTranslationItem): string {
    const value = item[key];
    return typeof value === 'string' ? value : '';
  }

  function updateBlogField(
    postId: string,
    key: keyof BlogBaseline,
    nextValue: string,
  ) {
    setBlogItems((prev) => prev.map((item) => (
      item.post_id !== postId
        ? item
        : {
            ...item,
            [key]: nextValue,
          }
    )));
  }

  function hasBlogTranslatedContent(item: BlogTranslationItem): boolean {
    return BLOG_FIELD_DEFINITIONS.some((definition) => getBlogFieldText(item, definition.targetKey).trim().length > 0);
  }

  function renderBlogFieldPair(
    item: BlogTranslationItem,
    definition: BlogFieldDefinition,
  ) {
    const sourceValue = getBlogFieldText(item, definition.sourceKey);
    const targetValue = getBlogFieldText(item, definition.targetKey);
    const rows = definition.rows ?? 4;

    return (
      <div key={`${item.post_id}-${definition.key}`} className="border rounded-4 bg-white p-3 d-grid gap-3">
        <div className="fw-bold text-dark">{definition.label}</div>
        <div className="row g-3">
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Deutsch</div>
            {definition.multiline ? (
              <textarea className="form-control bg-light text-secondary" value={sourceValue} readOnly rows={rows} />
            ) : (
              <input className="form-control bg-light text-secondary" value={sourceValue} readOnly />
            )}
          </div>
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Übersetzung</div>
            {definition.multiline ? (
              <textarea
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updateBlogField(item.post_id, definition.targetKey, e.target.value)}
                rows={rows}
              />
            ) : (
              <input
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updateBlogField(item.post_id, definition.targetKey, e.target.value)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  function getReferenceFieldText(item: ReferenceTranslationItem, key: keyof ReferenceTranslationItem): string {
    const value = item[key];
    if (Array.isArray(value)) return value.join('\n');
    return typeof value === 'string' ? value : '';
  }

  function updateReferenceField(
    referenceId: string,
    key: keyof ReferenceBaseline,
    nextValue: string,
    isList = false,
  ) {
    setReferenceItems((prev) => prev.map((item) => {
      if (item.reference_id !== referenceId) return item;
      return {
        ...item,
        [key]: isList
          ? nextValue.split('\n').map((value) => value.trim()).filter(Boolean)
          : nextValue,
      };
    }));
  }

  function hasReferenceTranslatedContent(item: ReferenceTranslationItem): boolean {
    return REFERENCE_FIELD_DEFINITIONS.some((definition) => getReferenceFieldText(item, definition.targetKey).trim().length > 0);
  }

  function renderReferenceFieldPair(
    item: ReferenceTranslationItem,
    definition: ReferenceFieldDefinition,
  ) {
    const sourceValue = getReferenceFieldText(item, definition.sourceKey);
    const targetValue = getReferenceFieldText(item, definition.targetKey);

    return (
      <div key={`${item.reference_id}-${definition.key}`} className="border rounded-4 bg-white p-3 d-grid gap-3">
        <div>
          <div className="fw-bold text-dark">{definition.label}</div>
          {definition.list ? (
            <div className="small text-secondary">Eine Zeile entspricht genau einem Eintrag.</div>
          ) : null}
        </div>
        <div className="row g-3">
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Deutsch</div>
            {definition.multiline || definition.list ? (
              <textarea
                className="form-control bg-light text-secondary"
                value={sourceValue}
                readOnly
                rows={4}
              />
            ) : (
              <input
                className="form-control bg-light text-secondary"
                value={sourceValue}
                readOnly
              />
            )}
          </div>
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Übersetzung</div>
            {definition.multiline || definition.list ? (
              <textarea
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updateReferenceField(item.reference_id, definition.targetKey, e.target.value, Boolean(definition.list))}
                rows={4}
              />
            ) : (
              <input
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updateReferenceField(item.reference_id, definition.targetKey, e.target.value, false)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  function getPropertyFieldPrompt(definition: PropertyFieldDefinition): string {
    const basePrompt = getI18nStandardPrompt(definition.displayClass, locale);
    const extraPrompt = definition.list
      ? `Feld: ${definition.label}. Erhalte die Listenstruktur exakt. Eine Zeile im deutschen Input bleibt genau eine Zeile in der Zielsprache.`
      : definition.multiline
        ? `Feld: ${definition.label}. Uebersetze diesen Expose-Baustein natuerlich, fachlich exakt und ohne neue Fakten.`
        : `Feld: ${definition.label}. Liefere eine praezise, natuerliche Uebersetzung nur fuer dieses Feld.`;
    return buildI18nPromptWithExtras(basePrompt, extraPrompt);
  }

  async function rewritePropertyFieldViaAi(
    item: PropertyOfferTranslationItem,
    definition: PropertyFieldDefinition,
  ): Promise<string> {
    const selected = llmOptions.find((option) => option.id === selectedLlmOptionId) ?? null;
    const sourceText = getPropertyFieldText(item, definition.sourceKey).trim();
    if (!sourceText) return '';
    const res = await fetch('/api/ai-rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sourceText,
        areaName: String(config.areas?.name ?? config.area_id),
        type: definition.displayClass === 'marketing' ? 'marketing' : 'general',
        sectionLabel: `angebot_${definition.key}`,
        customPrompt: getPropertyFieldPrompt(definition),
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

  async function runPropertyFieldAi(
    item: PropertyOfferTranslationItem,
    definition: PropertyFieldDefinition,
  ) {
    const sourceText = getPropertyFieldText(item, definition.sourceKey).trim();
    if (!sourceText) {
      setPropertyStatus(`Für „${definition.label}“ ist keine deutsche Quelle vorhanden.`);
      setPropertyStatusTone('error');
      return;
    }
    setPropertyAiKey(`${item.offer_id}:${definition.key}`);
    setPropertyStatus(null);
    setPropertyStatusTone(null);
    try {
      const translated = await rewritePropertyFieldViaAi(item, definition);
      updatePropertyField(item.offer_id, definition.targetKey, translated, Boolean(definition.list));
      setPropertyStatus(`„${definition.label}“ wurde mit KI vorbereitet.`);
      setPropertyStatusTone('success');
    } catch (error) {
      setPropertyStatus(error instanceof Error ? error.message : 'KI-Übersetzung fehlgeschlagen.');
      setPropertyStatusTone('error');
    } finally {
      setPropertyAiKey(null);
    }
  }

  async function runPropertyDraftBatchAi() {
    if (llmOptions.length === 0) {
      setPropertyStatus('Kein LLM für die Immobilien-Übersetzung verfügbar.');
      setPropertyStatusTone('error');
      return;
    }
    const draftItems = propertyItems.filter((item) => item.translation_status === 'draft');
    if (draftItems.length === 0) {
      setPropertyStatus('Keine Draft-Angebote für die aktuelle Übersetzungsansicht vorhanden.');
      setPropertyStatusTone('success');
      return;
    }

    setPropertyBulkAiRunning(true);
    setPropertyStatus(`Starte KI-Übersetzung für ${draftItems.length} Draft-Angebot/Angebote im Tab ${propertyEditorTab === 'texts' ? 'Texte' : 'SEO / GEO'} …`);
    setPropertyStatusTone('success');
    try {
      let updatedFields = 0;
      for (const item of draftItems) {
        for (const definition of propertyVisibleFieldDefinitions) {
          const sourceText = getPropertyFieldText(item, definition.sourceKey).trim();
          if (!sourceText) continue;
          const translated = await rewritePropertyFieldViaAi(item, definition);
          updatePropertyField(item.offer_id, definition.targetKey, translated, Boolean(definition.list));
          updatedFields += 1;
        }
      }
      setPropertyStatus(`${updatedFields} Übersetzungsfelder für Draft-Angebote mit KI vorbereitet.`);
      setPropertyStatusTone('success');
    } catch (error) {
      setPropertyStatus(error instanceof Error ? error.message : 'Globale KI-Übersetzung fehlgeschlagen.');
      setPropertyStatusTone('error');
    } finally {
      setPropertyBulkAiRunning(false);
    }
  }

  function renderPropertyFieldPair(
    item: PropertyOfferTranslationItem,
    definition: PropertyFieldDefinition,
  ) {
    const sourceValue = getPropertyFieldText(item, definition.sourceKey);
    const targetValue = getPropertyFieldText(item, definition.targetKey);
    const isBusy = propertyAiKey === `${item.offer_id}:${definition.key}`;

    return (
      <div key={`${item.offer_id}-${definition.key}`} className="border rounded-4 bg-white p-3 d-grid gap-3">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div>
            <div className="fw-bold text-dark">{definition.label}</div>
            {definition.list ? (
              <div className="small text-secondary">Eine Zeile entspricht genau einem Eintrag.</div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary fw-semibold"
            onClick={() => void runPropertyFieldAi(item, definition)}
            disabled={propertySaving || propertyBulkAiRunning || llmOptions.length === 0 || isBusy}
          >
            {isBusy ? 'KI übersetzt …' : 'Mit KI übersetzen'}
          </button>
        </div>
        <div className="row g-3">
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Deutsch</div>
            {definition.multiline || definition.list ? (
              <textarea
                className="form-control bg-light text-secondary"
                value={sourceValue}
                readOnly
                rows={6}
              />
            ) : (
              <input
                className="form-control bg-light text-secondary"
                value={sourceValue}
                readOnly
              />
            )}
          </div>
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Übersetzung</div>
            {definition.multiline || definition.list ? (
              <textarea
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updatePropertyField(item.offer_id, definition.targetKey, e.target.value, Boolean(definition.list))}
                rows={6}
              />
            ) : (
              <input
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updatePropertyField(item.offer_id, definition.targetKey, e.target.value, false)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  function getRequestFieldText(
    item: RequestTranslationItem,
    key: keyof RequestTranslationItem,
  ): string {
    return String(item[key] ?? '');
  }

  function getRequestFieldPrompt(
    item: RequestTranslationItem,
    definition: RequestFieldDefinition,
  ): string {
    const displayClass: DisplayTextClass = definition.tab === 'seo' ? 'marketing' : 'general';
    const basePrompt = getI18nStandardPrompt(displayClass, locale);
    const localeLabel = normalizeLocaleLabel(locale);
    const requestContext = [
      `Gesuchstyp: ${formatRequestModeLabel(item.request_type || '—')}`,
      `Objektart: ${formatRequestObjectTypeLabel(item.object_type || null)}`,
      `Zielregion: ${item.region_label || 'Nicht gesetzt'}`,
      `Zielsprache: ${localeLabel}`,
    ].join('\n');

    let fieldInstruction = `Feld: ${definition.label}. Uebersetze dieses Feld praezise, natuerlich und ohne neue Fakten in ${localeLabel}.`;
    if (definition.key === 'seo_h1') {
      fieldInstruction = `Feld: ${definition.label}. Uebersetze den oeffentlichen Gesuch-Titel praezise, natuerlich und suchintent-orientiert in ${localeLabel}. Keine neuen Fakten, keine kuenstlichen Keywords, keine zusaetzlichen Satzzeichen.`;
    } else if (definition.key === 'long_description') {
      fieldInstruction = `Feld: ${definition.label}. Uebersetze die oeffentliche Gesuchsbeschreibung fachlich exakt, natuerlich und gut lesbar in ${localeLabel}. Erhalte Bedeutung, Tonalitaet und Struktur. Keine neuen Fakten, keine Verkuerzungen, keine Interpretationen.`;
    } else if (definition.key === 'seo_title') {
      fieldInstruction = `Feld: ${definition.label}. Uebersetze den SEO-Titel praezise, klickstark und suchmaschinengeeignet in ${localeLabel}. Keine neuen Fakten, kein Keyword-Stuffing, keine generischen Werbephrasen.`;
    } else if (definition.key === 'seo_description') {
      fieldInstruction = `Feld: ${definition.label}. Uebersetze die SEO-Description als natuerliches Snippet in ${localeLabel}. Praezise, fachlich korrekt, suchmaschinengeeignet und ohne neue Fakten.`;
    }

    const extraPrompt = `${fieldInstruction}\n\nKontext zum Gesuch:\n${requestContext}`;
    return buildI18nPromptWithExtras(basePrompt, extraPrompt);
  }

  async function rewriteRequestFieldViaAi(
    item: RequestTranslationItem,
    definition: RequestFieldDefinition,
    prompt: string,
  ): Promise<string> {
    const selected = llmOptions.find((option) => option.id === selectedLlmOptionId) ?? null;
    const sourceText = getRequestFieldText(item, definition.sourceKey).trim();
    if (!sourceText) return '';
    const res = await fetch('/api/ai-rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sourceText,
        areaName: String(config.areas?.name ?? config.area_id),
        type: definition.tab === 'seo' ? 'marketing' : 'general',
        sectionLabel: `gesuch_${definition.key}`,
        customPrompt: prompt,
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

  async function runRequestFieldAi(
    item: RequestTranslationItem,
    definition: RequestFieldDefinition,
    prompt: string,
  ) {
    if (llmOptions.length === 0) {
      setRequestStatus('Kein LLM für die Gesuche-Übersetzung verfügbar.');
      setRequestStatusTone('error');
      return;
    }
    const sourceText = getRequestFieldText(item, definition.sourceKey).trim();
    if (!sourceText) {
      setRequestStatus(`Für „${definition.label}“ ist keine deutsche Quelle vorhanden.`);
      setRequestStatusTone('error');
      return;
    }
    const aiKey = `${item.request_id}:${definition.key}`;
    setRequestAiKey(aiKey);
    setRequestStatus(null);
    setRequestStatusTone(null);
    try {
      const translated = await rewriteRequestFieldViaAi(item, definition, prompt);
      updateRequestField(item.request_id, definition.targetKey, translated);
      setRequestStatus(`„${definition.label}“ wurde mit KI vorbereitet.`);
      setRequestStatusTone('success');
    } catch (error) {
      setRequestStatus(error instanceof Error ? error.message : 'KI-Übersetzung fehlgeschlagen.');
      setRequestStatusTone('error');
    } finally {
      setRequestAiKey(null);
    }
  }

  function updateRequestField(
    requestId: string,
    key: keyof RequestTranslationItem,
    nextValue: string,
  ) {
    setRequestItems((prev) => prev.map((item) => (
      item.request_id !== requestId
        ? item
        : {
            ...item,
            [key]: nextValue,
          }
    )));
  }

  function getComputedRequestStatus(item: RequestTranslationItem): {
    visual: PropertyComputedStatus;
    label: string;
  } {
    const requiredDefinitions = REQUEST_FIELD_DEFINITIONS.filter((definition) => getRequestFieldText(item, definition.sourceKey).trim().length > 0);
    const translatedCount = requiredDefinitions.filter((definition) => getRequestFieldText(item, definition.targetKey).trim().length > 0).length;
    if (requiredDefinitions.length === 0 || translatedCount === 0) {
      return { visual: 'open', label: 'Übersetzung offen' };
    }
    if (item.translation_is_stale || translatedCount < requiredDefinitions.length) {
      return { visual: 'in_progress', label: 'Übersetzung in Arbeit' };
    }
    return { visual: 'translated', label: 'Übersetzt' };
  }

  function getRequestStatusBadgeClass(status: PropertyComputedStatus): string {
    if (status === 'translated') return 'badge rounded-pill text-success bg-success-subtle border border-success-subtle fw-bold px-3 py-2';
    if (status === 'in_progress') return 'badge rounded-pill text-warning bg-warning-subtle border border-warning-subtle fw-bold px-3 py-2';
    return 'badge rounded-pill text-danger bg-danger-subtle border border-danger-subtle fw-bold px-3 py-2';
  }

  function getRequestFilterButtonClass(active: boolean): string {
    return `btn btn-sm rounded-pill fw-semibold flex-fill ${active ? 'btn-secondary' : 'btn-outline-secondary'}`;
  }

  function getRequestListRowClass(active: boolean): string {
    return `btn w-100 text-start rounded-3 border p-2 d-flex flex-column gap-1 position-relative ${active ? 'bg-light border-secondary' : 'bg-white border-secondary-subtle'}`;
  }

  function renderRequestFieldPair(
    item: RequestTranslationItem,
    definition: RequestFieldDefinition,
  ) {
    const sourceValue = getRequestFieldText(item, definition.sourceKey);
    const targetValue = getRequestFieldText(item, definition.targetKey);
    const fieldKey = `${item.request_id}:${definition.key}`;
    const isBusy = requestAiKey === fieldKey;
    const showPrompt = Boolean(requestPromptOpenMap[fieldKey]);
    const customPrompt = requestCustomPromptMap[fieldKey] ?? '';
    const standardPrompt = getRequestFieldPrompt(item, definition);
    const effectivePrompt = customPrompt.trim() || standardPrompt;

    return (
      <div key={`${item.request_id}-${definition.key}`} className="border rounded-4 bg-white p-3 d-grid gap-3">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div className="fw-bold text-dark">{definition.label}</div>
        </div>
        <div className="row g-3">
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Deutsch</div>
            {definition.multiline ? (
              <textarea
                className="form-control bg-light text-secondary"
                value={sourceValue}
                readOnly
                rows={6}
              />
            ) : (
              <input
                className="form-control bg-light text-secondary"
                value={sourceValue}
                readOnly
              />
            )}
          </div>
          <div className="col-12 col-xl-6 d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Übersetzung</div>
            {definition.multiline ? (
              <textarea
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updateRequestField(item.request_id, definition.targetKey, e.target.value)}
                rows={6}
              />
            ) : (
              <input
                className="form-control"
                value={targetValue}
                placeholder={definition.placeholder}
                onChange={(e) => updateRequestField(item.request_id, definition.targetKey, e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary fw-semibold"
            onClick={() => void runRequestFieldAi(item, definition, effectivePrompt)}
            disabled={requestSaving || llmOptions.length === 0 || isBusy}
          >
            {isBusy ? '⏳ KI generiert Text...' : '✨ Text durch KI veredeln'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary fw-semibold"
            onClick={() => {
              setRequestPromptOpenMap((prev) => ({
                ...prev,
                [fieldKey]: !prev[fieldKey],
              }));
            }}
          >
            {showPrompt ? 'Prompt ausblenden' : 'Prompt anzeigen'}
          </button>
        </div>
        {showPrompt ? (
          <div className="border rounded-3 p-3 bg-light d-grid gap-2">
            <div className="small text-secondary text-uppercase fw-bold">Standard-Prompt</div>
            <div className="small text-secondary lh-base">{standardPrompt}</div>
            <label className="form-label small fw-semibold text-dark mb-0 d-grid gap-1">
              <span>Eigener Prompt (optional)</span>
              <textarea
                value={customPrompt}
                onChange={(e) => {
                  const next = e.target.value;
                  setRequestCustomPromptMap((prev) => ({
                    ...prev,
                    [fieldKey]: next,
                  }));
                }}
                className="form-control form-control-sm"
                rows={4}
                placeholder="Eigenen Prompt eingeben (überschreibt den Standard-Prompt)"
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  function renderWorkflowTranslationTable(showAreaName: boolean, emptyMessage: string) {
    return (
      <div className="d-flex flex-column">
        <WorkspacePillTabs
          items={visibleWorkflowTabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
          }))}
          activeId={activeTab}
          onSelect={setActiveTab}
        />
        <div className="table-responsive border rounded-3">
          <table className="table table-sm align-top mb-0">
            <thead className="table-light">
              <tr>
                <th scope="col" className="text-secondary small fw-bold px-3 py-2">Bereich</th>
                <th scope="col" className="text-secondary small fw-bold px-3 py-2">Deutsch (Quelle)</th>
                <th scope="col" className="text-secondary small fw-bold px-3 py-2">Übersetzung</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="text-secondary small px-3 py-3" colSpan={3}>{emptyMessage}</td>
                </tr>
              ) : filteredRows.map((row, idx) => (
                <tr key={`${row.area_id}:${row.section_key}:${idx}`}>
                  <td className="small text-dark px-3 py-3">
                    {(() => {
                      const meta = resolveSectionMeta(row.section_key);
                      const sectionLabel = meta?.label ?? row.section_key;
                      const sectionType: SectionKind = meta?.type ?? 'general';
                      const displayClass = resolveDisplayTextClass(row.section_key, sectionType);
                      return (
                        <div className="d-grid gap-2">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-bold">{sectionLabel}</span>
                            <span className="badge rounded-pill text-bg-secondary">{displayTextClassLabel(displayClass)}</span>
                          </div>
                          {showAreaName ? (
                            <div className="small text-success fw-bold">{row.area_name}</div>
                          ) : null}
                          <div className="small text-secondary font-monospace text-break">{row.section_key}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3">
                    <textarea className="form-control form-control-sm bg-light text-secondary" value={row.source_content_de ?? ''} readOnly rows={7} />
                  </td>
                  <td className="px-3 py-3">
                    <textarea
                      className="form-control form-control-sm"
                      value={row.translated_content ?? ''}
                      rows={7}
                      onChange={(e) => {
                        const next = e.target.value;
                        setRows((prev) => prev.map((item) => (
                          item.area_id === row.area_id && item.section_key === row.section_key
                            ? { ...item, translated_content: next }
                            : item
                        )));
                      }}
                    />
                    <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary fw-semibold"
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
                        className="btn btn-sm btn-link p-0 fw-semibold text-decoration-none"
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
                        <span className="badge rounded-pill text-warning bg-warning-subtle border border-warning-subtle">Quelle geändert</span>
                      ) : null}
                    </div>
                    {rowPromptOpenMap[rowPromptStorageKey(row)] ? (
                      <div className="border rounded-3 bg-light p-3 mt-3 d-grid gap-2">
                        <div className="small text-secondary text-uppercase fw-bold">Standard-Prompt</div>
                        <div className="small text-secondary lh-base">{getWorkflowPrompt(getRowDisplayClass(row))}</div>
                        <label className="d-flex flex-column gap-2 small fw-semibold text-dark">
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
                            className="form-control form-control-sm"
                            rows={4}
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
        <div className="d-flex justify-content-end">
          <button
            type="button"
            className={`btn fw-bold px-4 py-2 ${loading || saving || rows.length === 0 || !hasEdits ? 'btn-secondary disabled' : 'btn-success'}`}
            onClick={() => void saveRows()}
            disabled={loading || saving || rows.length === 0 || !hasEdits}
          >
            {saving ? 'Speichern …' : 'Übersetzungen speichern'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <FullscreenLoader
        show={loading || saving || Boolean(rewritingKey) || blogLoading || blogSaving || propertyLoading || propertySaving || Boolean(propertyAiKey) || propertyBulkAiRunning || referenceLoading || referenceSaving || requestLoading || requestSaving || Boolean(requestAiKey)}
        label={
          requestLoading
            ? 'Gesuche-Übersetzungen werden geladen...'
            : requestSaving
              ? 'Gesuche-Übersetzung wird gespeichert...'
            : requestAiKey
              ? 'Gesuche-Feld wird mit KI übersetzt...'
          : referenceLoading
            ? 'Referenz-Übersetzungen werden geladen...'
            : referenceSaving
              ? 'Referenz-Übersetzung wird gespeichert...'
          : propertyLoading
            ? 'Immobilien-Übersetzungen werden geladen...'
            : propertySaving
              ? 'Immobilien-Übersetzung wird gespeichert...'
            : propertyBulkAiRunning
              ? 'Immobilien-Drafts werden mit KI übersetzt...'
            : propertyAiKey
              ? 'Immobilien-Feld wird mit KI übersetzt...'
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
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center p-4 z-3"
          onClick={() => setWorkflowConfirmOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setWorkflowConfirmOpen(false);
          }}
        >
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-12 col-md-8 col-xl-5">
                <div
                  className="bg-white border border-warning rounded-4 shadow p-4 d-grid gap-3"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="i18n-workflow-confirm-title"
                  aria-describedby="i18n-workflow-confirm-text"
                  tabIndex={-1}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 id="i18n-workflow-confirm-title" className="m-0 fs-4 fw-bold text-dark">Vor dem Übersetzungslauf prüfen</h3>
                  <p id="i18n-workflow-confirm-text" className="m-0 small text-secondary lh-base">
                    Bitte prüfe den deutschen Stand vor dem Übersetzungslauf auf Vollständigkeit und Qualität, um Korrekturläufe und Kosten zu sparen!
                  </p>
                  <div className="d-flex justify-content-end gap-2 flex-wrap">
                    <button type="button" className="btn btn-outline-secondary rounded-pill fw-semibold px-3" onClick={() => setWorkflowConfirmOpen(false)}>
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      className="btn btn-warning rounded-pill fw-bold px-3"
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
            </div>
          </div>
        </div>
      ) : null}
      <section className="d-grid gap-3">
        <div className={workspaceStyles.workspaceTopControlCard}>
          <div className={workspaceStyles.workspaceTopControlRow}>
            <div className={workspaceStyles.workspaceTopControlField}>
              <label className={workspaceStyles.workspaceTopControlLabel}>
                <select
                  className={`form-select fw-semibold ${workspaceStyles.workspaceTopControlSelect}`}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  {locales.map((item) => (
                    <option key={item} value={item}>{normalizeLocaleLabel(item)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={workspaceStyles.workspaceTopControlFieldModel}>
              <label className={workspaceStyles.workspaceTopControlLabel}>
                <select
                  className={`form-select fw-semibold ${workspaceStyles.workspaceTopControlSelect}`}
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
          </div>
        </div>

        <div className="row g-3">
          {productDomains.map((domain) => (
            <div key={domain.id} className="col-12 col-sm-6 col-xl-3">
              <button
                type="button"
                className={`btn w-100 rounded-4 p-3 text-start d-flex align-items-center justify-content-between gap-2 ${activeDomain === domain.id ? 'btn-warning border-dark-subtle' : 'btn-light border shadow-sm'}`}
                onClick={() => setActiveDomain(domain.id)}
              >
                <strong className="fs-6 text-dark">{domain.label}</strong>
                <span
                  className={`rounded-circle p-1 ${domain.enabled ? 'bg-success' : 'bg-danger'}`}
                  aria-label={domain.enabled ? `${domain.label} verfügbar` : `${domain.label} nicht verfügbar`}
                  title={domain.enabled ? 'Verfügbar' : 'Nicht verfügbar'}
                />
              </button>
            </div>
          ))}
        </div>

	      {activeDomain === 'immobilienmarkt' ? (
	      <div className="d-grid">
	      <div className={`${workspaceStyles.reportPanelCard} mb-0`}>
	        <div className="d-grid gap-2">
	          <div className="d-flex align-items-center gap-3 flex-wrap">
	            <h3 className={workspaceStyles.reportSectionTitle}>Bereich wählen -&gt;</h3>
	            <label className={workspaceStyles.reportInlineField}>
	              <select
	                className={`${workspaceStyles.workspaceControlSelect} ${workspaceStyles.reportInlineSelect}`}
	                value={channel}
	                onChange={(e) => setChannel(e.target.value as I18nChannel)}
	              >
	                {I18N_CHANNEL_OPTIONS.map((item) => (
	                  <option key={item.value} value={item.value}>
	                    {item.label}
	                  </option>
	                ))}
	              </select>
	            </label>
	            <label className={workspaceStyles.reportInlineField}>
	              <select
	                className={`${workspaceStyles.workspaceControlSelect} ${workspaceStyles.reportInlineSelect}`}
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
	          </div>
	          {status ? (
	            <div className={`small fw-semibold lh-sm ${statusTone === 'error' ? 'text-danger' : 'text-success'}`}>{status}</div>
	          ) : (
	            <div className="small fw-bold text-dark lh-sm">Themenbereiche prüfen oder bei Bedarf nacharbeiten</div>
	          )}
	        </div>

	        <div className={workspaceStyles.reportClassGrid}>
	          {workflowClasses.map((displayClass) => {
	            const stats = classSummary[displayClass];
	            const active = activeClass === displayClass;
	            const buttonDisabled = loading || saving || (active && selectedWorkflowKeys.length === 0);
	            return (
	              <div
	                key={displayClass}
	                role="button"
	                tabIndex={0}
	                className={`${workspaceStyles.reportClassCard} ${active ? workspaceStyles.reportClassCardActive : ''}`}
	                onClick={() => setActiveClass(displayClass)}
	                onKeyDown={(e) => {
	                  if (e.key !== 'Enter' && e.key !== ' ') return;
	                  e.preventDefault();
	                  setActiveClass(displayClass);
	                }}
	              >
	                <div className="d-flex align-items-center justify-content-between gap-3">
	                  <span className={`${workspaceStyles.reportClassBadge} ${i18nWorkflowBadgeClass(displayClass)}`}>{displayTextClassLabel(displayClass)}</span>
	                </div>
	                <p className="m-0 small text-secondary lh-base">Texttyp: {i18nWorkflowClassDescription(displayClass)}</p>
	                <p className="m-0 small lh-base text-dark fw-semibold">Zyklus: {i18nWorkflowClassCycle(displayClass)}</p>
	                <div className="d-grid gap-1 small text-secondary">
	                  <span className="d-flex flex-wrap gap-3 align-items-center">
	                    Texte: {stats.total} Uebersetzt: {stats.translated} DE-Fallback: {stats.fallback} Tokens ca.: {classEstimateMap[displayClass].total_tokens.toLocaleString('de-DE')}
	                  </span>
	                  {stats.stale > 0 ? (
	                    <span className="d-flex flex-wrap gap-3 align-items-center">Veraltet: {stats.stale}</span>
	                  ) : null}
	                </div>
	                <div className="d-flex flex-wrap gap-3 align-items-center small fw-bold text-dark">
	                  <span className="d-flex flex-wrap gap-3 align-items-center">USD ca.: {formatCost(classEstimateMap[displayClass].estimated_cost_usd, 'USD')}</span>
	                  <span className="d-flex flex-wrap gap-3 align-items-center">EUR ca.: {formatCost(classEstimateMap[displayClass].estimated_cost_eur, 'EUR')}</span>
	                  <span className="position-relative d-inline-flex align-items-center gap-1">
	                    <button
	                      type="button"
	                      className={workspaceStyles.reportCostInfoTrigger}
	                      onClick={(e) => {
	                        e.stopPropagation();
	                        setCostInfoOpenClass((prev) => (prev === displayClass ? null : displayClass));
	                      }}
	                      aria-label="Hinweis zur Kostenberechnung"
	                    >
	                      i
	                    </button>
	                    {costInfoOpenClass === displayClass ? (
	                      <span className={workspaceStyles.reportCostInfoPopover}>
	                        Unverbindliche Schätzung auf Basis von Textlänge, Prompt, Modellpreisen und pauschalem Request-Overhead. Tatsächliche API-Kosten können abweichen.
	                      </span>
	                    ) : null}
	                  </span>
	                </div>
	                <label className="d-grid gap-1 small fw-semibold text-secondary">
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
	                    className={workspaceStyles.reportPromptTextarea}
	                    placeholder={getI18nStandardPrompt(displayClass, locale)}
	                  />
	                </label>
	                <div className="d-flex justify-content-between align-items-center gap-2">
	                  <button
	                    type="button"
	                    className={`${workspaceStyles.reportAnchorLink} ${i18nWorkflowLinkClass(displayClass)}`}
	                    onClick={(e) => {
	                      e.stopPropagation();
	                      scrollToTopicSection();
	                    }}
	                  >
	                    Einzeltexte
	                  </button>
	                  <button
	                    type="button"
	                    className={`${workspaceStyles.reportClassActionButton} ${i18nWorkflowActionClass(displayClass)}`}
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
	              </div>
	            );
	          })}
	        </div>
	      </div>

	      <div className="bg-white border rounded-4 p-3">
	        <div id={topicSectionAnchorId} className={`mb-3 ${workspaceStyles.workspaceAnchorTarget}`}>
          <h3 className="m-0 fs-5 fw-bold text-dark">Themenbereiche prüfen oder bei Bedarf nacharbeiten</h3>
        </div>
        {showScopeAreaSidebar ? (
          <div className="row g-3 align-items-start">
            <aside className="col-12 col-xl-3">
              <div className="bg-light border rounded-4 p-3 d-flex flex-column gap-2">
                {scopeAreaItems.map((item) => {
                  const isDistrictItem = item.area_id.split('-').length <= 3;
                  const active = selectedScopeArea?.area_id === item.area_id;
                  return (
                    <button
                      key={item.area_id}
                      type="button"
                      className={`btn w-100 text-start rounded-3 border p-3 d-flex flex-column gap-2 ${active ? 'bg-white border-secondary shadow-sm' : 'bg-light border-secondary-subtle'}`}
                      onClick={() => setSelectedScopeAreaId(item.area_id)}
                    >
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <strong className="small text-dark">{item.area_name}</strong>
                        <span className={`badge rounded-pill ${isDistrictItem ? 'text-bg-secondary' : 'text-bg-success'}`}>{isDistrictItem ? 'Kreis' : 'Ortslage'}</span>
                      </div>
                      <div className="small text-secondary">{item.area_id}</div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="col-12 col-xl-9">
              {renderWorkflowTranslationTable(false, 'In diesem Themenbereich sind für das gewählte Gebiet und den gewählten Texttyp aktuell keine übersetzbaren Inhalte vorhanden.')}
            </div>
          </div>
        ) : (
          renderWorkflowTranslationTable(scope === 'kreis_ortslagen', 'In diesem Themenbereich sind fuer den gewaehlten Texttyp aktuell keine uebersetzbaren Inhalte vorhanden.')
        )}
	      </div>
	      </div>
	      ) : activeDomain === 'blog' ? (
      <div className="bg-white border rounded-4 p-3 p-xl-4">
        {blogStatus ? <div className={`alert ${blogStatusTone === 'error' ? 'alert-danger' : 'alert-success'} mb-3`}>{blogStatus}</div> : null}
        <div className="row g-3 g-xl-4 align-items-start">
          <aside className="col-12 col-xl-4">
            <div className="bg-light border rounded-4 p-3">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <h3 className="m-0 fs-5 fw-bold text-dark">Beiträge</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary fw-semibold"
                  onClick={() => void loadBlogItems()}
                  disabled={blogLoading || blogSaving}
                >
                  Stand laden
                </button>
              </div>
              <div className="small text-secondary lh-base mb-3">
                Je Beitrag werden Headline, Subline und Markdown-Text in der Zielsprache gepflegt.
              </div>
              {blogItems.length === 0 ? (
                <div className="border rounded-3 p-3 small text-secondary bg-white">Im aktuellen Gebiet gibt es noch keine Blogbeiträge.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {blogItems.map((item) => {
                    const translated = hasBlogTranslatedContent(item);
                    return (
                      <button
                        key={item.post_id}
                        type="button"
                        className={getI18nListRowClass(selectedBlogItem?.post_id === item.post_id)}
                        onClick={() => setSelectedBlogPostId(item.post_id)}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <strong className="small text-dark">{item.headline || 'Ohne Titel'}</strong>
                          <span className={getI18nTranslationBadgeClass(item.translation_is_stale, translated)}>
                            {item.translation_is_stale ? 'Veraltet' : translated ? 'Übersetzt' : 'Fehlt'}
                          </span>
                        </div>
                        <div className="small text-secondary lh-base">{item.subline || 'Keine Subline'}</div>
                        <div className="small text-secondary">
                          DE-Status: {item.source_status} · {item.source_created_at ? new Date(item.source_created_at).toLocaleDateString('de-DE') : 'ohne Datum'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div className="col-12 col-xl-8">
            {selectedBlogItem ? (
              <div className="d-grid gap-4">
                <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                  <div>
                    <h3 className="m-0 fs-5 fw-bold text-dark">{selectedBlogItem.headline || 'Ohne Titel'}</h3>
                    <p className="small text-secondary lh-base mt-2 mb-0">
                      Übersetze Headline, Subline und den Markdown-Text dieses Beitrags separat. Der deutsche Blog-Workflow bleibt im Bereich „Blog“.
                    </p>
                  </div>
                  <span className={getI18nTranslationBadgeClass(selectedBlogItem.translation_is_stale, hasBlogTranslatedContent(selectedBlogItem))}>
                    {selectedBlogItem.translation_is_stale ? 'Quelle geändert' : selectedBlogItem.translation_status}
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="border rounded-4 bg-white p-3 h-100 d-grid gap-2">
                      <span className="small text-secondary text-uppercase fw-bold">Deutscher Beitrag</span>
                      <strong className="text-dark">{selectedBlogItem.source_status}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="border rounded-4 bg-white p-3 h-100 d-grid gap-2">
                      <span className="small text-secondary text-uppercase fw-bold">Übersetzungsstatus</span>
                      <strong className="text-dark">{selectedBlogItem.translation_status}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="border rounded-4 bg-white p-3 h-100 d-grid gap-2">
                      <span className="small text-secondary text-uppercase fw-bold">Zuletzt aktualisiert</span>
                      <strong className="text-dark">{selectedBlogItem.translation_updated_at ? new Date(selectedBlogItem.translation_updated_at).toLocaleString('de-DE') : 'Noch nicht gespeichert'}</strong>
                    </div>
                  </div>
                </div>

                <div className="d-grid gap-3">
                  {BLOG_FIELD_DEFINITIONS.map((definition) => renderBlogFieldPair(selectedBlogItem, definition))}
                </div>

                <div className="border rounded-4 bg-light p-3">
                  <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap">
                    <label className="d-flex flex-column gap-2 small fw-bold text-secondary">
                      Status
                      <select
                        className="form-select"
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
                    <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary fw-semibold"
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
                        className={`btn fw-bold px-4 py-2 ${blogHasEdits && !blogSaving ? 'btn-success' : 'btn-secondary disabled'}`}
                        onClick={() => void saveSelectedBlogItem()}
                        disabled={!blogHasEdits || blogSaving}
                      >
                        {blogSaving ? 'Speichern …' : 'Blog-Übersetzung speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border rounded-4 p-4 small text-secondary bg-light">Wähle links einen Blogbeitrag, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : activeDomain === 'immobilien' && activeDomainMeta.enabled ? (
      <div className="bg-white border rounded-4 p-3 p-xl-4">
        {propertyStatus ? <div className={`alert ${propertyStatusTone === 'error' ? 'alert-danger' : 'alert-success'} mb-3`}>{propertyStatus}</div> : null}
        <div className="row g-3 g-xl-4 align-items-start">
          <aside className="col-12 col-xl-4">
            <div className="bg-light border rounded-4 p-3">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <h3 className="m-0 fs-5 fw-bold text-dark">Angebote</h3>
                <div className="d-flex flex-wrap gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary fw-semibold"
                    onClick={() => void runPropertyDraftBatchAi()}
                    disabled={propertyLoading || propertySaving || propertyBulkAiRunning || llmOptions.length === 0 || propertyDraftItemsCount === 0}
                  >
                    {propertyBulkAiRunning
                      ? 'Drafts werden übersetzt …'
                      : propertyEditorTab === 'texts'
                        ? 'Alle Draft-Texte mit KI übersetzen'
                        : 'Alle Draft-SEO/GEO-Felder mit KI übersetzen'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary fw-semibold"
                    onClick={() => void loadPropertyItems()}
                    disabled={propertyLoading || propertySaving || propertyBulkAiRunning}
                  >
                    Stand laden
                  </button>
                </div>
              </div>
              <div className="small text-secondary lh-base mb-3">
                Je Angebot werden SEO-, Beschreibungs- und Bildtexte in der Zielsprache getrennt vom deutschen Exposé gepflegt.
              </div>
              {propertyItems.length === 0 ? (
                <div className="border rounded-3 p-3 small text-secondary bg-white">Für den aktuellen Partner gibt es noch keine Partner-Immobilien.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {propertyItems.map((item) => {
                    const computedStatus = getComputedPropertyStatus(item);
                    return (
                      <button
                        key={item.offer_id}
                        type="button"
                        className={getI18nListRowClass(selectedPropertyItem?.offer_id === item.offer_id)}
                        onClick={() => setSelectedPropertyOfferId(item.offer_id)}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <strong className="small text-dark">{item.title || 'Ohne Titel'}</strong>
                          <span className={getPropertyStatusBadgeClass(computedStatus.visual)}>
                            {computedStatus.shortLabel}
                          </span>
                        </div>
                        <div className="small text-secondary lh-base">{item.address || `${item.offer_type || 'angebot'} · ${item.object_type || 'Objekt'}`}</div>
                        <div className="small text-secondary">
                          {item.offer_type || 'angebot'} · {item.object_type || 'Objekt'} · {item.source_updated_at ? new Date(item.source_updated_at).toLocaleDateString('de-DE') : 'ohne Datum'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div className="col-12 col-xl-8">
            {selectedPropertyItem ? (
              <div className="d-grid gap-4">
                <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                  <div className="d-grid gap-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h3 className="m-0 fs-5 fw-bold text-dark">{selectedPropertyItem.title || 'Ohne Titel'}</h3>
                      <div className="d-flex gap-2 flex-wrap">
                        <span className="badge rounded-pill text-secondary bg-light border">
                          {selectedPropertyItem.object_type || 'Objekt'}
                        </span>
                        <span className="badge rounded-pill text-secondary bg-light border">
                          {selectedPropertyItem.offer_type || 'Angebot'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const computedStatus = getComputedPropertyStatus(selectedPropertyItem);
                  return (
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                      <span className={getPropertyStatusBadgeClass(computedStatus.visual)}>
                        {computedStatus.label}
                      </span>
                      <span className="badge rounded-pill text-secondary bg-white border fw-semibold px-3 py-2">
                        Zuletzt aktualisiert: {selectedPropertyItem.translation_updated_at ? new Date(selectedPropertyItem.translation_updated_at).toLocaleString('de-DE') : 'Noch nicht gespeichert'}
                      </span>
                    </div>
                  );
                })()}

                <WorkspacePillTabs
                  items={[
                    { id: 'texts', label: 'Texte' },
                    { id: 'seo', label: 'SEO / GEO' },
                  ]}
                  activeId={propertyEditorTab}
                  onSelect={(tabId) => setPropertyEditorTab(tabId as typeof propertyEditorTab)}
                />

                <div className="border rounded-4 bg-light p-3 d-grid gap-2">
                  <div className="small text-secondary text-uppercase fw-bold">
                    {propertyEditorTab === 'texts' ? 'Texte übersetzen' : 'SEO / GEO übersetzen'}
                  </div>
                  <div className="small text-secondary lh-base">
                    {propertyEditorTab === 'texts'
                      ? 'Bearbeite die redaktionellen Exposé-Texte zeilen- und feldgenau. Quelle und Übersetzung sind jetzt pro Feld direkt gegenübergestellt.'
                      : 'Pflege Snippet-, AEO- und Bildtexte separat für die Zielsprache. KI-Hilfen wirken immer nur auf den aktuell gewählten Feldtyp.'}
                  </div>
                </div>

                <div className="d-grid gap-3">
                  {propertyVisibleFieldDefinitions.map((definition) => renderPropertyFieldPair(selectedPropertyItem, definition))}
                </div>

                <div className="border rounded-4 bg-light p-3">
                  <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-secondary fw-semibold"
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
                                translated_answer_summary: item.source_answer_summary,
                                translated_location_summary: item.source_location_summary,
                                translated_target_audience: item.source_target_audience,
                                translated_highlights: [...item.source_highlights],
                                translated_image_alt_texts: [...item.source_image_alt_texts],
                              }
                            : item
                        )));
                      }}
                      disabled={propertySaving || propertyBulkAiRunning}
                    >
                      Deutsch übernehmen
                    </button>
                    <button
                      type="button"
                      className={`btn fw-bold px-4 py-2 ${propertyHasEdits && !propertySaving && !propertyBulkAiRunning ? 'btn-success' : 'btn-secondary disabled'}`}
                      onClick={() => void saveSelectedPropertyItem()}
                      disabled={!propertyHasEdits || propertySaving || propertyBulkAiRunning}
                    >
                      {propertySaving ? 'Speichern …' : 'Immobilien-Übersetzung speichern'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border rounded-4 p-4 small text-secondary bg-light">Wähle links ein Immobilienangebot, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : activeDomain === 'referenzen' && activeDomainMeta.enabled ? (
      <div className="bg-white border rounded-4 p-3 p-xl-4">
        {referenceStatus ? <div className={`alert ${referenceStatusTone === 'error' ? 'alert-danger' : 'alert-success'} mb-3`}>{referenceStatus}</div> : null}
        <div className="row g-3 g-xl-4 align-items-start">
          <aside className="col-12 col-xl-4">
            <div className="bg-light border rounded-4 p-3">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <h3 className="m-0 fs-5 fw-bold text-dark">Referenzobjekte</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary fw-semibold"
                  onClick={() => void loadReferenceItems()}
                  disabled={referenceLoading || referenceSaving}
                >
                  Stand laden
                </button>
              </div>
              <div className="small text-secondary lh-base mb-3">
                Für Referenzen werden SEO-, Kurz- und Langtexte je Sprache separat gepflegt.
              </div>
              {referenceItems.length === 0 ? (
                <div className="border rounded-3 p-3 small text-secondary bg-white">Für diesen Partner sind aktuell keine Referenzobjekte vorhanden.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {referenceItems.map((item) => {
                    const translated = hasReferenceTranslatedContent(item);
                    return (
                      <button
                        key={item.reference_id}
                        type="button"
                        className={getI18nListRowClass(selectedReferenceItem?.reference_id === item.reference_id)}
                        onClick={() => setSelectedReferenceId(item.reference_id)}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <strong className="small text-dark">{item.title || 'Ohne Titel'}</strong>
                          <span className={getI18nTranslationBadgeClass(item.translation_is_stale, translated)}>
                            {item.translation_is_stale ? 'Veraltet' : translated ? 'Übersetzt' : 'Fehlt'}
                          </span>
                        </div>
                        <div className="small text-secondary lh-base">{item.region_label || 'Ohne Regionsangabe'}</div>
                        <div className="small text-secondary">
                          {item.source_updated_at ? new Date(item.source_updated_at).toLocaleDateString('de-DE') : 'ohne Datum'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div className="col-12 col-xl-8">
            {selectedReferenceItem ? (
              <div className="d-grid gap-4">
                <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                  <div>
                    <h3 className="m-0 fs-5 fw-bold text-dark">{selectedReferenceItem.title || 'Ohne Titel'}</h3>
                    <p className="small text-secondary lh-base mt-2 mb-0">
                      Übersetze hier die Referenztexte, die aktuell über die deutschen Override-Felder ausgespielt werden. Die deutsche Bearbeitung bleibt im Bereich „Referenzen“.
                    </p>
                  </div>
                  <span className={getI18nTranslationBadgeClass(selectedReferenceItem.translation_is_stale, hasReferenceTranslatedContent(selectedReferenceItem))}>
                    {selectedReferenceItem.translation_is_stale ? 'Quelle geändert' : selectedReferenceItem.translation_status}
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="border rounded-4 bg-white p-3 h-100 d-grid gap-2">
                      <span className="small text-secondary text-uppercase fw-bold">Region</span>
                      <strong className="text-dark">{selectedReferenceItem.region_label || 'Nicht gesetzt'}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="border rounded-4 bg-white p-3 h-100 d-grid gap-2">
                      <span className="small text-secondary text-uppercase fw-bold">Übersetzungsstatus</span>
                      <strong className="text-dark">{selectedReferenceItem.translation_status}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="border rounded-4 bg-white p-3 h-100 d-grid gap-2">
                      <span className="small text-secondary text-uppercase fw-bold">Zuletzt aktualisiert</span>
                      <strong className="text-dark">{selectedReferenceItem.translation_updated_at ? new Date(selectedReferenceItem.translation_updated_at).toLocaleString('de-DE') : 'Noch nicht gespeichert'}</strong>
                    </div>
                  </div>
                </div>

                <div className="d-grid gap-3">
                  {REFERENCE_FIELD_DEFINITIONS.map((definition) => renderReferenceFieldPair(selectedReferenceItem, definition))}
                </div>

                <div className="border rounded-4 bg-light p-3">
                  <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap">
                    <label className="d-flex flex-column gap-2 small fw-bold text-secondary">
                      Status
                      <select
                        className="form-select"
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
                    <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary fw-semibold"
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
                        className={`btn fw-bold px-4 py-2 ${referenceHasEdits && !referenceSaving ? 'btn-success' : 'btn-secondary disabled'}`}
                        onClick={() => void saveSelectedReferenceItem()}
                        disabled={!referenceHasEdits || referenceSaving}
                      >
                        {referenceSaving ? 'Speichern …' : 'Referenz-Übersetzung speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border rounded-4 p-4 small text-secondary bg-light">Wähle links ein Referenzobjekt, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
      </div>
      ) : activeDomain === 'gesuche' && activeDomainMeta.enabled ? (
      <div className="bg-white border rounded-4 p-3 p-xl-4">
        {requestStatus && requestStatusTone === 'error' ? <div className="alert alert-danger mb-3">{requestStatus}</div> : null}
        <div className="row g-3 g-xl-4 align-items-start">
          <aside className="col-12 col-xl-4">
            <div className="bg-light border rounded-4 p-3">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h3 className="m-0 fs-5 fw-bold text-dark">{requestLoadSummary ?? '0 Gesuche geladen'}</h3>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-circle fw-bold lh-1"
                onClick={() => setRequestDebugOpen(true)}
                disabled={!requestLoadDebug}
                aria-label="Debug-Informationen anzeigen"
              >
                i
              </button>
            </div>
            <input
              placeholder="Suchen..."
              value={requestListSearch}
              onChange={(event) => setRequestListSearch(event.target.value)}
              className="form-control form-control-sm"
            />
            <div className="d-flex gap-2 flex-wrap my-3">
              <button type="button" onClick={() => setRequestListFilter('all')} className={getRequestFilterButtonClass(requestListFilter === 'all')}>Alle</button>
              <button type="button" onClick={() => setRequestListFilter('haus')} className={getRequestFilterButtonClass(requestListFilter === 'haus')}>Haus</button>
              <button type="button" onClick={() => setRequestListFilter('wohnung')} className={getRequestFilterButtonClass(requestListFilter === 'wohnung')}>Wohnung</button>
            </div>
            {requestItems.length === 0 ? (
              <div className="border rounded-3 p-3 small text-secondary bg-white">Für diesen Partner sind aktuell keine Gesuche vorhanden.</div>
            ) : filteredRequestItems.length === 0 ? (
              <div className="small text-secondary">Keine Gesuche gefunden.</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {filteredRequestItems.map((item) => {
                  const requestMetaLabel = `${formatRequestModeLabel(item.request_type || '—')} · ${formatRequestObjectTypeLabel(item.object_type || null)} · ${item.region_label || 'Ohne Zielregion'}`;
                  const computedStatus = getComputedRequestStatus(item);
                  return (
                    <button
                      key={item.request_id}
                      type="button"
                      className={getRequestListRowClass(selectedRequestItem?.request_id === item.request_id)}
                      onClick={() => setSelectedRequestId(item.request_id)}
                    >
                      <span className="d-flex align-items-start justify-content-between gap-2 fw-semibold">
                        <span className="text-truncate">{item.title || 'Ohne Titel'}</span>
                        <span
                          aria-hidden="true"
                          className={`d-inline-block rounded-circle flex-shrink-0 mt-1 p-1 ${computedStatus.visual === 'translated' ? 'bg-success' : 'bg-danger'}`}
                        />
                      </span>
                      <span className="small text-secondary fw-bold text-uppercase">{requestMetaLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          </aside>

          <div className="col-12 col-xl-8">
            {selectedRequestItem ? (
              <div className="d-grid gap-4">
                <div className="border rounded-4 bg-light p-3 d-grid gap-3">
                  <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                    <div className="small text-secondary text-uppercase fw-bold">Überblick</div>
                    <span className={getRequestStatusBadgeClass(getComputedRequestStatus(selectedRequestItem).visual)}>
                      {selectedRequestItem.translation_is_stale ? 'Quelle geändert' : getComputedRequestStatus(selectedRequestItem).label}
                    </span>
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-lg-4 d-grid gap-1">
                      <div className="small text-secondary text-uppercase fw-bold">Gesuch-ID</div>
                      <div className="small text-dark fw-semibold lh-base">{selectedRequestItem.external_id || selectedRequestItem.request_id}</div>
                    </div>
                    <div className="col-12 col-lg-4 d-grid gap-1">
                      <div className="small text-secondary text-uppercase fw-bold">Quelle</div>
                      <div className="small text-dark fw-semibold lh-base">{selectedRequestItem.source || 'Nicht gesetzt'}</div>
                    </div>
                    <div className="col-12 col-lg-4 d-grid gap-1">
                      <div className="small text-secondary text-uppercase fw-bold">Aktualisiert</div>
                      <div className="small text-dark fw-semibold lh-base">{selectedRequestItem.source_updated_at ? new Date(selectedRequestItem.source_updated_at).toLocaleDateString('de-DE') : 'ohne Datum'}</div>
                    </div>
                  </div>

                  <div className="border rounded-3 bg-white p-3 d-grid gap-2">
                    <span className="small text-secondary text-uppercase fw-bold">CRM-Notiz</span>
                    <div className="small text-secondary lh-base text-break">
                      {selectedRequestItem.source_note || 'Keine CRM-Notiz vorhanden.'}
                    </div>
                  </div>
                </div>

                <WorkspacePillTabs
                  items={[
                    { id: 'texts', label: 'Texte' },
                    { id: 'seo', label: 'SEO / GEO' },
                  ]}
                  activeId={requestEditorTab}
                  onSelect={(tabId) => setRequestEditorTab(tabId as typeof requestEditorTab)}
                />

                <div className="d-grid gap-3">
                  {requestVisibleFieldDefinitions.map((definition) => renderRequestFieldPair(selectedRequestItem, definition))}
                </div>

                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    className={`btn fw-bold px-4 py-2 ${requestHasEdits && !requestSaving ? 'btn-success' : 'btn-secondary disabled'}`}
                    onClick={() => void saveSelectedRequestItem()}
                    disabled={!requestHasEdits || requestSaving}
                  >
                    {requestSaving ? 'Speichern …' : 'Übersetzung speichern'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border rounded-4 p-4 small text-secondary bg-light">Wähle links ein Gesuch, um die Übersetzung für {normalizeLocaleLabel(locale)} zu bearbeiten.</div>
            )}
          </div>
        </div>
        {requestDebugOpen && requestLoadDebug ? (
          <div
            className="modal d-block bg-dark bg-opacity-25"
            tabIndex={-1}
            onClick={() => setRequestDebugOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRequestDebugOpen(false);
            }}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-debug-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content rounded-4 border-0 shadow">
                <div className="modal-header">
                  <strong id="request-debug-title" className="modal-title fs-6">Gesuche Debug</strong>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setRequestDebugOpen(false)}
                    aria-label="Debug-Modal schließen"
                  />
                </div>
                <div className="modal-body d-grid gap-2 small text-secondary">
                  <div>requests={requestLoadDebug.requests}</div>
                  <div>overrides={requestLoadDebug.overrides}</div>
                  <div>translations={requestLoadDebug.translations}</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : (
      <div className="bg-white border rounded-4 p-3 p-xl-4">
        <div className="border border-secondary-subtle rounded-4 p-4 bg-light d-grid gap-3">
          <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div>
              <h3 className="m-0 fs-5 fw-bold text-dark">{activeDomainMeta.label}</h3>
              <p className="small text-secondary lh-base mt-2 mb-0">{activeDomainMeta.description}</p>
            </div>
            <span className={`badge rounded-pill fw-bold ${activeDomainMeta.enabled ? 'text-success bg-success-subtle border border-success-subtle' : 'text-secondary bg-secondary-subtle border border-secondary-subtle'}`}>
              {activeDomainMeta.enabled ? 'Anbindung folgt' : 'Nicht freigeschaltet'}
            </span>
          </div>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="bg-white border rounded-3 p-3 h-100 d-grid gap-2">
                <span className="small text-secondary text-uppercase fw-bold">Status</span>
                <strong className="text-dark">{activeDomainMeta.enabled ? 'Produktbereich wird als eigener I18N-Workflow vorbereitet.' : 'Produkt ist für diesen Partner aktuell nicht freigeschaltet.'}</strong>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="bg-white border rounded-3 p-3 h-100 d-grid gap-2">
                <span className="small text-secondary text-uppercase fw-bold">Nächster Ausbau</span>
                <strong className="text-dark">Datensatzbasierte Sprachpflege inkl. Status, Kosten und Aktualität.</strong>
              </div>
            </div>
          </div>
          <div className="border border-success-subtle rounded-3 bg-success-subtle text-success p-3 d-grid gap-2">
            <strong className="text-success">Produktbereich in Vorbereitung</strong>
            <span className="small lh-base">
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

const i18nWorkflowBadgeClass = (displayClass: DisplayTextClass): string => {
  if (displayClass === 'data_driven') return workspaceStyles.reportClassBadgeDataDriven;
  if (displayClass === 'market_expert') return workspaceStyles.reportClassBadgeMarketExpert;
  if (displayClass === 'profile') return workspaceStyles.reportClassBadgeProfile;
  return workspaceStyles.reportClassBadgeGeneral;
};

const i18nWorkflowLinkClass = (displayClass: DisplayTextClass): string => {
  if (displayClass === 'data_driven') return workspaceStyles.reportClassLinkDataDriven;
  if (displayClass === 'market_expert') return workspaceStyles.reportClassLinkMarketExpert;
  if (displayClass === 'profile') return workspaceStyles.reportClassLinkProfile;
  return workspaceStyles.reportClassLinkGeneral;
};

const i18nWorkflowActionClass = (displayClass: DisplayTextClass): string => {
  if (displayClass === 'data_driven') return workspaceStyles.reportClassActionDataDriven;
  if (displayClass === 'market_expert') return workspaceStyles.reportClassActionMarketExpert;
  if (displayClass === 'profile') return workspaceStyles.reportClassActionProfile;
  return workspaceStyles.reportClassActionGeneral;
};
