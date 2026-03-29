'use client';

import type {
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
  PlacementCatalogRecord,
} from '@/lib/network-partners/types';

type AreaOption = {
  id: string;
  label: string;
};

type BookingTableProps = {
  bookings: NetworkPartnerBookingRecord[];
  networkPartners: NetworkPartnerRecord[];
  areas: AreaOption[];
  placements: PlacementCatalogRecord[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

function resolveNetworkPartnerLabel(networkPartners: NetworkPartnerRecord[], id: string): string {
  return networkPartners.find((entry) => entry.id === id)?.company_name ?? id;
}

function resolveAreaLabel(areas: AreaOption[], id: string): string {
  return areas.find((entry) => entry.id === id)?.label ?? id;
}

function resolvePlacementLabel(placements: PlacementCatalogRecord[], code: string): string {
  return placements.find((entry) => entry.code === code)?.label ?? code;
}

export default function BookingTable({
  bookings,
  networkPartners,
  areas,
  placements,
}: BookingTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Netzwerkpartner</th>
            <th style={{ padding: '10px 12px' }}>Gebiet</th>
            <th style={{ padding: '10px 12px' }}>Placement</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
            <th style={{ padding: '10px 12px' }}>Monatspreis</th>
            <th style={{ padding: '10px 12px' }}>Portalfee</th>
            <th style={{ padding: '10px 12px' }}>Sprachen</th>
            <th style={{ padding: '10px 12px' }}>KI-Modus</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px', color: '#0f172a' }}>{resolveNetworkPartnerLabel(networkPartners, booking.network_partner_id)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{resolveAreaLabel(areas, booking.area_id)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{resolvePlacementLabel(placements, booking.placement_code)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{booking.status}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{formatCurrency(booking.monthly_price_eur)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{formatCurrency(booking.portal_fee_eur)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{booking.required_locales.join(', ')}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{booking.ai_billing_mode}</td>
            </tr>
          ))}
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine Buchungen angelegt.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
