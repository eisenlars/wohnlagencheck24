// app/layout.tsx

import type { Metadata } from "next";
import Link from "next/link";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import { MainNav } from "@/components/main-nav";
import { BootstrapClient } from "@/components/bootstrap-client";
import { getBundeslaender } from "@/lib/data";

export const metadata: Metadata = {
  title: "Wohnlagencheck24 – Wohnlagen & Standortanalysen",
  description:
    "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.",
  metadataBase: new URL("https://www.wohnlagencheck24.de"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Neue Datenquelle: Bundesländer als { slug, name }[]
  const bundeslaender = getBundeslaender();

  return (
    <html lang="de">
      <body className="bg-dark text-light">
        {/* Bootstrap-JS (Offcanvas, Toggler etc.) nur im Browser laden */}
        <BootstrapClient />

        <div className="d-flex flex-column min-vh-100">
          {/* HEADER */}
          <header className="border-bottom bg-white text-dark sticky-top">
            <nav className="navbar navbar-light bg-white">
              <div className="container d-flex justify-content-between align-items-center">
                {/* Logo / Brand */}
                <Link
                  href="/"
                  className="navbar-brand d-flex align-items-center gap-2"
                >
                  <div
                    className="d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "12px",
                      backgroundColor: "#0087CC",
                    }}
                  >
                    W
                  </div>
                  <div className="d-flex flex-column lh-sm">
                    <span className="fw-semibold">Wohnlagencheck24</span>
                    <small className="text-muted">
                      Immobilienmarkt &amp; Standortprofile
                    </small>
                  </div>
                </Link>

                {/* NAV-Icon: öffnet Offcanvas auf allen Geräten */}
                <button
                  className="navbar-toggler"
                  type="button"
                  data-bs-toggle="offcanvas"
                  data-bs-target="#mainNavOffcanvas"
                  aria-controls="mainNavOffcanvas"
                  aria-label="Navigation öffnen"
                >
                  <span className="navbar-toggler-icon" />
                </button>

                {/* Offcanvas-Menü */}
                <div
                  className="offcanvas offcanvas-end"
                  tabIndex={-1}
                  id="mainNavOffcanvas"
                  aria-labelledby="mainNavOffcanvasLabel"
                >
                  <div className="offcanvas-header">
                    <h5 className="offcanvas-title" id="mainNavOffcanvasLabel">
                      Navigation
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      data-bs-dismiss="offcanvas"
                      aria-label="Schließen"
                    />
                  </div>
                  <div className="offcanvas-body">
                    {/* Navigation: Einstiegslink + Bundesländer + weitere Inhalte */}
                    <MainNav bundeslaender={bundeslaender} />
                  </div>
                </div>
              </div>
            </nav>
          </header>

          {/* CONTENT-BEREICH */}
          <main className="flex-grow-1 py-4">
            <div className="container">
              <div
                className="card border-0 shadow-lg"
                style={{
                  borderRadius: "1.5rem",
                  backgroundColor: "var(--brand-bg)",
                }}
              >
                <div className="card-body p-4 p-md-5">{children}</div>
              </div>
            </div>
          </main>

          {/* FOOTER */}
          <footer className="border-top bg-black text-warning py-3 mt-4">
            <div className="container d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 small">
              <span>
                &copy; 2025 Wohnlagencheck24. Alle Rechte vorbehalten.
              </span>
              <div className="d-flex flex-wrap gap-3">
                <Link
                  href="/impressum"
                  className="text-warning text-decoration-none"
                >
                  Impressum
                </Link>
                <Link
                  href="/datenschutz"
                  className="text-warning text-decoration-none"
                >
                  Datenschutz
                </Link>
                <span className="text-warning-50">
                  Technische Demo · GEO &amp; LLM-optimiert
                </span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
