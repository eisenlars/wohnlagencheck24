import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { HomeLandingPage } from "@/app/(public)/(statisch)/page";

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  return <HomeLandingPage locale={normalizePublicLocale(resolvedParams.locale)} />;
}
