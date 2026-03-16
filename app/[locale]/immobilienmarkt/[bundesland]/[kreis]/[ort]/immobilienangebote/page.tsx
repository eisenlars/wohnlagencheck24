import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { ImmobilienangeboteOrtPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/[ort]/immobilienangebote/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; ort: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function LocalizedImmobilienangeboteOrtPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;

  return ImmobilienangeboteOrtPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    ort: resolvedParams.ort,
    page,
    locale: normalizePublicLocale(resolvedParams.locale),
  });
}
