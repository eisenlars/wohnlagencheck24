import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { MietgesucheKreisPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/mietgesuche/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string }>;
};

export default async function LocalizedMietgesucheKreisPage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return MietgesucheKreisPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    locale,
  });
}
