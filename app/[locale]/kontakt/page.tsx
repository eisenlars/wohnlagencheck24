import { ConceptPageContent } from "@/app/(public)/(statisch)/kontakt/page";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedConceptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  return <ConceptPageContent locale={normalizePublicLocale(resolvedParams.locale)} />;
}
