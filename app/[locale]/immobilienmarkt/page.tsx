import { notFound } from "next/navigation";

import { ImmobilienmarktOverviewContent } from "@/app/(public)/immobilienmarkt/ImmobilienmarktOverviewContent";
import { parsePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedImmobilienmarktOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  return <ImmobilienmarktOverviewContent locale={locale} />;
}
