'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BillingOverview from '@/components/network-partners/BillingOverview';
import type { NetworkBillingOverview, NetworkBillingRunResponse, NetworkBillingRunResult } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type BillingPayload = NetworkBillingOverview & {
  error?: string;
};

type NetworkBillingWorkspaceProps = {
  networkPartnerId?: string;
  networkPartnerName?: string | null;
};

export default function NetworkBillingWorkspace({
  networkPartnerId,
  networkPartnerName,
}: NetworkBillingWorkspaceProps) {
  const [overview, setOverview] = useState<NetworkBillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runPeriodKey, setRunPeriodKey] = useState(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  });
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<NetworkBillingRunResult | null>(null);

  const fetchOverview = useCallback(async () => {
    const overviewUrl = networkPartnerId
      ? `/api/partner/network-billing/overview?network_partner_id=${encodeURIComponent(networkPartnerId)}`
      : '/api/partner/network-billing/overview';
    const response = await fetch(overviewUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as BillingPayload | null;
    return { response, payload };
  }, [networkPartnerId]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { response, payload } = await fetchOverview();
    if (!response.ok) {
      setOverview(null);
      setError(String(payload?.error ?? 'Abrechnungsübersicht konnte nicht geladen werden.'));
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
  }, [fetchOverview]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!active) return;
      await loadOverview();
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadOverview]);

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

  async function handleRunBilling() {
    setRunLoading(true);
    setRunError(null);

    const response = await fetch('/api/partner/network-billing/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ period_key: runPeriodKey }),
    });

    const payload = (await response.json().catch(() => null)) as (NetworkBillingRunResponse & { error?: string }) | null;

    if (!response.ok || payload?.ok !== true) {
      setRunError(String(payload?.error ?? 'Abrechnungslauf konnte nicht gestartet werden.'));
      setRunLoading(false);
      return;
    }

    setLastRunResult(payload.result);
    await loadOverview();
    setRunLoading(false);
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Plattform
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>
            {networkPartnerId ? `${networkPartnerName ?? 'Netzwerkpartner'}: Partnererlöse` : 'Partnererlöse'}
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 780, lineHeight: 1.6 }}>
            Diese Übersicht zeigt, welche Erlöse das Netzwerkpartner-Geschäft aktuell trägt und welches Potenzial bereits in gebuchten Leistungen steckt.
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <span>Monatspreise: {formatCurrency(headlineTotals.monthlyGross)}</span>
            <span>Portalfee: {formatCurrency(headlineTotals.monthlyFee)}</span>
            <span>Netto: {formatCurrency(headlineTotals.monthlyNet)}</span>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
            {networkPartnerId ? 'Erlöse dieses Partners' : 'Erlösübersicht'}
          </h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            {networkPartnerId
              ? 'Die Sicht zeigt, welche Erlöse und Abrechnungswerte der ausgewählte Netzwerkpartner aktuell zum Gesamtgeschäft beiträgt.'
              : 'Die Übersicht zeigt gebuchte Erlöse, Abrechnungsbasis und Settlement über das gesamte Netzwerkpartner-Geschäft. So wird sichtbar, wo weiteres Ausbaupotenzial liegt.'}
          </p>
        </div>
        {!networkPartnerId ? (
          <div
            style={{
              display: 'grid',
              gap: 12,
              padding: 16,
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 6, minWidth: 180 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Periode</span>
                <input
                  value={runPeriodKey}
                  onChange={(event) => setRunPeriodKey(event.target.value)}
                  placeholder="YYYY-MM"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '10px 12px',
                    font: 'inherit',
                    color: '#0f172a',
                    background: '#fff',
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void handleRunBilling()}
                disabled={runLoading}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '11px 18px',
                  font: 'inherit',
                  fontWeight: 700,
                  color: '#fff',
                  background: runLoading ? '#94a3b8' : '#0f172a',
                  cursor: runLoading ? 'wait' : 'pointer',
                }}
              >
                {runLoading ? 'Laeuft...' : 'Abrechnungslauf starten'}
              </button>
            </div>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
              Format der Periode: <code>YYYY-MM</code>. Der Lauf erzeugt pro abrechenbarer Buchung maximal eine Rechnungszeile und eine Settlement-Zeile fuer die Periode.
            </p>
            {runError ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{runError}</p> : null}
          </div>
        ) : null}
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
            lastRunResult={lastRunResult}
          />
        ) : null}
      </section>
    </div>
  );
}
