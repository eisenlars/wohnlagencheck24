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
      title={networkPartner?.company_name ? `Willkommen ${networkPartner.company_name}` : 'Willkommen'}
      description="Hier verwaltest du deine Buchungen und Inhalte."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : networkPartner ? (
        <div style={welcomeWrapStyle}>
          <div style={welcomeCardStyle}>
            <div style={welcomeGridStyle}>
              {HOME_ACTIONS.map((action) => (
                <Link key={action.href} href={action.href} style={welcomeActionStyle}>
                  <div style={welcomeActionTitleStyle}>{action.title}</div>
                  <div style={welcomeActionTextStyle}>{action.description}</div>
                </Link>
              ))}
            </div>
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
  },
  {
    href: '/network-partner/bookings',
    title: 'Buchungen',
    description: 'Aktive Leistungen, Laufzeiten und regionale Platzierungen im Blick behalten.',
  },
  {
    href: '/network-partner/content',
    title: 'Content',
    description: 'Inhalte bearbeiten, Freigabestände prüfen und Veröffentlichungen vorbereiten.',
  },
  {
    href: '/network-partner/invoices',
    title: 'Rechnungen',
    description: 'Abgerechnete Positionen und Perioden übersichtlich nachverfolgen.',
  },
  {
    href: '/network-partner/monitor',
    title: 'Monitor',
    description: 'Kosten, KI-Nutzung und kaufmännische Kennzahlen zentral überwachen.',
  },
];

const welcomeWrapStyle: React.CSSProperties = {
  minHeight: '52vh',
  display: 'grid',
  placeItems: 'center',
  padding: '20px 0 8px',
};

const welcomeCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 980,
  border: '1px solid #dbeafe',
  borderRadius: 24,
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
  padding: 28,
};

const welcomeGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const welcomeActionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  minHeight: 150,
  padding: 20,
  borderRadius: 18,
  border: '1px solid #dbeafe',
  background: '#eff6ff',
  textDecoration: 'none',
  alignContent: 'start',
};

const welcomeActionTitleStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.2,
};

const welcomeActionTextStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: 14,
  lineHeight: 1.55,
};
