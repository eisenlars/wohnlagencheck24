// components/VergleichChart.tsx

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";

export type VergleichItem = {
  label: string;
  value: number | null;
  unitKey?: UnitKey; // optional, wird hier i. d. R. über Prop unitKey gesteuert
  kind?: string;
};

type VergleichChartProps = {
  title: string;
  items: VergleichItem[];
  barColor: string;

  // Zentralisierte Formatierung
  valueKind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;

  // Optional: abweichender Kontext für Textliste
  listCtx?: FormatContext;
};

function safeText(v: unknown, fallback = "Region"): string {
  const s = v == null ? "" : String(v);
  const t = s.trim();
  return t || fallback;
}

function getShortLabel(label: unknown): string {
  let text = safeText(label, "Region");

  const lower = text.toLowerCase();
  if (lower.startsWith("landkreis ")) {
    text = "LK " + text.slice(10);
  } else if (lower.startsWith("stadtkreis ")) {
    text = "SK " + text.slice(10);
  } else if (lower.startsWith("kreisfreie stadt ")) {
    text = text.replace(/^kreisfreie stadt\s+/i, "");
  } else if (lower.startsWith("freistaat ")) {
    text = text.replace(/^freistaat\s+/i, "");
  }

  if (text.length <= 14) return text;
  return text.slice(0, 13) + "…";
}

export function VergleichChart({
  title,
  items,
  barColor,
  valueKind,
  unitKey = "eur_per_sqm",
  ctx = "chart",
  listCtx,
}: VergleichChartProps) {
  const cleaned = Array.isArray(items)
    ? items
        .map((i) => ({
          label: safeText(i?.label, "Region"),
          value: typeof i?.value === "number" && Number.isFinite(i.value) ? i.value : null,
        }))
        .filter((i) => i.label) // label ist immer non-empty durch safeText
    : [];

  if (cleaned.length === 0) {
    return <p className="small text-muted mb-0">Für diesen Vergleich liegen aktuell keine Daten vor.</p>;
  }

  const numericValues = cleaned.map((i) => i.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (numericValues.length === 0) {
    return <p className="small text-muted mb-0">Für diesen Vergleich liegen aktuell keine auswertbaren Werte vor.</p>;
  }

  const max = Math.max(...numericValues);

  const svgHeight = 220;
  const paddingTop = 28;
  const paddingBottom = 52;
  const barGap = 28;

  const barWidth = 64;
  const svgWidth = cleaned.length * barWidth + (cleaned.length - 1) * barGap + 48;

  const ariaLabel = `${title} – überregionaler Vergleich`;

  const fmt = (v: number) =>
    formatMetric(v, {
      kind: valueKind,
      ctx,
      unit: "none",
    });

  const fmtWithUnit = (v: number) =>
    formatMetric(v, {
      kind: valueKind,
      ctx: listCtx ?? ctx,
      unit: unitKey,
    });

  return (
    <>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
        className="mb-3"
        suppressHydrationWarning
      >
        {cleaned.map((item, index) => {
          const val = item.value;

          const ratio = max > 0 && typeof val === "number" ? val / max : 0;

          const availableHeight = svgHeight - paddingTop - paddingBottom;
          const barHeight = ratio * availableHeight;

          const x = 24 + index * (barWidth + barGap);
          const y = svgHeight - paddingBottom - barHeight;

          const valueAboveY = y - 10;
          const canPlaceAbove = valueAboveY >= paddingTop;

          const valueY = canPlaceAbove ? valueAboveY : y + barHeight / 2 + 4;
          const valueColor = canPlaceAbove ? "#333" : "#fff";

          // Visuelle Staffelung: 0=Kreis, 1=BL, 2=D (falls Reihenfolge so geliefert wird)
          const opacity = index === 0 ? 0.35 : index === 1 ? 0.6 : 1.0;

          const shortLabel = getShortLabel(item.label);

          return (
            <g key={`${item.label}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={8}
                ry={8}
                fill={barColor}
                fillOpacity={opacity}
              />

              <text
                x={x + barWidth / 2}
                y={valueY}
                textAnchor="middle"
                dominantBaseline={canPlaceAbove ? "auto" : "middle"}
                fontSize="12"
                fontWeight={600}
                fill={valueColor}
              >
                {typeof val === "number" ? fmt(val) : "—"}
              </text>

              <text x={x + barWidth / 2} y={svgHeight - 18} textAnchor="middle" fontSize="11" fill="#555">
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="small text-muted mb-0 chart-legend">
        {cleaned.map((item, idx) => (
          <li key={`${item.label}-list-${idx}`}>
            <strong>{item.label}:</strong>{" "}
            {typeof item.value === "number" ? fmtWithUnit(item.value) : "—"}
          </li>
        ))}
      </ul>
    </>
  );
}
