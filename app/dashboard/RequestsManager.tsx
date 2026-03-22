'use client';

import CrmAssetManager from './CrmAssetManager';

type VisibilityMode = 'partner_wide' | 'strict_local';

type VisibilityTone = 'info' | 'success' | 'error';

type VisibilityConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type Props = {
  visibilityConfig?: VisibilityConfig | null;
  visibilityMode?: VisibilityMode;
  visibilityBusy?: boolean;
  visibilityMessage?: string | null;
  visibilityTone?: VisibilityTone;
  onVisibilityModeChange?: (value: VisibilityMode) => void | Promise<void>;
};

export default function RequestsManager(props: Props) {
  const {
    visibilityConfig = null,
    visibilityMode = 'partner_wide',
    visibilityBusy = false,
    visibilityMessage = null,
    visibilityTone = 'info',
    onVisibilityModeChange,
  } = props;

  return (
    <CrmAssetManager
      title="Immobiliengesuche"
      rawTable="partner_requests"
      overrideTable="partner_request_overrides"
      emptyHint="Keine Gesuche vorhanden. Nach dem CRM-Sync werden hier synchronisierte Gesuche angezeigt."
      headerContent={visibilityConfig ? (
        <div style={visibilityCardStyle}>
          <div style={visibilityHeadStyle}>Regionale Ausspielung für Gesuche</div>
          <div style={visibilityAreaStyle}>
            {visibilityConfig.areas?.name ?? visibilityConfig.area_id}
          </div>
          <label style={visibilityLabelStyle}>
            <span>Ausspielung</span>
            <select
              value={visibilityMode}
              onChange={(event) => void onVisibilityModeChange?.(event.target.value as VisibilityMode)}
              disabled={visibilityBusy}
              style={visibilitySelectStyle}
            >
              <option value="partner_wide">partnerweit</option>
              <option value="strict_local">nur lokal</option>
            </select>
          </label>
          <div style={visibilityHintStyle}>
            `partnerweit` zeigt alle Gesuche des Partners im Gebiet. `nur lokal` nutzt nur regional passende Gesuche.
          </div>
          {visibilityMessage ? (
            <div style={visibilityMessageStyle(visibilityTone)}>{visibilityMessage}</div>
          ) : null}
        </div>
      ) : null}
    />
  );
}

const visibilityCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  background: '#f8fafc',
  padding: '14px 16px',
  display: 'grid',
  gap: '10px',
  marginBottom: '16px',
};

const visibilityHeadStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700,
  color: '#486b7a',
};

const visibilityAreaStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  color: '#0f172a',
};

const visibilityLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  lineHeight: 1.4,
  fontWeight: 600,
  color: '#334155',
};

const visibilitySelectStyle: React.CSSProperties = {
  minHeight: '40px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 600,
};

const visibilityHintStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#64748b',
};

function visibilityMessageStyle(tone: VisibilityTone): React.CSSProperties {
  if (tone === 'success') {
    return {
      borderRadius: '999px',
      background: '#ecfdf5',
      color: '#166534',
      padding: '8px 12px',
      fontSize: '12px',
      fontWeight: 600,
      width: 'fit-content',
    };
  }
  if (tone === 'error') {
    return {
      borderRadius: '999px',
      background: '#fef2f2',
      color: '#b91c1c',
      padding: '8px 12px',
      fontSize: '12px',
      fontWeight: 600,
      width: 'fit-content',
    };
  }
  return {
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    width: 'fit-content',
  };
}
