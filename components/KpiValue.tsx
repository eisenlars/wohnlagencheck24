// components/KpiValue.tsx


import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { formatValueCtx, formatMetric, getUnitLabel } from "@/utils/format";

type KpiSize = "sm" | "md" | "lg" | "xl" | "ultra";

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
   * - string: wird als <img src=...> interpretiert
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

  // Größen-Token: zentral für Typografie
  const tokens = getSizeTokens(size);

  const justify =
    align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center";

  return (
    <div className={className} style={style}>
      {icon ? (
        <div className="d-flex justify-content-center mb-3">
          {typeof icon === "string" ? (
            <img
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

      <div
        className="d-flex"
        style={{
          justifyContent: justify,
          alignItems: "flex-end",
          gap: `${gap}px`,
          flexWrap: "wrap",
        }}
      >
        {resolved.map((it, idx) => (
          <KpiCell
            key={idx}
            item={it}
            fallbackKind={kind}
            fallbackUnitKey={unitKey}
            fallbackCtx={ctx}
            showUnit={showUnit}
            labelColor={labelColor}
            normalValueColor={normalValueColor}
            highlightValueColor={highlightValueColor}
            highlightBg={highlightBg}
            tokens={tokens}
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
  labelColor,
  normalValueColor,
  highlightValueColor,
  highlightBg,
  tokens,
  count,
}: {
  item: KpiDisplayItem;
  fallbackKind: FormatKind;
  fallbackUnitKey: UnitKey;
  fallbackCtx: FormatContext;
  showUnit: boolean;
  labelColor: string;
  normalValueColor: string;
  highlightValueColor: string;
  highlightBg: string;
  tokens: ReturnType<typeof getSizeTokens>;
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

  const valueFontSize = isHighlight ? tokens.valueHighlightSize : tokens.valueSize;
  const valueWeight = isHighlight ? tokens.valueHighlightWeight : tokens.valueWeight;

  // Sonderfall: count===1 => nochmal prominenter (analog "Highlight")
  // (tokens decken das ab; highlight ist ohnehin true)
  const valueColor = isHighlight ? highlightValueColor : normalValueColor;

  return (
    <div
      className="text-center"
      style={{
        padding: isHighlight && highlightBg !== "transparent" ? "0.35rem 0.65rem" : undefined,
        borderRadius: isHighlight && highlightBg !== "transparent" ? "0.75rem" : undefined,
        backgroundColor: isHighlight ? highlightBg : "transparent",
        minWidth: count === 1 ? "min(340px, 100%)" : undefined,
      }}
    >
      {item.label ? (
        <div
          className={item.labelClassName}
          style={{
            color: labelColor,
            fontSize: tokens.labelSize,
            marginBottom: "0.25rem",
            ...item.labelStyle,
          }}
        >
          {item.label}
        </div>
      ) : null}

      <div
        className={item.valueClassName}
        style={{
          color: valueColor,
          fontSize: valueFontSize,
          fontWeight: valueWeight,
          lineHeight: 1.05,
          ...item.valueStyle,
        }}
      >
        {showUnit && u && u.trim().length > 0 ? (
          <>
            {numberOnly}{" "}
            <small
              className={item.unitClassName}
              style={{
                fontSize: tokens.unitSize,
                fontWeight: tokens.unitWeight,
                color: valueColor,
                opacity: isHighlight ? 0.95 : 0.9,
                ...item.unitStyle,
              }}
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

function getSizeTokens(size: KpiSize) {
  // Default-Optik angelehnt an dein Preisspanne + bisherige KpiValue-Verwendung
  switch (size) {
    case "sm":
      return {
        labelSize: "0.8rem",
        valueSize: "1.1rem",
        valueWeight: 600,
        valueHighlightSize: "1.4rem",
        valueHighlightWeight: 800,
        unitSize: "0.85rem",
        unitWeight: 500,
      };
    case "md":
      return {
        labelSize: "0.85rem",
        valueSize: "1.4rem",
        valueWeight: 600,
        valueHighlightSize: "2.2rem",
        valueHighlightWeight: 800,
        unitSize: "1.0rem",
        unitWeight: 500,
      };
    case "lg":
      return {
        labelSize: "0.9rem",
        valueSize: "1.8rem",
        valueWeight: 650,
        valueHighlightSize: "2.8rem",
        valueHighlightWeight: 850,
        unitSize: "1.05rem",
        unitWeight: 550,
      };
    case "xl":
      return {
        labelSize: "0.95rem",
        valueSize: "2.2rem",
        valueWeight: 700,
        valueHighlightSize: "3.6rem",
        valueHighlightWeight: 900,
        unitSize: "1.1rem",
        unitWeight: 600,
      };
    case "ultra":
      // Für deine Map-Leitkennzahl (früher: "display-1" + eigener Style)
      return {
        labelSize: "0.95rem",
        valueSize: "3.2rem",
        valueWeight: 800,
        valueHighlightSize: "6.5rem",
        valueHighlightWeight: 900,
        unitSize: "1.25rem",
        unitWeight: 650,
      };
    default:
      return {
        labelSize: "0.85rem",
        valueSize: "1.4rem",
        valueWeight: 600,
        valueHighlightSize: "2.2rem",
        valueHighlightWeight: 800,
        unitSize: "1.0rem",
        unitWeight: 500,
      };
  }
}
