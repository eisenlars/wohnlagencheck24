'use client';

import Link from 'next/link';

import type { NetworkContentRecord } from '@/lib/network-partners/types';

type ContentListProps = {
  contentItems: NetworkContentRecord[];
};

export default function ContentList({ contentItems }: ContentListProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Titel</th>
            <th style={{ padding: '10px 12px' }}>Typ</th>
            <th style={{ padding: '10px 12px' }}>Gebiet</th>
            <th style={{ padding: '10px 12px' }}>Buchung</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
            <th style={{ padding: '10px 12px' }}>Review</th>
            <th style={{ padding: '10px 12px' }}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {contentItems.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ color: '#0f172a' }}>{item.title}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{item.slug}</span>
                </div>
              </td>
              <td style={{ padding: '12px' }}>{item.content_type}</td>
              <td style={{ padding: '12px' }}>{item.area_id}</td>
              <td style={{ padding: '12px' }}>{item.booking_id}</td>
              <td style={{ padding: '12px' }}>{item.status}</td>
              <td style={{ padding: '12px' }}>{item.latest_review?.review_status ?? 'keine'}</td>
              <td style={{ padding: '12px' }}>
                <Link
                  href={`/network-partner/content/${encodeURIComponent(item.id)}`}
                  style={{ color: '#0f766e', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Bearbeiten
                </Link>
              </td>
            </tr>
          ))}
          {contentItems.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch kein eigener Content vorhanden.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
