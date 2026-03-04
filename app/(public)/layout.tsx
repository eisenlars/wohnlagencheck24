import Link from "next/link";

import { BootstrapClient } from "@/components/bootstrap-client";
import { HeaderSwitch } from "@/components/header-switch";
import { KontaktOffcanvas } from "@/components/kontakt/KontaktOffcanvas";
import { KontaktProvider } from "@/components/kontakt/contact-context";
import { getBundeslaender } from "@/lib/data";
import { isBundeslandVisible } from "@/lib/area-visibility";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const bundeslaenderRaw = await getBundeslaender();
  const bundeslaender = (
    await Promise.all(
      bundeslaenderRaw.map(async (bl) => ((await isBundeslandVisible(bl.slug)) ? bl : null)),
    )
  ).filter((value): value is NonNullable<typeof value> => Boolean(value));

  return (
    <KontaktProvider>
      <div className="d-flex flex-column min-vh-100">
        <BootstrapClient />
        <a href="#main-content" className="skip-link">
          Zum Inhalt springen
        </a>
        <HeaderSwitch bundeslaender={bundeslaender} />

        <main id="main-content" className="flex-grow-1 py-2 py-md-4" tabIndex={-1}>
          {children}
        </main>

        <div
          className="offcanvas offcanvas-end text-dark"
          tabIndex={-1}
          id="kreisKontaktOffcanvas"
          aria-labelledby="kreisKontaktOffcanvasLabel"
        >
          <div className="offcanvas-header border-bottom">
            <h5 className="offcanvas-title" id="kreisKontaktOffcanvasLabel">
              Kontakt
            </h5>
            <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Schließen" />
          </div>
          <div className="offcanvas-body">
            <KontaktOffcanvas />
          </div>
        </div>

        <footer className="border-top bg-black text-warning py-3 mt-4">
          <div className="container d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 small">
            <span>&copy; 2025 Wohnlagencheck24. Alle Rechte vorbehalten.</span>
            <div className="d-flex flex-wrap gap-3">
              <Link href="/impressum" className="text-warning text-decoration-none">
                Impressum
              </Link>
              <Link href="/datenschutz" className="text-warning text-decoration-none">
                Datenschutz
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </KontaktProvider>
  );
}
