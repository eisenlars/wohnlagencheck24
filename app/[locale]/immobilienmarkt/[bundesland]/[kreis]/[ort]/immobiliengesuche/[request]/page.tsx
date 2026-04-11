import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { ImmobiliengesuchOrtDetailPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/[ort]/immobiliengesuche/[request]/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; ort: string; request: string }>;
};

export default async function LocalizedImmobiliengesuchOrtDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return ImmobiliengesuchOrtDetailPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    ort: resolvedParams.ort,
    requestParam: resolvedParams.request,
    locale,
  });
}
