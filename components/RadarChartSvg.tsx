import React from "react";

type RadarPoint = {
  label: string;
  value: number;
  color?: string;
};

type RadarChartSvgProps = {
  title?: string;
  points: RadarPoint[];
  size?: number;
  maxValue?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function RadarChartSvg({
  title,
  points,
  size = 630,
  maxValue = 10,
}: RadarChartSvgProps) {
  const safePoints = (points ?? []).filter((p) => p.label);
  if (!safePoints.length) {
    return <p className="small text-muted mb-0">Für diese Auswertung liegen aktuell keine Daten vor.</p>;
  }

  const radius = size / 2 - 30;
  const center = size / 2;
  const steps = 10;
  const angleStep = (Math.PI * 2) / safePoints.length;
  const viewPad = 24;

  const pointCoords = safePoints.map((p, idx) => {
    const value = clamp(p.value, 0, maxValue);
    const ratio = value / maxValue;
    const angle = angleStep * idx - Math.PI / 2;
    const x = center + Math.cos(angle) * radius * ratio;
    const y = center + Math.sin(angle) * radius * ratio;
    return { x, y, angle, label: p.label, value };
  });

  const polygonPoints = pointCoords.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="text-center">
      {title ? <h3 className="h3 mb-4">{title}</h3> : null}
      <svg
        role="img"
        aria-label={title ? `${title} – Radar` : "Standortfaktoren – Radar"}
        viewBox={`${-viewPad} ${-viewPad} ${size + viewPad * 2} ${size + viewPad * 2}`}
        width="100%"
        height={size}
        style={{ maxWidth: 840, margin: "0 auto", display: "block" }}
      >
        {Array.from({ length: steps }).map((_, i) => {
          const r = radius * ((i + 1) / steps);
          return (
            <circle
              key={`grid-${i}`}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="rgba(100,116,139,0.25)"
              strokeWidth="1"
            />
          );
        })}

        {pointCoords.map((p, idx) => {
          const x = center + Math.cos(p.angle) * radius;
          const y = center + Math.sin(p.angle) * radius;
          return (
            <line
              key={`axis-${idx}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(100,116,139,0.4)"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(54,162,235,0.25)"
          stroke="rgb(59,130,246)"
          strokeWidth="2"
        />

        {pointCoords.map((p, idx) => (
          <circle key={`dot-${idx}`} cx={p.x} cy={p.y} r={3} fill="rgb(59,130,246)" />
        ))}

        {pointCoords.map((p, idx) => {
          const labelRadius = radius + 18;
          const lx = center + Math.cos(p.angle) * labelRadius;
          const ly = center + Math.sin(p.angle) * labelRadius;
          const anchor = Math.cos(p.angle) > 0.2 ? "start" : Math.cos(p.angle) < -0.2 ? "end" : "middle";
          const dy = Math.sin(p.angle) > 0.2 ? 12 : Math.sin(p.angle) < -0.2 ? -6 : 4;
          return (
            <text
              key={`label-${idx}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              fontSize="13"
              fill="#0f172a"
              dy={dy}
            >
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
