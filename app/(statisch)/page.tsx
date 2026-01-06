// app/page.tsx oder app/(statisch)/page.tsx

import "./static.css"; // falls noch nicht eingebunden
import Image from "next/image";

// app/(statisch)/page.tsx (Ausschnitt)

export default function HomePage() {
  return (
    <div className="home-page-root">
      {/* HERO: Deutschland-Maske links, Logo + Claim rechts */}
      <section className="home-cutout-section">
        <div className="home-cutout-inner">
          
          {/* Links: große Deutschland-Maske mit Video/Bild */}
          <div className="home-cutout-media-col">
            <div className="home-cutout-frame">
              <video
                src="/video/wohnlagencheck24-trailer.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="home-cutout-media"
              />
            </div>
          </div>

          {/* Rechts: Logo + Portalinfo */}
          <div className="home-cutout-brand-col">
            <Image
              src="/logo/wohnlagencheck24.svg"
              alt="Wohnlagencheck24 – Immobilienmarkt & Standortprofile"
              className="home-cutout-logo"
              width={240}
              height={72}
              priority
            />

            <h1 className="home-cutout-title">
              Wohnlagencheck<span style={{ color: "#ffe000" }}>24</span>
            </h1>

            <p className="home-cutout-claim">
              Immobilienmarkt &amp; Standortprofile
            </p>

            <p className="home-cutout-text">
              Regionale Wohnlagenanalysen mit strukturierten Kennzahlen zu Preisen, Mieten und
              Standortfaktoren.
            </p>
          </div>

        </div>
      </section>

      {/* Danach dein bisheriger Startseiten-Content */}
      <div className="home-page-root-inner">
        {/* Konzept, Immobilienmarkt & Standortprofile, Bundesländer-Liste usw. */}
        {/* ... */}
      </div>
    </div>
  );
}
