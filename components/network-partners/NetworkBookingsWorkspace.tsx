'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BookingForm from '@/components/network-partners/BookingForm';
import BookingTable from '@/components/network-partners/BookingTable';
import type {
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
  PartnerAreaInventoryRecord,
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
  error?: string;
};

type NetworkPartnerListPayload = {
  network_partners?: NetworkPartnerRecord[];
  error?: string;
};

type InventoryPayload = {
  inventory?: PartnerAreaInventoryRecord[];
  placement_catalog?: PlacementCatalogRecord[];
  error?: string;
};

type BootstrapPayload = {
  configs?: Array<{
    area_id?: string;
    areas?: { name?: string };
  }>;
};

function mapAreaLabel(areaId: string, areaName?: string): string {
  return areaName ? `${areaId} ${areaName}` : areaId;
}

type NetworkBookingsWorkspaceProps = {
  networkPartnerId?: string;
  networkPartnerName?: string | null;
};

export default function NetworkBookingsWorkspace({
  networkPartnerId,
  networkPartnerName,
}: NetworkBookingsWorkspaceProps) {
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [networkPartners, setNetworkPartners] = useState<NetworkPartnerRecord[]>([]);
  const [inventory, setInventory] = useState<PartnerAreaInventoryRecord[]>([]);
  const [placements, setPlacements] = useState<PlacementCatalogRecord[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    const bookingsUrl = networkPartnerId
      ? `/api/partner/network-bookings?network_partner_id=${encodeURIComponent(networkPartnerId)}`
      : '/api/partner/network-bookings';
    const [bookingsResponse, partnersResponse, inventoryResponse, bootstrapResponse] = await Promise.all([
      fetch(bookingsUrl, { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/network-partners', { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/network-inventory', { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/dashboard/bootstrap', { method: 'GET', cache: 'no-store' }),
    ]);

    const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingsPayload | null;
    const partnersPayload = (await partnersResponse.json().catch(() => null)) as NetworkPartnerListPayload | null;
    const inventoryPayload = (await inventoryResponse.json().catch(() => null)) as InventoryPayload | null;
    const bootstrapPayload = (await bootstrapResponse.json().catch(() => null)) as BootstrapPayload | null;
    return {
      bookingsResponse,
      partnersResponse,
      inventoryResponse,
      bookingsPayload,
      partnersPayload,
      inventoryPayload,
      bootstrapPayload,
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
        inventoryResponse,
        bookingsPayload,
        partnersPayload,
        inventoryPayload,
        bootstrapPayload,
      } = await fetchPageData();
      if (!active) return;
      if (!bookingsResponse.ok || !partnersResponse.ok || !inventoryResponse.ok) {
        setBookings([]);
        setNetworkPartners([]);
        setInventory([]);
        setPlacements([]);
        setAreas([]);
        setError(
          String(
            bookingsPayload?.error
            ?? partnersPayload?.error
            ?? inventoryPayload?.error
            ?? 'Buchungsdaten konnten nicht geladen werden.',
          ),
        );
        setLoading(false);
        return;
      }

      const nextAreas = Array.from(new Map(
        (Array.isArray(bootstrapPayload?.configs) ? bootstrapPayload.configs : [])
          .map((config) => {
            const areaId = String(config.area_id ?? '').trim();
            if (!areaId) return null;
            return [areaId, { id: areaId, label: mapAreaLabel(areaId, config.areas?.name) }];
          })
          .filter((entry): entry is [string, AreaOption] => Boolean(entry)),
      ).values());

      setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
      setNetworkPartners(Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : []);
      setInventory(Array.isArray(inventoryPayload?.inventory) ? inventoryPayload.inventory : []);
      setPlacements(Array.isArray(inventoryPayload?.placement_catalog) ? inventoryPayload.placement_catalog : []);
      setAreas(nextAreas);
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

  const activeBookingCount = useMemo(
    () => bookings.filter((booking) => booking.status === 'active').length,
    [bookings],
  );

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
            Buchungen verbinden Netzwerkpartner, Gebiete, Werbeformate, Preis und KI-Nutzungsrahmen zu einem verkaufbaren Vertragspunkt.
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <span>Aktive Buchungen: {activeBookingCount}</span>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Neue Buchung anlegen</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Das Formular nutzt nur aktive Werbeformate. Pflichtsprachen, Portalfee und KI-Modus werden bereits auf Buchungsebene festgeschrieben.
          </p>
        </div>
        {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        <BookingForm
          networkPartners={selectableNetworkPartners}
          areas={areas}
          placements={placements}
          inventory={inventory}
          onSubmit={async (values) => {
            setError(null);
            setMessage(null);
            const response = await fetch('/api/partner/network-bookings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Buchung konnte nicht angelegt werden.'));
              return;
            }
            setMessage('Buchung wurde angelegt.');
            setLoading(true);
            const {
              bookingsResponse,
              partnersResponse,
              inventoryResponse,
              bookingsPayload,
              partnersPayload,
              inventoryPayload,
              bootstrapPayload,
            } = await fetchPageData();
            if (!bookingsResponse.ok || !partnersResponse.ok || !inventoryResponse.ok) {
              setBookings([]);
              setNetworkPartners([]);
              setInventory([]);
              setPlacements([]);
              setAreas([]);
              setError(
                String(
                  bookingsPayload?.error
                  ?? partnersPayload?.error
                  ?? inventoryPayload?.error
                  ?? 'Buchungsdaten konnten nicht geladen werden.',
                ),
              );
              setLoading(false);
              return;
            }
            const nextAreas = Array.from(new Map(
              (Array.isArray(bootstrapPayload?.configs) ? bootstrapPayload.configs : [])
                .map((config) => {
                  const areaId = String(config.area_id ?? '').trim();
                  if (!areaId) return null;
                  return [areaId, { id: areaId, label: mapAreaLabel(areaId, config.areas?.name) }];
                })
                .filter((entry): entry is [string, AreaOption] => Boolean(entry)),
            ).values());
            setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
            setNetworkPartners(Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : []);
            setInventory(Array.isArray(inventoryPayload?.inventory) ? inventoryPayload.inventory : []);
            setPlacements(Array.isArray(inventoryPayload?.placement_catalog) ? inventoryPayload.placement_catalog : []);
            setAreas(nextAreas);
            setLoading(false);
          }}
        />
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Bestehende Buchungen</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Die Liste zeigt die aktuellen Vertragsparameter des MVP, noch ohne Rechnungs- und Settlement-Historie.
          </p>
        </div>
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : (
          <BookingTable bookings={bookings} networkPartners={networkPartners} areas={areas} placements={placements} />
        )}
      </section>
    </div>
  );
}
