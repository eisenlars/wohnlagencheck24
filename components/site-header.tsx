"use client";

import Link from "next/link";
import Image from "next/image";

import { MainNav } from "@/components/main-nav";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

type SiteHeaderProps = {
  bundeslaender: BundeslandNavItem[];
  showDesktopButtons?: boolean;
};

export function SiteHeader({ bundeslaender, showDesktopButtons = true }: SiteHeaderProps) {
  return (
    <header className="site-header site-header--default border-bottom bg-white text-dark sticky-top">
      <nav className="navbar navbar-light bg-white">
        <div className="container d-flex align-items-center position-relative">
          <div className="site-header-left d-flex align-items-center" style={{ flex: 1 }}>
            {showDesktopButtons ? (
              <>
                <Link
                  href="/immobilienbewertung"
                  className="btn berater-button btn-sm rounded-pill px-3 fw-bold shadow-sm d-none d-md-block"
                >
                  Preischeck
                </Link>
                <Link
                  href="/immobilienbewertung"
                  className="btn berater-button btn-sm rounded-pill px-3 fw-bold shadow-sm d-md-none"
                >
                  Preischeck
                </Link>
              </>
            ) : null}
          </div>

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

          <div className="site-header-right d-flex justify-content-end" style={{ flex: 1 }}>
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
