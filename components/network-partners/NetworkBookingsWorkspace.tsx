'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BookingForm from '@/components/network-partners/BookingForm';
import BookingTable from '@/components/network-partners/BookingTable';
import type {
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
  PlacementCatalogRecord,
} from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type AreaOption = {
  id: string;
  label: string;
};

type BookingsPayload = {
  bookings?: NetworkPartnerBookingRecord[];
  placement_catalog?: PlacementCatalogRecord[];
  error?: string;
};

type NetworkPartnerListPayload = {
  network_partners?: NetworkPartnerRecord[];
  error?: string;
};

type NetworkBookingsWorkspaceProps = {
  networkPartnerId?: string;
  networkPartnerName?: string | null;
  areas?: AreaOption[];
};

export default function NetworkBookingsWorkspace({
  networkPartnerId,
  networkPartnerName,
  areas: providedAreas = [],
}: NetworkBookingsWorkspaceProps) {
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [networkPartners, setNetworkPartners] = useState<NetworkPartnerRecord[]>([]);
  const [placements, setPlacements] = useState<PlacementCatalogRecord[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    const bookingsUrl = networkPartnerId
      ? `/api/partner/network-bookings?network_partner_id=${encodeURIComponent(networkPartnerId)}`
      : '/api/partner/network-bookings';
    const [bookingsResponse, partnersResponse] = await Promise.all([
      fetch(bookingsUrl, { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/network-partners', { method: 'GET', cache: 'no-store' }),
    ]);

    const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingsPayload | null;
    const partnersPayload = (await partnersResponse.json().catch(() => null)) as NetworkPartnerListPayload | null;
    return {
      bookingsResponse,
      partnersResponse,
      bookingsPayload,
      partnersPayload,
    };
  }, [networkPartnerId]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const {
        bookingsResponse,
        partnersResponse,
        bookingsPayload,
        partnersPayload,
      } = await fetchPageData();
      if (!active) return;
      if (!bookingsResponse.ok || !partnersResponse.ok) {
        setBookings([]);
        setNetworkPartners([]);
        setPlacements([]);
        setError(
          String(
            bookingsPayload?.error
            ?? partnersPayload?.error
            ?? 'Buchungsdaten konnten nicht geladen werden.',
          ),
        );
        setLoading(false);
        return;
      }

      const nextBookings = Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : [];
      setBookings(nextBookings);
      setNetworkPartners(Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : []);
      setPlacements(Array.isArray(bookingsPayload?.placement_catalog) ? bookingsPayload.placement_catalog : []);
      setCreateMode(nextBookings.length === 0);
      setSelectedBookingId((current) => {
        if (current && nextBookings.some((booking) => booking.id === current)) return current;
        return nextBookings[0]?.id ?? null;
      });
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [fetchPageData]);

  const selectableNetworkPartners = useMemo(() => {
    if (!networkPartnerId) return networkPartners;
    const filtered = networkPartners.filter((partner) => partner.id === networkPartnerId);
    return filtered.length > 0 ? filtered : networkPartners;
  }, [networkPartnerId, networkPartners]);

  const bookingAreas = useMemo(() => {
    const districtMap = new Map<string, string>();
    for (const area of providedAreas) {
      const areaId = String(area.id ?? '').trim();
      const label = String(area.label ?? '').trim();
      const districtId = areaId.split('-').slice(0, 3).join('-');
      if (districtId && !districtMap.has(districtId)) {
        districtMap.set(districtId, label);
      }
    }

    return providedAreas.map((area) => {
      const areaId = String(area.id ?? '').trim();
      const label = String(area.label ?? '').trim();
      const parts = areaId.split('-');
      if (parts.length <= 3) {
        return { id: areaId, label };
      }
      const districtId = parts.slice(0, 3).join('-');
      const districtLabel = districtMap.get(districtId) ?? districtId;
      return {
        id: areaId,
        label: `${districtLabel} -> ${label}`,
      };
    });
  }, [providedAreas]);

  const activeBookingCount = useMemo(
    () => bookings.filter((booking) => booking.status === 'active').length,
    [bookings],
  );

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  async function refreshBookings(preferredBookingId?: string | null) {
    setLoading(true);
    const {
      bookingsResponse,
      partnersResponse,
      bookingsPayload,
      partnersPayload,
    } = await fetchPageData();
    if (!bookingsResponse.ok || !partnersResponse.ok) {
      setBookings([]);
      setNetworkPartners([]);
      setPlacements([]);
      setError(
        String(
          bookingsPayload?.error
          ?? partnersPayload?.error
          ?? 'Buchungsdaten konnten nicht geladen werden.',
        ),
      );
      setLoading(false);
      return;
    }

    const nextBookings = Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : [];
    setBookings(nextBookings);
    setNetworkPartners(Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : []);
    setPlacements(Array.isArray(bookingsPayload?.placement_catalog) ? bookingsPayload.placement_catalog : []);
    setCreateMode(nextBookings.length === 0);
    setSelectedBookingId(() => {
      const preferred = String(preferredBookingId ?? '').trim();
      if (preferred && nextBookings.some((booking) => booking.id === preferred)) return preferred;
      return nextBookings[0]?.id ?? null;
    });
    setLoading(false);
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Plattform
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>
            {networkPartnerId ? `${networkPartnerName ?? 'Netzwerkpartner'}: Buchungen` : 'Buchungen'}
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 760, lineHeight: 1.6 }}>
            Hier werden Leistungen pro Kreis direkt für Netzwerkpartner gebucht. Soll ein Netzwerkpartner in mehreren Kreisen erscheinen, wird für jeden Kreis eine eigene Buchung angelegt.
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <span>Aktive Buchungen: {activeBookingCount}</span>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Buchungen verwalten</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Links liegt die Arbeitsliste der bestehenden Buchungen. Rechts wird die ausgewählte Buchung bearbeitet oder über den Button eine neue Buchung angelegt.
          </p>
        </div>
        {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={() => {
              setCreateMode(true);
              setSelectedBookingId(null);
              setMessage(null);
              setError(null);
            }}
            style={{
              borderRadius: 999,
              border: '1px solid #0f766e',
              background: '#0f766e',
              color: '#fff',
              padding: '11px 16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Neue Buchung anlegen
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: '320px minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          <section style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Bestehende Buchungen</h3>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Die Liste zeigt den operativen Stand je Leistung und Gebiet.
              </p>
            </div>
            {loading ? (
              <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
            ) : (
              <BookingTable
                bookings={bookings}
                networkPartners={networkPartners}
                areas={providedAreas}
                placements={placements}
                selectedBookingId={selectedBookingId}
                onSelect={(bookingId) => {
                  setCreateMode(false);
                  setSelectedBookingId(bookingId);
                  setMessage(null);
                  setError(null);
                }}
              />
            )}
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <BookingForm
              networkPartners={selectableNetworkPartners}
              areas={bookingAreas}
              placements={placements}
              initialValue={createMode ? null : selectedBooking}
              submitLabel={createMode ? 'Buchung anlegen' : 'Buchung speichern'}
              onCancel={createMode ? undefined : () => {
                setCreateMode(true);
                setSelectedBookingId(null);
                setMessage(null);
                setError(null);
              }}
              onSubmit={async (values) => {
                setError(null);
                setMessage(null);
                if (createMode || !selectedBooking) {
                  const response = await fetch('/api/partner/network-bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...values,
                    }),
                  });
                  const payload = (await response.json().catch(() => null)) as { error?: string; booking?: NetworkPartnerBookingRecord } | null;
                  if (!response.ok) {
                    setError(String(payload?.error ?? 'Buchung konnte nicht angelegt werden.'));
                    return;
                  }
                  setMessage('Buchung wurde angelegt.');
                  setCreateMode(false);
                  await refreshBookings(payload?.booking?.id ?? null);
                  return;
                }

                const response = await fetch(`/api/partner/network-bookings/${encodeURIComponent(selectedBooking.id)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: values.status,
                    monthly_price_eur: values.monthly_price_eur,
                    notes: values.notes,
                  }),
                });
                const payload = (await response.json().catch(() => null)) as { error?: string; booking?: NetworkPartnerBookingRecord } | null;
                if (!response.ok) {
                  setError(String(payload?.error ?? 'Buchung konnte nicht gespeichert werden.'));
                  return;
                }
                setMessage('Buchung wurde aktualisiert.');
                await refreshBookings(payload?.booking?.id ?? selectedBooking.id);
              }}
            />
          </section>
        </div>
      </section>
    </div>
  );
}
