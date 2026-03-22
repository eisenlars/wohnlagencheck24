import { notFound } from "next/navigation";

import { DatenschutzPageContent } from "@/app/(public)/(statisch)/datenschutz/page";
import { parsePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedDatenschutzPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  return <DatenschutzPageContent locale={locale} />;
}
