'use client';

import { useEffect, useState } from 'react';

import type {
  NetworkContentMediaKind,
  NetworkContentMediaRecord,
} from '@/lib/network-partners/types';

type MediaPayload = {
  media?: NetworkContentMediaRecord[];
  error?: string;
};

type MediaManagerProps = {
  contentItemId: string;
};

export default function MediaManager({ contentItemId }: MediaManagerProps) {
  const [media, setMedia] = useState<NetworkContentMediaRecord[]>([]);
  const [kind, setKind] = useState<NetworkContentMediaKind>('gallery');
  const [url, setUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/network-partner/content/${encodeURIComponent(contentItemId)}/media`, { method: 'GET', cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as MediaPayload | null;
      if (!active) return;
      if (!response.ok) {
        setMedia([]);
        setError(String(payload?.error ?? 'Medien konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setMedia(Array.isArray(payload?.media) ? payload.media : []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [contentItemId]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {message ? <span style={{ color: '#166534', fontWeight: 600 }}>{message}</span> : null}
      {error ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</span> : null}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
          Medientyp
          <select value={kind} onChange={(event) => setKind(event.target.value as NetworkContentMediaKind)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#0f172a', background: '#fff' }}>
            <option value="logo">logo</option>
            <option value="hero">hero</option>
            <option value="gallery">gallery</option>
            <option value="document">document</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
          Sortierung
          <input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#0f172a', background: '#fff' }} />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
        Medien-URL
        <input value={url} onChange={(event) => setUrl(event.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#0f172a', background: '#fff' }} />
      </label>

      <button
        type="button"
        disabled={submitting || loading}
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          setMessage(null);
          try {
            const response = await fetch(`/api/network-partner/content/${encodeURIComponent(contentItemId)}/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kind,
                url,
                sort_order: Number(sortOrder),
              }),
            });
            const payload = (await response.json().catch(() => null)) as MediaPayload | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Medium konnte nicht gespeichert werden.'));
              return;
            }
            setMedia(Array.isArray(payload?.media) ? payload.media : []);
            setUrl('');
            setSortOrder('0');
            setMessage('Medium wurde gespeichert.');
          } finally {
            setSubmitting(false);
          }
        }}
        style={{ width: 'fit-content', borderRadius: 10, border: '1px solid #0f766e', background: '#0f766e', color: '#fff', padding: '10px 14px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.65 : 1 }}
      >
        {submitting ? 'Speichert...' : 'Medium hinzufügen'}
      </button>

      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px' }}>Typ</th>
                <th style={{ padding: '10px 12px' }}>URL</th>
                <th style={{ padding: '10px 12px' }}>Sortierung</th>
                <th style={{ padding: '10px 12px' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {media.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px' }}>{item.kind}</td>
                  <td style={{ padding: '12px', wordBreak: 'break-all' }}>{item.url}</td>
                  <td style={{ padding: '12px' }}>{item.sort_order}</td>
                  <td style={{ padding: '12px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        setSubmitting(true);
                        setError(null);
                        setMessage(null);
                        try {
                          const response = await fetch(`/api/network-partner/content/${encodeURIComponent(contentItemId)}/media`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ media_id: item.id }),
                          });
                          const payload = (await response.json().catch(() => null)) as MediaPayload | null;
                          if (!response.ok) {
                            setError(String(payload?.error ?? 'Medium konnte nicht gelöscht werden.'));
                            return;
                          }
                          setMedia(Array.isArray(payload?.media) ? payload.media : []);
                          setMessage('Medium wurde gelöscht.');
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      style={{ border: 'none', background: 'transparent', color: '#b91c1c', textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {media.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '18px 12px', color: '#64748b' }}>
                    Noch keine Medien hinterlegt.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
