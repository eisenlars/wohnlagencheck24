'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import FactorForm, { type FactorFormHandle } from './FactorForm';
import TextEditorForm from './TextEditorForm';
import OffersManager from './OffersManager';
import ReferencesManager from './ReferencesManager';
import RequestsManager from './RequestsManager';
import BlogManager from './BlogManager';
import InternationalizationManager, { type I18nProductDomain } from './InternationalizationManager';
import PartnerSettingsPanel, { type SettingsSection } from './PartnerSettingsPanel';
import { INDIVIDUAL_MANDATORY_KEYS } from '@/lib/text-key-registry';
import { MANDATORY_MEDIA_KEYS, getMandatoryMediaLabel, isMandatoryMediaKey } from '@/lib/mandatory-media';
import { getTextKeyLabel } from '@/lib/text-key-labels';
import { readSessionViewState, writeSessionViewState } from '@/lib/ui/session-view-state';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import NetworkBookingsWorkspace from '@/components/network-partners/NetworkBookingsWorkspace';
import NetworkContentWorkspace from '@/components/network-partners/NetworkContentWorkspace';
import NetworkBillingWorkspace from '@/components/network-partners/NetworkBillingWorkspace';
import NetworkAIWorkspace from '@/components/network-partners/NetworkAIWorkspace';
import NetworkPartnerManagementWorkspace from '@/components/network-partners/NetworkPartnerManagementWorkspace';
import type { NetworkPartnerDetailSection } from '@/components/network-partners/NetworkPartnerManagementWorkspace';
import dashboardStyles from './styles/dashboard.module.css';

type MainTab = 'texts' | 'factors' | 'marketing' | 'local_site' | 'immobilien' | 'referenzen' | 'gesuche' | 'blog' | 'international' | 'settings' | 'network_partners';
type WelcomeTool = {
  key: MainTab;
  title: string;
  description: string;
  icon: UtilityIconKey;
  networkPartnerSection?: NetworkPartnerSection;
  comingSoon?: boolean;
};

type PartnerFeatureRow = {
  key: string;
  label: string;
  enabled: boolean;
  monthly_price_eur: number;
  billing_unit?: string | null;
  note?: string | null;
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
  is_active?: boolean;
  is_public_live?: boolean | null;
  activation_status?: string | null;
  offer_visibility_mode?: string | null;
  request_visibility_mode?: string | null;
  reference_visibility_mode?: string | null;
  partner_preview_signoff_at?: string | null;
  admin_review_note?: string | null;
  [key: string]: unknown;
};

type TextFocusTarget = {
  tabId: string;
  sectionKey: string;
};

type MandatoryMissingEntry = {
  key?: string;
  reason?: "missing" | "default" | "unapproved";
};

type PersistedDashboardState = {
  activeMainTab?: MainTab;
  selectedAreaId?: string;
  showWelcome?: boolean;
  settingsSection?: SettingsSection;
  networkPartnerSection?: NetworkPartnerSection;
  selectedNetworkPartnerId?: string;
  networkPartnerDetailSection?: NetworkPartnerDetailSection;
};

type NetworkPartnerSection = 'overview' | 'bookings' | 'content' | 'billing' | 'ai';
type NetworkAreaOption = {
  id: string;
  label: string;
};

type DashboardClientProps = {
  initialMainTab?: MainTab;
  initialShowWelcome?: boolean;
  initialNetworkPartnerSection?: NetworkPartnerSection;
  initialSelectedNetworkPartnerId?: string | null;
  initialNetworkPartnerDetailSection?: NetworkPartnerDetailSection;
};

type VisibilityMode = 'partner_wide' | 'strict_local';

type DashboardBootstrapPayload = {
  ok?: boolean;
  last_login?: string | null;
  partner_first_name?: string | null;
  partner_features?: PartnerFeatureRow[];
  available_locales?: string[];
  partner_enabled_locales?: string[];
  global_partner_locales?: string[];
  global_public_locales?: string[];
  configs?: PartnerAreaConfig[];
  requested_area_id?: string | null;
  mandatory_progress?: {
    area_id?: string | null;
    completed?: number;
    total?: number;
    percent?: number;
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

function normalizeLocaleList(value: unknown): string[] {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => String(item ?? '').trim().toLowerCase())
      .filter((item) => /^[a-z]{2}(?:-[a-z0-9]{2,8}){0,2}$/.test(item)),
  ));
}

function isOrtslageAreaId(areaId: string): boolean {
  return String(areaId ?? '').trim().split('-').length > 3;
}

function mergePartnerAreaConfigs(
  currentConfigs: PartnerAreaConfig[],
  nextConfigs: PartnerAreaConfig[],
): PartnerAreaConfig[] {
  const merged = new Map<string, PartnerAreaConfig>();
  for (const config of currentConfigs) {
    const areaId = String(config?.area_id ?? '').trim();
    if (areaId) merged.set(areaId, config);
  }
  for (const config of nextConfigs) {
    const areaId = String(config?.area_id ?? '').trim();
    if (areaId) merged.set(areaId, config);
  }
  return Array.from(merged.values()).sort((a, b) =>
    String(a.area_id ?? '').localeCompare(String(b.area_id ?? ''), 'de'),
  );
}

type UtilityIconKey =
  | 'factors'
  | 'texts'
  | 'local_site'
  | 'international'
  | 'marketing'
  | 'blog'
  | 'social'
  | 'mail'
  | 'immobilien'
  | 'referenzen'
  | 'gesuche'
  | 'wizards'
  | 'forecast'
  | 'partner_ads'
  | 'partner_immobilien'
  | 'partner_gesuche';

type UtilityToolButton = {
  id: string;
  label: string;
  icon: UtilityIconKey;
  tab?: MainTab;
  networkPartnerSection?: NetworkPartnerSection;
  disabled?: boolean;
};

const MANDATORY_TAB_IDS = ['berater', 'makler', 'marktueberblick'] as const;
const DASHBOARD_UI_STATE_KEY = 'partner_dashboard_ui_state_v1';

const FEATURE_TAB_CODES: Partial<Record<MainTab, string>> = {
  immobilien: 'immobilien',
  referenzen: 'referenzen',
  gesuche: 'gesuche',
};

const DISTRICT_HEADER_SELECTOR_TABS = new Set<MainTab>([
  'texts',
  'marketing',
  'local_site',
  'blog',
  'international',
  'immobilien',
  'referenzen',
  'gesuche',
]);

function isMainTab(value: unknown): value is MainTab {
  return typeof value === 'string'
    && ['texts', 'factors', 'marketing', 'local_site', 'immobilien', 'referenzen', 'gesuche', 'blog', 'international', 'settings', 'network_partners'].includes(value);
}

function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string'
    && ['konto', 'profil', 'integrationen', 'kostenmonitor'].includes(value);
}

function isNetworkPartnerSection(value: unknown): value is NetworkPartnerSection {
  return typeof value === 'string'
    && ['overview', 'bookings', 'content', 'billing', 'ai'].includes(value);
}

function isNetworkPartnerDetailSection(value: unknown): value is NetworkPartnerDetailSection {
  return typeof value === 'string'
    && ['profile', 'bookings', 'content', 'billing'].includes(value);
}

function formatMandatoryLabel(key: string): string {
  if (!key) return "";
  if (isMandatoryMediaKey(key)) return getMandatoryMediaLabel(key);
  return getTextKeyLabel(key);
}

function formatActivationStatusLabel(config: PartnerAreaConfig | null): string {
  if (!config) return "";
  if (config.is_public_live) return "Online";
  const raw = String(config.activation_status ?? "").trim().toLowerCase();
  if (raw === "live") return "Online";
  if (raw === "approved_preview") return "Preview freigegeben";
  if (config.is_active) return "Aktiv";
  if (raw === "ready_for_review") return "Freigabebereit";
  if (raw === "in_review") return "In Prüfung";
  if (raw === "changes_requested") return "Nachbesserung angefordert";
  if (raw === "in_progress") return "Gebiet zugewiesen";
  return "Gebiet zugewiesen";
}

function resolveActivationStatusKey(config: PartnerAreaConfig | null): string {
  if (!config) return "";
  if (config.is_public_live) return "live";
  const raw = String(config.activation_status ?? "").trim().toLowerCase();
  if (raw === "approved_preview" || raw === "live" || raw === "ready_for_review" || raw === "in_review" || raw === "changes_requested" || raw === "in_progress") {
    return raw;
  }
  if (config.is_active) return "approved_preview";
  return "assigned";
}

function activationToneClass(statusKey: string): string {
  if (statusKey === 'live') return dashboardStyles.activationToneLive;
  if (statusKey === 'approved_preview' || statusKey === 'ready_for_review' || statusKey === 'in_review') {
    return dashboardStyles.activationTonePreview;
  }
  if (statusKey === 'changes_requested') return dashboardStyles.activationToneError;
  return dashboardStyles.activationToneAssigned;
}

function reviewMessageToneClass(tone: 'info' | 'success' | 'error'): string {
  if (tone === 'success') return dashboardStyles.reviewMessageSuccess;
  if (tone === 'error') return dashboardStyles.reviewMessageError;
  return dashboardStyles.reviewMessageInfo;
}

function utilityToolButtonClass(active: boolean, hovered: boolean, disabled: boolean): string {
  return [
    dashboardStyles.toolIconButton,
    active || hovered ? dashboardStyles.toolIconButtonHighlighted : '',
    disabled ? dashboardStyles.toolIconButtonDisabled : '',
  ].filter(Boolean).join(' ');
}

function districtButtonClass(active: boolean, isAreaActive: boolean): string {
  return [
    dashboardStyles.districtButton,
    'd-flex align-items-center',
    active
      ? dashboardStyles.districtButtonSelected
      : isAreaActive
        ? dashboardStyles.districtButtonActive
        : dashboardStyles.districtButtonInactive,
  ].join(' ');
}

function subAreaButtonClass(active: boolean): string {
  return [
    dashboardStyles.subAreaButton,
    active ? dashboardStyles.subAreaButtonActive : '',
  ].filter(Boolean).join(' ');
}

function activationTabClass(active: boolean, hovered: boolean): string {
  return [
    dashboardStyles.activationTabButton,
    active ? dashboardStyles.activationTabButtonActive : '',
    !active && hovered ? dashboardStyles.activationTabButtonHovered : '',
  ].filter(Boolean).join(' ');
}

function welcomeCardClass(disabled: boolean): string {
  return [
    dashboardStyles.welcomeCard,
    disabled ? dashboardStyles.welcomeCardDisabled : '',
  ].filter(Boolean).join(' ');
}

function findDistrictConfig(
  configs: PartnerAreaConfig[],
  config: PartnerAreaConfig | null,
): PartnerAreaConfig | null {
  if (!config) return null;
  const districtId = config.area_id.split('-').slice(0, 3).join('-');
  return configs.find((entry) => entry.area_id === districtId) ?? null;
}

function formatRegionHeaderTitle(
  configs: PartnerAreaConfig[],
  config: PartnerAreaConfig | null,
): string {
  if (!config) return '';
  const areaName = String(config.areas?.name ?? '').trim();
  const isOrtslage = config.area_id.split('-').length > 3;
  const districtName = String(findDistrictConfig(configs, config)?.areas?.name ?? '').trim();
  const areaLabel = areaName ? `${config.area_id} ${areaName}` : config.area_id;
  if (!isOrtslage) {
    return areaLabel || districtName || config.area_id;
  }
  if (areaName && districtName && districtName !== areaName) {
    return `${areaLabel} (${districtName})`;
  }
  return areaLabel || districtName || config.area_id;
}

function normalizeVisibilityMode(value: unknown): "partner_wide" | "strict_local" {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "strict_local" ? "strict_local" : "partner_wide";
}

function buildPreviewHref(config: PartnerAreaConfig | null): string | null {
  if (!config?.areas) return null;
  const bundeslandSlug = String(config.areas.bundesland_slug ?? '').trim();
  const slug = String(config.areas.slug ?? '').trim();
  const parentSlug = String(config.areas.parent_slug ?? '').trim();
  if (!bundeslandSlug || !slug) return null;

  const isOrtslage = config.area_id.split('-').length > 3;
  if (!isOrtslage) {
    return `/preview/immobilienmarkt/${bundeslandSlug}/${slug}`;
  }

  if (!parentSlug) return null;
  return `/preview/immobilienmarkt/${bundeslandSlug}/${parentSlug}/${slug}`;
}

function formatTimestampLabel(value: string | null | undefined): string {
  const iso = String(value ?? '').trim();
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('de-DE');
}

function mergeAreaMappingUpdate(config: PartnerAreaConfig, mapping: Partial<PartnerAreaConfig>): PartnerAreaConfig {
  return {
    ...config,
    is_active: ("is_active" in mapping) ? mapping.is_active : config.is_active,
    is_public_live: ("is_public_live" in mapping) ? mapping.is_public_live : config.is_public_live,
    activation_status: ("activation_status" in mapping) ? mapping.activation_status : config.activation_status,
    partner_preview_signoff_at: ("partner_preview_signoff_at" in mapping) ? mapping.partner_preview_signoff_at : (config.partner_preview_signoff_at ?? null),
    admin_review_note: ("admin_review_note" in mapping) ? mapping.admin_review_note : (config.admin_review_note ?? null),
  };
}

function renderUtilityIcon(icon: UtilityIconKey, size = 17) {
  const baseProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (icon) {
    case 'factors':
      return (
        <svg {...baseProps}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19v-11" />
        </svg>
      );
    case 'texts':
      return (
        <svg {...baseProps}>
          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
          <path d="m13 7 4 4" />
        </svg>
      );
    case 'local_site':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="m12 8 3 3-3 5-3-5 3-3Z" />
        </svg>
      );
    case 'international':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case 'marketing':
      return (
        <svg {...baseProps}>
          <path d="M4 17 10 11l4 4 6-8" />
          <path d="M17 7h3v3" />
        </svg>
      );
    case 'blog':
      return (
        <svg {...baseProps}>
          <path d="M7 4h8l4 4v12H7z" />
          <path d="M15 4v4h4" />
          <path d="M10 13h6" />
          <path d="M10 17h6" />
        </svg>
      );
    case 'social':
      return (
        <svg {...baseProps}>
          <path d="M4 14V8l10-4v16l-10-4Z" />
          <path d="M14 10h2a4 4 0 0 1 0 8h-2" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...baseProps}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="m4 8 8 6 8-6" />
        </svg>
      );
    case 'immobilien':
      return (
        <svg {...baseProps}>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6.5 10.5V20h11v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'referenzen':
      return (
        <svg {...baseProps}>
          <rect x="5" y="5" width="10" height="14" rx="2" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case 'gesuche':
      return (
        <svg {...baseProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case 'wizards':
      return (
        <svg {...baseProps}>
          <path d="m5 19 10-10" />
          <path d="m14 6 1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" />
          <path d="m17 12 .7-1.4L19 10l-1.3-.6L17 8l-.7 1.4L15 10l1.3.6L17 12Z" />
        </svg>
      );
    case 'forecast':
      return (
        <svg {...baseProps}>
          <path d="M4 16c1.5 0 1.5-4 3-4s1.5 6 3 6 1.5-10 3-10 1.5 6 3 6 1.5-2 3-2" />
        </svg>
      );
    case 'partner_ads':
      return (
        <svg {...baseProps}>
          <path d="M4 14V8l10-4v16l-10-4Z" />
          <path d="M16 10h2a3 3 0 0 1 0 6h-2" />
        </svg>
      );
    case 'partner_immobilien':
      return (
        <svg {...baseProps}>
          <path d="M5 20V9l7-5 7 5v11" />
          <path d="M9 20v-5h6v5" />
          <path d="M8 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      );
    case 'partner_gesuche':
      return (
        <svg {...baseProps}>
          <circle cx="10" cy="10" r="4.5" />
          <path d="M2.5 20c1.5-3 4.3-4.5 7.5-4.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      );
  }
}

export default function DashboardClient({
  initialMainTab,
  initialShowWelcome,
  initialNetworkPartnerSection,
  initialSelectedNetworkPartnerId,
  initialNetworkPartnerDetailSection,
}: DashboardClientProps = {}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const factorFormRef = useRef<FactorFormHandle | null>(null);
  const [configs, setConfigs] = useState<PartnerAreaConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PartnerAreaConfig | null>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [factorPaneLoading, setFactorPaneLoading] = useState(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [partnerFirstName, setPartnerFirstName] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [textFocusTarget, setTextFocusTarget] = useState<TextFocusTarget | null>(null);
  const [activationEditorMode, setActivationEditorMode] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [hoveredUtilityToolId, setHoveredUtilityToolId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('konto');
  const [submitReviewBusy, setSubmitReviewBusy] = useState(false);
  const [submitReviewMessage, setSubmitReviewMessage] = useState<string | null>(null);
  const [submitReviewTone, setSubmitReviewTone] = useState<'info' | 'success' | 'error'>('info');
  const [submitReviewSuccessOpen, setSubmitReviewSuccessOpen] = useState(false);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  const [previewRequestMessage, setPreviewRequestMessage] = useState<string | null>(null);
  const [previewRequestTone, setPreviewRequestTone] = useState<'info' | 'success' | 'error'>('info');
  const [visibilitySaveBusy, setVisibilitySaveBusy] = useState(false);
  const [visibilitySaveMessage, setVisibilitySaveMessage] = useState<string | null>(null);
  const [visibilitySaveTone, setVisibilitySaveTone] = useState<'info' | 'success' | 'error'>('info');
  const [partnerFeatures, setPartnerFeatures] = useState<PartnerFeatureRow[]>([]);
  const [availableInternationalLocales, setAvailableInternationalLocales] = useState<string[]>([]);
  const [globalPartnerInternationalLocales, setGlobalPartnerInternationalLocales] = useState<string[]>([]);
  const [mandatoryProgress, setMandatoryProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length,
  });
  const [mandatoryProgressLoading, setMandatoryProgressLoading] = useState(true);
  const lastMandatoryAreaIdRef = useRef<string | null>(null);
  const bootstrappedMandatoryAreaIdRef = useRef<string | null>(null);
  const [animatedMandatoryPercent, setAnimatedMandatoryPercent] = useState(0);
  const [hoveredActivationTabId, setHoveredActivationTabId] = useState<string | null>(null);
  const [progressRefreshTick, setProgressRefreshTick] = useState(0);
  const progressRequestRef = useRef(0);
  const hasAnimatedMandatoryPercentRef = useRef(false);
  const internationalLocalesLoadedRef = useRef(false);
  const detailedConfigsLoadedRef = useRef(false);
  const detailedConfigsLoadingRef = useRef(false);

  // Werkzeug-Modus umschalten
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('factors');
  const [networkPartnerSection, setNetworkPartnerSection] = useState<NetworkPartnerSection>(initialNetworkPartnerSection ?? 'overview');
  const [selectedNetworkPartnerId, setSelectedNetworkPartnerId] = useState<string | null>(initialSelectedNetworkPartnerId ?? null);
  const [networkPartnerDetailSection, setNetworkPartnerDetailSection] = useState<NetworkPartnerDetailSection>(initialNetworkPartnerDetailSection ?? 'profile');

  const handleTextMandatoryProgressChange = useCallback((payload: { areaId: string; completed: number; total: number; percent?: number }) => {
    if (activeMainTab !== 'texts') return;
    if (!payload.areaId) return;
    setMandatoryProgress({
      completed: Number.isFinite(payload.completed) ? payload.completed : 0,
      total: Number.isFinite(payload.total) && payload.total > 0
        ? payload.total
        : INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length,
    });
    setMandatoryProgressLoading(false);
  }, [activeMainTab]);

  const ensureDetailedConfigs = useCallback(async () => {
    if (loading) return;
    if (detailedConfigsLoadedRef.current || detailedConfigsLoadingRef.current) return;
    detailedConfigsLoadingRef.current = true;
    try {
      const requestUrl = withDebugTimingUrl('/api/partner/dashboard/bootstrap?mode=core&include_children=1');
      const startedAt = performance.now();
      const res = await fetch(requestUrl, { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(res, 'partner')) {
        return;
      }
      const payload = await res.json().catch(() => null) as DashboardBootstrapPayload | null;
      logDebugTiming(requestUrl, performance.now() - startedAt, payload);
      if (!res.ok) return;
      const nextConfigs = Array.isArray(payload?.configs) ? payload.configs : [];
      if (nextConfigs.length === 0) return;
      detailedConfigsLoadedRef.current = nextConfigs.some((config) => isOrtslageAreaId(String(config.area_id ?? '')));
      setConfigs((prev) => mergePartnerAreaConfigs(prev, nextConfigs));
      setSelectedConfig((prev) => (
        prev
          ? (nextConfigs.find((config) => config.area_id === prev.area_id) ?? prev)
          : prev
      ));
    } finally {
      detailedConfigsLoadingRef.current = false;
    }
  }, [loading]);

  const headerConfig = useMemo(() => {
    switch (activeMainTab) {
      case 'texts':
        return {
          title: 'Berichte & Texte',
          description: 'Texte und Berichte für die ausgewählte Region verwalten und optimieren.',
          isRegionBased: true,
          showDistrictSelector: true,
        };
      case 'factors':
        return {
          title: 'Wertanpassungen',
          description: 'Werte, Faktoren und Kennzahlen der Region prüfen und bei Bedarf anpassen.',
          isRegionBased: true,
          showDistrictSelector: false,
        };
      case 'marketing':
        return {
          title: 'SEO & GEO',
          description: 'SEO- und GEO-Inhalte für das gewählte Gebiet pflegen und ausrichten.',
          isRegionBased: true,
          showDistrictSelector: true,
        };
      case 'local_site':
        return {
          title: 'Lokale Website',
          description: 'Regionale Inhalte der lokalen Website für das gewählte Gebiet bearbeiten.',
          isRegionBased: true,
          showDistrictSelector: true,
        };
      case 'blog':
        return {
          title: 'Blog',
          description: 'Blogbeiträge aus Marktüberblick-Texten generieren und veröffentlichen.',
          isRegionBased: true,
          showDistrictSelector: true,
        };
      case 'international':
        return {
          title: 'Internationalisierung',
          description: 'Sprachen und Übersetzungsstand für das gewählte Gebiet verwalten.',
          isRegionBased: true,
          showDistrictSelector: true,
        };
      case 'gesuche':
        return {
          title: 'Gesuche',
          description: 'CRM-Gesuche im gewählten Ausspielgebiet prüfen und individuell anpassen.',
          isRegionBased: false,
          showDistrictSelector: true,
        };
      case 'referenzen':
        return {
          title: 'Referenzen',
          description: 'Referenzobjekte im gewählten Ausspielgebiet prüfen und individuell anpassen.',
          isRegionBased: false,
          showDistrictSelector: true,
        };
      case 'settings':
        return {
          title: 'Einstellungen',
          description: 'Konto, Partnerprofil, Anbindungen und Kostenmonitor verwalten.',
          isRegionBased: false,
          showDistrictSelector: false,
        };
      case 'network_partners':
        if (networkPartnerSection === 'bookings') {
          return {
            title: 'Buchungen',
            description: 'Alle Netzwerkpartner-Buchungen portalweit steuern und operativ überwachen.',
            isRegionBased: false,
            showDistrictSelector: false,
          };
        }
        if (networkPartnerSection === 'content') {
          return {
            title: 'Content & Review',
            description: 'Content-Fälle und Freigaben über alle Netzwerkpartner hinweg bearbeiten.',
            isRegionBased: false,
            showDistrictSelector: false,
          };
        }
        if (networkPartnerSection === 'billing') {
          return {
            title: 'Partnererlöse',
            description: 'Erlöse, Potenziale und Abrechnungsbasis im Netzwerkpartner-Geschäft transparent verfolgen.',
            isRegionBased: false,
            showDistrictSelector: false,
          };
        }
        if (networkPartnerSection === 'ai') {
          return {
            title: 'KI-Nutzung',
            description: 'Creditstand, Budgetlage und Usage über das Netzwerkpartner-Geschäft hinweg überwachen.',
            isRegionBased: false,
            showDistrictSelector: false,
          };
        }
        return {
          title: 'Netzwerkpartner Verwaltung',
          description: 'Regionale Partner im Master-Detail-Modell mit Zugängen, Buchungen, Content und Partnererlösen verwalten.',
          isRegionBased: false,
          showDistrictSelector: false,
        };
      case 'immobilien':
      default:
        return {
          title: 'Immobilien',
          description: 'CRM-Angebote im gewählten Ausspielgebiet prüfen und individuell anpassen.',
          isRegionBased: false,
          showDistrictSelector: true,
        };
    }
  }, [activeMainTab, networkPartnerSection]);

  useEffect(() => {
    async function loadData() {
      const persisted = readSessionViewState<PersistedDashboardState>(DASHBOARD_UI_STATE_KEY);
      const restoredAreaId = String(persisted?.selectedAreaId ?? '').trim();
      const restoredTab = isMainTab(persisted?.activeMainTab) ? persisted?.activeMainTab : undefined;
      const preferredTab: MainTab = restoredTab ?? initialMainTab ?? 'factors';
      const nextShowWelcome = typeof persisted?.showWelcome === 'boolean'
        ? persisted.showWelcome
        : (typeof initialShowWelcome === 'boolean' ? initialShowWelcome : true);
      const includeChildrenOnBootstrap = isOrtslageAreaId(restoredAreaId)
        || preferredTab === 'factors';
      const includeLocalesOnBootstrap = preferredTab === 'international';
      const bootstrapParams = new URLSearchParams({ mode: 'core' });
      if (includeChildrenOnBootstrap) bootstrapParams.set('include_children', '1');
      if (includeLocalesOnBootstrap) bootstrapParams.set('include_locales', '1');
      const bootstrapPath = `/api/partner/dashboard/bootstrap?${bootstrapParams.toString()}`;
      const bootstrapUrl = withDebugTimingUrl(bootstrapPath);

      const startedAt = performance.now();
      const res = await fetch(bootstrapUrl, { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(res, 'partner')) {
        return;
      }
      const payload = await res.json().catch(() => null) as DashboardBootstrapPayload | null;
      logDebugTiming(bootstrapUrl, performance.now() - startedAt, payload);
      if (!res.ok) {
        throw new Error(String(payload && 'error' in payload ? (payload as { error?: unknown }).error ?? 'Dashboard konnte nicht geladen werden.' : 'Dashboard konnte nicht geladen werden.'));
      }
      const mergedConfigs: PartnerAreaConfig[] = Array.isArray(payload?.configs) ? payload.configs : [];

      queueMicrotask(() => {
        setLastLogin(String(payload?.last_login ?? '').trim() || null);
        setPartnerFirstName(String(payload?.partner_first_name ?? '').trim() || null);
        setPartnerFeatures(Array.isArray(payload?.partner_features) ? payload.partner_features : []);
        if (includeLocalesOnBootstrap) {
          internationalLocalesLoadedRef.current = true;
          setAvailableInternationalLocales(normalizeLocaleList(payload?.available_locales));
          setGlobalPartnerInternationalLocales(normalizeLocaleList(payload?.global_partner_locales));
        } else {
          internationalLocalesLoadedRef.current = false;
        }
        if (mergedConfigs.length > 0) {
          const restoredArea = restoredAreaId ? mergedConfigs.find((cfg) => cfg.area_id === restoredAreaId) : undefined;
          const hasActiveAreasLocal = mergedConfigs.some((cfg) => Boolean(cfg.is_active));
          const restoredSettingsSection = isSettingsSection(persisted?.settingsSection) ? persisted.settingsSection : 'konto';
          const restoredNetworkPartnerSection = isNetworkPartnerSection(persisted?.networkPartnerSection)
            ? persisted.networkPartnerSection
            : 'overview';
          const restoredNetworkPartnerDetailSection = isNetworkPartnerDetailSection(persisted?.networkPartnerDetailSection)
            ? persisted.networkPartnerDetailSection
            : 'profile';
          const restoredSelectedNetworkPartnerId = String(persisted?.selectedNetworkPartnerId ?? '').trim() || null;
          const nextTab: MainTab = !hasActiveAreasLocal && preferredTab !== 'texts'
            ? 'texts'
            : preferredTab;
          const nextSelected = restoredArea ?? mergedConfigs[0];

          detailedConfigsLoadedRef.current = includeChildrenOnBootstrap
            || mergedConfigs.some((cfg) => isOrtslageAreaId(String(cfg.area_id ?? '')));
          detailedConfigsLoadingRef.current = false;
          setConfigs(mergedConfigs);
          setSelectedConfig(nextSelected);
          setExpandedDistrict(nextSelected.area_id.split('-').slice(0, 3).join('-'));
          setActiveMainTab(nextTab);
          setSettingsSection(restoredSettingsSection);
          setNetworkPartnerSection(restoredNetworkPartnerSection ?? initialNetworkPartnerSection ?? 'overview');
          setSelectedNetworkPartnerId(restoredSelectedNetworkPartnerId ?? initialSelectedNetworkPartnerId ?? null);
          setNetworkPartnerDetailSection(restoredNetworkPartnerDetailSection ?? initialNetworkPartnerDetailSection ?? 'profile');
          setShowWelcome(nextShowWelcome);
          setMandatoryProgressLoading(Boolean(nextSelected?.area_id));
          bootstrappedMandatoryAreaIdRef.current = null;
        } else {
          detailedConfigsLoadedRef.current = false;
          detailedConfigsLoadingRef.current = false;
          setMandatoryProgress({ completed: 0, total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length });
          setMandatoryProgressLoading(false);
        }
        setLoading(false);
      });
    }
    void loadData();
  }, [
    supabase,
    initialMainTab,
    initialNetworkPartnerSection,
    initialNetworkPartnerDetailSection,
    initialSelectedNetworkPartnerId,
    initialShowWelcome,
  ]);

  useEffect(() => {
    if (loading) return;
    if (activeMainTab !== 'factors' && activeMainTab !== 'network_partners') return;
    if (showWelcome) return;
    void ensureDetailedConfigs();
  }, [activeMainTab, ensureDetailedConfigs, loading, showWelcome]);

  useEffect(() => {
    if (loading) return;
    if (activeMainTab !== 'international') return;
    if (internationalLocalesLoadedRef.current) return;
    let active = true;
    async function loadLocaleAvailability() {
      const startedAt = performance.now();
      const requestUrl = withDebugTimingUrl('/api/partner/dashboard/bootstrap?mode=locales');
      const res = await fetch(requestUrl, { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(res, 'partner')) {
        return;
      }
      const payload = await res.json().catch(() => null) as DashboardBootstrapPayload | null;
      logDebugTiming(requestUrl, performance.now() - startedAt, payload);
      if (!res.ok || !active) return;
      internationalLocalesLoadedRef.current = true;
      setAvailableInternationalLocales(normalizeLocaleList(payload?.available_locales));
      setGlobalPartnerInternationalLocales(normalizeLocaleList(payload?.global_partner_locales));
    }
    void loadLocaleAvailability();
    return () => {
      active = false;
    };
  }, [activeMainTab, loading]);

  const featuresByCode = useMemo(() => {
    const map = new Map<string, PartnerFeatureRow>();
    for (const row of partnerFeatures) {
      const code = String(row.key ?? '').trim().toLowerCase();
      if (code) map.set(code, row);
    }
    return map;
  }, [partnerFeatures]);

  const hasInternationalFeature = useMemo(
    () => globalPartnerInternationalLocales.length > 0 || partnerFeatures.some((row) => String(row.key ?? '').trim().toLowerCase().startsWith('international')),
    [globalPartnerInternationalLocales, partnerFeatures],
  );

  const hasInternationalEnabled = useMemo(
    () => availableInternationalLocales.length > 0 || hasInternationalFeature,
    [availableInternationalLocales.length, hasInternationalFeature],
  );

  const internationalLocales = useMemo(() => {
    if (availableInternationalLocales.length > 0) return availableInternationalLocales;
    const locales = partnerFeatures
      .map((row) => {
        const code = String(row.key ?? '').trim().toLowerCase();
        if (!code.startsWith('international')) return null;
        const suffix = code.replace(/^international[_-]?/, '').trim();
        if (!suffix) return 'en';
        return suffix;
      })
      .filter((v): v is string => typeof v === 'string' && /^[a-z]{2}(-[a-z]{2})?$/.test(v));
    const unique = Array.from(new Set(locales));
    return unique.length > 0 ? unique : ['en'];
  }, [availableInternationalLocales, partnerFeatures]);

  const networkAreaOptions = useMemo<NetworkAreaOption[]>(
    () => configs
      .map((config) => {
        const areaId = String(config.area_id ?? '').trim();
        if (!areaId) return null;
        const areaName = String(config.areas?.name ?? '').trim();
        return {
          id: areaId,
          label: areaName ? `${areaId} ${areaName}` : areaId,
        };
      })
      .filter((entry): entry is NetworkAreaOption => Boolean(entry)),
    [configs],
  );

  const isTabEnabled = (tab: MainTab): boolean => {
    if (tab === 'international') return hasInternationalFeature ? hasInternationalEnabled : false;
    const featureCode = FEATURE_TAB_CODES[tab];
    if (!featureCode) return true;
    const row = featuresByCode.get(featureCode);
    if (!row) return true;
    return row.enabled === true;
  };

  const internationalDomains = useMemo<I18nProductDomain[]>(() => {
    const immobilienEnabled = featuresByCode.get('immobilien')?.enabled !== false;
    const referenzenEnabled = featuresByCode.get('referenzen')?.enabled !== false;
    const gesucheEnabled = featuresByCode.get('gesuche')?.enabled !== false;

    return [
      {
        id: 'immobilienmarkt',
        label: 'Immobilienmarkt',
        description: 'Berichte, Markttexte, lokale Website und marktnahe Partnerinhalte.',
        enabled: true,
      },
      {
        id: 'blog',
        label: 'Blog',
        description: 'Beitraege und redaktionelle Inhalte als eigener Sprachbereich.',
        enabled: true,
      },
      {
        id: 'immobilien',
        label: 'Immobilien',
        description: 'Objektinhalte aus Angebotsdaten und Integrationen.',
        enabled: immobilienEnabled,
      },
      {
        id: 'referenzen',
        label: 'Referenzen',
        description: 'Referenzobjekte und Nachweis-Inhalte fuer spaetere Sprachpflege.',
        enabled: referenzenEnabled,
      },
      {
        id: 'gesuche',
        label: 'Gesuche',
        description: 'Suchprofile und Gesuche fuer spaetere mehrsprachige Ausspielung.',
        enabled: gesucheEnabled,
      },
    ];
  }, [featuresByCode]);

  const utilityToolGroups: UtilityToolButton[][] = [
    [
      { id: 'factors', tab: 'factors', label: 'Wertanpassungen', icon: 'factors' },
      { id: 'texts', tab: 'texts', label: 'Berichte & Texte', icon: 'texts' },
      { id: 'local_site', tab: 'local_site', label: 'Lokale Website', icon: 'local_site' },
      ...(hasInternationalFeature
        ? [{
          id: 'international',
          tab: 'international' as MainTab,
          label: isTabEnabled('international') ? 'Internationalisierung' : 'Internationalisierung (nicht freigeschaltet)',
          icon: 'international' as UtilityIconKey,
          disabled: !isTabEnabled('international'),
        }]
        : []),
    ],
    [
      { id: 'marketing', tab: 'marketing', label: 'SEO & GEO', icon: 'marketing' },
      { id: 'blog', tab: 'blog', label: 'Blog', icon: 'blog' },
      { id: 'social', label: 'Social Media (Bald verfügbar)', icon: 'social', disabled: true },
      { id: 'mail', label: 'E-Mail (Bald verfügbar)', icon: 'mail', disabled: true },
    ],
    [
      {
        id: 'immobilien',
        tab: 'immobilien',
        label: isTabEnabled('immobilien') ? 'Immobilien' : 'Immobilien (nicht freigeschaltet)',
        icon: 'immobilien',
        disabled: !isTabEnabled('immobilien'),
      },
      {
        id: 'referenzen',
        tab: 'referenzen',
        label: isTabEnabled('referenzen') ? 'Referenzen' : 'Referenzen (nicht freigeschaltet)',
        icon: 'referenzen',
        disabled: !isTabEnabled('referenzen'),
      },
      {
        id: 'gesuche',
        tab: 'gesuche',
        label: isTabEnabled('gesuche') ? 'Gesuche' : 'Gesuche (nicht freigeschaltet)',
        icon: 'gesuche',
        disabled: !isTabEnabled('gesuche'),
      },
      { id: 'wizards', label: 'Leadgeneratoren (Bald verfügbar)', icon: 'wizards', disabled: true },
      { id: 'forecast', label: 'Prognosemonitor (Bald verfügbar)', icon: 'forecast', disabled: true },
    ],
    [
      { id: 'partner_ads', label: 'Netzwerkpartner Verwaltung', icon: 'partner_ads', tab: 'network_partners', networkPartnerSection: 'overview' },
      { id: 'partner_billing', label: 'Partnererlöse', icon: 'marketing', tab: 'network_partners', networkPartnerSection: 'billing' },
    ],
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/partner/login');
  };

  const handleToolSelect = (tab: MainTab, nextNetworkPartnerSection?: NetworkPartnerSection) => {
    if (!canUseTool()) return;
    if (!isTabEnabled(tab)) return;
    if (tab === 'network_partners') {
      setNetworkPartnerSection(nextNetworkPartnerSection ?? 'overview');
    }
    if (tab === 'texts') {
      setMandatoryProgressLoading(true);
    }
    if (tab === 'factors') {
      void ensureDetailedConfigs();
    }
    setActiveMainTab(tab);
    setShowWelcome(false);
    setHoveredUtilityToolId(null);
    if (tab === 'texts') {
      setActivationEditorMode(false);
      setTextFocusTarget(null);
    }
    setShowSettingsMenu(false);
    if (tab === 'blog') {
      const kreis = configs.find((c) => c.area_id.split('-').length <= 3);
      if (kreis) setSelectedConfig(kreis);
    }
  };

  const handleSettingsSelect = (section: SettingsSection) => {
    setSettingsSection(section);
    setActiveMainTab('settings');
    setShowWelcome(false);
    setShowSettingsMenu(false);
    setHoveredUtilityToolId(null);
  };

  useEffect(() => {
    let mounted = true;
    const requestId = progressRequestRef.current + 1;
    progressRequestRef.current = requestId;
    async function loadMandatoryProgress() {
      const shouldShowMandatoryProgress = showWelcome;
      if (!shouldShowMandatoryProgress) {
        if (mounted && progressRequestRef.current === requestId) {
          setMandatoryProgressLoading(false);
        }
        return;
      }
      const currentAreaId = String(selectedConfig?.area_id ?? '').trim() || null;
      const areaChanged = lastMandatoryAreaIdRef.current !== currentAreaId;
      if (currentAreaId) {
        lastMandatoryAreaIdRef.current = currentAreaId;
      }
      if (!selectedConfig?.area_id) {
        if (mounted && progressRequestRef.current === requestId) {
          setMandatoryProgress({ completed: 0, total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length });
          setMandatoryProgressLoading(false);
        }
        return;
      }
      if (bootstrappedMandatoryAreaIdRef.current === currentAreaId && progressRefreshTick === 0 && !submitReviewMessage) {
        bootstrappedMandatoryAreaIdRef.current = null;
        return;
      }
      if (mounted && progressRequestRef.current === requestId && areaChanged) {
        setMandatoryProgressLoading(true);
      }
      const loadFallbackProgress = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const { data } = await supabase
          .from('report_texts')
          .select('section_key, optimized_content, status')
          .eq('partner_id', user.id)
          .eq('area_id', selectedConfig.area_id);
        if (!mounted || progressRequestRef.current !== requestId) return;
        const uniqueFilled = new Set<string>();
        for (const row of data ?? []) {
          const key = String(row.section_key ?? '');
          const isMandatoryText = INDIVIDUAL_MANDATORY_KEYS.includes(key as (typeof INDIVIDUAL_MANDATORY_KEYS)[number]);
          const isMandatoryMedia = MANDATORY_MEDIA_KEYS.includes(key as (typeof MANDATORY_MEDIA_KEYS)[number]);
          if (!isMandatoryText && !isMandatoryMedia) continue;
          const val = String(row.optimized_content ?? '').trim();
          if (val.length > 0) uniqueFilled.add(key);
        }
        setMandatoryProgress({
          completed: uniqueFilled.size,
          total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length,
        });
        setMandatoryProgressLoading(false);
      };

      try {
        const requestUrl = withDebugTimingUrl(
          `/api/partner/areas/${encodeURIComponent(selectedConfig.area_id)}/mandatory-status`,
        );
        const startedAt = performance.now();
        const res = await fetch(
          requestUrl,
          { method: "GET", cache: "no-store" },
        );
        const payload = await res.json().catch(() => ({}));
        logDebugTiming(requestUrl, performance.now() - startedAt, payload);
        if (!mounted || progressRequestRef.current !== requestId) return;

        if (!res.ok) {
          await loadFallbackProgress();
          return;
        }

        const completed = Number(payload?.progress?.completed ?? 0);
        const total = Number(payload?.progress?.total ?? (INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length));
        setMandatoryProgress({
          completed: Number.isFinite(completed) ? completed : 0,
          total: Number.isFinite(total) && total > 0 ? total : INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length,
        });
        setMandatoryProgressLoading(false);
      } catch {
        if (!mounted || progressRequestRef.current !== requestId) return;
        await loadFallbackProgress();
      }
    }
    loadMandatoryProgress();
    return () => {
      mounted = false;
    };
  }, [progressRefreshTick, selectedConfig?.area_id, showWelcome, submitReviewMessage, supabase]);

  useEffect(() => {
    if (loading) return;
    const payload: PersistedDashboardState = {
      activeMainTab,
      selectedAreaId: selectedConfig?.area_id,
      showWelcome,
      settingsSection,
      networkPartnerSection,
      selectedNetworkPartnerId: selectedNetworkPartnerId ?? undefined,
      networkPartnerDetailSection,
    };
    writeSessionViewState(DASHBOARD_UI_STATE_KEY, payload);
  }, [
    activeMainTab,
    selectedConfig?.area_id,
    settingsSection,
    showWelcome,
    networkPartnerSection,
    selectedNetworkPartnerId,
    networkPartnerDetailSection,
    loading,
  ]);

  const activeConfigs = configs.filter((c) => Boolean(c.is_active));
  const inactiveConfigs = configs.filter((c) => !Boolean(c.is_active));
  const hasActiveAreas = activeConfigs.length > 0;
  const onboardingMode = !hasActiveAreas;
  const regionScopeConfigs = hasActiveAreas ? activeConfigs : configs;
  const mainDistricts = configs.filter(c => c.area_id.split('-').length <= 3);
  const pendingDistricts = inactiveConfigs.filter((c) => c.area_id.split('-').length <= 3);
  const previewDistricts = activeConfigs.filter((c) => (
    c.area_id.split('-').length <= 3
    && resolveActivationStatusKey(c) === 'approved_preview'
    && !Boolean(c.is_public_live)
  ));
  const activationDistricts = onboardingMode ? mainDistricts : pendingDistricts;
  const isAwaitingAreaAssignment = onboardingMode && activationDistricts.length === 0;
  const scopedMainDistricts = regionScopeConfigs.filter(c => c.area_id.split('-').length <= 3);
  const hasRegionAssignments = configs.length > 0;
  const mandatoryPercent = mandatoryProgress.total > 0
    ? Math.max(0, Math.min(100, Math.round((mandatoryProgress.completed / mandatoryProgress.total) * 100)))
    : 0;

  useEffect(() => {
    if (mandatoryProgressLoading) {
      hasAnimatedMandatoryPercentRef.current = false;
      setAnimatedMandatoryPercent(0);
      return;
    }
    if (!hasAnimatedMandatoryPercentRef.current) {
      hasAnimatedMandatoryPercentRef.current = true;
      setAnimatedMandatoryPercent(0);
      const rafId = window.requestAnimationFrame(() => {
        setAnimatedMandatoryPercent(mandatoryPercent);
      });
      return () => window.cancelAnimationFrame(rafId);
    }
    setAnimatedMandatoryPercent(mandatoryPercent);
  }, [mandatoryProgressLoading, mandatoryPercent]);

  const mandatoryDirectLinks = [
    { key: 'immobilienmarkt_individuell_01', label: getTextKeyLabel('immobilienmarkt_individuell_01') },
    { key: 'immobilienmarkt_individuell_02', label: getTextKeyLabel('immobilienmarkt_individuell_02') },
    { key: 'immobilienmarkt_zitat', label: getTextKeyLabel('immobilienmarkt_zitat') },
    { key: 'immobilienmarkt_maklerempfehlung', label: getTextKeyLabel('immobilienmarkt_maklerempfehlung') },
  ] as const;

  const mandatoryAllowedKeys = new Set<string>(INDIVIDUAL_MANDATORY_KEYS);

  function resolveFocusTarget(sectionKey: string): TextFocusTarget {
    if (sectionKey.startsWith('berater_')) return { tabId: 'berater', sectionKey };
    if (sectionKey.startsWith('makler_')) return { tabId: 'makler', sectionKey };
    return { tabId: 'marktueberblick', sectionKey };
  }

  function openTextEditorAt(sectionKey: string) {
    const target = resolveFocusTarget(sectionKey);
    setTextFocusTarget(target);
    setActivationEditorMode(true);
    setMandatoryProgressLoading(true);
    setActiveMainTab('texts');
    setShowWelcome(false);
  }

  const canUseTool = (): boolean => {
    if (!onboardingMode) return true;
    return false;
  };

  const allowInactiveTextActivationSelection =
    activeMainTab === 'texts' &&
    showWelcome === false &&
    (onboardingMode || activationEditorMode);
  const showActivationNavigationInRegionSidebar = allowInactiveTextActivationSelection;
  const regionSidebarMainDistricts = showActivationNavigationInRegionSidebar ? mainDistricts : scopedMainDistricts;
  const regionSidebarScopeConfigs = showActivationNavigationInRegionSidebar ? configs : regionScopeConfigs;
  const hideUtilityForInactiveActivationSelection = allowInactiveTextActivationSelection && Boolean(selectedConfig) && !Boolean(selectedConfig?.is_active);
  const showUtilityBar = !showWelcome && !onboardingMode && !hideUtilityForInactiveActivationSelection;
  const selectedInScope = selectedConfig
    ? regionScopeConfigs.some((cfg) => cfg.area_id === selectedConfig.area_id)
    : false;
  const effectiveSelectedConfig = (allowInactiveTextActivationSelection && selectedConfig)
    ? selectedConfig
    : (selectedInScope ? selectedConfig : (scopedMainDistricts[0] ?? selectedConfig));
  const selectedWelcomeActivationConfig = selectedConfig
    ? activationDistricts.find((cfg) => cfg.area_id === selectedConfig.area_id) ?? null
    : null;
  const effectiveWelcomeActivationConfig = selectedWelcomeActivationConfig ?? activationDistricts[0] ?? null;
  const selectedWelcomePreviewConfig = selectedConfig
    ? previewDistricts.find((cfg) => cfg.area_id === selectedConfig.area_id) ?? null
    : null;
  const effectiveWelcomePreviewConfig = selectedWelcomePreviewConfig ?? previewDistricts[0] ?? null;
  const effectiveWelcomePreviewHref = buildPreviewHref(effectiveWelcomePreviewConfig);
  const effectiveWelcomePreviewSignoffAt = String(effectiveWelcomePreviewConfig?.partner_preview_signoff_at ?? '').trim();
  const effectiveAreaConfig = useMemo(
    () => (
      DISTRICT_HEADER_SELECTOR_TABS.has(activeMainTab)
        ? (findDistrictConfig(configs, effectiveSelectedConfig) ?? effectiveSelectedConfig)
        : effectiveSelectedConfig
    ),
    [activeMainTab, configs, effectiveSelectedConfig],
  );

  const showActivationPanelForEditorSelected = Boolean(effectiveAreaConfig && !effectiveAreaConfig.is_active);
  const showActivationPanelForWelcomeSelected = Boolean(effectiveWelcomeActivationConfig && !effectiveWelcomeActivationConfig.is_active);
  const hideTextsHeaderInActivationFlow = activeMainTab === 'texts' && showActivationPanelForEditorSelected;
  const activationStatusKey = resolveActivationStatusKey(effectiveAreaConfig);
  const isAwaitingAdminApproval = showActivationPanelForEditorSelected
    && (activationStatusKey === 'ready_for_review' || activationStatusKey === 'in_review');
  const welcomeActivationStatusKey = resolveActivationStatusKey(effectiveWelcomeActivationConfig);
  const isWelcomeAwaitingAdminApproval = showActivationPanelForWelcomeSelected
    && (welcomeActivationStatusKey === 'ready_for_review' || welcomeActivationStatusKey === 'in_review');
  const selectedPreviewStatusKey = resolveActivationStatusKey(effectiveAreaConfig);
  const showPreviewGuidanceForSelected = Boolean(
    effectiveAreaConfig
    && selectedPreviewStatusKey === 'approved_preview'
    && !Boolean(effectiveAreaConfig.is_public_live),
  );
  const selectedPreviewHref = buildPreviewHref(effectiveAreaConfig);
  const selectedPreviewSignoffAt = String(effectiveAreaConfig?.partner_preview_signoff_at ?? '').trim();
  const effectiveSelectedReviewNote = useMemo(() => {
    if (!effectiveAreaConfig) return '';
    const direct = String(effectiveAreaConfig.admin_review_note ?? '').trim();
    if (direct) return direct;
    const districtId = String(effectiveAreaConfig.area_id ?? '').split('-').slice(0, 3).join('-');
    const districtConfig = configs.find((cfg) => cfg.area_id === districtId) ?? null;
    return String(districtConfig?.admin_review_note ?? '').trim();
  }, [configs, effectiveAreaConfig]);
  const effectiveRegionHeaderTitle = useMemo(
    () => formatRegionHeaderTitle(configs, effectiveAreaConfig),
    [configs, effectiveAreaConfig],
  );
  const welcomeActivationReviewNote = useMemo(() => {
    if (!effectiveWelcomeActivationConfig) return '';
    return String(effectiveWelcomeActivationConfig.admin_review_note ?? '').trim();
  }, [effectiveWelcomeActivationConfig]);

  const effectiveOfferVisibilityMode = normalizeVisibilityMode(effectiveAreaConfig?.offer_visibility_mode);
  const effectiveRequestVisibilityMode = normalizeVisibilityMode(effectiveAreaConfig?.request_visibility_mode);
  const effectiveReferenceVisibilityMode = normalizeVisibilityMode(effectiveAreaConfig?.reference_visibility_mode);
  const scopedContentAreaConfig = effectiveAreaConfig ?? effectiveSelectedConfig;

  useEffect(() => {
    if (activeMainTab === 'settings') return;
    if (isTabEnabled(activeMainTab)) return;
    setActiveMainTab('factors');
  }, [activeMainTab, partnerFeatures]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasActiveAreas) return;
    if (showWelcome) return;
    if (allowInactiveTextActivationSelection && selectedConfig) return;
    if (!selectedConfig || !selectedInScope) {
      const next = scopedMainDistricts[0] ?? activeConfigs[0] ?? null;
      if (next) setSelectedConfig(next);
    }
  }, [hasActiveAreas, selectedConfig, selectedInScope, scopedMainDistricts, activeConfigs, showWelcome, allowInactiveTextActivationSelection]);

  useEffect(() => {
    if (activeMainTab !== 'texts' && activationEditorMode) {
      setActivationEditorMode(false);
    }
  }, [activeMainTab, activationEditorMode]);

  useEffect(() => {
    if (!activationEditorMode) return;
    if (selectedConfig?.is_active) {
      setActivationEditorMode(false);
    }
  }, [activationEditorMode, selectedConfig?.is_active]);

  useEffect(() => {
    if (!showWelcome) return;
    if (activationDistricts.length === 0) return;
    const selectedId = selectedConfig?.area_id ?? '';
    const exists = activationDistricts.some((cfg) => cfg.area_id === selectedId);
    if (!exists) {
      setSelectedConfig(activationDistricts[0]);
    }
  }, [showWelcome, activationDistricts, selectedConfig?.area_id]);

  useEffect(() => {
    if (!showWelcome) return;
    if (previewDistricts.length === 0) return;
    const selectedId = selectedConfig?.area_id ?? '';
    const previewDistrict = previewDistricts.find((cfg) => selectedId.startsWith(cfg.area_id)) ?? null;
    if (!previewDistrict) {
      setSelectedConfig(previewDistricts[0]);
      setExpandedDistrict(previewDistricts[0].area_id);
      return;
    }
    if (expandedDistrict !== previewDistrict.area_id) {
      setExpandedDistrict(previewDistrict.area_id);
    }
  }, [showWelcome, previewDistricts, selectedConfig?.area_id, expandedDistrict]);

  useEffect(() => {
    if (loading || showWelcome || activeMainTab !== 'factors' || !selectedConfig?.area_id) {
      setFactorPaneLoading(false);
      return;
    }
    setFactorPaneLoading(true);
  }, [activeMainTab, loading, selectedConfig?.area_id, showWelcome]);

  if (loading) return <FullscreenLoader show label="Dashboard wird geladen..." />;

  const handleSelectConfig = async (nextConfig: PartnerAreaConfig) => {
    const current = selectedConfig;
    const currentIsKreis = (current?.area_id?.split?.('-')?.length ?? 0) <= 3;
    const nextIsOrt = (nextConfig?.area_id?.split?.('-')?.length ?? 0) > 3;
    if (activeMainTab === 'factors' && currentIsKreis && nextIsOrt && factorFormRef.current) {
      await factorFormRef.current.autoSyncIfDirty();
    }
    setSelectedConfig(nextConfig);
    setShowWelcome(false);
    setSubmitReviewMessage(null);
    setSubmitReviewTone('info');
    setPreviewRequestMessage(null);
    setPreviewRequestTone('info');
  };

  const handleSubmitForReview = async () => {
    if (!effectiveAreaConfig || effectiveAreaConfig.is_active || submitReviewBusy) return;
    setSubmitReviewBusy(true);
    setSubmitReviewMessage(null);
    setSubmitReviewTone('info');
    try {
      const res = await fetch(`/api/partner/areas/${encodeURIComponent(effectiveAreaConfig.area_id)}/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(payload?.missing_keys) && payload.missing_keys.length > 0) {
          const entries = (payload.missing_keys as MandatoryMissingEntry[]).slice(0, 6);
          const defaults = entries.filter((entry) => entry?.reason === "default");
          const missing = entries.filter((entry) => entry?.reason === "missing");
          const unapproved = entries.filter((entry) => entry?.reason === "unapproved");
          const chunks: string[] = [];
          if (defaults.length > 0) {
            chunks.push(
              `Noch Standard: ${defaults.map((entry) => formatMandatoryLabel(String(entry.key ?? ""))).join(", ")}`,
            );
          }
          if (missing.length > 0) {
            chunks.push(
              `Fehlend: ${missing.map((entry) => formatMandatoryLabel(String(entry.key ?? ""))).join(", ")}`,
            );
          }
          if (unapproved.length > 0) {
            chunks.push(
              `Noch ungeprüft: ${unapproved.map((entry) => formatMandatoryLabel(String(entry.key ?? ""))).join(", ")}`,
            );
          }
          setSubmitReviewMessage(
            chunks.length > 0
              ? `Freigabe noch nicht möglich. ${chunks.join(" | ")}`
              : 'Freigabeprüfung kann nicht durchgeführt werden. Bitte fehlende Texte/Informationen ergänzen.',
          );
          setSubmitReviewTone('error');
        } else {
          const rawError = String(payload?.error ?? '');
          if (rawError.includes('Mandatory-Pruefung konnte Daten nicht laden')) {
            setSubmitReviewMessage('Freigabeprüfung kann nicht durchgeführt werden. Bitte fehlende Texte/Informationen ergänzen.');
          } else {
            setSubmitReviewMessage(rawError || `Freigabeanforderung fehlgeschlagen (${res.status}).`);
          }
          setSubmitReviewTone('error');
        }
        return;
      }

      const mapping = payload?.mapping as { area_id?: string; is_active?: boolean; activation_status?: string | null } | undefined;
      const notification = payload?.notification as {
        admin?: { sent?: boolean; reason?: string | null };
        partner?: { sent?: boolean; reason?: string | null };
      } | undefined;
      if (mapping?.area_id) {
        setConfigs((prev) => prev.map((cfg) => (
          cfg.area_id === mapping.area_id
            ? mergeAreaMappingUpdate(cfg, {
              is_active: Boolean(mapping.is_active),
              activation_status: mapping.activation_status ?? 'ready_for_review',
              partner_preview_signoff_at: null,
              admin_review_note: null,
            })
            : cfg
        )));
        setSelectedConfig((prev) => (
          prev && prev.area_id === mapping.area_id
            ? mergeAreaMappingUpdate(prev, {
              is_active: Boolean(mapping.is_active),
              activation_status: mapping.activation_status ?? 'ready_for_review',
              partner_preview_signoff_at: null,
              admin_review_note: null,
            })
            : prev
        ));
      }
      const mailIssues: string[] = [];
      if (notification?.admin?.sent === false) {
        mailIssues.push(`Admin-Mail nicht versendet (${String(notification.admin.reason ?? 'unbekannt')})`);
      }
      if (notification?.partner?.sent === false) {
        mailIssues.push(`Partner-Mail nicht versendet (${String(notification.partner.reason ?? 'unbekannt')})`);
      }
      if (mailIssues.length > 0) {
        setSubmitReviewMessage(`Freigabe wurde übermittelt, aber: ${mailIssues.join(' | ')}`);
        setSubmitReviewTone('error');
      } else {
        setSubmitReviewMessage(null);
        setSubmitReviewTone('info');
      }
      setSubmitReviewSuccessOpen(true);
    } catch {
      setSubmitReviewMessage('Freigabeanforderung konnte nicht gesendet werden. Bitte Verbindung prüfen und erneut versuchen.');
      setSubmitReviewTone('error');
    } finally {
      setSubmitReviewBusy(false);
    }
  };

  const handleRequestLive = async (config: PartnerAreaConfig | null) => {
    if (!config || previewRequestBusy) return;
    setPreviewRequestBusy(true);
    setPreviewRequestMessage(null);
    setPreviewRequestTone('info');
    try {
      const res = await fetch(`/api/partner/areas/${encodeURIComponent(config.area_id)}/request-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreviewRequestMessage(String(payload?.error ?? `Livegang-Anfrage fehlgeschlagen (${res.status}).`));
        setPreviewRequestTone('error');
        return;
      }

      const mapping = payload?.mapping as PartnerAreaConfig | undefined;
      if (mapping?.area_id) {
        setConfigs((prev) => prev.map((cfg) => (
          cfg.area_id === mapping.area_id ? mergeAreaMappingUpdate(cfg, mapping) : cfg
        )));
        setSelectedConfig((prev) => (
          prev && prev.area_id === mapping.area_id ? mergeAreaMappingUpdate(prev, mapping) : prev
        ));
      }

      const signedOffAt = String(mapping?.partner_preview_signoff_at ?? '').trim();
      const notification = payload?.notification as {
        admin?: { sent?: boolean; reason?: string | null };
        partner?: { sent?: boolean; reason?: string | null };
      } | undefined;
      const mailIssues: string[] = [];
      if (notification?.admin?.sent === false) {
        mailIssues.push(`Admin-Mail nicht versendet (${String(notification.admin.reason ?? 'unbekannt')})`);
      }
      if (notification?.partner?.sent === false) {
        mailIssues.push(`Bestätigungs-Mail nicht versendet (${String(notification.partner.reason ?? 'unbekannt')})`);
      }

      if (mailIssues.length > 0) {
        setPreviewRequestMessage(
          `Livegang angefragt am ${formatTimestampLabel(signedOffAt)}. ${mailIssues.join(' | ')}`,
        );
        setPreviewRequestTone('error');
      } else {
        setPreviewRequestMessage('');
        setPreviewRequestTone('success');
      }
    } catch {
      setPreviewRequestMessage('Livegang-Anfrage konnte nicht gesendet werden. Bitte Verbindung prüfen und erneut versuchen.');
      setPreviewRequestTone('error');
    } finally {
      setPreviewRequestBusy(false);
    }
  };

  const handleVisibilityModeChange = async (
    field: 'offer_visibility_mode' | 'request_visibility_mode' | 'reference_visibility_mode',
    value: VisibilityMode,
  ) => {
    if (!effectiveAreaConfig || visibilitySaveBusy) return;
    setVisibilitySaveBusy(true);
    setVisibilitySaveMessage(null);
    setVisibilitySaveTone('info');
    try {
      const res = await fetch(`/api/partner/areas/${encodeURIComponent(effectiveAreaConfig.area_id)}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVisibilitySaveMessage(String(payload?.error ?? `Sichtbarkeitsmodus konnte nicht gespeichert werden (${res.status}).`));
        setVisibilitySaveTone('error');
        return;
      }

      const mapping = payload?.mapping as PartnerAreaConfig | undefined;
      if (mapping?.area_id) {
        setConfigs((prev) => prev.map((cfg) => (
          cfg.area_id === mapping.area_id || cfg.area_id.startsWith(`${mapping.area_id}-`)
            ? mergeAreaMappingUpdate(cfg, mapping)
            : cfg
        )));
        setSelectedConfig((prev) => (
          prev && (prev.area_id === mapping.area_id || prev.area_id.startsWith(`${mapping.area_id}-`))
            ? mergeAreaMappingUpdate(prev, mapping)
            : prev
        ));
      }

      setVisibilitySaveMessage('Sichtbarkeitsmodus gespeichert.');
      setVisibilitySaveTone('success');
    } catch {
      setVisibilitySaveMessage('Sichtbarkeitsmodus konnte nicht gespeichert werden. Bitte Verbindung prüfen und erneut versuchen.');
      setVisibilitySaveTone('error');
    } finally {
      setVisibilitySaveBusy(false);
    }
  };

  return (
    <div className={`d-flex flex-column ${dashboardStyles.dashboardShell}`}>
      <FullscreenLoader show={submitReviewBusy} label="Daten werden geladen..." />
      {submitReviewSuccessOpen ? (
        <div
          className={`position-fixed d-flex align-items-center justify-content-center ${dashboardStyles.successOverlay}`}
          onClick={() => setSubmitReviewSuccessOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSubmitReviewSuccessOpen(false);
          }}
        >
          <div
            className={`bg-white rounded-4 p-4 ${dashboardStyles.successCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-review-success-title"
            aria-describedby="submit-review-success-text"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="submit-review-success-title" className={dashboardStyles.successTitle}>Freigabe erfolgreich angefordert</h3>
            <p id="submit-review-success-text" className={dashboardStyles.successText}>
              Dein Gebiet ist jetzt freigabebereit. Die Angaben liegen beim Admin zur Prüfung vor.
            </p>
            {submitReviewMessage && submitReviewTone === 'error' ? (
              <p className={`${dashboardStyles.successText} ${dashboardStyles.successTextError}`}>
                {submitReviewMessage}
              </p>
            ) : null}
            <div className="d-flex justify-content-end">
              <button
                type="button"
                className={dashboardStyles.successButton}
                onClick={() => setSubmitReviewSuccessOpen(false)}
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className={`d-flex align-items-center justify-content-between ${dashboardStyles.dashboardHeader}`}>
        <div
          className={`brand-header ${dashboardStyles.brandButton}`}
          onClick={() => setShowWelcome(true)}
          title="Zur Willkommensseite"
        >
          <Image
            alt="Immobilienmarkt & Standortprofile"
            width={48}
            height={48}
            src="/logo/wohnlagencheck24.svg"
            className="brand-icon d-block"
            priority
          />
          <span className="brand-text">
            <span className="brand-title">
              Wohnlagencheck<span className={dashboardStyles.brandAccent}>24</span>
            </span>
            <small>DATA-DRIVEN. EXPERT-LED.</small>
          </span>
        </div>
        <div className={`d-flex align-items-center gap-2 ${dashboardStyles.dashboardStatus}`}>
          <div>{lastLogin ? `Letzter Login: ${new Date(lastLogin).toLocaleString('de-DE')}` : 'Letzter Login: –'}</div>
          <button
            type="button"
            className={`d-inline-flex align-items-center gap-1 ${dashboardStyles.headerActionButton}`}
            onClick={() => {
              setShowWelcome(true);
              setShowSettingsMenu(false);
            }}
            title="Startseite"
          >
            <span aria-hidden>⌂</span>
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`d-inline-flex align-items-center gap-1 ${dashboardStyles.headerActionButton}`}
            onClick={handleLogout}
            title="Abmelden"
          >
            <span aria-hidden>⎋</span>
            <span>Ausloggen</span>
          </button>
          <div className="navbar navbar-light p-0 m-0 position-relative">
            <button
              className={`navbar-toggler d-inline-flex align-items-center justify-content-center ${dashboardStyles.burgerButton}`}
              onClick={() => setShowSettingsMenu((v) => !v)}
              title="Einstellungen-Menü"
              aria-label="Einstellungen öffnen"
            >
              <span className={`navbar-toggler-icon ${dashboardStyles.burgerIcon}`} />
            </button>
            {showSettingsMenu ? (
              <div className={`position-absolute ${dashboardStyles.menuDropdown}`}>
                <button className={dashboardStyles.menuItem} onClick={() => handleSettingsSelect('konto')}>
                  Konto
                </button>
                <button className={dashboardStyles.menuItem} onClick={() => handleSettingsSelect('profil')}>
                  Profil
                </button>
                <button className={dashboardStyles.menuItem} onClick={() => handleSettingsSelect('integrationen')}>
                  Anbindungen
                </button>
                <button className={dashboardStyles.menuItem} onClick={() => handleSettingsSelect('kostenmonitor')}>
                  Monitor
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`d-flex flex-grow-1 position-relative ${dashboardStyles.dashboardBody}`}>
      {activeMainTab === 'factors' && factorPaneLoading && !showWelcome ? (
        <FullscreenLoader show label="Wertanpassungen werden geladen..." fixed={false} />
      ) : null}

      {/* 1. SPALTE: WERKZEUGE (Ganz links, schmal) */}
      {showUtilityBar ? (
      <aside
        className={`d-flex flex-column align-items-center position-relative ${dashboardStyles.utilityBar}`}
        onMouseLeave={() => {
          setHoveredUtilityToolId(null);
        }}
      >
        <div className={`d-flex flex-column align-items-center gap-2 ${dashboardStyles.toolIconsGroup}`}>
          {utilityToolGroups.map((group, groupIndex) => (
            <div key={`utility-group-${groupIndex}`} className={`d-flex flex-column align-items-center gap-2 ${dashboardStyles.toolGroup}`}>
              {group.map((item) => {
                const active = item.tab
                  ? (
                    item.tab === 'network_partners'
                      ? activeMainTab === 'network_partners' && networkPartnerSection === (item.networkPartnerSection ?? 'overview')
                      : activeMainTab === item.tab
                  )
                  : false;
                const hovered = hoveredUtilityToolId === item.id;
                const disabled = Boolean(item.disabled);
                return (
                  <div key={item.id} className={dashboardStyles.toolIconWrap}>
                    <button
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        if (!item.tab) return;
                        handleToolSelect(item.tab, item.networkPartnerSection);
                      }}
                      onMouseEnter={() => setHoveredUtilityToolId(item.id)}
                      onFocus={() => setHoveredUtilityToolId(item.id)}
                      onBlur={() => setHoveredUtilityToolId((prev) => (prev === item.id ? null : prev))}
                      className={utilityToolButtonClass(active, hovered, disabled)}
                      aria-disabled={disabled}
                      aria-label={item.label}
                      title={item.label}
                    >
                      {renderUtilityIcon(item.icon)}
                    </button>
                    {hovered ? <span className={dashboardStyles.utilityTooltipCard}>{item.label}</span> : null}
                  </div>
                );
              })}
              {groupIndex < utilityToolGroups.length - 1 ? <div className={dashboardStyles.toolGroupDivider} /> : null}
            </div>
          ))}
        </div>
      </aside>
      ) : null}

      {/* 2. SPALTE: REGIONEN-NAVIGATION (Mitte) */}
      {activeMainTab !== 'immobilien'
        && activeMainTab !== 'referenzen'
        && activeMainTab !== 'gesuche'
        && activeMainTab !== 'network_partners'
        && activeMainTab !== 'settings'
        && activeMainTab !== 'texts'
        && activeMainTab !== 'international'
        && activeMainTab !== 'local_site'
        && activeMainTab !== 'marketing'
        && activeMainTab !== 'blog'
        && !showWelcome ? (
        <aside className={`d-flex flex-column ${dashboardStyles.regionSidebar}`}>
          <div className={dashboardStyles.sidebarHeader}>
            <h2 className={`m-0 ${dashboardStyles.sidebarTitle}`}>Regionen</h2>
            <p className={`mb-0 ${dashboardStyles.sidebarSubTitle}`}>
              {activeMainTab === 'factors' ? 'Faktor-Anpassung' : 'Content Management'}
            </p>
          </div>

          <div className="flex-grow-1 overflow-auto p-3">
            {regionSidebarMainDistricts.map(district => {
              const isSelected = Boolean(effectiveSelectedConfig?.area_id?.startsWith(district.area_id));
              const isExpanded = expandedDistrict === district.area_id;
              const subAreas = regionSidebarScopeConfigs.filter(c => c.area_id.startsWith(district.area_id) && c.area_id.split('-').length > 3);
              const districtIsActive = Boolean(district.is_active);

              return (
                <div key={district.area_id} className="mb-2">
                  <button
                    onClick={() => {
                      if (activeMainTab === 'factors') {
                        void ensureDetailedConfigs();
                      }
                      handleSelectConfig(district);
                      setExpandedDistrict(isExpanded ? null : district.area_id);
                    }}
                    className={districtButtonClass(isSelected, districtIsActive)}
                  >
                    <span className={dashboardStyles.sidebarDisclosureIcon}>{isExpanded ? '▼' : '▶'}</span>
                    <span className="flex-grow-1 text-start">{district.areas?.name}</span>
                  </button>

                  {isExpanded && subAreas.length > 0 && (
                    <div className={dashboardStyles.subAreaList}>
                      {subAreas.map(ort => (
                        <button
                          key={ort.area_id}
                          onClick={() => handleSelectConfig(ort)}
                          className={subAreaButtonClass(effectiveSelectedConfig?.area_id === ort.area_id)}
                        >
                          <span>{ort.areas?.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      ) : null}

      {/* 3. SPALTE: ARBEITSBEREICH (Rechts) */}
      <main
        className={showWelcome ? dashboardStyles.dashboardMainWelcome : dashboardStyles.dashboardMain}
      >
        {showWelcome ? (
          <div className={`d-flex flex-column ${dashboardStyles.welcomeWrap}`}>
            <div className={dashboardStyles.welcomeHeader}>
              <h1 className={dashboardStyles.welcomeTitle}>
                {partnerFirstName ? `Willkommen ${partnerFirstName}` : 'Willkommen'}
              </h1>
              <p className={dashboardStyles.welcomeText}>
                Hier verwaltest du Wertanpassungen, Texte und Marketing-Inhalte für deine Regionen.
                Wähl einfach einen Bereich aus und leg los.
              </p>
            </div>
            {(onboardingMode || activationDistricts.length > 0) ? (
              <div className={isAwaitingAreaAssignment ? dashboardStyles.welcomeActivationAwaitingBox : dashboardStyles.welcomeActivationBox}>
                <h2 className={dashboardStyles.welcomeSectionTitle}>
                  {isAwaitingAreaAssignment ? 'Warte auf Gebietszuweisung' : 'Gebietsfreigabe'}
                </h2>
                {isAwaitingAreaAssignment ? (
                  <p className={dashboardStyles.welcomeAwaitingAssignmentText}>
                    Schön, dass du dich in deinem Partnerbereich registriert und angemeldet hast. Bewahre dein Passwort sicher auf.
                    Der Administrator ist informiert und wird dir in Kürze deine Gebiete zuweisen.
                  </p>
                ) : (
                  <p className={dashboardStyles.welcomeIntroText}>
                    Vervollständige die Pflichtangaben je Gebiet und fordere danach die Freigabe an.
                  </p>
                )}
                {!isAwaitingAreaAssignment ? (
                  <div className={`d-flex flex-wrap gap-2 ${dashboardStyles.activationTabsRow}`}>
                    {activationDistricts.map((district) => {
                      const active = effectiveWelcomeActivationConfig?.area_id === district.area_id;
                      const label = district.areas?.name || district.areas?.slug || district.area_id;
                      return (
                        <button
                          key={district.area_id}
                          type="button"
                          onMouseEnter={() => setHoveredActivationTabId(district.area_id)}
                          onMouseLeave={() => setHoveredActivationTabId((prev) => (prev === district.area_id ? null : prev))}
                          onClick={() => {
                            setSelectedConfig(district);
                            setShowWelcome(true);
                            setProgressRefreshTick((prev) => prev + 1);
                          }}
                          className={activationTabClass(active, hoveredActivationTabId === district.area_id)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {!isAwaitingAreaAssignment && activationDistricts.length === 0 ? (
                  <div className={dashboardStyles.alreadyActiveInfo}>Alle zugewiesenen Gebiete sind bereits aktiv.</div>
                ) : !isAwaitingAreaAssignment && showActivationPanelForWelcomeSelected ? (
                  <div className={dashboardStyles.reviewPanelStrong}>
                    <div className={dashboardStyles.reviewPanelTitleLarge}>
                      Gebietsfreigabe {effectiveWelcomeActivationConfig?.areas?.name ?? ''}
                    </div>
                    {isWelcomeAwaitingAdminApproval ? (
                      <div className="mb-4">
                        <span className={dashboardStyles.awaitingApprovalBadge}>
                          {welcomeActivationStatusKey === 'in_review' ? 'In Prüfung' : 'Freigabebereit'}
                        </span>
                      </div>
                    ) : null}
                    <div className={dashboardStyles.reviewPanelTextLarge}>
                      {isWelcomeAwaitingAdminApproval
                        ? 'Deine Pflichtangaben wurden erfolgreich übermittelt und liegen beim Admin zur Prüfung vor. Solange die Prüfung läuft, ist die Aktivierungsmaske gesperrt. Du kannst nach der Freigabe wie gewohnt weiterarbeiten.'
                        : 'Pflichtangaben fehlen! Vervollständige deine Eingaben als Voraussetzung für die Freigabe deines Gebietes.'}
                    </div>
                    {welcomeActivationStatusKey === 'changes_requested' && welcomeActivationReviewNote ? (
                      <div className={`${dashboardStyles.reviewIssueBox} mb-3`}>
                        <div className="fw-bold mb-1">Nachbesserung erforderlich</div>
                        <div className={dashboardStyles.reviewIssueText}>{welcomeActivationReviewNote}</div>
                      </div>
                    ) : null}
                    {!isWelcomeAwaitingAdminApproval ? (
                      <div
                        className={`${dashboardStyles.progressWrap} ${mandatoryProgressLoading ? dashboardStyles.progressWrapLoading : ''} mt-4 mb-3`}
                      >
                        {mandatoryProgressLoading ? (
                          <>
                            <div className="d-flex justify-content-between align-items-center small text-secondary mb-1">
                              <span className="text-secondary">Fortschritt Pflichtangaben</span>
                              <strong className="text-secondary opacity-75">--/--</strong>
                            </div>
                            <div className={dashboardStyles.progressSkeleton} />
                          </>
                        ) : mandatoryPercent < 100 ? (
                          <>
                            <div className="d-flex justify-content-between align-items-center small text-secondary mb-1">
                              <span>Fortschritt Pflichtangaben</span>
                              <strong>{mandatoryProgress.completed}/{mandatoryProgress.total}</strong>
                            </div>
                            <progress
                              className={dashboardStyles.progressNative}
                              value={animatedMandatoryPercent}
                              max={100}
                              aria-label="Fortschritt Pflichtangaben"
                            />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {!isWelcomeAwaitingAdminApproval ? (
                      <>
                        <div className="d-flex align-items-center flex-wrap gap-2">
                          <span className={dashboardStyles.quickAccessLabel}>Schnellzugriff:</span>
                          <button type="button" onClick={() => openTextEditorAt('berater_name')} className={dashboardStyles.inlineLinkButton}>
                            Berater-Angaben
                          </button>
                          <span className={dashboardStyles.quickAccessSeparator}>,</span>
                          <button type="button" onClick={() => openTextEditorAt('makler_name')} className={dashboardStyles.inlineLinkButton}>
                            Makler-Angaben
                          </button>
                          <span className={dashboardStyles.quickAccessSeparator}>,</span>
                          <button type="button" onClick={() => openTextEditorAt('immobilienmarkt_individuell_01')} className={dashboardStyles.inlineLinkButton}>
                            Experten-Angaben
                          </button>
                        </div>
                        <button type="button" onClick={() => openTextEditorAt('berater_name')} className={dashboardStyles.activationCtaButton}>
                          Pflichtangaben bearbeiten
                        </button>
                      </>
                    ) : null}
                    <div className="d-flex align-items-center flex-wrap gap-2 mt-2">
                      {submitReviewMessage ? (
                        <span className={`${dashboardStyles.reviewMessage} ${reviewMessageToneClass(submitReviewTone)}`}>{submitReviewMessage}</span>
                      ) : null}
                    </div>
                  </div>
                ) : !isAwaitingAreaAssignment ? (
                  <div className={dashboardStyles.alreadyActiveInfo}>Dieses Gebiet ist bereits aktiv.</div>
                ) : null}
              </div>
                ) : null}
                {previewDistricts.length > 0 ? (
                  <div className={dashboardStyles.previewReadyWelcomeBox}>
                    <h2 className={dashboardStyles.welcomeSectionTitle}>Previewphase</h2>
                    <p className={dashboardStyles.previewReadyIntroText}>
                      Mindestens ein Gebiet ist intern freigegeben und kann vor dem Onlineschalten im Partnerbereich vorbereitet werden.
                      Pruefe jetzt Inhalte, Werte und SEO/GEO sorgfaeltig. Das Gebiet ist in diesem Zustand noch nicht regulär online.
                    </p>
                    {effectiveWelcomePreviewConfig ? (
                      <div className={dashboardStyles.previewReadyInnerPanel}>
                        <p className={dashboardStyles.previewReadyText}>
                          <strong>Dieses Gebiet ist intern freigegeben, aber noch nicht online.</strong>
                        </p>
                        <p className={dashboardStyles.previewReadyText}>
                          Fuer <strong>{effectiveWelcomePreviewConfig.areas?.name ?? effectiveWelcomePreviewConfig.area_id}</strong> ist die fachliche Freigabe bereits erteilt.
                          Jetzt solltest du Texte, Werte, SEO/GEO und falls gebucht auch die Internationalisierung final vorbereiten.
                        </p>
                        {effectiveWelcomePreviewHref ? (
                          <p className={dashboardStyles.previewReadyText}>
                            Die Frontend-Preview zeigt denselben Seitenstand wie die spätere Live-Seite. Sie ist nur intern für berechtigte Nutzer erreichbar und nach dem Onlinegang nicht mehr verfügbar.
                          </p>
                        ) : null}
                        <p className={dashboardStyles.previewReadyText}>
                          Wenn du alles final geprüft hast, fordere hier den Livegang an. Das Admin-Team wird danach informiert und kann die finale Freigabe erteilen.
                        </p>
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          <button type="button" onClick={() => {
                            setSelectedConfig(effectiveWelcomePreviewConfig);
                            handleToolSelect('factors');
                          }} className={dashboardStyles.previewReadyActionButton}>
                            Werte pruefen
                          </button>
                          <button type="button" onClick={() => {
                            setSelectedConfig(effectiveWelcomePreviewConfig);
                            handleToolSelect('texts');
                          }} className={dashboardStyles.previewReadyActionButton}>
                            Texte pruefen
                          </button>
                          <button type="button" onClick={() => {
                            setSelectedConfig(effectiveWelcomePreviewConfig);
                            handleToolSelect('marketing');
                          }} className={dashboardStyles.previewReadyActionButton}>
                            SEO & GEO pruefen
                          </button>
                          {effectiveWelcomePreviewHref ? (
                            <a
                              href={effectiveWelcomePreviewHref}
                              target="_blank"
                              rel="noreferrer"
                              className={`${dashboardStyles.previewReadyGhostButton} d-inline-flex align-items-center justify-content-center text-decoration-none ms-auto`}
                            >
                              Frontend-Preview öffnen
                            </a>
                          ) : null}
                          {effectiveWelcomePreviewSignoffAt ? (
                            <span className={`${dashboardStyles.reviewMessage} ${dashboardStyles.reviewMessageSuccess}`}>
                              Livegang angefragt am {formatTimestampLabel(effectiveWelcomePreviewSignoffAt)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleRequestLive(effectiveWelcomePreviewConfig)}
                              disabled={previewRequestBusy}
                              className={dashboardStyles.previewReadySuccessButton}
                            >
                              {previewRequestBusy ? 'Anfrage läuft...' : 'Livegang anfragen'}
                            </button>
                          )}
                        </div>
                        {previewRequestMessage ? (
                          <div className="mt-3">
                            <span className={`${dashboardStyles.reviewMessage} ${reviewMessageToneClass(previewRequestTone)}`}>{previewRequestMessage}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className={`d-grid ${dashboardStyles.welcomeGroups}`}>
              {welcomeToolGroups(hasInternationalFeature).map((group) => (
                <section key={group.title} className={dashboardStyles.welcomeGroupCard}>
                  <h3 className={dashboardStyles.welcomeGroupTitle}>{group.title}</h3>
                  <div className={`d-grid ${dashboardStyles.welcomeGrid}`}>
                    {group.tools.map((tool) => (
                      <button
                        key={`${tool.key}:${tool.title}`}
                        onClick={() => handleToolSelect(tool.key, tool.networkPartnerSection)}
                        disabled={Boolean(tool.comingSoon) || !canUseTool() || !isTabEnabled(tool.key)}
                        className={welcomeCardClass(Boolean(tool.comingSoon) || !canUseTool() || !isTabEnabled(tool.key))}
                      >
                        <div className={dashboardStyles.welcomeCardTitle}>{tool.title}</div>
                        <div className={dashboardStyles.welcomeCardText}>
                          {tool.description}
                          {tool.comingSoon ? ' (bald verfügbar)' : (!isTabEnabled(tool.key) ? ' (derzeit nicht freigeschaltet)' : '')}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : activeMainTab === 'settings' ? (
          <div className="w-100">
            <header className={`${dashboardStyles.workspaceHeaderBase} ${dashboardStyles.regionHeaderSticky}`}>
              <div className={dashboardStyles.workspaceHeaderIntro}>
                <h1 className={dashboardStyles.mainTitle}>{headerConfig.title}</h1>
                <p className={dashboardStyles.headerDescription}>{headerConfig.description}</p>
              </div>
            </header>
            <PartnerSettingsPanel section={settingsSection} onSectionChange={setSettingsSection} />
          </div>
        ) : activeMainTab === 'network_partners' ? (
          <div className="w-100">
            <header className={`${dashboardStyles.workspaceHeaderBase} ${dashboardStyles.regionHeaderSticky}`}>
              <div className={dashboardStyles.workspaceHeaderIntro}>
                <h1 className={dashboardStyles.mainTitle}>{headerConfig.title}</h1>
                <p className={dashboardStyles.headerDescription}>{headerConfig.description}</p>
              </div>
            </header>
            <div className="d-grid gap-3">
              {networkPartnerSection === 'bookings' ? (
                <NetworkBookingsWorkspace areas={networkAreaOptions} />
              ) : networkPartnerSection === 'content' ? (
                <NetworkContentWorkspace areas={networkAreaOptions} />
              ) : networkPartnerSection === 'billing' ? (
                <NetworkBillingWorkspace />
              ) : networkPartnerSection === 'ai' ? (
                <NetworkAIWorkspace />
              ) : (
                <NetworkPartnerManagementWorkspace
                  initialSelectedPartnerId={selectedNetworkPartnerId}
                  initialDetailSection={networkPartnerDetailSection}
                  onSelectedPartnerIdChange={setSelectedNetworkPartnerId}
                  onDetailSectionChange={setNetworkPartnerDetailSection}
                  areas={networkAreaOptions}
                />
              )}
            </div>
          </div>
        ) : effectiveSelectedConfig ? (
          /* Hier entfernen wir das maxWidth: '1000px' damit die Formulare die Breite nutzen */
          <div className="position-relative w-100">
            <header className={`${dashboardStyles.workspaceHeaderBase} ${dashboardStyles.regionHeaderSticky}`}>
              {!hideTextsHeaderInActivationFlow ? (
                <div className={dashboardStyles.workspaceHeaderIntro}>
                  <h1 className={dashboardStyles.mainTitle}>{headerConfig.title}</h1>
                  <p className={dashboardStyles.headerDescription}>{headerConfig.description}</p>
                </div>
              ) : null}
              {(headerConfig.isRegionBased || headerConfig.showDistrictSelector) && effectiveAreaConfig ? (
                <div className={`${dashboardStyles.workspaceHeaderContext} ${hideTextsHeaderInActivationFlow ? dashboardStyles.workspaceHeaderContextCompact : ''}`}>
                  {hideTextsHeaderInActivationFlow ? <div className={dashboardStyles.hiddenTextsHeaderSpacer} /> : null}
                  {!hideTextsHeaderInActivationFlow && !headerConfig.showDistrictSelector && activeMainTab !== 'factors' ? (
                    <div className={dashboardStyles.workspaceHeaderRegionMeta}>
                      <h2 className={dashboardStyles.regionTitle}>{effectiveRegionHeaderTitle}</h2>
                      <div className={`${dashboardStyles.regionStatus} ${activationToneClass(resolveActivationStatusKey(effectiveAreaConfig))}`}>
                        {formatActivationStatusLabel(effectiveAreaConfig)}
                      </div>
                    </div>
                  ) : null}
                  {headerConfig.showDistrictSelector && scopedMainDistricts.length > 0 ? (
                    <div className={dashboardStyles.headerDistrictSelector}>
                      <div className="d-flex flex-wrap gap-2">
                        {scopedMainDistricts.map((district) => {
                          const active = district.area_id === effectiveAreaConfig.area_id;
                          const statusKey = resolveActivationStatusKey(district);
                          const statusLabel = formatActivationStatusLabel(district);
                          return (
                            <button
                              key={district.area_id}
                              type="button"
                              onClick={() => {
                                setSelectedConfig(district);
                                setExpandedDistrict(district.area_id);
                              }}
                              className={`${dashboardStyles.headerDistrictTab} ${activationToneClass(statusKey)} ${active ? dashboardStyles.headerDistrictTabActive : ''}`}
                            >
                              <span className="d-flex align-items-center gap-2">
                                <span>{formatRegionHeaderTitle(configs, district)}</span>
                                <span className={`${dashboardStyles.headerDistrictTabStatus} ${activationToneClass(statusKey)}`}>
                                  {statusLabel}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {showPreviewGuidanceForSelected ? (
                    <div className={dashboardStyles.previewReadyCardShell}>
                      <p className={dashboardStyles.previewReadyText}>
                        <strong>Dieses Gebiet ist intern freigegeben, aber noch nicht online.</strong>
                      </p>
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <button type="button" onClick={() => handleToolSelect('factors')} className={dashboardStyles.previewReadyActionButton}>
                          Werte pruefen
                        </button>
                        <button type="button" onClick={() => handleToolSelect('texts')} className={dashboardStyles.previewReadyActionButton}>
                          Texte pruefen
                        </button>
                        <button type="button" onClick={() => handleToolSelect('marketing')} className={dashboardStyles.previewReadyActionButton}>
                          SEO & GEO pruefen
                        </button>
                        {selectedPreviewHref ? (
                          <a
                            href={selectedPreviewHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`${dashboardStyles.previewReadyGhostButton} d-inline-flex align-items-center justify-content-center text-decoration-none ms-auto`}
                          >
                            Frontend-Preview öffnen
                          </a>
                        ) : null}
                        {selectedPreviewSignoffAt ? (
                          <span className={`${dashboardStyles.reviewMessage} ${dashboardStyles.reviewMessageSuccess}`}>
                            Livegang angefragt am {formatTimestampLabel(selectedPreviewSignoffAt)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRequestLive(effectiveAreaConfig)}
                            disabled={previewRequestBusy}
                            className={dashboardStyles.previewReadySuccessButton}
                          >
                            {previewRequestBusy ? 'Anfrage läuft...' : 'Livegang anfragen'}
                          </button>
                        )}
                      </div>
                      {previewRequestMessage ? (
                        <div className="mt-3">
                          <span className={`${dashboardStyles.reviewMessage} ${reviewMessageToneClass(previewRequestTone)}`}>{previewRequestMessage}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {showActivationPanelForEditorSelected ? (
                    <div
                      className={
                        isAwaitingAdminApproval
                          ? dashboardStyles.awaitingApprovalCardShell
                          : dashboardStyles.reviewPanelStrong
                      }
                    >
                      {isAwaitingAdminApproval ? (
                        <div className={dashboardStyles.awaitingApprovalPanel}>
                          <div className="mb-4">
                            <span className={dashboardStyles.awaitingApprovalBadge}>
                              {activationStatusKey === 'in_review' ? 'In Prüfung' : 'Freigabebereit'}
                            </span>
                          </div>
                          <h3 className={dashboardStyles.awaitingApprovalTitle}>Die Aktivierung ist eingereicht. Bitte warte auf die Adminfreigabe.</h3>
                          <p className={dashboardStyles.awaitingApprovalText}>
                            Deine Pflichtangaben wurden erfolgreich übermittelt und liegen beim Admin zur Prüfung vor. Solange die Prüfung läuft, ist die Aktivierungsmaske gesperrt. Du kannst nach der Freigabe wie gewohnt weiterarbeiten.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowWelcome(true)}
                            className={dashboardStyles.awaitingApprovalDashboardButton}
                          >
                            Zum Dashboard
                          </button>
                        </div>
                      ) : (
                        <>
                          {!hideTextsHeaderInActivationFlow ? (
                            <>
                              <div className="fw-bold text-dark mb-1">Aktivierung dieses Gebiets</div>
                              <div className="small text-secondary m-0">
                                Voraussetzung für die Freigabe:
                              </div>
                              <ul className="small text-secondary ps-3 my-2 lh-base">
                                <li>
                                  Marktüberblick:
                                  {' '}
                                  {mandatoryDirectLinks.map((item, idx) => (
                                    <span key={item.key}>
                                      <button type="button" onClick={() => openTextEditorAt(item.key)} className={dashboardStyles.inlineLinkButton}>
                                        {item.label}
                                      </button>
                                      {idx < mandatoryDirectLinks.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </li>
                                <li>
                                  Berater:
                                  {' '}
                                  <button type="button" onClick={() => openTextEditorAt('berater_name')} className={dashboardStyles.inlineLinkButton}>
                                    Alle Berater-Felder öffnen
                                  </button>
                                </li>
                                <li>
                                  Makler:
                                  {' '}
                                  <button type="button" onClick={() => openTextEditorAt('makler_name')} className={dashboardStyles.inlineLinkButton}>
                                    Alle Makler-Felder öffnen
                                  </button>
                                </li>
                                <li>
                                  Bilder:
                                  {' '}
                                  <button type="button" onClick={() => openTextEditorAt('berater_name')} className={dashboardStyles.inlineLinkButton}>
                                    Berater-Avatar
                                  </button>
                                  {', '}
                                  <button type="button" onClick={() => openTextEditorAt('makler_name')} className={dashboardStyles.inlineLinkButton}>
                                    Makler-Logo + Makler-Bilder
                                  </button>
                                </li>
                              </ul>
                            </>
                          ) : (
                            <div className={dashboardStyles.reviewPanelMandatoryNotice}>
                              Für eine erfolgreiche Aktivierung vervollständige bitte die Pflichtangaben inklusive Bild-Uploads in den untenstehenden Eingabeblöcken und klicke danach auf <strong>Freigabe anfordern</strong>.
                            </div>
                          )}
                          {activationStatusKey === 'changes_requested' && effectiveSelectedReviewNote ? (
                            <div className={dashboardStyles.reviewIssueBox}>
                              <div className="fw-bold mb-1">Nachbesserung erforderlich</div>
                              <div className={dashboardStyles.reviewIssueText}>{effectiveSelectedReviewNote}</div>
                            </div>
                          ) : null}
                          <div className="d-flex align-items-end flex-wrap gap-3 mt-3">
                            <div
                              className={`${dashboardStyles.progressWrap} ${mandatoryProgressLoading ? dashboardStyles.progressWrapLoading : ''} flex-grow-1`}
                            >
                              {mandatoryProgressLoading ? (
                                <>
                                  <div className="d-flex justify-content-between align-items-center small text-secondary mb-1">
                                    <span className="text-secondary">Fortschritt Pflichtangaben</span>
                                    <strong className="text-secondary opacity-75">--/--</strong>
                                  </div>
                                  <div className={dashboardStyles.progressSkeleton} />
                                </>
                              ) : (
                                <>
                                  <div className="d-flex justify-content-between align-items-center small text-secondary mb-1">
                                    <span>Fortschritt Pflichtangaben</span>
                                    <strong>{mandatoryProgress.completed}/{mandatoryProgress.total}</strong>
                                  </div>
                                  <progress
                                    className={dashboardStyles.progressNative}
                                    value={animatedMandatoryPercent}
                                    max={100}
                                    aria-label="Fortschritt Pflichtangaben"
                                  />
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleSubmitForReview}
                              disabled={submitReviewBusy}
                              className={`${dashboardStyles.submitReviewButton} ${submitReviewBusy ? dashboardStyles.submitReviewButtonBusy : ''}`}
                            >
                              {submitReviewBusy ? 'Prüfe Freigabe...' : 'Freigabe anfordern'}
                            </button>
                          </div>
                          {!hideTextsHeaderInActivationFlow ? (
                            <div className="small text-secondary m-0">
                              Nach vollständiger Eingabe einfach auf <strong>Freigabe anfordern</strong> klicken.
                            </div>
                          ) : null}
                          <div className="d-flex align-items-center flex-wrap gap-2 mt-2">
                          {submitReviewMessage ? (
                            <span className={`${dashboardStyles.reviewMessage} ${reviewMessageToneClass(submitReviewTone)}`}>{submitReviewMessage}</span>
                          ) : null}
                        </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </header>

            {/* Die Forms nutzen nun die volle Breite des <main> Containers */}
            {activeMainTab === 'factors' ? (
              <FactorForm
                ref={factorFormRef}
                key={`f-${effectiveSelectedConfig.area_id}`}
                config={effectiveSelectedConfig}
                workspaceTitle={effectiveRegionHeaderTitle}
                onLoadingChange={setFactorPaneLoading}
              />
            ) : activeMainTab === 'texts' && scopedContentAreaConfig ? (
              isAwaitingAdminApproval ? null : (
                <TextEditorForm
                  key={`t-${scopedContentAreaConfig.area_id}`}
                  config={scopedContentAreaConfig}
                  enableApproval
                  initialTabId={textFocusTarget?.tabId}
                  focusSectionKey={textFocusTarget?.sectionKey}
                  lockedToMandatory={Boolean(!scopedContentAreaConfig.is_active)}
                  allowedTabIds={scopedContentAreaConfig.is_active ? undefined : Array.from(MANDATORY_TAB_IDS)}
                  allowedSectionKeys={scopedContentAreaConfig.is_active ? undefined : Array.from(mandatoryAllowedKeys)}
                  onFocusHandled={() => setTextFocusTarget(null)}
                  onPersistSuccess={() => setProgressRefreshTick((prev) => prev + 1)}
                  onMandatoryProgressChange={handleTextMandatoryProgressChange}
                  onMandatoryProgressLoadingChange={setMandatoryProgressLoading}
                />
              )
            ) : activeMainTab === 'marketing' && scopedContentAreaConfig ? (
              <TextEditorForm
                key={`mkt-${scopedContentAreaConfig.area_id}`}
                config={scopedContentAreaConfig}
                tableName="partner_marketing_texts"
                enableApproval
              />
            ) : activeMainTab === 'local_site' && scopedContentAreaConfig ? (
              <TextEditorForm
                key={`ls-${scopedContentAreaConfig.area_id}`}
                config={scopedContentAreaConfig}
                tableName="partner_local_site_texts"
                enableApproval
              />
            ) : activeMainTab === 'blog' ? (
              <BlogManager
                key={`blog-${effectiveSelectedConfig.area_id}`}
                config={effectiveSelectedConfig}
                onNavigateToTexts={(sectionKey) => {
                  openTextEditorAt(sectionKey);
                }}
              />
            ) : activeMainTab === 'international' && scopedContentAreaConfig ? (
              <InternationalizationManager
                config={scopedContentAreaConfig}
                availableLocales={internationalLocales}
                availableDomains={internationalDomains}
              />
            ) : activeMainTab === 'immobilien' && scopedContentAreaConfig ? (
              <OffersManager
                visibilityConfig={scopedContentAreaConfig}
                visibilityMode={effectiveOfferVisibilityMode}
                visibilityBusy={visibilitySaveBusy}
                visibilityMessage={visibilitySaveMessage}
                visibilityTone={visibilitySaveTone}
                onVisibilityModeChange={(value) => handleVisibilityModeChange('offer_visibility_mode', value)}
              />
            ) : activeMainTab === 'referenzen' ? (
              <ReferencesManager
                visibilityConfig={scopedContentAreaConfig}
                visibilityMode={effectiveReferenceVisibilityMode}
                visibilityBusy={visibilitySaveBusy}
                visibilityMessage={visibilitySaveMessage}
                visibilityTone={visibilitySaveTone}
                onVisibilityModeChange={(value) => handleVisibilityModeChange('reference_visibility_mode', value)}
              />
            ) : activeMainTab === 'gesuche' && scopedContentAreaConfig ? (
              <RequestsManager
                visibilityConfig={scopedContentAreaConfig}
                visibilityMode={effectiveRequestVisibilityMode}
                visibilityBusy={visibilitySaveBusy}
                visibilityMessage={visibilitySaveMessage}
                visibilityTone={visibilitySaveTone}
                onVisibilityModeChange={(value) => handleVisibilityModeChange('request_visibility_mode', value)}
              />
            ) : (
              <div className="p-4 text-secondary">
                Bereich in Vorbereitung.
              </div>
            )}
          </div>
        ) : (
          <div className={`d-flex align-items-center justify-content-center ${dashboardStyles.emptyState}`}>
            {hasRegionAssignments ? (
              <p className={`m-0 ${dashboardStyles.emptyStateText}`}>
                Wähl eine Region aus der mittleren Spalte.
              </p>
            ) : (
              <div className={dashboardStyles.emptyStateCard}>
                <p className={`m-0 ${dashboardStyles.emptyStateCardTitle}`}>
                  Deinem Konto ist aktuell keine Region zugewiesen.
                </p>
                <p className={`mb-0 ${dashboardStyles.emptyStateCardText}`}>
                  Melde dich kurz beim Administrator. Nach der Zuweisung wird der Bereich automatisch aktiv.
                </p>
                <p className={`mb-0 ${dashboardStyles.emptyStateCardHint}`}>
                  Hinweis: Bitte Administrator kontaktieren.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
      </div>
      <footer className={`d-flex align-items-center justify-content-between ${dashboardStyles.dashboardFooter}`}>
        <span className={dashboardStyles.dashboardFooterCopy}>© {new Date().getFullYear()} Wohnlagencheck24</span>
        <div className="d-flex align-items-center gap-3">
          <Link href="/impressum" className={dashboardStyles.dashboardFooterLink}>Impressum</Link>
          <Link href="/datenschutz" className={dashboardStyles.dashboardFooterLink}>Datenschutz</Link>
        </div>
      </footer>
    </div>
  );
}

function welcomeToolGroups(hasInternationalFeature: boolean): Array<{ title: string; tools: WelcomeTool[] }> {
  const regionTools: WelcomeTool[] = [
    {
      key: 'factors',
      title: 'Wertanpassungen',
      description: 'Werte, Faktoren und Kennzahlen der Region prüfen und bei Bedarf anpassen.',
      icon: 'factors',
    },
    {
      key: 'texts',
      title: 'Berichte & Texte',
      description: 'Texte und Berichte für die ausgewählte Region verwalten und optimieren.',
      icon: 'texts',
    },
    {
      key: 'local_site',
      title: 'Lokale Website',
      description: 'Regionale Inhalte für die lokale Website bearbeiten.',
      icon: 'local_site',
    },
  ];
  if (hasInternationalFeature) {
    regionTools.push({
      key: 'international',
      title: 'Internationalisierung',
      description: 'Sprachvarianten für Portal und lokale Website steuern.',
      icon: 'international',
    });
  }

  return [
    {
      title: 'Region & Inhalte',
      tools: regionTools,
    },
    {
      title: 'Marketing',
      tools: [
        {
          key: 'marketing',
          title: 'SEO & GEO',
          description: 'SEO- und GEO-Inhalte der Region pflegen und ausrichten.',
          icon: 'marketing',
        },
        {
          key: 'blog',
          title: 'Blog',
          description: 'Blogbeiträge aus Marktüberblick-Texten generieren.',
          icon: 'blog',
        },
        {
          key: 'blog',
          title: 'Social Media',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'social',
          comingSoon: true,
        },
        {
          key: 'blog',
          title: 'E-Mail',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'mail',
          comingSoon: true,
        },
      ],
    },
    {
      title: 'Vertrieb & Assets',
      tools: [
        {
          key: 'immobilien',
          title: 'Immobilien',
          description: 'SEO-Texte und Exposé-Inhalte pro Objekt individuell optimieren.',
          icon: 'immobilien',
        },
        {
          key: 'referenzen',
          title: 'Referenzen',
          description: 'Referenzobjekte aus dem CRM prüfen und individuell anpassen.',
          icon: 'referenzen',
        },
        {
          key: 'gesuche',
          title: 'Gesuche',
          description: 'Gesuche aus dem CRM prüfen und individuell anpassen.',
          icon: 'gesuche',
        },
        {
          key: 'blog',
          title: 'Leadgeneratoren',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'wizards',
          comingSoon: true,
        },
        {
          key: 'blog',
          title: 'Prognosemonitor',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'forecast',
          comingSoon: true,
        },
      ],
    },
    {
      title: 'Regionale Partner',
      tools: [
        {
          key: 'network_partners',
          title: 'Netzwerkpartner Verwaltung',
          description: 'Regionale Partner im Master-Detail-Arbeitsbereich mit Zugängen, Buchungen und Partnererlösen verwalten.',
          icon: 'partner_ads',
          networkPartnerSection: 'overview',
        },
        {
          key: 'network_partners',
          title: 'Partnererlöse',
          description: 'Erlöse, Potenziale und Abrechnungsbasis im Netzwerkpartner-Geschäft prüfen.',
          icon: 'marketing',
          networkPartnerSection: 'billing',
        },
      ],
    },
  ];
}
