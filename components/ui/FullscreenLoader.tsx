"use client";

import type { CSSProperties } from "react";

type FullscreenLoaderProps = {
  show: boolean;
  label?: string;
  fixed?: boolean;
};

export default function FullscreenLoader({
  show,
  label = "Daten werden geladen...",
  fixed = true,
}: FullscreenLoaderProps) {
  if (!show) return null;

  return (
    <div style={overlayStyle(fixed)} role="status" aria-live="polite" aria-label={label}>
      <style>{`@keyframes fullscreen-loader-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={cardStyle}>
        <div style={spinnerStyle} />
        <div style={labelStyle}>{label}</div>
      </div>
    </div>
  );
}

const overlayStyle = (fixed: boolean): CSSProperties => ({
  position: fixed ? "fixed" : "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(248, 250, 252, 0.72)",
  backdropFilter: "blur(1px)",
  zIndex: 1000,
});

const cardStyle: CSSProperties = {
  minWidth: 220,
  maxWidth: 320,
  borderRadius: 14,
  border: "1px solid #dbeafe",
  background: "#ffffff",
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
  padding: "16px 18px",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const spinnerStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  border: "2px solid #dbeafe",
  borderTopColor: "#2563eb",
  animation: "fullscreen-loader-spin 0.8s linear infinite",
};

const labelStyle: CSSProperties = {
  fontSize: 14,
  color: "#334155",
  fontWeight: 600,
};
