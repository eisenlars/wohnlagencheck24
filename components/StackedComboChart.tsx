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
  tableClassName?: string;
  emptyText?: string;
};

function shortLabel(value: string, max = 10) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${Math.round(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return formatMetric(value, { kind: "anzahl", ctx: "chart", unit: "none" });
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
  tableClassName = "visually-hidden",
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

  const baseBarWidth = stacked ? 30 : Math.max(18, 30 - barCount * 2);
  const baseBarGap = stacked ? 0 : 8;
  const baseGroupGap = 26;

  const baseGroupWidth = stacked ? baseBarWidth : barCount * baseBarWidth + (barCount - 1) * baseBarGap;
  const innerWidth = N * baseGroupWidth + (N - 1) * baseGroupGap;
  const padL = 34;
  const padR = 18;
  const padT = 18;
  const padB = 56;
  const viewWidth = svgWidth;
  const xScale = innerWidth > 0 ? (viewWidth - padL - padR) / innerWidth : 1;
  const barWidth = baseBarWidth * xScale;
  const barGap = baseBarGap * xScale;
  const groupGap = baseGroupGap * xScale;
  const groupWidth = baseGroupWidth * xScale;
  const availableHeight = svgHeight - padT - padB;

  const barValues = seriesBars.flatMap((s) =>
    s.values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
  );
  const lineValues = seriesLines.flatMap((s) =>
    s.values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
  );

  const posTotals = cats.map((_, i) =>
    seriesBars.reduce((sum, s) => {
      const v = typeof s.values[i] === "number" ? (s.values[i] as number) : 0;
      return sum + (v > 0 ? v : 0);
    }, 0),
  );
  const negTotals = cats.map((_, i) =>
    seriesBars.reduce((sum, s) => {
      const v = typeof s.values[i] === "number" ? (s.values[i] as number) : 0;
      return sum + (v < 0 ? v : 0);
    }, 0),
  );

  const maxVal = Math.max(
    ...(stacked ? posTotals : barValues),
    ...lineValues,
    1,
  );
  const minVal = Math.min(
    ...(stacked ? negTotals : barValues),
    ...lineValues,
    0,
  );
  const span = maxVal - minVal || 1;

  const scaleY = (v: number) => padT + availableHeight - ((v - minVal) / span) * availableHeight;
  const zeroY = scaleY(0);
  const showZeroLine = minVal < 0 && maxVal > 0;

  const fmt = (v: number | null, useCtx: FormatContext) =>
    formatMetric(v, { kind: valueKind, ctx: useCtx, unit: unitKey });

  const defaultBarColor = (idx: number) =>
    idx === 0 ? "rgba(75,192,192,0.85)" : idx === 1 ? "rgba(95,132,162,0.85)" : "rgba(200,213,79,0.85)";

  const defaultLineColor = (idx: number) => (idx === 0 ? "rgba(200,213,79,1)" : "rgb(72,107,122)");

  return (
    <>
      {showLegend ? (
        <div className="d-flex flex-wrap gap-3 small text-muted mb-3 justify-content-center text-center">
          {seriesBars.map((s, si) => (
            <div key={`legend-bar-${s.key}`} className="d-flex align-items-center gap-2">
              <span style={{ width: 12, height: 8, background: s.color ?? defaultBarColor(si), display: "inline-block", borderRadius: 2 }} />
              <span>{s.label}</span>
            </div>
          ))}
          {seriesLines.map((s, si) => (
            <div key={`legend-line-${s.key}`} className="d-flex align-items-center gap-2">
              <span style={{ width: 12, height: 8, background: s.color ?? defaultLineColor(si), display: "inline-block", borderRadius: 2 }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <svg
        role="img"
        aria-label={`${title} – Kombination`}
        viewBox={`0 0 ${viewWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
        className="mb-0"
      >
        <line x1={padL} y1={svgHeight - padB} x2={viewWidth - padR} y2={svgHeight - padB} stroke="#ccc" />
        {showZeroLine ? (
          <line x1={padL} y1={zeroY} x2={viewWidth - padR} y2={zeroY} stroke="#bbb" />
        ) : null}
        <line x1={padL} y1={padT} x2={padL} y2={svgHeight - padB} stroke="#ccc" />

        {cats.map((cat, i) => {
          const baseX = padL + i * (groupWidth + groupGap);
          let posTop = zeroY;
          let negBottom = zeroY;

          return (
            <g key={`bar-${cat}-${i}`}>
              {seriesBars.map((s, si) => {
                const value = typeof s.values[i] === "number" ? (s.values[i] as number) : 0;
                const h = Math.abs((value / span) * availableHeight);
                const color = s.color ?? defaultBarColor(si);

                const x = stacked ? baseX : baseX + si * (barWidth + barGap);
                let y = zeroY - h;
                if (stacked) {
                  if (value >= 0) {
                    y = posTop - h;
                    posTop -= h;
                  } else {
                    y = negBottom;
                    negBottom += h;
                  }
                } else {
                  y = value >= 0 ? zeroY - h : zeroY;
                }

                return (
                  <rect
                    key={`${s.key}-${i}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(h, 0)}
                    fill={color}
                    rx={0}
                    ry={0}
                  />
                );
              })}

              <text
                x={baseX + groupWidth / 2}
                y={svgHeight - padB + 22}
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

        <text x={padL - 6} y={padT - 2} textAnchor="end" fontSize="11" fill="#888">
          {formatCompact(maxVal)}
        </text>
        <text
          x={padL - 6}
          y={svgHeight - padB - 8}
          textAnchor="end"
          fontSize="11"
          fill="#888"
        >
          {formatCompact(minVal)}
        </text>
        {showZeroLine ? (
          <text x={padL - 6} y={zeroY - 4} textAnchor="end" fontSize="11" fill="#888">
            0
          </text>
        ) : null}
      </svg>

      {showTable ? (
        <div className={["table-responsive", tableClassName].filter(Boolean).join(" ")} style={{ paddingLeft: padL }}>
          <table className="table table-borderless table-sm mb-0" style={{ lineHeight: 1.05, fontSize: "0.75rem", width: "auto" }}>
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
