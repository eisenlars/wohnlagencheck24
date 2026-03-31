'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import ContentEditor from '@/components/network-partners/self-service/ContentEditor';
import MediaManager from '@/components/network-partners/self-service/MediaManager';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import TranslationEditor from '@/components/network-partners/self-service/TranslationEditor';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
} from '@/lib/network-partners/types';

type ContentPayload = {
  content_item?: NetworkContentRecord;
  error?: string;
};

type BookingsPayload = {
  bookings?: NetworkPartnerBookingRecord[];
  error?: string;
};

type NetworkPartnerContentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function NetworkPartnerContentDetailPage({ params }: NetworkPartnerContentDetailPageProps) {
  const resolvedParams = use(params);
  const contentId = String(resolvedParams.id ?? '').trim();
  const [contentItem, setContentItem] = useState<NetworkContentRecord | null>(null);
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!contentId) return;
      setLoading(true);
      setError(null);
      const [contentResponse, bookingsResponse] = await Promise.all([
        fetch(`/api/network-partner/content/${encodeURIComponent(contentId)}`, { method: 'GET', cache: 'no-store' }),
        fetch('/api/network-partner/bookings', { method: 'GET', cache: 'no-store' }),
      ]);
      if (redirectIfUnauthorizedResponse(contentResponse, 'network_partner')) return;
      if (redirectIfUnauthorizedResponse(bookingsResponse, 'network_partner')) return;
      const contentPayload = (await contentResponse.json().catch(() => null)) as ContentPayload | null;
      const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingsPayload | null;
      if (!active) return;
      if (!contentResponse.ok || !bookingsResponse.ok) {
        setContentItem(null);
        setBookings([]);
        setError(String(contentPayload?.error ?? bookingsPayload?.error ?? 'Content konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setContentItem(contentPayload?.content_item ?? null);
      setBookings(Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [contentId]);

  return (
    <NetworkPartnerShell
      title="Content bearbeiten"
      description="Der Netzwerkpartner pflegt hier den eigenen Inhalt, ergänzt Übersetzungen und reicht den Datensatz in den Review ein."
    >
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/network-partner/content" style={{ color: '#0f766e', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Zurück zur Content-Übersicht
        </Link>
      </div>
      {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}

      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : contentItem ? (
        <div style={{ display: 'grid', gap: 18 }}>
          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Inhalt</h3>
            <ContentEditor
              bookings={bookings}
              contentItem={contentItem}
              onSubmit={async (values) => {
                setError(null);
                setMessage(null);
                const response = await fetch(`/api/network-partner/content/${encodeURIComponent(contentItem.id)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(values),
                });
                if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                const payload = (await response.json().catch(() => null)) as { error?: string; content_item?: NetworkContentRecord } | null;
                if (!response.ok) {
                  setError(String(payload?.error ?? 'Content konnte nicht gespeichert werden.'));
                  return;
                }
                setContentItem(payload?.content_item ?? null);
                setMessage('Content wurde gespeichert.');
              }}
            />
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Übersetzungen</h3>
            <TranslationEditor contentItem={contentItem} />
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Medien</h3>
            <MediaManager contentItemId={contentItem.id} />
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Zur Prüfung einreichen</h3>
            <p style={{ margin: 0, color: '#475569' }}>
              Der Netzwerkpartner kann einen Datensatz zur Prüfung einreichen. Freigabe, Ablehnung und Live-Schaltung bleiben beim Portal-Partner.
            </p>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Notiz für den Portal-Partner
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                style={{ width: '100%', minHeight: 96, border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#0f172a', background: '#fff' }}
              />
            </label>
            <button
              type="button"
              disabled={submittingReview || !(contentItem.status === 'draft' || contentItem.status === 'rejected')}
              onClick={async () => {
                setSubmittingReview(true);
                setError(null);
                setMessage(null);
                try {
                  const response = await fetch(`/api/network-partner/content/${encodeURIComponent(contentItem.id)}/submit-review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      review_note: reviewNote.trim() ? reviewNote.trim() : null,
                    }),
                  });
                  if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                  const payload = (await response.json().catch(() => null)) as { error?: string; content_item?: NetworkContentRecord } | null;
                  if (!response.ok) {
                    setError(String(payload?.error ?? 'Review-Einreichung konnte nicht ausgeführt werden.'));
                    return;
                  }
                  setContentItem(payload?.content_item ?? null);
                  setReviewNote('');
                  setMessage('Content wurde in den Review gegeben.');
                } finally {
                  setSubmittingReview(false);
                }
              }}
              style={{ width: 'fit-content', borderRadius: 10, border: '1px solid #0f766e', background: '#0f766e', color: '#fff', padding: '10px 14px', fontWeight: 700, cursor: submittingReview ? 'not-allowed' : 'pointer', opacity: submittingReview ? 0.65 : 1 }}
            >
              {submittingReview ? 'Reicht ein...' : 'In Review geben'}
            </button>
          </section>
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Kein Content-Datensatz gefunden.</p>
      )}
    </NetworkPartnerShell>
  );
}
