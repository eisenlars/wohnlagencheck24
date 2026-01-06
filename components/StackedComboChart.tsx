import React from "react";

import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

export type ComboSeries = {
  key: string;
  label: string;
  values: Array<number | null>;
  color?: string;
};

type StackedComboChartProps = {
  title: string;
  categories: Array<string | number>;

  bars?: ComboSeries[];
  lines?: ComboSeries[];

  valueKind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;
  tableCtx?: FormatContext;

  stacked?: boolean;
  svgWidth?: number;
  svgHeight?: number;
  showLegend?: boolean;
  showTable?: boolean;
  emptyText?: string;
};

function shortLabel(value: string, max = 10) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export function StackedComboChart({
  title,
  categories,
  bars = [],
  lines = [],
  valueKind,
  unitKey = "none",
  ctx = "chart",
  tableCtx = "table",
  stacked = true,
  svgWidth = 720,
  svgHeight = 320,
  showLegend = true,
  showTable = true,
  emptyText = "Für diese Auswertung liegen aktuell keine Daten vor.",
}: StackedComboChartProps) {
  const cats = (categories ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
  const cleanBars = (bars ?? []).map((s) => ({
    ...s,
    values: (s.values ?? []).map((v) => toNumberOrNull(v)),
  }));
  const cleanLines = (lines ?? []).map((s) => ({
    ...s,
    values: (s.values ?? []).map((v) => toNumberOrNull(v)),
  }));

  const hasData =
    cats.length > 0 &&
    (cleanBars.some((s) => s.values.some((v) => typeof v === "number" && Number.isFinite(v))) ||
      cleanLines.some((s) => s.values.some((v) => typeof v === "number" && Number.isFinite(v))));

  if (!hasData) {
    return <p className="small text-muted mb-0">{emptyText}</p>;
  }

  const N = cats.length;
  const seriesBars = cleanBars.map((s) => ({
    ...s,
    values: Array.from({ length: N }, (_, i) => s.values[i] ?? null),
  }));
  const seriesLines = cleanLines.map((s) => ({
    ...s,
    values: Array.from({ length: N }, (_, i) => s.values[i] ?? null),
  }));

  const barCount = seriesBars.length || 1;

  const barWidth = stacked ? 30 : Math.max(18, 30 - barCount * 2);
  const barGap = stacked ? 0 : 8;
  const groupGap = 26;

  const groupWidth = stacked ? barWidth : barCount * barWidth + (barCount - 1) * barGap;
  const innerWidth = N * groupWidth + (N - 1) * groupGap;
  const padL = 34;
  const padR = 18;
  const padT = 18;
  const padB = showLegend ? 76 : 52;
  const viewWidth = Math.max(svgWidth, innerWidth + padL + padR);
  const availableHeight = svgHeight - padT - padB;

  const stackTotals = cats.map((_, i) =>
    stacked
      ? seriesBars.reduce((sum, s) => sum + (typeof s.values[i] === "number" ? (s.values[i] as number) : 0), 0)
      : Math.max(
          ...seriesBars.map((s) => (typeof s.values[i] === "number" ? (s.values[i] as number) : 0)),
        ),
  );

  const lineMax = Math.max(
    ...seriesLines.flatMap((s) => s.values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))),
    0,
  );

  const maxVal = Math.max(...stackTotals, lineMax, 1);

  const scaleY = (v: number) => padT + availableHeight - (v / maxVal) * availableHeight;

  const fmt = (v: number | null, useCtx: FormatContext) =>
    formatMetric(v, { kind: valueKind, ctx: useCtx, unit: unitKey });

  const defaultBarColor = (idx: number) =>
    idx === 0 ? "rgba(75,192,192,0.85)" : idx === 1 ? "rgba(95,132,162,0.85)" : "rgba(200,213,79,0.85)";

  const defaultLineColor = (idx: number) => (idx === 0 ? "rgba(200,213,79,1)" : "rgb(72,107,122)");

  return (
    <>
      <svg
        role="img"
        aria-label={`${title} – Kombination`}
        viewBox={`0 0 ${viewWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
        className="mb-3"
      >
        <line x1={padL} y1={svgHeight - padB} x2={viewWidth - padR} y2={svgHeight - padB} stroke="#ccc" />

        {cats.map((cat, i) => {
          const baseX = padL + i * (groupWidth + groupGap);
          let stackTop = svgHeight - padB;

          return (
            <g key={`bar-${cat}-${i}`}>
              {seriesBars.map((s, si) => {
                const value = typeof s.values[i] === "number" ? (s.values[i] as number) : 0;
                const h = (value / maxVal) * availableHeight;
                const color = s.color ?? defaultBarColor(si);

                const x = stacked ? baseX : baseX + si * (barWidth + barGap);
                const y = stacked ? stackTop - h : svgHeight - padB - h;

                if (stacked) stackTop -= h;

                return (
                  <rect
                    key={`${s.key}-${i}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(h, 0)}
                    fill={color}
                    rx={4}
                    ry={4}
                  />
                );
              })}

              <text
                x={baseX + groupWidth / 2}
                y={svgHeight - padB + 24}
                textAnchor="middle"
                fontSize="11"
                fill="#555"
              >
                {shortLabel(cat, 8)}
              </text>
            </g>
          );
        })}

        {seriesLines.map((s, si) => {
          const color = s.color ?? defaultLineColor(si);
          const points = s.values.map((v, idx) => {
            const x = padL + idx * (groupWidth + groupGap) + groupWidth / 2;
            const y = scaleY(typeof v === "number" ? v : 0);
            return { x, y, value: v };
          });

          const d = points
            .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");

          return (
            <g key={`line-${s.key}`}>
              <path d={d} stroke={color} strokeWidth={2.5} fill="none" />
              {points.map((p, idx) => (
                <circle key={`${s.key}-${idx}`} cx={p.x} cy={p.y} r={3} fill={color} />
              ))}
            </g>
          );
        })}

        <text x={padL - 6} y={padT + 2} textAnchor="end" fontSize="11" fill="#888">
          {fmt(maxVal, ctx)}
        </text>
        <text
          x={padL - 6}
          y={svgHeight - padB - 4}
          textAnchor="end"
          fontSize="11"
          fill="#888"
        >
          {fmt(0, ctx)}
        </text>
      </svg>

      {showLegend ? (
        <div className="d-flex flex-wrap gap-3 small text-muted mb-3">
          {seriesBars.map((s, si) => (
            <div key={`legend-bar-${s.key}`} className="d-flex align-items-center gap-2">
              <span style={{ width: 12, height: 8, background: s.color ?? defaultBarColor(si), display: "inline-block" }} />
              <span>{s.label}</span>
            </div>
          ))}
          {seriesLines.map((s, si) => (
            <div key={`legend-line-${s.key}`} className="d-flex align-items-center gap-2">
              <span style={{ width: 12, height: 2, background: s.color ?? defaultLineColor(si), display: "inline-block" }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {showTable ? (
        <div className="table-responsive">
          <table className="table table-borderless small mb-0">
            <thead>
              <tr>
                <th>Jahr</th>
                {seriesBars.map((s) => (
                  <th key={`th-bar-${s.key}`} className="text-center">
                    {s.label}
                  </th>
                ))}
                {seriesLines.map((s) => (
                  <th key={`th-line-${s.key}`} className="text-center">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((cat, idx) => (
                <tr key={`row-${cat}-${idx}`}>
                  <td>{cat}</td>
                  {seriesBars.map((s) => (
                    <td key={`bar-${s.key}-${idx}`} className="text-center">
                      {fmt(s.values[idx] ?? null, tableCtx)}
                    </td>
                  ))}
                  {seriesLines.map((s) => (
                    <td key={`line-${s.key}-${idx}`} className="text-center">
                      {fmt(s.values[idx] ?? null, tableCtx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
