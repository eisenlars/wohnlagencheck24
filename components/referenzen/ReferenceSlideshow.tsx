"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { RegionalReference } from "@/lib/referenzen";

type ReferenceSlideshowProps = {
  items: RegionalReference[];
};

export function ReferenceSlideshow(props: ReferenceSlideshowProps) {
  const { items } = props;
  const [index, setIndex] = useState(0);

  const safeItems = useMemo(() => items.filter((item) => item.imageUrl || item.title), [items]);

  useEffect(() => {
    if (safeItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % safeItems.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [safeItems.length]);

  if (safeItems.length === 0) return null;
  const active = safeItems[index] ?? safeItems[0];

  return (
    <section style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", fontWeight: 700, marginBottom: 8 }}>
        Referenzen aus der Region
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 360px) 1fr", gap: 18, alignItems: "stretch" }}>
        <div style={{ position: "relative", minHeight: 220, borderRadius: 14, overflow: "hidden", background: "#e2e8f0" }}>
          {active.imageUrl ? (
            <Image
              src={active.imageUrl}
              alt={active.title}
              fill
              sizes="(max-width: 900px) 100vw, 360px"
              unoptimized
              style={{ objectFit: "cover" }}
            />
          ) : null}
          {active.statusBadge ? (
            <span
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 2,
                borderRadius: 999,
                padding: "6px 10px",
                background: "#9a3412",
                color: "#fff7ed",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {active.statusBadge}
            </span>
          ) : null}
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>{active.title}</h3>
          <p style={{ color: "#334155" }}>{active.description || "Erfolgreich vermittelte Immobilie aus der Region."}</p>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
            {[active.city, active.district].filter(Boolean).join(" ") || "Region"}
          </p>
          {safeItems.length > 1 ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setIndex((index - 1 + safeItems.length) % safeItems.length)}
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setIndex((index + 1) % safeItems.length)}
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
              >
                ›
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
