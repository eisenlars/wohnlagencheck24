"use client";

import Link from "next/link";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MainNav } from "@/components/main-nav";
import { buildLocalizedHref } from "@/lib/public-locale-routing";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

export function HomeHeader({
  bundeslaender,
  text,
  locale = null,
  publicLocales,
}: {
  bundeslaender: BundeslandNavItem[];
  text: PortalSystemTextMap;
  locale?: string | null;
  publicLocales: Array<{ locale: string; label: string }>;
}) {
  return (
    <header className="site-header site-header--home border-bottom bg-white text-dark sticky-top">
      <nav className="navbar navbar-light bg-white">
        <div className="container d-flex align-items-center">
          <Link href={buildLocalizedHref(locale, "/")} className="navbar-brand brand-header d-flex align-items-center">
            <Image
              src="/logo/wohnlagencheck24.svg"
              alt="Immobilienmarkt & Standortprofile"
              className="brand-icon"
              width={35}
              height={35}
              priority
            />
          </Link>

          <div className="d-flex align-items-center ms-auto gap-3">
            <Link
              href="/immobilienbewertung"
              className="btn berater-button btn-sm rounded-pill px-3 fw-bold shadow-sm"
            >
              {text.price_check}
            </Link>

            <LanguageSwitcher locale={locale} items={publicLocales} />

            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="offcanvas"
              data-bs-target="#mainNavOffcanvas"
              aria-controls="mainNavOffcanvas"
              aria-label={text.open_navigation}
            >
              <span className="navbar-toggler-icon" />
            </button>
          </div>

          <div
            className="offcanvas offcanvas-end text-dark"
            tabIndex={-1}
            id="mainNavOffcanvas"
            aria-labelledby="mainNavOffcanvasLabel"
          >
            <div className="offcanvas-header border-bottom">
              <h5 className="offcanvas-title" id="mainNavOffcanvasLabel">{text.navigation}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label={text.close} />
            </div>
            <div className="offcanvas-body">
              <MainNav bundeslaender={bundeslaender} text={text} locale={locale} />
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
