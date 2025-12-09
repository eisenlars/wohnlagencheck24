import type { Metadata } from "next";
import Link from "next/link";
import "bootstrap/dist/css/bootstrap.min.css"; // Bootstrap-CSS
import "./globals.css";
import { MainNav } from "@/components/main-nav";
import { getAllOrte } from "@/lib/data";

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
  const orte = getAllOrte();
  const bundeslaender = Array.from(
    new Set(orte.map((o) => o.bundesland))
  ).sort();

  return (
    <html lang="de">
      <body className="min-h-screen bg-black text-[#000000] antialiased">
        <div className="flex min-h-screen flex-col">
          {/* HEADER */}
          <header className="sticky top-0 z-20 border-b border-black/15 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              {/* Logo / Brand */}
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0087CC] text-white font-bold shadow-md">
                  W
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold sm:text-base">
                    Wohnlagencheck24
                  </span>
                  <span className="text-[11px] text-black/60 sm:text-xs">
                    Immobilienmarkt &amp; Standortprofile
                  </span>
                </div>
              </Link>

              {/* Navigation */}
              <MainNav bundeslaender={bundeslaender} />
            </div>
          </header>

          {/* CONTENT-BEREICH */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
              <div className="relative rounded-3xl border border-black/15 bg-[#bcaf9d] shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                {/* dezenter gelber Glow */}
                <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_top_left,#ffe00066,transparent_60%)] opacity-70 blur-2xl" />
                <div className="relative px-4 py-6 sm:px-8 sm:py-8">
                  {children}
                </div>
              </div>
            </div>
          </main>

          {/* FOOTER */}
          <footer className="border-t border-black/30 bg-black text-[#ffe000]">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
              <span>
                &copy; 2025 Wohnlagencheck24. Alle Rechte vorbehalten.
              </span>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/impressum"
                  className="hover:text-white transition-colors"
                >
                  Impressum
                </Link>
                <Link
                  href="/datenschutz"
                  className="hover:text-white transition-colors"
                >
                  Datenschutz
                </Link>
                <span className="text-[11px] text-[#ffe000]/80">
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
