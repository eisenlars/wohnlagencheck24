'use client';

import type { PartnerAICreditLedgerRecord } from '@/lib/network-partners/types';

type AICreditPanelProps = {
  periodKey: string;
  ledger: PartnerAICreditLedgerRecord | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function AICreditPanel({ periodKey, ledger }: AICreditPanelProps) {
  if (!ledger) {
    return (
      <section style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Credit-Ledger</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Für die Periode {periodKey} ist noch kein Credit-Ledger vorhanden. Für `credit_based`-Flows wäre die KI-Nutzung damit aktuell blockiert oder warnpflichtig.
        </p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Credit-Ledger</h3>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          ['Opening', formatCurrency(ledger.opening_balance_eur)],
          ['Added', formatCurrency(ledger.credits_added_eur)],
          ['Used', formatCurrency(ledger.credits_used_eur)],
          ['Closing', formatCurrency(ledger.closing_balance_eur)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 16,
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              background: '#fff',
              display: 'grid',
              gap: 6,
            }}
          >
            <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </span>
            <strong style={{ color: '#0f172a', fontSize: 18 }}>{value}</strong>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: '#475569' }}>
        <span>Status: {ledger.status}</span>
        <span>Periode: {ledger.period_key}</span>
        <span>Aktualisiert: {ledger.updated_at}</span>
      </div>
    </section>
  );
}
