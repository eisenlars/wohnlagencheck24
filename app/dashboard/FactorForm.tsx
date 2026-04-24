// app/dashboard/FactorForm.tsx

'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import FullscreenLoader from '@/components/ui/FullscreenLoader';
import styles from './styles/factor-form.module.css';

export type FactorFormHandle = {
  autoSyncIfDirty: () => Promise<void>;
};

type FactorValues = {
  f01_min: number;
  f01_avg: number;
  f01_max: number;
  f02: number;
  f03: number;
  f04: number;
  f05: number;
  f06: number;
};

type PreviewFactorValues = {
  f01_min: number | null;
  f01_avg: number | null;
  f01_max: number | null;
  f02: number | null;
  f03: number | null;
  f04: number | null;
  f05: number | null;
  f06: number | null;
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
  haus_kaufpreis?: PreviewFactorValues;
  wohnung_kaufpreis?: PreviewFactorValues;
  grundstueck_kaufpreis?: PreviewFactorValues;
  miete_haus?: PreviewFactorValues;
  miete_wohnung?: PreviewFactorValues;
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
const defaultF: FactorValues = { f01_min: 1, f01_avg: 1, f01_max: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 };
const defaultRendite: RenditeValues = {
  mietrendite_etw: 1,
  kaufpreisfaktor_etw: 1,
  mietrendite_efh: 1,
  kaufpreisfaktor_efh: 1,
  mietrendite_mfh: 1,
  kaufpreisfaktor_mfh: 1,
};

function deltaToneClass(value: number): string {
  if (value > 0) return styles.deltaPositive;
  if (value < 0) return styles.deltaNegative;
  return styles.deltaNeutral;
}

function rebuildButtonClass(active: boolean): string {
  return [
    'btn fw-bold ms-auto',
    styles.rebuildButton,
    active ? styles.rebuildButtonActive : styles.rebuildButtonDisabled,
  ].join(' ');
}

function toFactorValue(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeFactorValues(raw: unknown): FactorValues {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const legacyF01 = toFactorValue(source.f01, 1);
  const currentAvg = toFactorValue(source.f01_avg, legacyF01);
  return {
    f01_min: toFactorValue(source.f01_min, currentAvg),
    f01_avg: currentAvg,
    f01_max: toFactorValue(source.f01_max, currentAvg),
    f02: toFactorValue(source.f02, 1),
    f03: toFactorValue(source.f03, 1),
    f04: toFactorValue(source.f04, 1),
    f05: toFactorValue(source.f05, 1),
    f06: toFactorValue(source.f06, 1),
  };
}

function getResultingCurrentRange(
  values: FactorValues,
  previewValues?: PreviewFactorValues | null,
): { min: number; avg: number; max: number } | null {
  const baseMin = previewValues?.f01_min;
  const baseAvg = previewValues?.f01_avg;
  const baseMax = previewValues?.f01_max;
  if (
    typeof baseMin !== 'number'
    || !Number.isFinite(baseMin)
    || typeof baseAvg !== 'number'
    || !Number.isFinite(baseAvg)
    || typeof baseMax !== 'number'
    || !Number.isFinite(baseMax)
  ) {
    return null;
  }
  return {
    min: baseMin * values.f01_min,
    avg: baseAvg * values.f01_avg,
    max: baseMax * values.f01_max,
  };
}

function getFactorRangeError(
  label: string,
  values: FactorValues,
  previewValues?: PreviewFactorValues | null,
): string | null {
  const resultingRange = getResultingCurrentRange(values, previewValues);
  if (resultingRange) {
    if (resultingRange.min > resultingRange.avg) return `${label}: Min darf nicht größer als Avg sein.`;
    if (resultingRange.avg > resultingRange.max) return `${label}: Avg darf nicht größer als Max sein.`;
    return null;
  }
  if (values.f01_min > values.f01_avg) return `${label}: Min darf nicht größer als Avg sein.`;
  if (values.f01_avg > values.f01_max) return `${label}: Avg darf nicht größer als Max sein.`;
  return null;
}

function validateFactorSnapshot(snapshot: FactorSnapshot, previewBase?: PreviewBase | null): string | null {
  return (
    getFactorRangeError('Kauf Haus', snapshot.kauf_haus, previewBase?.haus_kaufpreis)
    ?? getFactorRangeError('Kauf Wohnung', snapshot.kauf_wohnung, previewBase?.wohnung_kaufpreis)
    ?? getFactorRangeError('Kauf Grundstück', snapshot.kauf_grundstueck, previewBase?.grundstueck_kaufpreis)
    ?? getFactorRangeError('Miete Haus', snapshot.miete_haus, previewBase?.miete_haus)
    ?? getFactorRangeError('Miete Wohnung', snapshot.miete_wohnung, previewBase?.miete_wohnung)
  );
}

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
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="fw-semibold text-dark">{label}</span>
      </div>
      <div className="row g-2 align-items-center">
        <div className={showActivate ? 'col' : 'col-12'}>
          <div className={`d-flex justify-content-between mb-2 ${styles.rangeTicks}`}>
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
            className="w-100"
          />
          <div className={`mt-2 ${styles.factorMetaText}`}>
            Basis {baseLabel} · Δ {displayDelta} → <span className="fw-bold text-dark">Index {displayIndex}</span>
          </div>
        </div>
        {showActivate && isDirty ? (
          <div className="col-auto">
            <button
              onClick={() => onActivate?.(delta)}
              className={`btn fw-bold text-nowrap ${styles.activateButton}`}
            >
              Aktivieren
            </button>
          </div>
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
  previewBase?: PreviewFactorValues;
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
  const factorKeys: Array<keyof FactorValues> = ['f02', 'f03', 'f04', 'f05', 'f06'];
  const rangeError = getFactorRangeError(title, data, previewBase);
  return (
    <div className="py-3">
      <h5 className={styles.factorGridTitle}>{title}</h5>
      <div className={`${styles.factorPanel} ${styles.factorPanelCurrent}`}>
        <div className={styles.factorGroupLabel}>Aktuelles Jahr</div>
        <InputRow
          label={`${yearLabelByFactor.f01} · Min`}
          value={data.f01_min}
          onChange={(v) => {
            setter({ ...data, f01_min: v });
          }}
          previewBase={previewBase?.f01_min}
          unitLabel={unitLabel}
          showActivate={showActivate}
          onActivate={onActivate}
          isDirty={Number(data?.f01_min) !== Number(persistedData?.f01_min)}
          fmt={fmt}
        />
        <InputRow
          label={`${yearLabelByFactor.f01} · Avg`}
          value={data.f01_avg}
          onChange={(v) => {
            setter({ ...data, f01_avg: v });
          }}
          previewBase={previewBase?.f01_avg}
          unitLabel={unitLabel}
          showActivate={showActivate}
          onActivate={onActivate}
          isDirty={Number(data?.f01_avg) !== Number(persistedData?.f01_avg)}
          fmt={fmt}
        />
        <InputRow
          label={`${yearLabelByFactor.f01} · Max`}
          value={data.f01_max}
          onChange={(v) => {
            setter({ ...data, f01_max: v });
          }}
          previewBase={previewBase?.f01_max}
          unitLabel={unitLabel}
          showActivate={showActivate}
          onActivate={onActivate}
          isDirty={Number(data?.f01_max) !== Number(persistedData?.f01_max)}
          fmt={fmt}
        />
        {rangeError ? <div className={styles.factorRangeError}>{rangeError}</div> : null}
      </div>
      <div className={`${styles.factorPanel} ${styles.factorPanelHistory}`}>
        <div className={styles.factorGroupLabel}>Vorjahre</div>
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
  const deltaClassName = deltaToneClass(deltaPercent);

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
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="fw-semibold text-dark">{label}</span>
      </div>

      <div className="row g-2 align-items-center">
        <div className="col-auto">
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
            className={`form-control ${styles.factorNumberInput}`}
          />
        </div>
        {showActivate && isDirty ? (
          <div className="col">
            <button
              onClick={() => onActivate?.(numericValue)}
              className={`btn fw-bold text-nowrap ${styles.activateButton}`}
            >
              Aktivieren
            </button>
          </div>
        ) : null}
      </div>

      <div className={`mt-2 ${styles.factorMetaText}`}>
        {typeof previewBase === 'number' ? (
          <>
            Basis {fmt(previewBase)}{unitLabel ? ` ${unitLabel}` : ''} · Neu {fmt(previewBase * numericValue)}{unitLabel ? ` ${unitLabel}` : ''} ·{" "}
            <span className={`fw-bold ${deltaClassName}`}>
              {deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(1)}%
            </span>
            <div className={`mt-1 ${styles.factorHintText}`}>
              Basis = Originalwert (vor Faktorisierung)
            </div>
          </>
        ) : (
          <span className={`fw-bold ${deltaClassName}`}>
            Änderung ggü. Basis: {deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

const FactorForm = forwardRef<FactorFormHandle, {
  config: PartnerAreaConfig;
  workspaceTitle?: string;
  onLoadingChange?: (loading: boolean) => void;
}>(function FactorForm({ config, workspaceTitle, onLoadingChange }, ref) {
  const supabase = createClient();
  const [message, setMessage] = useState('');
  const [rebuildMessage, setRebuildMessage] = useState('');
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
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
  const [lastRebuiltFactors, setLastRebuiltFactors] = useState(
    makeFactorSnapshot(defaultSf, defaultTrend, defaultF, defaultF, defaultF, defaultF, defaultF, defaultRendite),
  );
  const isLoading = settingsLoading || previewLoading;
  const currentFactors = useMemo(
    () => makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite),
    [sf, trend, kh, kw, kg, mh, mw, rendite],
  );
  const factorValidationError = useMemo(
    () => validateFactorSnapshot(currentFactors, previewBase),
    [currentFactors, previewBase],
  );
  const hasFactorChanges = useMemo(
    () => JSON.stringify(currentFactors) !== JSON.stringify(persistedFactors),
    [currentFactors, persistedFactors],
  );
  const hasPendingRebuild = useMemo(
    () => JSON.stringify(currentFactors) !== JSON.stringify(lastRebuiltFactors),
    [currentFactors, lastRebuiltFactors],
  );
  const canRebuild = !factorValidationError && (hasFactorChanges || hasPendingRebuild);

  useEffect(() => {
    if (!onLoadingChange) return;
    if (isLoading) {
      onLoadingChange(true);
      return;
    }

    let cancelled = false;
    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        if (!cancelled) onLoadingChange(false);
      });
    });

    return () => {
      cancelled = true;
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [isLoading, onLoadingChange]);

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
      setSettingsLoading(true);
      try {
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
          const nextKh = normalizeFactorValues(data.kauf_haus);
          const nextKw = normalizeFactorValues(data.kauf_wohnung);
          const nextKg = normalizeFactorValues(data.kauf_grundstueck);
          const nextMh = normalizeFactorValues(data.miete_haus);
          const nextMw = normalizeFactorValues(data.miete_wohnung);
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
          setLastRebuiltFactors(snapshot);
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
          setLastRebuiltFactors(snapshot);
          lastPropagatedRef.current = snapshot;
        }
        loadedRef.current = true;
      } finally {
        if (alive) setSettingsLoading(false);
      }
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
      const validationError = validateFactorSnapshot(factors, previewBase);
      if (validationError) {
        setMessage(`❌ ${validationError}`);
        return false;
      }
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
      if (!error) {
        const { data: mapRows, error: mapError } = await supabase
          .from('partner_area_map')
          .select('area_id')
          .eq('auth_user_id', userId);
        if (mapError) {
          return { rowsCount: rows?.length ?? 0, updatesCount: 0, error: mapError.message };
        }
        ortIds = (mapRows ?? [])
          .map((r) => String((r as { area_id?: string }).area_id ?? ''))
          .filter((id: string) => id.startsWith(`${areaId}-`));

        // Fallback: falls die Mapping-Tabelle unvollständig ist, Ortslagen direkt aus areas via ID-Hierarchie auflösen.
        if (ortIds.length === 0) {
          const bundeslandSlug = String(config?.areas?.bundesland_slug ?? '').trim();
          let areasQuery = supabase
            .from('areas')
            .select('id')
            .like('id', `${areaId}-%`);
          if (bundeslandSlug) {
            areasQuery = areasQuery.eq('bundesland_slug', bundeslandSlug);
          }
          const { data: areaRows, error: areaError } = await areasQuery;
          if (areaError) {
            return { rowsCount: rows?.length ?? 0, updatesCount: 0, error: areaError.message };
          }
          ortIds = (areaRows ?? [])
            .map((row) => String((row as { id?: string | null }).id ?? '').trim())
            .filter((id) => id.length > 0);
        }

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

      if (ortIds.length > 0) {
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
      const yearKeys: Array<keyof FactorValues> = ['f01_min', 'f01_avg', 'f01_max', 'f02', 'f03', 'f04', 'f05', 'f06'];
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
            const rowGroup = row[key] as Record<string, unknown> | undefined;
            const currentValRaw = rowGroup?.[yearKey];
            const currentVal = currentValRaw === undefined || currentValRaw === null ? null : Number(currentValRaw);
            if (!force && prevVal === nextVal && currentVal !== null && !Number.isNaN(currentVal)) continue;
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
        const rebuiltSnapshot = makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite);
        setPersistedFactors(rebuiltSnapshot);
        setLastRebuiltFactors(rebuiltSnapshot);
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
      const reset = <T extends Record<string, number>>(obj: T): T => {
        const n = { ...obj };
        (Object.keys(n) as Array<keyof T>).forEach((k) => {
          n[k] = 1 as T[keyof T];
        });
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
      const reset = <T extends Record<string, number>>(obj: T): T => {
        const n = { ...obj };
        (Object.keys(n) as Array<keyof T>).forEach((k) => {
          n[k] = 1 as T[keyof T];
        });
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
    if (factorValidationError) {
      setMessage(`❌ ${factorValidationError}`);
      return;
    }
    setBusyStep('Ortslage speichern…', 1, 1);
    const saved = await saveSettings();
    if (saved) {
      setPersistedFactors(makeFactorSnapshot(sf, trend, kh, kw, kg, mh, mw, rendite));
      setSaveModalMessage('Ortslage gespeichert ✓');
      setSaveModalOpen(true);
    }
  };

  const handleKreisActivate = async () => {
    if (factorValidationError) {
      setMessage(`❌ ${factorValidationError}`);
      return;
    }
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
    <div className="d-flex flex-column gap-4 position-relative">
      {!onLoadingChange && isLoading ? (
        <FullscreenLoader show label="Faktoren werden geladen..." fixed={false} />
      ) : null}
      {workspaceTitle ? (
        <div className="d-flex flex-column gap-1">
          <h2 className="m-0 fs-4 fw-bold text-dark">{workspaceTitle}</h2>
        </div>
      ) : null}
      
      {/* 1. Markttrends */}
      {!isOrtslage ? (
        <details open className="bg-white border rounded-4 shadow-sm px-4 py-3">
          <summary className={`fw-bold fs-5 text-dark py-2 ${styles.sectionSummary}`}>Markttrends & Basis</summary>
          <div className="row row-cols-1 row-cols-xl-2 g-5 py-4">
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
      <details className="bg-white border rounded-4 shadow-sm px-4 py-3">
        <summary className={`fw-bold fs-5 text-dark py-2 ${styles.sectionSummary}`}>Kaufpreis-Faktoren</summary>
        <div className="row row-cols-1 row-cols-xl-3 g-5 py-4">
          <div className="col">
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
          </div>
          <div className="col">
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
          </div>
          <div className="col">
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
        </div>
      </details>

      {/* 3. Mietpreise */}
      <details className="bg-white border rounded-4 shadow-sm px-4 py-3">
        <summary className={`fw-bold fs-5 text-dark py-2 ${styles.sectionSummary}`}>Mietpreis-Faktoren</summary>
        <div className="row row-cols-1 row-cols-xl-2 g-5 py-4">
          <div className="col">
            <FactorGrid
              title="Miete Häuser"
              data={mh}
              setter={setMh}
              previewBase={previewBase?.miete_haus}
              unitLabel="€/m²"
              showActivate={showActivate}
              onActivate={handleActivate}
              persistedData={persistedFactors.miete_haus}
              yearLabelByFactor={yearLabelByFactor}
              fmt={fmt}
            />
          </div>
          <div className="col">
            <FactorGrid
              title="Miete Wohnungen"
              data={mw}
              setter={setMw}
              previewBase={previewBase?.miete_wohnung}
              unitLabel="€/m²"
              showActivate={showActivate}
              onActivate={handleActivate}
              persistedData={persistedFactors.miete_wohnung}
              yearLabelByFactor={yearLabelByFactor}
              fmt={fmt}
            />
          </div>
        </div>
      </details>

      {/* 4. Rendite */}
      <details className="bg-white border rounded-4 shadow-sm px-4 py-3">
        <summary className={`fw-bold fs-5 text-dark py-2 ${styles.sectionSummary}`}>Rendite & Indizes</summary>
        <div className="row row-cols-1 row-cols-xl-2 g-5 py-4">
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
      <details className="bg-white border rounded-4 shadow-sm px-4 py-3">
        <summary className={`fw-bold fs-5 text-dark py-2 ${styles.sectionSummary}`}>Standortbewertung</summary>
        <div className="row row-cols-1 row-cols-xl-2 g-5 py-4">
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

      {saveModalOpen ? (
        <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${styles.modalBackdrop}`}>
          <div className={`bg-white rounded-4 p-4 text-center shadow ${styles.modalDialog}`}>
            <div className="fw-bold fs-5 mb-2 text-dark">
              {saveModalMessage || 'Gespeichert ✓'}
            </div>
            <button
              onClick={() => setSaveModalOpen(false)}
              className="btn btn-light border fw-bold mt-3"
            >
              Schließen
            </button>
          </div>
        </div>
      ) : null}
      {resetModalOpen ? (
        <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${styles.modalBackdrop}`}>
          <div className={`bg-white rounded-4 p-4 text-center shadow ${styles.modalDialog}`}>
            <div className="fw-bold fs-5 mb-2 text-dark">
              {resetModalMessage || 'Zurückgesetzt ✓'}
            </div>
            <button
              onClick={() => setResetModalOpen(false)}
              className="btn btn-light border fw-bold mt-3"
            >
              Schließen
            </button>
          </div>
        </div>
      ) : null}
      {isBusy ? (
        <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${styles.busyBackdrop}`}>
          <div className={`bg-white rounded-4 p-4 text-center shadow d-flex flex-column align-items-center gap-3 ${styles.busyDialog}`}>
            <div className={styles.resetSpinner} />
            <div className="fw-bold text-dark">
              {busyStepLabel ? `Schritt ${busyStepIndex}/${busyStepTotal}: ${busyStepLabel}` : 'Bitte warten…'}
            </div>
            <div className={styles.factorHintText}>
              Änderungen werden übernommen. Bitte nicht schließen.
            </div>
          </div>
        </div>
      ) : null}
      {rebuildSuccessOpen ? (
        <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${styles.modalBackdrop}`}>
          <div className={`bg-white rounded-4 p-4 text-center shadow ${styles.modalDialog}`}>
            <div className="fw-bold fs-5 mb-2 text-dark">
              ✅ Erfolgreich Live-geschalten. Bitte prüfen Sie Ihre Berichtseiten.
            </div>
            <button
              onClick={() => setRebuildSuccessOpen(false)}
              className="btn btn-light border fw-bold mt-3"
            >
              Schließen
            </button>
          </div>
        </div>
      ) : null}
      {/* Kommentar & Footer */}
      <div className="mt-4">
        <label className={`form-label fw-bold ${styles.commentLabel}`}>Warum wurden diese Änderungen vorgenommen? (Optional)</label>
        <textarea 
          value={comment} onChange={(e) => setComment(e.target.value)}
          className={`form-control ${styles.commentTextarea}`} placeholder="Ihre Begründung für die Redaktion..."
        />
      </div>

      <div className="mt-4 p-4 border-top d-flex align-items-center gap-3 bg-light rounded-4 flex-wrap">
        <button onClick={handleReset} className="btn btn-outline-danger fw-bold px-4 py-3">🔄 Zurücksetzen</button>
        {isKreis ? (
          <button onClick={handleGlobalReset} className="btn btn-outline-danger fw-bold px-4 py-3">🌐 Global zurücksetzen</button>
        ) : null}
        <div className="flex-grow-1"></div>
        {rebuildMessage && null}
        {/* Upload-Summary bewusst ausgeblendet */}
        {factorValidationError ? <span className={styles.validationMessage}>⚠ {factorValidationError}</span> : null}
        {message ? (
          <span className={`fw-bold fs-5 ${message.startsWith('❌') ? styles.messageError : styles.messageSuccess}`}>
            {message}
          </span>
        ) : null}
        <button
          onClick={handleRebuild}
          disabled={rebuildLoading || !canRebuild}
          className={rebuildButtonClass(!rebuildLoading && canRebuild)}
        >
          {rebuildLoading ? 'Neuberechnung & Liveschaltung…' : '🔁 Neu berechnen & live schalten'}
        </button>
      </div>
    </div>
  );
});

export default FactorForm;
