import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { MietgesuchOrtDetailPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/[ort]/mietgesuche/[request]/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; ort: string; request: string }>;
};

export default async function LocalizedMietgesuchOrtDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return MietgesuchOrtDetailPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    ort: resolvedParams.ort,
    requestParam: resolvedParams.request,
    locale,
  });
}
