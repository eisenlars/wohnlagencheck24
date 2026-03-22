import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { ImmobiliengesucheKreisPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/immobiliengesuche/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string }>;
};

export default async function LocalizedImmobiliengesucheKreisPage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return ImmobiliengesucheKreisPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    locale,
  });
}
