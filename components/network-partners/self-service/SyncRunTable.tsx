'use client';

import type { NetworkPartnerIntegrationSyncRunRecord } from '@/lib/network-partners/types';

type SyncRunTableProps = {
  runs: NetworkPartnerIntegrationSyncRunRecord[];
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE');
}

export default function SyncRunTable({ runs }: SyncRunTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Start</th>
            <th style={{ padding: '10px 12px' }}>Typ</th>
            <th style={{ padding: '10px 12px' }}>Modus</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
            <th style={{ padding: '10px 12px' }}>Trace</th>
            <th style={{ padding: '10px 12px' }}>Summary</th>
            <th style={{ padding: '10px 12px' }}>Ende</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px' }}>{formatDateTime(run.started_at)}</td>
              <td style={{ padding: '12px' }}>{run.run_kind}</td>
              <td style={{ padding: '12px' }}>{run.run_mode}</td>
              <td style={{ padding: '12px' }}>{run.status}</td>
              <td style={{ padding: '12px', fontSize: 12, color: '#64748b' }}>{run.trace_id ?? '—'}</td>
              <td style={{ padding: '12px', color: '#334155', fontSize: 13 }}>
                {run.summary ? JSON.stringify(run.summary) : '—'}
              </td>
              <td style={{ padding: '12px' }}>{formatDateTime(run.finished_at)}</td>
            </tr>
          ))}
          {runs.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine Sync-Läufe protokolliert.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
