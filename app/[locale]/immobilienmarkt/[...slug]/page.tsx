import type { Metadata } from "next";

import BaseImmobilienmarktPage, {
  generateMetadata as generateBaseMetadata,
  revalidate,
} from "@/app/(public)/immobilienmarkt/[...slug]/page";

type LocalizedPageProps = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export { revalidate };

export async function generateMetadata({ params }: LocalizedPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const metadata = await generateBaseMetadata({
    params: Promise.resolve({ slug: resolvedParams.slug ?? [] }),
  });
  const locale = String(resolvedParams.locale ?? "").trim().toLowerCase();
  const slugPath = (resolvedParams.slug ?? []).join("/");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const localizedPath = slugPath ? `/${locale}/immobilienmarkt/${slugPath}` : `/${locale}/immobilienmarkt`;

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      url: siteUrl ? `${siteUrl}${localizedPath}` : metadata.openGraph?.url,
    },
  };
}

export default async function LocalizedImmobilienmarktHierarchiePage({ params }: LocalizedPageProps) {
  const resolvedParams = await params;
  return <BaseImmobilienmarktPage params={Promise.resolve({ slug: resolvedParams.slug ?? [] })} />;
}
