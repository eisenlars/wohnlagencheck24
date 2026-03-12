import type { CSSProperties } from 'react';

export type DisplayTextClass = 'general' | 'data_driven' | 'market_expert' | 'profile' | 'marketing';

export function resolveDisplayTextClass(sectionKey: string, sourceType: string): DisplayTextClass {
  const normalizedType = String(sourceType ?? '').trim().toLowerCase();
  const normalizedKey = String(sectionKey ?? '').trim().toLowerCase();
  if (normalizedType === 'marketing') return 'marketing';
  if (normalizedType === 'general') return 'general';
  if (normalizedType === 'data_driven') return 'data_driven';
  if (normalizedType === 'individual') {
    if (normalizedKey.startsWith('berater_') || normalizedKey.startsWith('makler_')) return 'profile';
    return 'market_expert';
  }
  return 'general';
}

export function displayTextClassLabel(displayClass: DisplayTextClass): string {
  if (displayClass === 'general') return 'General';
  if (displayClass === 'data_driven') return 'Data-Driven';
  if (displayClass === 'profile') return 'Profile';
  if (displayClass === 'marketing') return 'Marketing';
  return 'Market Expert';
}

export function displayTextBadgeStyle(displayClass: DisplayTextClass): CSSProperties {
  return {
    fontSize: 10,
    lineHeight: 1,
    padding: '4px 8px',
    borderRadius: 999,
    border:
      displayClass === 'general'
        ? '1px solid #cbd5e1'
        : displayClass === 'data_driven'
          ? '1px solid #86efac'
          : displayClass === 'profile'
            ? '1px solid #bfdbfe'
            : displayClass === 'marketing'
              ? '1px solid #7dd3fc'
              : '1px solid #fde68a',
    background:
      displayClass === 'general'
        ? '#f8fafc'
        : displayClass === 'data_driven'
          ? '#f0fdf4'
          : displayClass === 'profile'
            ? '#eff6ff'
            : displayClass === 'marketing'
              ? '#f0f9ff'
              : '#fffbeb',
    color:
      displayClass === 'general'
        ? '#475569'
        : displayClass === 'data_driven'
          ? '#166534'
          : displayClass === 'profile'
            ? '#1d4ed8'
            : displayClass === 'marketing'
              ? '#0369a1'
              : '#92400e',
    fontWeight: 700,
    letterSpacing: '0.01em',
  };
}
