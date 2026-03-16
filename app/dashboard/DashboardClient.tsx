'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import FactorForm, { type FactorFormHandle } from './FactorForm';
import TextEditorForm from './TextEditorForm';
import OffersManager from './OffersManager';
import ReferencesManager from './ReferencesManager';
import RequestsManager from './RequestsManager';
import BlogManager from './BlogManager';
import InternationalizationManager from './InternationalizationManager';
import PartnerSettingsPanel, { type SettingsSection } from './PartnerSettingsPanel';
import { INDIVIDUAL_MANDATORY_KEYS } from '@/lib/text-key-registry';
import { MANDATORY_MEDIA_KEYS, getMandatoryMediaLabel, isMandatoryMediaKey } from '@/lib/mandatory-media';
import { readSessionViewState, writeSessionViewState } from '@/lib/ui/session-view-state';
import FullscreenLoader from '@/components/ui/FullscreenLoader';

type MainTab = 'texts' | 'factors' | 'marketing' | 'local_site' | 'immobilien' | 'referenzen' | 'gesuche' | 'blog' | 'international' | 'settings';
type WelcomeTool = {
  key: MainTab;
  title: string;
  description: string;
  icon: UtilityIconKey;
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
  partner_preview_signoff_at?: string | null;
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
};

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
  disabled?: boolean;
};

const MANDATORY_TAB_IDS = ['berater', 'makler', 'marktueberblick'] as const;
const DASHBOARD_UI_STATE_KEY = 'partner_dashboard_ui_state_v1';

const FEATURE_TAB_CODES: Partial<Record<MainTab, string>> = {
  immobilien: 'immobilien',
  referenzen: 'referenzen',
  gesuche: 'gesuche',
};

function isMainTab(value: unknown): value is MainTab {
  return typeof value === 'string'
    && ['texts', 'factors', 'marketing', 'local_site', 'immobilien', 'referenzen', 'gesuche', 'blog', 'international', 'settings'].includes(value);
}

function formatMandatoryLabel(key: string): string {
  if (!key) return "";
  if (isMandatoryMediaKey(key)) return getMandatoryMediaLabel(key);
  if (key === "immobilienmarkt_individuell_01") return "Experteneinschätzung Text 01";
  if (key === "immobilienmarkt_individuell_02") return "Experteneinschätzung Text 02";
  if (key === "immobilienmarkt_zitat") return "Zitat";
  if (key === "immobilienmarkt_maklerempfehlung") return "Maklerempfehlung";
  if (key.startsWith("berater_")) return `Berater (${key.replace("berater_", "")})`;
  if (key.startsWith("makler_")) return `Makler (${key.replace("makler_", "")})`;
  return key;
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

function formatRegionScopeSuffix(config: PartnerAreaConfig | null): string {
  if (!config) return "";
  return (config.area_id.split('-').length > 3) ? "Ortslage" : "Kreis / Ortslagen";
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
  };
}

function resolvePartnerFirstName(user: unknown): string | null {
  const rec = (typeof user === 'object' && user !== null) ? (user as Record<string, unknown>) : null;
  if (!rec) return null;
  const meta = (typeof rec.user_metadata === 'object' && rec.user_metadata !== null)
    ? (rec.user_metadata as Record<string, unknown>)
    : {};
  const candidates = [
    meta.first_name,
    meta.firstname,
    meta.given_name,
    meta.vorname,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  if (candidates.length > 0) return candidates[0];

  const fullName = String(meta.full_name ?? meta.name ?? '').trim();
  if (fullName) {
    const token = fullName.split(/\s+/)[0]?.trim();
    if (token) return token;
  }
  return null;
}

function resolveFirstNameFromProfile(value: { contact_first_name?: unknown } | null | undefined): string | null {
  const fromFirstName = String(value?.contact_first_name ?? "").trim();
  if (fromFirstName) return fromFirstName;
  return null;
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

export default function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const factorFormRef = useRef<FactorFormHandle | null>(null);
  const [configs, setConfigs] = useState<PartnerAreaConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PartnerAreaConfig | null>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [partnerFirstName, setPartnerFirstName] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [textFocusTarget, setTextFocusTarget] = useState<TextFocusTarget | null>(null);
  const [activationEditorMode, setActivationEditorMode] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [hoveredUtilityToolId, setHoveredUtilityToolId] = useState<string | null>(null);
  const [hoveredUtilityToolTop, setHoveredUtilityToolTop] = useState<number | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('konto');
  const [submitReviewBusy, setSubmitReviewBusy] = useState(false);
  const [submitReviewMessage, setSubmitReviewMessage] = useState<string | null>(null);
  const [submitReviewTone, setSubmitReviewTone] = useState<'info' | 'success' | 'error'>('info');
  const [submitReviewSuccessOpen, setSubmitReviewSuccessOpen] = useState(false);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  const [previewRequestMessage, setPreviewRequestMessage] = useState<string | null>(null);
  const [previewRequestTone, setPreviewRequestTone] = useState<'info' | 'success' | 'error'>('info');
  const [partnerFeatures, setPartnerFeatures] = useState<PartnerFeatureRow[]>([]);
  const [mandatoryProgress, setMandatoryProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length,
  });
  const [mandatoryProgressLoading, setMandatoryProgressLoading] = useState(true);
  const [animatedMandatoryPercent, setAnimatedMandatoryPercent] = useState(0);
  const [hoveredActivationTabId, setHoveredActivationTabId] = useState<string | null>(null);
  const [progressRefreshTick, setProgressRefreshTick] = useState(0);
  const progressRequestRef = useRef(0);
  const hasAnimatedMandatoryPercentRef = useRef(false);
  const utilityBarRef = useRef<HTMLElement | null>(null);

  // Werkzeug-Modus umschalten
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('factors');

  const headerConfig = useMemo(() => {
    switch (activeMainTab) {
      case 'texts':
        return {
          title: 'Berichte & Texte',
          description: 'Texte und Berichte für die ausgewählte Region verwalten und optimieren.',
          isRegionBased: true,
        };
      case 'factors':
        return {
          title: 'Wertanpassungen',
          description: 'Werte, Faktoren und Kennzahlen der Region prüfen und bei Bedarf anpassen.',
          isRegionBased: true,
        };
      case 'marketing':
        return {
          title: 'SEO & GEO',
          description: 'SEO- und GEO-Inhalte der Region pflegen und ausrichten.',
          isRegionBased: true,
        };
      case 'local_site':
        return {
          title: 'Lokale Website',
          description: 'Regionale Inhalte für die lokale Website bearbeiten.',
          isRegionBased: true,
        };
      case 'blog':
        return {
          title: 'Blog',
          description: 'Blogbeiträge aus Marktüberblick-Texten generieren und veröffentlichen.',
          isRegionBased: true,
        };
      case 'international':
        return {
          title: 'Internationalisierung',
          description: 'Sprachen und Übersetzungsstand für Portal und lokale Website verwalten.',
          isRegionBased: true,
        };
      case 'gesuche':
        return {
          title: 'Gesuche',
          description: 'Gesuche aus dem CRM prüfen und individuell anpassen.',
          isRegionBased: false,
        };
      case 'referenzen':
        return {
          title: 'Referenzen',
          description: 'Referenzobjekte aus dem CRM prüfen und individuell anpassen.',
          isRegionBased: false,
        };
      case 'settings':
        return {
          title: 'Einstellungen',
          description: 'Konto, Partnerprofil, Anbindungen und Kostenmonitor verwalten.',
          isRegionBased: false,
        };
      case 'immobilien':
      default:
        return {
          title: 'Immobilien',
          description: 'SEO-Texte und Exposé-Inhalte pro Objekt individuell optimieren.',
          isRegionBased: false,
        };
    }
  }, [activeMainTab]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      queueMicrotask(() => {
        setLastLogin(user.last_sign_in_at ?? null);
      });

      const [{ data }, profileFirstName, featuresPayload] = await Promise.all([
        supabase
          .from('partner_area_map')
          .select(`*, areas ( name, id, slug, parent_slug, bundesland_slug )`)
          .eq('auth_user_id', user.id)
          .order('area_id', { ascending: true }),
        (async () => {
          const fromAuth = resolvePartnerFirstName(user);
          if (fromAuth) return fromAuth;
          try {
            const res = await fetch('/api/partner/profile', { method: 'GET', cache: 'no-store' });
            if (!res.ok) return null;
            const payload = await res.json().catch(() => null) as {
              profile?: { contact_first_name?: string | null };
            } | null;
            return resolveFirstNameFromProfile(payload?.profile);
          } catch {
            return null;
          }
        })(),
        (async () => {
          try {
            const res = await fetch('/api/partner/billing/features', { method: 'GET', cache: 'no-store' });
            if (!res.ok) return [] as PartnerFeatureRow[];
            const payload = await res.json().catch(() => null) as { rows?: PartnerFeatureRow[] } | null;
            return Array.isArray(payload?.rows) ? payload.rows : [];
          } catch {
            return [] as PartnerFeatureRow[];
          }
        })(),
      ]);
      queueMicrotask(() => {
        setPartnerFirstName(profileFirstName);
        setPartnerFeatures(featuresPayload);
      });

      let mergedConfigs: PartnerAreaConfig[] = (data ?? []) as PartnerAreaConfig[];
      if (mergedConfigs.length > 0) {
        const activeDistricts = mergedConfigs.filter((cfg) => {
          const areaId = String(cfg.area_id ?? '');
          return areaId.split('-').length <= 3 && Boolean(cfg.is_active);
        });
        const activeDistrictSlugs = activeDistricts
          .map((cfg) => String(cfg.areas?.slug ?? '').trim())
          .filter((slug) => slug.length > 0);

        if (activeDistrictSlugs.length > 0) {
          const districtBySlug = new Map(
            activeDistricts.map((cfg) => [String(cfg.areas?.slug ?? ''), cfg] as const),
          );

          mergedConfigs = mergedConfigs.map((cfg) => {
            const areaId = String(cfg.area_id ?? '');
            if (!areaId || areaId.split('-').length <= 3) return cfg;
            const parentSlug = String(cfg.areas?.parent_slug ?? '').trim();
            const parentDistrict = districtBySlug.get(parentSlug);
            if (!parentDistrict) return cfg;
            return {
              ...cfg,
              is_active: true,
              is_public_live: Boolean(parentDistrict.is_public_live),
              activation_status: parentDistrict.activation_status ?? 'active',
            };
          });

          const mappedAreaIds = new Set(mergedConfigs.map((cfg) => String(cfg.area_id ?? '')));
          const { data: childAreas } = await supabase
            .from('areas')
            .select('id, name, slug, parent_slug, bundesland_slug')
            .in('parent_slug', activeDistrictSlugs)
            .order('name', { ascending: true });

          const derivedOrtslagen: PartnerAreaConfig[] = (childAreas ?? [])
            .map((area) => {
              const areaId = String(area.id ?? '');
              if (!areaId || mappedAreaIds.has(areaId)) return null;
              const parentSlug = String(area.parent_slug ?? '');
              const parentDistrict = districtBySlug.get(parentSlug);
              if (!parentDistrict) return null;
              return {
                area_id: areaId,
                is_active: true,
                activation_status: parentDistrict.activation_status ?? 'active',
                areas: {
                  id: areaId,
                  name: String(area.name ?? ''),
                  slug: String(area.slug ?? ''),
                  parent_slug: parentSlug,
                  bundesland_slug: String(area.bundesland_slug ?? ''),
                },
              } as PartnerAreaConfig;
            })
            .filter((entry): entry is PartnerAreaConfig => Boolean(entry));

          if (derivedOrtslagen.length > 0) {
            mergedConfigs = [...mergedConfigs, ...derivedOrtslagen].sort((a, b) =>
              String(a.area_id ?? '').localeCompare(String(b.area_id ?? ''), 'de'),
            );
          }
        }
      }

      queueMicrotask(() => {
        if (mergedConfigs.length > 0) {
          const persisted = readSessionViewState<PersistedDashboardState>(DASHBOARD_UI_STATE_KEY);

          const restoredAreaId = String(persisted?.selectedAreaId ?? '');
          const restoredArea = restoredAreaId ? mergedConfigs.find((cfg) => cfg.area_id === restoredAreaId) : undefined;
          const hasActiveAreasLocal = mergedConfigs.some((cfg) => Boolean(cfg.is_active));
          const restoredTab = isMainTab(persisted?.activeMainTab) ? persisted?.activeMainTab : undefined;
          const nextTab: MainTab = (!hasActiveAreasLocal && restoredTab && restoredTab !== 'texts')
            ? 'texts'
            : (restoredTab ?? 'factors');
          const nextShowWelcome = typeof persisted?.showWelcome === 'boolean' ? persisted.showWelcome : true;
          const nextSelected = restoredArea ?? mergedConfigs[0];

          setConfigs(mergedConfigs);
          setSelectedConfig(nextSelected);
          setExpandedDistrict(nextSelected.area_id.split('-').slice(0, 3).join('-'));
          setActiveMainTab(nextTab);
          setShowWelcome(nextShowWelcome);
        }
        setLoading(false);
      });
    }
    loadData();
  }, [supabase]);

  const featuresByCode = useMemo(() => {
    const map = new Map<string, PartnerFeatureRow>();
    for (const row of partnerFeatures) {
      const code = String(row.key ?? '').trim().toLowerCase();
      if (code) map.set(code, row);
    }
    return map;
  }, [partnerFeatures]);

  const hasInternationalFeature = useMemo(
    () => partnerFeatures.some((row) => String(row.key ?? '').trim().toLowerCase().startsWith('international')),
    [partnerFeatures],
  );

  const hasInternationalEnabled = useMemo(
    () => partnerFeatures.some((row) => {
      const code = String(row.key ?? '').trim().toLowerCase();
      return code.startsWith('international') && row.enabled === true;
    }),
    [partnerFeatures],
  );

  const internationalLocales = useMemo(() => {
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
  }, [partnerFeatures]);

  const isTabEnabled = (tab: MainTab): boolean => {
    if (tab === 'international') return hasInternationalFeature ? hasInternationalEnabled : false;
    const featureCode = FEATURE_TAB_CODES[tab];
    if (!featureCode) return true;
    const row = featuresByCode.get(featureCode);
    if (!row) return true;
    return row.enabled === true;
  };

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
      { id: 'partner_ads', label: 'Partnerwerbung (Bald verfügbar)', icon: 'partner_ads', disabled: true },
      { id: 'partner_immobilien', label: 'Partner-Immobilien (Bald verfügbar)', icon: 'partner_immobilien', disabled: true },
      { id: 'partner_gesuche', label: 'Partner-Gesuche (Bald verfügbar)', icon: 'partner_gesuche', disabled: true },
    ],
  ];

  const hoveredUtilityTool = utilityToolGroups
    .flat()
    .find((item) => item.id === hoveredUtilityToolId) ?? null;

  const updateHoveredUtilityTool = (toolId: string, element: HTMLElement) => {
    const asideRect = utilityBarRef.current?.getBoundingClientRect();
    const buttonRect = element.getBoundingClientRect();
    const nextTop = asideRect ? (buttonRect.top - asideRect.top) + (buttonRect.height / 2) : null;
    setHoveredUtilityToolId(toolId);
    setHoveredUtilityToolTop(nextTop);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/partner/login');
  };

  const handleToolSelect = (tab: MainTab) => {
    if (!canUseTool()) return;
    if (!isTabEnabled(tab)) return;
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
      if (!selectedConfig?.area_id) {
        if (mounted && progressRequestRef.current === requestId) {
          setMandatoryProgress({ completed: 0, total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length });
          setMandatoryProgressLoading(false);
        }
        return;
      }
      if (mounted && progressRequestRef.current === requestId) {
        setMandatoryProgressLoading(true);
      }
      const loadFallbackProgress = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const { data } = await supabase
          .from('report_texts')
          .select('section_key, optimized_content, status')
          .eq('partner_id', user.id)
          .eq('area_id', selectedConfig.area_id)
          .eq('status', 'approved');
        if (!mounted || progressRequestRef.current !== requestId) return;
        const uniqueFilled = new Set<string>();
        for (const row of data ?? []) {
          const key = String(row.section_key ?? '');
          if (!INDIVIDUAL_MANDATORY_KEYS.includes(key as (typeof INDIVIDUAL_MANDATORY_KEYS)[number])) continue;
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
        const res = await fetch(
          `/api/partner/areas/${encodeURIComponent(selectedConfig.area_id)}/mandatory-status`,
          { method: "GET", cache: "no-store" },
        );
        const payload = await res.json().catch(() => ({}));
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
  }, [selectedConfig?.area_id, submitReviewMessage, progressRefreshTick, supabase]);

  useEffect(() => {
    if (loading) return;
    const payload: PersistedDashboardState = {
      activeMainTab,
      selectedAreaId: selectedConfig?.area_id,
      showWelcome,
    };
    writeSessionViewState(DASHBOARD_UI_STATE_KEY, payload);
  }, [activeMainTab, selectedConfig?.area_id, showWelcome, loading]);

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
  const selectedAreaStatusLabel = formatActivationStatusLabel(selectedConfig);
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
    { key: 'immobilienmarkt_individuell_01', label: 'Experteneinschätzung Text 01' },
    { key: 'immobilienmarkt_individuell_02', label: 'Experteneinschätzung Text 02' },
    { key: 'immobilienmarkt_zitat', label: 'Zitat' },
    { key: 'immobilienmarkt_maklerempfehlung', label: 'Maklerempfehlung' },
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

  const showActivationPanelForEditorSelected = Boolean(effectiveSelectedConfig && !effectiveSelectedConfig.is_active);
  const showActivationPanelForWelcomeSelected = Boolean(effectiveWelcomeActivationConfig && !effectiveWelcomeActivationConfig.is_active);
  const hideTextsHeaderInActivationFlow = activeMainTab === 'texts' && showActivationPanelForEditorSelected;
  const activationStatusKey = resolveActivationStatusKey(effectiveSelectedConfig);
  const isAwaitingAdminApproval = showActivationPanelForEditorSelected
    && (activationStatusKey === 'ready_for_review' || activationStatusKey === 'in_review');
  const welcomeActivationStatusKey = resolveActivationStatusKey(effectiveWelcomeActivationConfig);
  const isWelcomeAwaitingAdminApproval = showActivationPanelForWelcomeSelected
    && (welcomeActivationStatusKey === 'ready_for_review' || welcomeActivationStatusKey === 'in_review');
  const selectedPreviewStatusKey = resolveActivationStatusKey(effectiveSelectedConfig);
  const showPreviewGuidanceForSelected = Boolean(
    effectiveSelectedConfig
    && selectedPreviewStatusKey === 'approved_preview'
    && !Boolean(effectiveSelectedConfig.is_public_live),
  );
  const selectedPreviewHref = buildPreviewHref(effectiveSelectedConfig);
  const selectedPreviewSignoffAt = String(effectiveSelectedConfig?.partner_preview_signoff_at ?? '').trim();

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
    if (!effectiveSelectedConfig || effectiveSelectedConfig.is_active || submitReviewBusy) return;
    setSubmitReviewBusy(true);
    setSubmitReviewMessage(null);
    setSubmitReviewTone('info');
    try {
      const res = await fetch(`/api/partner/areas/${encodeURIComponent(effectiveSelectedConfig.area_id)}/submit-review`, {
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
            })
            : cfg
        )));
        setSelectedConfig((prev) => (
          prev && prev.area_id === mapping.area_id
            ? mergeAreaMappingUpdate(prev, {
              is_active: Boolean(mapping.is_active),
              activation_status: mapping.activation_status ?? 'ready_for_review',
              partner_preview_signoff_at: null,
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
        setPreviewRequestMessage(
          `Livegang angefragt am ${formatTimestampLabel(signedOffAt)}. Das Admin-Team wurde informiert.`,
        );
        setPreviewRequestTone('success');
      }
    } catch {
      setPreviewRequestMessage('Livegang-Anfrage konnte nicht gesendet werden. Bitte Verbindung prüfen und erneut versuchen.');
      setPreviewRequestTone('error');
    } finally {
      setPreviewRequestBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      <FullscreenLoader show={submitReviewBusy} label="Daten werden geladen..." />
      {submitReviewSuccessOpen ? (
        <div
          style={successOverlayStyle}
          onClick={() => setSubmitReviewSuccessOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSubmitReviewSuccessOpen(false);
          }}
        >
          <div
            style={successCardStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-review-success-title"
            aria-describedby="submit-review-success-text"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="submit-review-success-title" style={successTitleStyle}>Freigabe erfolgreich angefordert</h3>
            <p id="submit-review-success-text" style={successTextStyle}>
              Dein Gebiet ist jetzt freigabebereit. Die Angaben liegen beim Admin zur Prüfung vor.
            </p>
            {submitReviewMessage && submitReviewTone === 'error' ? (
              <p style={{ ...successTextStyle, color: '#991b1b', marginTop: '8px' }}>
                {submitReviewMessage}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                style={successButtonStyle}
                onClick={() => setSubmitReviewSuccessOpen(false)}
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header style={dashboardHeaderStyle}>
        <div
          className="brand-header"
          style={{ margin: 0, cursor: 'pointer' }}
          onClick={() => setShowWelcome(true)}
          title="Zur Willkommensseite"
        >
          <Image
            alt="Immobilienmarkt & Standortprofile"
            width={48}
            height={48}
            src="/logo/wohnlagencheck24.svg"
            className="brand-icon"
            style={{ display: 'block' }}
            priority
          />
          <span className="brand-text">
            <span className="brand-title">
              Wohnlagencheck<span style={{ color: '#ffe000' }}>24</span>
            </span>
            <small>DATA-DRIVEN. EXPERT-LED.</small>
          </span>
        </div>
        <div style={dashboardStatusStyle}>
          <div>{lastLogin ? `Letzter Login: ${new Date(lastLogin).toLocaleString('de-DE')}` : 'Letzter Login: –'}</div>
          <button
            type="button"
            style={headerActionButtonStyle}
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
            style={headerActionButtonStyle}
            onClick={handleLogout}
            title="Abmelden"
          >
            <span aria-hidden>⎋</span>
            <span>Ausloggen</span>
          </button>
          <div className="navbar navbar-light p-0 m-0" style={menuWrapStyle}>
            <button
              className="navbar-toggler"
              style={dashboardBurgerButtonStyle}
              onClick={() => setShowSettingsMenu((v) => !v)}
              title="Einstellungen-Menü"
              aria-label="Einstellungen öffnen"
            >
              <span className="navbar-toggler-icon" />
            </button>
            {showSettingsMenu ? (
              <div style={menuDropdownStyle}>
                <button style={menuItemStyle} onClick={() => handleSettingsSelect('konto')}>
                  Konto
                </button>
                <button style={menuItemStyle} onClick={() => handleSettingsSelect('profil')}>
                  Profil
                </button>
                <button style={menuItemStyle} onClick={() => handleSettingsSelect('integrationen')}>
                  Anbindungen
                </button>
                <button style={menuItemStyle} onClick={() => handleSettingsSelect('kostenmonitor')}>
                  Monitor
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* 1. SPALTE: WERKZEUGE (Ganz links, schmal) */}
      {showUtilityBar ? (
      <aside
        ref={utilityBarRef}
        style={utilityBarStyle}
        onMouseLeave={() => {
          setHoveredUtilityToolId(null);
          setHoveredUtilityToolTop(null);
        }}
      >
        <div style={toolIconsGroupStyle}>
          {utilityToolGroups.map((group, groupIndex) => (
            <div key={`utility-group-${groupIndex}`} style={toolGroupStyle}>
              {group.map((item) => {
                const active = item.tab ? activeMainTab === item.tab : false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.tab ? handleToolSelect(item.tab) : undefined}
                    onMouseEnter={(event) => updateHoveredUtilityTool(item.id, event.currentTarget)}
                    onFocus={(event) => updateHoveredUtilityTool(item.id, event.currentTarget)}
                    style={toolIconButtonStyle(active, Boolean(item.disabled))}
                    disabled={Boolean(item.disabled)}
                    aria-label={item.label}
                  >
                    {renderUtilityIcon(item.icon)}
                  </button>
                );
              })}
              {groupIndex < utilityToolGroups.length - 1 ? <div style={toolGroupDividerStyle} /> : null}
            </div>
          ))}
        </div>
        {hoveredUtilityTool && hoveredUtilityToolTop !== null ? (
          <div style={utilityTooltipLayerStyle(hoveredUtilityToolTop)}>
            <div style={utilityTooltipCardStyle}>{hoveredUtilityTool.label}</div>
          </div>
        ) : null}
      </aside>
      ) : null}

      {/* 2. SPALTE: REGIONEN-NAVIGATION (Mitte) */}
      {activeMainTab !== 'immobilien' && activeMainTab !== 'referenzen' && activeMainTab !== 'gesuche' && activeMainTab !== 'settings' && !showWelcome ? (
        <aside style={regionSidebarStyle}>
          <div style={sidebarHeaderStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: '800', margin: 0 }}>Regionen</h2>
            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase' }}>
              {activeMainTab === 'factors' ? 'Faktor-Anpassung' : 'Content Management'}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
            {regionSidebarMainDistricts.map(district => {
              const isSelected = Boolean(effectiveSelectedConfig?.area_id?.startsWith(district.area_id));
              const isExpanded = expandedDistrict === district.area_id || isSelected;
              const allowSubAreas = activeMainTab !== 'blog';
              const subAreas = allowSubAreas
                ? regionSidebarScopeConfigs.filter(c => c.area_id.startsWith(district.area_id) && c.area_id.split('-').length > 3)
                : [];
              const districtIsActive = Boolean(district.is_active);

              return (
                <div key={district.area_id} style={{ marginBottom: '8px' }}>
                  <button
                    onClick={() => {
                      handleSelectConfig(district);
                      setExpandedDistrict(isExpanded ? null : district.area_id);
                    }}
                    style={districtButtonStyle(isSelected, districtIsActive)}
                  >
                    <span style={{ fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{district.areas?.name}</span>
                  </button>

                  {isExpanded && subAreas.length > 0 && (
                    <div style={subAreaListStyle}>
                      {subAreas.map(ort => (
                        <button
                          key={ort.area_id}
                          onClick={() => handleSelectConfig(ort)}
                          style={subAreaButtonStyle(effectiveSelectedConfig?.area_id === ort.area_id)}
                        >
                          {ort.areas?.name}
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
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: activeMainTab === 'immobilien'
            ? '24px 48px'
            : showWelcome
              ? '40px'
              : '0 40px 40px',
        }}
      >
        {showWelcome ? (
          <div style={welcomeWrapStyle}>
            <div style={welcomeHeaderStyle}>
              <h1 style={welcomeTitleStyle}>
                {partnerFirstName ? `Willkommen ${partnerFirstName}` : 'Willkommen'}
              </h1>
              <p style={welcomeTextStyle}>
                Hier verwaltest du Wertanpassungen, Texte und Marketing-Inhalte für deine Regionen.
                Wähl einfach einen Bereich aus und leg los.
              </p>
            </div>
            {(onboardingMode || activationDistricts.length > 0) ? (
              <div style={isAwaitingAreaAssignment ? welcomeActivationAwaitingBoxStyle : welcomeActivationBoxStyle}>
                <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>
                  {isAwaitingAreaAssignment ? 'Warte auf Gebietszuweisung' : 'Gebietsfreigabe'}
                </h2>
                {isAwaitingAreaAssignment ? (
                  <p style={welcomeAwaitingAssignmentTextStyle}>
                    Schön, dass du dich in deinem Partnerbereich registriert und angemeldet hast. Bewahre dein Passwort sicher auf.
                    Der Administrator ist informiert und wird dir in Kürze deine Gebiete zuweisen.
                  </p>
                ) : (
                  <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#475569' }}>
                    Vervollständige die Pflichtangaben je Gebiet und fordere danach die Freigabe an.
                  </p>
                )}
                {!isAwaitingAreaAssignment ? (
                  <div style={activationTabsRowStyle}>
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
                          style={activationTabButtonStyle(active, hoveredActivationTabId === district.area_id)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {!isAwaitingAreaAssignment && activationDistricts.length === 0 ? (
                  <div style={alreadyActiveInfoStyle}>Alle zugewiesenen Gebiete sind bereits aktiv.</div>
                ) : !isAwaitingAreaAssignment && showActivationPanelForWelcomeSelected ? (
                  <div style={reviewPanelStyle}>
                    <div style={{ ...reviewPanelTitleStyle, fontSize: '24px', marginBottom: '10px' }}>
                      Gebietsfreigabe {effectiveWelcomeActivationConfig?.areas?.name ?? ''}
                    </div>
                    {isWelcomeAwaitingAdminApproval ? (
                      <div style={awaitingApprovalBadgeRowStyle}>
                        <span style={awaitingApprovalBadgeStyle}>
                          {welcomeActivationStatusKey === 'in_review' ? 'In Prüfung' : 'Freigabebereit'}
                        </span>
                      </div>
                    ) : null}
                    <div style={{ ...reviewPanelTextStyle, fontSize: '15px', marginTop: '4px', marginBottom: '10px' }}>
                      {isWelcomeAwaitingAdminApproval
                        ? 'Deine Pflichtangaben wurden erfolgreich übermittelt und liegen beim Admin zur Prüfung vor. Solange die Prüfung läuft, ist die Aktivierungsmaske gesperrt. Du kannst nach der Freigabe wie gewohnt weiterarbeiten.'
                        : 'Pflichtangaben fehlen! Vervollständige deine Eingaben als Voraussetzung für die Freigabe deines Gebietes.'}
                    </div>
                    {!isWelcomeAwaitingAdminApproval ? (
                      <div
                        style={{
                          ...progressWrapStyle,
                          marginTop: '40px',
                          marginBottom: '16px',
                          minHeight: mandatoryProgressLoading ? '42px' : undefined,
                        }}
                      >
                        {mandatoryProgressLoading ? (
                          <>
                            <div style={progressHeadStyle}>
                              <span style={progressLabelSkeletonStyle}>Fortschritt Pflichtangaben</span>
                              <strong style={progressValueSkeletonStyle}>--/--</strong>
                            </div>
                            <div style={progressSkeletonStyle} />
                          </>
                        ) : mandatoryPercent < 100 ? (
                          <>
                            <div style={progressHeadStyle}>
                              <span>Fortschritt Pflichtangaben</span>
                              <strong>{mandatoryProgress.completed}/{mandatoryProgress.total}</strong>
                            </div>
                            <div style={progressTrackStyle}>
                              <div style={progressFillStyle(animatedMandatoryPercent)} />
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {!isWelcomeAwaitingAdminApproval ? (
                      <>
                        <div style={quickAccessRowStyle}>
                          <span style={quickAccessLabelStyle}>Schnellzugriff:</span>
                          <button type="button" onClick={() => openTextEditorAt('berater_name')} style={inlineLinkButtonStyle}>
                            Berater-Angaben
                          </button>
                          <span style={quickAccessSeparatorStyle}>,</span>
                          <button type="button" onClick={() => openTextEditorAt('makler_name')} style={inlineLinkButtonStyle}>
                            Makler-Angaben
                          </button>
                          <span style={quickAccessSeparatorStyle}>,</span>
                          <button type="button" onClick={() => openTextEditorAt('immobilienmarkt_individuell_01')} style={inlineLinkButtonStyle}>
                            Experten-Angaben
                          </button>
                        </div>
                        <button type="button" onClick={() => openTextEditorAt('berater_name')} style={activationCtaButtonStyle}>
                          Pflichtangaben bearbeiten
                        </button>
                      </>
                    ) : null}
                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {submitReviewMessage ? (
                        <span style={reviewMessageStyle(submitReviewTone)}>{submitReviewMessage}</span>
                      ) : null}
                    </div>
                  </div>
                ) : !isAwaitingAreaAssignment ? (
                  <div style={alreadyActiveInfoStyle}>Dieses Gebiet ist bereits aktiv.</div>
                ) : null}
              </div>
                ) : null}
                {previewDistricts.length > 0 ? (
                  <div style={previewReadyWelcomeBoxStyle}>
                    <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>Previewphase</h2>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                      Mindestens ein Gebiet ist intern freigegeben und kann vor dem Onlineschalten im Partnerbereich vorbereitet werden.
                      Pruefe jetzt Inhalte, Werte und SEO/GEO sorgfaeltig. Das Gebiet ist in diesem Zustand noch nicht regulär online.
                    </p>
                    {effectiveWelcomePreviewConfig ? (
                      <div style={previewReadyInnerPanelStyle}>
                        <p style={previewReadyTextStyle}>
                          <strong>Dieses Gebiet ist intern freigegeben, aber noch nicht online.</strong>
                        </p>
                        <p style={previewReadyTextStyle}>
                          Fuer <strong>{effectiveWelcomePreviewConfig.areas?.name ?? effectiveWelcomePreviewConfig.area_id}</strong> ist die fachliche Freigabe bereits erteilt.
                          Jetzt solltest du Texte, Werte, SEO/GEO und falls gebucht auch die Internationalisierung final vorbereiten.
                        </p>
                        {effectiveWelcomePreviewHref ? (
                          <p style={previewReadyTextStyle}>
                            Die Frontend-Preview zeigt denselben Seitenstand wie die spätere Live-Seite. Sie ist nur intern für berechtigte Nutzer erreichbar und nach dem Onlinegang nicht mehr verfügbar.
                          </p>
                        ) : null}
                        <p style={previewReadyTextStyle}>
                          Wenn du alles final geprüft hast, fordere hier den Livegang an. Das Admin-Team wird danach informiert und kann die finale Freigabe erteilen.
                        </p>
                        <div style={previewReadyActionRowStyle}>
                          <button type="button" onClick={() => {
                            setSelectedConfig(effectiveWelcomePreviewConfig);
                            handleToolSelect('factors');
                          }} style={previewReadyActionButtonStyle}>
                            Werte pruefen
                          </button>
                          <button type="button" onClick={() => {
                            setSelectedConfig(effectiveWelcomePreviewConfig);
                            handleToolSelect('texts');
                          }} style={previewReadyActionButtonStyle}>
                            Texte pruefen
                          </button>
                          <button type="button" onClick={() => {
                            setSelectedConfig(effectiveWelcomePreviewConfig);
                            handleToolSelect('marketing');
                          }} style={previewReadyActionButtonStyle}>
                            SEO & GEO pruefen
                          </button>
                          {effectiveWelcomePreviewHref ? (
                            <a
                              href={effectiveWelcomePreviewHref}
                              target="_blank"
                              rel="noreferrer"
                              style={{ ...previewReadyGhostButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                            >
                              Frontend-Preview öffnen
                            </a>
                          ) : null}
                          {effectiveWelcomePreviewSignoffAt ? (
                            <span style={reviewMessageStyle('success')}>
                              Livegang angefragt am {formatTimestampLabel(effectiveWelcomePreviewSignoffAt)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleRequestLive(effectiveWelcomePreviewConfig)}
                              disabled={previewRequestBusy}
                              style={{ ...previewReadySuccessButtonStyle, marginLeft: 'auto' }}
                            >
                              {previewRequestBusy ? 'Anfrage läuft...' : 'Livegang anfragen'}
                            </button>
                          )}
                          {hasInternationalEnabled ? (
                            <button type="button" onClick={() => {
                              setSelectedConfig(effectiveWelcomePreviewConfig);
                              handleToolSelect('international');
                            }} style={previewReadyGhostButtonStyle}>
                              Internationalisierung
                            </button>
                          ) : null}
                        </div>
                        {previewRequestMessage ? (
                          <div style={{ marginTop: '12px' }}>
                            <span style={reviewMessageStyle(previewRequestTone)}>{previewRequestMessage}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div style={welcomeGroupsStyle}>
              {welcomeToolGroups(hasInternationalFeature).map((group) => (
                <section key={group.title} style={welcomeGroupCardStyle}>
                  <h3 style={welcomeGroupTitleStyle}>{group.title}</h3>
                  <div style={welcomeGridStyle}>
                    {group.tools.map((tool) => (
                      <button
                        key={`${tool.key}:${tool.title}`}
                        onClick={() => handleToolSelect(tool.key)}
                        disabled={Boolean(tool.comingSoon) || !canUseTool() || !isTabEnabled(tool.key)}
                        style={welcomeCardStyle(Boolean(tool.comingSoon) || !canUseTool() || !isTabEnabled(tool.key))}
                      >
                        <div style={welcomeCardIconStyle}>{renderUtilityIcon(tool.icon, 30)}</div>
                        <div style={welcomeCardTitleStyle}>{tool.title}</div>
                        <div style={welcomeCardTextStyle}>
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
          <div style={{ width: '100%' }}>
            <header style={settingsHeaderWrapStyle}>
              <div style={{ marginBottom: '6px' }}>
                <h1 style={mainTitleStyle}>{headerConfig.title}</h1>
                <p style={headerDescriptionStyle}>{headerConfig.description}</p>
              </div>
            </header>
            <PartnerSettingsPanel section={settingsSection} onSectionChange={setSettingsSection} />
          </div>
        ) : effectiveSelectedConfig ? (
          /* Hier entfernen wir das maxWidth: '1000px' damit die Formulare die Breite nutzen */
          <div style={{ width: '100%' }}>
            <header style={regionHeaderStickyStyle}>
              {!hideTextsHeaderInActivationFlow ? (
                <div style={{ marginBottom: '6px' }}>
                  <h1 style={mainTitleStyle}>{headerConfig.title}</h1>
                  <p style={headerDescriptionStyle}>{headerConfig.description}</p>
                </div>
              ) : null}
              {headerConfig.isRegionBased && effectiveSelectedConfig ? (
                <div style={{ marginTop: hideTextsHeaderInActivationFlow ? '0' : '18px' }}>
                  <h2 style={regionTitleStyle}>
                    {hideTextsHeaderInActivationFlow
                      ? `Aktivierung - ${effectiveSelectedConfig.areas?.name ?? ''}`
                      : `${effectiveSelectedConfig.areas?.name ?? ''} (${formatRegionScopeSuffix(effectiveSelectedConfig)})`}
                  </h2>
                  {hideTextsHeaderInActivationFlow ? <div style={{ height: '40px' }} /> : null}
                  {!hideTextsHeaderInActivationFlow ? (
                    <div style={regionStatusStyle(resolveActivationStatusKey(effectiveSelectedConfig))}>
                      {selectedAreaStatusLabel}
                    </div>
                  ) : null}
                  {showPreviewGuidanceForSelected ? (
                    <div style={previewReadyCardShellStyle}>
                      <p style={previewReadyTextStyle}>
                        <strong>Dieses Gebiet ist intern freigegeben, aber noch nicht online.</strong>
                      </p>
                      <p style={previewReadyTextStyle}>
                        Nutze jetzt die Previewphase, um Inhalte, Werte, SEO/GEO und optionale Zusatzmodule final vorzubereiten.
                        Erst danach sollte das Gebiet durch den Admin online geschaltet werden.
                      </p>
                      {selectedPreviewHref ? (
                        <p style={previewReadyTextStyle}>
                          Die Frontend-Preview bildet die spätere Live-Seite 1:1 ab. Sie ist nur intern erreichbar und nach dem Onlinegang nicht mehr verfügbar.
                        </p>
                      ) : null}
                      <p style={previewReadyTextStyle}>
                        Wenn du Inhalte, Werte und Frontend-Preview final geprüft hast, fordere hier den Livegang an. Das Admin-Team erhält danach die Bitte zur finalen Freigabe.
                      </p>
                      <div style={previewReadyActionRowStyle}>
                        <button type="button" onClick={() => handleToolSelect('factors')} style={previewReadyActionButtonStyle}>
                          Werte pruefen
                        </button>
                        <button type="button" onClick={() => handleToolSelect('texts')} style={previewReadyActionButtonStyle}>
                          Texte pruefen
                        </button>
                        <button type="button" onClick={() => handleToolSelect('marketing')} style={previewReadyActionButtonStyle}>
                          SEO & GEO pruefen
                        </button>
                        {selectedPreviewHref ? (
                          <a
                            href={selectedPreviewHref}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...previewReadyGhostButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                          >
                            Frontend-Preview öffnen
                          </a>
                        ) : null}
                        {selectedPreviewSignoffAt ? (
                          <span style={reviewMessageStyle('success')}>
                            Livegang angefragt am {formatTimestampLabel(selectedPreviewSignoffAt)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRequestLive(effectiveSelectedConfig)}
                            disabled={previewRequestBusy}
                            style={{ ...previewReadySuccessButtonStyle, marginLeft: 'auto' }}
                          >
                            {previewRequestBusy ? 'Anfrage läuft...' : 'Livegang anfragen'}
                          </button>
                        )}
                        {hasInternationalEnabled ? (
                          <button type="button" onClick={() => handleToolSelect('international')} style={previewReadyGhostButtonStyle}>
                            Internationalisierung
                          </button>
                        ) : null}
                      </div>
                      {previewRequestMessage ? (
                        <div style={{ marginTop: '12px' }}>
                          <span style={reviewMessageStyle(previewRequestTone)}>{previewRequestMessage}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {showActivationPanelForEditorSelected ? (
                    <div
                      style={
                        isAwaitingAdminApproval
                          ? awaitingApprovalCardShellStyle
                          : (hideTextsHeaderInActivationFlow ? { ...reviewPanelStrongStyle, maxWidth: 'none', width: '100%' } : reviewPanelStrongStyle)
                      }
                    >
                      {isAwaitingAdminApproval ? (
                        <div style={awaitingApprovalPanelStyle}>
                          <div style={awaitingApprovalBadgeRowStyle}>
                            <span style={awaitingApprovalBadgeStyle}>
                              {activationStatusKey === 'in_review' ? 'In Prüfung' : 'Freigabebereit'}
                            </span>
                          </div>
                          <h3 style={awaitingApprovalTitleStyle}>Die Aktivierung ist eingereicht. Bitte warte auf die Adminfreigabe.</h3>
                          <p style={awaitingApprovalTextStyle}>
                            Deine Pflichtangaben wurden erfolgreich übermittelt und liegen beim Admin zur Prüfung vor. Solange die Prüfung läuft, ist die Aktivierungsmaske gesperrt. Du kannst nach der Freigabe wie gewohnt weiterarbeiten.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowWelcome(true)}
                            style={awaitingApprovalDashboardButtonStyle}
                          >
                            Zum Dashboard
                          </button>
                        </div>
                      ) : (
                        <>
                          {!hideTextsHeaderInActivationFlow ? (
                            <>
                              <div style={reviewPanelTitleStyle}>Aktivierung dieses Gebiets</div>
                              <div style={reviewPanelTextStyle}>
                                Voraussetzung für die Freigabe:
                              </div>
                              <ul style={reviewPanelListStyle}>
                                <li>
                                  Marktüberblick:
                                  {' '}
                                  {mandatoryDirectLinks.map((item, idx) => (
                                    <span key={item.key}>
                                      <button type="button" onClick={() => openTextEditorAt(item.key)} style={inlineLinkButtonStyle}>
                                        {item.label}
                                      </button>
                                      {idx < mandatoryDirectLinks.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </li>
                                <li>
                                  Berater:
                                  {' '}
                                  <button type="button" onClick={() => openTextEditorAt('berater_name')} style={inlineLinkButtonStyle}>
                                    Alle Berater-Felder öffnen
                                  </button>
                                </li>
                                <li>
                                  Makler:
                                  {' '}
                                  <button type="button" onClick={() => openTextEditorAt('makler_name')} style={inlineLinkButtonStyle}>
                                    Alle Makler-Felder öffnen
                                  </button>
                                </li>
                                <li>
                                  Bilder:
                                  {' '}
                                  <button type="button" onClick={() => openTextEditorAt('berater_name')} style={inlineLinkButtonStyle}>
                                    Berater-Avatar
                                  </button>
                                  {', '}
                                  <button type="button" onClick={() => openTextEditorAt('makler_name')} style={inlineLinkButtonStyle}>
                                    Makler-Logo + Makler-Bilder
                                  </button>
                                </li>
                              </ul>
                            </>
                          ) : (
                            <div style={{ ...reviewPanelTextStyle, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                              Für eine erfolgreiche Aktivierung vervollständige bitte die Pflichtangaben inklusive Bild-Uploads in den untenstehenden Eingabeblöcken und klicke danach auf <strong>Freigabe anfordern</strong>.
                            </div>
                          )}
                          <div style={{ marginTop: '14px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div
                              style={{
                                ...progressWrapStyle,
                                flex: 1,
                                minWidth: '320px',
                                margin: 0,
                                minHeight: mandatoryProgressLoading ? '42px' : undefined,
                              }}
                            >
                              {mandatoryProgressLoading ? (
                                <>
                                  <div style={progressHeadStyle}>
                                    <span style={progressLabelSkeletonStyle}>Fortschritt Pflichtangaben</span>
                                    <strong style={progressValueSkeletonStyle}>--/--</strong>
                                  </div>
                                  <div style={progressSkeletonStyle} />
                                </>
                              ) : (
                                <>
                                  <div style={progressHeadStyle}>
                                    <span>Fortschritt Pflichtangaben</span>
                                    <strong>{mandatoryProgress.completed}/{mandatoryProgress.total}</strong>
                                  </div>
                                  <div style={progressTrackStyle}>
                                    <div style={progressFillStyle(animatedMandatoryPercent)} />
                                  </div>
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleSubmitForReview}
                              disabled={submitReviewBusy}
                              style={{
                                border: 'none',
                                borderRadius: '8px',
                                background: submitReviewBusy ? '#94a3b8' : '#0f766e',
                                color: '#fff',
                                padding: '8px 12px',
                                fontWeight: 600,
                                cursor: submitReviewBusy ? 'default' : 'pointer',
                              }}
                            >
                              {submitReviewBusy ? 'Prüfe Freigabe...' : 'Freigabe anfordern'}
                            </button>
                          </div>
                          {!hideTextsHeaderInActivationFlow ? (
                            <div style={reviewPanelTextStyle}>
                              Nach vollständiger Eingabe einfach auf <strong>Freigabe anfordern</strong> klicken.
                            </div>
                          ) : null}
                          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {submitReviewMessage ? (
                            <span style={reviewMessageStyle(submitReviewTone)}>{submitReviewMessage}</span>
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
              <FactorForm ref={factorFormRef} key={`f-${effectiveSelectedConfig.id}`} config={effectiveSelectedConfig} />
            ) : activeMainTab === 'texts' ? (
              isAwaitingAdminApproval ? null : (
                <TextEditorForm
                  key={`t-${effectiveSelectedConfig.id}`}
                  config={effectiveSelectedConfig}
                  enableApproval
                  initialTabId={textFocusTarget?.tabId}
                  focusSectionKey={textFocusTarget?.sectionKey}
                  lockedToMandatory={Boolean(!effectiveSelectedConfig?.is_active)}
                  allowedTabIds={effectiveSelectedConfig?.is_active ? undefined : Array.from(MANDATORY_TAB_IDS)}
                  allowedSectionKeys={effectiveSelectedConfig?.is_active ? undefined : Array.from(mandatoryAllowedKeys)}
                  onFocusHandled={() => setTextFocusTarget(null)}
                  onPersistSuccess={() => setProgressRefreshTick((prev) => prev + 1)}
                />
              )
            ) : activeMainTab === 'marketing' ? (
              <TextEditorForm
                key={`mkt-${effectiveSelectedConfig.id}`}
                config={effectiveSelectedConfig}
                tableName="partner_marketing_texts"
                enableApproval
              />
            ) : activeMainTab === 'local_site' ? (
              <TextEditorForm
                key={`ls-${effectiveSelectedConfig.id}`}
                config={effectiveSelectedConfig}
                tableName="partner_local_site_texts"
                enableApproval
              />
            ) : activeMainTab === 'blog' ? (
              <BlogManager
                key={`blog-${effectiveSelectedConfig.id}`}
                config={effectiveSelectedConfig}
                onNavigateToTexts={(sectionKey) => {
                  openTextEditorAt(sectionKey);
                }}
              />
            ) : activeMainTab === 'international' ? (
              <InternationalizationManager
                config={effectiveSelectedConfig}
                availableLocales={internationalLocales}
              />
            ) : activeMainTab === 'immobilien' ? (
              <OffersManager />
            ) : activeMainTab === 'referenzen' ? (
              <ReferencesManager />
            ) : activeMainTab === 'gesuche' ? (
              <RequestsManager />
            ) : (
              <div style={{ padding: '20px', color: '#64748b' }}>
                Bereich in Vorbereitung.
              </div>
            )}
          </div>
        ) : (
          <div style={emptyStateStyle}>
            {hasRegionAssignments ? (
              <p style={{ margin: 0, fontSize: '16px', color: '#334155' }}>
                Wähl eine Region aus der mittleren Spalte.
              </p>
            ) : (
              <div style={emptyStateCardStyle}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                  Deinem Konto ist aktuell keine Region zugewiesen.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '15px', color: '#475569', lineHeight: 1.45 }}>
                  Melde dich kurz beim Administrator. Nach der Zuweisung wird der Bereich automatisch aktiv.
                </p>
                <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#0f766e', fontWeight: 600 }}>
                  Hinweis: Bitte Administrator kontaktieren.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
      </div>
      <footer style={dashboardFooterStyle}>
        <span style={dashboardFooterCopyStyle}>© {new Date().getFullYear()} Wohnlagencheck24</span>
        <div style={dashboardFooterLinksStyle}>
          <Link href="/impressum" style={dashboardFooterLinkStyle}>Impressum</Link>
          <Link href="/datenschutz" style={dashboardFooterLinkStyle}>Datenschutz</Link>
        </div>
      </footer>
    </div>
  );
}

// --- STYLES ---

const utilityBarStyle: React.CSSProperties = {
  width: '50px',
  minWidth: '50px',
  backgroundColor: 'rgb(72, 107, 122)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 0',
  overflow: 'visible',
  position: 'relative',
  zIndex: 10
};

const toolIconsGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: '4px',
  height: '100%',
  width: '100%',
  overflowY: 'auto' as const,
  padding: '2px 0 8px',
};

const toolGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
};

const toolGroupDividerStyle: React.CSSProperties = {
  width: '28px',
  height: '2px',
  background: 'rgba(255,255,255,0.35)',
  borderRadius: '2px',
  margin: '2px auto 0',
};

const toolIconButtonStyle = (active: boolean, disabled = false) => ({
  width: '30px',
  height: '30px',
  borderRadius: '9px',
  border: active ? '1px solid rgba(255,255,255,0.96)' : '1px solid rgba(255,255,255,0.18)',
  backgroundColor: active ? '#ffffff' : 'rgba(255,255,255,0.12)',
  boxShadow: active ? '0 8px 18px rgba(15,23,42,0.18)' : 'none',
  color: '#111111',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

const utilityTooltipLayerStyle = (top: number): React.CSSProperties => ({
  position: 'absolute',
  top: `${top}px`,
  left: 'calc(100% + 10px)',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  zIndex: 35,
});

const utilityTooltipCardStyle: React.CSSProperties = {
  minWidth: '168px',
  maxWidth: '220px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: '#486b7a',
  color: '#ffffff',
  boxShadow: '0 18px 36px rgba(15,23,42,0.22)',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.35,
};

const dashboardHeaderStyle: React.CSSProperties = {
  minHeight: '72px',
  backgroundColor: '#fff',
  color: '#0f172a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 20px',
  borderBottom: '1px solid #e2e8f0',
  position: 'sticky',
  top: 0,
  zIndex: 40
};

const dashboardStatusStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '12px',
  color: '#94a3b8'
};

const headerActionButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#0f172a',
  padding: '6px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

const dashboardBurgerButtonStyle: React.CSSProperties = {
  border: '3px solid #486b7a',
  borderRadius: '8px',
  background: 'transparent',
  padding: '0.2rem 0.45rem',
  cursor: 'pointer'
};

const menuWrapStyle: React.CSSProperties = {
  position: 'relative'
};

const menuDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '42px',
  minWidth: '180px',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  background: '#fff',
  boxShadow: '0 12px 24px rgba(15, 23, 42, 0.15)',
  padding: '6px',
  zIndex: 200
};

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: '#fff',
  borderRadius: '8px',
  padding: '10px 10px',
  fontSize: '14px',
  color: '#0f172a',
  cursor: 'pointer'
};

const regionSidebarStyle: React.CSSProperties = {
  width: '260px',
  backgroundColor: '#fff',
  borderRight: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column'
};

const sidebarHeaderStyle = {
  padding: '24px',
  borderBottom: '1px solid #f1f5f9'
};

const districtButtonStyle = (active: boolean, isAreaActive: boolean) => ({
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${active ? (isAreaActive ? '#86efac' : '#fcd34d') : (isAreaActive ? '#bbf7d0' : '#fde68a')}`,
  borderRadius: '8px',
  backgroundColor: active ? (isAreaActive ? '#dcfce7' : '#fef3c7') : (isAreaActive ? '#f0fdf4' : '#fffbeb'),
  color: active ? '#1e293b' : '#475569',
  fontWeight: active ? '700' : '500',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '10px'
});

const subAreaListStyle = {
  marginLeft: '24px',
  marginTop: '4px',
  borderLeft: '1px solid #e2e8f0',
  paddingLeft: '8px'
};

const subAreaButtonStyle = (active: boolean) => ({
  width: '100%',
  textAlign: 'left' as const,
  padding: '6px 10px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: active ? '#eff6ff' : 'transparent',
  color: active ? '#2563eb' : '#64748b',
  fontSize: '13px',
  fontWeight: active ? '700' : '500',
  cursor: 'pointer'
});

const mainTitleStyle = {
  fontSize: '32px',
  fontWeight: '800',
  color: '#0f172a',
  margin: 0,
  letterSpacing: '-0.02em'
};

const headerDescriptionStyle = {
  margin: '6px 0 0',
  fontSize: '14px',
  color: '#64748b'
};

const regionTitleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#0f172a',
  margin: 0,
  letterSpacing: '-0.01em'
};
const regionStatusStyle = (statusKey: string): React.CSSProperties => ({
  marginTop: '10px',
  marginBottom: '14px',
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  backgroundColor:
    statusKey === 'live' ? '#dcfce7'
      : statusKey === 'approved_preview' ? '#fef3c7'
        : statusKey === 'ready_for_review' || statusKey === 'in_review' ? '#fef3c7'
          : statusKey === 'changes_requested' ? '#fee2e2'
            : '#e2e8f0',
  color:
    statusKey === 'live' ? '#166534'
      : statusKey === 'approved_preview' ? '#92400e'
        : statusKey === 'ready_for_review' || statusKey === 'in_review' ? '#92400e'
          : statusKey === 'changes_requested' ? '#991b1b'
            : '#334155',
  border:
    statusKey === 'live' ? '1px solid #bbf7d0'
      : statusKey === 'approved_preview' ? '1px solid #fde68a'
        : statusKey === 'ready_for_review' || statusKey === 'in_review' ? '1px solid #fde68a'
          : statusKey === 'changes_requested' ? '1px solid #fecaca'
            : '1px solid #cbd5e1',
});

const emptyStateStyle = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#94a3b8'
};

const emptyStateCardStyle: React.CSSProperties = {
  maxWidth: '720px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.05)',
  padding: '18px 20px',
};

const dashboardFooterStyle: React.CSSProperties = {
  minHeight: '44px',
  borderTop: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  fontSize: '12px',
};

const dashboardFooterCopyStyle: React.CSSProperties = {
  color: '#64748b',
};

const dashboardFooterLinksStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const dashboardFooterLinkStyle: React.CSSProperties = {
  color: '#0f766e',
  textDecoration: 'none',
  fontWeight: 600,
};

const reviewPanelStyle: React.CSSProperties = {
  marginTop: '12px',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  borderRadius: '12px',
  padding: '12px 14px',
  width: '100%',
};

const reviewPanelTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#0f172a',
  marginBottom: '6px',
};

const reviewPanelTextStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#334155',
  margin: 0,
};

const reviewPanelListStyle: React.CSSProperties = {
  margin: '8px 0',
  paddingLeft: '18px',
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.45,
};

const inlineLinkButtonStyle: React.CSSProperties = {
  border: 'none',
  padding: 0,
  margin: 0,
  background: 'transparent',
  color: '#0f766e',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'underline',
};

const progressWrapStyle: React.CSSProperties = {
  margin: '10px 0 12px',
};

const progressHeadStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '12px',
  color: '#334155',
  marginBottom: '6px',
};

const progressTrackStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '10px',
  borderRadius: '999px',
  background: '#e2e8f0',
  overflow: 'hidden',
};

const progressSkeletonStyle: React.CSSProperties = {
  width: '100%',
  height: '10px',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
};

const progressLabelSkeletonStyle: React.CSSProperties = {
  color: '#64748b',
};

const progressValueSkeletonStyle: React.CSSProperties = {
  color: '#94a3b8',
};

const progressFillStyle = (percent: number): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  width: `${percent}%`,
  height: 'auto',
  borderRadius: 'inherit',
  background: percent >= 100 ? '#16a34a' : '#0f766e',
  transition: 'width 0.2s ease',
});

const reviewMessageStyle = (tone: 'info' | 'success' | 'error'): React.CSSProperties => ({
  fontSize: '13px',
  color: tone === 'success' ? '#166534' : tone === 'error' ? '#991b1b' : '#334155',
  background: tone === 'success' ? '#dcfce7' : tone === 'error' ? '#fee2e2' : '#f1f5f9',
  border: tone === 'success' ? '1px solid #bbf7d0' : tone === 'error' ? '1px solid #fecaca' : '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '8px 10px',
});

const awaitingApprovalCardShellStyle: React.CSSProperties = {
  marginTop: '12px',
  border: '1px solid #facc15',
  background: '#fef3c7',
  borderRadius: '12px',
  padding: '14px',
  width: '100%',
};

const awaitingApprovalPanelStyle: React.CSSProperties = {
  marginTop: '2px',
};

const awaitingApprovalBadgeRowStyle: React.CSSProperties = {
  marginBottom: '20px',
};

const awaitingApprovalTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '21px',
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#111827',
};

const awaitingApprovalBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  border: '1px solid #facc15',
  background: '#fde68a',
  color: '#111827',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  padding: '4px 9px',
};

const awaitingApprovalTextStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '15px',
  color: '#374151',
  lineHeight: 1.45,
};

const awaitingApprovalDashboardButtonStyle: React.CSSProperties = {
  marginTop: '10px',
  border: '1px solid #111827',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#111827',
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const previewReadyCardShellStyle: React.CSSProperties = {
  marginTop: '12px',
  border: '1px solid #f59e0b',
  background: 'linear-gradient(180deg, rgba(255, 247, 237, 0.95), #ffffff)',
  borderRadius: '14px',
  padding: '16px',
  width: '100%',
  boxShadow: '0 10px 24px rgba(180, 83, 9, 0.08)',
};

const previewReadyWelcomeBoxStyle: React.CSSProperties = {
  marginTop: '18px',
  background: 'linear-gradient(180deg, rgba(255, 247, 237, 0.95), #ffffff)',
  border: '1px solid #f59e0b',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 8px 16px rgba(180, 83, 9, 0.06)',
};

const previewReadyInnerPanelStyle: React.CSSProperties = {
  marginTop: '18px',
  border: '1px solid #fde68a',
  background: '#ffffff',
  borderRadius: '14px',
  padding: '16px',
};

const previewReadyTextStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '15px',
  color: '#374151',
  lineHeight: 1.6,
};

const previewReadyActionRowStyle: React.CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
};

const previewReadyActionButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  background: '#0f172a',
  color: '#ffffff',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const previewReadyGhostButtonStyle: React.CSSProperties = {
  border: '1px solid #fcd34d',
  borderRadius: '10px',
  background: '#ffffff',
  color: '#92400e',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const previewReadySuccessButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  background: '#16a34a',
  color: '#ffffff',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const successOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  background: 'rgba(15, 23, 42, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const successCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  borderRadius: '14px',
  background: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
  padding: '20px',
};

const successTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '20px',
  fontWeight: 800,
  color: '#0f172a',
};

const successTextStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: 1.5,
  color: '#334155',
};

const successButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  background: '#0f766e',
  color: '#fff',
  padding: '9px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

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
          key: 'blog',
          title: 'Partnerwerbung',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'partner_ads',
          comingSoon: true,
        },
        {
          key: 'blog',
          title: 'Partner-Immobilien',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'partner_immobilien',
          comingSoon: true,
        },
        {
          key: 'blog',
          title: 'Partner-Gesuche',
          description: 'Bereich wird als Zusatzfeature vorbereitet.',
          icon: 'partner_gesuche',
          comingSoon: true,
        },
      ],
    },
  ];
}

const welcomeWrapStyle = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '20px 10px 40px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '28px',
};

const welcomeGroupsStyle: React.CSSProperties = {
  display: 'grid',
  gap: '18px',
};

const welcomeGroupCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px',
  boxShadow: '0 6px 14px rgba(15, 23, 42, 0.04)',
};

const welcomeGroupTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: '16px',
  fontWeight: 800,
  color: '#0f172a',
};

const welcomeHeaderStyle = {
  backgroundColor: '#fff',
  borderRadius: '18px',
  padding: '28px 32px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.06)',
};

const welcomeTitleStyle = {
  margin: 0,
  fontSize: '34px',
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.02em',
};

const welcomeTextStyle = {
  margin: '10px 0 0',
  fontSize: '16px',
  color: '#475569',
  lineHeight: 1.5,
};

const welcomeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
};

const welcomeCardStyle = (disabled: boolean): React.CSSProperties => ({
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px',
  textAlign: 'left' as const,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  boxShadow: '0 10px 18px rgba(15, 23, 42, 0.06)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
});

const welcomeCardIconStyle = {
  minHeight: '36px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  color: '#0f172a',
};

const welcomeCardTitleStyle = {
  fontSize: '16px',
  fontWeight: 800,
  color: '#0f172a',
  marginBottom: '6px',
};

const welcomeCardTextStyle = {
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.4,
};

const settingsHeaderWrapStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 'none',
  background: '#f8fafc',
  padding: '20px 0 14px',
  marginBottom: '30px',
};

const welcomeActivationBoxStyle: React.CSSProperties = {
  background: 'linear-gradient(0deg, rgba(250, 204, 21, 0.10), rgba(250, 204, 21, 0.10)), #ffffff',
  border: '1px solid #facc15',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.04)',
};

const welcomeActivationAwaitingBoxStyle: React.CSSProperties = {
  background: 'linear-gradient(0deg, rgba(239, 68, 68, 0.10), rgba(239, 68, 68, 0.10)), #ffffff',
  border: '1px solid #ef4444',
  borderRadius: '16px',
  padding: '20px 22px',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.04)',
};

const welcomeAwaitingAssignmentTextStyle: React.CSSProperties = {
  margin: '10px 0 0',
  fontSize: '14px',
  lineHeight: 1.55,
  color: '#7f1d1d',
  fontWeight: 600,
};

const activationTabsRowStyle: React.CSSProperties = {
  marginTop: '40px',
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const activationTabButtonStyle = (active: boolean, hovered: boolean): React.CSSProperties => ({
  border: '1px solid #111827',
  background: active ? '#111827' : hovered ? '#f3f4f6' : '#ffffff',
  color: active ? '#ffffff' : '#111827',
  borderRadius: '999px',
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: active ? 800 : 700,
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, color 0.15s ease',
});

const quickAccessRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const quickAccessLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#1f2937',
  fontWeight: 700,
};

const quickAccessSeparatorStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#475569',
  fontWeight: 600,
};

const activationCtaButtonStyle: React.CSSProperties = {
  marginTop: '40px',
  border: 'none',
  borderRadius: '10px',
  background: '#0f766e',
  color: '#ffffff',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

const alreadyActiveInfoStyle: React.CSSProperties = {
  marginTop: '14px',
  border: '1px solid #bbf7d0',
  background: '#f0fdf4',
  color: '#166534',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  fontWeight: 600,
};

const regionHeaderStickyStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  background: '#f8fafc',
  padding: '20px 0 14px',
  marginBottom: '30px',
};

const reviewPanelStrongStyle: React.CSSProperties = {
  ...reviewPanelStyle,
  border: '1px solid #e2e8f0',
};
