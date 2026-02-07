// app/dashboard/FactorForm.tsx

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type FactorFormHandle = {
  autoSyncIfDirty: () => Promise<void>;
};

const FactorForm = forwardRef<FactorFormHandle, { config: any }>(function FactorForm({ config }, ref) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [rebuildMessage, setRebuildMessage] = useState('');
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBase, setPreviewBase] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string>('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [rebuildSuccessOpen, setRebuildSuccessOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const syncTimerRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const lastPropagatedRef = useRef<any | null>(null);

  const defaultSf = { gesundheit: 1, bildung: 1, nahversorgung: 1, mobilitaet: 1, lebenserhaltungskosten: 1, arbeitsplatz: 1, naherholung: 1 };
  const defaultTrend = { immobilienmarkt: 0, mietmarkt: 0 };
  const defaultF = { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 };
  const defaultRendite = {
    mietrendite_etw: 1, kaufpreisfaktor_etw: 1,
    mietrendite_efh: 1, kaufpreisfaktor_efh: 1,
    mietrendite_mfh: 1, kaufpreisfaktor_mfh: 1
  };

  const makeFactorSnapshot = (
    nextSf = defaultSf,
    nextTrend = defaultTrend,
    nextKh = defaultF,
    nextKw = defaultF,
    nextKg = defaultF,
    nextMh = defaultF,
    nextMw = defaultF,
    nextRendite = defaultRendite,
  ) => ({
    standortfaktoren: nextSf,
    immobilienmarkt_trend: nextTrend,
    kauf_haus: nextKh,
    kauf_wohnung: nextKw,
    kauf_grundstueck: nextKg,
    miete_haus: nextMh,
    miete_wohnung: nextMw,
    rendite: nextRendite,
  });

  // States basierend auf deinen Datenbankvorgaben
  const [sf, setSf] = useState(defaultSf);
  const [trend, setTrend] = useState(defaultTrend);
  const [kh, setKh] = useState(defaultF);
  const [kw, setKw] = useState(defaultF);
  const [kg, setKg] = useState(defaultF);
  const [mh, setMh] = useState(defaultF);
  const [mw, setMw] = useState(defaultF);
  const [rendite, setRendite] = useState(defaultRendite);
  const [persistedFactors, setPersistedFactors] = useState(
    makeFactorSnapshot(defaultSf, defaultTrend, defaultF, defaultF, defaultF, defaultF, defaultF, defaultRendite),
  );

  useImperativeHandle(ref, () => ({
    autoSyncIfDirty: async () => {
      const areaId = String(config?.area_id ?? '');
      const isKreis = areaId.split('-').length <= 3;
      if (!isKreis || !userId || !loadedRef.current) return;
      const currentSnapshot = makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
      const changed =
        JSON.stringify(persistedFactors.kauf_haus) !== JSON.stringify(currentSnapshot.kauf_haus) ||
        JSON.stringify(persistedFactors.kauf_wohnung) !== JSON.stringify(currentSnapshot.kauf_wohnung) ||
        JSON.stringify(persistedFactors.kauf_grundstueck) !== JSON.stringify(currentSnapshot.kauf_grundstueck) ||
        JSON.stringify(persistedFactors.miete_haus) !== JSON.stringify(currentSnapshot.miete_haus) ||
        JSON.stringify(persistedFactors.miete_wohnung) !== JSON.stringify(currentSnapshot.miete_wohnung);
      if (!changed) return;
      const saved = await saveSettings();
      if (!saved) return;
      setPersistedFactors(currentSnapshot);
      await triggerOrtslagenSync(currentSnapshot);
    },
  }));

  useEffect(() => {
    let alive = true;
    async function loadSettings() {
      if (!config?.area_id) return;
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data, error } = await supabase
        .from('data_value_settings')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('area_id', config.area_id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setMessage('❌ Fehler beim Laden: ' + error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setSettingsId(data.id ?? null);
        const nextSf = data.standortfaktoren || defaultSf;
        const rawTrend = data.immobilienmarkt_trend || defaultTrend;
        const nextTrend = {
          immobilienmarkt: Number(rawTrend?.immobilienmarkt) === 1 ? 0 : Number(rawTrend?.immobilienmarkt ?? 0),
          mietmarkt: Number(rawTrend?.mietmarkt) === 1 ? 0 : Number(rawTrend?.mietmarkt ?? 0),
        };
        const nextKh = data.kauf_haus || defaultF;
        const nextKw = data.kauf_wohnung || defaultF;
        const nextKg = data.kauf_grundstueck || defaultF;
        const nextMh = data.miete_haus || defaultF;
        const nextMw = data.miete_wohnung || defaultF;
        const nextRendite = data.rendite || defaultRendite;
        setSf(nextSf);
        setTrend(nextTrend);
        setKh(nextKh);
        setKw(nextKw);
        setKg(nextKg);
        setMh(nextMh);
        setMw(nextMw);
        setRendite(nextRendite);
        const snapshot = makeFactorSnapshot(nextSf, nextTrend, nextKh, nextKw, nextKg, nextMh, nextMw, nextRendite);
        setPersistedFactors(snapshot);
        lastPropagatedRef.current = snapshot;
      } else {
        setSettingsId(null);
        setSf(defaultSf);
        setTrend(defaultTrend);
        setKh(defaultF);
        setKw(defaultF);
        setKg(defaultF);
        setMh(defaultF);
        setMw(defaultF);
        setRendite(defaultRendite);
        const snapshot = makeFactorSnapshot(defaultSf, defaultTrend, defaultF, defaultF, defaultF, defaultF, defaultF, defaultRendite);
        setPersistedFactors(snapshot);
        lastPropagatedRef.current = snapshot;
      }
      setLoading(false);
      loadedRef.current = true;
    }
    loadSettings();
    return () => { alive = false; };
  }, [config, supabase]);

  useEffect(() => {
    let alive = true;
    async function loadPreview() {
      if (!config?.area_id) return;
      setPreviewLoading(true);
      try {
        const scope = config.area_id.split('-').length > 3 ? 'ortslage' : 'kreis';
        const res = await fetch('/api/preview-region-values', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area_id: config.area_id, scope }),
        });
        const data = await res.json();
        if (!alive) return;
        if (res.ok) setPreviewBase(data);
      } finally {
        if (alive) setPreviewLoading(false);
      }
    }
    loadPreview();
    return () => { alive = false; };
  }, [config?.area_id]);

  const saveSettings = async (snapshot?: any) => {
    setLoading(true);
    setMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage('❌ Fehler: nicht eingeloggt.');
      setLoading(false);
      return false;
    }

    const factors = snapshot ?? makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
    const payload = {
      auth_user_id: user.id,
      area_id: config.area_id,
      standortfaktoren: factors.standortfaktoren,
      immobilienmarkt_trend: factors.immobilienmarkt_trend,
      kauf_haus: factors.kauf_haus,
      kauf_wohnung: factors.kauf_wohnung,
      kauf_grundstueck: factors.kauf_grundstueck,
      miete_haus: factors.miete_haus,
      miete_wohnung: factors.miete_wohnung,
      rendite: factors.rendite,
    };

    let error = null;
    if (settingsId) {
      const res = await supabase
        .from('data_value_settings')
        .update(payload)
        .eq('id', settingsId);
      error = res.error;
    } else {
      const res = await supabase
        .from('data_value_settings')
        .upsert(payload, { onConflict: 'auth_user_id,area_id' })
        .select('id')
        .single();
      error = res.error;
      if (!error && res.data?.id) setSettingsId(res.data.id);
    }

    if (error) { setMessage('❌ Fehler: ' + error.message); }
    setLoading(false);
    return !error;
  };

  const syncOrtslagenFactors = async (userId: string, prevSnapshot: any, nextSnapshot: any, force = false) => {
    const areaId = String(config?.area_id ?? '');
    const isKreis = areaId.split('-').length <= 3;
    if (!isKreis) return { rowsCount: 0, updatesCount: 0, error: null };

    let { data: rows, error } = await supabase
      .from('data_value_settings')
      .select('id, area_id, kauf_haus, kauf_wohnung, kauf_grundstueck, miete_haus, miete_wohnung')
      .eq('auth_user_id', userId)
      .like('area_id', `${areaId}-%`);

    if ((!rows || rows.length === 0) && !error) {
      const { data: mapRows, error: mapError } = await supabase
        .from('partner_area_map')
        .select('area_id')
        .eq('auth_user_id', userId);
      if (mapError) {
        return { rowsCount: 0, updatesCount: 0, error: mapError.message };
      }
      const ortIds = (mapRows ?? [])
        .map((r: any) => String(r.area_id ?? ''))
        .filter((id: string) => id.startsWith(`${areaId}-`));
      if (ortIds.length > 0) {
        const res = await supabase
          .from('data_value_settings')
          .select('id, area_id, kauf_haus, kauf_wohnung, kauf_grundstueck, miete_haus, miete_wohnung')
          .eq('auth_user_id', userId)
          .in('area_id', ortIds);
        rows = res.data ?? rows;
        error = res.error ?? error;
      }
    }

    if (error || !rows || rows.length === 0) {
      return { rowsCount: rows?.length ?? 0, updatesCount: 0, error: error?.message ?? null };
    }

    const groups = ['kauf_haus', 'kauf_wohnung', 'kauf_grundstueck', 'miete_haus', 'miete_wohnung'];
    const yearKeys = ['f01', 'f02', 'f03', 'f04', 'f05', 'f06'];
    const updates: any[] = [];

    for (const row of rows) {
      if (row.area_id === areaId) continue;
      let changed = false;
      const update: any = { id: row.id };

      for (const key of groups) {
        for (const yearKey of yearKeys) {
          const prevVal = Number(prevSnapshot?.[key]?.[yearKey] ?? 1);
          const nextVal = Number(nextSnapshot?.[key]?.[yearKey] ?? 1);
          if (prevVal === nextVal) continue;
          const currentValRaw = (row as any)?.[key]?.[yearKey];
          const currentVal = currentValRaw === undefined || currentValRaw === null ? null : Number(currentValRaw);
          if (force || currentVal === null || Number.isNaN(currentVal) || currentVal === prevVal || currentVal === 1) {
            update[key] = { ...((row as any)[key] ?? {}), [yearKey]: nextVal };
            changed = true;
          }
        }
      }

      if (changed && update.id) updates.push(update);
    }

    if (updates.length > 0) {
      let updated = 0;
      for (const update of updates) {
        const { id, ...payload } = update;
        const { error: updateError } = await supabase
          .from('data_value_settings')
          .update(payload)
          .eq('id', id);
        if (updateError) {
          return { rowsCount: rows.length, updatesCount: updated, error: updateError.message };
        }
        updated += 1;
      }
      return { rowsCount: rows.length, updatesCount: updated, error: null };
    }
    return { rowsCount: rows.length, updatesCount: 0, error: null };
  };

  const triggerOrtslagenSync = async (overrideSnapshot?: any, force = false) => {
    const areaId = String(config?.area_id ?? '');
    const isKreis = areaId.split('-').length <= 3;
    if (!isKreis || !userId || !loadedRef.current) return;
    const prevSnapshot = lastPropagatedRef.current;
    const nextSnapshot = overrideSnapshot ?? makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
    if (!prevSnapshot) return;
    const same =
      JSON.stringify(prevSnapshot.kauf_haus) === JSON.stringify(nextSnapshot.kauf_haus) &&
      JSON.stringify(prevSnapshot.kauf_wohnung) === JSON.stringify(nextSnapshot.kauf_wohnung) &&
      JSON.stringify(prevSnapshot.kauf_grundstueck) === JSON.stringify(nextSnapshot.kauf_grundstueck) &&
      JSON.stringify(prevSnapshot.miete_haus) === JSON.stringify(nextSnapshot.miete_haus) &&
      JSON.stringify(prevSnapshot.miete_wohnung) === JSON.stringify(nextSnapshot.miete_wohnung);
    if (same) return;
    setSyncInfo('Ortslagen werden übernommen…');
    const res = await syncOrtslagenFactors(userId, prevSnapshot, nextSnapshot, force);
    lastPropagatedRef.current = nextSnapshot;
    if (res?.error) {
      setSyncInfo(`❌ Ortslagen-Update fehlgeschlagen: ${res.error}`);
    } else {
      setSyncInfo(`Ortslagen übernommen ✓ (${res?.updatesCount ?? 0}/${res?.rowsCount ?? 0})`);
    }
    return res;
  };

  const scheduleOrtslagenSync = () => {
    const areaId = String(config?.area_id ?? '');
    const isKreis = areaId.split('-').length <= 3;
    if (!isKreis || !userId || !loadedRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      triggerOrtslagenSync();
      syncTimerRef.current = null;
    }, 350);
  };

  const handleRebuild = async () => {
    if (!config?.area_id) return;
    const previousFactors = persistedFactors;
    const saved = await saveSettings();
    if (!saved) return;
    setRebuildLoading(true);
    setRebuildMessage('Neuberechnung & Liveschaltung läuft...');
    try {
      const scope = config.area_id.split('-').length > 3 ? 'ortslage' : 'kreis';
      const nextSnapshot = makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncOrtslagenFactors(user.id, previousFactors, nextSnapshot);
      }
      const res = await fetch('/api/rebuild-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: config.area_id, scope }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRebuildMessage(`❌ ${data?.error ?? 'Fehler beim Start.'}`);
      } else {
        setRebuildMessage('✅ Erfolgreich Live-geschalten. Bitte prüfen Sie Ihre Berichtseiten.');
        setRebuildSuccessOpen(true);
        setPersistedFactors(makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite));
      }
    } catch (error: any) {
      setRebuildMessage(`❌ ${error?.message ?? 'Fehler beim Start.'}`);
    } finally {
      setRebuildLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("Möchten Sie alle Werte dieses Gebiets auf 1.0 zurücksetzen?")) {
      const reset = (obj: any) => {
        const n = { ...obj };
        Object.keys(n).forEach(k => n[k] = 1);
        return n;
      };
      const nextSf = reset(sf);
      const nextTrend = reset(trend);
      const nextKh = reset(kh);
      const nextKw = reset(kw);
      const nextKg = reset(kg);
      const nextMh = reset(mh);
      const nextMw = reset(mw);
      const nextRendite = reset(rendite);
      setSf(nextSf);
      setTrend(nextTrend);
      setKh(nextKh);
      setKw(nextKw);
      setKg(nextKg);
      setMh(nextMh);
      setMw(nextMw);
      setRendite(nextRendite);
      if (isOrtslage) {
        void (async () => {
          const nextSnapshot = makeFactorSnapshot(nextSf, nextTrend, nextKh, nextKw, nextKg, nextMh, nextMw, nextRendite);
          const saved = await saveSettings(nextSnapshot);
          if (saved) {
            setPersistedFactors(nextSnapshot);
            setResetModalOpen(true);
          }
        })();
      } else {
        void (async () => {
          const nextSnapshot = makeFactorSnapshot(nextSf, nextTrend, nextKh, nextKw, nextKg, nextMh, nextMw, nextRendite);
          const saved = await saveSettings(nextSnapshot);
          if (saved) {
            setPersistedFactors(nextSnapshot);
            await triggerOrtslagenSync(nextSnapshot, true);
            setResetModalOpen(true);
          }
        })();
      }
    }
  };

  const isOrtslage = String(config?.area_id ?? '').split('-').length > 3;
  const isKreis = !isOrtslage;

  const handleOrtslageActivate = async () => {
    const saved = await saveSettings();
    if (saved) {
      setPersistedFactors(makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite));
      setSaveModalOpen(true);
    }
  };

  const handleKreisActivate = async () => {
    const saved = await saveSettings();
    if (!saved) return;
    const nextSnapshot = makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
    setPersistedFactors(nextSnapshot);
    await triggerOrtslagenSync(nextSnapshot);
    setSaveModalOpen(true);
  };

  const showActivate = true;
  const handleActivate = isOrtslage ? handleOrtslageActivate : handleKreisActivate;

  const TrendRow = ({
    label,
    value,
    onChange,
    showActivate,
    onActivate,
    isDirty,
    baseValue,
  }: any) => {
    const base = typeof baseValue === 'number' ? baseValue : 0;
    const delta = Math.round(Number(value) || 0);
    const currentIndex = Math.max(-100, Math.min(100, base + delta));
    const displayIndex = currentIndex.toFixed(1).replace('.', ',');
    const displayDelta = delta > 0 ? `+${delta}` : `${delta}`;
    const baseLabel = typeof baseValue === 'number' ? baseValue.toFixed(1).replace('.', ',') : '—';
    return (
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c' }}>{label}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Index {displayIndex}</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showActivate ? '1fr 140px' : '1fr',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
              <span>-100</span>
              <span>-50</span>
              <span>0</span>
              <span>+50</span>
              <span>+100</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={currentIndex}
              onChange={(e) => onChange(Number(e.target.value) - base)}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
              Basis {baseLabel} · Δ {displayDelta}
            </div>
          </div>
          {showActivate && isDirty ? (
            <button
              onClick={() => onActivate?.(delta)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '2px solid #2b6cb0',
                backgroundColor: '#2b6cb0',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Aktivieren
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  // VERBESSERTE INPUT-ZEILE: Wert + Vorschau
  const InputRow = ({
    label,
    value,
    onChange,
    previewBase,
    unitLabel = "",
    onActivate,
    showActivate,
    isDirty,
  }: any) => {
    const numericValue = typeof value === 'number' ? value : 1;
    const deltaPercent = (numericValue - 1) * 100;
    const deltaColor = deltaPercent > 0 ? '#166534' : deltaPercent < 0 ? '#b91c1c' : '#64748b';

    const setValue = (raw: any) => {
      const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
      if (!Number.isFinite(parsed)) return;
      const newVal = Math.min(5.0, Math.max(0.1, Math.round(parsed * 100) / 100));
      onChange(newVal);
    };

    return (
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c' }}>{label}</span>
        </div>
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showActivate ? '140px 1fr' : '140px',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <input
            type="number"
            min={0.1}
            max={5.0}
            step={0.01}
            value={Number.isFinite(numericValue) ? numericValue.toFixed(2) : ''}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '2px solid #2b6cb0',
              fontSize: '18px',
              fontWeight: 700,
              color: '#2b6cb0',
              backgroundColor: '#ebf8ff',
              textAlign: 'center',
              appearance: 'textfield',
              WebkitAppearance: 'none',
              MozAppearance: 'textfield',
            }}
          />
          {showActivate && isDirty ? (
            <button
              onClick={() => onActivate?.(numericValue)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '2px solid #2b6cb0',
                backgroundColor: '#2b6cb0',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Aktivieren
            </button>
          ) : null}
        </div>

        <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
          {typeof previewBase === 'number' ? (
            <>
              Basis {fmt(previewBase)}{unitLabel ? ` ${unitLabel}` : ''} · Neu {fmt(previewBase * numericValue)}{unitLabel ? ` ${unitLabel}` : ''} ·{" "}
              <span style={{ color: deltaColor, fontWeight: 700 }}>
                {deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(1)}%
              </span>
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                Basis = Originalwert (vor Faktorisierung)
              </div>
            </>
          ) : (
            <span style={{ color: deltaColor, fontWeight: 700 }}>
              Änderung ggü. Basis: {deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  const currentYear = new Date().getFullYear();
  const yearLabelByFactor: Record<string, string> = {
    f01: `${currentYear} (aktuell)`,
    f02: `${currentYear - 1}`,
    f03: `${currentYear - 2}`,
    f04: `${currentYear - 3}`,
    f05: `${currentYear - 4}`,
    f06: `${currentYear - 5}`,
  };

  const FactorGrid = ({ title, data, setter, previewBase, unitLabel, onActivate, showActivate, persistedData }: any) => (
    <div style={{ padding: '15px 0' }}>
      <h5 style={gridTitleStyle}>{title}</h5>
      {['f01', 'f02', 'f03', 'f04', 'f05', 'f06'].map(f => (
        <InputRow
          key={f}
          label={yearLabelByFactor[f] ?? f}
          value={data[f]}
          onChange={(v: any) => setter({...data, [f]: v})}
          previewBase={previewBase?.[f]}
          unitLabel={unitLabel}
          showActivate={showActivate}
          onActivate={onActivate}
          isDirty={Number(data?.[f]) !== Number(persistedData?.[f])}
        />
      ))}
    </div>
  );

  const fmt = (v: any, digits = 3) => (typeof v === 'number' ? v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      <style jsx global>{`
        input[type='number']::-webkit-inner-spin-button,
        input[type='number']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type='number'] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      
      {/* 1. Markttrends */}
      {!isOrtslage ? (
        <details open style={sectionStyle}>
          <summary style={summaryStyle}>📈 Markttrends & Basis</summary>
          <div style={gridStyle}>
            <TrendRow
              label="Trend Immobilienmarkt"
              value={trend.immobilienmarkt}
              onChange={(v:any) => setTrend({...trend, immobilienmarkt: v})}
              showActivate={showActivate}
              onActivate={handleActivate}
              isDirty={Number(trend.immobilienmarkt) !== Number(persistedFactors.immobilienmarkt_trend?.immobilienmarkt)}
              baseValue={previewBase?.immobilienmarkt_index}
            />
            <TrendRow
              label="Trend Mietmarkt"
              value={trend.mietmarkt}
              onChange={(v:any) => setTrend({...trend, mietmarkt: v})}
              showActivate={showActivate}
              onActivate={handleActivate}
              isDirty={Number(trend.mietmarkt) !== Number(persistedFactors.immobilienmarkt_trend?.mietmarkt)}
              baseValue={previewBase?.mietmarkt_index}
            />
          </div>
        </details>
      ) : null}

      {/* 2. Kaufpreise */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>💰 Kaufpreis-Faktoren</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '50px', padding: '25px 0' }}>
          <FactorGrid
            title="Häuser"
            data={kh}
            setter={setKh}
            previewBase={previewBase?.haus_kaufpreis}
            unitLabel="€/m²"
            showActivate={showActivate}
            onActivate={handleActivate}
            persistedData={persistedFactors.kauf_haus}
          />
          <FactorGrid
            title="Wohnungen"
            data={kw}
            setter={setKw}
            previewBase={previewBase?.wohnung_kaufpreis}
            unitLabel="€/m²"
            showActivate={showActivate}
            onActivate={handleActivate}
            persistedData={persistedFactors.kauf_wohnung}
          />
          <FactorGrid
            title="Grundstücke"
            data={kg}
            setter={setKg}
            previewBase={previewBase?.grundstueck_kaufpreis}
            unitLabel="€/m²"
            showActivate={showActivate}
            onActivate={handleActivate}
            persistedData={persistedFactors.kauf_grundstueck}
          />
        </div>
      </details>

      {/* 3. Mietpreise */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>🏠 Mietpreis-Faktoren</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', padding: '25px 0' }}>
          <FactorGrid
            title="Miete Häuser"
            data={mh}
            setter={setMh}
            previewBase={previewBase?.miete_haus_avg}
            unitLabel="€/m²"
            showActivate={showActivate}
            onActivate={handleActivate}
            persistedData={persistedFactors.miete_haus}
          />
          <FactorGrid
            title="Miete Wohnungen"
            data={mw}
            setter={setMw}
            previewBase={previewBase?.miete_wohnung_avg}
            unitLabel="€/m²"
            showActivate={showActivate}
            onActivate={handleActivate}
            persistedData={persistedFactors.miete_wohnung}
          />
        </div>
      </details>

      {/* 4. Rendite */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>📊 Rendite & Indizes</summary>
        <div style={gridStyle}>
          <InputRow
            label="Mietrendite ETW"
            value={rendite.mietrendite_etw}
            onChange={(v:any) => setRendite({...rendite, mietrendite_etw: v})}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.mietrendite_etw) !== Number(persistedFactors.rendite?.mietrendite_etw)}
          />
          <InputRow
            label="Kaufpreisfaktor ETW"
            value={rendite.kaufpreisfaktor_etw}
            onChange={(v:any) => setRendite({...rendite, kaufpreisfaktor_etw: v})}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.kaufpreisfaktor_etw) !== Number(persistedFactors.rendite?.kaufpreisfaktor_etw)}
          />
          <InputRow
            label="Mietrendite EFH"
            value={rendite.mietrendite_efh}
            onChange={(v:any) => setRendite({...rendite, mietrendite_efh: v})}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.mietrendite_efh) !== Number(persistedFactors.rendite?.mietrendite_efh)}
          />
          <InputRow
            label="Kaufpreisfaktor EFH"
            value={rendite.kaufpreisfaktor_efh}
            onChange={(v:any) => setRendite({...rendite, kaufpreisfaktor_efh: v})}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.kaufpreisfaktor_efh) !== Number(persistedFactors.rendite?.kaufpreisfaktor_efh)}
          />
          <InputRow
            label="Mietrendite MFH"
            value={rendite.mietrendite_mfh}
            onChange={(v:any) => setRendite({...rendite, mietrendite_mfh: v})}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.mietrendite_mfh) !== Number(persistedFactors.rendite?.mietrendite_mfh)}
          />
          <InputRow
            label="Kaufpreisfaktor MFH"
            value={rendite.kaufpreisfaktor_mfh}
            onChange={(v:any) => setRendite({...rendite, kaufpreisfaktor_mfh: v})}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.kaufpreisfaktor_mfh) !== Number(persistedFactors.rendite?.kaufpreisfaktor_mfh)}
          />
        </div>
      </details>

      {/* 5. Standortfaktoren */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>📍 Standortbewertung</summary>
        <div style={gridStyle}>
          {(Object.keys(defaultSf) as Array<keyof typeof defaultSf>).map((key) => (
            <InputRow
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={sf[key]}
              onChange={(v:any) => setSf({ ...sf, [key]: v })}
              showActivate={showActivate}
              onActivate={handleActivate}
              isDirty={Number(sf[key]) !== Number(persistedFactors.standortfaktoren?.[key])}
            />
          ))}
        </div>
      </details>

      {previewLoading ? <div style={{ color: '#64748b' }}>Lade Basiswerte…</div> : null}
      {saveModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '24px 28px',
              minWidth: '320px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#0f172a' }}>Gespeichert ✓</div>
            <button
              onClick={() => setSaveModalOpen(false)}
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e0',
                background: '#f8fafc',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      ) : null}
      {resetModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '24px 28px',
              minWidth: '320px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#0f172a' }}>
              Zurückgesetzt ✓
            </div>
            <button
              onClick={() => setResetModalOpen(false)}
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e0',
                background: '#f8fafc',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      ) : null}
      {rebuildSuccessOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '24px 28px',
              minWidth: '320px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#0f172a' }}>
              ✅ Erfolgreich Live-geschalten. Bitte prüfen Sie Ihre Berichtseiten.
            </div>
            <button
              onClick={() => setRebuildSuccessOpen(false)}
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e0',
                background: '#f8fafc',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      ) : null}
      {/* Kommentar & Footer */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#4a5568' }}>Warum wurden diese Änderungen vorgenommen? (Optional)</label>
        <textarea 
          value={comment} onChange={(e) => setComment(e.target.value)}
          style={textareaStyle} placeholder="Ihre Begründung für die Redaktion..."
        />
      </div>

      <div style={footerStyle}>
        <button onClick={handleReset} style={resetButtonStyle}>🔄 Zurücksetzen</button>
        <div style={{ flex: 1 }}></div>
        {rebuildMessage && null}
        {/* Upload-Summary bewusst ausgeblendet */}
        {message && <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#2f855a' }}>{message}</span>}
        <button onClick={handleRebuild} disabled={rebuildLoading} style={rebuildButtonStyle(rebuildLoading)}>
          {rebuildLoading ? 'Neuberechnung & Liveschaltung…' : '🔁 Neu berechnen & live schalten'}
        </button>
      </div>
    </div>
  );
});

export default FactorForm;

// --- STYLES FÜR GROSSE DARSTELLUNG ---

const sectionStyle = {
  backgroundColor: '#fff', border: '1px solid #cbd5e0', borderRadius: '15px',
  padding: '15px 25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
};

const summaryStyle = {
  fontWeight: '800', fontSize: '19px', color: '#2d3748', cursor: 'pointer', outline: 'none', padding: '10px 0'
};

const gridStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', padding: '25px 0'
};

const gridTitleStyle = {
  borderBottom: '3px solid #2d3748', marginBottom: '20px', paddingBottom: '8px', 
  color: '#2d3748', fontSize: '15px', textTransform: 'uppercase' as const, letterSpacing: '1px'
};

const stepButtonStyle = {
  width: '50px', height: '50px', backgroundColor: '#edf2f7', border: 'none', 
  borderRadius: '8px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3748'
};

const textareaStyle = {
  width: '100%', minHeight: '100px', padding: '15px', borderRadius: '10px', 
  border: '2px solid #cbd5e0', marginTop: '10px', fontSize: '16px', fontFamily: 'inherit'
};

const footerStyle = {
  marginTop: '30px', padding: '30px', borderTop: '2px solid #e2e8f0', 
  display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#f7fafc', borderRadius: '15px'
};

const rebuildButtonStyle = (loading: boolean) => ({
  padding: '14px 22px',
  backgroundColor: loading ? '#e2e8f0' : '#0f766e',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer'
});

const resetButtonStyle = {
  padding: '15px 25px', backgroundColor: 'transparent', color: '#e53e3e',
  border: '2px solid #feb2b2', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
};
