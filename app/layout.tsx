// app/layout.tsx

import type { Metadata } from "next";
import Link from "next/link";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import { BootstrapClient } from "@/components/bootstrap-client";
import { HeaderSwitch } from "@/components/header-switch";
import { getBundeslaender } from "@/lib/data";
import { KontaktProvider } from "@/components/kontakt/contact-context";
import { KontaktOffcanvas } from "@/components/kontakt/KontaktOffcanvas";

export const metadata: Metadata = {
  title: "Wohnlagencheck24 – Wohnlagen & Standortanalysen",
  description: "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const bundeslaender = await getBundeslaender();

  return (
    <html lang="de">
      <body className="text-light">
        <BootstrapClient />
        <KontaktProvider>
          <div className="d-flex flex-column min-vh-100">
            
            <HeaderSwitch bundeslaender={bundeslaender} />

            {/* CONTENT - Mit py-4 für den ursprünglichen Abstand zwischen Header und Inhalten */}
            <main className="flex-grow-1 py-2 py-md-4">
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
