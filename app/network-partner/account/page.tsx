'use client';

import { useEffect, useState } from 'react';

import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkPartnerRecord, NetworkPartnerRole } from '@/lib/network-partners/types';

type MePayload = {
  actor?: {
    role?: NetworkPartnerRole;
    user_id?: string;
  };
  network_partner?: NetworkPartnerRecord;
  last_login?: string | null;
  error?: string;
};

export default function NetworkPartnerAccountPage() {
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [role, setRole] = useState<NetworkPartnerRole | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch('/api/network-partner/me', { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as MePayload | null;
      if (!active) return;
      if (!response.ok) {
        setError(String(payload?.error ?? 'Konto konnte nicht geladen werden.'));
        return;
      }
      setNetworkPartner(payload?.network_partner ?? null);
      setRole(payload?.actor?.role ?? null);
      setLastLogin(String(payload?.last_login ?? '').trim() || null);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <NetworkPartnerShell
      activeSection="account"
      title="Konto"
      description="Kontostatus, Rollenbezug und der letzte Zugriff des Netzwerkpartners."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Rolle</strong>
          <div style={{ color: '#334155' }}>{role ?? '—'}</div>
        </article>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Letzter Login</strong>
          <div style={{ color: '#334155' }}>{lastLogin ? new Date(lastLogin).toLocaleString('de-DE') : '—'}</div>
        </article>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Unternehmen</strong>
          <div style={{ color: '#334155' }}>{networkPartner?.company_name ?? '—'}</div>
        </article>
      </div>
    </NetworkPartnerShell>
  );
}
