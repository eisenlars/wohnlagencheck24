'use client';

import type { NetworkPartnerPreviewSyncResult } from '@/lib/network-partners/types';

type IntegrationPreviewPanelProps = {
  disabled?: boolean;
  running?: boolean;
  result: NetworkPartnerPreviewSyncResult | null;
  onRun: (values: { resource: 'offers' | 'requests' | 'all'; mode: 'guarded' | 'full'; sample_limit: number }) => Promise<void>;
};

export default function IntegrationPreviewPanel({
  disabled = false,
  running = false,
  result,
  onRun,
}: IntegrationPreviewPanelProps) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Preview-Sync</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Liest CRM-Daten, löst Gebiete auf und zeigt Match-Klassen, ohne Inhalte in die Netzwerkpartner-Domäne zu schreiben.
        </p>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          await onRun({
            resource: (String(formData.get('resource') ?? 'all') as 'offers' | 'requests' | 'all'),
            mode: (String(formData.get('mode') ?? 'guarded') as 'guarded' | 'full'),
            sample_limit: Number(formData.get('sample_limit') ?? 20) || 20,
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
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Sample-Limit</span>
          <input
            name="sample_limit"
            type="number"
            min={1}
            max={200}
            defaultValue={20}
            disabled={disabled || running}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff', width: 120 }}
          />
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
          {running ? 'Preview läuft...' : 'Preview starten'}
        </button>
      </form>

      {result ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#334155' }}>
            <span>Total: {result.counts.total}</span>
            <span>Exact: {result.counts.exact_match}</span>
            <span>Kreis: {result.counts.kreis_match}</span>
            <span>Not booked: {result.counts.not_booked}</span>
            <span>Unresolved: {result.counts.unresolved_area}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px' }}>Extern</th>
                  <th style={{ padding: '10px 12px' }}>Typ</th>
                  <th style={{ padding: '10px 12px' }}>Titel</th>
                  <th style={{ padding: '10px 12px' }}>Ort</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Gebiet</th>
                  <th style={{ padding: '10px 12px' }}>Grund</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={`${item.source_resource}-${item.external_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{item.external_id}</td>
                    <td style={{ padding: '12px' }}>{item.content_type ?? item.source_resource}</td>
                    <td style={{ padding: '12px' }}>{item.title ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{item.location_label ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{item.status}</td>
                    <td style={{ padding: '12px' }}>{item.matched_area_slug ?? item.area_id ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{item.reason ?? '—'}</td>
                  </tr>
                ))}
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '18px 12px', color: '#64748b' }}>
                      Keine Preview-Daten zurückgegeben.
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
