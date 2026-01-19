// components/main-nav.tsx

"use client";

import Link from "next/link";
import { useCallback } from "react";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

type MainNavProps = {
  bundeslaender: BundeslandNavItem[];
};

export function MainNav({ bundeslaender }: MainNavProps) {
  const handleNavClick = useCallback(() => {
    if (typeof document === "undefined") return;

    // Offcanvas-Element holen
    const offcanvasEl = document.getElementById("mainNavOffcanvas");
    if (!offcanvasEl) return;

    // Den Close-Button im Offcanvas finden
    const closeButton = offcanvasEl.querySelector(
      "[data-bs-dismiss='offcanvas']"
    ) as HTMLButtonElement | null;

    // Wenn vorhanden: Klick simulieren → Bootstrap schließt das Offcanvas
    if (closeButton) {
      closeButton.click();
    }
  }, []);

  return (
    <ul className="navbar-nav">
      {/* Einstieg zu den Standortprofilen */}
      <li className="nav-item mb-2">
        <Link
          href="/immobilienmarkt"
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          Immobilienmarkt &amp; Standortprofile
        </Link>
      </li>

      {/* Bundesländer als Unterpunkte */}
      {bundeslaender.map((bl) => (
        <li className="nav-item mb-1 ms-3" key={bl.slug}>
          <Link
            href={`/immobilienmarkt/${bl.slug}`}
            className="nav-link px-0 small"
            onClick={handleNavClick}
          >
            {bl.name}
          </Link>
        </li>
      ))}

      <li className="nav-item mt-3">
        <Link
          href="/#konzept"
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          Konzept
        </Link>
      </li>
      <li className="nav-item">
        <Link
          href="/#inhalte"
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          Weitere Inhalte
        </Link>
      </li>
      <li className="nav-item">
        <Link
          href="/musterseite"
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          Musterseite
        </Link>
      </li>
    </ul>
  );
}
