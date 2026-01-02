// VergleichChart.tsx
// (Sie können die Datei so als eigene Komponente verwenden oder 1:1 Ihren bisherigen VergleichChart-Block ersetzen.)

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";

export type VergleichItem = { region: string; value: number };

type VergleichChartProps = {
  title: string;
  items: VergleichItem[];
  barColor: string;

  // Zentralisierte Formatierung (Punkt 7)
  valueKind: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;

  // Optional: falls Sie abweichende Anzeige für die Textliste wollen
  listCtx?: FormatContext;
};

export function VergleichChart({
  title,
  items,
  barColor,
  valueKind,
  unitKey = "eur_per_sqm",
  ctx = "chart",
  listCtx,
}: VergleichChartProps) {
  if (!items || items.length === 0) {
    return (
      <p className="small text-muted mb-0">
        Für diesen Vergleich liegen aktuell keine Daten vor.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.value));

  const svgHeight = 220;
  const paddingTop = 28;
  const paddingBottom = 52;
  const barGap = 28;

  const barWidth = 64;
  const svgWidth = items.length * barWidth + (items.length - 1) * barGap + 48;

  const label = `${title} – überregionaler Vergleich`;

  function getShortLabel(region: string): string {
    let text = region.trim();
    if (text.toLowerCase().startsWith("landkreis ")) {
      text = "LK " + text.slice(10);
    }
    if (text.length <= 14) return text;
    return text.slice(0, 13) + "…";
  }

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
        aria-label={label}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
        className="mb-3"
        suppressHydrationWarning
      >
        {items.map((item, index) => {
          const ratio = max > 0 ? item.value / max : 0;

          const availableHeight = svgHeight - paddingTop - paddingBottom;
          const barHeight = ratio * availableHeight;

          const x = 24 + index * (barWidth + barGap);
          const y = svgHeight - paddingBottom - barHeight;

          const valueAboveY = y - 10;
          const canPlaceAbove = valueAboveY >= paddingTop;

          const valueY = canPlaceAbove ? valueAboveY : y + barHeight / 2 + 4;
          const valueColor = canPlaceAbove ? "#333" : "#fff";

          // Visuelle Staffelung: 0=Kreis, 1=BL, 2=D
          const opacity = index === 0 ? 0.35 : index === 1 ? 0.6 : 1.0;

          const shortLabel = getShortLabel(item.region);

          return (
            <g key={`${item.region}-${index}`}>
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
                {fmt(item.value)}
              </text>

              <text
                x={x + barWidth / 2}
                y={svgHeight - 18}
                textAnchor="middle"
                fontSize="11"
                fill="#555"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Textliste (zentral formatiert, inkl. Einheit) */}
      <ul className="small text-muted mb-0">
        {items.map((item, idx) => (
          <li key={`${item.region}-list-${idx}`}>
            <strong>{item.region}:</strong> {fmtWithUnit(item.value)}
          </li>
        ))}
      </ul>
    </>
  );
}
