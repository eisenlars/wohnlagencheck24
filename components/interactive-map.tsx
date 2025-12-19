"use client";

import React, { useEffect, useRef } from "react";

type MapMode = "singleValue" | "overview";

type InteractiveMapProps = {
  svg: string;
  theme: string;
  activeSubregionName?: string;
  mode?: MapMode;
};

export function InteractiveMap({
  svg,
  theme,
  activeSubregionName,
  mode = "singleValue",
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // SVG in den Container schreiben
    containerRef.current.innerHTML = svg;
    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    // Alle <title>-Tags entfernen, damit nur unser Tooltip aktiv ist
    svgElement.querySelectorAll("title").forEach((t) => t.remove());

    const tooltipEl = document.getElementById(
      `map-tooltip-${theme}`,
    ) as HTMLDivElement | null;

    const mapWrapperEl = document.getElementById(
      `map-${theme}`,
    ) as HTMLDivElement | null;

    const paths = Array.from(
      svgElement.querySelectorAll<SVGPathElement>("a path"),
    );

    paths.forEach((path) => {
      const name = path.getAttribute("data-name") || "";

      const onEnter = () => {
        if (!tooltipEl) return;
        tooltipEl.innerHTML = buildTooltipContent(path, name, theme, mode);
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

      // Cleanup bei Unmount / Dependency-Change
      (path as any).__wlc_handlers = { onEnter, onMove, onLeave };
    });

    if (activeSubregionName) {
      highlightActiveSubregion(svgElement, activeSubregionName);
    }

    return () => {
      paths.forEach((path) => {
        const handlers = (path as any).__wlc_handlers as
          | {
              onEnter: (e: MouseEvent) => void;
              onMove: (e: MouseEvent) => void;
              onLeave: () => void;
            }
          | undefined;

        if (!handlers) return;
        path.removeEventListener("mouseenter", handlers.onEnter);
        path.removeEventListener("mousemove", handlers.onMove);
        path.removeEventListener("mouseleave", handlers.onLeave);
      });
    };
  }, [svg, theme, activeSubregionName, mode]);

  return (
    <div className="position-relative w-100 h-100">
      {/* SVG-Container */}
      <div
        id={`map-${theme}`}
        ref={containerRef}
        className="w-100 h-100"
        style={{ lineHeight: 0 }}
      />

      {/* Tooltip-Overlay */}
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

/**
 * Tooltip-Content je Modus/Theme
 */
function buildTooltipContent(
  path: SVGPathElement,
  name: string,
  theme: string,
  mode: MapMode,
): string {
  if (mode === "overview") {
    // Beispiel für später: drei Kennzahlen etc.
    const iVal =
      path.getAttribute("data-immobilienpreis") ||
      path.getAttribute("data-value") ||
      "n.v.";
    const gVal = path.getAttribute("data-grundstueckspreis") || "n.v.";
    const mVal = path.getAttribute("data-mietpreis") || "n.v.";

    return (
      `<strong>${name}</strong><br>` +
      `Immobilienpreise: ${formatNumber(iVal)} €/m²<br>` +
      `Grundstückspreise: ${formatNumber(gVal)} €/m²<br>` +
      `Mietpreise: ${formatNumber(mVal)} €/m²`
    );
  }

  // Default: singleValue – z. B. Immobilienpreis-Karte mit data-value
  const raw =
    path.getAttribute("data-value") ||
    path.getAttribute(`data-${theme}`) ||
    "";
  const formatted = formatNumber(raw);

  return `<strong>${name}</strong>: ${formatted} €/m²`;
}

function formatNumber(raw: string): string {
  const num = Number(raw.replace(",", "."));
  if (!Number.isFinite(num)) return raw || "n.v.";
  return num.toLocaleString("de-DE");
}

/**
 * Aktive Subregion optisch hervorheben
 */
function highlightActiveSubregion(svgRoot: SVGSVGElement, activeName: string) {
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
      path.style.opacity = "0.4";
    }
  });

  if (!matchFound) {
    // Fallback: alles wieder normal
    paths.forEach((p) => {
      p.style.opacity = "1";
    });
  }
}

/**
 * Umlaut-/Sonderzeichen-Normalisierung
 */
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
