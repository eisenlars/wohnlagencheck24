'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AIBudgetWarnings from '@/components/network-partners/AIBudgetWarnings';
import AICreditPanel from '@/components/network-partners/AICreditPanel';
import AIUsageTable from '@/components/network-partners/AIUsageTable';
import type {
  PartnerAICreditLedgerRecord,
  PartnerAICreditsResponse,
  PartnerAIEstimateResponse,
  PartnerAIUsageEventRecord,
  PartnerAIUsageFeature,
  PartnerAIUsageResponse,
} from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type CreditsPayload = PartnerAICreditsResponse & { error?: string };
type UsagePayload = PartnerAIUsageResponse & { error?: string };
type EstimatePayload = PartnerAIEstimateResponse & { error?: string };

const FEATURE_OPTIONS: Array<{ value: '' | PartnerAIUsageFeature; label: string }> = [
  { value: '', label: 'Alle Features' },
  { value: 'content_optimize', label: 'Content Optimize' },
  { value: 'content_translate', label: 'Content Translate' },
  { value: 'seo_meta_generate', label: 'SEO Meta Generate' },
];

function buildCurrentPeriodKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);
}

export default function NetworkAIDashboardPage() {
  const [periodKey, setPeriodKey] = useState(buildCurrentPeriodKey);
  const [feature, setFeature] = useState<'' | PartnerAIUsageFeature>('');
  const [ledger, setLedger] = useState<PartnerAICreditLedgerRecord | null>(null);
  const [usageEvents, setUsageEvents] = useState<PartnerAIUsageEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateSummary, setEstimateSummary] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const creditsUrl = `/api/partner/network-ai/credits?period_key=${encodeURIComponent(periodKey)}`;
    const usageUrl = new URL('/api/partner/network-ai/usage', window.location.origin);
    usageUrl.searchParams.set('period_key', periodKey);
    usageUrl.searchParams.set('limit', '50');
    if (feature) {
      usageUrl.searchParams.set('feature', feature);
    }

    const [creditsResponse, usageResponse] = await Promise.all([
      fetch(creditsUrl, { method: 'GET', cache: 'no-store' }),
      fetch(usageUrl.toString(), { method: 'GET', cache: 'no-store' }),
    ]);

    const creditsPayload = (await creditsResponse.json().catch(() => null)) as CreditsPayload | null;
    const usagePayload = (await usageResponse.json().catch(() => null)) as UsagePayload | null;

    if (!creditsResponse.ok || !usageResponse.ok) {
      setLedger(null);
      setUsageEvents([]);
      setError(String(creditsPayload?.error ?? usagePayload?.error ?? 'KI-Daten konnten nicht geladen werden.'));
      setLoading(false);
      return;
    }

    setLedger(creditsPayload?.ledger ?? null);
    setUsageEvents(Array.isArray(usagePayload?.usage_events) ? usagePayload.usage_events : []);
    setLoading(false);
  }, [feature, periodKey]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!active) return;
      await loadData();
    }
    void run();
    return () => {
      active = false;
    };
  }, [loadData]);

  const usageTotals = useMemo(
    () => usageEvents.reduce(
      (acc, event) => ({
        cost: Number((acc.cost + event.estimated_cost_eur).toFixed(4)),
        delta: Number((acc.delta + event.credit_delta_eur).toFixed(4)),
      }),
      { cost: 0, delta: 0 },
    ),
    [usageEvents],
  );

  async function handleExampleEstimate() {
    setEstimateError(null);
    setEstimateSummary(null);

    const response = await fetch('/api/partner/network-ai/estimate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        feature: feature || 'content_translate',
        prompt_tokens: 1500,
        completion_tokens: 1200,
        billing_mode: 'credit_based',
        period_key: periodKey,
      }),
    });

    const payload = (await response.json().catch(() => null)) as EstimatePayload | null;
    if (!response.ok || payload?.ok !== true) {
      setEstimateError(String(payload?.error ?? 'Kostenschaetzung konnte nicht geladen werden.'));
      return;
    }

    setEstimateSummary(
      `Beispielkosten ${formatCurrency(payload.estimate.estimated_cost_eur)} | Budgetstatus ${payload.budget_check.reason} | Verbleibend ${
        payload.budget_check.remaining_after_run_eur === null
          ? 'n/a'
          : formatCurrency(payload.budget_check.remaining_after_run_eur)
      }`,
    );
  }

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 56px', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Plattform
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>KI-Governance</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 820, lineHeight: 1.6 }}>
            Dieser Monitor zeigt Creditstand, Usage-Events und Budgetlage für Portal-Partner. Er ist die operative Steuerzentrale vor der tieferen Einbindung in bestehende KI-Aktionspfade.
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <span>Usage Kosten: {formatCurrency(usageTotals.cost)}</span>
            <span>Credit Delta: {formatCurrency(usageTotals.delta)}</span>
            <Link href="/dashboard/network-content" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Content & Review
            </Link>
            <Link href="/dashboard/network-billing" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Billing
            </Link>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Filter & Kostenschaetzung</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Die Seite bleibt bewusst credit- und budgetorientiert. Tokens werden nur indirekt über die Usage-Ereignisse sichtbar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, minWidth: 180 }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>Periode</span>
            <input
              value={periodKey}
              onChange={(event) => setPeriodKey(event.target.value)}
              placeholder="YYYY-MM"
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '10px 12px',
                font: 'inherit',
                color: '#0f172a',
                background: '#fff',
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, minWidth: 220 }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>Feature</span>
            <select
              value={feature}
              onChange={(event) => setFeature(event.target.value as '' | PartnerAIUsageFeature)}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '10px 12px',
                font: 'inherit',
                color: '#0f172a',
                background: '#fff',
              }}
            >
              {FEATURE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleExampleEstimate()}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '11px 18px',
              font: 'inherit',
              fontWeight: 700,
              color: '#fff',
              background: '#0f172a',
              cursor: 'pointer',
            }}
          >
            Beispiel-Kostenschaetzung
          </button>
        </div>
        {estimateSummary ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{estimateSummary}</p> : null}
        {estimateError ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{estimateError}</p> : null}
      </section>

      <section style={workflowPanelCardStyle}>
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            <AICreditPanel periodKey={periodKey} ledger={ledger} />
            <AIBudgetWarnings ledger={ledger} usageEvents={usageEvents} />
            <AIUsageTable usageEvents={usageEvents} />
          </div>
        )}
      </section>
    </main>
  );
}
