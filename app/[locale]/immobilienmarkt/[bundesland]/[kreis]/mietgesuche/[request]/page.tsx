import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { MietgesuchKreisDetailPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/mietgesuche/[request]/MietgesuchKreisDetailPageContent";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; request: string }>;
};

export default async function LocalizedMietgesuchKreisDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return MietgesuchKreisDetailPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    requestParam: resolvedParams.request,
    locale,
  });
}
