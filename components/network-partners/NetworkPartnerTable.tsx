'use client';

import Link from 'next/link';

import type { NetworkPartnerRecord } from '@/lib/network-partners/types';

type NetworkPartnerTableProps = {
  networkPartners: NetworkPartnerRecord[];
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('de-DE');
}

function formatStatusLabel(status: NetworkPartnerRecord['status']): string {
  if (status === 'active') return 'Aktiv';
  if (status === 'paused') return 'Pausiert';
  return 'Inaktiv';
}

export default function NetworkPartnerTable({ networkPartners }: NetworkPartnerTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Unternehmen</th>
            <th style={{ padding: '10px 12px' }}>Kontakt</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
            <th style={{ padding: '10px 12px' }}>Managed Editing</th>
            <th style={{ padding: '10px 12px' }}>Aktualisiert</th>
            <th style={{ padding: '10px 12px' }}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {networkPartners.map((partner) => (
            <tr key={partner.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ color: '#0f172a' }}>{partner.company_name}</strong>
                  {partner.legal_name ? (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{partner.legal_name}</span>
                  ) : null}
                </div>
              </td>
              <td style={{ padding: '12px', color: '#334155' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span>{partner.contact_email}</span>
                  {partner.contact_phone ? (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{partner.contact_phone}</span>
                  ) : null}
                </div>
              </td>
              <td style={{ padding: '12px', color: '#334155' }}>{formatStatusLabel(partner.status)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>
                {partner.managed_editing_enabled ? 'Freigegeben' : 'Nur Moderation'}
              </td>
              <td style={{ padding: '12px', color: '#64748b', fontSize: 12 }}>{formatTimestamp(partner.updated_at)}</td>
              <td style={{ padding: '12px' }}>
                <Link
                  href={`/dashboard/network-partners/${partner.id}`}
                  style={{ color: '#0f766e', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Details
                </Link>
              </td>
            </tr>
          ))}
          {networkPartners.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine Netzwerkpartner angelegt.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
