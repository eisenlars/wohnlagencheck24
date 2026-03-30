'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import type { NetworkPartnerRole, NetworkPartnerUserRecord } from '@/lib/network-partners/types';

type NetworkPartnerRightsPanelProps = {
  networkPartnerId: string;
};

type UsersPayload = {
  users?: NetworkPartnerUserRecord[];
  error?: string;
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 16,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#fff',
};

const selectStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
  background: '#fff',
};

function roleLabel(role: NetworkPartnerRole): string {
  if (role === 'network_owner') return 'Owner';
  if (role === 'network_editor') return 'Editor';
  return 'Billing';
}

const roleDescriptions: Array<{ role: NetworkPartnerRole; title: string; description: string }> = [
  {
    role: 'network_owner',
    title: 'Owner',
    description: 'Voller Zugriff auf den geschützten Bereich des Netzwerkpartners, inklusive Inhalte, Integrationen und Sync-Aktionen.',
  },
  {
    role: 'network_editor',
    title: 'Editor',
    description: 'Operativer Zugriff auf Inhalte und Integrationen, aber ohne die Verantwortung eines Hauptverantwortlichen im Vertrags- oder Ansprechpartner-Sinn.',
  },
  {
    role: 'network_billing',
    title: 'Billing',
    description: 'Lesender kaufmännischer Zugriff für Buchungen und Abrechnung, ohne operative Schreibrechte in Inhalte oder Integrationen.',
  },
];

export default function NetworkPartnerRightsPanel({
  networkPartnerId,
}: NetworkPartnerRightsPanelProps) {
  const [users, setUsers] = useState<NetworkPartnerUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  async function loadUsers() {
    const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/users`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as UsersPayload | null;
    if (!response.ok) {
      setUsers([]);
      setError(String(payload?.error ?? 'Rechte konnten nicht geladen werden.'));
      return;
    }
    setUsers(Array.isArray(payload?.users) ? payload.users : []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    void (async () => {
      const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/users`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as UsersPayload | null;
      if (!active) return;
      if (!response.ok) {
        setUsers([]);
        setError(String(payload?.error ?? 'Rechte konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setUsers(Array.isArray(payload?.users) ? payload.users : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [networkPartnerId]);

  const hasUsers = useMemo(() => users.length > 0, [users]);

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Rechte</h2>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
          Rollen werden bewusst getrennt vom Invite gepflegt. So bleibt die Einladung einfach, und Berechtigungen werden nachvollziehbar an einer eigenen Stelle verwaltet.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {roleDescriptions.map((item) => (
          <article key={item.role} style={cardStyle}>
            <strong style={{ color: '#0f172a', fontSize: 16 }}>{item.title}</strong>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{item.description}</p>
          </article>
        ))}
      </div>

      {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
        Neue Zugänge werden standardmäßig mit der Rolle <strong>Owner</strong> angelegt. Danach kann die Rolle hier gezielt angepasst werden.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px' }}>Zugang</th>
              <th style={{ padding: '10px 12px' }}>Aktuelle Rolle</th>
              <th style={{ padding: '10px 12px' }}>Ändern</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={{ padding: '18px 12px', color: '#64748b' }}>Lädt...</td>
              </tr>
            ) : !hasUsers ? (
              <tr>
                <td colSpan={3} style={{ padding: '18px 12px', color: '#64748b' }}>
                  Noch keine Zugänge vorhanden. Lege zuerst im Tab <strong>Zugang & Einladung</strong> einen Zugang an.
                </td>
              </tr>
            ) : users.map((user) => (
              <RightsRow
                key={`${user.id}:${user.role}`}
                user={user}
                saving={savingUserId === user.id}
                onSave={async (role) => {
                  setSavingUserId(user.id);
                  setError(null);
                  setMessage(null);
                  try {
                    const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(networkPartnerId)}/users`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        auth_user_id: user.auth_user_id,
                        role,
                      }),
                    });
                    const payload = (await response.json().catch(() => null)) as { error?: string; users?: NetworkPartnerUserRecord[] } | null;
                    if (!response.ok) {
                      setError(String(payload?.error ?? 'Rolle konnte nicht aktualisiert werden.'));
                      return;
                    }
                    setMessage(`Rolle für ${String(user.email ?? 'den Zugang')} wurde aktualisiert.`);
                    await loadUsers();
                  } finally {
                    setSavingUserId(null);
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RightsRow({
  user,
  saving,
  onSave,
}: {
  user: NetworkPartnerUserRecord;
  saving: boolean;
  onSave: (role: NetworkPartnerRole) => Promise<void>;
}) {
  const [role, setRole] = useState<NetworkPartnerRole>(user.role);

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '12px', color: '#334155' }}>{user.email ?? 'Unbekannt'}</td>
      <td style={{ padding: '12px', color: '#334155', fontWeight: 600 }}>{roleLabel(user.role)}</td>
      <td style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={role} onChange={(event) => setRole(event.target.value as NetworkPartnerRole)} style={selectStyle}>
            <option value="network_owner">Owner</option>
            <option value="network_editor">Editor</option>
            <option value="network_billing">Billing</option>
          </select>
          <button
            type="button"
            disabled={saving || role === user.role}
            onClick={() => void onSave(role)}
            style={{
              borderRadius: 10,
              border: '1px solid #1d4ed8',
              background: '#1d4ed8',
              color: '#fff',
              padding: '10px 14px',
              fontWeight: 700,
              cursor: saving || role === user.role ? 'not-allowed' : 'pointer',
              opacity: saving || role === user.role ? 0.6 : 1,
            }}
          >
            {saving ? 'Speichert...' : 'Rolle speichern'}
          </button>
        </div>
      </td>
    </tr>
  );
}
