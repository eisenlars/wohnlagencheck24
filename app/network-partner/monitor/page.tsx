'use client';

import { useEffect, useMemo, useState } from 'react';

import AIUsageTable from '@/components/network-partners/AIUsageTable';
import InvoiceList from '@/components/network-partners/self-service/InvoiceList';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkBillingProjectionRow, NetworkPartnerInvoiceLineRecord, PartnerAIUsageEventRecord } from '@/lib/network-partners/types';

type InvoicesPayload = {
  invoice_lines?: NetworkPartnerInvoiceLineRecord[];
  booking_projection?: NetworkBillingProjectionRow[];
  invoice_table_available?: boolean;
  error?: string;
};

type UsagePayload = {
  usage_events?: PartnerAIUsageEventRecord[];
  error?: string;
};

function buildCurrentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function NetworkPartnerMonitorPage() {
  const [invoiceLines, setInvoiceLines] = useState<NetworkPartnerInvoiceLineRecord[]>([]);
  const [bookingProjection, setBookingProjection] = useState<NetworkBillingProjectionRow[]>([]);
  const [invoiceTableAvailable, setInvoiceTableAvailable] = useState(false);
  const [usageEvents, setUsageEvents] = useState<PartnerAIUsageEventRecord[]>([]);
  const [periodKey, setPeriodKey] = useState(buildCurrentPeriodKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const [invoicesResponse, usageResponse] = await Promise.all([
        fetch('/api/network-partner/invoices', { method: 'GET', cache: 'no-store' }),
        fetch(`/api/network-partner/ai-usage?period_key=${encodeURIComponent(periodKey)}&limit=25`, { method: 'GET', cache: 'no-store' }),
      ]);
      if (redirectIfUnauthorizedResponse(invoicesResponse, 'network_partner')) return;
      if (redirectIfUnauthorizedResponse(usageResponse, 'network_partner')) return;
      const invoicesPayload = (await invoicesResponse.json().catch(() => null)) as InvoicesPayload | null;
      const usagePayload = (await usageResponse.json().catch(() => null)) as UsagePayload | null;
      if (!active) return;
      if (!invoicesResponse.ok || !usageResponse.ok) {
        setInvoiceLines([]);
        setBookingProjection([]);
        setUsageEvents([]);
        setInvoiceTableAvailable(false);
        setError(String(invoicesPayload?.error ?? usagePayload?.error ?? 'Monitor konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setInvoiceLines(Array.isArray(invoicesPayload?.invoice_lines) ? invoicesPayload.invoice_lines : []);
      setBookingProjection(Array.isArray(invoicesPayload?.booking_projection) ? invoicesPayload.booking_projection : []);
      setInvoiceTableAvailable(invoicesPayload?.invoice_table_available === true);
      setUsageEvents(Array.isArray(usagePayload?.usage_events) ? usagePayload.usage_events : []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [periodKey]);

  const totals = useMemo(() => {
    const invoiceTotal = invoiceLines.reduce((sum, line) => sum + Number(line.amount_eur ?? 0), 0);
    const projectionTotal = bookingProjection.reduce((sum, row) => sum + Number(row.monthly_price_eur ?? 0), 0);
    const aiTotal = usageEvents.reduce((sum, event) => sum + Number(event.estimated_cost_eur ?? 0), 0);
    return {
      invoiceTotal,
      projectionTotal,
      aiTotal,
    };
  }, [bookingProjection, invoiceLines, usageEvents]);

  return (
    <NetworkPartnerShell
      activeSection="monitor"
      title="Monitor"
      description="Kaufmännischer Überblick über Rechnungen, Buchungsbasis und KI-Nutzung des Netzwerkpartners."
    >
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>KI-Periode</span>
          <input
            value={periodKey}
            onChange={(event) => setPeriodKey(event.target.value)}
            placeholder="YYYY-MM"
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <article style={{ border: '1px solid #dbeafe', borderRadius: 14, padding: 16, background: '#eff6ff' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Rechnungen</div>
          <strong style={{ display: 'block', marginTop: 8, color: '#0f172a', fontSize: 22 }}>{formatCurrency(totals.invoiceTotal)}</strong>
          <div style={{ marginTop: 6, color: '#475569' }}>{invoiceLines.length} Rechnungszeilen</div>
        </article>
        <article style={{ border: '1px solid #dcfce7', borderRadius: 14, padding: 16, background: '#f0fdf4' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.6 }}>Buchungsbasis</div>
          <strong style={{ display: 'block', marginTop: 8, color: '#0f172a', fontSize: 22 }}>{formatCurrency(totals.projectionTotal)}</strong>
          <div style={{ marginTop: 6, color: '#475569' }}>{bookingProjection.length} aktive Positionen</div>
        </article>
        <article style={{ border: '1px solid #e9d5ff', borderRadius: 14, padding: 16, background: '#faf5ff' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.6 }}>KI-Nutzung</div>
          <strong style={{ display: 'block', marginTop: 8, color: '#0f172a', fontSize: 22 }}>{formatCurrency(totals.aiTotal)}</strong>
          <div style={{ marginTop: 6, color: '#475569' }}>{usageEvents.length} KI-Ereignisse</div>
        </article>
      </div>

      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Rechnungen & Buchungsbasis</h3>
            <InvoiceList
              invoiceLines={invoiceLines}
              bookingProjection={bookingProjection}
              invoiceTableAvailable={invoiceTableAvailable}
            />
          </section>
          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>KI-Nutzung</h3>
            <AIUsageTable usageEvents={usageEvents} />
          </section>
        </div>
      )}
    </NetworkPartnerShell>
  );
}
