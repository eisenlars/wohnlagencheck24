// components/OrtslagenUebersichtTable.tsx
// Ortslagen-Übersicht (Preise + Vorjahresveränderung) – vollständig zentral formatiert

import React from "react";
import Link from "next/link";
import type { FormatContext, FormatKind } from "@/utils/format";
import { formatMetric, formatPercentSigned } from "@/utils/format";

export type OrtsRef = {
  slug: string;
  name: string;
  plz?: string;
};

export type OrtslagenUebersichtRow = {
  ortslage: string;

  immobilienpreise_value: number | null;
  immobilienpreise_yoy: number | null;

  grundstueckspreise_value: number | null;
  grundstueckspreise_yoy: number | null;

  mietpreise_value: number | null;
  mietpreise_yoy: number | null;
};

type OrtslagenUebersichtTableProps = {
  rows: OrtslagenUebersichtRow[];
  orte: OrtsRef[];
  bundeslandSlug: string;
  kreisSlug: string;

  // Farbkonzept (wie bei Ihnen: Header kräftig, Cells leicht getönt)
  colorImmo: string;  // z.B. "rgb(75,192,192,0.6)"
  colorGrund: string; // z.B. "rgb(72,107,122,0.6)"
  colorMiete: string; // z.B. "rgb(200,213,79,0.6)"

  bgImmo: string;     // z.B. `rgba(75,192,192,0.1)`
  bgGrund: string;    // z.B. `rgba(72,107,122,0.1)`
  bgMiete: string;    // z.B. `rgba(200,213,79,0.1)`

  // Format-Kontext (Table-Policy)
  ctx?: FormatContext;
};

function trendColor(t: number | null): string {
  if (t === null || !Number.isFinite(t)) return "#212529";
  if (t > 0) return "#198754";
  if (t < 0) return "#b02a37";
  return "#6c757d";
}

export function OrtslagenUebersichtTable({
  rows,
  orte,
  bundeslandSlug,
  kreisSlug,
  colorImmo,
  colorGrund,
  colorMiete,
  bgImmo,
  bgGrund,
  bgMiete,
  ctx = "table",
}: OrtslagenUebersichtTableProps) {
  const fmtValue = (v: number | null, kind: FormatKind) =>
    formatMetric(v, { kind, ctx, unit: "eur_per_sqm" });

  const fmtYoY = (v: number | null) => formatPercentSigned(v, 1);

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="table-responsive">
          <table
            className="table table-borderless align-middle mb-0 text-nowrap"
            style={{ borderCollapse: "separate", borderSpacing: "2px" }}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-start"
                  style={{ backgroundColor: "#f5f5f5", padding: "0.55rem 0.85rem" }}
                >
                  Ortslage
                </th>

                <th
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: colorImmo,
                    color: "#000",
                    padding: "0.55rem 0.85rem",
                  }}
                >
                  Ø Immobilienpreis
                </th>
                <th
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: colorImmo,
                    color: "#000",
                    padding: "0.55rem 0.85rem",
                  }}
                >
                  Tendenz
                </th>

                <th
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: colorGrund,
                    color: "#fff",
                    padding: "0.55rem 0.85rem",
                  }}
                >
                  Ø Grundstückspreis
                </th>
                <th
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: colorGrund,
                    color: "#fff",
                    padding: "0.55rem 0.85rem",
                  }}
                >
                  Tendenz
                </th>

                <th
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: colorMiete,
                    color: "#000",
                    padding: "0.55rem 0.85rem",
                  }}
                >
                  Ø Mietpreis
                </th>
                <th
                  scope="col"
                  className="text-center"
                  style={{
                    backgroundColor: colorMiete,
                    color: "#000",
                    padding: "0.55rem 0.85rem",
                  }}
                >
                  Tendenz
                </th>
              </tr>
            </thead>

            <tbody className="small">
              {rows.map((row, index) => {
                const ortMatch = orte.find((o) => o.slug === row.ortslage);

                const tImmoColor = trendColor(row.immobilienpreise_yoy);
                const tGrundColor = trendColor(row.grundstueckspreise_yoy);
                const tMieteColor = trendColor(row.mietpreise_yoy);

                return (
                  <tr key={row.ortslage || index}>
                    {/* Ortslage */}
                    <td
                      className="text-start"
                      style={{ backgroundColor: "#f5f5f5", padding: "0.55rem 0.85rem" }}
                    >
                      {ortMatch ? (
                        <Link
                          href={`/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortMatch.slug}`}
                          className="link-primary text-decoration-none"
                        >
                          {ortMatch.name}
                        </Link>
                      ) : (
                        row.ortslage || "–"
                      )}
                    </td>

                    {/* Immobilienpreise */}
                    <td
                      className="text-center"
                      style={{ backgroundColor: bgImmo, padding: "0.55rem 0.85rem" }}
                    >
                      {fmtValue(row.immobilienpreise_value, "kaufpreis_qm")}
                    </td>
                    <td
                      className="text-center"
                      style={{
                        backgroundColor: bgImmo,
                        color: tImmoColor,
                        padding: "0.55rem 0.85rem",
                      }}
                    >
                      {fmtYoY(row.immobilienpreise_yoy)}
                    </td>

                    {/* Grundstückspreise */}
                    <td
                      className="text-center"
                      style={{
                        backgroundColor: bgGrund,
                        color: "#000",
                        padding: "0.55rem 0.85rem",
                      }}
                    >
                      {fmtValue(row.grundstueckspreise_value, "grundstueck_qm")}
                    </td>
                    <td
                      className="text-center"
                      style={{
                        backgroundColor: bgGrund,
                        color: tGrundColor,
                        padding: "0.55rem 0.85rem",
                      }}
                    >
                      {fmtYoY(row.grundstueckspreise_yoy)}
                    </td>

                    {/* Mietpreise */}
                    <td
                      className="text-center"
                      style={{ backgroundColor: bgMiete, padding: "0.55rem 0.85rem" }}
                    >
                      {fmtValue(row.mietpreise_value, "miete_qm")}
                    </td>
                    <td
                      className="text-center"
                      style={{
                        backgroundColor: bgMiete,
                        color: tMieteColor,
                        padding: "0.55rem 0.85rem",
                      }}
                    >
                      {fmtYoY(row.mietpreise_yoy)}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted py-3">
                    Für diesen Landkreis liegen aktuell noch keine Ortslagen-Preisübersichten vor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
