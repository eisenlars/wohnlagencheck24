'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import NetworkPartnerAccessPanel from '@/components/network-partners/NetworkPartnerAccessPanel';
import NetworkPartnerForm from '@/components/network-partners/NetworkPartnerForm';
import type { NetworkPartnerRecord } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type NetworkPartnerDetailPayload = {
  network_partner?: NetworkPartnerRecord;
  error?: string;
};

type NetworkPartnerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function NetworkPartnerDetailPage({ params }: NetworkPartnerDetailPageProps) {
  const resolvedParams = use(params);
  const networkPartnerId = String(resolvedParams.id ?? '').trim();
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!networkPartnerId) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as NetworkPartnerDetailPayload | null;
      if (!active) return;
      if (!response.ok) {
        setNetworkPartner(null);
        setError(String(payload?.error ?? 'Netzwerkpartner konnte nicht geladen werden.'));
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
  }, [networkPartnerId]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 56px', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <Link href="/dashboard/network-partners" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Zurück zur Übersicht
          </Link>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>Netzwerkpartner bearbeiten</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 720, lineHeight: 1.6 }}>
            Stammdaten, Status und Managed-Editing-Freigabe werden hier direkt am Mandanten gepflegt.
          </p>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
            {networkPartner?.company_name ?? 'Netzwerkpartner'}
          </h2>
          {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
          {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        </div>
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : networkPartner ? (
          <div style={{ display: 'grid', gap: 22 }}>
            <NetworkPartnerForm
              initialValues={networkPartner}
              submitLabel="Änderungen speichern"
              onSubmit={async (values) => {
                setError(null);
                setMessage(null);
                const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartner.id)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(values),
                });
                const payload = (await response.json().catch(() => null)) as NetworkPartnerDetailPayload | null;
                if (!response.ok) {
                  setError(String(payload?.error ?? 'Netzwerkpartner konnte nicht aktualisiert werden.'));
                  return;
                }
                setNetworkPartner(payload?.network_partner ?? null);
                setMessage('Änderungen wurden gespeichert.');
              }}
            />
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 22 }}>
              <NetworkPartnerAccessPanel
                networkPartnerId={networkPartner.id}
                contactEmail={networkPartner.contact_email}
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
