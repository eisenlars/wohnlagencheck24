import "../(public)/(statisch)/static.css";

import { notFound } from "next/navigation";

import { PublicSiteShell } from "@/components/layout/PublicSiteShell";
import { isPublicPortalLocaleLive } from "@/lib/public-portal-locales";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = normalizePublicLocale(resolvedParams.locale);
  if (!(await isPublicPortalLocaleLive(locale))) {
    notFound();
  }

  return <PublicSiteShell locale={locale}>{children}</PublicSiteShell>;
}
