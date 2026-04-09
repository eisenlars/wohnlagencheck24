'use client';

import { useEffect, useMemo, useState } from 'react';

import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkPartnerRecord, NetworkPartnerRole } from '@/lib/network-partners/types';

type MePayload = {
  actor?: {
    role?: NetworkPartnerRole;
    network_partner_id?: string;
    user_id?: string;
  };
  network_partner?: NetworkPartnerRecord;
  error?: string;
};

export default function NetworkPartnerHomePage() {
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [role, setRole] = useState<NetworkPartnerRole | null>(null);
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
        setRole(null);
        setError(String(payload?.error ?? 'Netzwerkpartner-Kontext konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setNetworkPartner(payload?.network_partner ?? null);
      setRole(payload?.actor?.role ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = useMemo(() => networkPartner?.status ?? '—', [networkPartner]);

  return (
    <NetworkPartnerShell
      activeSection="home"
      title="Netzwerkpartner-Bereich"
      description="Dieser Bereich ist der getrennte Self-Service für regionale Netzwerkpartner. Anbindungen, Content, Buchungen, Rechnungen und Kostenmonitor laufen hier im eigenen Scope."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : networkPartner ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: 6 }}>Unternehmen</strong>
            <div style={{ color: '#334155' }}>{networkPartner.company_name}</div>
          </article>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: 6 }}>Rolle</strong>
            <div style={{ color: '#334155' }}>{role ?? '—'}</div>
          </article>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: 6 }}>Status</strong>
            <div style={{ color: '#334155' }}>{statusLabel}</div>
          </article>
          <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: 6 }}>Managed Editing</strong>
            <div style={{ color: '#334155' }}>{networkPartner.managed_editing_enabled ? 'Aktiv' : 'Aus'}</div>
          </article>
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Kein Netzwerkpartner-Kontext gefunden.</p>
      )}
    </NetworkPartnerShell>
  );
}
