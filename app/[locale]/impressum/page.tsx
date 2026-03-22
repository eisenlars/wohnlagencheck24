import { notFound } from "next/navigation";

import { ImpressumPageContent } from "@/app/(public)/(statisch)/impressum/page";
import { parsePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  return <ImpressumPageContent locale={locale} />;
}
