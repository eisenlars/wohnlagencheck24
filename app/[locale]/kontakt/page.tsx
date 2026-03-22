import { notFound } from "next/navigation";

import { ConceptPageContent } from "@/app/(public)/(statisch)/kontakt/page";
import { parsePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedConceptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  return <ConceptPageContent locale={locale} />;
}
