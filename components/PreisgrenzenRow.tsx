// components/PreisgrenzenRow.tsx
// Externe Komponente – zentralisierte Formatierung über utils/format.ts

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric } from "@/utils/format";

type PreisgrenzenRowProps = {
  color: string;
  iconLabel: string;

  cheapestName: string;
  cheapestValue: number | null;

  priciestName: string;
  priciestValue: number | null;

  // Semantik statt Wildwuchs
  valueKind: Extract<FormatKind, "kaufpreis_qm" | "grundstueck_qm" | "miete_qm">;

  // Einheit zentral (Default = €/m²)
  unitKey?: UnitKey;

  // Kontext zentral (Default = KPI, weil es wie eine große Kennzahl-Kachel wirkt)
  ctx?: FormatContext;
};

export function PreisgrenzenRow({
  color,
  iconLabel,
  cheapestName,
  cheapestValue,
  priciestName,
  priciestValue,
  valueKind,
  unitKey = "eur_per_sqm",
  ctx = "kpi",
}: PreisgrenzenRowProps) {
  if (!cheapestName || cheapestValue === null || !priciestName || priciestValue === null) {
    return null;
  }

  const iconTextColor = color === "rgb(72,107,122)" ? "#fff" : "#000";

  const cheapestLabel = formatMetric(cheapestValue, { kind: valueKind, ctx, unit: unitKey });
  const priciestLabel = formatMetric(priciestValue, { kind: valueKind, ctx, unit: unitKey });

  return (
    <div
      className="card border-0 shadow-sm w-100 kpi-range"
      style={{
        ["--kpi-accent" as string]: color,
        ["--kpi-accent-contrast" as string]: iconTextColor,
      }}
    >
      <div className="card-body py-5 px-5">
        <div className="d-flex flex-column flex-lg-row align-items-center justify-content-between gap-4 w-100">
          {/* Links */}
          <div className="flex-lg-1 text-start w-100">
            <div className="small text-muted mb-1">Günstigste Ortslage</div>
            <div className="fw-semibold mb-1 fs-1">{cheapestName}</div>
            <div className="kpi-range__value fw-bold fs-1">
              {cheapestLabel}
            </div>
          </div>

          {/* Icon */}
          <div className="flex-lg-1 d-flex justify-content-center align-items-center w-100">
            <div className="kpi-range__icon rounded-circle d-flex align-items-center justify-content-center">
              {iconLabel}
            </div>
          </div>

          {/* Rechts */}
          <div className="flex-lg-1 text-end w-100">
            <div className="small text-muted mb-1">Teuerste Ortslage</div>
            <div className="fw-semibold mb-1 fs-1">{priciestName}</div>
            <div className="kpi-range__value fw-bold fs-1">
              {priciestLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
