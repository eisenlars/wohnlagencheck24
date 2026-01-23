// app/layout.tsx

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import { MainNav } from "@/components/main-nav";
import { BootstrapClient } from "@/components/bootstrap-client";
import { getBundeslaender } from "@/lib/data";
import { KontaktProvider } from "@/components/kontakt/contact-context";
import { KontaktOffcanvas } from "@/components/kontakt/KontaktOffcanvas";

export const metadata: Metadata = {
  title: "Wohnlagencheck24 – Wohnlagen & Standortanalysen",
  description: "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bundeslaender = getBundeslaender();

  return (
    <html lang="de">
      <body className="text-light">
        <BootstrapClient />
        <KontaktProvider>
          <div className="d-flex flex-column min-vh-100">
            
            {/* HEADER - Wieder in voller Höhe und mit ursprünglicher Brand-Logik */}
            <header className="border-bottom bg-white text-dark sticky-top">
              <nav className="navbar navbar-light bg-white">
                <div className="container d-flex align-items-center position-relative">
                  
                  {/* LINKS: Wertermittlung Button (Neu hinzugefügt) */}
                  <div className="d-flex align-items-center" style={{ flex: 1 }}>
                    <Link 
                      href="/immobilienbewertung" 
                      className="btn berater-button btn-sm rounded-pill px-3 fw-bold shadow-sm d-none d-md-block"
                    >
                      KI Bewertung
                    </Link>
                  </div>

                  {/* MITTE: Logo & Text (Wieder mit voller Brand-Struktur) */}
                  <Link href="/" className="navbar-brand brand-header d-flex align-items-center mx-auto">
                    <Image
                      src="/logo/wohnlagencheck24.svg"
                      alt="Immobilienmarkt & Standortprofile"
                      className="brand-icon"
                      width={48}
                      height={48}
                      priority
                    />
                    <span className="brand-text ms-2">
                      <span className="brand-title">
                        Wohnlagencheck<span style={{ color: "#ffe000" }}>24</span>
                      </span>
                      <small className="d-block text-muted">DATA-DRIVEN. EXPERT-LED.</small>
                    </span>
                  </Link>

                  {/* RECHTS: Nav-Icon */}
                  <div className="d-flex justify-content-end" style={{ flex: 1 }}>
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
                  </div>

                  {/* Offcanvas-Menü */}
                  <div
                    className="offcanvas offcanvas-end text-dark"
                    tabIndex={-1}
                    id="mainNavOffcanvas"
                    aria-labelledby="mainNavOffcanvasLabel"
                  >
                    <div className="offcanvas-header border-bottom">
                      <h5 className="offcanvas-title" id="mainNavOffcanvasLabel">Navigation</h5>
                      <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Schließen" />
                    </div>
                    <div className="offcanvas-body">
                      <MainNav bundeslaender={bundeslaender} />
                    </div>
                  </div>
                </div>
              </nav>
            </header>

            {/* CONTENT - Mit py-4 für den ursprünglichen Abstand zwischen Header und Inhalten */}
            <main className="flex-grow-1 py-4">
              {children}
            </main>

            <div
              className="offcanvas offcanvas-end text-dark"
              tabIndex={-1}
              id="kreisKontaktOffcanvas"
              aria-labelledby="kreisKontaktOffcanvasLabel"
            >
              <div className="offcanvas-header border-bottom">
                <h5 className="offcanvas-title" id="kreisKontaktOffcanvasLabel">Kontakt</h5>
                <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Schließen" />
              </div>
              <div className="offcanvas-body">
                <KontaktOffcanvas />
              </div>
            </div>

            {/* FOOTER */}
            <footer className="border-top bg-black text-warning py-3 mt-4">
              <div className="container d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 small">
                <span>&copy; 2025 Wohnlagencheck24. Alle Rechte vorbehalten.</span>
                <div className="d-flex flex-wrap gap-3">
                  <Link href="/impressum" className="text-warning text-decoration-none">Impressum</Link>
                  <Link href="/datenschutz" className="text-warning text-decoration-none">Datenschutz</Link>
                </div>
              </div>
            </footer>
          </div>
        </KontaktProvider>
      </body>
    </html>
  );
}
