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
          <div style={visibilityControlsRowStyle}>
            <div style={visibilityLabelStyle}>
              <div style={visibilityHeadStyle}>Regionale Ausspielung für Gesuche</div>
              <div style={visibilityAreaStyle}>
                {visibilityConfig.areas?.name ?? visibilityConfig.area_id}
              </div>
              <div style={visibilityHintStyle}>
                `partnerweit` zeigt alle Gesuche des Partners im Gebiet. `nur lokal` nutzt nur regional passende Gesuche.
              </div>
            </div>
            <div style={visibilitySelectWrapStyle}>
              <select
                value={visibilityMode}
                onChange={(event) => void onVisibilityModeChange?.(event.target.value as VisibilityMode)}
                disabled={visibilityBusy}
                style={visibilitySelectStyle}
              >
                <option value="partner_wide">partnerweit</option>
                <option value="strict_local">nur lokal</option>
              </select>
              <span style={visibilitySelectChevronStyle} aria-hidden="true">▾</span>
            </div>
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
  border: '1px solid #99f6b4',
  borderRadius: '12px',
  background: 'rgb(72, 107, 122)',
  padding: '14px 16px',
  display: 'grid',
  gap: '12px',
  marginBottom: '8px',
};

const visibilityControlsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
  width: '100%',
};

const visibilityHeadStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700,
  color: '#f8fafc',
};

const visibilityAreaStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  color: '#ffffff',
};

const visibilityLabelStyle: React.CSSProperties = {
  display: 'block',
  flex: '1 1 420px',
};

const visibilitySelectWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const visibilitySelectStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  minHeight: '40px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.35)',
  background: '#ffffff',
  color: '#0f172a',
  padding: '0 40px 0 12px',
  fontSize: '13px',
  fontWeight: 600,
  minWidth: '320px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const visibilitySelectChevronStyle: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '14px',
  lineHeight: 1,
  color: '#475569',
  pointerEvents: 'none',
};

const visibilityHintStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.5,
  color: 'rgba(248, 250, 252, 0.88)',
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
