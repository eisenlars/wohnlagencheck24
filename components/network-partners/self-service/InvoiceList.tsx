'use client';

import type {
  NetworkBillingProjectionRow,
  NetworkPartnerInvoiceLineRecord,
} from '@/lib/network-partners/types';

type InvoiceListProps = {
  invoiceLines: NetworkPartnerInvoiceLineRecord[];
  bookingProjection: NetworkBillingProjectionRow[];
  invoiceTableAvailable: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function InvoiceList({
  invoiceLines,
  bookingProjection,
  invoiceTableAvailable,
}: InvoiceListProps) {
  if (!invoiceTableAvailable) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, color: '#64748b' }}>
          Die Rechnungszeilen werden noch nicht operativ geschrieben. Bis dahin dient die Buchungsbasis als kaufmännische Orientierung.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px' }}>Gebiet</th>
                <th style={{ padding: '10px 12px' }}>Placement</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Monatspreis</th>
                <th style={{ padding: '10px 12px' }}>Portalfee</th>
                <th style={{ padding: '10px 12px' }}>Netto</th>
              </tr>
            </thead>
            <tbody>
              {bookingProjection.map((row) => (
                <tr key={row.booking_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px' }}>{row.area_id}</td>
                  <td style={{ padding: '12px' }}>{row.placement_code}</td>
                  <td style={{ padding: '12px' }}>{row.booking_status}</td>
                  <td style={{ padding: '12px' }}>{formatCurrency(row.monthly_price_eur)}</td>
                  <td style={{ padding: '12px' }}>{formatCurrency(row.portal_fee_eur)}</td>
                  <td style={{ padding: '12px' }}>{formatCurrency(row.partner_net_eur)}</td>
                </tr>
              ))}
              {bookingProjection.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '18px 12px', color: '#64748b' }}>
                    Noch keine buchungsbasierte Rechnungsansicht vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Periode</th>
            <th style={{ padding: '10px 12px' }}>Gebiet</th>
            <th style={{ padding: '10px 12px' }}>Placement</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
            <th style={{ padding: '10px 12px' }}>Brutto</th>
            <th style={{ padding: '10px 12px' }}>Portalfee</th>
            <th style={{ padding: '10px 12px' }}>Netto</th>
          </tr>
        </thead>
        <tbody>
          {invoiceLines.map((line) => (
            <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px' }}>{line.period_start} bis {line.period_end}</td>
              <td style={{ padding: '12px' }}>{line.area_id ?? '—'}</td>
              <td style={{ padding: '12px' }}>{line.placement_code ?? '—'}</td>
              <td style={{ padding: '12px' }}>{line.status}</td>
              <td style={{ padding: '12px' }}>{formatCurrency(line.gross_amount_eur)}</td>
              <td style={{ padding: '12px' }}>{formatCurrency(line.portal_fee_eur)}</td>
              <td style={{ padding: '12px' }}>{formatCurrency(line.partner_net_eur)}</td>
            </tr>
          ))}
          {invoiceLines.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine Rechnungszeilen vorhanden.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
