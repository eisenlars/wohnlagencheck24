// app/dashboard/FactorForm.tsx

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type FactorFormHandle = {
  autoSyncIfDirty: () => Promise<void>;
};

type FactorValues = {
  f01: number;
  f02: number;
  f03: number;
  f04: number;
  f05: number;
  f06: number;
};

type TrendValues = {
  immobilienmarkt: number;
  mietmarkt: number;
};

type StandortFaktoren = {
  gesundheit: number;
  bildung: number;
  nahversorgung: number;
  mobilitaet: number;
  lebenserhaltungskosten: number;
  arbeitsplatz: number;
  naherholung: number;
};

type RenditeValues = {
  mietrendite_etw: number;
  kaufpreisfaktor_etw: number;
  mietrendite_efh: number;
  kaufpreisfaktor_efh: number;
  mietrendite_mfh: number;
  kaufpreisfaktor_mfh: number;
};

type FactorSnapshot = {
  standortfaktoren: StandortFaktoren;
  immobilienmarkt_trend: TrendValues;
  kauf_haus: FactorValues;
  kauf_wohnung: FactorValues;
  kauf_grundstueck: FactorValues;
  miete_haus: FactorValues;
  miete_wohnung: FactorValues;
  rendite: RenditeValues;
};

type PreviewBase = {
  immobilienmarkt_index?: number | null;
  mietmarkt_index?: number | null;
  haus_kaufpreis?: FactorValues;
  wohnung_kaufpreis?: FactorValues;
  grundstueck_kaufpreis?: FactorValues;
  miete_haus_avg?: FactorValues;
  miete_wohnung_avg?: FactorValues;
};

const defaultSf: StandortFaktoren = {
  gesundheit: 1,
  bildung: 1,
  nahversorgung: 1,
  mobilitaet: 1,
  lebenserhaltungskosten: 1,
  arbeitsplatz: 1,
  naherholung: 1,
};
const defaultTrend: TrendValues = { immobilienmarkt: 0, mietmarkt: 0 };
const defaultF: FactorValues = { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 };
const defaultRendite: RenditeValues = {
  mietrendite_etw: 1,
  kaufpreisfaktor_etw: 1,
  mietrendite_efh: 1,
  kaufpreisfaktor_efh: 1,
  mietrendite_mfh: 1,
  kaufpreisfaktor_mfh: 1,
};

const makeFactorSnapshot = (
  nextSf: StandortFaktoren = defaultSf,
  nextTrend: TrendValues = defaultTrend,
  nextKh: FactorValues = defaultF,
  nextKw: FactorValues = defaultF,
  nextKg: FactorValues = defaultF,
  nextMh: FactorValues = defaultF,
  nextMw: FactorValues = defaultF,
  nextRendite: RenditeValues = defaultRendite,
): FactorSnapshot => ({
  standortfaktoren: nextSf,
  immobilienmarkt_trend: nextTrend,
  kauf_haus: nextKh,
  kauf_wohnung: nextKw,
  kauf_grundstueck: nextKg,
  miete_haus: nextMh,
  miete_wohnung: nextMw,
  rendite: nextRendite,
});

type PartnerArea = {
  id?: string;
  name?: string;
  slug?: string;
  parent_slug?: string;
  bundesland_slug?: string;
};

type PartnerAreaConfig = {
  area_id: string;
  areas?: PartnerArea;
  [key: string]: unknown;
};

type TrendRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  showActivate: boolean;
  onActivate?: (delta: number) => void;
  isDirty: boolean;
  baseValue?: number | null;
};

function TrendRow({
  label,
  value,
  onChange,
  showActivate,
  onActivate,
  isDirty,
  baseValue,
}: TrendRowProps) {
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
            Basis {baseLabel} · Δ {displayDelta} → <span style={{ fontWeight: 700, color: '#0f172a' }}>Index {displayIndex}</span>
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
}

type InputRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  previewBase?: number | null;
  unitLabel?: string;
  onActivate?: (value: number) => void;
  showActivate: boolean;
  isDirty: boolean;
  fmt: (v: number | null | undefined, digits?: number) => string;
};

type FactorGridProps = {
  title: string;
  data: FactorValues;
  setter: (next: FactorValues) => void;
  previewBase?: FactorValues;
  unitLabel?: string;
  onActivate?: (value: number) => void;
  showActivate: boolean;
  persistedData: FactorValues;
  yearLabelByFactor: Record<string, string>;
  fmt: (v: number | null | undefined, digits?: number) => string;
};

function FactorGrid({
  title,
  data,
  setter,
  previewBase,
  unitLabel,
  onActivate,
  showActivate,
  persistedData,
  yearLabelByFactor,
  fmt,
}: FactorGridProps) {
  const factorKeys: Array<keyof FactorValues> = ['f01', 'f02', 'f03', 'f04', 'f05', 'f06'];
  return (
    <div style={{ padding: '15px 0' }}>
      <h5 style={gridTitleStyle}>{title}</h5>
      {factorKeys.map((f) => (
        <InputRow
          key={f}
          label={yearLabelByFactor[f] ?? f}
          value={data[f]}
          onChange={(v) => {
            const key = f as keyof FactorValues;
            setter({ ...data, [key]: v });
          }}
          previewBase={previewBase?.[f]}
          unitLabel={unitLabel}
          showActivate={showActivate}
          onActivate={onActivate}
          isDirty={Number(data?.[f]) !== Number(persistedData?.[f])}
          fmt={fmt}
        />
      ))}
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
  previewBase,
  unitLabel = "",
  onActivate,
  showActivate,
  isDirty,
  fmt,
}: InputRowProps) {
  const numericValue = typeof value === 'number' ? value : 1;
  const [draft, setDraft] = useState(
    Number.isFinite(numericValue) ? numericValue.toFixed(2) : '',
  );
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(Number.isFinite(numericValue) ? numericValue.toFixed(2) : '');
    }
  }, [numericValue, isEditing]);

  const deltaPercent = (numericValue - 1) * 100;
  const deltaColor = deltaPercent > 0 ? '#166534' : deltaPercent < 0 ? '#b91c1c' : '#64748b';

  const commitValue = (raw: string) => {
    const parsed = parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(Number.isFinite(numericValue) ? numericValue.toFixed(2) : '');
      return;
    }
    const newVal = Math.min(5.0, Math.max(0.1, Math.round(parsed * 100) / 100));
    onChange(newVal);
    setDraft(newVal.toFixed(2));
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
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          min={0.1}
          max={5.0}
          step={0.01}
          value={draft}
          onPointerDown={(e) => {
            const el = e.currentTarget;
            if (document.activeElement !== el) {
              el.focus({ preventScroll: true });
            }
          }}
          onMouseDown={(e) => {
            const el = e.currentTarget;
            if (document.activeElement !== el) {
              el.focus({ preventScroll: true });
            }
          }}
          onFocus={() => {
            setIsEditing(true);
          }}
          onBlur={() => {
            setIsEditing(false);
            commitValue(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            const parsed = parseFloat(next.replace(',', '.'));
            if (Number.isFinite(parsed)) {
              const newVal = Math.min(5.0, Math.max(0.1, Math.round(parsed * 100) / 100));
              onChange(newVal);
            }
          }}
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
}

const FactorForm = forwardRef<FactorFormHandle, { config: PartnerAreaConfig }>(function FactorForm({ config }, ref) {
  const supabase = createClient();
  const [message, setMessage] = useState('');
  const [rebuildMessage, setRebuildMessage] = useState('');
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBase, setPreviewBase] = useState<PreviewBase | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState('');
  const [rebuildSuccessOpen, setRebuildSuccessOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetModalMessage, setResetModalMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [busyStepLabel, setBusyStepLabel] = useState<string | null>(null);
  const [busyStepIndex, setBusyStepIndex] = useState(0);
  const [busyStepTotal, setBusyStepTotal] = useState(0);
  const busyCountRef = useRef(0);
  const loadedRef = useRef(false);
  const lastPropagatedRef = useRef<FactorSnapshot | null>(null);

  const beginBusy = () => {
    busyCountRef.current += 1;
    if (!isBusy) setIsBusy(true);
  };

  const endBusy = () => {
    busyCountRef.current = Math.max(0, busyCountRef.current - 1);
    if (busyCountRef.current === 0) {
      setIsBusy(false);
      setBusyStepLabel(null);
      setBusyStepIndex(0);
      setBusyStepTotal(0);
    }
  };

  const setBusyStep = (label: string, index: number, total: number) => {
    setBusyStepLabel(label);
    setBusyStepIndex(index);
    setBusyStepTotal(total);
  };

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
      setBusyStep('Kreis speichern…', 1, 2);
      const saved = await saveSettings();
      if (!saved) return;
      setPersistedFactors(currentSnapshot);
      setBusyStep('Ortslagen synchronisieren…', 2, 2);
      await triggerOrtslagenSync(currentSnapshot);
    },
  }));

  useEffect(() => {
    let alive = true;
    async function loadSettings() {
      if (!config?.area_id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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

  const saveSettings = async (snapshot?: FactorSnapshot) => {
    beginBusy();
    setMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage('❌ Fehler: nicht eingeloggt.');
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
      return !error;
    } finally {
      endBusy();
    }
  };

  const syncOrtslagenFactors = async (userId: string, prevSnapshot: FactorSnapshot, nextSnapshot: FactorSnapshot, force = false) => {
    beginBusy();
    const areaId = String(config?.area_id ?? '');
    const isKreis = areaId.split('-').length <= 3;
    if (!isKreis) {
      endBusy();
      return { rowsCount: 0, updatesCount: 0, error: null };
    }

    try {
      let { data: rows, error } = await supabase
        .from('data_value_settings')
        .select('id, area_id, kauf_haus, kauf_wohnung, kauf_grundstueck, miete_haus, miete_wohnung')
        .eq('auth_user_id', userId)
        .like('area_id', `${areaId}-%`);

      let ortIds: string[] = [];
      let missingIds: string[] = [];
      if ((force || (!rows || rows.length === 0)) && !error) {
        const { data: mapRows, error: mapError } = await supabase
          .from('partner_area_map')
          .select('area_id')
          .eq('auth_user_id', userId);
        if (mapError) {
          return { rowsCount: 0, updatesCount: 0, error: mapError.message };
        }
        ortIds = (mapRows ?? [])
          .map((r) => String((r as { area_id?: string }).area_id ?? ''))
          .filter((id: string) => id.startsWith(`${areaId}-`));
        if ((!rows || rows.length === 0) && ortIds.length > 0) {
          const res = await supabase
            .from('data_value_settings')
            .select('id, area_id, kauf_haus, kauf_wohnung, kauf_grundstueck, miete_haus, miete_wohnung')
            .eq('auth_user_id', userId)
            .in('area_id', ortIds);
          rows = res.data ?? rows;
          error = res.error ?? error;
        }
      }

      if (force && ortIds.length > 0) {
        const existingIds = new Set((rows ?? []).map((row) => String((row as { area_id?: string }).area_id ?? "")));
        missingIds = ortIds.filter((id) => !existingIds.has(id));
        if (missingIds.length > 0) {
          const basePayload = {
            auth_user_id: userId,
            kauf_haus: nextSnapshot.kauf_haus,
            kauf_wohnung: nextSnapshot.kauf_wohnung,
            kauf_grundstueck: nextSnapshot.kauf_grundstueck,
            miete_haus: nextSnapshot.miete_haus,
            miete_wohnung: nextSnapshot.miete_wohnung,
          };
          const { error: upsertError } = await supabase
            .from('data_value_settings')
            .upsert(
              missingIds.map((id) => ({ ...basePayload, area_id: id })),
              { onConflict: 'auth_user_id,area_id' },
          );
          if (upsertError) {
            return { rowsCount: rows?.length ?? 0, updatesCount: 0, error: upsertError.message };
          }
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

      const groups: Array<'kauf_haus' | 'kauf_wohnung' | 'kauf_grundstueck' | 'miete_haus' | 'miete_wohnung'> = [
        'kauf_haus',
        'kauf_wohnung',
        'kauf_grundstueck',
        'miete_haus',
        'miete_wohnung',
      ];
      const yearKeys: Array<keyof FactorValues> = ['f01', 'f02', 'f03', 'f04', 'f05', 'f06'];
      type SettingsRow = { id: string; area_id: string } & Record<string, unknown>;
      type UpdateRow = { id: string } & Record<string, unknown>;
      const updates: UpdateRow[] = [];

      for (const rowRaw of rows) {
        const row = rowRaw as SettingsRow;
        if (row.area_id === areaId) continue;
        let changed = false;
        const update: UpdateRow = { id: row.id };

        for (const key of groups) {
          for (const yearKey of yearKeys) {
            const prevGroup = prevSnapshot?.[key] as FactorValues | undefined;
            const nextGroup = nextSnapshot?.[key] as FactorValues | undefined;
            const prevVal = Number(prevGroup?.[yearKey] ?? 1);
            const nextVal = Number(nextGroup?.[yearKey] ?? 1);
            if (!force && prevVal === nextVal) continue;
          const rowGroup = row[key] as Record<string, unknown> | undefined;
          const currentValRaw = rowGroup?.[yearKey];
          const currentVal = currentValRaw === undefined || currentValRaw === null ? null : Number(currentValRaw);
          if (force || currentVal === null || Number.isNaN(currentVal) || currentVal === prevVal || currentVal === 1) {
            const base = (update[key] as Record<string, number> | undefined)
              ?? (row[key] as Record<string, number> | undefined)
              ?? {};
            update[key] = { ...base, [yearKey]: nextVal };
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
    } finally {
      endBusy();
    }
  };

  const triggerOrtslagenSync = async (overrideSnapshot?: FactorSnapshot, force = false) => {
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
    if (same && !force) return;
    const res = await syncOrtslagenFactors(userId, prevSnapshot, nextSnapshot, force);
    lastPropagatedRef.current = nextSnapshot;
    return res;
  };

  const handleRebuild = async () => {
    if (!config?.area_id) return;
    const previousFactors = persistedFactors;
    const isOrtslage = config.area_id.split('-').length > 3;
    const totalSteps = isOrtslage ? 2 : 3;
    setBusyStep(isOrtslage ? 'Ortslage speichern…' : 'Kreis speichern…', 1, totalSteps);
    const saved = await saveSettings();
    if (!saved) return;
    let shouldOpenSuccess = false;
    beginBusy();
    setRebuildLoading(true);
    setRebuildMessage('Neuberechnung & Liveschaltung läuft...');
    try {
      if (!isOrtslage) setBusyStep('Ortslagen synchronisieren…', 2, totalSteps);
      const scope = config.area_id.split('-').length > 3 ? 'ortslage' : 'kreis';
      const nextSnapshot = makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncOrtslagenFactors(user.id, previousFactors, nextSnapshot);
      }
      setBusyStep('Neuberechnung starten…', totalSteps, totalSteps);
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
        shouldOpenSuccess = true;
        setPersistedFactors(makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : null;
      setRebuildMessage(`❌ ${message ?? 'Fehler beim Start.'}`);
    } finally {
      setRebuildLoading(false);
      endBusy();
      if (shouldOpenSuccess) setRebuildSuccessOpen(true);
    }
  };

  const handleReset = async () => {
    if (!confirm("Möchten Sie alle Werte dieses Gebiets auf 1.0 zurücksetzen?")) return;
    let shouldOpen = false;
    let modalMessage = '';
    beginBusy();
    try {
      setBusyStep(isOrtslage ? 'Ortslage speichern…' : 'Kreis speichern…', 1, isOrtslage ? 1 : 2);
      const reset = (obj: Record<string, number>) => {
        const n = { ...obj };
        Object.keys(n).forEach(k => n[k] = 1);
        return n;
      };
      const nextSf = reset(sf);
      const nextTrend = { immobilienmarkt: 0, mietmarkt: 0 };
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
      const nextSnapshot = makeFactorSnapshot(nextSf, nextTrend, nextKh, nextKw, nextKg, nextMh, nextMw, nextRendite);
      const saved = await saveSettings(nextSnapshot);
      if (saved) {
        setPersistedFactors(nextSnapshot);
        if (!isOrtslage) {
          setBusyStep('Ortslagen synchronisieren…', 2, 2);
          await triggerOrtslagenSync(nextSnapshot, true);
          modalMessage = 'Kreis und alle Ortslagen angepasst';
        } else {
          modalMessage = 'Ortslage angepasst';
        }
        shouldOpen = true;
      }
    } finally {
      endBusy();
      if (shouldOpen) {
        setResetModalMessage(modalMessage);
        setResetModalOpen(true);
      }
    }
  };

  const handleGlobalReset = async () => {
    if (!isKreis) return;
    if (!confirm("Achtung: Damit werden alle Faktoren des Kreises und aller Ortslagen auf 1.0 zurückgesetzt. Individuelle Ortslagen-Werte werden überschrieben. Fortfahren?")) {
      return;
    }
    let shouldOpen = false;
    let modalMessage = '';
    beginBusy();
    try {
    setBusyStep('Kreis speichern…', 1, 2);
      const reset = (obj: Record<string, number>) => {
        const n = { ...obj };
        Object.keys(n).forEach(k => n[k] = 1);
        return n;
      };
      const nextSf = reset(sf);
      const nextTrend = { immobilienmarkt: 0, mietmarkt: 0 };
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

      const nextSnapshot = makeFactorSnapshot(nextSf, nextTrend, nextKh, nextKw, nextKg, nextMh, nextMw, nextRendite);
      const saved = await saveSettings(nextSnapshot);
      if (saved) {
        setPersistedFactors(nextSnapshot);
        setBusyStep('Ortslagen synchronisieren…', 2, 2);
        await triggerOrtslagenSync(nextSnapshot, true);
        modalMessage = 'Kreis und alle Ortslagen angepasst';
        shouldOpen = true;
      }
    } finally {
      endBusy();
      if (shouldOpen) {
        setResetModalMessage(modalMessage);
        setResetModalOpen(true);
      }
    }
  };
  const isOrtslage = String(config?.area_id ?? '').split('-').length > 3;
  const isKreis = !isOrtslage;

  const handleOrtslageActivate = async () => {
    setBusyStep('Ortslage speichern…', 1, 1);
    const saved = await saveSettings();
    if (saved) {
      setPersistedFactors(makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite));
      setSaveModalMessage('Ortslage gespeichert ✓');
      setSaveModalOpen(true);
    }
  };

  const handleKreisActivate = async () => {
    setBusyStep('Kreis speichern…', 1, 2);
    const saved = await saveSettings();
    if (!saved) return;
    const nextSnapshot = makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
    setPersistedFactors(nextSnapshot);
    setBusyStep('Ortslagen synchronisieren…', 2, 2);
    await triggerOrtslagenSync(nextSnapshot);
    setSaveModalMessage('Kreis und Ortslagen gespeichert ✓');
    setSaveModalOpen(true);
  };

  const showActivate = true;
  const handleActivate = isOrtslage ? handleOrtslageActivate : handleKreisActivate;

  const currentYear = new Date().getFullYear();
  const yearLabelByFactor: Record<string, string> = {
    f01: `${currentYear} (aktuell)`,
    f02: `${currentYear - 1}`,
    f03: `${currentYear - 2}`,
    f04: `${currentYear - 3}`,
    f05: `${currentYear - 4}`,
    f06: `${currentYear - 5}`,
  };

  const fmt = (v: number | null | undefined, digits = 3) => (typeof v === 'number' ? v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—');

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
        .reset-spinner {
          width: 44px;
          height: 44px;
          border: 4px solid #e2e8f0;
          border-top-color: #486b7a;
          border-right-color: #ffe000;
          border-radius: 50%;
          animation: reset-spin 0.8s linear infinite;
        }
        @keyframes reset-spin {
          to { transform: rotate(360deg); }
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
              onChange={(v) => setTrend({ ...trend, immobilienmarkt: v })}
              showActivate={showActivate}
              onActivate={handleActivate}
              isDirty={Number(trend.immobilienmarkt) !== Number(persistedFactors.immobilienmarkt_trend?.immobilienmarkt)}
              baseValue={previewBase?.immobilienmarkt_index}
            />
            <TrendRow
              label="Trend Mietmarkt"
              value={trend.mietmarkt}
              onChange={(v) => setTrend({ ...trend, mietmarkt: v })}
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
            yearLabelByFactor={yearLabelByFactor}
            fmt={fmt}
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
            yearLabelByFactor={yearLabelByFactor}
            fmt={fmt}
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
            yearLabelByFactor={yearLabelByFactor}
            fmt={fmt}
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
            yearLabelByFactor={yearLabelByFactor}
            fmt={fmt}
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
            yearLabelByFactor={yearLabelByFactor}
            fmt={fmt}
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
            onChange={(v) => setRendite({ ...rendite, mietrendite_etw: v })}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.mietrendite_etw) !== Number(persistedFactors.rendite?.mietrendite_etw)}
            fmt={fmt}
          />
          <InputRow
            label="Kaufpreisfaktor ETW"
            value={rendite.kaufpreisfaktor_etw}
            onChange={(v) => setRendite({ ...rendite, kaufpreisfaktor_etw: v })}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.kaufpreisfaktor_etw) !== Number(persistedFactors.rendite?.kaufpreisfaktor_etw)}
            fmt={fmt}
          />
          <InputRow
            label="Mietrendite EFH"
            value={rendite.mietrendite_efh}
            onChange={(v) => setRendite({ ...rendite, mietrendite_efh: v })}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.mietrendite_efh) !== Number(persistedFactors.rendite?.mietrendite_efh)}
            fmt={fmt}
          />
          <InputRow
            label="Kaufpreisfaktor EFH"
            value={rendite.kaufpreisfaktor_efh}
            onChange={(v) => setRendite({ ...rendite, kaufpreisfaktor_efh: v })}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.kaufpreisfaktor_efh) !== Number(persistedFactors.rendite?.kaufpreisfaktor_efh)}
            fmt={fmt}
          />
          <InputRow
            label="Mietrendite MFH"
            value={rendite.mietrendite_mfh}
            onChange={(v) => setRendite({ ...rendite, mietrendite_mfh: v })}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.mietrendite_mfh) !== Number(persistedFactors.rendite?.mietrendite_mfh)}
            fmt={fmt}
          />
          <InputRow
            label="Kaufpreisfaktor MFH"
            value={rendite.kaufpreisfaktor_mfh}
            onChange={(v) => setRendite({ ...rendite, kaufpreisfaktor_mfh: v })}
            showActivate={showActivate}
            onActivate={handleActivate}
            isDirty={Number(rendite.kaufpreisfaktor_mfh) !== Number(persistedFactors.rendite?.kaufpreisfaktor_mfh)}
            fmt={fmt}
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
              onChange={(v) => setSf({ ...sf, [key]: v })}
              showActivate={showActivate}
              onActivate={handleActivate}
              isDirty={Number(sf[key]) !== Number(persistedFactors.standortfaktoren?.[key])}
              fmt={fmt}
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
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#0f172a' }}>
              {saveModalMessage || 'Gespeichert ✓'}
            </div>
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
              {resetModalMessage || 'Zurückgesetzt ✓'}
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
      {isBusy ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '24px 28px',
              minWidth: '280px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div className="reset-spinner" />
            <div style={{ fontWeight: 700, color: '#0f172a' }}>
              {busyStepLabel ? `Schritt ${busyStepIndex}/${busyStepTotal}: ${busyStepLabel}` : 'Bitte warten…'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Änderungen werden übernommen. Bitte nicht schließen.
            </div>
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
        {isKreis ? (
          <button onClick={handleGlobalReset} style={resetButtonStyle}>🌐 Global zurücksetzen</button>
        ) : null}
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
