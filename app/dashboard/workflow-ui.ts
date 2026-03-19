import type { CSSProperties } from 'react';

export const workflowPanelCardStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  padding: 18,
  marginBottom: 12,
};

export const workflowCardStackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
};

export const workflowHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

export const workflowHeaderInlineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

export const workflowSelectBaseStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '9px 12px',
  paddingRight: 30,
  height: 42,
  lineHeight: 1.3,
  color: '#0f172a',
  backgroundColor: '#fff',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  boxShadow: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '12px',
  fontWeight: 600,
};

export const workflowInlineFieldStyle: CSSProperties = {
  display: 'flex',
  width: 220,
  flex: '0 0 auto',
};

export const workflowInlineSelectStyle: CSSProperties = {
  ...workflowSelectBaseStyle,
  width: 220,
  minHeight: 36,
  height: 36,
  fontSize: 12,
};

export const workflowClassGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 12,
};

export const workflowClassCardStyle = (active: boolean): CSSProperties => ({
  display: 'grid',
  gap: 10,
  borderRadius: 16,
  border: active ? '1px solid #486b7a' : '1px solid #e2e8f0',
  background: '#ffffff',
  padding: 14,
  cursor: 'pointer',
  textAlign: 'left',
});

export const workflowClassTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

export const workflowClassTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: '#475569',
};

export const workflowClassCycleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: '#0f172a',
  fontWeight: 600,
};

export const workflowClassStatsStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: '#475569',
};

export const workflowClassCostStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: '#0f172a',
};

export const workflowPromptLabelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 11,
  color: '#334155',
  fontWeight: 600,
};

export const workflowPromptTextareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 74,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  fontSize: 12,
  lineHeight: 1.45,
  fontFamily: 'inherit',
  color: '#0f172a',
  backgroundColor: '#fff',
};

export const workflowClassActionRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
};

export const workflowAnchorLinkStyle = (color: string): CSSProperties => ({
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: 13,
  fontWeight: 700,
  color,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
  alignSelf: 'center',
});

export const workflowSectionIntroStyle: CSSProperties = {
  marginTop: '2px',
  marginBottom: '30px',
};

export const workflowSectionIntroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 800,
  color: '#0f172a',
};

export const workflowTabContainerStyle: CSSProperties = {
  display: 'flex',
  backgroundColor: '#fff',
  padding: '8px 8px 0 8px',
  borderRadius: '12px 12px 0 0',
  borderBottom: '1px solid #e2e8f0',
  gap: '6px',
  overflowX: 'auto',
  marginBottom: '20px',
};

export const workflowTabButtonStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  minWidth: '118px',
  padding: '12px 14px',
  border: 'none',
  borderBottom: active ? '3px solid rgb(72, 107, 122)' : '3px solid transparent',
  backgroundColor: active ? '#f1f5f9' : 'transparent',
  color: active ? 'rgb(72, 107, 122)' : '#64748b',
  fontWeight: active ? '700' : '500',
  fontSize: '13px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s',
  borderRadius: '8px 8px 0 0',
});

export const workflowTabIconImageStyle: CSSProperties = {
  width: '22px',
  height: '22px',
  objectFit: 'contain',
  display: 'block',
};

export const workflowTabIconEmojiStyle: CSSProperties = {
  fontSize: '18px',
  lineHeight: 1,
  display: 'block',
};

export const workflowTabLabelStyle: CSSProperties = {
  fontSize: '10px',
  lineHeight: 1.2,
  textAlign: 'center',
};

export const workflowAreaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '290px minmax(0, 1fr)',
  gap: 16,
};

export const workflowAreaListCardStyle: CSSProperties = {
  padding: '0 14px',
  display: 'grid',
  gap: 10,
  alignSelf: 'start',
};

export const workflowAreaListWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

export const workflowAreaListRowStyle = (active: boolean): CSSProperties => ({
  border: active ? '1px solid #486b7a' : '1px solid #dbe4ea',
  borderRadius: 12,
  backgroundColor: active ? '#eef4f6' : '#fff',
  padding: '12px',
  display: 'grid',
  gap: 6,
  cursor: 'pointer',
  textAlign: 'left',
});

export const workflowAreaListRowTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

export const workflowAreaHeadlineStyle: CSSProperties = {
  fontSize: 13,
  color: '#0f172a',
};

export const workflowAreaTypeBadgeStyle = (isAreaChild: boolean): CSSProperties => ({
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  background: isAreaChild ? '#f1f5f9' : '#e2e8f0',
  color: '#475569',
  whiteSpace: 'nowrap',
});

export const workflowAreaMetaLineStyle: CSSProperties = {
  fontSize: 11,
  color: '#64748b',
};

export const workflowAreaContentWrapStyle: CSSProperties = {
  minWidth: 0,
};

export const workflowAreaContentStackStyle: CSSProperties = {
  display: 'grid',
  gap: 0,
  minWidth: 0,
};
