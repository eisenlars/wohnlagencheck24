'use client';

import { useEffect, useState } from 'react';

import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkPartnerRecord } from '@/lib/network-partners/types';

type MePayload = {
  network_partner?: NetworkPartnerRecord;
  error?: string;
};

export default function NetworkPartnerProfilePage() {
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch('/api/network-partner/me', { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as MePayload | null;
      if (!active) return;
      if (!response.ok) {
        setError(String(payload?.error ?? 'Profil konnte nicht geladen werden.'));
        return;
      }
      setNetworkPartner(payload?.network_partner ?? null);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <NetworkPartnerShell
      activeSection="profile"
      title="Profil"
      description="Stammdaten und öffentliche Profildaten des Netzwerkpartners."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Unternehmen</strong>
          <div style={{ color: '#334155' }}>{networkPartner?.company_name ?? '—'}</div>
        </article>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Kontakt E-Mail</strong>
          <div style={{ color: '#334155' }}>{networkPartner?.contact_email ?? '—'}</div>
        </article>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Telefon</strong>
          <div style={{ color: '#334155' }}>{networkPartner?.contact_phone ?? '—'}</div>
        </article>
        <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>Website</strong>
          <div style={{ color: '#334155' }}>{networkPartner?.website_url ?? '—'}</div>
        </article>
      </div>
    </NetworkPartnerShell>
  );
}
