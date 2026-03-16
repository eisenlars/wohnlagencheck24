"use client";

import { usePathname } from "next/navigation";
import { stripLeadingLocale } from "@/lib/public-locale-routing";

import { HomeHeader } from "@/components/home-header";
import { SiteHeader } from "@/components/site-header";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

export function HeaderSwitch({ bundeslaender, locale = null }: { bundeslaender: BundeslandNavItem[]; locale?: string | null }) {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return null;
  if (pathname.startsWith("/admin")) return null;
  const localeAwarePath = stripLeadingLocale(pathname).pathname;
  const isHome = localeAwarePath === "/";

  return isHome ? (
    <HomeHeader bundeslaender={bundeslaender} locale={locale} />
  ) : (
    <SiteHeader bundeslaender={bundeslaender} locale={locale} />
  );
}
