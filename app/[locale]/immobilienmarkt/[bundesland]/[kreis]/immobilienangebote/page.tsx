import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { ImmobilienangeboteKreisPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/immobilienangebote/page";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function LocalizedImmobilienangeboteKreisPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;

  return ImmobilienangeboteKreisPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    page,
    locale: normalizePublicLocale(resolvedParams.locale),
  });
}
