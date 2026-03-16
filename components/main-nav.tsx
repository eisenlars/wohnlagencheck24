// components/main-nav.tsx

"use client";

import Link from "next/link";
import { useCallback } from "react";
import { buildLocalizedHref } from "@/lib/public-locale-routing";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

type MainNavProps = {
  bundeslaender: BundeslandNavItem[];
  locale?: string | null;
};

export function MainNav({ bundeslaender, locale = null }: MainNavProps) {
  const text = getPortalSystemTexts(locale);
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
          href={buildLocalizedHref(locale, "/")}
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          {text.market_profiles}
        </Link>
      </li>

      {/* Bundesländer als Unterpunkte */}
      {bundeslaender.map((bl) => (
        <li className="nav-item mb-1 ms-3" key={bl.slug}>
          <Link
            href={buildLocalizedHref(locale, `/immobilienmarkt/${bl.slug}`)}
            className="nav-link px-0 small"
            onClick={handleNavClick}
          >
            {bl.name}
          </Link>
        </li>
      ))}

      <li className="nav-item mt-3">
        <Link
          href={buildLocalizedHref(locale, "/kontakt#konzept")}
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          {text.concept}
        </Link>
      </li>
      <li className="nav-item">
        <Link
          href={buildLocalizedHref(locale, "/kontakt#inhalte")}
          className="nav-link px-0"
          onClick={handleNavClick}
        >
          {text.more_content}
        </Link>
      </li>
    </ul>
  );
}
