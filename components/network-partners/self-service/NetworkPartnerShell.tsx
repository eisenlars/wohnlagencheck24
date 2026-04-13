'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '@/utils/supabase/client';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkPartnerRecord, NetworkPartnerRole } from '@/lib/network-partners/types';

type ShellSection =
  | 'home'
  | 'integrations'
  | 'content'
  | 'bookings'
  | 'invoices'
  | 'monitor'
  | 'account'
  | 'profile';

type NetworkPartnerShellProps = {
  title: string;
  description: string;
  activeSection: ShellSection;
  hidePrimaryNav?: boolean;
  centerHeaderContent?: boolean;
  hideHeaderLabel?: boolean;
  hideHeaderMeta?: boolean;
  hideContentHeader?: boolean;
  surfacelessContent?: boolean;
  children: ReactNode;
};

type MePayload = {
  actor?: {
    role?: NetworkPartnerRole;
  };
  network_partner?: NetworkPartnerRecord;
  last_login?: string | null;
  error?: string;
};

type NavItem = {
  key: ShellSection;
  label: string;
  href: string;
  icon: ReactNode;
};

function renderIcon(key: ShellSection) {
  const baseProps = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (key) {
    case 'home':
      return (
        <svg {...baseProps}>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6.5 10.5V20h11v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'integrations':
      return (
        <svg {...baseProps}>
          <path d="M7 7h4" />
          <path d="M13 17h4" />
          <path d="M14 7h3v3" />
          <path d="M7 14H4v3" />
          <path d="m10 14 4-4" />
        </svg>
      );
    case 'content':
      return (
        <svg {...baseProps}>
          <path d="M7 4h8l4 4v12H7z" />
          <path d="M15 4v4h4" />
          <path d="M10 13h6" />
          <path d="M10 17h6" />
        </svg>
      );
    case 'bookings':
      return (
        <svg {...baseProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
        </svg>
      );
    case 'invoices':
      return (
        <svg {...baseProps}>
          <path d="M6 4h12v16l-3-2-3 2-3-2-3 2z" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
        </svg>
      );
    case 'monitor':
      return (
        <svg {...baseProps}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19v-11" />
        </svg>
      );
    case 'account':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-4 4.1-6 7-6s5.5 2 7 6" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...baseProps}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
  }
}

const PRIMARY_NAV: NavItem[] = [
  { key: 'home', label: 'Start', href: '/network-partner', icon: renderIcon('home') },
  { key: 'integrations', label: 'Anbindungen', href: '/network-partner/integrations', icon: renderIcon('integrations') },
  { key: 'content', label: 'Content', href: '/network-partner/content', icon: renderIcon('content') },
  { key: 'bookings', label: 'Buchungen', href: '/network-partner/bookings', icon: renderIcon('bookings') },
  { key: 'invoices', label: 'Rechnungen', href: '/network-partner/invoices', icon: renderIcon('invoices') },
  { key: 'monitor', label: 'Monitor', href: '/network-partner/monitor', icon: renderIcon('monitor') },
];

const MENU_NAV: NavItem[] = [
  { key: 'account', label: 'Konto', href: '/network-partner/account', icon: renderIcon('account') },
  { key: 'profile', label: 'Profil', href: '/network-partner/profile', icon: renderIcon('profile') },
  { key: 'integrations', label: 'Anbindungen', href: '/network-partner/integrations', icon: renderIcon('integrations') },
  { key: 'monitor', label: 'Monitor', href: '/network-partner/monitor', icon: renderIcon('monitor') },
];

export default function NetworkPartnerShell({
  title,
  description,
  activeSection,
  hidePrimaryNav = false,
  centerHeaderContent = false,
  hideHeaderLabel = false,
  hideHeaderMeta = false,
  hideContentHeader = false,
  surfacelessContent = false,
  children,
}: NetworkPartnerShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const utilityBarRef = useRef<HTMLElement | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [role, setRole] = useState<NetworkPartnerRole | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [hoveredNavKey, setHoveredNavKey] = useState<ShellSection | null>(null);
  const [hoveredNavTop, setHoveredNavTop] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadMe() {
      const response = await fetch('/api/network-partner/me', { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as MePayload | null;
      if (!active || !response.ok) return;
      setNetworkPartner(payload?.network_partner ?? null);
      setRole(payload?.actor?.role ?? null);
      setLastLogin(String(payload?.last_login ?? '').trim() || null);
    }
    void loadMe();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/network-partner/login');
    router.refresh();
  }

  function navigateTo(href: string) {
    setShowSettingsMenu(false);
    router.push(href);
  }

  function updateHoveredNav(key: ShellSection, element: HTMLButtonElement) {
    const utilityBarRect = utilityBarRef.current?.getBoundingClientRect();
    const buttonRect = element.getBoundingClientRect();
    setHoveredNavKey(key);
    setHoveredNavTop(
      utilityBarRect
        ? buttonRect.top - utilityBarRect.top + buttonRect.height / 2
        : null,
    );
  }

  const hoveredNavItem = PRIMARY_NAV.find((item) => item.key === hoveredNavKey) ?? null;

  return (
    <div style={shellPageStyle}>
      <header style={dashboardHeaderStyle}>
        <Link
          href="/network-partner"
          className="brand-header"
          style={{ margin: 0, cursor: 'pointer' }}
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
        </Link>

        <div style={dashboardStatusStyle}>
          <div>{lastLogin ? `Letzter Login: ${new Date(lastLogin).toLocaleString('de-DE')}` : 'Letzter Login: –'}</div>
          <Link href="/network-partner" style={headerActionButtonStyle}>
            <span aria-hidden>⌂</span>
            <span>Home</span>
          </Link>
          <button type="button" style={headerActionButtonStyle} onClick={handleLogout} title="Abmelden">
            <span aria-hidden>⎋</span>
            <span>Ausloggen</span>
          </button>
          <div style={menuWrapStyle}>
            <button
              type="button"
              style={dashboardBurgerButtonStyle}
              onClick={() => setShowSettingsMenu((value) => !value)}
              aria-label="Menü öffnen"
              title="Menü öffnen"
            >
              <span style={dashboardBurgerIconStyle} />
            </button>
            {showSettingsMenu ? (
              <div style={menuDropdownStyle}>
                {MENU_NAV.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    style={menuItemStyle}
                    onClick={() => navigateTo(item.href)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

        <div style={shellBodyStyle}>
        {hidePrimaryNav ? null : (
          <aside
            ref={utilityBarRef}
            style={utilityBarStyle}
            onMouseLeave={() => {
              setHoveredNavKey(null);
              setHoveredNavTop(null);
            }}
          >
            <div style={toolIconsGroupStyle}>
              {PRIMARY_NAV.map((item) => {
                const active = item.key === activeSection;
                const hovered = item.key === hoveredNavKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateTo(item.href)}
                    onMouseEnter={(event) => updateHoveredNav(item.key, event.currentTarget)}
                    onFocus={(event) => updateHoveredNav(item.key, event.currentTarget)}
                    style={toolIconButtonStyle(active, hovered)}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </button>
                );
              })}
            </div>
            {hoveredNavItem && hoveredNavTop !== null ? (
              <div style={utilityTooltipLayerStyle(hoveredNavTop)}>
                <div style={utilityTooltipCardStyle}>{hoveredNavItem.label}</div>
              </div>
            ) : null}
          </aside>
        )}

        <main style={contentStageStyle}>
          {hideContentHeader ? null : (
            <section style={contentHeaderStyle}>
              <div style={contentHeaderTextBlockStyle(centerHeaderContent)}>
                {hideHeaderLabel ? null : <span style={contentLabelStyle(centerHeaderContent)}>Netzwerkpartner-Bereich</span>}
                <h1 style={{ margin: 0, color: '#0f172a', fontSize: 28, lineHeight: 1.2 }}>{title}</h1>
                <p style={contentDescriptionStyle(centerHeaderContent)}>
                  {description}
                </p>
              </div>
              {hideHeaderMeta ? null : (
                <div style={contentMetaRowStyle}>
                  <span style={contentMetaBadgeStyle}>{networkPartner?.company_name ?? 'Netzwerkpartner'}</span>
                  <span style={contentMetaTextStyle}>Rolle: {role ?? '—'}</span>
                  <span style={contentMetaTextStyle}>Status: {networkPartner?.status ?? '—'}</span>
                </div>
              )}
            </section>
          )}

          <section style={surfacelessContent ? contentPanelBareStyle : contentPanelStyle}>
            {children}
          </section>
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

const shellPageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#f8fafc',
};

const shellBodyStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
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
  zIndex: 40,
};

const dashboardStatusStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '12px',
  color: '#94a3b8',
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
  textDecoration: 'none',
};

const dashboardBurgerButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#0f172a',
  padding: '0 10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '34px',
  lineHeight: 1,
};

const dashboardBurgerIconStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  display: 'block',
  backgroundImage: 'linear-gradient(#0f172a,#0f172a), linear-gradient(#0f172a,#0f172a), linear-gradient(#0f172a,#0f172a)',
  backgroundSize: '16px 2px, 16px 2px, 16px 2px',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center 3px, center 7px, center 11px',
};

const menuWrapStyle: React.CSSProperties = {
  position: 'relative',
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
  zIndex: 200,
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
  cursor: 'pointer',
};

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
  zIndex: 20,
};

const toolIconsGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  height: '100%',
  width: '100%',
  overflowY: 'auto',
  padding: '2px 0 8px',
};

const toolIconButtonStyle = (active: boolean, hovered = false): React.CSSProperties => ({
  width: '30px',
  height: '30px',
  borderRadius: '9px',
  border: active ? '1px solid #ffe000' : '1px solid rgba(255,255,255,0.92)',
  backgroundColor: active ? '#ffe000' : '#ffffff',
  boxShadow: active
    ? '0 8px 18px rgba(15,23,42,0.18)'
    : hovered
      ? '0 8px 18px rgba(15,23,42,0.14)'
      : 'none',
  color: '#111111',
  cursor: 'pointer',
  transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transform: hovered ? 'translateX(1px)' : 'none',
});

const utilityTooltipLayerStyle = (top: number): React.CSSProperties => ({
  position: 'absolute',
  top: `${top}px`,
  left: 'calc(100% + 10px)',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  zIndex: 60,
});

const utilityTooltipCardStyle: React.CSSProperties = {
  minWidth: '168px',
  maxWidth: '220px',
  borderRadius: '12px',
  background: '#ffe000',
  color: '#111111',
  boxShadow: '0 18px 36px rgba(15,23,42,0.18)',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.35,
};

const contentStageStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  overflow: 'auto',
  background: '#f8fafc',
};

const contentHeaderStyle: React.CSSProperties = {
  padding: '24px 24px 0',
  display: 'grid',
  gap: 14,
};

const contentHeaderTextBlockStyle = (centered: boolean): React.CSSProperties => ({
  display: 'grid',
  gap: 8,
  justifyItems: centered ? 'center' : 'start',
  textAlign: centered ? 'center' : 'left',
});

const contentLabelStyle = (centered: boolean): React.CSSProperties => ({
  color: '#486b7a',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  justifySelf: centered ? 'center' : 'start',
});

const contentDescriptionStyle = (centered: boolean): React.CSSProperties => ({
  margin: 0,
  color: '#475569',
  maxWidth: centered ? 760 : 920,
  lineHeight: 1.6,
  textAlign: centered ? 'center' : 'left',
});

const contentMetaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const contentMetaBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 999,
  background: '#e0f2fe',
  color: '#0c4a6e',
  fontSize: 12,
  fontWeight: 800,
};

const contentMetaTextStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
};

const contentPanelStyle: React.CSSProperties = {
  margin: '18px 24px 24px',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  background: '#fff',
  padding: '24px',
  display: 'grid',
  gap: 18,
  alignContent: 'start',
};

const contentPanelBareStyle: React.CSSProperties = {
  margin: '18px 24px 24px',
  display: 'grid',
  gap: 18,
  alignContent: 'start',
};

const dashboardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  padding: '18px 24px 22px 74px',
  borderTop: '1px solid #dbe4ee',
  background: '#fff',
};

const dashboardFooterCopyStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 600,
};

const dashboardFooterLinksStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  flexWrap: 'wrap',
};

const dashboardFooterLinkStyle: React.CSSProperties = {
  color: '#486b7a',
  fontSize: '12px',
  fontWeight: 700,
  textDecoration: 'none',
};
