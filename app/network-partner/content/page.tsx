'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import ContentList from '@/components/network-partners/self-service/ContentList';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
} from '@/lib/network-partners/types';

type ContentPayload = {
  content_items?: NetworkContentRecord[];
  error?: string;
};

type BookingsPayload = {
  bookings?: NetworkPartnerBookingRecord[];
  error?: string;
};

type ContentTabKey = 'offers' | 'requests';

export default function NetworkPartnerContentPage() {
  const [contentItems, setContentItems] = useState<NetworkContentRecord[]>([]);
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTabKey>('offers');

  async function refresh() {
    const [contentResponse, bookingsResponse] = await Promise.all([
      fetch('/api/network-partner/content', { method: 'GET', cache: 'no-store' }),
      fetch('/api/network-partner/bookings', { method: 'GET', cache: 'no-store' }),
    ]);
    if (redirectIfUnauthorizedResponse(contentResponse, 'network_partner')) return null;
    if (redirectIfUnauthorizedResponse(bookingsResponse, 'network_partner')) return null;
    const contentPayload = (await contentResponse.json().catch(() => null)) as ContentPayload | null;
    const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingsPayload | null;
    return { contentResponse, bookingsResponse, contentPayload, bookingsPayload };
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await refresh();
      if (!result) return;
      const { contentResponse, bookingsResponse, contentPayload, bookingsPayload } = result;
      if (!active) return;
      if (!contentResponse.ok || !bookingsResponse.ok) {
        setContentItems([]);
        setBookings([]);
        setError(String(contentPayload?.error ?? bookingsPayload?.error ?? 'Content konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setContentItems(Array.isArray(contentPayload?.content_items) ? contentPayload.content_items : []);
      setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const hasOfferScope = useMemo(
    () => bookings.some((booking) => booking.placement_code === 'property_offer') || contentItems.some((item) => item.content_type === 'property_offer'),
    [bookings, contentItems],
  );

  const hasRequestScope = useMemo(
    () => bookings.some((booking) => booking.placement_code === 'property_request') || contentItems.some((item) => item.content_type === 'property_request'),
    [bookings, contentItems],
  );

  const availableTabs = useMemo(() => {
    const tabs: Array<{ key: ContentTabKey; label: string; count: number }> = [];
    if (hasOfferScope) {
      tabs.push({
        key: 'offers',
        label: 'Angebote',
        count: contentItems.filter((item) => item.content_type === 'property_offer').length,
      });
    }
    if (hasRequestScope) {
      tabs.push({
        key: 'requests',
        label: 'Gesuche',
        count: contentItems.filter((item) => item.content_type === 'property_request').length,
      });
    }
    return tabs;
  }, [contentItems, hasOfferScope, hasRequestScope]);

  const resolvedActiveTab = availableTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : (availableTabs[0]?.key ?? 'offers');

  const filteredContentItems = useMemo(
    () => contentItems.filter((item) => (
      resolvedActiveTab === 'offers'
        ? item.content_type === 'property_offer'
        : item.content_type === 'property_request'
    )),
    [contentItems, resolvedActiveTab],
  );

  const activeTabMeta = resolvedActiveTab === 'offers'
    ? {
        heading: 'Angebote individualisieren',
        description: 'Hier bearbeitest du die vom CRM importierten Immobilienangebote, ergänzt eigene Texte und pflegst die Pflichtsprachen des Portalpartners.',
        emptyHint: hasOfferScope
          ? 'Für gebuchte Angebote wurden noch keine importierten Datensätze gefunden.'
          : 'Für diesen Netzwerkpartner sind aktuell keine Angebots-Buchungen aktiv.',
      }
    : {
        heading: 'Gesuche individualisieren',
        description: 'Hier bearbeitest du die vom CRM importierten Immobiliengesuche und ergänzt die Inhalte für die Sprachen des Portalpartners.',
        emptyHint: hasRequestScope
          ? 'Für gebuchte Gesuche wurden noch keine importierten Datensätze gefunden.'
          : 'Für diesen Netzwerkpartner sind aktuell keine Gesuchs-Buchungen aktiv.',
      };

  return (
    <NetworkPartnerShell
      activeSection="content"
      title="Mein Content"
      description="Der Netzwerkpartner individualisiert hier die importierten Angebote und Gesuche innerhalb der gebuchten Placements. Freigabe und Live-Schaltung bleiben im Portal-Partner-Review."
    >
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/network-partner/content" style={{ color: '#0f766e', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Content-Übersicht
        </Link>
      </div>
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}

      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>{activeTabMeta.heading}</h3>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{activeTabMeta.description}</p>
          {availableTabs.length > 0 ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {availableTabs.map((tab) => {
                const active = resolvedActiveTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      borderRadius: 999,
                      padding: '10px 14px',
                      border: active ? '1px solid rgb(72, 107, 122)' : '1px solid #cbd5e1',
                      background: active ? 'rgb(72, 107, 122)' : '#fff',
                      color: active ? '#fff' : '#334155',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label} · {tab.count}
                  </button>
                );
              })}
            </div>
          ) : null}
          {loading ? (
            <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
          ) : (
            <ContentList contentItems={filteredContentItems} emptyHint={activeTabMeta.emptyHint} />
          )}
        </section>
      </div>
    </NetworkPartnerShell>
  );
}
