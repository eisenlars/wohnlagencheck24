"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  DEFAULT_PUBLIC_LOCALE,
  buildLocalizedHref,
  normalizePublicLocale,
  stripLeadingLocale,
} from "@/lib/public-locale-routing";

type LanguageSwitcherItem = {
  locale: string;
  label: string;
};

type LanguageSwitcherProps = {
  locale?: string | null;
  items: LanguageSwitcherItem[];
};

function isLocaleSwitchablePath(pathname: string): boolean {
  return (
    pathname === "/"
    || pathname === "/kontakt"
    || pathname === "/impressum"
    || pathname === "/datenschutz"
    || pathname.startsWith("/immobilienmarkt")
  );
}

function buildLocaleHref(targetLocale: string, pathname: string): string {
  if (targetLocale === DEFAULT_PUBLIC_LOCALE) return pathname || "/";
  return buildLocalizedHref(targetLocale, pathname || "/");
}

export function LanguageSwitcher({ locale = null, items }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const activeLocale = normalizePublicLocale(locale);
  const localeAwarePath = stripLeadingLocale(pathname || "/").pathname;

  const visibleItems = useMemo(() => {
    const unique = new Map<string, LanguageSwitcherItem>();
    for (const item of items) {
      const normalized = normalizePublicLocale(item.locale);
      if (!unique.has(normalized)) {
        unique.set(normalized, {
          locale: normalized,
          label: item.label || normalized.toUpperCase(),
        });
      }
    }
    if (!unique.has(DEFAULT_PUBLIC_LOCALE)) {
      unique.set(DEFAULT_PUBLIC_LOCALE, { locale: DEFAULT_PUBLIC_LOCALE, label: "Deutsch" });
    }
    return Array.from(unique.values()).sort((left, right) => {
      if (left.locale === activeLocale) return -1;
      if (right.locale === activeLocale) return 1;
      return left.label.localeCompare(right.label, "de");
    });
  }, [activeLocale, items]);

  if (!isLocaleSwitchablePath(localeAwarePath) || visibleItems.length < 2) return null;

  const activeItem = visibleItems.find((item) => item.locale === activeLocale) ?? visibleItems[0];

  return (
    <div className="dropdown">
      <button
        className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-semibold language-switcher-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        {activeItem.locale.toUpperCase()}
      </button>
      <ul className="dropdown-menu dropdown-menu-end shadow-sm language-switcher-menu">
        {visibleItems.map((item) => {
          const href = buildLocaleHref(item.locale, localeAwarePath);
          const active = item.locale === activeLocale;
          return (
            <li key={item.locale}>
              <Link
                href={href}
                className={`dropdown-item d-flex align-items-center justify-content-between gap-3${active ? " active" : ""}`}
              >
                <span>{item.label}</span>
                <strong style={{ fontSize: 12, letterSpacing: 0.4 }}>{item.locale.toUpperCase()}</strong>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
