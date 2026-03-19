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
      <div style={spinnerStyle} />
    </div>
  );
}

const overlayStyle = (fixed: boolean): CSSProperties => ({
  position: fixed ? "fixed" : "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(248, 250, 252, 0.96)",
  zIndex: 1000,
});

const spinnerStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: "2.5px solid #d4dbe3",
  borderTopColor: "#0f172a",
  animation: "fullscreen-loader-spin 0.8s linear infinite",
};
