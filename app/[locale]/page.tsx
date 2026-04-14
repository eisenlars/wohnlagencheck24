import { notFound } from "next/navigation";

import { HomeLandingPage } from "@/app/(public)/(statisch)/HomeLandingPage";
import { parsePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  return <HomeLandingPage locale={locale} />;
}
