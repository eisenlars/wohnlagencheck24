'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import BillingOverview from '@/components/network-partners/BillingOverview';
import type { NetworkBillingOverview } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type BillingPayload = NetworkBillingOverview & {
  error?: string;
};

export default function NetworkBillingPage() {
  const [overview, setOverview] = useState<NetworkBillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchOverview() {
    const response = await fetch('/api/partner/network-billing/overview', {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as BillingPayload | null;
    return { response, payload };
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { response, payload } = await fetchOverview();
      if (!active) return;
      if (!response.ok) {
        setOverview(null);
        setError(String(payload?.error ?? 'Billing-Übersicht konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setOverview({
        invoice_lines: Array.isArray(payload?.invoice_lines) ? payload.invoice_lines : [],
        settlement_lines: Array.isArray(payload?.settlement_lines) ? payload.settlement_lines : [],
        month_summaries: Array.isArray(payload?.month_summaries) ? payload.month_summaries : [],
        booking_projection: Array.isArray(payload?.booking_projection) ? payload.booking_projection : [],
        invoice_table_available: payload?.invoice_table_available === true,
        settlement_table_available: payload?.settlement_table_available === true,
      });
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const headlineTotals = useMemo(() => {
    if (!overview) {
      return {
        monthlyGross: 0,
        monthlyFee: 0,
        monthlyNet: 0,
      };
    }
    return overview.booking_projection.reduce(
      (acc, row) => ({
        monthlyGross: Number((acc.monthlyGross + row.monthly_price_eur).toFixed(2)),
        monthlyFee: Number((acc.monthlyFee + row.portal_fee_eur).toFixed(2)),
        monthlyNet: Number((acc.monthlyNet + row.partner_net_eur).toFixed(2)),
      }),
      { monthlyGross: 0, monthlyFee: 0, monthlyNet: 0 },
    );
  }, [overview]);

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
  }

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 56px', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Plattform
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>Billing & Settlement</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 780, lineHeight: 1.6 }}>
            Diese Übersicht trennt Buchungsbasis, Rechnungszeilen und Settlement. KI-Kosten bleiben in Phase 1 bewusst außerhalb dieses Monitors.
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <span>Monatspreise: {formatCurrency(headlineTotals.monthlyGross)}</span>
            <span>Portalfee: {formatCurrency(headlineTotals.monthlyFee)}</span>
            <span>Netto: {formatCurrency(headlineTotals.monthlyNet)}</span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <Link href="/dashboard/network-partners" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Netzwerkpartner
            </Link>
            <Link href="/dashboard/network-bookings" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Buchungen
            </Link>
            <Link href="/dashboard/network-content" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Content & Review
            </Link>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Abrechnungsmonitor</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Die Seite ist in Phase 1 read-only. Sie soll dem Portal-Partner sofort zeigen, welche Erlös- und Fee-Ströme aus den Netzwerkpartner-Buchungen resultieren.
          </p>
        </div>
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : overview ? (
          <BillingOverview
            invoiceLines={overview.invoice_lines}
            settlementLines={overview.settlement_lines}
            monthSummaries={overview.month_summaries}
            bookingProjection={overview.booking_projection}
            invoiceTableAvailable={overview.invoice_table_available}
            settlementTableAvailable={overview.settlement_table_available}
          />
        ) : null}
      </section>
    </main>
  );
}
