// components/MatrixTable.tsx
import React from "react";
import { formatMetric } from "@/utils/format";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

// ---- types ----
export type MatrixColumn = {
  key: string;
  label: string;
  kind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;
};

export type MatrixModel<Row> = {
  rows: Row[];
  rowLabelKey?: keyof Row | string;
  rowLabelHeader?: string;
  columns: MatrixColumn[];
};

// Legacy-Shape: erlaubt key als beliebigen Typ (du castest eh auf String)
export type LegacyMatrixColumn = {
  key: unknown;
  label: string;
  kind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;
};

export type LegacyMatrix<Row> = {
  rows: Row[];
  rowLabelKey: keyof Row | string;
  rowLabelHeader?: string;
  columns: LegacyMatrixColumn[];
};

export type MatrixTableProps<Row> = {
  model?: MatrixModel<Row> | null;
  legacy?: LegacyMatrix<Row> | null;

  headerBg?: string;
  cellBg?: string;

  highlightRowLabel?: string;
  highlightColLabel?: string;
  highlightBg?: string;

  emptyText?: string;
};



function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function isBlank(v: unknown) {
  return String(v ?? "").trim().length === 0;
}

export function MatrixTable<Row extends Record<string, unknown> = Record<string, unknown>>({
  model,
  legacy,
  headerBg = "#f5f5f5",
  cellBg = "#ffffff",
  highlightRowLabel,
  highlightColLabel,
  highlightBg = "#c8d54f",
  emptyText = "Keine Daten verfügbar.",
}: MatrixTableProps<Row>) {

  const effectiveModel: MatrixModel<Row> | null = model
    ? model
    : legacy
      ? {
          rows: legacy.rows,
          rowLabelKey: String(legacy.rowLabelKey),
          rowLabelHeader: legacy.rowLabelHeader,
          columns: legacy.columns.map((c) => ({
            key: String(c.key),
            label: c.label,
            kind: c.kind,
            unitKey: c.unitKey,
            ctx: c.ctx,
          })),
        }
      : null;

  if (!effectiveModel) return null;

  const rows = effectiveModel.rows ?? [];
  const columns = effectiveModel.columns ?? [];
  const rowLabelKey = effectiveModel.rowLabelKey;
  const rowLabelHeader = effectiveModel.rowLabelHeader ?? "";

  if (!rows.length || !columns.length) {
    return (
      <div className="small text-muted" style={{ padding: "0.25rem 0" }}>
        {emptyText}
      </div>
    );
  }

  const highlightRowNorm = highlightRowLabel ? norm(highlightRowLabel) : null;
  const highlightColNorm = highlightColLabel ? norm(highlightColLabel) : null;

  // NEU: Rowlabel-Spalte automatisch ausblenden, wenn sie faktisch leer ist
  const hideRowLabelCol =
    !rowLabelKey ||
    (isBlank(rowLabelHeader) &&
      rows.every((r) => {
        const rowRecord = r as Record<string, unknown>;
        return isBlank(rowRecord[rowLabelKey as string]);
      }));

  return (
    <div className="table-responsive">
      <table
        className="table table-borderless align-middle mb-0 text-nowrap"
        style={{ borderCollapse: "separate", borderSpacing: "2px" }}
      >
        <thead>
          <tr>
            {!hideRowLabelCol && (
              <th
                scope="col"
                className="text-start"
                style={{ backgroundColor: headerBg, padding: "0.55rem 0.85rem" }}
              >
                {rowLabelHeader}
              </th>
            )}

            {columns.map((c) => {
              const isColHighlight =
                highlightColNorm && norm(c.label) === highlightColNorm;

              return (
                <th
                  key={c.key}
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: isColHighlight ? highlightBg : headerBg,
                    padding: "0.55rem 0.85rem",
                    fontWeight: isColHighlight ? 700 : 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label || "–"}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="small">
          {rows.map((r, ridx) => {
            const rowRecord = r as Record<string, unknown>;
            const rowLabel = rowRecord[rowLabelKey as string];
            const isRowHighlight =
              !hideRowLabelCol && highlightRowNorm && norm(rowLabel) === highlightRowNorm;

            return (
              <tr key={`${String(rowLabel ?? "row")}-${ridx}`}>
                {!hideRowLabelCol && (
                  <td
                    className="text-start"
                    style={{
                      backgroundColor: isRowHighlight ? highlightBg : headerBg,
                      padding: "0.55rem 0.85rem",
                      fontWeight: isRowHighlight ? 700 : 600,
                    }}
                  >
                    {String(rowLabel ?? "–")}
                  </td>
                )}

                {columns.map((c) => {
                  const isColHighlight =
                    highlightColNorm && norm(c.label) === highlightColNorm;

                  const raw = rowRecord[c.key];
                  const value = toNumberOrNull(raw);
                  const isKaufpreisfaktorRow =
                    typeof rowLabel === "string" &&
                    ["kaufpreisfaktor", "kaupreisfaktor"].includes(norm(rowLabel));

                  const display = formatMetric(value, {
                    kind: isKaufpreisfaktorRow ? "quote" : c.kind,
                    ctx: c.ctx ?? "table",
                    unit: isKaufpreisfaktorRow ? "none" : (c.unitKey ?? "none"),
                  });

                  const bg =
                    isRowHighlight || isColHighlight ? highlightBg : cellBg;

                  return (
                    <td
                      key={`${String(rowLabel)}-${c.key}`}
                      className="text-center"
                      style={{
                        backgroundColor: bg,
                        padding: "0.55rem 0.85rem",
                        fontWeight: isRowHighlight || isColHighlight ? 700 : 400,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
