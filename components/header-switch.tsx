"use client";

import { usePathname } from "next/navigation";
import { stripLeadingLocale } from "@/lib/public-locale-routing";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";

import { HomeHeader } from "@/components/home-header";
import { SiteHeader } from "@/components/site-header";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

export function HeaderSwitch({ bundeslaender, text, locale = null }: { bundeslaender: BundeslandNavItem[]; text: PortalSystemTextMap; locale?: string | null }) {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return null;
  if (pathname.startsWith("/admin")) return null;
  const localeAwarePath = stripLeadingLocale(pathname).pathname;
  const isHome = localeAwarePath === "/";

  return isHome ? (
    <HomeHeader bundeslaender={bundeslaender} text={text} locale={locale} />
  ) : (
    <SiteHeader bundeslaender={bundeslaender} text={text} locale={locale} />
  );
}
