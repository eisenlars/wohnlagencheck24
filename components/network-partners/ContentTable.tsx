'use client';

import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
} from '@/lib/network-partners/types';

type AreaOption = {
  id: string;
  label: string;
};

type ContentTableProps = {
  contentItems: NetworkContentRecord[];
  bookings: NetworkPartnerBookingRecord[];
  networkPartners: NetworkPartnerRecord[];
  areas: AreaOption[];
  selectedContentId: string | null;
  onSelect: (contentId: string) => void;
};

function resolveNetworkPartnerLabel(networkPartners: NetworkPartnerRecord[], networkPartnerId: string): string {
  return networkPartners.find((entry) => entry.id === networkPartnerId)?.company_name ?? networkPartnerId;
}

function resolveAreaLabel(areas: AreaOption[], areaId: string): string {
  return areas.find((entry) => entry.id === areaId)?.label ?? areaId;
}

function resolveBookingLabel(bookings: NetworkPartnerBookingRecord[], bookingId: string): string {
  const booking = bookings.find((entry) => entry.id === bookingId);
  if (!booking) return bookingId;
  return `${booking.placement_code} · ${booking.status}`;
}

export default function ContentTable({
  contentItems,
  bookings,
  networkPartners,
  areas,
  selectedContentId,
  onSelect,
}: ContentTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Titel</th>
            <th style={{ padding: '10px 12px' }}>Typ</th>
            <th style={{ padding: '10px 12px' }}>Netzwerkpartner</th>
            <th style={{ padding: '10px 12px' }}>Gebiet</th>
            <th style={{ padding: '10px 12px' }}>Buchung</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
            <th style={{ padding: '10px 12px' }}>Review</th>
            <th style={{ padding: '10px 12px' }}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {contentItems.map((item) => (
            <tr
              key={item.id}
              style={{
                borderBottom: '1px solid #f1f5f9',
                background: selectedContentId === item.id ? '#f8fafc' : '#fff',
              }}
            >
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ color: '#0f172a' }}>{item.title}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{item.slug}</span>
                </div>
              </td>
              <td style={{ padding: '12px', color: '#334155' }}>{item.content_type}</td>
              <td style={{ padding: '12px', color: '#334155' }}>
                {resolveNetworkPartnerLabel(networkPartners, item.network_partner_id)}
              </td>
              <td style={{ padding: '12px', color: '#334155' }}>{resolveAreaLabel(areas, item.area_id)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{resolveBookingLabel(bookings, item.booking_id)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{item.status}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{item.latest_review?.review_status ?? 'keine'}</td>
              <td style={{ padding: '12px' }}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0f766e',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Bearbeiten
                </button>
              </td>
            </tr>
          ))}
          {contentItems.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch kein Netzwerkpartner-Content angelegt.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
