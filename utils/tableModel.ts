import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import type { MatrixColumn, MatrixModel } from "@/components/MatrixTable";

type UnitFromJson =
  | "pricePerSqm"
  | "rentPerSqm"
  | "percent"
  | "points"
  | "none"
  | string;

type BuildTableModelOptions = {
  // Formatting defaults
  kind: FormatKind;
  ctx?: FormatContext;

  // JSON-to-unit mapping (optional override)
  unitKey?: UnitKey;

  // Identify row label field for wide-tables (default: "preisinfo_label")
  rowLabelKey?: string;
  rowLabelHeader?: string;

  // Key-value list mode fields (default: labelField="preisinfo_label", valueField="preis")
  labelField?: string;
  valueField?: string;

  // Keys to ignore in column inference
  ignoreKeys?: string[];

  // Optional: Map data keys to nice labels
  columnLabelMap?: Record<string, string>;

  // Optional: Column ordering (if omitted, inferred order)
  columnOrder?: string[];

  // If you want to force a mode:
  mode?: "auto" | "wide" | "keyValue";

  // If highlight should typically target a column label (e.g. "Ø Preis")
  defaultHighlightColLabel?: string;

  // Auto remove empties
  removeEmptyRows?: boolean;
  removeEmptyColumns?: boolean;
};

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function jsonUnitToUnitKey(u: UnitFromJson | null | undefined): UnitKey {
  const s = String(u ?? "").trim();
  if (!s) return "none";

  // Your JSON examples:
  if (s === "pricePerSqm") return "eur_per_sqm";
  if (s === "rentPerSqm") return "eur_per_sqm";
  if (s === "percent") return "percent";
  if (s === "points") return "points";
  if (s === "none") return "none";

  // fallback
  return "none";
}

function isFiniteValue(v: unknown) {
  const n = toNumberOrNull(v);
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Central model builder:
 * - auto-detects WIDE vs KEYVALUE table
 * - builds dynamic columns + rows
 */
export function buildTableModel(raw: unknown, opts: BuildTableModelOptions): MatrixModel & {
  highlightColLabel?: string;
} {
  const {
    kind,
    ctx = "table",

    unitKey,

    rowLabelKey = "preisinfo_label",
    rowLabelHeader = "",

    labelField = "preisinfo_label",
    valueField = "preis",

    ignoreKeys = ["einheit"],

    columnLabelMap = {},
    columnOrder,

    mode = "auto",

    defaultHighlightColLabel,

    removeEmptyRows = true,
    removeEmptyColumns = true,
  } = opts;

  const rows = Array.isArray(raw) ? raw.filter((x) => x && typeof x === "object") as any[] : [];
  if (!rows.length) return { rows: [], columns: [], rowLabelKey: undefined, rowLabelHeader: undefined };

  // Decide unitKey:
  const inferredUnitKey =
    unitKey ??
    jsonUnitToUnitKey((rows[0] as any)?.einheit);

  // Detect keyValue pattern:
  const looksKeyValue =
    rows.every((r) => (labelField in r) && (valueField in r)) &&
    rows.every((r) => {
      // besides label/value/einheit there should be little else
      const ks = Object.keys(r).filter((k) => ![labelField, valueField, ...ignoreKeys].includes(k));
      return ks.length === 0;
    });

  // Detect wide pattern:
  const looksWide =
    rows.every((r) => rowLabelKey in r) &&
    rows.some((r) => {
      const keys = Object.keys(r).filter((k) => ![rowLabelKey, ...ignoreKeys].includes(k));
      return keys.some((k) => isFiniteValue((r as any)[k]));
    });

  const decidedMode =
    mode === "auto"
      ? (looksKeyValue ? "keyValue" : "wide")
      : mode;

  if (decidedMode === "keyValue") {
    // Build ONE row with dynamic columns = labels
    const colsRaw = rows
      .map((r) => String((r as any)?.[labelField] ?? "").trim())
      .filter((s) => s.length > 0);

    const colLabelsUnique = Array.from(new Set(colsRaw));

    const colKeys = (columnOrder?.length ? columnOrder : colLabelsUnique);

    // single row object: { "Ø Deutschland": 123, "Ø Sachsen": 234, ... }
    const rowObj: Record<string, any> = {};
    for (const r of rows) {
      const label = String((r as any)?.[labelField] ?? "").trim();
      if (!label) continue;
      rowObj[label] = toNumberOrNull((r as any)?.[valueField]);
    }

    let columns: MatrixColumn[] = colKeys.map((k) => ({
      key: k,
      label: columnLabelMap[k] ?? k,
      kind,
      unitKey: inferredUnitKey,
      ctx,
    }));

    // remove empty columns
    if (removeEmptyColumns) {
      columns = columns.filter((c) => isFiniteValue(rowObj[c.key]));
    }

    const hasAny = columns.some((c) => isFiniteValue(rowObj[c.key]));
    const outRows = hasAny ? [rowObj] : [];

    return {
      rows: outRows,
      columns,
      // IMPORTANT: no rowLabelKey => Requirement 2 satisfied
      rowLabelKey: undefined,
      rowLabelHeader: undefined,
      highlightColLabel: defaultHighlightColLabel,
    };
  }

  // WIDE mode
  // infer columns from union of keys across all rows (excluding label + ignore keys)
  const allKeys = new Set<string>();
  for (const r of rows) {
    Object.keys(r).forEach((k) => {
      if (k === rowLabelKey) return;
      if (ignoreKeys.includes(k)) return;
      allKeys.add(k);
    });
  }

  let colKeys = Array.from(allKeys);

  // optional order
  if (columnOrder?.length) {
    const ordered = columnOrder.filter((k) => allKeys.has(k));
    const rest = colKeys.filter((k) => !ordered.includes(k));
    colKeys = [...ordered, ...rest];
  }

  let columns: MatrixColumn[] = colKeys.map((k) => ({
    key: k,
    label: columnLabelMap[k] ?? k,
    kind,
    unitKey: inferredUnitKey,
    ctx,
  }));

  // build rows normalized
  let outRows: Array<Record<string, any>> = rows
    .map((r) => {
      const label = String((r as any)?.[rowLabelKey] ?? "").trim();
      const obj: Record<string, any> = { [rowLabelKey]: label };
      for (const ck of colKeys) obj[ck] = toNumberOrNull((r as any)?.[ck]);
      return obj;
    })
    .filter((r) => String(r[rowLabelKey]).length > 0);

  // remove empty columns (based on outRows)
  if (removeEmptyColumns) {
    columns = columns.filter((c) => outRows.some((rr) => isFiniteValue((rr as any)[c.key])));
  }

  // remove empty rows (based on visible columns)
  if (removeEmptyRows) {
    outRows = outRows.filter((rr) => columns.some((c) => isFiniteValue((rr as any)[c.key])));
  }

  return {
    rows: outRows,
    columns,
    rowLabelKey,
    rowLabelHeader,
    highlightColLabel: defaultHighlightColLabel,
  };
}
