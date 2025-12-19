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
  const bundeslaender = getBundeslaender();

  return (
    <html lang="de">
      <body className="text-light">
        <BootstrapClient />

        <div className="d-flex flex-column min-vh-100">
          {/* HEADER */}
          <header className="border-bottom bg-white text-dark sticky-top">
            <nav className="navbar navbar-light bg-white">
              <div className="container d-flex align-items-center position-relative">
                {/* Logo / Brand */}
                <Link href="/" className="navbar-brand brand-header">
                  <img
                    src="/logo/wohnlagencheck24.svg"
                    alt="Immobilienmarkt & Standortprofile"
                    className="brand-icon"
                  />
                  <span className="brand-text">
                    <span className="brand-title">
                      Wohnlagencheck<span style={{ color: "#ffe000" }}>24</span>
                    </span>
                    <small>Immobilienmarkt &amp; Standortprofile</small>
                  </span>
                </Link>

                {/* NAV-Icon */}
                <button
                  className="navbar-toggler position-absolute end-0 me-2"
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
                    <MainNav bundeslaender={bundeslaender} />
                  </div>
                </div>
              </div>
            </nav>
          </header>

          {/* CONTENT-BEREICH – KEINE CARD */}
          <main className="flex-grow-1 py-4">
            {children}
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