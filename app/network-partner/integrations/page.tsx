'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import IntegrationForm from '@/components/network-partners/self-service/IntegrationForm';
import IntegrationList from '@/components/network-partners/self-service/IntegrationList';
import IntegrationSecretsForm from '@/components/network-partners/self-service/IntegrationSecretsForm';
import SyncRunTable from '@/components/network-partners/self-service/SyncRunTable';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type {
  NetworkPartnerIntegrationSyncRunRecord,
  NetworkPartnerRecord,
  NetworkPartnerRole,
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

type IntegrationFlowTab = 'basis' | 'zugang' | 'admin';

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
  const [runs, setRuns] = useState<NetworkPartnerIntegrationSyncRunRecord[]>([]);
  const [llmAllowed, setLlmAllowed] = useState(false);
  const [integrationFlowTab, setIntegrationFlowTab] = useState<IntegrationFlowTab>('basis');

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

  return (
    <NetworkPartnerShell
      activeSection="integrations"
      title="Anbindungen"
      description="Hier pflegt der Netzwerkpartner eigene CRM- und LLM-Anbindungen. Die operative Prüfung und Synchronisation erfolgt danach zentral im Admin."
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
        <section style={{ border: '1px solid #dbeafe', borderRadius: 16, background: '#eff6ff', padding: 18, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Anbindung in 3 Schritten
          </div>
          <div style={{ color: '#0f172a', fontSize: 15, lineHeight: 1.7 }}>
            1. Provider und Basisdaten speichern. 2. Zugangsdaten hinterlegen. 3. Der Admin prüft die Verbindung und startet Preview bzw. produktiven Sync.
          </div>
        </section>

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
              setIntegrationFlowTab('zugang');
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
              setIntegrationFlowTab('basis');
              setMessage(null);
              setError(null);
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
            }}
          />
        </section>

        {selectedIntegration ? (
          <section style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIntegrationFlowTab('basis')}
                style={flowTabStyle(integrationFlowTab === 'basis')}
              >
                1. Basisdaten
              </button>
              <button
                type="button"
                onClick={() => setIntegrationFlowTab('zugang')}
                style={flowTabStyle(integrationFlowTab === 'zugang')}
              >
                2. Zugangsdaten
              </button>
              <button
                type="button"
                onClick={() => setIntegrationFlowTab('admin')}
                style={flowTabStyle(integrationFlowTab === 'admin')}
              >
                3. Admin-Freigabe & Status
              </button>
            </div>

            {integrationFlowTab === 'basis' ? (
              <article style={flowCardStyle}>
                <IntegrationForm
                  title="Integration bearbeiten"
                  submitLabel="Basisdaten speichern"
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
                    setIntegrationFlowTab('zugang');
                    setMessage('Basisdaten wurden gespeichert. Hinterlege jetzt die Zugangsdaten.');
                  }}
                />
              </article>
            ) : null}

            {integrationFlowTab === 'zugang' ? (
              <article style={flowCardStyle}>
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
                    setIntegrationFlowTab('admin');
                    setMessage('Zugangsdaten wurden gespeichert. Der Admin kann die Verbindung jetzt testen und synchronisieren.');
                  }}
                />
              </article>
            ) : null}

            {integrationFlowTab === 'admin' ? (
              <div style={{ display: 'grid', gap: 18 }}>
                <article style={flowCardStyle}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Admin-Freigabe & Status</h3>
                    <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>
                      Verbindungstest, Preview und produktiver Sync werden für diese Anbindung zentral im Admin ausgelöst. Du pflegst hier nur Provider, Basisdaten und Zugangsdaten.
                    </p>
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      <div style={statusCardStyle}>
                        <div style={statusLabelStyle}>Letzter Verbindungstest</div>
                        <div style={statusValueStyle}>{formatDateTime(selectedIntegration.last_test_at)}</div>
                      </div>
                      <div style={statusCardStyle}>
                        <div style={statusLabelStyle}>Letzter Preview-Sync</div>
                        <div style={statusValueStyle}>{formatDateTime(selectedIntegration.last_preview_sync_at)}</div>
                      </div>
                      <div style={statusCardStyle}>
                        <div style={statusLabelStyle}>Letzter produktiver Sync</div>
                        <div style={statusValueStyle}>{formatDateTime(selectedIntegration.last_sync_at)}</div>
                      </div>
                    </div>
                  </div>
                </article>

                <article style={flowCardStyle}>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Letzte Läufe</h3>
                  <p style={{ margin: 0, color: '#64748b' }}>
                    Persistente Historie der vom Admin ausgelösten Tests, Previews und Syncs.
                  </p>
                  <SyncRunTable runs={runs} />
                </article>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </NetworkPartnerShell>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Noch keiner';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('de-DE');
}

const flowCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 16,
  background: '#fff',
  display: 'grid',
  gap: 14,
};

const flowTabStyle = (active: boolean): React.CSSProperties => ({
  border: active ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
  borderRadius: 999,
  background: active ? '#dbeafe' : '#fff',
  color: active ? '#1d4ed8' : '#334155',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
});

const statusCardStyle: React.CSSProperties = {
  border: '1px solid #dbeafe',
  borderRadius: 12,
  background: '#f8fbff',
  padding: 14,
  minHeight: 88,
  display: 'grid',
  gap: 6,
};

const statusLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const statusValueStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.5,
};
