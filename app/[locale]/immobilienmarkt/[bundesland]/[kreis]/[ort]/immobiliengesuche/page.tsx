import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { ImmobiliengesucheOrtPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/[ort]/immobiliengesuche/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; ort: string }>;
};

export default async function LocalizedImmobiliengesucheOrtPage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return ImmobiliengesucheOrtPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    ort: resolvedParams.ort,
    locale,
  });
}
