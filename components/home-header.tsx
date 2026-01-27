"use client";

import Link from "next/link";
import Image from "next/image";

import { MainNav } from "@/components/main-nav";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

export function HomeHeader({ bundeslaender }: { bundeslaender: BundeslandNavItem[] }) {
  return (
    <header className="site-header site-header--home border-bottom bg-white text-dark sticky-top">
      <nav className="navbar navbar-light bg-white">
        <div className="container d-flex align-items-center">
          <Link href="/" className="navbar-brand brand-header d-flex align-items-center">
            <Image
              src="/logo/wohnlagencheck24.svg"
              alt="Immobilienmarkt & Standortprofile"
              className="brand-icon"
              width={35}
              height={35}
              priority
            />
          </Link>

          <div className="d-flex align-items-center ms-auto gap-4">
            <Link
              href="/immobilienbewertung"
              className="btn berater-button btn-sm rounded-pill px-3 fw-bold shadow-sm"
            >
              Preischeck
            </Link>

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
  );
}
