import { DatenschutzPageContent } from "@/app/(public)/(statisch)/datenschutz/page";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedDatenschutzPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  return <DatenschutzPageContent locale={normalizePublicLocale(resolvedParams.locale)} />;
}
