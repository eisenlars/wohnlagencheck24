import type { FormatKind, UnitKey } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

export type BarModel = {
  categories: string[];
  series: Array<{
    key: string;
    label: string;
    values: Array<number | null>;
  }>;
  unitKey: UnitKey;
  valueKind: FormatKind;
};

type UnitFromJson =
  | "pricePerSqm"
  | "rentPerSqm"
  | "percent"
  | "totalCount"
  | "points"
  | "none"
  | string;

function jsonUnitToUnitKey(u: UnitFromJson | null | undefined): UnitKey {
  const s = String(u ?? "").trim();
  if (!s) return "none";
  if (s === "pricePerSqm") return "eur_per_sqm";
  if (s === "rentPerSqm") return "eur_per_sqm";
  if (s === "percent") return "percent";
  if (s === "points") return "points";
  if (s === "totalCount") return "count";
  if (s === "none") return "none";
  return "none";
}

type BuildBarModelOptions = {
  valueKind: FormatKind;

  // Optional override
  unitKey?: UnitKey;

  // If your label key is known (e.g. "jahr"), you can fix it; otherwise we use the first key of each row
  labelKey?: string;

  // If series keys are known, you can fix order; otherwise inferred
  seriesKeys?: string[];

  // human labels for series
  seriesLabelMap?: Record<string, string>;

  // ignore keys (default includes "einheit")
  ignoreKeys?: string[];

  // remove empty series (all null)
  removeEmptySeries?: boolean;

  // remove categories where all series are null
  removeEmptyCategories?: boolean;
};

export function buildBarModel(raw: unknown, opts: BuildBarModelOptions): BarModel {
  const {
    valueKind,

    unitKey,

    labelKey,
    seriesKeys,
    seriesLabelMap = {},

    ignoreKeys = ["einheit"],
    removeEmptySeries = true,
    removeEmptyCategories = false,
  } = opts;

  const rows = Array.isArray(raw) ? raw.filter((x) => x && typeof x === "object") as any[] : [];
  if (!rows.length) {
    return { categories: [], series: [], unitKey: unitKey ?? "none", valueKind };
  }

  // infer unit
  const inferredUnitKey =
    unitKey ??
    jsonUnitToUnitKey(rows[0]?.einheit);

  // infer labelKey: "first property"
  const firstRowKeys = Object.keys(rows[0] ?? {});
  const inferredLabelKey = labelKey ?? firstRowKeys.find((k) => !ignoreKeys.includes(k)) ?? "label";

  // infer series keys: everything except labelKey and ignore
  const inferredSeriesKeys = Array.from(
    new Set(
      rows.flatMap((r) =>
        Object.keys(r).filter((k) => k !== inferredLabelKey && !ignoreKeys.includes(k)),
      ),
    ),
  );

  const keys = seriesKeys?.length ? seriesKeys.filter((k) => inferredSeriesKeys.includes(k)) : inferredSeriesKeys;

  const categories = rows.map((r) => String(r?.[inferredLabelKey] ?? "").trim()).filter(Boolean);

  const series = keys.map((k) => ({
    key: k,
    label: seriesLabelMap[k] ?? k,
    values: rows.map((r) => toNumberOrNull(r?.[k])),
  }));

  // Option: remove empty series
  const series2 = removeEmptySeries
    ? series.filter((s) => s.values.some((v) => typeof v === "number" && Number.isFinite(v)))
    : series;

  // Option: remove empty categories
  if (removeEmptyCategories) {
    const keepIdx: number[] = [];
    for (let i = 0; i < categories.length; i++) {
      const hasAny = series2.some((s) => typeof s.values[i] === "number" && Number.isFinite(s.values[i] as number));
      if (hasAny) keepIdx.push(i);
    }

    return {
      categories: keepIdx.map((i) => categories[i]),
      series: series2.map((s) => ({ ...s, values: keepIdx.map((i) => s.values[i]) })),
      unitKey: inferredUnitKey,
      valueKind,
    };
  }

  return { categories, series: series2, unitKey: inferredUnitKey, valueKind };
}
