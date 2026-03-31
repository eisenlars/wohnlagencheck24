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

const statusCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#fff',
};

function formatStatus(user: NetworkPartnerUserRecord | null): { label: string; tone: string; background: string; border: string } {
  if (!user) {
    return { label: 'Kein Zugang angelegt', tone: '#92400e', background: '#fffbeb', border: '1px solid #fde68a' };
  }
  if (user.activation_pending) {
    return { label: 'Einladung ausstehend', tone: '#92400e', background: '#fffbeb', border: '1px solid #fde68a' };
  }
  return { label: 'Zugang aktiviert', tone: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0' };
}

export default function NetworkPartnerAccessPanel({
  networkPartnerId,
  contactEmail,
}: NetworkPartnerAccessPanelProps) {
  const [users, setUsers] = useState<NetworkPartnerUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  const accessUser = users[0] ?? null;
  const status = formatStatus(accessUser);

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Zugangsstatus</h2>
      </div>

      {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}

      <article style={statusCardStyle}>
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#0f172a', fontSize: 16 }}>Login-Vorgang</strong>
              <span
                style={{
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: status.tone,
                  background: status.background,
                  border: status.border,
                }}
              >
                {status.label}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 6, color: '#334155' }}>
              <span><strong>E-Mail:</strong> {accessUser?.email ?? contactEmail ?? 'Nicht hinterlegt'}</span>
              {accessUser?.created_at ? (
                <span><strong>Angelegt:</strong> {new Date(accessUser.created_at).toLocaleString('de-DE')}</span>
              ) : null}
              {!accessUser?.activation_pending && accessUser?.last_sign_in_at ? (
                <span><strong>Zuletzt angemeldet:</strong> {new Date(accessUser.last_sign_in_at).toLocaleString('de-DE')}</span>
              ) : null}
            </div>

            {!accessUser ? (
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Für diesen Partner wurde noch kein Login-Zugang erzeugt. Das sollte normalerweise bereits beim Anlegen passiert sein.
              </p>
            ) : accessUser.activation_pending ? (
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Hinweis: Die Einladung wurde versendet, aber der Zugang wurde vom Partner noch nicht aktiviert. Wenn sein Link ablaufen sollte, kann hier ein neuer Link ausgelöst werden.
              </p>
            ) : (
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Der Zugang ist aktiv. Wenn das Passwort vergessen wurde, läuft die Wiederherstellung direkt über den Login des Netzwerkpartners.
              </p>
            )}

            {(!accessUser || accessUser.activation_pending) ? (
              <button
                type="button"
                disabled={resendingId === (accessUser?.id ?? 'missing')}
                onClick={async () => {
                  setResendingId(accessUser?.id ?? 'missing');
                  setError(null);
                  setMessage(null);
                  try {
                    const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/invite-user`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(accessUser?.auth_user_id
                        ? { auth_user_id: accessUser.auth_user_id }
                        : { email: contactEmail }),
                    });
                    const payload = (await response.json().catch(() => null)) as { error?: string; contact_email?: string } | null;
                    if (!response.ok) {
                      setError(String(payload?.error ?? 'Einladung konnte nicht erneut versendet werden.'));
                      return;
                    }
                    setMessage(`${accessUser ? 'Einladung wurde erneut' : 'Einladung wurde'} an ${String(payload?.contact_email ?? accessUser?.email ?? contactEmail ?? '')} versendet.`);
                    await loadUsers();
                  } finally {
                    setResendingId(null);
                  }
                }}
                style={{
                  width: 'fit-content',
                  borderRadius: 10,
                  border: '2px solid #0f766e',
                  background: '#fff',
                  color: '#0f766e',
                  padding: '10px 14px',
                  fontWeight: 700,
                  cursor: resendingId === (accessUser?.id ?? 'missing') ? 'not-allowed' : 'pointer',
                  opacity: resendingId === (accessUser?.id ?? 'missing') ? 0.65 : 1,
                }}
              >
                {resendingId === (accessUser?.id ?? 'missing')
                  ? 'Versendet...'
                  : accessUser
                    ? 'Einladung erneut senden'
                    : 'Einladung senden'}
              </button>
            ) : null}
          </>
        )}
      </article>
    </section>
  );
}
