import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { MietangeboteOrtPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/[ort]/mietangebote/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string; ort: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function LocalizedMietangeboteOrtPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;

  return MietangeboteOrtPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    ort: resolvedParams.ort,
    page,
    locale: normalizePublicLocale(resolvedParams.locale),
  });
}
