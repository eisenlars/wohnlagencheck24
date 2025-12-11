import Image from "next/image";
import React from "react";

type RegionHeroProps = {
  title: string;
  subtitle?: string;
  imageSrc: string;
  rightOverlay?: React.ReactNode;
};

export function RegionHero({
  title,
  subtitle,
  imageSrc,
  rightOverlay,
}: RegionHeroProps) {
  return (
    <section className="mb-4">
      <div className="position-relative overflow-hidden rounded-4 shadow-sm">
        <div
          className="w-100"
          style={{
            aspectRatio: "21 / 6",
            position: "relative",
          }}
        >
          <Image
            src={imageSrc}
            alt={title}
            fill
            sizes="(min-width: 992px) 900px, 100vw"
            style={{ objectFit: "cover" }}
            priority
          />

          <div
            className="position-absolute top-0 start-0 w-100 h-100"
            style={{
              background:
                "linear-gradient(120deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 60%)",
            }}
          />

          <div className="position-absolute bottom-0 start-0 w-100 px-3 px-md-4 pb-0 text-white">
            <div className="d-flex flex-row justify-content-between align-items-end gap-4">

              {/* Text links */}
              <div className="flex-grow-1">
                <div className="small text-uppercase mb-1 opacity-75">
                  Regionale Standortaufnahme
                </div>
                <h1 className="h4 h3-md mb-1">{title}</h1>
                {subtitle && (
                  <p className="small mb-0 text-white-75">{subtitle}</p>
                )}
              </div>

              {/* Tachos / Kennzahlen rechts */}
              {rightOverlay && (
                <div
                  className="d-none d-md-flex flex-row gap-4 align-items-end"
                  style={{
                    marginBottom: "-12px",   // zieht die Tachos leicht über den Bildrand hinaus
                  }}
                >
                  {rightOverlay}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
