'use client';

import { useState } from 'react';

type IntegrationRecord = {
  id: string;
  provider: string;
  has_api_key?: boolean;
  has_token?: boolean;
  has_secret?: boolean;
};

type IntegrationSecretsFormProps = {
  integration: IntegrationRecord;
  disabled?: boolean;
  onSubmit: (values: { api_key?: string; token?: string; secret?: string }) => Promise<void>;
};

export default function IntegrationSecretsForm({
  integration,
  disabled = false,
  onSubmit,
}: IntegrationSecretsFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit({
            api_key: apiKey.trim() || undefined,
            token: token.trim() || undefined,
            secret: secret.trim() || undefined,
          });
          setApiKey('');
          setToken('');
          setSecret('');
        } finally {
          setSubmitting(false);
        }
      }}
      style={{ display: 'grid', gap: 14 }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Secrets</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Secretwerte werden nur gesetzt, nicht im Klartext zurückgegeben. Vorhandene Werte sind nur als Flags sichtbar.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#334155', fontSize: 14 }}>
        <span>api_key: {integration.has_api_key ? 'vorhanden' : 'fehlt'}</span>
        <span>token: {integration.has_token ? 'vorhanden' : 'fehlt'}</span>
        <span>secret: {integration.has_secret ? 'vorhanden' : 'fehlt'}</span>
      </div>

      {integration.provider === 'propstack' ? (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>API-Key</span>
          <input
            type="password"
            value={apiKey}
            disabled={disabled || submitting}
            onChange={(event) => setApiKey(event.target.value)}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          />
        </label>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Token</span>
            <input
              type="password"
              value={token}
              disabled={disabled || submitting}
              onChange={(event) => setToken(event.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Secret</span>
            <input
              type="password"
              value={secret}
              disabled={disabled || submitting}
              onChange={(event) => setSecret(event.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
          </label>
        </div>
      )}

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
          {submitting ? 'Speichert...' : 'Secrets speichern'}
        </button>
      </div>
    </form>
  );
}
