'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import type { NetworkPartnerUserRecord } from '@/lib/network-partners/types';

type NetworkPartnerAccessPanelProps = {
  networkPartnerId: string;
  contactEmail?: string | null;
};

type UsersPayload = {
  users?: NetworkPartnerUserRecord[];
  error?: string;
};

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
  background: '#fff',
};

export default function NetworkPartnerAccessPanel({
  networkPartnerId,
  contactEmail,
}: NetworkPartnerAccessPanelProps) {
  const [users, setUsers] = useState<NetworkPartnerUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState(contactEmail ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function loadUsers() {
    const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/users`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as UsersPayload | null;
    if (!response.ok) {
      setUsers([]);
      setError(String(payload?.error ?? 'Zugänge konnten nicht geladen werden.'));
      return;
    }
    setUsers(Array.isArray(payload?.users) ? payload.users : []);
  }

  useEffect(() => {
    let active = true;
    setEmail(contactEmail ?? '');
    setLoading(true);
    setError(null);
    void (async () => {
      const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/users`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as UsersPayload | null;
      if (!active) return;
      if (!response.ok) {
        setUsers([]);
        setError(String(payload?.error ?? 'Zugänge konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setUsers(Array.isArray(payload?.users) ? payload.users : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [contactEmail, networkPartnerId]);

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Zugang & Einladung</h2>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
          Hier wird der eigentliche Netzwerkpartner-Zugang erzeugt. Der Invite-Link fuehrt den Nutzer in den dedizierten Bereich unter <code>/network-partner</code>. Rollen werden separat im Tab <strong>Rechte</strong> gepflegt.
        </p>
      </div>

      {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          setMessage(null);
          try {
            const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/invite-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
              }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string; contact_email?: string } | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Einladung konnte nicht versendet werden.'));
              return;
            }
            setMessage(`Einladung wurde an ${String(payload?.contact_email ?? email)} versendet.`);
            await loadUsers();
          } finally {
            setSubmitting(false);
          }
        }}
        style={{ display: 'grid', gap: 14 }}
      >
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
            E-Mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={inputStyle}
              type="email"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: 'fit-content',
            borderRadius: 10,
            border: '1px solid #1d4ed8',
            background: '#1d4ed8',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.65 : 1,
          }}
        >
          {submitting ? 'Versendet...' : 'Anlegen und Einladungslink versenden'}
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px' }}>E-Mail</th>
              <th style={{ padding: '10px 12px' }}>Angelegt</th>
              <th style={{ padding: '10px 12px' }}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={{ padding: '18px 12px', color: '#64748b' }}>Lädt...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '18px 12px', color: '#64748b' }}>Noch keine Netzwerkpartner-Zugänge vorhanden.</td>
              </tr>
            ) : users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px', color: '#334155' }}>{user.email ?? 'Unbekannt'}</td>
                <td style={{ padding: '12px', color: '#64748b', fontSize: 12 }}>
                  {new Date(user.created_at).toLocaleString('de-DE')}
                </td>
                <td style={{ padding: '12px' }}>
                  <button
                    type="button"
                    disabled={resendingId === user.id}
                    onClick={async () => {
                      setResendingId(user.id);
                      setError(null);
                      setMessage(null);
                      try {
                        const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/invite-user`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            auth_user_id: user.auth_user_id,
                          }),
                        });
                        const payload = (await response.json().catch(() => null)) as { error?: string; contact_email?: string } | null;
                        if (!response.ok) {
                          setError(String(payload?.error ?? 'Einladung konnte nicht erneut versendet werden.'));
                          return;
                        }
                        setMessage(`Einladung wurde erneut an ${String(payload?.contact_email ?? user.email ?? '')} versendet.`);
                        await loadUsers();
                      } finally {
                        setResendingId(null);
                      }
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#0f766e',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                      cursor: resendingId === user.id ? 'not-allowed' : 'pointer',
                      opacity: resendingId === user.id ? 0.6 : 1,
                    }}
                  >
                    {resendingId === user.id ? 'Versendet...' : 'Einladung erneut senden'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
