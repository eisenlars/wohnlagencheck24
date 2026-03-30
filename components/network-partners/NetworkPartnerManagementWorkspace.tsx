'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import NetworkPartnerForm from '@/components/network-partners/NetworkPartnerForm';
import NetworkPartnerTable from '@/components/network-partners/NetworkPartnerTable';
import type { NetworkPartnerRecord } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type NetworkPartnerListPayload = {
  network_partners?: NetworkPartnerRecord[];
  error?: string;
};

export default function NetworkPartnerManagementWorkspace() {
  const [networkPartners, setNetworkPartners] = useState<NetworkPartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchNetworkPartners() {
    const response = await fetch('/api/partner/network-partners', { method: 'GET', cache: 'no-store' });
    return (await response.json().catch(() => null)) as NetworkPartnerListPayload | null;
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const payload = await fetchNetworkPartners();
      if (!active) return;
      if (!Array.isArray(payload?.network_partners) && payload?.error) {
        setNetworkPartners([]);
        setError(String(payload.error ?? 'Netzwerkpartner konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setNetworkPartners(Array.isArray(payload?.network_partners) ? payload.network_partners : []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ width: '100%', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Regionale Partner
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>Netzwerkpartner Verwaltung</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 920, lineHeight: 1.6 }}>
            Portal-Partner verwalten hier regionale Reichweitenkunden, deren Zugänge, Inventar, Buchungen, Integrationen, Content und Abrechnung.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
            <Link href="/dashboard/network-inventory" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Inventar
            </Link>
            <Link href="/dashboard/network-bookings" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Buchungen
            </Link>
            <Link href="/dashboard/network-content" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Content & Review
            </Link>
            <Link href="/dashboard/network-billing" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Billing
            </Link>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Neuen Netzwerkpartner anlegen</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Der Partner wird dem aktuell eingeloggten Portal-Partner zugeordnet. Buchungen, Content, Integrationen und Rechnungen bauen auf diesem Stammdatensatz auf.
          </p>
        </div>
        {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        <NetworkPartnerForm
          submitLabel="Netzwerkpartner anlegen"
          onSubmit={async (values) => {
            setError(null);
            setMessage(null);
            const response = await fetch('/api/partner/network-partners', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Netzwerkpartner konnte nicht angelegt werden.'));
              return;
            }
            setMessage('Netzwerkpartner wurde angelegt.');
            setLoading(true);
            const refreshedPayload = await fetchNetworkPartners();
            setNetworkPartners(Array.isArray(refreshedPayload?.network_partners) ? refreshedPayload.network_partners : []);
            setLoading(false);
          }}
        />
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Bestehende Netzwerkpartner</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Detailbearbeitung, Zugangseinladungen und Managed-Editing-Freigaben erfolgen über die jeweilige Partnerseite.
          </p>
        </div>
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : (
          <NetworkPartnerTable networkPartners={networkPartners} />
        )}
      </section>
    </div>
  );
}
