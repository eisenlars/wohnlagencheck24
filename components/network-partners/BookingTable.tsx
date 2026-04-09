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
  selectedBookingId?: string | null;
  onSelect?: (bookingId: string) => void;
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

function resolveStatusLabel(status: NetworkPartnerBookingRecord['status']): string {
  if (status === 'pending_review' || status === 'draft') return 'Entwurf';
  if (status === 'active') return 'Aktiv';
  if (status === 'paused') return 'Inaktiv';
  if (status === 'cancelled') return 'Beendet';
  if (status === 'expired') return 'Abgelaufen';
  return status;
}

export default function BookingTable({
  bookings,
  networkPartners,
  areas,
  placements,
  selectedBookingId = null,
  onSelect,
}: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <div style={{ padding: '18px 12px', color: '#64748b' }}>
        Noch keine Buchungen angelegt.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {bookings.map((booking) => {
        const selected = booking.id === selectedBookingId;
        return (
          <button
            key={booking.id}
            type="button"
            onClick={() => onSelect?.(booking.id)}
            style={{
              display: 'grid',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 16,
              border: selected ? '1px solid #0f766e' : '1px solid #e2e8f0',
              background: selected ? '#f0fdfa' : '#fff',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <strong style={{ color: '#0f172a', fontSize: 15 }}>
                {resolvePlacementLabel(placements, booking.placement_code)}
              </strong>
              <span
                style={{
                  borderRadius: 999,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: selected ? '#0f766e' : '#475569',
                  background: selected ? '#ccfbf1' : '#f1f5f9',
                }}
              >
                {resolveStatusLabel(booking.status)}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 4, color: '#475569', fontSize: 13 }}>
              <span>{resolveAreaLabel(areas, booking.area_id)}</span>
              <span>{resolveNetworkPartnerLabel(networkPartners, booking.network_partner_id)}</span>
              <span>Start: {booking.starts_at}</span>
            </div>
            <span style={{ color: '#64748b', fontSize: 12 }}>
              Aktueller Leistungspreis: {formatCurrency(booking.monthly_price_eur)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
