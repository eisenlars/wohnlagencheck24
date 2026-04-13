'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkPartnerRecord } from '@/lib/network-partners/types';

type MePayload = {
  network_partner?: NetworkPartnerRecord;
  error?: string;
};

export default function NetworkPartnerHomePage() {
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/network-partner/me', { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as MePayload | null;
      if (!active) return;
      if (!response.ok) {
        setNetworkPartner(null);
        setError(String(payload?.error ?? 'Netzwerkpartner-Kontext konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setNetworkPartner(payload?.network_partner ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <NetworkPartnerShell
      activeSection="home"
      hidePrimaryNav
      hideContentHeader
      surfacelessContent
      title={networkPartner?.company_name ? `Willkommen ${networkPartner.company_name}` : 'Willkommen'}
      description="Hier verwaltest du deine Buchungen und Inhalte."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : networkPartner ? (
        <div style={welcomeWrapStyle}>
          <div style={welcomeHeaderStyle}>
            <h1 style={welcomeTitleStyle}>
              {networkPartner.company_name ? `Willkommen ${networkPartner.company_name}` : 'Willkommen'}
            </h1>
            <p style={welcomeTextStyle}>
              Hier verwaltest du deine Buchungen und Inhalte. Wähl einfach einen Bereich aus und leg los.
            </p>
          </div>
          <div style={welcomeGroupsStyle}>
            <section style={welcomeGroupCardStyle}>
              <h2 style={welcomeGroupTitleStyle}>Arbeitsbereiche</h2>
              <div style={welcomeGridStyle}>
                {HOME_ACTIONS.map((action) => (
                  <Link key={action.href} href={action.href} style={welcomeActionStyle}>
                    <div style={welcomeActionIconStyle}>{action.icon}</div>
                    <div style={welcomeActionTitleStyle}>{action.title}</div>
                    <div style={welcomeActionTextStyle}>{action.description}</div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Kein Netzwerkpartner-Kontext gefunden.</p>
      )}
    </NetworkPartnerShell>
  );
}

const HOME_ACTIONS = [
  {
    href: '/network-partner/integrations',
    title: 'Anbindungen',
    description: 'CRM- und LLM-Anbindungen konfigurieren, testen und laufend pflegen.',
    icon: renderHomeIcon('integrations'),
  },
  {
    href: '/network-partner/bookings',
    title: 'Buchungen',
    description: 'Aktive Leistungen, Laufzeiten und regionale Platzierungen im Blick behalten.',
    icon: renderHomeIcon('bookings'),
  },
  {
    href: '/network-partner/content',
    title: 'Content',
    description: 'Inhalte bearbeiten, Freigabestände prüfen und Veröffentlichungen vorbereiten.',
    icon: renderHomeIcon('content'),
  },
  {
    href: '/network-partner/invoices',
    title: 'Rechnungen',
    description: 'Abgerechnete Positionen und Perioden übersichtlich nachverfolgen.',
    icon: renderHomeIcon('invoices'),
  },
  {
    href: '/network-partner/monitor',
    title: 'Monitor',
    description: 'Kosten, KI-Nutzung und kaufmännische Kennzahlen zentral überwachen.',
    icon: renderHomeIcon('monitor'),
  },
];

function renderHomeIcon(key: 'integrations' | 'bookings' | 'content' | 'invoices' | 'monitor') {
  const baseProps = {
    width: 30,
    height: 30,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (key) {
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
    case 'bookings':
      return (
        <svg {...baseProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
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
  }
}

const welcomeWrapStyle: React.CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: '24px',
  alignContent: 'start',
};

const welcomeHeaderStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '18px',
  padding: '28px 32px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.06)',
};

const welcomeTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '34px',
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.02em',
};

const welcomeTextStyle: React.CSSProperties = {
  margin: '10px 0 0',
  fontSize: '16px',
  color: '#475569',
  lineHeight: 1.5,
};

const welcomeGroupsStyle: React.CSSProperties = {
  display: 'grid',
  gap: '24px',
};

const welcomeGroupCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '14px',
};

const welcomeGroupTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: '16px',
  fontWeight: 800,
  color: '#0f172a',
};

const welcomeGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const welcomeActionStyle: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  minHeight: 170,
  padding: 20,
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  textDecoration: 'none',
  alignContent: 'start',
  boxShadow: '0 10px 18px rgba(15, 23, 42, 0.06)',
  textAlign: 'left',
};

const welcomeActionIconStyle: React.CSSProperties = {
  minHeight: '36px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  color: '#0f172a',
};

const welcomeActionTitleStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.2,
  marginBottom: '6px',
};

const welcomeActionTextStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.4,
};
