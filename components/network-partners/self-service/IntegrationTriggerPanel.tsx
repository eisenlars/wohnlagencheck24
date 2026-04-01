'use client';

import { useState } from 'react';

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

type IntegrationTriggerPanelProps = {
  config: TriggerConfig | null;
  generatedSecret: string | null;
  disabled?: boolean;
  loading?: boolean;
  onGenerate: () => Promise<void>;
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE');
}

function formatStatusLabel(status: string | null): string {
  if (!status) return 'Noch kein Signal';
  if (status === 'processed') return 'Erfolgreich verarbeitet';
  if (status === 'received') return 'Empfangen';
  if (status === 'ignored') return 'Ignoriert';
  if (status === 'duplicate') return 'Doppelt erkannt';
  if (status === 'error') return 'Mit Fehler beendet';
  return status;
}

export default function IntegrationTriggerPanel({
  config,
  generatedSecret,
  disabled = false,
  loading = false,
  onGenerate,
}: IntegrationTriggerPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const provider = config?.provider === 'onoffice' ? 'onoffice' : 'propstack';

  async function copyValue(label: string, value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} wurde kopiert.`);
      window.setTimeout(() => setCopyMessage(null), 2400);
    } catch {
      setCopyMessage(`${label} konnte nicht automatisch kopiert werden.`);
      window.setTimeout(() => setCopyMessage(null), 2400);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Automatische Aktualisierung</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Hier richtest du ein, dass dein CRM Änderungen automatisch an Wohnlagencheck24 meldet. Die eigentlichen Daten laufen danach weiter über die bestehende Anbindung.
        </p>
      </div>

      {loading ? <p style={{ margin: 0, color: '#64748b' }}>Trigger-Setup wird geladen...</p> : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#334155', fontSize: 14 }}>
        <span>Status: {config?.is_configured ? 'eingerichtet' : 'noch offen'}</span>
        <span>Letztes Signal: {formatDateTime(config?.last_received_at ?? null)}</span>
        <span>Heute empfangen: {config?.events_today ?? '—'}</span>
        <span>Letzter Stand: {formatStatusLabel(config?.last_status ?? null)}</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#f8fafc', display: 'grid', gap: 8 }}>
          <strong style={{ color: '#0f172a' }}>1. Webhook im CRM öffnen</strong>
          {provider === 'onoffice' ? (
            <>
              <div style={{ color: '#334155' }}>
                Öffne in onOffice den Prozessmanager und lege dort einen Webhook als `POST` für den gewünschten Vorgang an.
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                Übergib dabei mindestens `module`, `record_id` und `event`.
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#334155' }}>
                Öffne in Propstack den Bereich <strong>Verwaltung &gt; API-Schlüssel &gt; Webhooks</strong> und lege dort einen neuen Webhook an.
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                Ziel ist, dass Propstack bei Änderungen automatisch ein Signal an Wohnlagencheck24 schickt.
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <strong style={{ color: '#334155' }}>2. Sicherheitsschlüssel erzeugen</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={generatedSecret ?? ''}
              readOnly
              placeholder={config?.has_secret ? 'Vorhanden. Für eine erneute Anzeige bitte neu erzeugen.' : 'Noch kein Schlüssel erzeugt'}
              style={{ flex: '1 1 420px', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}
            />
            <button
              type="button"
              disabled={!generatedSecret}
              onClick={() => void copyValue('Sicherheitsschlüssel', generatedSecret)}
              style={{
                border: '1px solid #0f766e',
                borderRadius: 10,
                background: '#fff',
                color: '#0f766e',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: generatedSecret ? 'pointer' : 'not-allowed',
                opacity: generatedSecret ? 1 : 0.6,
              }}
            >
              Schlüssel kopieren
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => void onGenerate()}
              style={{
                border: '1px solid #0f766e',
                borderRadius: 10,
                background: '#fff',
                color: '#0f766e',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                opacity: disabled || loading ? 0.6 : 1,
              }}
            >
              {config?.has_secret ? 'Schlüssel neu erzeugen' : 'Schlüssel erzeugen'}
            </button>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
            Trage diesen Schlüssel im CRM als Secret ein. Er wird nur direkt nach dem Erzeugen im Klartext angezeigt. Nach einer Neuerzeugung muss er im CRM ebenfalls aktualisiert werden.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <strong style={{ color: '#334155' }}>3. Webhook-Adresse hinterlegen</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={config?.webhook_url ?? ''}
              readOnly
              placeholder="Wird nach dem Erzeugen des Schlüssels bereitgestellt"
              style={{ flex: '1 1 420px', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}
            />
            <button
              type="button"
              disabled={!config?.webhook_url}
              onClick={() => void copyValue('Webhook-Adresse', config?.webhook_url ?? null)}
              style={{
                border: '1px solid #0f766e',
                borderRadius: 10,
                background: '#fff',
                color: '#0f766e',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: config?.webhook_url ? 'pointer' : 'not-allowed',
                opacity: config?.webhook_url ? 1 : 0.6,
              }}
            >
              URL kopieren
            </button>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
            Diese Adresse trägst du im CRM als Zieladresse des Webhooks ein.
          </p>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#f8fafc', display: 'grid', gap: 8 }}>
          <strong style={{ color: '#0f172a' }}>4. Ereignisse aktivieren</strong>
          {provider === 'onoffice' ? (
            <>
              <div style={{ color: '#334155' }}>
                Richte den Prozess so ein, dass bei Änderungen an Immobilien oder Suchprofilen ein `POST` an die Webhook-Adresse gesendet wird.
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                Für onOffice sollte zusätzlich der Header <code>X-WC24-Trigger-Secret</code> mit dem Sicherheitsschlüssel mitgesendet werden.
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#334155' }}>
                Mindestens diese Events aktivieren: <code>property_created</code>, <code>property_updated</code>, <code>saved_query_created</code>, <code>saved_query_updated</code>, <code>saved_query_deleted</code>.
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                Damit werden neue oder geänderte Immobilien und Suchprofile automatisch an Wohnlagencheck24 gemeldet.
              </div>
            </>
          )}
        </div>
      </div>

      {copyMessage ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{copyMessage}</p> : null}

      {config?.last_processed_at ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#f8fafc', color: '#64748b', fontSize: 13 }}>
          Letzte erfolgreiche Verarbeitung: {formatDateTime(config.last_processed_at)}
        </div>
      ) : null}
    </div>
  );
}
