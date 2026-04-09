'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import IntegrationForm from '@/components/network-partners/self-service/IntegrationForm';
import IntegrationList from '@/components/network-partners/self-service/IntegrationList';
import IntegrationPreviewPanel from '@/components/network-partners/self-service/IntegrationPreviewPanel';
import IntegrationSecretsForm from '@/components/network-partners/self-service/IntegrationSecretsForm';
import IntegrationSyncPanel from '@/components/network-partners/self-service/IntegrationSyncPanel';
import SyncRunTable from '@/components/network-partners/self-service/SyncRunTable';
import IntegrationTestPanel from '@/components/network-partners/self-service/IntegrationTestPanel';
import IntegrationTriggerPanel from '@/components/network-partners/self-service/IntegrationTriggerPanel';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type {
  NetworkPartnerIntegrationSyncRunRecord,
  NetworkPartnerPreviewSyncResult,
  NetworkPartnerRecord,
  NetworkPartnerRole,
  NetworkPartnerWriteSyncResult,
} from '@/lib/network-partners/types';

type IntegrationView = {
  id: string;
  kind: 'crm' | 'llm';
  provider: string;
  base_url: string | null;
  auth_type: string | null;
  auth_config: Record<string, unknown> | null;
  detail_url_template: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
  last_test_at: string | null;
  last_preview_sync_at: string | null;
  last_sync_at: string | null;
  has_api_key?: boolean;
  has_token?: boolean;
  has_secret?: boolean;
  has_trigger_token?: boolean;
  has_trigger_secret?: boolean;
};

type TriggerConfig = {
  provider: string;
  token: string | null;
  webhook_url: string | null;
  has_secret: boolean;
  is_configured: boolean;
  last_received_at: string | null;
  last_processed_at: string | null;
  last_status: string | null;
  events_today: number | null;
};

type MePayload = {
  actor?: {
    role?: NetworkPartnerRole;
    network_partner_id?: string;
    user_id?: string;
  };
  network_partner?: NetworkPartnerRecord;
  error?: string;
};

type IntegrationsPayload = {
  policy?: {
    llm_partner_managed_allowed?: boolean;
  };
  integrations?: IntegrationView[];
  error?: string;
};

type RunsPayload = {
  runs?: NetworkPartnerIntegrationSyncRunRecord[];
  error?: string;
};

type ActionErrorPayload = { error?: string } | null;

type TestPayload = {
  ok?: boolean;
  result?: {
    status: 'ok' | 'warning' | 'error';
    message: string;
    http_status?: number;
  };
  diagnostics?: {
    trace_id?: string;
    duration_ms?: number;
    request_count?: number;
    target_path?: string | null;
    timeout_ms?: number;
    provider_http_status?: number | null;
  };
  error?: string;
};

type PreviewPayload = {
  ok?: boolean;
  result?: NetworkPartnerPreviewSyncResult;
  error?: string;
};

type SyncPayload = {
  ok?: boolean;
  result?: NetworkPartnerWriteSyncResult;
  error?: string;
};

type TriggerConfigPayload = {
  ok?: boolean;
  config?: TriggerConfig;
  generated_secret?: string | null;
  error?: string;
};

function findSelectedIntegration(
  integrations: IntegrationView[],
  selectedIntegrationId: string | null,
): IntegrationView | null {
  if (selectedIntegrationId) {
    const selected = integrations.find((integration) => integration.id === selectedIntegrationId);
    if (selected) return selected;
  }
  return integrations[0] ?? null;
}

export default function NetworkPartnerIntegrationsPage() {
  const [networkPartner, setNetworkPartner] = useState<NetworkPartnerRecord | null>(null);
  const [role, setRole] = useState<NetworkPartnerRole | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationView[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestPayload['result'] | null>(null);
  const [testDiagnostics, setTestDiagnostics] = useState<TestPayload['diagnostics'] | null>(null);
  const [previewResult, setPreviewResult] = useState<NetworkPartnerPreviewSyncResult | null>(null);
  const [syncResult, setSyncResult] = useState<NetworkPartnerWriteSyncResult | null>(null);
  const [runs, setRuns] = useState<NetworkPartnerIntegrationSyncRunRecord[]>([]);
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [generatedTriggerSecret, setGeneratedTriggerSecret] = useState<string | null>(null);
  const [runningTest, setRunningTest] = useState(false);
  const [runningPreview, setRunningPreview] = useState(false);
  const [runningSync, setRunningSync] = useState(false);
  const [llmAllowed, setLlmAllowed] = useState(false);

  const loadData = useCallback(async () => {
    const [meResponse, integrationsResponse] = await Promise.all([
      fetch('/api/network-partner/me', { method: 'GET', cache: 'no-store' }),
      fetch('/api/network-partner/integrations', { method: 'GET', cache: 'no-store' }),
    ]);
    if (redirectIfUnauthorizedResponse(meResponse, 'network_partner')) return null;
    if (redirectIfUnauthorizedResponse(integrationsResponse, 'network_partner')) return null;
    const mePayload = (await meResponse.json().catch(() => null)) as MePayload | null;
    const integrationsPayload = (await integrationsResponse.json().catch(() => null)) as IntegrationsPayload | null;
    return { meResponse, integrationsResponse, mePayload, integrationsPayload };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await loadData();
      if (!result) return;
      const { meResponse, integrationsResponse, mePayload, integrationsPayload } = result;
      if (!active) return;
      if (!meResponse.ok || !integrationsResponse.ok) {
        setNetworkPartner(null);
        setRole(null);
        setIntegrations([]);
        setSelectedIntegrationId(null);
        setTriggerConfig(null);
        setGeneratedTriggerSecret(null);
        setError(String(mePayload?.error ?? integrationsPayload?.error ?? 'Integrationen konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }

      const nextIntegrations = Array.isArray(integrationsPayload?.integrations) ? integrationsPayload.integrations : [];
      setNetworkPartner(mePayload?.network_partner ?? null);
      setRole(mePayload?.actor?.role ?? null);
      setLlmAllowed(integrationsPayload?.policy?.llm_partner_managed_allowed === true);
      setIntegrations(nextIntegrations);
      setSelectedIntegrationId((current) => findSelectedIntegration(nextIntegrations, current)?.id ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadData]);

  const selectedIntegration = useMemo(
    () => findSelectedIntegration(integrations, selectedIntegrationId),
    [integrations, selectedIntegrationId],
  );
  const canManage = role === 'network_owner' || role === 'network_editor';

  async function reloadIntegrations(nextSelectedId?: string | null) {
    const result = await loadData();
    if (!result) return;
    const { meResponse, integrationsResponse, mePayload, integrationsPayload } = result;
    if (!meResponse.ok || !integrationsResponse.ok) {
      setError(String(mePayload?.error ?? integrationsPayload?.error ?? 'Integrationen konnten nicht geladen werden.'));
      return;
    }
    const nextIntegrations = Array.isArray(integrationsPayload?.integrations) ? integrationsPayload.integrations : [];
    setNetworkPartner(mePayload?.network_partner ?? null);
    setRole(mePayload?.actor?.role ?? null);
    setLlmAllowed(integrationsPayload?.policy?.llm_partner_managed_allowed === true);
    setIntegrations(nextIntegrations);
    setSelectedIntegrationId(findSelectedIntegration(nextIntegrations, nextSelectedId ?? selectedIntegrationId)?.id ?? null);
  }

  useEffect(() => {
    let active = true;
    async function loadRuns() {
      if (!selectedIntegration?.id) {
        setRuns([]);
        return;
      }
      const response = await fetch(
        `/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/runs?limit=12`,
        { method: 'GET', cache: 'no-store' },
      );
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as RunsPayload | null;
      if (!active) return;
      if (!response.ok) {
        setRuns([]);
        return;
      }
      setRuns(Array.isArray(payload?.runs) ? payload.runs : []);
    }
    void loadRuns();
    return () => {
      active = false;
    };
  }, [selectedIntegration?.id]);

  useEffect(() => {
    let active = true;
    async function loadTriggerConfig() {
      if (!selectedIntegration?.id || selectedIntegration.kind !== 'crm') {
        setTriggerConfig(null);
        setGeneratedTriggerSecret(null);
        setTriggerLoading(false);
        return;
      }
      setTriggerLoading(true);
      const response = await fetch(
        `/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/trigger-config`,
        { method: 'GET', cache: 'no-store' },
      );
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as TriggerConfigPayload | null;
      if (!active) return;
      if (!response.ok) {
        setTriggerConfig(null);
        setTriggerLoading(false);
        return;
      }
      setTriggerConfig(payload?.config ?? null);
      setTriggerLoading(false);
    }
    void loadTriggerConfig();
    return () => {
      active = false;
    };
  }, [selectedIntegration?.id, selectedIntegration?.kind]);

  return (
    <NetworkPartnerShell
      activeSection="integrations"
      title="Anbindungen"
      description="Hier pflegt der Netzwerkpartner eigene CRM- und LLM-Anbindungen. CRM nutzt Test, Preview und Sync, LLM konzentriert sich auf Provider, Secrets und Verbindungstest."
    >
      {networkPartner ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#334155' }}>
          <span>Unternehmen: {networkPartner.company_name}</span>
          <span>Rolle: {role ?? '—'}</span>
        </div>
      ) : null}
      {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p> : null}

      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ display: 'grid', gap: 12 }}>
          <IntegrationForm
            title="Neue Integration anlegen"
            submitLabel="Integration anlegen"
            disabled={!canManage}
            llmAllowed={llmAllowed}
            onSubmit={async (values) => {
              setError(null);
              setMessage(null);
              const response = await fetch('/api/network-partner/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  kind: values.kind,
                  provider: values.provider,
                  base_url: values.base_url,
                  auth_type: values.auth_type,
                  detail_url_template: values.detail_url_template,
                  is_active: values.is_active,
                  settings: values.settings,
                }),
              });
              if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
              const payload = (await response.json().catch(() => null)) as { integration?: IntegrationView; error?: string } | null;
              if (!response.ok) {
                setError(String(payload?.error ?? 'Integration konnte nicht angelegt werden.'));
                return;
              }
              const nextSelectedId = payload?.integration?.id ?? null;
              await reloadIntegrations(nextSelectedId);
              setMessage('Integration wurde angelegt.');
            }}
          />
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Bestehende Integrationen</h3>
          <IntegrationList
            integrations={integrations}
            role={role}
            selectedIntegrationId={selectedIntegrationId}
            onSelect={(integrationId) => {
              setSelectedIntegrationId(integrationId);
              setMessage(null);
              setError(null);
              setTestResult(null);
              setTestDiagnostics(null);
              setPreviewResult(null);
              setSyncResult(null);
              setGeneratedTriggerSecret(null);
            }}
            onDelete={async (integrationId) => {
              if (!canManage) return;
              setError(null);
              setMessage(null);
              const response = await fetch(`/api/network-partner/integrations/${encodeURIComponent(integrationId)}`, {
                method: 'DELETE',
              });
              if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
              const payload = (await response.json().catch(() => null)) as ActionErrorPayload;
              if (!response.ok) {
                setError(String(payload?.error ?? 'Integration konnte nicht gelöscht werden.'));
                return;
              }
              await reloadIntegrations(integrationId === selectedIntegrationId ? null : selectedIntegrationId);
              setMessage('Integration wurde gelöscht.');
              setTestResult(null);
              setTestDiagnostics(null);
              setPreviewResult(null);
              setSyncResult(null);
              setGeneratedTriggerSecret(null);
            }}
          />
        </section>

        {selectedIntegration ? (
          <section style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                <IntegrationForm
                  title="Integration bearbeiten"
                  submitLabel="Integration speichern"
                  disabled={!canManage}
                  initialValue={selectedIntegration}
                  llmAllowed={llmAllowed}
                  onSubmit={async (values) => {
                    setError(null);
                    setMessage(null);
                    const response = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        kind: values.kind,
                        provider: values.provider,
                        base_url: values.base_url,
                        auth_type: values.auth_type,
                        detail_url_template: values.detail_url_template,
                        is_active: values.is_active,
                        settings: values.settings,
                      }),
                    });
                    if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    if (!response.ok) {
                      setError(String(payload?.error ?? 'Integration konnte nicht gespeichert werden.'));
                      return;
                    }
                    await reloadIntegrations(selectedIntegration.id);
                    setMessage('Integration wurde aktualisiert.');
                  }}
                />
              </article>

              <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                <IntegrationSecretsForm
                  integration={selectedIntegration}
                  disabled={!canManage}
                  onSubmit={async (values) => {
                    setError(null);
                    setMessage(null);
                    const response = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/secrets`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(values),
                    });
                    if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                    const payload = (await response.json().catch(() => null)) as ActionErrorPayload;
                    if (!response.ok) {
                      setError(String(payload?.error ?? 'Secrets konnten nicht gespeichert werden.'));
                      return;
                    }
                    await reloadIntegrations(selectedIntegration.id);
                    setMessage('Secrets wurden gespeichert.');
                  }}
                />
              </article>
            </div>

            {selectedIntegration.kind === 'crm' ? (
              <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                <IntegrationTriggerPanel
                  config={triggerConfig}
                  generatedSecret={generatedTriggerSecret}
                  disabled={!canManage}
                  loading={triggerLoading}
                  onGenerate={async () => {
                    setTriggerLoading(true);
                    setError(null);
                    setMessage(null);
                    try {
                      const response = await fetch(
                        `/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/trigger-config`,
                        { method: 'POST' },
                      );
                      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                      const payload = (await response.json().catch(() => null)) as TriggerConfigPayload | null;
                      if (!response.ok) {
                        setError(String(payload?.error ?? 'Trigger-Konfiguration konnte nicht gespeichert werden.'));
                        return;
                      }
                      setTriggerConfig(payload?.config ?? null);
                      setGeneratedTriggerSecret(payload?.generated_secret ?? null);
                      await reloadIntegrations(selectedIntegration.id);
                      setMessage('Automatische Aktualisierung wurde aktualisiert.');
                    } finally {
                      setTriggerLoading(false);
                    }
                  }}
                />
              </article>
            ) : null}

            <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                <IntegrationTestPanel
                  disabled={!canManage}
                  running={runningTest}
                  result={testResult ?? null}
                  diagnostics={testDiagnostics ?? null}
                  onRun={async () => {
                    setRunningTest(true);
                    setError(null);
                    setMessage(null);
                    try {
                      const response = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/test`, {
                        method: 'POST',
                      });
                      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                      const payload = (await response.json().catch(() => null)) as TestPayload | null;
                      if (!response.ok) {
                        setError(String(payload?.error ?? 'Verbindungstest fehlgeschlagen.'));
                        return;
                      }
                      setTestResult(payload?.result ?? null);
                      setTestDiagnostics(payload?.diagnostics ?? null);
                      await reloadIntegrations(selectedIntegration.id);
                      const runsResponse = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/runs?limit=12`, { method: 'GET', cache: 'no-store' });
                      if (redirectIfUnauthorizedResponse(runsResponse, 'network_partner')) return;
                      const runsPayload = (await runsResponse.json().catch(() => null)) as RunsPayload | null;
                      if (runsResponse.ok) {
                        setRuns(Array.isArray(runsPayload?.runs) ? runsPayload.runs : []);
                      }
                      setMessage('Verbindungstest abgeschlossen.');
                    } finally {
                      setRunningTest(false);
                    }
                  }}
                />
              </article>

              {selectedIntegration.kind === 'crm' ? (
                <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                  <IntegrationPreviewPanel
                    disabled={!canManage}
                    running={runningPreview}
                    result={previewResult}
                    onRun={async (values) => {
                      setRunningPreview(true);
                      setError(null);
                      setMessage(null);
                      try {
                        const response = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/preview-sync`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(values),
                        });
                        if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                        const payload = (await response.json().catch(() => null)) as PreviewPayload | null;
                        if (!response.ok) {
                          setError(String(payload?.error ?? 'Preview-Sync fehlgeschlagen.'));
                          return;
                        }
                        setPreviewResult(payload?.result ?? null);
                        await reloadIntegrations(selectedIntegration.id);
                        const runsResponse = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/runs?limit=12`, { method: 'GET', cache: 'no-store' });
                        if (redirectIfUnauthorizedResponse(runsResponse, 'network_partner')) return;
                        const runsPayload = (await runsResponse.json().catch(() => null)) as RunsPayload | null;
                        if (runsResponse.ok) {
                          setRuns(Array.isArray(runsPayload?.runs) ? runsPayload.runs : []);
                        }
                        setMessage('Preview-Sync abgeschlossen.');
                      } finally {
                        setRunningPreview(false);
                      }
                    }}
                  />
                </article>
              ) : (
                <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc', color: '#475569', lineHeight: 1.6 }}>
                  LLM-Anbindungen benötigen keinen Preview-Sync. Hier stehen nur Provider, Secrets und Verbindungstest im Fokus.
                </article>
              )}
            </div>

            {selectedIntegration.kind === 'crm' ? (
              <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                <IntegrationSyncPanel
                  disabled={!canManage}
                  running={runningSync}
                  result={syncResult}
                  onRun={async (values) => {
                    setRunningSync(true);
                    setError(null);
                    setMessage(null);
                    try {
                      const response = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(values),
                      });
                      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
                      const payload = (await response.json().catch(() => null)) as SyncPayload | null;
                      if (!response.ok) {
                        setError(String(payload?.error ?? 'Sync fehlgeschlagen.'));
                        return;
                      }
                      setSyncResult(payload?.result ?? null);
                      await reloadIntegrations(selectedIntegration.id);
                      const runsResponse = await fetch(`/api/network-partner/integrations/${encodeURIComponent(selectedIntegration.id)}/runs?limit=12`, { method: 'GET', cache: 'no-store' });
                      if (redirectIfUnauthorizedResponse(runsResponse, 'network_partner')) return;
                      const runsPayload = (await runsResponse.json().catch(() => null)) as RunsPayload | null;
                      if (runsResponse.ok) {
                        setRuns(Array.isArray(runsPayload?.runs) ? runsPayload.runs : []);
                      }
                      setMessage('Produktiver Sync abgeschlossen.');
                    } finally {
                      setRunningSync(false);
                    }
                  }}
                />
              </article>
            ) : null}

            <article style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff', display: 'grid', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Letzte Läufe</h3>
              <p style={{ margin: 0, color: '#64748b' }}>
                Persistente Historie für Test, Preview und produktive Syncs.
              </p>
              <SyncRunTable runs={runs} />
            </article>
          </section>
        ) : null}
      </div>
    </NetworkPartnerShell>
  );
}
