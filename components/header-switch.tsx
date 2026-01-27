"use client";

import { usePathname } from "next/navigation";

import { HomeHeader } from "@/components/home-header";
import { SiteHeader } from "@/components/site-header";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

export function HeaderSwitch({ bundeslaender }: { bundeslaender: BundeslandNavItem[] }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return isHome ? (
    <HomeHeader bundeslaender={bundeslaender} />
  ) : (
    <SiteHeader bundeslaender={bundeslaender} />
  );
}
