import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { ImmobiliengesucheKreisPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/immobiliengesuche/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string }>;
};

export default async function LocalizedImmobiliengesucheKreisPage({
  params,
}: PageProps) {
  const resolvedParams = await params;

  return ImmobiliengesucheKreisPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    locale: normalizePublicLocale(resolvedParams.locale),
  });
}
