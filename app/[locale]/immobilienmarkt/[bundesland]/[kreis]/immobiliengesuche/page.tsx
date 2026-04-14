import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/lib/public-locale-routing";
import { ImmobiliengesucheKreisPageContent } from "@/app/(public)/immobilienmarkt/[bundesland]/[kreis]/immobiliengesuche/ImmobiliengesucheKreisPageContent";

type PageProps = {
  params: Promise<{ locale: string; bundesland: string; kreis: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function LocalizedImmobiliengesucheKreisPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const rawPage = await (await searchParams)?.page;
  const parsedPage = rawPage ? Number(rawPage) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();

  return ImmobiliengesucheKreisPageContent({
    bundesland: resolvedParams.bundesland,
    kreis: resolvedParams.kreis,
    page,
    locale,
  });
}
