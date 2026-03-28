'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function readSessionViewState<T>(key: string): Partial<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function writeSessionViewState<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

export function useSessionViewState<T extends Record<string, unknown>>(
  key: string,
  initialState: T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [state, setState] = useState<T>(() => ({
    ...initialState,
    ...(readSessionViewState<T>(key) ?? {}),
  }));
  const hydrated = typeof window !== 'undefined';

  useEffect(() => {
    if (!hydrated) return;
    writeSessionViewState(key, state);
  }, [hydrated, key, state]);

  return [state, setState, hydrated];
}

export function storeSessionScroll(key: string, top?: number): void {
  if (typeof window === 'undefined') return;
  const nextTop = Number.isFinite(top) ? Number(top) : window.scrollY;
  writeSessionViewState(key, { top: Math.max(0, Math.round(nextTop)) });
}

export function restoreSessionScroll(key: string): void {
  if (typeof window === 'undefined') return;
  const persisted = readSessionViewState<{ top?: number }>(key);
  const top = Number(persisted?.top);
  if (!Number.isFinite(top) || top < 0) return;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top, behavior: 'auto' });
  });
}
