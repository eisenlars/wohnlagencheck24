import React from "react";

type RegionHeroProps = {
  title: string;
  subtitle?: string;
  imageSrc: string;
  rightOverlay?: React.ReactNode;
  rightOverlayMode?: "tachos" | "buttons";
};

export function RegionHero({
  title,
  subtitle,
  imageSrc,
  rightOverlay,
  rightOverlayMode = "tachos",
}: RegionHeroProps) {
  return (
    <section className="mb-4">
      <div className="position-relative overflow-hidden rounded-4 shadow-sm">
        <div
          className="region-hero-media region-hero-parallax"
          style={{ backgroundImage: `url(${imageSrc})` }}
        >
          <div className="region-hero-gradient" />

          <div className="region-hero-content d-flex flex-column justify-content-start">
            <div className="px-3 px-md-4 pt-4 text-white region-hero-text">
              <div className="small text-uppercase mb-1 opacity-85">
                Standortaufnahme
              </div>

              <h4 className="h4 h3-md mb-1">{title}</h4>

              {subtitle && (
                <p
                  className="small mb-2 text-white-75"
                  style={{ fontSize: "0.70rem" }}
                >
                  Quelle: {subtitle}
                </p>
              )}
            </div>

            {/* TACHO-BEREICH */}
            {rightOverlay && rightOverlayMode === "tachos" && (
              <div className="mt-auto pb-3 d-flex justify-content-center w-100">
                <div
                  className="hero-tacho-row d-flex flex-row gap-4 align-items-end justify-content-center"
                  style={{ marginBottom: "-24px" }}
                >
                  {rightOverlay}
                </div>
              </div>
            )}

            {/* BUTTON-BEREICH */}
            {rightOverlay && rightOverlayMode === "buttons" && (
              <div className="mt-auto d-flex justify-content-center w-100">
                <div
                  className="d-flex flex-row gap-2 justify-content-center"
                  style={{
                    marginBottom: 0,
                    paddingBottom: 0,
                    maxWidth: "360px",
                    width: "100%",
                  }}
                >
                  {rightOverlay}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
