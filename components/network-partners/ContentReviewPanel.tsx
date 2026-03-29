'use client';

import { useMemo, useState } from 'react';

import type { NetworkContentRecord, NetworkContentReviewAction } from '@/lib/network-partners/types';

type ContentReviewPanelProps = {
  contentItem: NetworkContentRecord | null;
  onAction: (action: NetworkContentReviewAction, reviewNote: string | null) => Promise<void>;
};

function availableActionsForStatus(status: NetworkContentRecord['status']): NetworkContentReviewAction[] {
  if (status === 'draft') return ['submit'];
  if (status === 'in_review') return ['approve', 'reject'];
  if (status === 'approved') return ['publish', 'reject'];
  if (status === 'live') return ['pause'];
  if (status === 'paused') return ['publish'];
  if (status === 'rejected') return ['reset_draft', 'submit'];
  return [];
}

function actionLabel(action: NetworkContentReviewAction): string {
  if (action === 'submit') return 'In Review geben';
  if (action === 'approve') return 'Freigeben';
  if (action === 'reject') return 'Ablehnen';
  if (action === 'publish') return 'Live schalten';
  if (action === 'pause') return 'Pausieren';
  return 'Auf Draft zurück';
}

export default function ContentReviewPanel({ contentItem, onAction }: ContentReviewPanelProps) {
  const [reviewNote, setReviewNote] = useState('');
  const [busyAction, setBusyAction] = useState<NetworkContentReviewAction | null>(null);

  const actions = useMemo(
    () => (contentItem ? availableActionsForStatus(contentItem.status) : []),
    [contentItem],
  );

  if (!contentItem) {
    return <p style={{ margin: 0, color: '#64748b' }}>Noch kein Content ausgewählt.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <strong style={{ color: '#0f172a' }}>{contentItem.title}</strong>
        <span style={{ color: '#475569' }}>
          Status: {contentItem.status}
          {contentItem.latest_review ? ` · Letzte Review: ${contentItem.latest_review.review_status}` : ''}
        </span>
        {contentItem.latest_review?.review_note ? (
          <span style={{ color: '#64748b', fontSize: 13 }}>{contentItem.latest_review.review_note}</span>
        ) : null}
      </div>

      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
        Review-Notiz
        <textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          style={{
            width: '100%',
            minHeight: 96,
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            color: '#0f172a',
            background: '#fff',
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={async () => {
              setBusyAction(action);
              try {
                await onAction(action, reviewNote.trim() ? reviewNote.trim() : null);
                setReviewNote('');
              } finally {
                setBusyAction(null);
              }
            }}
            disabled={busyAction !== null}
            style={{
              borderRadius: 10,
              border: '1px solid #0f766e',
              background: '#0f766e',
              color: '#fff',
              padding: '10px 14px',
              fontWeight: 700,
              cursor: busyAction ? 'not-allowed' : 'pointer',
              opacity: busyAction ? 0.65 : 1,
            }}
          >
            {busyAction === action ? 'Läuft...' : actionLabel(action)}
          </button>
        ))}
      </div>
    </div>
  );
}
