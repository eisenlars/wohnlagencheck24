// components/VergleichBarChart.tsx
// Externe Komponente – zentralisierte Formatierung über utils/format.ts

"use client";

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

export type BarSeries = {
  key: string;              // z.B. "preis", "preis_vorjahr", "personenanzahl_1"
  label: string;            // z.B. "Aktuell", "Vorjahr", "1 Person"
  values: Array<number | null>;
  color?: string;
  fillOpacity?: number;
};

export type VergleichBarChartProps = {
  title: string;

  // Kategorien
  categories: string[];     // x-Achse Labels (z.B. "1 Zimmer", "2 Zimmer"...)
  series: BarSeries[];      // mehrere Balken pro Kategorie

  // Formatierung (zentral)
  valueKind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;      // chart/table default

  // Layout
  svgWidth?: number;        // base viewport width (kann intern erweitert werden)
  svgHeight?: number;
  maxLabelLen?: number;

  // Legende
  showLegend?: boolean;

  // Tabelle (SEO/LLM)
  showTable?: boolean;
  tableCtx?: FormatContext;

  // wenn Sie die Kategorie-Breite beeinflussen wollen
  groupGap?: number;
  barGap?: number;
  barWidth?: number;

  emptyText?: string;
};

function shortLabel(s: string, max = 12) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export function VergleichBarChart({
  title,
  categories,
  series,

  valueKind,
  unitKey = "none",
  ctx = "chart",

  svgWidth = 560,
  svgHeight = 300,
  maxLabelLen = 12,

  showLegend = true,

  showTable = true,
  tableCtx = "table",

  groupGap = 22,
  barGap = 8,
  barWidth = 26,

  emptyText = "Für diese Auswertung liegen aktuell keine Daten vor.",
}: VergleichBarChartProps) {
  const cats = (categories ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);

  const cleanedSeries = (series ?? [])
    .map((s) => ({
      ...s,
      key: String(s.key ?? "").trim(),
      label: String(s.label ?? "").trim(),
      values: (s.values ?? []).map((v) => toNumberOrNull(v)),
    }))
    .filter((s) => s.key && s.label);

  const hasData =
    cats.length > 0 &&
    cleanedSeries.length > 0 &&
    cleanedSeries.some((s) => s.values.some((v) => typeof v === "number" && Number.isFinite(v)));

  if (!hasData) {
    return <p className="small text-muted mb-0">{emptyText}</p>;
  }

  // auf gleiche Länge bringen
  const N = cats.length;
  const seriesAligned = cleanedSeries.map((s) => ({
    ...s,
    values: Array.from({ length: N }, (_, i) => s.values[i] ?? null),
  }));

  // max aus allen Serien
  const maxVal = Math.max(
    ...seriesAligned.flatMap((s) =>
      s.values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    ),
  );
  const max = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : 1;

  const paddingTop = 18;
  const paddingBottom = showLegend ? 86 : 62;
  const paddingLeft = 26;
  const paddingRight = 18;

  const availableHeight = svgHeight - paddingTop - paddingBottom;

  const barsPerGroup = seriesAligned.length;
  const groupWidth = barsPerGroup * barWidth + (barsPerGroup - 1) * barGap;

  const innerWidth = N * groupWidth + (N - 1) * groupGap;
  const viewWidth = Math.max(svgWidth, innerWidth + paddingLeft + paddingRight);

  const fmtNoUnit = (v: number | null) =>
    formatMetric(v, { kind: valueKind, ctx, unit: "none" });

  const fmtWithUnit = (v: number | null) =>
    formatMetric(v, { kind: valueKind, ctx: tableCtx, unit: unitKey });

  const aria = `${title} – Balkendiagramm (${barsPerGroup} Reihen)`;

  // Farbdefaults, wenn nicht gesetzt
  const defaultColor = (idx: number) =>
    idx === 0 ? "rgba(75,192,192)" : idx === 1 ? "rgba(200,213,79)" : "rgb(72,107,122)";

  return (
    <>
      <svg
        role="img"
        aria-label={aria}
        viewBox={`0 0 ${viewWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
        className="mb-3"
        suppressHydrationWarning
      >
        {/* Grundlinie */}
        <line
          x1={paddingLeft}
          y1={svgHeight - paddingBottom}
          x2={viewWidth - paddingRight}
          y2={svgHeight - paddingBottom}
          stroke="#ccc"
          strokeWidth={1}
        />

        {cats.map((cat, i) => {
          const baseX = paddingLeft + i * (groupWidth + groupGap);

          return (
            <g key={`g-${cat}-${i}`}>
              {seriesAligned.map((s, si) => {
                const v = s.values[i];
                const h = v !== null ? (v / max) * availableHeight : 0;
                const y = svgHeight - paddingBottom - h;
                const x = baseX + si * (barWidth + barGap);

                const color = s.color ?? defaultColor(si);
                const opacity = typeof s.fillOpacity === "number" ? s.fillOpacity : 0.85;

                const label = fmtNoUnit(v);
                const labelY = Math.max(paddingTop + 10, y - 8);

                return (
                  <g key={`${s.key}-${i}`}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={h}
                      rx={6}
                      ry={6}
                      fill={color}
                      fillOpacity={opacity}
                    />
                    {/* Wert über Balken */}
                    <text
                      x={x + barWidth / 2}
                      y={labelY}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#333"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Kategorienlabel */}
              <text
                x={baseX + groupWidth / 2}
                y={svgHeight - paddingBottom + 28}
                textAnchor="middle"
                fontSize="11"
                fill="#555"
              >
                {shortLabel(cat, maxLabelLen)}
              </text>
            </g>
          );
        })}

        {/* Legende */}
        {showLegend && (
          <g>
            {seriesAligned.map((s, si) => {
              const x0 = paddingLeft + si * 150;
              const y0 = svgHeight - 26;
              const color = s.color ?? defaultColor(si);
              const opacity = typeof s.fillOpacity === "number" ? s.fillOpacity : 0.85;

              return (
                <g key={`leg-${s.key}`}>
                  <rect x={x0} y={y0 - 8} width={12} height={8} fill={color} fillOpacity={opacity} rx={2} />
                  <text x={x0 + 18} y={y0} fontSize="11" fill="#555">
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Tabelle (optional) */}
      {showTable && (
        <div className="table-responsive">
          <table
            className="table table-borderless align-middle mb-0"
            style={{ borderCollapse: "separate", borderSpacing: "2px" }}
          >
            <thead>
              <tr>
                <th className="text-start" style={{ backgroundColor: "#f5f5f5", padding: "0.55rem 0.85rem" }}>
                  Kategorie
                </th>
                {seriesAligned.map((s) => (
                  <th
                    key={`th-${s.key}`}
                    className="text-center"
                    style={{ backgroundColor: "#f5f5f5", padding: "0.55rem 0.85rem" }}
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="small">
              {cats.map((cat, i) => (
                <tr key={`row-${cat}-${i}`}>
                  <td className="text-start" style={{ backgroundColor: "#f5f5f5", padding: "0.55rem 0.85rem", fontWeight: 600 }}>
                    {cat}
                  </td>

                  {seriesAligned.map((s) => (
                    <td
                      key={`cell-${cat}-${s.key}`}
                      className="text-center"
                      style={{ backgroundColor: "#ffffff", padding: "0.55rem 0.85rem", whiteSpace: "nowrap" }}
                    >
                      {fmtWithUnit(s.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
