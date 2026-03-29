'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';

import type {
  NetworkContentRecord,
  NetworkContentTranslationStatus,
  NetworkContentTranslationView,
} from '@/lib/network-partners/types';

type ContentTranslationsPayload = {
  content?: NetworkContentRecord;
  required_locales?: string[];
  source_snapshot_hash?: string;
  translations?: NetworkContentTranslationView[];
  error?: string;
};

type ContentTranslationsPanelProps = {
  contentItem: NetworkContentRecord | null;
};

export default function ContentTranslationsPanel({ contentItem }: ContentTranslationsPanelProps) {
  const [translations, setTranslations] = useState<NetworkContentTranslationView[]>([]);
  const [requiredLocales, setRequiredLocales] = useState<string[]>([]);
  const [selectedLocale, setSelectedLocale] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [status, setStatus] = useState<NetworkContentTranslationStatus>('edited');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTranslations = useEffectEvent(async (preferredLocale?: string | null) => {
    if (!contentItem) {
      setTranslations([]);
      setRequiredLocales([]);
      setSelectedLocale('');
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/partner/network-content/${encodeURIComponent(contentItem.id)}/translations`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as ContentTranslationsPayload | null;
    if (!response.ok) {
      setTranslations([]);
      setRequiredLocales([]);
      setSelectedLocale('');
      setError(String(payload?.error ?? 'Übersetzungen konnten nicht geladen werden.'));
      setLoading(false);
      return;
    }

    const nextTranslations = Array.isArray(payload?.translations) ? payload.translations : [];
    const nextRequiredLocales = Array.isArray(payload?.required_locales) ? payload.required_locales : [];
    setTranslations(nextTranslations);
    setRequiredLocales(nextRequiredLocales);
    setSelectedLocale((current) => {
      const wanted = preferredLocale ?? current;
      if (wanted && nextTranslations.some((entry) => entry.locale === wanted)) return wanted;
      return nextTranslations.find((entry) => entry.locale !== 'de')?.locale ?? '';
    });
    setLoading(false);
  });

  useEffect(() => {
    void loadTranslations(null);
  }, [contentItem?.id]);

  const selectedTranslation = useMemo(
    () => translations.find((entry) => entry.locale === selectedLocale) ?? null,
    [selectedLocale, translations],
  );

  useEffect(() => {
    setTitle(selectedTranslation?.translated_title ?? '');
    setSummary(selectedTranslation?.translated_summary ?? '');
    setBodyMd(selectedTranslation?.translated_body_md ?? '');
    setStatus(selectedTranslation?.status ?? 'edited');
  }, [selectedTranslation]);

  const canAutofill = contentItem?.content_type === 'property_offer' || contentItem?.content_type === 'property_request';
  const missingRequiredCount = requiredLocales.filter((locale) => {
    if (locale === 'de') return false;
    const row = translations.find((entry) => entry.locale === locale);
    return !row || row.is_stale || !(row.translated_title || row.translated_summary || row.translated_body_md);
  }).length;

  if (!contentItem) {
    return <p style={{ margin: 0, color: '#64748b' }}>Noch kein Content ausgewählt.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <strong style={{ color: '#0f172a' }}>Pflichtsprachen: {requiredLocales.join(', ') || 'de'}</strong>
        <span style={{ color: '#475569' }}>
          Fehlende oder veraltete Pflichtsprachen: {missingRequiredCount}
        </span>
        {message ? <span style={{ color: '#166534', fontWeight: 600 }}>{message}</span> : null}
        {error ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</span> : null}
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
          Zielsprache
          <select
            value={selectedLocale}
            onChange={(event) => setSelectedLocale(event.target.value)}
            style={{
              width: '100%',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              color: '#0f172a',
              background: '#fff',
            }}
          >
            {translations
              .filter((entry) => entry.locale !== 'de')
              .map((entry) => (
                <option key={entry.locale} value={entry.locale}>
                  {entry.locale} {entry.is_required ? '· Pflicht' : ''} {entry.is_stale ? '· stale' : ''}
                </option>
              ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as NetworkContentTranslationStatus)}
            style={{
              width: '100%',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              color: '#0f172a',
              background: '#fff',
            }}
          >
            <option value="machine_generated">machine_generated</option>
            <option value="reviewed">reviewed</option>
            <option value="edited">edited</option>
            <option value="stale">stale</option>
          </select>
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
        Übersetzter Titel
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          style={{
            width: '100%',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            color: '#0f172a',
            background: '#fff',
          }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
        Übersetzte Kurzbeschreibung
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          style={{
            width: '100%',
            minHeight: 96,
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            color: '#0f172a',
            background: '#fff',
          }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
        Übersetzter Inhalt
        <textarea
          value={bodyMd}
          onChange={(event) => setBodyMd(event.target.value)}
          style={{
            width: '100%',
            minHeight: 160,
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            color: '#0f172a',
            background: '#fff',
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!selectedLocale || submitting || loading}
          onClick={async () => {
            if (!selectedLocale) return;
            setSubmitting(true);
            setError(null);
            setMessage(null);
            try {
              const response = await fetch(`/api/partner/network-content/${encodeURIComponent(contentItem.id)}/translations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mode: 'upsert',
                  locale: selectedLocale,
                  translated_title: title,
                  translated_summary: summary,
                  translated_body_md: bodyMd,
                  status,
                }),
              });
              const payload = (await response.json().catch(() => null)) as ContentTranslationsPayload | null;
              if (!response.ok) {
                setError(String(payload?.error ?? 'Übersetzung konnte nicht gespeichert werden.'));
                return;
              }
              setMessage('Übersetzung wurde gespeichert.');
              setTranslations(Array.isArray(payload?.translations) ? payload.translations : []);
              setRequiredLocales(Array.isArray(payload?.required_locales) ? payload.required_locales : []);
            } finally {
              setSubmitting(false);
            }
          }}
          style={{
            borderRadius: 10,
            border: '1px solid #0f766e',
            background: '#0f766e',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.65 : 1,
          }}
        >
          {submitting ? 'Speichert...' : 'Übersetzung speichern'}
        </button>

        {canAutofill ? (
          <>
            <button
              type="button"
              disabled={!selectedLocale || submitting || loading}
              onClick={async () => {
                if (!selectedLocale) return;
                setSubmitting(true);
                setError(null);
                setMessage(null);
                try {
                  const response = await fetch(`/api/partner/network-content/${encodeURIComponent(contentItem.id)}/translations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      mode: 'autofill',
                      locale: selectedLocale,
                    }),
                  });
                  const payload = (await response.json().catch(() => null)) as ContentTranslationsPayload | null;
                  if (!response.ok) {
                    setError(String(payload?.error ?? 'Auto-Vorbelegung konnte nicht erzeugt werden.'));
                    return;
                  }
                  setMessage(`Auto-Vorbelegung für ${selectedLocale} wurde erzeugt.`);
                  setTranslations(Array.isArray(payload?.translations) ? payload.translations : []);
                  setRequiredLocales(Array.isArray(payload?.required_locales) ? payload.required_locales : []);
                } finally {
                  setSubmitting(false);
                }
              }}
              style={{
                borderRadius: 10,
                border: '1px solid #2563eb',
                background: '#2563eb',
                color: '#fff',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.65 : 1,
              }}
            >
              Auto-Vorbelegung für Sprache
            </button>

            <button
              type="button"
              disabled={submitting || loading}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                setMessage(null);
                try {
                  const response = await fetch(`/api/partner/network-content/${encodeURIComponent(contentItem.id)}/translations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      mode: 'autofill',
                      locales: requiredLocales.filter((locale) => locale !== 'de'),
                    }),
                  });
                  const payload = (await response.json().catch(() => null)) as ContentTranslationsPayload | null;
                  if (!response.ok) {
                    setError(String(payload?.error ?? 'Auto-Vorbelegung konnte nicht erzeugt werden.'));
                    return;
                  }
                  setMessage('Auto-Vorbelegung für Pflichtsprachen wurde erzeugt.');
                  setTranslations(Array.isArray(payload?.translations) ? payload.translations : []);
                  setRequiredLocales(Array.isArray(payload?.required_locales) ? payload.required_locales : []);
                } finally {
                  setSubmitting(false);
                }
              }}
              style={{
                borderRadius: 10,
                border: '1px solid #1d4ed8',
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.65 : 1,
              }}
            >
              Pflichtsprachen vorbelegen
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
