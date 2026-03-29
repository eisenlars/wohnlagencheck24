'use client';

import { useEffect, useState } from 'react';

type IntegrationRecord = {
  id: string;
  provider: string;
  base_url: string | null;
  auth_type: string | null;
  detail_url_template: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
};

type IntegrationFormValues = {
  provider: 'propstack' | 'onoffice';
  base_url: string;
  auth_type: string;
  detail_url_template: string;
  is_active: boolean;
  settings: {
    resources: {
      offers: { enabled: boolean };
      requests: { enabled: boolean };
      references: { enabled: boolean };
    };
  };
};

type IntegrationFormProps = {
  title: string;
  submitLabel: string;
  disabled?: boolean;
  initialValue?: IntegrationRecord | null;
  onSubmit: (values: IntegrationFormValues) => Promise<void>;
};

function readEnabled(settings: Record<string, unknown> | null | undefined, key: 'offers' | 'requests' | 'references') {
  const resources =
    settings && typeof settings === 'object' && !Array.isArray(settings) && settings.resources && typeof settings.resources === 'object'
      ? (settings.resources as Record<string, unknown>)
      : null;
  const resource =
    resources && resources[key] && typeof resources[key] === 'object' && !Array.isArray(resources[key])
      ? (resources[key] as Record<string, unknown>)
      : null;
  return typeof resource?.enabled === 'boolean' ? resource.enabled : key !== 'references';
}

function toInitialValues(initialValue?: IntegrationRecord | null): IntegrationFormValues {
  const provider = initialValue?.provider === 'onoffice' ? 'onoffice' : 'propstack';
  const authType = initialValue?.auth_type?.trim() || (provider === 'onoffice' ? 'basic' : 'api_key');
  return {
    provider,
    base_url: initialValue?.base_url ?? '',
    auth_type: authType,
    detail_url_template: initialValue?.detail_url_template ?? '',
    is_active: initialValue?.is_active ?? true,
    settings: {
      resources: {
        offers: { enabled: readEnabled(initialValue?.settings, 'offers') },
        requests: { enabled: readEnabled(initialValue?.settings, 'requests') },
        references: { enabled: readEnabled(initialValue?.settings, 'references') },
      },
    },
  };
}

export default function IntegrationForm({
  title,
  submitLabel,
  disabled = false,
  initialValue = null,
  onSubmit,
}: IntegrationFormProps) {
  const [values, setValues] = useState<IntegrationFormValues>(() => toInitialValues(initialValue));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(toInitialValues(initialValue));
  }, [initialValue]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit(values);
          if (!initialValue) setValues(toInitialValues(null));
        } finally {
          setSubmitting(false);
        }
      }}
      style={{ display: 'grid', gap: 14 }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>{title}</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Provider, Basis-URL und die aktivierten Ressourcen werden hier gepflegt. Secrets laufen separat.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Provider</span>
          <select
            value={values.provider}
            disabled={disabled || submitting || Boolean(initialValue)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                provider: event.target.value === 'onoffice' ? 'onoffice' : 'propstack',
                auth_type: event.target.value === 'onoffice' ? 'basic' : 'api_key',
              }))
            }
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          >
            <option value="propstack">Propstack</option>
            <option value="onoffice">onOffice</option>
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
            placeholder={values.provider === 'onoffice' ? 'https://api.onoffice.de/api/stable/api.php' : 'https://api.propstack.de/v1'}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          />
        </label>

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
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <strong style={{ color: '#334155' }}>Ressourcen</strong>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {(['offers', 'requests', 'references'] as const).map((resource) => (
            <label key={resource} style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#334155' }}>
              <input
                type="checkbox"
                checked={values.settings.resources[resource].enabled}
                disabled={disabled || submitting}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    settings: {
                      resources: {
                        ...current.settings.resources,
                        [resource]: { enabled: event.target.checked },
                      },
                    },
                  }))
                }
              />
              {resource}
            </label>
          ))}
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
      </div>

      <div>
        <button
          type="submit"
          disabled={disabled || submitting}
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
