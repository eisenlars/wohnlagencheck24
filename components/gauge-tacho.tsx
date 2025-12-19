import React from "react";

type GaugeTachoProps = {
  value: number; // z. B. -100 .. 100
  min?: number;
  max?: number;
  backgroundLabel: string; // z. B. "Kauf" / "Miete"
  leftLabelLines: string[]; // z. B. ["Käufermarkt"]
  rightLabelLines: string[]; // z. B. ["Verkäufermarkt"]
  width?: number;
  height?: number;
};

function valueToAngle(
  value: number,
  {
    min = -100,
    max = 100,
    start = -90,
    end = 90,
  }: { min?: number; max?: number; start?: number; end?: number } = {},
): number {
  const clamped = Math.max(min, Math.min(max, value));
  const t = (clamped - min) / (max - min || 1);
  return start + t * (end - start);
}

export function GaugeTacho({
  value,
  min = -100,
  max = 100,
  backgroundLabel,
  leftLabelLines,
  rightLabelLines,
  width = 200,
  height = 120,
}: GaugeTachoProps) {
  const angle = valueToAngle(value, { min, max, start: -90, end: 90 });

  // Geometrie
  const cx = width / 2;
  const cy = height - 8; // Mittelpunkt unten → Halbkreis
  const ringStroke = 8;

  // Radius der Skala (Halbkreis)
  const R = width / 2 - 20;
  const rOuter = R + ringStroke / 2 + 2;

  const x0 = cx - R;
  const x1 = cx + R;
  const y = cy;

  const hubR = 4;
  const shaftW = 4;

  // Mittel-Label deutlich über der Nadel-Zone
  const centerLabelY = height / 2 - 0;

  // Seitenlabels: etwas ins Innere verschoben
  const leftOffset = R * 0.22;
  const rightOffset = R * 0.14; // kleiner = näher an der Mitte
  const sideLabelY = cy - R * 0.1;

  // Nadel-Geometrie (länger, aber unterhalb der Label-Zone)
  const headTopY = cy - R * 0.55; // Spitze Länge
  const headBaseY = cy - R * 0.4; // Schaft Länge
  const shaftY = headBaseY; // Schaft beginnt direkt an der Dreiecks-Basis

  // Labels-rendering:
  // - bei einer Zeile: reiner Text → kein dy, keine tspan-Verschiebung
  // - bei mehreren Zeilen: tspans mit relativen dy-Werten
  const renderLabelLines = (lines: string[]) => {
    if (!lines || lines.length === 0) return null;
    if (lines.length === 1) {
      return <>{lines[0]}</>;
    }
    return (
      <>
        {lines.map((line, i) => (
          <tspan key={i} dy={i === 0 ? "0em" : "1.2em"}>
            {line}
          </tspan>
        ))}
      </>
    );
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Marktspannungsanzeige ${backgroundLabel}`}
    >
      <defs>
        <linearGradient
          id="tacho-scale-grad"
          x1={x0}
          y1={y}
          x2={x1}
          y2={y}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#e0744f" />
          <stop offset="25%" stopColor="#ffe000" />
          <stop offset="50%" stopColor="#7fb36a" />
          <stop offset="75%" stopColor="#ffe000" />
          <stop offset="100%" stopColor="#e0744f" />
        </linearGradient>
      </defs>

      {/* Hintergrundkreis (leicht größer als Skala) */}
      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="rgba(255,255,255,0.9)"
      />

      {/* Track + Farbskala */}
      <path
        d={`M${x0},${y} A${R},${R} 0 0 1 ${x1},${y}`}
        stroke="rgba(0,0,0,0.06)"
        strokeWidth={ringStroke}
        fill="none"
      />
      <path
        d={`M${x0},${y} A${R},${R} 0 0 1 ${x1},${y}`}
        stroke="url(#tacho-scale-grad)"
        strokeWidth={ringStroke}
        fill="none"
        strokeLinecap="round"
      />

      {/* Basis-Hub-Kreis – Schwarz, als Halbkreis am unteren Rand sichtbar */}
      <circle
        cx={cx}
        cy={cy}
        r={4} 
        fill="#000"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1}
      />

      {/* Mittel-Label (Kauf / Miete) */}
      <text
        x={cx}
        y={centerLabelY}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="#333"
      >
        {backgroundLabel}
      </text>

      {/* Seitenlabels – bewusst in den Tacho hineingezogen */}
      <text
        x={cx - leftOffset}
        y={sideLabelY}
        textAnchor="end"
        dominantBaseline="middle"
        fontSize={8}
        fill="#555"
      >
        {renderLabelLines(leftLabelLines)}
      </text>

      <text
        x={cx + rightOffset}
        y={sideLabelY}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={8}
        fill="#555"
      >
        {renderLabelLines(rightLabelLines)}
      </text>

      {/* Zeiger – komplette Gruppe rotiert um cx, cy */}
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        {/* Schaft – an der Basis des Dreiecks ansetzend */}
        <rect
          x={cx - shaftW / 2}
          y={shaftY}
          width={shaftW}
          height={cy - shaftY - hubR * 0.4}
          rx={0}
          ry={0}
          fill="#000000"
        />
        {/* Spitze – sitzt direkt auf dem Schaft */}
        <polygon
          points={`${cx},${headTopY} ${cx - 5},${headBaseY} ${cx + 5},${headBaseY}`}
          fill="#000000"
        />
        {/* Kleine Nabe */}
        <circle
          cx={cx}
          cy={cy}
          r={hubR}
          fill="#000000"
        />
      </g>
    </svg>
  );
}
