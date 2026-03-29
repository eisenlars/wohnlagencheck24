'use client';

import type { NetworkPartnerRole } from '@/lib/network-partners/types';

type IntegrationRecord = {
  id: string;
  provider: string;
  base_url: string | null;
  auth_type: string | null;
  is_active: boolean;
  detail_url_template: string | null;
  last_test_at: string | null;
  last_preview_sync_at: string | null;
  last_sync_at: string | null;
  has_api_key?: boolean;
  has_token?: boolean;
  has_secret?: boolean;
};

type IntegrationListProps = {
  integrations: IntegrationRecord[];
  role: NetworkPartnerRole | null;
  selectedIntegrationId: string | null;
  onSelect: (integrationId: string) => void;
  onDelete: (integrationId: string) => Promise<void>;
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE');
}

export default function IntegrationList({
  integrations,
  role,
  selectedIntegrationId,
  onSelect,
  onDelete,
}: IntegrationListProps) {
  const canWrite = role === 'network_owner' || role === 'network_editor';

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Provider</th>
            <th style={{ padding: '10px 12px' }}>Basis-URL</th>
            <th style={{ padding: '10px 12px' }}>Auth</th>
            <th style={{ padding: '10px 12px' }}>Secrets</th>
            <th style={{ padding: '10px 12px' }}>Aktiv</th>
            <th style={{ padding: '10px 12px' }}>Letzter Test</th>
            <th style={{ padding: '10px 12px' }}>Letzte Preview</th>
            <th style={{ padding: '10px 12px' }}>Letzter Sync</th>
            <th style={{ padding: '10px 12px' }}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {integrations.map((integration) => {
            const isSelected = integration.id === selectedIntegrationId;
            return (
              <tr
                key={integration.id}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: isSelected ? '#f0fdfa' : '#fff',
                }}
              >
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: '#0f172a' }}>{integration.provider}</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{integration.id}</span>
                  </div>
                </td>
                <td style={{ padding: '12px', color: '#334155' }}>{integration.base_url ?? '—'}</td>
                <td style={{ padding: '12px' }}>{integration.auth_type ?? '—'}</td>
                <td style={{ padding: '12px', color: '#334155' }}>
                  {[
                    integration.has_api_key ? 'api_key' : null,
                    integration.has_token ? 'token' : null,
                    integration.has_secret ? 'secret' : null,
                  ].filter(Boolean).join(', ') || '—'}
                </td>
                <td style={{ padding: '12px' }}>{integration.is_active ? 'ja' : 'nein'}</td>
                <td style={{ padding: '12px' }}>{formatDateTime(integration.last_test_at)}</td>
                <td style={{ padding: '12px' }}>{formatDateTime(integration.last_preview_sync_at)}</td>
                <td style={{ padding: '12px' }}>{formatDateTime(integration.last_sync_at)}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onSelect(integration.id)}
                      style={{
                        border: '1px solid #0f766e',
                        borderRadius: 10,
                        background: isSelected ? '#0f766e' : '#fff',
                        color: isSelected ? '#fff' : '#0f766e',
                        padding: '8px 12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isSelected ? 'Ausgewählt' : 'Öffnen'}
                    </button>
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => void onDelete(integration.id)}
                        style={{
                          border: '1px solid #dc2626',
                          borderRadius: 10,
                          background: '#fff',
                          color: '#dc2626',
                          padding: '8px 12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Löschen
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {integrations.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine CRM-Integrationen vorhanden.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
