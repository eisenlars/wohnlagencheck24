// app/page.tsx oder app/(statisch)/page.tsx

import "./static.css"; // falls noch nicht eingebunden
import Link from "next/link";
import Image from "next/image";
import { getBundeslaender } from "@/lib/data";

// app/(statisch)/page.tsx (Ausschnitt)

export default async function HomePage() {
  const bundeslaender = await getBundeslaender();

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
              DATA-DRIVEN. EXPERT-LED.
            </p>

            <p className="home-cutout-text">
              Immobilienmarkt &amp; Standortprofile: Regionale Wohnlagenanalysen mit strukturierten Kennzahlen zu Preisen, Mieten und
              Standortfaktoren.
            </p>

            <div className="home-cutout-actions">
              {bundeslaender.map((bl) => (
                <Link
                  key={bl.slug}
                  href={`/immobilienmarkt/${bl.slug}`}
                  className="btn btn-outline-dark fw-semibold px-4 py-2"
                >
                  {bl.name}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </section>

      <section className="home-breaker">
        <div className="home-breaker-inner">
          <div className="home-breaker-left">
            <div className="home-breaker-claim">DATA-DRIVEN. EXPERT-LED.</div>
            <div className="home-breaker-subclaim">Harte Daten. Lokales Gespür.</div>
          </div>
          <div className="home-breaker-right">
            <p className="home-breaker-text">
              <span className="home-breaker-line">
                Wir verbinden harte Marktdaten mit lokaler Expertise, um Wohnlagen verlässlich
                einzuordnen.
              </span>
              
              
            </p>
          </div>
        </div>
      </section>

  
    </div>
  );
}
