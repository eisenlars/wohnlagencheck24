'use client';

import { useEffect, useState } from 'react';

import BookingList from '@/components/network-partners/self-service/BookingList';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type { NetworkPartnerBookingRecord } from '@/lib/network-partners/types';

type BookingsPayload = {
  bookings?: NetworkPartnerBookingRecord[];
  error?: string;
};

export default function NetworkPartnerBookingsPage() {
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/network-partner/bookings', { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as BookingsPayload | null;
      if (!active) return;
      if (!response.ok) {
        setBookings([]);
        setError(String(payload?.error ?? 'Buchungen konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setBookings(Array.isArray(payload?.bookings) ? payload.bookings : []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <NetworkPartnerShell
      title="Meine Buchungen"
      description="Hier sieht der Netzwerkpartner nur die eigenen gebuchten Placements, Pflichtsprachen und kaufmännischen Rahmen."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p> : <BookingList bookings={bookings} />}
    </NetworkPartnerShell>
  );
}
