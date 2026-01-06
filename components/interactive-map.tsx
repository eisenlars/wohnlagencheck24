// components/interactive-map.tsx

"use client";

import React, { useEffect, useRef } from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatMetric, getUnitLabel } from "@/utils/format";

type MapMode = "singleValue" | "overview";

/**
 * Die Map kann alles formatieren, was Ihr zentraler FormatKind kann.
 * Zusätzlich (optional) ein Faktor, falls Sie ihn (noch) nicht in FormatKind führen.
 *
 * Empfehlung: langfristig "kaufpreisfaktor" als FormatKind in format.ts aufnehmen,
 * dann kann diese Union rein "FormatKind" sein.
 */
type MapFormatKind = FormatKind | "kaufpreisfaktor";

type OverviewField = {
  key: string;   // z.B. "data-immobilienpreis"
  label: string; // Tooltip-Label

  // Zentralisierte Formatierung
  kind: MapFormatKind;
  ctx?: FormatContext;
  unitKey?: UnitKey;

  // Optionaler Override auf Nachkommastellen (bewusstes Abweichen)
  fractionDigits?: number;

  // Optionaler Zusatztext unter dem Wert (z.B. "Basis D = 100")
  note?: string;
};

type InteractiveMapProps = {
  svg: string;
  theme: string;
  activeSubregionName?: string;
  mode?: MapMode;

  inactiveOpacity?: number;   // (global steuerbar)

  // SingleValue (zentral)
  kind?: MapFormatKind;
  ctx?: FormatContext;
  unitKey?: UnitKey;
  fractionDigits?: number;
  note?: string; // optionaler Zusatztext auch im SingleValue Tooltip

  // Overview (3 Kennzahlen)
  overviewFields?: [OverviewField, OverviewField, OverviewField];
};

type MapEventHandlers = {
  onEnter: () => void;
  onMove: (event: MouseEvent) => void;
  onLeave: () => void;
};

export function InteractiveMap({
  svg,
  theme,
  activeSubregionName,
  mode = "singleValue",
  inactiveOpacity = 0.4,   // Default

  kind,
  ctx = "kpi",
  unitKey,
  fractionDigits,
  note,

  overviewFields,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = svg;
    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    svgElement.querySelectorAll("title").forEach((t) => t.remove());

    const tooltipEl = document.getElementById(
      `map-tooltip-${theme}`,
    ) as HTMLDivElement | null;

    const mapWrapperEl = document.getElementById(
      `map-${theme}`,
    ) as HTMLDivElement | null;

    const paths = Array.from(svgElement.querySelectorAll<SVGPathElement>("a path"));

    paths.forEach((path) => {
      const name = path.getAttribute("data-name") || "";

      const onEnter = () => {
        if (!tooltipEl) return;
        tooltipEl.innerHTML = buildTooltipContent({
          path,
          name,
          theme,
          mode,
          kind,
          ctx,
          unitKey,
          fractionDigits,
          note,
          overviewFields,
        });
        tooltipEl.style.display = "block";
      };

      const onMove = (event: MouseEvent) => {
        if (!tooltipEl || !mapWrapperEl) return;
        const rect = mapWrapperEl.getBoundingClientRect();
        tooltipEl.style.left = `${event.clientX - rect.left + 10}px`;
        tooltipEl.style.top = `${event.clientY - rect.top + 10}px`;
      };

      const onLeave = () => {
        if (!tooltipEl) return;
        tooltipEl.style.display = "none";
      };

      path.addEventListener("mouseenter", onEnter);
      path.addEventListener("mousemove", onMove);
      path.addEventListener("mouseleave", onLeave);

      (path as SVGPathElement & { __wlc_handlers?: MapEventHandlers }).__wlc_handlers = {
        onEnter,
        onMove,
        onLeave,
      };
    });

    if (activeSubregionName) {
      highlightActiveSubregion(svgElement, activeSubregionName, inactiveOpacity);
    }

    return () => {
      paths.forEach((path) => {
        const handlers = (path as SVGPathElement & { __wlc_handlers?: MapEventHandlers }).__wlc_handlers;

        if (!handlers) return;
        path.removeEventListener("mouseenter", handlers.onEnter);
        path.removeEventListener("mousemove", handlers.onMove);
        path.removeEventListener("mouseleave", handlers.onLeave);
      });
    };
  }, [
    svg,
    theme,
    activeSubregionName,
    mode,
    kind,
    ctx,
    unitKey,
    fractionDigits,
    note,
    overviewFields,
    inactiveOpacity,
  ]);

  return (
    <div className="position-relative w-100 h-100">
      <div
        id={`map-${theme}`}
        ref={containerRef}
        className="w-100 h-100"
        style={{ lineHeight: 0 }}
      />

      <div
        id={`map-tooltip-${theme}`}
        className="position-absolute small px-2 py-1 bg-dark text-white rounded"
        style={{
          display: "none",
          pointerEvents: "none",
          zIndex: 10,
          fontSize: "0.75rem",
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
}

function buildTooltipContent(args: {
  path: SVGPathElement;
  name: string;
  theme: string;
  mode: MapMode;

  kind?: MapFormatKind;
  ctx: FormatContext;
  unitKey?: UnitKey;
  fractionDigits?: number;
  note?: string;

  overviewFields?: [OverviewField, OverviewField, OverviewField];
}): string {
  const {
    path,
    name,
    theme,
    mode,
    kind,
    ctx,
    unitKey,
    fractionDigits,
    note,
    overviewFields,
  } = args;

  if (mode === "overview") {
    const fields: [OverviewField, OverviewField, OverviewField] =
      overviewFields ?? [
        {
          key: "data-immobilienpreis",
          label: "Immobilienpreise",
          kind: "kaufpreis_qm",
          ctx: "kpi",
          unitKey: "eur_per_sqm",
        },
        {
          key: "data-grundstueckspreis",
          label: "Grundstückspreise",
          kind: "grundstueck_qm",
          ctx: "kpi",
          unitKey: "eur_per_sqm",
        },
        {
          key: "data-mietpreis",
          label: "Mietpreise",
          kind: "miete_qm",
          ctx: "kpi",
          unitKey: "eur_per_sqm",
        },
      ];

    const rows = fields.map((f) => {
      const raw =
        path.getAttribute(f.key) ||
        (f.key === "data-immobilienpreis" ? path.getAttribute("data-value") : null) ||
        null;

      const num = toNumberOrNull(raw);

      const valueLine = formatMapValue(num, {
        kind: f.kind,
        ctx: f.ctx ?? "kpi",
        unitKey: f.unitKey,
        fractionDigits: f.fractionDigits,
      });

      const noteLine = f.note ? `<span style="opacity:.85">${escapeHtml(f.note)}</span>` : "";

      return noteLine
        ? `${escapeHtml(f.label)}: ${valueLine}<br>${noteLine}`
        : `${escapeHtml(f.label)}: ${valueLine}`;
    });

    return `<strong>${escapeHtml(name)}</strong><br>${rows.join("<br>")}`;
  }

  // singleValue
  const raw = path.getAttribute("data-value") || path.getAttribute(`data-${theme}`) || null;
  const num = toNumberOrNull(raw);

  const valueLine = formatMapValue(num, { kind: kind ?? "anzahl", ctx, unitKey, fractionDigits });
  const noteLine = note ? `<br><span style="opacity:.85">${escapeHtml(note)}</span>` : "";

  return `<strong>${escapeHtml(name)}</strong>: ${valueLine}${noteLine}`;
}

function toNumberOrNull(raw: string | null): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type FormatMapValueArgs = {
  kind: MapFormatKind;
  ctx: FormatContext;
  unitKey?: UnitKey;
  fractionDigits?: number;
};

/**
 * Zentrale Formatierung:
 * - Standard: formatMetric (utils/format.ts)
 * - fractionDigits: seltener Override, Einheit kommt weiterhin über unitKey
 * - "kaufpreisfaktor": solange nicht als FormatKind geführt, lokal als 1 Nachkommastelle, ohne Einheit
 */
function formatMapValue(value: number | null, args: FormatMapValueArgs): string {
  const { kind, ctx, unitKey, fractionDigits } = args;

  if (value === null || !Number.isFinite(value)) return "n.v.";

  if (typeof fractionDigits === "number") {
    const nf = new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    const s = nf.format(value);
    const u = unitKey ? getUnitLabel(unitKey) : "";
    return u ? `${s} ${u}` : s;
  }

  if (kind === "kaufpreisfaktor") {
    // Faktor: 1 Nachkommastelle, keine Einheit
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  }

  return formatMetric(value, {
    kind: kind as FormatKind,
    ctx,
    unit: unitKey ?? "none",
  });
}

function highlightActiveSubregion(
  svgRoot: SVGSVGElement,
  activeName: string,
  inactiveOpacity: number,
) {
  const normalizedActive = normalizeName(activeName);
  const paths = svgRoot.querySelectorAll<SVGPathElement>("path[data-name]");
  let matchFound = false;

  paths.forEach((path) => {
    const rawName = path.getAttribute("data-name") || "";
    const normalized = normalizeName(rawName);

    if (normalized === normalizedActive) {
      path.style.opacity = "1";
      matchFound = true;
    } else {
      path.style.opacity = String(inactiveOpacity);
    }
  });

  if (!matchFound) {
    paths.forEach((p) => {
      p.style.opacity = "1";
    });
  }
}


function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "-");
}

/**
 * Minimaler HTML-Escape für Tooltip-Strings (Sicherheit)
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
