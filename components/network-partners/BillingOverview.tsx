'use client';

import type {
  NetworkBillingMonthSummary,
  NetworkBillingProjectionRow,
  NetworkPartnerInvoiceLineRecord,
  PortalPartnerSettlementLineRecord,
} from '@/lib/network-partners/types';

type BillingOverviewProps = {
  invoiceLines: NetworkPartnerInvoiceLineRecord[];
  settlementLines: PortalPartnerSettlementLineRecord[];
  monthSummaries: NetworkBillingMonthSummary[];
  bookingProjection: NetworkBillingProjectionRow[];
  invoiceTableAvailable: boolean;
  settlementTableAvailable: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function BillingOverview({
  invoiceLines,
  settlementLines,
  monthSummaries,
  bookingProjection,
  invoiceTableAvailable,
  settlementTableAvailable,
}: BillingOverviewProps) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Monatsübersicht</h3>
        {!invoiceTableAvailable ? (
          <p style={{ margin: 0, color: '#64748b' }}>
            Die Tabelle `network_partner_invoice_lines` ist noch nicht verfügbar. Bis dahin zeigt der Monitor nur die aktuelle Buchungsbasis.
          </p>
        ) : monthSummaries.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>Noch keine Rechnungszeilen vorhanden.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px' }}>Periode</th>
                  <th style={{ padding: '10px 12px' }}>Rechnungen</th>
                  <th style={{ padding: '10px 12px' }}>Brutto</th>
                  <th style={{ padding: '10px 12px' }}>Portalfee</th>
                  <th style={{ padding: '10px 12px' }}>Netto Portal-Partner</th>
                </tr>
              </thead>
              <tbody>
                {monthSummaries.map((row) => (
                  <tr key={row.period_key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{row.period_key}</td>
                    <td style={{ padding: '12px' }}>{row.invoice_count}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(row.gross_amount_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(row.portal_fee_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(row.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Rechnungszeilen</h3>
        {!invoiceTableAvailable ? (
          <p style={{ margin: 0, color: '#64748b' }}>Rechnungszeilen werden erst sichtbar, sobald die Billing-Tabelle im Betrieb befüllt wird.</p>
        ) : invoiceLines.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>Noch keine Rechnungszeilen vorhanden.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px' }}>Netzwerkpartner</th>
                  <th style={{ padding: '10px 12px' }}>Gebiet</th>
                  <th style={{ padding: '10px 12px' }}>Placement</th>
                  <th style={{ padding: '10px 12px' }}>Periode</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Brutto</th>
                  <th style={{ padding: '10px 12px' }}>Portalfee</th>
                  <th style={{ padding: '10px 12px' }}>Netto</th>
                </tr>
              </thead>
              <tbody>
                {invoiceLines.map((line) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{line.network_partner_name ?? line.network_partner_id}</td>
                    <td style={{ padding: '12px' }}>{line.area_id ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{line.placement_code ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{line.period_start} bis {line.period_end}</td>
                    <td style={{ padding: '12px' }}>{line.status}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(line.gross_amount_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(line.portal_fee_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(line.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Settlement</h3>
        {!settlementTableAvailable ? (
          <p style={{ margin: 0, color: '#64748b' }}>Die Tabelle `portal_partner_settlement_lines` ist noch nicht verfügbar.</p>
        ) : settlementLines.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>Noch keine Settlement-Zeilen vorhanden.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px' }}>Erstellt</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Brutto</th>
                  <th style={{ padding: '10px 12px' }}>Portalfee</th>
                  <th style={{ padding: '10px 12px' }}>Netto</th>
                </tr>
              </thead>
              <tbody>
                {settlementLines.map((line) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{line.created_at}</td>
                    <td style={{ padding: '12px' }}>{line.status}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(line.gross_amount_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(line.portal_fee_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(line.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Buchungsbasis</h3>
        <p style={{ margin: 0, color: '#475569' }}>
          Diese Sicht leitet die erwartbaren Monatswerte aus den aktiven und pausierten Buchungen ab. Sie ersetzt keine echten Rechnungszeilen, hilft aber beim operativen Abgleich.
        </p>
        {bookingProjection.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>Noch keine aktiven oder pausierten Buchungen vorhanden.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px' }}>Netzwerkpartner</th>
                  <th style={{ padding: '10px 12px' }}>Gebiet</th>
                  <th style={{ padding: '10px 12px' }}>Placement</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Abrechnungstag</th>
                  <th style={{ padding: '10px 12px' }}>Monatspreis</th>
                  <th style={{ padding: '10px 12px' }}>Portalfee</th>
                  <th style={{ padding: '10px 12px' }}>Netto</th>
                </tr>
              </thead>
              <tbody>
                {bookingProjection.map((row) => (
                  <tr key={row.booking_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{row.network_partner_name ?? row.network_partner_id}</td>
                    <td style={{ padding: '12px' }}>{row.area_id}</td>
                    <td style={{ padding: '12px' }}>{row.placement_code}</td>
                    <td style={{ padding: '12px' }}>{row.booking_status}</td>
                    <td style={{ padding: '12px' }}>{row.billing_cycle_day}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(row.monthly_price_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(row.portal_fee_eur)}</td>
                    <td style={{ padding: '12px' }}>{formatCurrency(row.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
