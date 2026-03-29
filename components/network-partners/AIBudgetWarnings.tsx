'use client';

import type { PartnerAICreditLedgerRecord, PartnerAIUsageEventRecord } from '@/lib/network-partners/types';

type AIBudgetWarningsProps = {
  ledger: PartnerAICreditLedgerRecord | null;
  usageEvents: PartnerAIUsageEventRecord[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function AIBudgetWarnings({ ledger, usageEvents }: AIBudgetWarningsProps) {
  const blockedCount = usageEvents.filter((event) => event.status === 'blocked').length;
  const errorCount = usageEvents.filter((event) => event.status === 'error').length;
  const remaining = ledger ? Number((ledger.closing_balance_eur - ledger.credits_used_eur).toFixed(4)) : null;
  const lowBalance = remaining !== null && remaining <= 10;

  const warnings: string[] = [];
  if (!ledger) {
    warnings.push('Kein Credit-Ledger für die gewählte Periode vorhanden.');
  }
  if (lowBalance) {
    warnings.push(`Niedriger Restbestand erkannt: ${formatCurrency(remaining ?? 0)} verbleibend.`);
  }
  if (blockedCount > 0) {
    warnings.push(`${blockedCount} KI-Ereignisse wurden als blocked protokolliert.`);
  }
  if (errorCount > 0) {
    warnings.push(`${errorCount} KI-Ereignisse wurden mit Fehlerstatus protokolliert.`);
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Budgetwarnungen</h3>
      {warnings.length === 0 ? (
        <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>
          Aktuell keine Budget- oder Statuswarnungen für die angezeigte Periode.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {warnings.map((warning) => (
            <div
              key={warning}
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px solid #f59e0b',
                background: '#fffbeb',
                color: '#92400e',
                fontWeight: 600,
              }}
            >
              {warning}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
