'use client';

import type { PartnerAIUsageEventRecord } from '@/lib/network-partners/types';

type AIUsageTableProps = {
  usageEvents: PartnerAIUsageEventRecord[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function AIUsageTable({ usageEvents }: AIUsageTableProps) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Usage-Events</h3>
      {usageEvents.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b' }}>Noch keine KI-Ereignisse für die gewählten Filter vorhanden.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px' }}>Erstellt</th>
                <th style={{ padding: '10px 12px' }}>Feature</th>
                <th style={{ padding: '10px 12px' }}>Locale</th>
                <th style={{ padding: '10px 12px' }}>Billing</th>
                <th style={{ padding: '10px 12px' }}>Prompt</th>
                <th style={{ padding: '10px 12px' }}>Completion</th>
                <th style={{ padding: '10px 12px' }}>Kosten</th>
                <th style={{ padding: '10px 12px' }}>Credit Delta</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Netzwerkpartner</th>
                <th style={{ padding: '10px 12px' }}>Content</th>
              </tr>
            </thead>
            <tbody>
              {usageEvents.map((event) => (
                <tr key={event.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px' }}>{event.created_at}</td>
                  <td style={{ padding: '12px' }}>{event.feature}</td>
                  <td style={{ padding: '12px' }}>{event.locale ?? '—'}</td>
                  <td style={{ padding: '12px' }}>{event.billing_mode}</td>
                  <td style={{ padding: '12px' }}>{event.prompt_tokens}</td>
                  <td style={{ padding: '12px' }}>{event.completion_tokens}</td>
                  <td style={{ padding: '12px' }}>{formatCurrency(event.estimated_cost_eur)}</td>
                  <td style={{ padding: '12px' }}>{formatCurrency(event.credit_delta_eur)}</td>
                  <td style={{ padding: '12px' }}>{event.status}</td>
                  <td style={{ padding: '12px' }}>{event.network_partner_id ?? '—'}</td>
                  <td style={{ padding: '12px' }}>{event.content_item_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
