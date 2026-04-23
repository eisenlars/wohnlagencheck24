'use client';

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

function formatStatus(user: NetworkPartnerUserRecord | null): { label: string; className: string } {
  if (!user) {
    return { label: 'Kein Zugang angelegt', className: 'text-warning bg-warning-subtle border border-warning-subtle' };
  }
  if (user.activation_pending) {
    return { label: 'Einladung ausstehend', className: 'text-warning bg-warning-subtle border border-warning-subtle' };
  }
  return { label: 'Zugang aktiviert', className: 'text-success bg-success-subtle border border-success-subtle' };
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
    <section className="d-grid gap-3">
      {message ? <p className="m-0 text-success fw-semibold">{message}</p> : null}
      {error ? <p className="m-0 text-danger fw-semibold">{error}</p> : null}

      <article className="d-grid gap-2 p-3 rounded-4 border bg-white">
        {loading ? (
          <p className="m-0 text-secondary">Lädt...</p>
        ) : (
          <>
            <h2 className="m-0 fs-5 text-dark">Zugang & Einladung</h2>
            <p className="m-0 text-secondary lh-base">
              Einladung, Aktivierung und letzter Login des Zugangs zum Netzwerkpartner-Bereich.
            </p>
            <div className="d-flex justify-content-end gap-3 align-items-center flex-wrap">
              <span className={`badge rounded-pill fw-bold px-3 py-2 ${status.className}`}>
                {status.label}
              </span>
            </div>

            <div className="d-grid gap-1 text-secondary">
              <span><strong>E-Mail:</strong> {accessUser?.email ?? contactEmail ?? 'Nicht hinterlegt'}</span>
              {accessUser?.created_at ? (
                <span><strong>Angelegt:</strong> {new Date(accessUser.created_at).toLocaleString('de-DE')}</span>
              ) : null}
              {!accessUser?.activation_pending && accessUser?.last_sign_in_at ? (
                <span><strong>Zuletzt angemeldet:</strong> {new Date(accessUser.last_sign_in_at).toLocaleString('de-DE')}</span>
              ) : null}
            </div>

            {!accessUser ? (
              <p className="m-0 text-secondary lh-base">
                Für diesen Partner wurde noch kein Login-Zugang erzeugt. Das sollte normalerweise bereits beim Anlegen passiert sein.
              </p>
            ) : accessUser.activation_pending ? (
              <p className="m-0 text-secondary lh-base">
                Hinweis: Die Einladung wurde versendet, aber der Zugang wurde vom Partner noch nicht aktiviert. Wenn sein Link ablaufen sollte, kann hier ein neuer Link ausgelöst werden.
              </p>
            ) : (
              <p className="m-0 text-secondary lh-base">
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
                className="btn btn-outline-success fw-bold align-self-start px-3 py-2"
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
