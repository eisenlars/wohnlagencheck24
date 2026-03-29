'use client';

import type { NetworkPartnerWriteSyncResult } from '@/lib/network-partners/types';

type IntegrationSyncPanelProps = {
  disabled?: boolean;
  running?: boolean;
  result: NetworkPartnerWriteSyncResult | null;
  onRun: (values: { resource: 'offers' | 'requests' | 'all'; mode: 'guarded' | 'full' }) => Promise<void>;
};

export default function IntegrationSyncPanel({
  disabled = false,
  running = false,
  result,
  onRun,
}: IntegrationSyncPanelProps) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Produktiver Sync</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Schreibt preview-validierte Datensätze als Netzwerkpartner-Content. Neue Inhalte landen kontrolliert in `draft` oder `in_review`, nicht direkt live.
        </p>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          await onRun({
            resource: (String(formData.get('resource') ?? 'all') as 'offers' | 'requests' | 'all'),
            mode: (String(formData.get('mode') ?? 'guarded') as 'guarded' | 'full'),
          });
        }}
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Ressource</span>
          <select name="resource" disabled={disabled || running} defaultValue="all" style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
            <option value="all">all</option>
            <option value="offers">offers</option>
            <option value="requests">requests</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Modus</span>
          <select name="mode" disabled={disabled || running} defaultValue="guarded" style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
            <option value="guarded">guarded</option>
            <option value="full">full</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={disabled || running}
          style={{
            border: '1px solid #0f766e',
            borderRadius: 10,
            background: '#0f766e',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 700,
            cursor: disabled || running ? 'not-allowed' : 'pointer',
            opacity: disabled || running ? 0.6 : 1,
          }}
        >
          {running ? 'Sync läuft...' : 'Sync starten'}
        </button>
      </form>

      {result ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#334155' }}>
            <span>Created: {result.created_count}</span>
            <span>Updated: {result.updated_count}</span>
            <span>Skipped: {result.skipped_count}</span>
            <span>Errors: {result.error_count}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px' }}>Extern</th>
                  <th style={{ padding: '10px 12px' }}>Typ</th>
                  <th style={{ padding: '10px 12px' }}>Booking</th>
                  <th style={{ padding: '10px 12px' }}>Content</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Grund</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={`${line.external_id}-${line.content_item_id ?? line.status}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{line.external_id}</td>
                    <td style={{ padding: '12px' }}>{line.content_type ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{line.booking_id ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{line.content_item_id ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{line.status}</td>
                    <td style={{ padding: '12px' }}>{line.reason ?? '—'}</td>
                  </tr>
                ))}
                {result.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '18px 12px', color: '#64748b' }}>
                      Keine Sync-Zeilen zurückgegeben.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
