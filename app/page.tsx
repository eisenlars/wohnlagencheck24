import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { MainNav } from "@/components/main-nav";
import { getAllOrte } from "@/lib/data";

export const metadata: Metadata = {
  title: "Wohnlagencheck24 – Wohnlagen & Standortanalysen",
  description:
    "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orte = getAllOrte();
  const bundeslaender = Array.from(
    new Set(orte.map((o) => o.bundesland))
  ).sort();

  return (
    <html lang="de">
      <body>
        <div className="d-flex flex-column min-vh-100 bg-dark text-light">
          {/* HEADER mit Bootstrap-Navbar */}
          <header className="border-bottom bg-white text-dark">
            <nav className="navbar navbar-expand-md navbar-light bg-white">
              <div className="container">
                {/* Brand */}
                <Link href="/" className="navbar-brand d-flex align-items-center gap-2">
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "12px",
                      backgroundColor: "#0087CC",
                    }}
                    className="d-flex align-items-center justify-content-center text-white fw-bold"
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

                {/* Toggle-Button für Mobile */}
                <button
                  className="navbar-toggler"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#mainNavbar"
                  aria-controls="mainNavbar"
                  aria-expanded="false"
                  aria-label="Navigation umschalten"
                >
                  <span className="navbar-toggler-icon"></span>
                </button>

                {/* Nav-Inhalt (wir nutzen hier deine MainNav-Logik, aber Bootstrap-Styling außenrum) */}
                <div className="collapse navbar-collapse" id="mainNavbar">
                  <div className="ms-auto">
                    <MainNav bundeslaender={bundeslaender} />
                  </div>
                </div>
              </div>
            </nav>
          </header>

          {/* CONTENT-BEREICH: zentrale Card */}
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
                &copy; {new Date().getFullYear()} Wohnlagencheck24. Alle Rechte
                vorbehalten.
              </span>
              <div className="d-flex flex-wrap gap-3">
                <Link href="/impressum" className="text-warning text-decoration-none">
                  Impressum
                </Link>
                <Link href="/datenschutz" className="text-warning text-decoration-none">
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
