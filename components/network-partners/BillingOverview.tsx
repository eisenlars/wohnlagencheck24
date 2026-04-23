'use client';

import type {
  NetworkBillingMonthSummary,
  NetworkBillingProjectionRow,
  NetworkBillingRunResult,
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
  lastRunResult?: NetworkBillingRunResult | null;
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
  lastRunResult,
}: BillingOverviewProps) {
  return (
    <div className="d-grid gap-4">
      {lastRunResult ? (
        <section className="d-grid gap-3">
          <h3 className="m-0 fs-5 text-dark">Letzter Abrechnungslauf</h3>
          <div className="d-grid gap-3 p-3 rounded-4 border bg-light">
            <p className="m-0 text-dark lh-base">
              Periode {lastRunResult.period_key} ({lastRunResult.period_start} bis {lastRunResult.period_end})
            </p>
            <div className="d-flex gap-3 flex-wrap text-secondary fw-semibold">
              <span>Geprueft: {lastRunResult.checked_booking_count}</span>
              <span>Erstellt: {lastRunResult.created_invoice_count}</span>
              <span>Dublette: {lastRunResult.skipped_duplicate_count}</span>
              <span>Nicht abrechenbar: {lastRunResult.skipped_not_billable_count}</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="d-grid gap-3">
        <h3 className="m-0 fs-5 text-dark">Monatsübersicht</h3>
        {!invoiceTableAvailable ? (
          <p className="m-0 text-secondary">
            Die Tabelle `network_partner_invoice_lines` ist noch nicht verfügbar. Bis dahin zeigt der Monitor nur die aktuelle Buchungsbasis.
          </p>
        ) : monthSummaries.length === 0 ? (
          <p className="m-0 text-secondary">Noch keine Rechnungszeilen vorhanden.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Rechnungen</th>
                  <th>Brutto</th>
                  <th>Portalbeitrag</th>
                  <th>Verbleibender Betrag</th>
                </tr>
              </thead>
              <tbody>
                {monthSummaries.map((row) => (
                  <tr key={row.period_key}>
                    <td>{row.period_key}</td>
                    <td>{row.invoice_count}</td>
                    <td>{formatCurrency(row.gross_amount_eur)}</td>
                    <td>{formatCurrency(row.portal_fee_eur)}</td>
                    <td>{formatCurrency(row.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="d-grid gap-3">
        <h3 className="m-0 fs-5 text-dark">Rechnungszeilen</h3>
        {!invoiceTableAvailable ? (
          <p className="m-0 text-secondary">Rechnungszeilen werden erst sichtbar, sobald die Billing-Tabelle im Betrieb befüllt wird.</p>
        ) : invoiceLines.length === 0 ? (
          <p className="m-0 text-secondary">Noch keine Rechnungszeilen vorhanden.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Netzwerkpartner</th>
                  <th>Gebiet</th>
                  <th>Placement</th>
                  <th>Periode</th>
                  <th>Status</th>
                  <th>Brutto</th>
                  <th>Portalbeitrag</th>
                  <th>Verbleibender Betrag</th>
                </tr>
              </thead>
              <tbody>
                {invoiceLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.network_partner_name ?? line.network_partner_id}</td>
                    <td>{line.area_id ?? '—'}</td>
                    <td>{line.placement_code ?? '—'}</td>
                    <td>{line.period_start} bis {line.period_end}</td>
                    <td>{line.status}</td>
                    <td>{formatCurrency(line.gross_amount_eur)}</td>
                    <td>{formatCurrency(line.portal_fee_eur)}</td>
                    <td>{formatCurrency(line.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="d-grid gap-3">
        <h3 className="m-0 fs-5 text-dark">Settlement</h3>
        {!settlementTableAvailable ? (
          <p className="m-0 text-secondary">Die Tabelle `portal_partner_settlement_lines` ist noch nicht verfügbar.</p>
        ) : settlementLines.length === 0 ? (
          <p className="m-0 text-secondary">Noch keine Settlement-Zeilen vorhanden.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Erstellt</th>
                  <th>Status</th>
                  <th>Brutto</th>
                  <th>Portalbeitrag</th>
                  <th>Verbleibender Betrag</th>
                </tr>
              </thead>
              <tbody>
                {settlementLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.created_at}</td>
                    <td>{line.status}</td>
                    <td>{formatCurrency(line.gross_amount_eur)}</td>
                    <td>{formatCurrency(line.portal_fee_eur)}</td>
                    <td>{formatCurrency(line.partner_net_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="d-grid gap-3">
        <h3 className="m-0 fs-5 text-dark">Buchungsbasis</h3>
        <p className="m-0 text-secondary">
          Diese Sicht leitet die erwartbaren Monatswerte aus den aktiven und pausierten Buchungen ab. Sie ersetzt keine echten Rechnungszeilen, hilft aber beim operativen Abgleich.
        </p>
        {bookingProjection.length === 0 ? (
          <p className="m-0 text-secondary">Noch keine aktiven oder pausierten Buchungen vorhanden.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>Netzwerkpartner</th>
                  <th>Gebiet</th>
                  <th>Placement</th>
                  <th>Status</th>
                  <th>Abrechnungstag</th>
                  <th>Monatspreis</th>
                  <th>Portalbeitrag</th>
                  <th>Verbleibender Betrag</th>
                </tr>
              </thead>
              <tbody>
                {bookingProjection.map((row) => (
                  <tr key={row.booking_id}>
                    <td>{row.network_partner_name ?? row.network_partner_id}</td>
                    <td>{row.area_id}</td>
                    <td>{row.placement_code}</td>
                    <td>{row.booking_status}</td>
                    <td>{row.billing_cycle_day}</td>
                    <td>{formatCurrency(row.monthly_price_eur)}</td>
                    <td>{formatCurrency(row.portal_fee_eur)}</td>
                    <td>{formatCurrency(row.partner_net_eur)}</td>
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
