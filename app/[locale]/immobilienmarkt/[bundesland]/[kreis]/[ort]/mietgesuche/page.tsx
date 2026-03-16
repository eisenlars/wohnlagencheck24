import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { MietgesucheOrtPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/[ort]/mietgesuche/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; ort: string }>;
};

export default async function LocalizedMietgesucheOrtPage({
  params,
}: PageProps) {
  const resolvedParams = await params;

  return MietgesucheOrtPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    ort: resolvedParams.ort,
    locale: normalizePublicLocale(resolvedParams.locale),
  });
}
