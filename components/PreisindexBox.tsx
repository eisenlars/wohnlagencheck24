// PreisindexBox.tsx
// Externe Komponente – komplett zentralisierte Formatierung über utils/format.ts

import React from "react";
import { formatMetric, formatIndexDelta, formatIndexFactor } from "@/utils/format";

type PreisindexBoxProps = {
  title: string;
  index: number | null;
  basisjahr: number | null;
  color: string;

  // Optional: falls Sie später andere Kontext-Policies wollen
  // (standardmäßig KPI-Policy, da Box eine KPI-Kachel ist)
  ctx?: "kpi" | "table" | "chart";

  // Optional: falls Sie Index mal als "Punkte" labeln möchten
  // unitKey?: "points" | "none";
};

export function PreisindexBox({
  title,
  index,
  basisjahr,
  color,
  ctx = "kpi",
}: PreisindexBoxProps) {
  // Wichtig: 0 nicht als "fehlend" behandeln – daher explizit auf null prüfen
  if (index === null || basisjahr === null) {
    return null;
  }

  return (
    <div className="text-center mt-3 mb-2">
      <div className="fw-semibold mb-2" style={{ color }}>
        {title}
      </div>

      <div className="display-6 fw-bold mb-2" style={{ lineHeight: "1", color }}>
        {/* Index ist per Definition dimensionslos (Basisjahr=100) -> keine Einheit */}
        {formatMetric(index, { kind: "index", ctx, unit: "none" })}
      </div>

      <div className="small text-muted">Basisjahr {basisjahr} = Index&nbsp;100</div>

      <div className="small text-muted mt-2">
        <span className="me-2">{formatIndexDelta(index)}</span>
        <span>{formatIndexFactor(index)}</span>
      </div>
    </div>
  );
}
