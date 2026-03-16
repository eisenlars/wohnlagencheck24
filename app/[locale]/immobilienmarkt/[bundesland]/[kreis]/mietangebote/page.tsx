import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { MietangeboteKreisPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/mietangebote/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function LocalizedMietangeboteKreisPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;

  return MietangeboteKreisPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    page,
    locale: normalizePublicLocale(resolvedParams.locale),
  });
}
