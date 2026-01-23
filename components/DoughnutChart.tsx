import React from "react";

import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

export type DoughnutSlice = {
  label: string;
  value: number | null;
  color?: string;
};

type DoughnutChartProps = {
  title: string;
  slices: DoughnutSlice[];

  valueKind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;
  listCtx?: FormatContext;

  svgSize?: number;
  innerRatio?: number;
  showLegend?: boolean;
  emptyText?: string;
};

function safeLabel(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "Wert";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angle = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function DoughnutChart({
  title,
  slices,
  valueKind,
  unitKey = "none",
  ctx = "chart",
  listCtx,
  svgSize = 220,
  innerRatio = 0.175,
  showLegend = true,
  emptyText = "Für diese Auswertung liegen aktuell keine Daten vor.",
}: DoughnutChartProps) {
  const cleaned = (slices ?? [])
    .map((s) => ({
      label: safeLabel(s?.label),
      value: toNumberOrNull(s?.value),
      color: s?.color,
    }))
    .filter((s) => s.label);

  const values = cleaned
    .map((s) => s.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (!values.length) {
    return <p className="small text-muted mb-0">{emptyText}</p>;
  }

  const total = values.reduce((acc, v) => acc + v, 0);
  if (!(total > 0)) {
    return <p className="small text-muted mb-0">{emptyText}</p>;
  }

  const colors = [
    "rgba(75,192,192,0.9)",
    "rgba(200,213,79,0.9)",
    "rgb(72,107,122)",
    "rgba(231,111,81,0.85)",
    "rgba(42,157,143,0.85)",
  ];
  const labelColors: Record<string, string> = {
    Gesamt: "#E6E6E6",
    "Industrie & Gewerbe": "#0087CC",
  };

  const radius = svgSize / 2;
  const ringWidth = radius * (1 - innerRatio);
  const padding = 2;
  const ringRadius = radius - ringWidth / 2 - padding;
  const holeRadius = ringRadius - ringWidth / 2;

  const arcs = cleaned.reduce<{
    cursor: number;
    items: Array<{ label: string; value: number | null; color: string; d: string }>;
  }>(
    (acc, s, idx) => {
      const value = s.value ?? 0;
      const rawAngle = (value / total) * 360;
      const angle = rawAngle >= 360 ? 359.99 : rawAngle;
      const start = acc.cursor;
      const end = start + angle;

      acc.items.push({
        label: s.label,
        value: s.value,
        color: s.color ?? labelColors[s.label] ?? colors[idx % colors.length],
        d: describeArc(radius, radius, ringRadius, start, end),
      });
      acc.cursor = end;
      return acc;
    },
    { cursor: 0, items: [] },
  ).items;

  const fmt = (v: number | null) =>
    formatMetric(v, { kind: valueKind, ctx: listCtx ?? ctx, unit: unitKey });

  return (
    <div className="doughnut-chart">
      {showLegend ? (
        <div className="d-flex flex-wrap gap-3 small text-muted mb-3 justify-content-center text-center">
          {arcs.map((a, idx) => (
            <div key={`${a.label}-legend-${idx}`} className="d-flex align-items-center gap-2">
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 8,
                  backgroundColor: a.color,
                  borderRadius: 2,
                }}
              />
              <span>
                <strong>{a.label}:</strong> {fmt(a.value)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <svg
        role="img"
        aria-label={`${title} – Kreisdiagramm`}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        width="100%"
        height={svgSize}
        className="mb-3"
        preserveAspectRatio="xMidYMid meet"
      >
        {arcs.map((a, idx) => (
          <g key={`${a.label}-${idx}`} className="doughnut-slice">
            <path
              d={a.d}
              stroke="transparent"
              strokeWidth={ringRadius - holeRadius + 12}
              strokeLinecap="butt"
              fill="none"
              className="doughnut-hit"
              pointerEvents="stroke"
            >
              <title>{`${a.label}: ${fmt(a.value)}`}</title>
            </path>
            <path
              d={a.d}
              stroke={a.color}
              strokeWidth={ringRadius - holeRadius}
              strokeLinecap="butt"
              fill="none"
              className="doughnut-segment"
              pointerEvents="none"
            />
          </g>
        ))}
      </svg>

    </div>
  );
}
