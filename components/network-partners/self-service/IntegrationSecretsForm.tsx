'use client';

import { useState } from 'react';

type IntegrationRecord = {
  id: string;
  kind?: string | null;
  provider: string;
  auth_type?: string | null;
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

  const authType = String(integration.auth_type ?? '').trim().toLowerCase();
  const provider = String(integration.provider ?? '').trim().toLowerCase();
  const providerLabel =
    provider === 'propstack'
      ? 'Propstack'
      : provider === 'onoffice'
        ? 'onOffice'
        : provider === 'openimmo'
          ? 'OpenImmo'
          : provider === 'openai'
            ? 'OpenAI'
            : provider === 'azure_openai'
              ? 'Azure OpenAI'
              : provider === 'anthropic'
                ? 'Anthropic'
                : provider === 'google_gemini'
                  ? 'Google Gemini'
                  : provider === 'mistral'
                    ? 'Mistral'
                    : provider === 'generic_llm'
                      ? 'Generisches LLM'
                      : integration.provider;

  const introText =
    String(integration.kind ?? '').toLowerCase() === 'llm'
      ? 'Hinterlege hier die Zugangsdaten des eigenen LLM-Providers. Nach dem Speichern prüft der Admin die Verbindung zentral.'
      : 'Hinterlege hier die Zugangsdaten zum CRM. Nach dem Speichern löst der Admin Verbindungstest, Preview und produktiven Sync zentral aus.';

  const authHint =
    authType === 'api_key'
      ? 'Für diese Anbindung wird ein einzelner API-Key benötigt.'
      : authType === 'basic'
        ? 'Für diese Anbindung werden Token und Secret gemeinsam benötigt.'
        : authType === 'token'
          ? 'Für diese Anbindung wird ein Token benötigt.'
          : 'Die Zugangsdaten richten sich nach dem gewählten Provider und Authentifizierungstyp.';

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
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Zugangsdaten</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          {introText}
        </p>
      </div>

      <div style={{ border: '1px solid #dbeafe', borderRadius: 12, background: '#eff6ff', padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#334155', fontSize: 14 }}>
          <span><strong>Provider:</strong> {providerLabel}</span>
          <span><strong>Auth:</strong> {integration.auth_type ?? '—'}</span>
        </div>
        <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
          {authHint} Bereits gesetzte Werte werden aus Sicherheitsgründen nicht im Klartext zurückgegeben.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#334155', fontSize: 13 }}>
          <span>API-Key: {integration.has_api_key ? 'gespeichert' : 'fehlt'}</span>
          <span>Token: {integration.has_token ? 'gespeichert' : 'fehlt'}</span>
          <span>Secret: {integration.has_secret ? 'gespeichert' : 'fehlt'}</span>
        </div>
      </div>

      {authType === 'api_key' ? (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>API-Key</span>
          <input
            type="password"
            value={apiKey}
            disabled={disabled || submitting}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={provider === 'propstack' ? 'Propstack API-Key' : 'API-Key eingeben'}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          />
          {integration.has_api_key ? (
            <span style={{ fontSize: 12, color: '#475569' }}>
              Bereits gespeichert. Ein neuer Wert überschreibt den bisherigen Schlüssel.
            </span>
          ) : null}
        </label>
      ) : authType === 'basic' ? (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Token</span>
            <input
              type="password"
              value={token}
              disabled={disabled || submitting}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Token eingeben"
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
            {integration.has_token ? (
              <span style={{ fontSize: 12, color: '#475569' }}>
                Bereits gespeichert. Ein neuer Wert überschreibt den bisherigen Token.
              </span>
            ) : null}
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Secret</span>
            <input
              type="password"
              value={secret}
              disabled={disabled || submitting}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Secret eingeben"
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
            />
            {integration.has_secret ? (
              <span style={{ fontSize: 12, color: '#475569' }}>
                Bereits gespeichert. Ein neuer Wert überschreibt das bisherige Secret.
              </span>
            ) : null}
          </label>
        </div>
      ) : (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>{authType === 'token' ? 'Token' : 'API-Key / Token'}</span>
          <input
            type="password"
            value={authType === 'token' ? token : apiKey}
            disabled={disabled || submitting}
            onChange={(event) => {
              if (authType === 'token') {
                setToken(event.target.value);
                return;
              }
              setApiKey(event.target.value);
            }}
            placeholder={authType === 'token' ? 'Token eingeben' : 'API-Key oder Token eingeben'}
            style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff' }}
          />
          {(authType === 'token' ? integration.has_token : integration.has_api_key) ? (
            <span style={{ fontSize: 12, color: '#475569' }}>
              Bereits gespeichert. Ein neuer Wert überschreibt den bisherigen Zugangsschlüssel.
            </span>
          ) : null}
        </label>
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
          {submitting ? 'Speichert...' : 'Zugangsdaten speichern'}
        </button>
      </div>
    </form>
  );
}
