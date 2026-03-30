'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import ContentForm from '@/components/network-partners/ContentForm';
import ContentReviewPanel from '@/components/network-partners/ContentReviewPanel';
import ContentTable from '@/components/network-partners/ContentTable';
import ContentTranslationsPanel from '@/components/network-partners/ContentTranslationsPanel';
import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
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

type ContentPayload = {
  content_items?: NetworkContentRecord[];
  error?: string;
};

type BookingsPayload = {
  bookings?: NetworkPartnerBookingRecord[];
  error?: string;
};

type NetworkPartnerListPayload = {
  network_partners?: NetworkPartnerRecord[];
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

type NetworkContentWorkspaceProps = {
  networkPartnerId?: string;
  networkPartnerName?: string | null;
};

export default function NetworkContentWorkspace({
  networkPartnerId,
  networkPartnerName,
}: NetworkContentWorkspaceProps) {
  const [contentItems, setContentItems] = useState<NetworkContentRecord[]>([]);
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [networkPartners, setNetworkPartners] = useState<NetworkPartnerRecord[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    const contentUrl = networkPartnerId
      ? `/api/partner/network-content?network_partner_id=${encodeURIComponent(networkPartnerId)}`
      : '/api/partner/network-content';
    const [contentResponse, bookingsResponse, partnersResponse, bootstrapResponse] = await Promise.all([
      fetch(contentUrl, { method: 'GET', cache: 'no-store' }),
      fetch(
        networkPartnerId
          ? `/api/partner/network-bookings?network_partner_id=${encodeURIComponent(networkPartnerId)}`
          : '/api/partner/network-bookings',
        { method: 'GET', cache: 'no-store' },
      ),
      fetch('/api/partner/network-partners', { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/dashboard/bootstrap', { method: 'GET', cache: 'no-store' }),
    ]);

    const contentPayload = (await contentResponse.json().catch(() => null)) as ContentPayload | null;
    const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingsPayload | null;
    const partnersPayload = (await partnersResponse.json().catch(() => null)) as NetworkPartnerListPayload | null;
    const bootstrapPayload = (await bootstrapResponse.json().catch(() => null)) as BootstrapPayload | null;
    return {
      contentResponse,
      bookingsResponse,
      partnersResponse,
      contentPayload,
      bookingsPayload,
      partnersPayload,
      bootstrapPayload,
    };
  }, [networkPartnerId]);

  async function applyPageData(preferredContentId?: string | null) {
    setLoading(true);
    setError(null);
    const {
      contentResponse,
      bookingsResponse,
      partnersResponse,
      contentPayload,
      bookingsPayload,
      partnersPayload,
      bootstrapPayload,
    } = await fetchPageData();
    if (!contentResponse.ok || !bookingsResponse.ok || !partnersResponse.ok) {
      setContentItems([]);
      setBookings([]);
      setNetworkPartners([]);
      setAreas([]);
      setError(
        String(
          contentPayload?.error
          ?? bookingsPayload?.error
          ?? partnersPayload?.error
          ?? 'Netzwerkpartner-Content konnte nicht geladen werden.',
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

    const nextContent = Array.isArray(contentPayload?.content_items) ? contentPayload.content_items : [];
    setContentItems(nextContent);
    setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
    setNetworkPartners(Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : []);
    setAreas(nextAreas);
    setSelectedContentId((current) => {
      const preferredId = preferredContentId ?? current;
      if (preferredId && nextContent.some((item) => item.id === preferredId)) return preferredId;
      return nextContent[0]?.id ?? null;
    });
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const {
        contentResponse,
        bookingsResponse,
        partnersResponse,
        contentPayload,
        bookingsPayload,
        partnersPayload,
        bootstrapPayload,
      } = await fetchPageData();
      if (!active) return;
      if (!contentResponse.ok || !bookingsResponse.ok || !partnersResponse.ok) {
        setContentItems([]);
        setBookings([]);
        setNetworkPartners([]);
        setAreas([]);
        setError(
          String(
            contentPayload?.error
            ?? bookingsPayload?.error
            ?? partnersPayload?.error
            ?? 'Netzwerkpartner-Content konnte nicht geladen werden.',
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

      const nextContent = Array.isArray(contentPayload?.content_items) ? contentPayload.content_items : [];
      setContentItems(nextContent);
      setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
      setNetworkPartners(Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : []);
      setAreas(nextAreas);
      setSelectedContentId((current) => {
        if (current && nextContent.some((item) => item.id === current)) return current;
        return nextContent[0]?.id ?? null;
      });
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [fetchPageData]);

  const selectedContent = useMemo(
    () => contentItems.find((item) => item.id === selectedContentId) ?? null,
    [contentItems, selectedContentId],
  );

  return (
    <div style={{ width: '100%', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Plattform
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>
            {networkPartnerId ? `${networkPartnerName ?? 'Netzwerkpartner'}: Content & Review` : 'Content & Review'}
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 780, lineHeight: 1.6 }}>
            Netzwerkpartner-Content wird hier an bestehende Buchungen gehängt, fachlich gepflegt und durch den Portal-Partner geprüft.
          </p>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
            {selectedContent ? 'Ausgewählten Content bearbeiten' : 'Neuen Content anlegen'}
          </h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Die Buchung bestimmt Netzwerkpartner, Gebiet und Content-Typ. Damit bleibt der Placement-Scope konsistent.
          </p>
        </div>
        {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        <ContentForm
          bookings={bookings}
          networkPartners={networkPartners}
          initialValue={selectedContent}
          submitLabel={selectedContent ? 'Content speichern' : 'Content anlegen'}
          onSubmit={async (values) => {
            setError(null);
            setMessage(null);
            const endpoint = selectedContent
              ? `/api/partner/network-content/${encodeURIComponent(selectedContent.id)}`
              : '/api/partner/network-content';
            const method = selectedContent ? 'PATCH' : 'POST';
            const response = await fetch(endpoint, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string; content_item?: NetworkContentRecord } | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Content konnte nicht gespeichert werden.'));
              return;
            }
            setMessage(selectedContent ? 'Content wurde aktualisiert.' : 'Content wurde angelegt.');
            const nextId = payload?.content_item?.id ?? selectedContent?.id ?? null;
            await applyPageData(nextId);
            if (nextId) setSelectedContentId(nextId);
          }}
        />
        {selectedContent ? (
          <button
            type="button"
            onClick={() => {
              setSelectedContentId(null);
              setMessage(null);
              setError(null);
            }}
            style={{
              width: 'fit-content',
              border: 'none',
              background: 'transparent',
              padding: 0,
              color: '#0f766e',
              fontWeight: 700,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              cursor: 'pointer',
            }}
          >
            Neuen Content statt Bearbeitung anlegen
          </button>
        ) : null}
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Review-Workflow</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Der Portal-Partner steuert hier den MVP-Statuspfad von Draft über Review bis Freigabe und Live-Schaltung.
          </p>
        </div>
        <ContentReviewPanel
          contentItem={selectedContent}
          onAction={async (action, reviewNote) => {
            if (!selectedContent) return;
            setError(null);
            setMessage(null);
            const response = await fetch(`/api/partner/network-content/${encodeURIComponent(selectedContent.id)}/review`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, review_note: reviewNote }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Review-Aktion konnte nicht ausgeführt werden.'));
              return;
            }
            setMessage(`Review-Aktion ${action} wurde ausgeführt.`);
            await applyPageData(selectedContent.id);
          }}
        />
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Sprachen & Übersetzungen</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Pflichtsprachen kommen direkt aus der Buchung. Strukturierte Typen können für diese Zielsprachen automatisch vorbefüllt werden, manuelle Nachbearbeitung bleibt jederzeit möglich.
          </p>
        </div>
        <ContentTranslationsPanel contentItem={selectedContent} />
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Bestehender Content</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Die Tabelle dient als Arbeitsliste für Erfassung, Review und spätere Mehrsprachigkeit.
          </p>
        </div>
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : (
          <ContentTable
            contentItems={contentItems}
            bookings={bookings}
            networkPartners={networkPartners}
            areas={areas}
            selectedContentId={selectedContentId}
            onSelect={setSelectedContentId}
          />
        )}
      </section>
    </div>
  );
}
