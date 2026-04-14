import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { ImmobiliengesuchKreisDetailPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/immobiliengesuche/[request]/ImmobiliengesuchKreisDetailPageContent";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; request: string }>;
};

export default async function LocalizedImmobiliengesuchKreisDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return ImmobiliengesuchKreisDetailPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    requestParam: resolvedParams.request,
    locale,
  });
}
