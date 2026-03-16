import { ImpressumPageContent } from "@/app/(public)/(statisch)/impressum/page";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  return <ImpressumPageContent locale={normalizePublicLocale(resolvedParams.locale)} />;
}
