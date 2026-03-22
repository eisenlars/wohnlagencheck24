import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import BaseImmobilienmarktPage, {
  generateMetadata as generateBaseMetadata,
} from "@/app/(public)/immobilienmarkt/[...slug]/page";
import { getPublicAreaLocaleAvailability } from "@/lib/public-area-locale-availability";
import { buildLocalizedHref, parsePublicLocale } from "@/lib/public-locale-routing";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";

type LocalizedPageProps = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export const revalidate = 3600;

function fallbackCardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: 20,
    padding: "24px 24px 22px",
    background: "#ffffff",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  };
}

function fallbackButtonStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 999,
    background: "#1d4f3c",
    color: "#ffffff",
    fontWeight: 600,
    textDecoration: "none",
  };
}

export async function generateMetadata({ params }: LocalizedPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  const slug = resolvedParams.slug ?? [];
  const availability = await getPublicAreaLocaleAvailability(slug, locale);

  if (!availability || availability.available) {
    const metadata = await generateBaseMetadata({
      params: Promise.resolve({ slug }),
    });
    const slugPath = slug.join("/");
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

  const texts = await getPortalSystemTexts(locale);
  const slugPath = slug.join("/");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const localizedPath = slugPath ? `/${locale}/immobilienmarkt/${slugPath}` : `/${locale}/immobilienmarkt`;
  const title = `${availability.areaName}: ${texts.area_profile_unavailable_title}`;
  const description = `${availability.areaName}: ${texts.area_profile_unavailable_body}`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: siteUrl ? `${siteUrl}${localizedPath}` : undefined,
      siteName: "Wohnlagencheck24",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function LocalizedImmobilienmarktHierarchiePage({ params }: LocalizedPageProps) {
  const resolvedParams = await params;
  const locale = parsePublicLocale(resolvedParams.locale);
  if (!locale) notFound();
  const slug = resolvedParams.slug ?? [];
  const availability = await getPublicAreaLocaleAvailability(slug, locale);

  if (!availability || availability.available) {
    return <BaseImmobilienmarktPage params={Promise.resolve({ slug })} locale={locale} />;
  }

  const texts = await getPortalSystemTexts(locale);
  const germanHref = buildLocalizedHref("de", `/immobilienmarkt/${slug.join("/")}`);
  const reasonText = availability.reason === "feature_disabled"
    ? texts.area_profile_unavailable_feature_disabled
    : availability.reason === "missing_translations"
      ? texts.area_profile_unavailable_missing_translations
      : availability.reason === "no_public_partner"
        ? texts.area_profile_unavailable_no_public_partner
        : texts.area_profile_unavailable_rendering_pending;

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-xl-8 col-lg-9">
          <div style={fallbackCardStyle()}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(29, 79, 60, 0.08)",
                color: "#1d4f3c",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              {locale}
            </div>
            <h1
              style={{
                marginTop: 18,
                marginBottom: 12,
                fontSize: "clamp(1.9rem, 3vw, 2.8rem)",
                lineHeight: 1.08,
                color: "#0f172a",
              }}
            >
              {availability.areaName}
            </h1>
            <h2
              style={{
                marginTop: 0,
                marginBottom: 16,
                fontSize: "clamp(1.05rem, 1.8vw, 1.3rem)",
                color: "#1d4f3c",
              }}
            >
              {texts.area_profile_unavailable_title}
            </h2>
            <p style={{ color: "#334155", fontSize: 16, lineHeight: 1.7, marginBottom: 12 }}>
              {texts.area_profile_unavailable_body}
            </p>
            <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
              {reasonText}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href={germanHref} style={fallbackButtonStyle()}>
                {texts.view_german_version}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
