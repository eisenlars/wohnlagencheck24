import { ImmobilienmarktOverviewContent } from "@/app/(public)/immobilienmarkt/page";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export default async function LocalizedImmobilienmarktOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  return <ImmobilienmarktOverviewContent locale={normalizePublicLocale(resolvedParams.locale)} />;
}
