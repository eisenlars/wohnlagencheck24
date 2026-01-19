// components/KpiValue.tsx


import React from "react";
import Image from "next/image";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatValueCtx, formatMetric, getUnitLabel } from "@/utils/format";

type KpiSize = "sm" | "md" | "lg" | "xl" | "ultra" | "mega";

type KpiDisplayItem = {
  /** Optionales Label oberhalb des Werts (z.B. "min", "Ø", "max", "Warmmiete") */
  label?: string;

  /** Rohwert */
  value: number | null;

  /** Optional: pro Item überschreiben (selten nötig) */
  kind?: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;

  /** Optional: z.B. Tendenzen mit Vorzeichen */
  signed?: boolean;

  /** Optional: individuelle Formatierung per Item */
  valueClassName?: string;
  labelClassName?: string;
  unitClassName?: string;
  valueStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  unitStyle?: React.CSSProperties;

  /** Optional: Zelle hervorheben */
  highlight?: boolean;
};

type KpiValueProps = {
  /**
   * Primärmodus: mehrere KPI-Items.
   * - 1 Item => prominent (Highlight-Look)
   * - 2 Items => nebeneinander, gleich formatiert
   * - 3+ Items => nebeneinander, optional ein Item highlighten
   */
  items?: KpiDisplayItem[];

  /**
   * Legacy/Convenience: einzelner Inline-Wert (ersetzt alte KpiValue.tsx)
   * Wenn gesetzt und items nicht gesetzt sind, wird ein einzelnes Item gerendert.
   */
  value?: number | null;
  kind?: FormatKind;
  unitKey?: UnitKey;
  ctx?: FormatContext;

  /**
   * Optionales Icon über dem Block (mittig).
   * - string: wird als Bildpfad interpretiert
   * - ReactNode: z.B. <MySvg />
   */
  icon?: string | React.ReactNode;
  iconAlt?: string;
  iconSize?: number; // px

  /** Layout / Spacing */
  gap?: number; // Bootstrap gap (z.B. 3/4) oder CSS px über styles – wir nutzen inline gap via style
  className?: string;
  style?: React.CSSProperties;

  /** Optik */
  size?: KpiSize;
  align?: "start" | "center" | "end";

  /** Farben / Hinterlegung für Highlight */
  highlightBg?: string; // z.B. "#c8d54f"
  highlightValueColor?: string; // z.B. "#486b7a"
  normalValueColor?: string; // z.B. "#6c757d"
  labelColor?: string; // z.B. "#6c757d"

  /** Für Tabellen/Karten-KPIs ohne Unit im Value-String */
  showUnit?: boolean; // default true (Unit wird als <small> neben Zahl gerendert)
  
  /** caption - Zusätzliche Erläuterung */
  caption?: string;
  captionClassName?: string;
  captionStyle?: React.CSSProperties;

  
  
};

/**
 * Einheitliche KPI-Komponente für 1–n Werte.
 * Formatiert ausschließlich über utils/format.ts (zentral).
 */
export function KpiValue(props: KpiValueProps) {
  const {
    items,
    value,
    kind = "kaufpreis_qm",
    unitKey = "none",
    ctx = "kpi",

    icon,
    iconAlt = "",
    iconSize = 34,

    gap = 28,
    className,
    style,

    size = "md",
    align = "center",

    highlightBg = "transparent",
    highlightValueColor = "#486b7a",
    normalValueColor = "#6c757d",
    labelColor = "#6c757d",

    showUnit = true,
    
    caption, 
    captionClassName, 
    captionStyle,
    
    
  } = props;

  // Items normalisieren: entweder props.items oder single value
  const normalizedItems: KpiDisplayItem[] = Array.isArray(items)
    ? items
    : [
        {
          value: value ?? null,
          kind,
          unitKey,
          ctx,
        },
      ];

  // leere items raus (aber NICHT alle wegfiltern -> wenn komplett leer, return null)
  const visible = normalizedItems.filter((it) => it && (it.value === null || Number.isFinite(it.value)));

  if (!visible.length) return null;

  // Wenn nur 1 Wert: automatisch prominent
  const count = visible.length;

  // Default-Highlight-Strategie:
  // - 1 Item: highlight
  // - 2 Items: kein highlight
  // - 3 Items: wenn genau eins highlight==true ist, ok; sonst: mittleres highlighten
  let resolved = visible.map((it) => ({ ...it }));

  const explicitHighlightCount = resolved.filter((x) => x.highlight).length;

  if (count === 1) {
    resolved[0].highlight = true;
  } else if (count === 2) {
    resolved = resolved.map((it) => ({ ...it, highlight: false }));
  } else {
    if (explicitHighlightCount === 0) {
      const mid = Math.floor(count / 2);
      resolved[mid].highlight = true;
    }
  }

  return (
    <div
      className={[
        "kpi",
        `kpi-size-${size}`,
        `kpi-align-${align}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...style,
        ["--kpi-gap" as string]: `${gap}px`,
        ["--kpi-highlight-bg" as string]: highlightBg,
        ["--kpi-highlight-color" as string]: highlightValueColor,
        ["--kpi-value-color" as string]: normalValueColor,
        ["--kpi-label-color" as string]: labelColor,
      }}
    >
      {icon ? (
        <div className="d-flex justify-content-center mb-3">
          {typeof icon === "string" ? (
            <Image
              src={icon}
              alt={iconAlt}
              width={iconSize}
              height={iconSize}
              style={{ display: "block" }}
            />
          ) : (
            <div style={{ width: iconSize, height: iconSize, display: "grid", placeItems: "center" }}>
              {icon}
            </div>
          )}
        </div>
      ) : null}

      <div className="kpi-row">
        {resolved.map((it, idx) => (
          <KpiCell
            key={idx}
            item={it}
            fallbackKind={kind}
            fallbackUnitKey={unitKey}
            fallbackCtx={ctx}
            showUnit={showUnit}
            highlightBg={highlightBg}
            count={count}
          />
        ))}
      </div>
      
      
      {caption ? (
        <div
          className={captionClassName ?? "small text-muted text-center mt-2"}
          style={captionStyle}
        >
          {caption}
        </div>
      ) : null}
      
      
      
      
    </div>
  );
}

function KpiCell({
  item,
  fallbackKind,
  fallbackUnitKey,
  fallbackCtx,
  showUnit,
  highlightBg,
  count,
}: {
  item: KpiDisplayItem;
  fallbackKind: FormatKind;
  fallbackUnitKey: UnitKey;
  fallbackCtx: FormatContext;
  showUnit: boolean;
  highlightBg: string;
  count: number;
}) {
  const kind = item.kind ?? fallbackKind;
  const unitKey = item.unitKey ?? fallbackUnitKey;
  const ctx = item.ctx ?? fallbackCtx;

  const isValid = item.value !== null && Number.isFinite(item.value);
  const u = unitKey ? getUnitLabel(unitKey) : "";

  // Zahl ohne Einheit (Unit separat als <small>)
  const numberOnly = formatValueCtx(isValid ? item.value : null, kind, ctx);

  // Alternativ: Zahl+Einheit in einem String (wenn showUnit=false)
  const combined = formatMetric(isValid ? item.value : null, {
    kind,
    ctx,
    unit: unitKey ?? "none",
    signed: item.signed ?? false,
  });

  const isHighlight = !!item.highlight;

  // Sonderfall: count===1 => nochmal prominenter (analog "Highlight")
  // (tokens decken das ab; highlight ist ohnehin true)
  return (
    <div
      className={[
        "kpi-cell",
        isHighlight ? "kpi-cell--highlight" : null,
        isHighlight && highlightBg !== "transparent" ? "kpi-cell--with-bg" : null,
        count === 1 ? "kpi-cell--single" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {item.label ? (
        <div
          className={["kpi-label", item.labelClassName].filter(Boolean).join(" ")}
          style={item.labelStyle}
        >
          {item.label}
        </div>
      ) : null}

      <div
        className={["kpi-value", item.valueClassName].filter(Boolean).join(" ")}
        style={item.valueStyle}
      >
        {showUnit && u && u.trim().length > 0 ? (
          <>
            {numberOnly}{" "}
            <small
              className={["kpi-unit", item.unitClassName].filter(Boolean).join(" ")}
              style={item.unitStyle}
            >
              {u}
            </small>
          </>
        ) : (
          combined
        )}
      </div>
    </div>
  );
}
