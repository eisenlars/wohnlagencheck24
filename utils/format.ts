// utils/format.ts

export type FormatContext = "kpi" | "table" | "chart";

export type FormatKind =
  | "kaufpreis_qm"
  | "grundstueck_qm"
  | "miete_qm"
  | "flaeche"
  | "currency"
  | "quote"
  | "anzahl"
  | "index"
  | "distance_km"
  | "distance_m";

export type UnitKey =
  | "eur_per_sqm"
  | "eur"
  | "percent"
  | "points"
  | "count"
  | "ha"
  | "km"
  | "m"
  | "none";

type FormatLocaleOptions = {
  locale?: string;
  numberLocale?: string;
  currencyCode?: string;
};

const UNIT_LABEL: Record<UnitKey, string> = {
  eur_per_sqm: "€ / m²",
  eur: "€",
  percent: "%",
  points: "Punkte",
  count: "",      // bewusst leer: "Personen" etc. wäre fachlich falsch, es sind Haushalte
  ha: "ha",
  km: "km",
  m: "m",
  none: "",
};

function resolveIntlLocale(options?: FormatLocaleOptions): string {
  const direct = String(options?.numberLocale ?? "").trim();
  if (direct) return direct;
  const locale = String(options?.locale ?? "").trim().toLowerCase();
  if (!locale || locale === "de") return "de-DE";
  if (locale === "en") return "en-US";
  return locale;
}

function resolveCurrencyCode(options?: FormatLocaleOptions): string {
  const code = String(options?.currencyCode ?? "").trim().toUpperCase();
  return code || "EUR";
}

function getCurrencySymbol(options?: FormatLocaleOptions): string {
  const parts = new Intl.NumberFormat(resolveIntlLocale(options), {
    style: "currency",
    currency: resolveCurrencyCode(options),
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(1);
  return parts.find((part) => part.type === "currency")?.value ?? resolveCurrencyCode(options);
}

export function getUnitLabel(unit: UnitKey, options?: FormatLocaleOptions): string {
  if (unit === "eur") return getCurrencySymbol(options);
  if (unit === "eur_per_sqm") return `${getCurrencySymbol(options)} / m²`;
  return UNIT_LABEL[unit] ?? "";
}

type MetricFormatOptions = {
  kind: FormatKind;
  ctx?: FormatContext;
  unit?: UnitKey;
  signed?: boolean;
  nullText?: string;
  fractionDigits?: number;
} & FormatLocaleOptions;

function numberFormatFor(kind: FormatKind, ctx: FormatContext, options?: FormatLocaleOptions): Intl.NumberFormat {
  const intlLocale = resolveIntlLocale(options);
  // zentrale Rundungs-Policy
  if (ctx === "kpi") {
    if (kind === "miete_qm") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
    if (kind === "flaeche") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
    if (kind === "currency") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 });
    if (kind === "quote") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
    if (kind === "index") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
    if (kind === "distance_km") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 });
    if (kind === "distance_m") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
    return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  }

  // table/chart
  if (kind === "miete_qm") return new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (kind === "flaeche") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  if (kind === "currency") return new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (kind === "quote") return new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (kind === "index") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  if (kind === "distance_km") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 });
  if (kind === "distance_m") return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
}

/**
 * Einziger zentraler Formatter für Zahlen + Einheiten.
 */
export function formatMetric(value: number | null, opts: MetricFormatOptions): string {
  const {
    kind,
    ctx = "table",
    unit = "none",
    signed = false,
    nullText = "–",
    fractionDigits,
  } = opts;

  if (value === null || !Number.isFinite(value)) return nullText;

  const intlLocale = resolveIntlLocale(opts);
  const currencyCode = resolveCurrencyCode(opts);

  if (ctx === "kpi" && unit === "eur" && Math.abs(value) >= 1_000_000) {
    const nf = new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    let s = nf.format(value);
    if (signed && value > 0) s = `+${s}`;
    return s;
  }

  if (unit === "eur") {
    const digits = typeof fractionDigits === "number"
      ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }
      : { minimumFractionDigits: 0, maximumFractionDigits: 0 };
    let s = new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      ...digits,
    }).format(value);
    if (signed && value > 0) s = `+${s}`;
    return s;
  }

  const nf = typeof fractionDigits === "number"
    ? new Intl.NumberFormat(intlLocale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    : numberFormatFor(kind, ctx, opts);
  let s = nf.format(value);

  if (signed && value > 0) s = `+${s}`;

  const u = getUnitLabel(unit, opts);
  return u ? `${s} ${u}` : s;
}

/**
 * Convenience: nur Zahl (ohne Einheit) – falls Sie das manchmal brauchen.
 */
export function formatValueCtx(value: number | null, kind: FormatKind, ctx: FormatContext): string {
  return formatMetric(value, { kind, ctx, unit: "none" });
}

export function formatWithUnit(value: number | null, kind: FormatKind, ctx: FormatContext, unit: UnitKey): string {
  return formatMetric(value, { kind, ctx, unit });
}

/**
 * Legacy-Wrapper (fix für Ihren Build-Fehler + schnelle Migration)
 */
export function formatEurPerSqm(value: number | null, kind: "kaufpreis_qm" | "grundstueck_qm" | "miete_qm", ctx: FormatContext = "kpi"): string {
  return formatMetric(value, { kind, ctx, unit: "eur_per_sqm" });
}

/**
 * Prozent formatiert mit Vorzeichen (für Tendenzen)
 */
export function formatPercentSigned(value: number | null, decimals: number = 1, nullText: string = "–", options?: FormatLocaleOptions): string {
  if (value === null || !Number.isFinite(value)) return nullText;
  const nf = new Intl.NumberFormat(resolveIntlLocale(options), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const s = nf.format(value);
  return `${value > 0 ? "+" : ""}${s} %`;
}

/**
 * Index-Helfer (Basisjahr=100)
 */
export function formatIndexDelta(index: number | null, nullText: string = "–", options?: FormatLocaleOptions): string {
  if (index === null || !Number.isFinite(index)) return nullText;
  const delta = index - 100;
  const nf = new Intl.NumberFormat(resolveIntlLocale(options), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const s = nf.format(delta);
  return `Δ ${delta > 0 ? "+" : ""}${s} Punkte`;
}

export function formatIndexFactor(index: number | null, nullText: string = "–", options?: FormatLocaleOptions): string {
  if (index === null || !Number.isFinite(index)) return nullText;
  const factor = index / 100;
  const nf = new Intl.NumberFormat(resolveIntlLocale(options), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `× ${nf.format(factor)}`;
}
