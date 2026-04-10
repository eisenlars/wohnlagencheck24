'use client';

import type { NetworkPartnerBookingRecord } from '@/lib/network-partners/types';

type BookingListProps = {
  bookings: NetworkPartnerBookingRecord[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

function resolvePlacementLabel(code: NetworkPartnerBookingRecord['placement_code']): string {
  if (code === 'property_offer') return 'Immobilienangebote';
  if (code === 'property_request') return 'Immobiliengesuche';
  return 'Unternehmensprofil';
}

function resolveStatusLabel(status: NetworkPartnerBookingRecord['status']): string {
  if (status === 'pending_review') return 'In Prüfung';
  if (status === 'active') return 'Aktiv';
  if (status === 'paused') return 'Pausiert';
  if (status === 'cancelled') return 'Beendet';
  if (status === 'expired') return 'Abgelaufen';
  return 'Entwurf';
}

function resolveAiModeLabel(mode: NetworkPartnerBookingRecord['ai_billing_mode']): string {
  if (mode === 'credit_based') return 'Nutzungsabhängig';
  if (mode === 'blocked') return 'Deaktiviert';
  return 'Inklusive';
}

export default function BookingList({ bookings }: BookingListProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Gebiet</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Leistung</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Status</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Laufzeit</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Monatspreis</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Portalfee</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>Sprachen</th>
            <th style={{ padding: '10px 12px', color: '#334155' }}>KI-Modus</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px', color: '#0f172a' }}>{booking.area_id}</td>
              <td style={{ padding: '12px', color: '#0f172a' }}>{resolvePlacementLabel(booking.placement_code)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{resolveStatusLabel(booking.status)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{booking.starts_at}{booking.ends_at ? ` bis ${booking.ends_at}` : ''}</td>
              <td style={{ padding: '12px', color: '#0f172a' }}>{formatCurrency(booking.monthly_price_eur)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{formatCurrency(booking.portal_fee_eur)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{booking.required_locales.join(', ')}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{resolveAiModeLabel(booking.ai_billing_mode)}</td>
            </tr>
          ))}
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine Buchungen vorhanden.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
