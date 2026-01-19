// components/ZeitreiheChart.tsx

"use client";

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

export type Zeitpunkt = { jahr: number; value: number };

export type ZeitreiheSerie = {
  key: string;
  label: string;
  points: Zeitpunkt[];
  color?: string;
};

type ZeitreiheChartProps = {
  title: string;
  series: ZeitreiheSerie[];

  ariaLabel?: string;

  kind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;
  tableCtx?: FormatContext;

  svgWidth?: number;
  svgHeight?: number;
  maxYearLabels?: number;
  showLegend?: boolean;
  tableClassName?: string;
};

function toFiniteYear(v: unknown): number | null {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  const y = Math.trunc(n);
  return y > 1900 ? y : null;
}

const COLORS = [
  "rgba(75,192,192,1)",
  "rgb(72,107,122)",
  "rgba(200,213,79,1)",
  "rgba(231,111,81,1)",
  "rgba(42,157,143,1)",
  "rgba(233,196,106,1)",
];

function colorFor(idx: number) {
  return COLORS[idx % COLORS.length];
}

function thinYears(years: number[], max: number): number[] {
  if (years.length <= max) return years;
  const step = Math.ceil(years.length / max);
  return years.filter((_, i) => i % step === 0 || i === years.length - 1);
}

export function ZeitreiheChart({
  title,
  series,
  ariaLabel,
  kind,
  unitKey = "none",
  ctx = "chart",
  tableCtx,
  svgWidth = 720,
  svgHeight = 320,
  maxYearLabels = 7,
  showLegend = true,
  tableClassName = "visually-hidden",
}: ZeitreiheChartProps) {
  const cleaned = (series ?? [])
    .map((s) => ({
      ...s,
      points: (s.points ?? [])
        .map((p) => ({ jahr: toFiniteYear(p.jahr), value: toNumberOrNull(p.value) }))
        .filter((p): p is { jahr: number; value: number } => p.jahr !== null && p.value !== null)
        .sort((a, b) => a.jahr - b.jahr),
    }))
    .filter((s) => s.points.length > 0);

  if (!cleaned.length) {
    return <p className="small text-muted mb-0">Für diese Zeitreihe liegen aktuell keine Daten vor.</p>;
  }

  const all = cleaned.flatMap((s) => s.points);
  const years = Array.from(new Set(all.map((p) => p.jahr))).sort((a, b) => a - b);
  const axisYears = thinYears(years, maxYearLabels);

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minVal = Math.min(...all.map((p) => p.value));
  const maxVal = Math.max(...all.map((p) => p.value));

  const padL = 56;
  const padR = 18;
  const padT = 18;
  const padB = 56;

  const w = svgWidth - padL - padR;
  const h = svgHeight - padT - padB;

  const scaleX = (y: number) => padL + ((y - minYear) / (maxYear - minYear || 1)) * w;
  const scaleY = (v: number) => padT + h - ((v - minVal) / (maxVal - minVal || 1)) * h;

  const fmtNoUnit = (v: number) => formatMetric(v, { kind, ctx, unit: "none" });
  const fmtWithUnit = (v: number | null) =>
    formatMetric(v, { kind, ctx: tableCtx ?? "table", unit: unitKey });

  const paths = cleaned.map((s, i) => ({
    ...s,
    stroke: s.color ?? colorFor(i),
    d: s.points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(p.jahr)} ${scaleY(p.value)}`)
      .join(" "),
  }));

  const valueByYear: Record<number, Record<string, number>> = {};
  cleaned.forEach((s) =>
    s.points.forEach((p) => {
      valueByYear[p.jahr] = valueByYear[p.jahr] ?? {};
      valueByYear[p.jahr][s.key] = p.value;
    }),
  );

  return (
    <>
      {showLegend ? (
        <div className="d-flex flex-wrap gap-3 small text-muted mb-3 justify-content-center text-center">
          {paths.map((p) => (
            <div key={`legend-${p.key}`} className="d-flex align-items-center gap-2">
              <span style={{ width: 12, height: 8, background: p.stroke, display: "inline-block", borderRadius: 2 }} />
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <svg
        role="img"
        aria-label={ariaLabel ?? `${title} – Zeitreihe ${minYear} bis ${maxYear}`}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        className="mb-0"
        preserveAspectRatio="xMidYMid meet"
        suppressHydrationWarning
      >
        {/* Achsen */}
        <line x1={padL} y1={svgHeight - padB} x2={svgWidth - padR} y2={svgHeight - padB} stroke="#ccc" />
        <line x1={padL} y1={padT} x2={padL} y2={svgHeight - padB} stroke="#ccc" />

        {/* Linien */}
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            stroke={p.stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Punkte + Werte */}
        {paths.map((p) =>
          p.points.map((pt) => (
            <g key={`${p.key}-${pt.jahr}`}>
              <circle cx={scaleX(pt.jahr)} cy={scaleY(pt.value)} r={3} fill={p.stroke} />
              <text x={scaleX(pt.jahr)} y={scaleY(pt.value) - 10} textAnchor="middle" fontSize="10" fill="#444">
                {fmtNoUnit(pt.value)}
              </text>
            </g>
          )),
        )}

        {/* Jahreslabels */}
        {axisYears.map((y) => (
          <text key={y} x={scaleX(y)} y={svgHeight - padB + 22} textAnchor="middle" fontSize="12" fill="#555">
            {y}
          </text>
        ))}

        {/* Min/Max links */}
        <text x={padL - 8} y={padT - 2} textAnchor="end" fontSize="12" fill="#888">
          {fmtNoUnit(maxVal)}
        </text>
        <text
          x={padL - 8}
          y={svgHeight - padB - 8}
          textAnchor="end"
          dominantBaseline="hanging"
          fontSize="12"
          fill="#888"
        >
          {fmtNoUnit(minVal)}
        </text>
      </svg>

      {/* Tabelle */}
      <div className={["table-responsive", tableClassName].filter(Boolean).join(" ")} style={{ paddingLeft: padL }}>
        <table className="table table-borderless table-sm mb-0" style={{ lineHeight: 1.05, fontSize: "0.75rem", width: "auto" }}>
          <thead>
            <tr>
              <th>Jahr</th>
              {paths.map((p) => (
                <th key={p.key} className="text-center">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td>{y}</td>
                {paths.map((p) => (
                  <td key={`${y}-${p.key}`} className="text-center" style={{ whiteSpace: "nowrap" }}>
                    {fmtWithUnit(valueByYear[y]?.[p.key] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
