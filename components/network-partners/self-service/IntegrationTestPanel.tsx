'use client';

type TestResult = {
  status: 'ok' | 'warning' | 'error';
  message: string;
  http_status?: number;
};

type TestDiagnostics = {
  trace_id?: string;
  duration_ms?: number;
  request_count?: number;
  target_path?: string | null;
  timeout_ms?: number;
  provider_http_status?: number | null;
};

type IntegrationTestPanelProps = {
  disabled?: boolean;
  running?: boolean;
  result: TestResult | null;
  diagnostics: TestDiagnostics | null;
  onRun: () => Promise<void>;
};

export default function IntegrationTestPanel({
  disabled = false,
  running = false,
  result,
  diagnostics,
  onRun,
}: IntegrationTestPanelProps) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Verbindungstest</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          Prüft Basiskonfiguration, Secrets und den eigentlichen Providerzugriff mit kleinem Testrequest.
        </p>
      </div>

      <div>
        <button
          type="button"
          disabled={disabled || running}
          onClick={() => void onRun()}
          style={{
            border: '1px solid #0f766e',
            borderRadius: 10,
            background: '#0f766e',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 700,
            cursor: disabled || running ? 'not-allowed' : 'pointer',
            opacity: disabled || running ? 0.6 : 1,
          }}
        >
          {running ? 'Test läuft...' : 'Verbindung testen'}
        </button>
      </div>

      {result ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <strong style={{ color: result.status === 'ok' ? '#166534' : result.status === 'warning' ? '#92400e' : '#b91c1c' }}>
              {result.status.toUpperCase()}
            </strong>
            <span style={{ color: '#334155' }}>{result.message}</span>
            {typeof result.http_status === 'number' ? <span style={{ color: '#64748b' }}>HTTP {result.http_status}</span> : null}
            {diagnostics ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 13 }}>
                <span>Dauer: {diagnostics.duration_ms ?? '—'} ms</span>
                <span>Requests: {diagnostics.request_count ?? '—'}</span>
                <span>Ziel: {diagnostics.target_path ?? '—'}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
