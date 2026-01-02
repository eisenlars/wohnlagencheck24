// utils/buildTableModel.ts
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

// ...types unverändert

export type BuildTableOptions = {
  kind: FormatKind;
  ctx?: FormatContext;
  mode?: BuildTableMode;
  orientation?: BuildOrientation;

  rowLabelKey?: string;
  valueKey?: string;
  rowLabelHeader?: string;

  unitKeyFromRaw?: (rawUnit: unknown) => UnitKey;
  kindFromUnitKey?: (unitKey: UnitKey, fallback: FormatKind) => FormatKind;
  dropEmpty?: boolean;

  // NEU: Spalten-Label-Mapping (wird bei matrix normal genutzt, und bei transpose als Row-Labels)
  columnLabelMap?: Record<string, string>;
};

function defaultKindFromUnit(unitKey: UnitKey, fallback: FormatKind): FormatKind {
  if (unitKey === "percent") return "quote";
  if (unitKey === "points") return "anzahl";
  return fallback;
}

function norm(s: unknown) {
  return String(s ?? "").trim();
}

function hasAnyFinite(rows: Record<string, any>[], key: string): boolean {
  return rows.some((r) => {
    const v = toNumberOrNull(r?.[key]);
    return typeof v === "number" && Number.isFinite(v);
  });
}

export function buildTableModel(
  raw: unknown,
  opts: BuildTableOptions,
): MatrixModel<Record<string, any>> {
  const {
    kind,
    ctx = "table",
    mode = "auto",
    orientation = "normal",
    rowLabelKey = "preisinfo_label",
    valueKey = "preis",
    rowLabelHeader = "Kennzahl",
    unitKeyFromRaw,
    kindFromUnitKey = defaultKindFromUnit,
    dropEmpty = true,
    columnLabelMap,
  } = opts;

  const arr: any[] = Array.isArray(raw) ? raw.filter((x) => x && typeof x === "object") : [];
  if (!arr.length) {
    return {
      rows: [],
      rowLabelKey: "label",
      rowLabelHeader: rowLabelHeader,
      columns: [],
    };
  }

  const looksKeyValue =
    arr.every((it) => rowLabelKey in it) &&
    arr.some((it) => valueKey in it);

  const finalMode: BuildTableMode =
    mode === "auto" ? (looksKeyValue ? "keyValue" : "matrix") : mode;

  // ---------------- keyValue (wie gehabt) ----------------
  if (finalMode === "keyValue") {
    if (orientation === "normal") {
      const rows = arr
        .map((it) => {
          const label = norm(it?.[rowLabelKey]);
          const value = toNumberOrNull(it?.[valueKey]);
          const unitKey = unitKeyFromRaw ? unitKeyFromRaw(it?.einheit) : "none";
          const inferredKind = kindFromUnitKey(unitKey, kind);

          return { __label: label, __value: value, __unitKey: unitKey, __kind: inferredKind };
        })
        .filter((r) => r.__label.length > 0);

      return {
        rowLabelKey: "__label",
        rowLabelHeader,
        columns: [{ key: "__value", label: "Wert", kind, unitKey: "none", ctx }],
        rows,
      };
    }

    // transpose keyValue
    const columns: MatrixModelColumn[] = [];
    const row: Record<string, any> = { __row: "" };

    for (const it of arr) {
      const label = norm(it?.[rowLabelKey]);
      if (!label) continue;

      const key = `col_${label}`;
      const value = toNumberOrNull(it?.[valueKey]);

      const unitKey = unitKeyFromRaw ? unitKeyFromRaw(it?.einheit) : "none";
      const inferredKind = kindFromUnitKey(unitKey, kind);

      columns.push({ key, label, kind: inferredKind, explain: undefined as any, unitKey, ctx } as any);
      row[key] = value;
    }

    const rows = [row];
    const filteredColumns = dropEmpty ? columns.filter((c) => hasAnyFinite(rows, c.key)) : columns;

    return {
      rows: filteredColumns.length ? rows : [],
      rowLabelKey: "__row",
      rowLabelHeader: "", // bleibt leer → MatrixTable blendet 1. Spalte aus
      columns: filteredColumns,
    };
  }

  // ---------------- matrix (klassisch) ----------------
  const rows = arr
    .map((it) => ({ ...it }))
    .filter((r) => norm(r?.[rowLabelKey]).length > 0);

  // Keys sammeln
  const colKeys = new Set<string>();
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (k === rowLabelKey) return;
      if (k === "einheit") return;
      colKeys.add(k);
    });
  });

  // Einheiten/Kind ableiten (typisch überall gleich)
  const unitKey =
    unitKeyFromRaw && rows[0] ? unitKeyFromRaw((rows[0] as any)?.einheit) : "none";
  const inferredKind = kindFromUnitKey(unitKey, kind);

  // --------- NEU: transpose für matrix ---------
  if (orientation === "transpose") {
    // Zeilen (neu) = colKeys (z.B. preis_einfache_lage / reihenhaus)
    // Spalten (neu) = preisinfo_label (min/Ø/max)
    const priceLabels: string[] = rows.map((r) => norm(r?.[rowLabelKey])).filter(Boolean);

    const columns: MatrixModelColumn[] = priceLabels.map((pl) => ({
      key: `col_${pl}`,
      label: pl,
      kind: inferredKind,
      unitKey,
      ctx,
    }));

    const outRows: Record<string, any>[] = Array.from(colKeys).map((k) => {
      const rowObj: Record<string, any> = { __row: columnLabelMap?.[k] ?? k };

      rows.forEach((srcRow) => {
        const pl = norm(srcRow?.[rowLabelKey]);
        rowObj[`col_${pl}`] = toNumberOrNull((srcRow as any)?.[k]);
      });

      return rowObj;
    });

    const filteredColumns =
      dropEmpty ? columns.filter((c) => hasAnyFinite(outRows, c.key)) : columns;

    const filteredRows =
      dropEmpty
        ? outRows.filter((r) => filteredColumns.some((c) => Number.isFinite(toNumberOrNull(r?.[c.key]) as any)))
        : outRows;

    return {
      rows: filteredRows,
      rowLabelKey: "__row",
      rowLabelHeader: rowLabelHeader, // wird in der Page gesetzt: "Lagequalität" oder "Haustyp"
      columns: filteredColumns,
    };
  }

  // --------- normal matrix ---------
  let columns: MatrixModelColumn[] = Array.from(colKeys).map((k) => ({
    key: k,
    label: columnLabelMap?.[k] ?? k,
    kind: inferredKind,
    unitKey,
    ctx,
  }));

  if (dropEmpty) columns = columns.filter((c) => hasAnyFinite(rows, c.key));

  const finalRows =
    dropEmpty && columns.length
      ? rows.filter((r) => columns.some((c) => Number.isFinite(toNumberOrNull(r?.[c.key]) as any)))
      : rows;

  return {
    rows: finalRows,
    rowLabelKey,
    rowLabelHeader,
    columns,
  };
}
