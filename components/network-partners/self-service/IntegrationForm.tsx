'use client';

import { useEffect, useMemo, useState } from 'react';

import { getProviderSpec, getProvidersForKind } from '@/lib/integrations/providers';

type IntegrationRecord = {
  id: string;
  kind: 'crm' | 'llm';
  provider: string;
  base_url: string | null;
  auth_type: string | null;
  detail_url_template: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
};

export type IntegrationFormValues = {
  kind: 'crm' | 'llm';
  provider: string;
  base_url: string;
  auth_type: string;
  detail_url_template: string;
  is_active: boolean;
  settings: Record<string, unknown>;
};

type IntegrationFormProps = {
  title: string;
  submitLabel: string;
  disabled?: boolean;
  initialValue?: IntegrationRecord | null;
  llmAllowed?: boolean;
  onSubmit: (values: IntegrationFormValues) => Promise<void>;
};

function defaultProvider(kind: 'crm' | 'llm'): string {
  const providers = getProvidersForKind(kind).filter((spec) =>
    kind === 'crm'
      ? ['propstack', 'onoffice', 'openimmo'].includes(spec.id)
      : ['openai', 'anthropic', 'azure_openai', 'google_gemini', 'mistral', 'generic_llm'].includes(spec.id),
  );
  return providers[0]?.id ?? '';
}

function defaultValuesFor(kind: 'crm' | 'llm', provider: string): IntegrationFormValues {
  const spec = getProviderSpec(provider);
  const authType = spec?.defaultAuthType ?? spec?.authTypes[0] ?? '';
  if (kind === 'llm') {
    return {
      kind,
      provider,
      base_url:
        provider === 'anthropic'
          ? 'https://api.anthropic.com/v1'
          : provider === 'mistral'
            ? 'https://api.mistral.ai/v1'
            : provider === 'google_gemini'
              ? 'https://generativelanguage.googleapis.com/v1beta'
              : provider === 'azure_openai'
                ? 'https://example-resource.openai.azure.com'
                : 'https://api.openai.com/v1',
      auth_type: authType,
      detail_url_template: '',
      is_active: true,
      settings: {
        model:
          provider === 'anthropic'
            ? 'claude-opus-4-1-20250805'
            : provider === 'mistral'
              ? 'mistral-small-latest'
              : provider === 'google_gemini'
                ? 'gemini-2.5-pro'
                : provider === 'azure_openai'
                  ? 'gpt-4o-prod'
                  : 'gpt-5.2',
        api_version: provider === 'azure_openai' ? '2024-10-21' : '',
        temperature: 0.4,
        max_tokens: 800,
      },
    };
  }

  return {
    kind,
    provider,
    base_url:
      provider === 'onoffice'
        ? 'https://api.onoffice.de/api/stable/api.php'
        : provider === 'openimmo'
          ? ''
          : 'https://api.propstack.de/v1',
    auth_type: authType,
    detail_url_template: 'https://crm.example.de/object/{id}',
    is_active: true,
    settings: {
      resources: {
        offers: { enabled: true },
        requests: { enabled: true },
        references: { enabled: true },
      },
    },
  };
}

function toInitialValues(initialValue?: IntegrationRecord | null): IntegrationFormValues {
  if (!initialValue) {
    return defaultValuesFor('crm', defaultProvider('crm'));
  }
  const defaults = defaultValuesFor(initialValue.kind, initialValue.provider);
  return {
    kind: initialValue.kind,
    provider: initialValue.provider,
    base_url: initialValue.base_url ?? defaults.base_url,
    auth_type: initialValue.auth_type ?? defaults.auth_type,
    detail_url_template: initialValue.detail_url_template ?? defaults.detail_url_template,
    is_active: initialValue.is_active ?? true,
    settings: {
      ...defaults.settings,
      ...(initialValue.settings ?? {}),
    },
  };
}

export default function IntegrationForm({
  title,
  submitLabel,
  disabled = false,
  initialValue = null,
  llmAllowed = true,
  onSubmit,
}: IntegrationFormProps) {
  const [values, setValues] = useState<IntegrationFormValues>(() => toInitialValues(initialValue));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(toInitialValues(initialValue));
  }, [initialValue]);

  const providerOptions = useMemo(() => {
    const base = getProvidersForKind(values.kind).filter((spec) =>
      values.kind === 'crm'
        ? ['propstack', 'onoffice', 'openimmo'].includes(spec.id)
        : ['openai', 'anthropic', 'azure_openai', 'google_gemini', 'mistral', 'generic_llm'].includes(spec.id),
    );
    return values.kind === 'llm' && !llmAllowed ? [] : base;
  }, [llmAllowed, values.kind]);

  const providerSpec = getProviderSpec(values.provider);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit(values);
          if (!initialValue) setValues(defaultValuesFor('crm', defaultProvider('crm')));
        } finally {
          setSubmitting(false);
        }
      }}
      style={{ display: 'grid', gap: 14 }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>{title}</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Netzwerkpartner pflegen hier eigene CRM- oder LLM-Anbindungen. Secrets und Verbindungstests laufen separat.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Anbindungsart</span>
          <select
            value={values.kind}
            disabled={disabled || submitting || Boolean(initialValue)}
            onChange={(event) => {
              const nextKind = event.target.value === 'llm' ? 'llm' : 'crm';
              const nextProvider = defaultProvider(nextKind);
              setValues(defaultValuesFor(nextKind, nextProvider));
            }}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          >
            <option value="crm">CRM</option>
            <option value="llm" disabled={!llmAllowed}>LLM</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Provider</span>
          <select
            value={values.provider}
            disabled={disabled || submitting || Boolean(initialValue) || (values.kind === 'llm' && !llmAllowed)}
            onChange={(event) => {
              const nextProvider = event.target.value;
              const nextDefaults = defaultValuesFor(values.kind, nextProvider);
              setValues((current) => ({
                ...nextDefaults,
                is_active: current.is_active,
              }));
            }}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          >
            {providerOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Authentifizierung</span>
          <input
            value={values.auth_type}
            disabled
            readOnly
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Basis-URL</span>
          <input
            value={values.base_url}
            disabled={disabled || submitting}
            onChange={(event) => setValues((current) => ({ ...current, base_url: event.target.value }))}
            placeholder={providerSpec?.requiresBaseUrl ? 'https://api.example.tld' : 'Optional'}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          />
        </label>

        {values.kind === 'crm' ? (
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Detail-URL-Template</span>
            <input
              value={values.detail_url_template}
              disabled={disabled || submitting}
              onChange={(event) => setValues((current) => ({ ...current, detail_url_template: event.target.value }))}
              placeholder="https://crm.example.de/object/{id}"
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
        ) : null}
      </div>

      {values.kind === 'crm' ? null : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Modell</span>
            <input
              value={String(values.settings.model ?? '')}
              disabled={disabled || submitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  settings: { ...current.settings, model: event.target.value },
                }))
              }
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>API-Version</span>
            <input
              value={String(values.settings.api_version ?? '')}
              disabled={disabled || submitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  settings: { ...current.settings, api_version: event.target.value },
                }))
              }
              placeholder={values.provider === 'azure_openai' ? '2024-10-21' : 'Optional'}
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Temperatur</span>
            <input
              value={String(values.settings.temperature ?? '')}
              disabled={disabled || submitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  settings: { ...current.settings, temperature: event.target.value },
                }))
              }
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Max Tokens</span>
            <input
              value={String(values.settings.max_tokens ?? '')}
              disabled={disabled || submitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  settings: { ...current.settings, max_tokens: event.target.value },
                }))
              }
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#334155' }}>
          <input
            type="checkbox"
            checked={values.is_active}
            disabled={disabled || submitting}
            onChange={(event) => setValues((current) => ({ ...current, is_active: event.target.checked }))}
          />
          Integration aktiv
        </label>
      </div>

      <div>
        <button
          type="submit"
          disabled={disabled || submitting || (values.kind === 'llm' && !llmAllowed)}
          style={{
            border: '1px solid #0f766e',
            borderRadius: 10,
            background: '#0f766e',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 700,
            cursor: disabled || submitting ? 'not-allowed' : 'pointer',
            opacity: disabled || submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Speichert...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
