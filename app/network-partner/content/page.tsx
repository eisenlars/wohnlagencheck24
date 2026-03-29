'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import ContentEditor from '@/components/network-partners/self-service/ContentEditor';
import ContentList from '@/components/network-partners/self-service/ContentList';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
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

export default function NetworkPartnerContentPage() {
  const [contentItems, setContentItems] = useState<NetworkContentRecord[]>([]);
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [contentResponse, bookingsResponse] = await Promise.all([
      fetch('/api/network-partner/content', { method: 'GET', cache: 'no-store' }),
      fetch('/api/network-partner/bookings', { method: 'GET', cache: 'no-store' }),
    ]);
    const contentPayload = (await contentResponse.json().catch(() => null)) as ContentPayload | null;
    const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingsPayload | null;
    return { contentResponse, bookingsResponse, contentPayload, bookingsPayload };
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { contentResponse, bookingsResponse, contentPayload, bookingsPayload } = await refresh();
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

  return (
    <NetworkPartnerShell
      title="Mein Content"
      description="Der Netzwerkpartner pflegt hier den eigenen Content innerhalb der gebuchten Placements. Freigabe und Live-Schaltung bleiben im Portal-Partner-Review."
    >
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/network-partner/content" style={{ color: '#0f766e', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Content-Übersicht
        </Link>
      </div>
      {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}

      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Neuen Content anlegen</h3>
          <ContentEditor
            bookings={bookings}
            onSubmit={async (values) => {
              setError(null);
              setMessage(null);
              const response = await fetch('/api/network-partner/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
              });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              if (!response.ok) {
                setError(String(payload?.error ?? 'Content konnte nicht angelegt werden.'));
                return;
              }
              setMessage('Content wurde angelegt.');
              const { contentResponse, bookingsResponse, contentPayload, bookingsPayload } = await refresh();
              if (!contentResponse.ok || !bookingsResponse.ok) return;
              setContentItems(Array.isArray(contentPayload?.content_items) ? contentPayload.content_items : []);
              setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
            }}
          />
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Bestehender Content</h3>
          {loading ? <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p> : <ContentList contentItems={contentItems} />}
        </section>
      </div>
    </NetworkPartnerShell>
  );
}
