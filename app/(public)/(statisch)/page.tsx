// app/page.tsx oder app/(statisch)/page.tsx

import "./static.css"; // falls noch nicht eingebunden
import Link from "next/link";
import Image from "next/image";
import { getBundeslaender } from "@/lib/data";
import { loadPortalCmsEntriesByPage, resolvePortalCmsField } from "@/lib/portal-cms-reader";
import { buildLocalizedHref } from "@/lib/public-locale-routing";
import { createAdminClient } from "@/utils/supabase/admin";
import { buildWebAssetUrl } from "@/utils/assets";
import BlogAuthorImage from "@/components/blog-author-image";

type BlogBlock = {
  headline: string | null;
  subline: string | null;
  body_md: string | null;
  author_name: string | null;
  author_image_url: string | null;
  bundesland_slug: string | null;
  kreis_slug: string | null;
  area_name: string | null;
  created_at: string | null;
};

const BLOG_QUERY_TIMEOUT_MS = 4000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("BLOG_QUERY_TIMEOUT")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const blocks: Array<{ type: 'p' | 'h2' | 'h3' | 'ul'; content: string | string[] }> = [];
  let buffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length) {
      blocks.push({ type: 'p', content: buffer.join(' ').trim() });
      buffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push({ type: 'ul', content: [...listBuffer] });
      listBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h2', content: trimmed.replace(/^#\s+/, '') });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h3', content: trimmed.replace(/^##\s+/, '') });
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      listBuffer.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }
    buffer.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks.map((block, index) => {
    if (block.type === 'h2') return <h3 key={`h2-${index}`}>{block.content as string}</h3>;
    if (block.type === 'h3') return <h4 key={`h3-${index}`}>{block.content as string}</h4>;
    if (block.type === 'ul') {
      return (
        <ul key={`ul-${index}`}>
          {(block.content as string[]).map((item, itemIndex) => (
            <li key={`li-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
    }
    return <p key={`p-${index}`}>{block.content as string}</p>;
  });
}

// app/(statisch)/page.tsx (Ausschnitt)

export async function HomeLandingPage({ locale = "de" }: { locale?: string }) {
  const bundeslaender = await getBundeslaender();
  const homeEntries = await loadPortalCmsEntriesByPage("home", locale);
  let latestBlog: BlogBlock | null = null;

  try {
    const admin = createAdminClient();
    const blogQuery = admin
      .from('partner_blog_posts')
      .select('headline, subline, body_md, author_name, author_image_url, area_name, created_at, bundesland_slug, kreis_slug')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    const { data, error } = await withTimeout<{
      data: BlogBlock[] | null;
      error: { message?: string } | null;
    }>(
      Promise.resolve(blogQuery),
      BLOG_QUERY_TIMEOUT_MS,
    );
    if (!error && data && data.length > 0) {
      latestBlog = data[0] as BlogBlock;
    }
  } catch {
    latestBlog = null;
  }

  return (
    <div className="home-page-root">
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              try {
                if (!window.location.hash) return;
                var hash = window.location.hash;
                if (hash.indexOf("access_token=") === -1) return;
                if (hash.indexOf("type=invite") !== -1) {
                  window.location.replace("/partner/setup" + hash);
                  return;
                }
                if (hash.indexOf("type=recovery") !== -1) {
                  window.location.replace("/partner/reset" + hash);
                }
              } catch (_) {}
            })();
          `,
        }}
      />
      {/* HERO: Deutschland-Maske links, Logo + Claim rechts */}
      <section className="home-cutout-section">
        <div className="home-cutout-inner">
          
          {/* Links: große Deutschland-Maske mit Video/Bild */}
          <div className="home-cutout-media-col">
            <div className="home-cutout-frame">
              <video
                src="/video/wohnlagencheck24-trailer.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="home-cutout-media"
              />
            </div>
          </div>

          {/* Rechts: Logo + Portalinfo */}
          <div className="home-cutout-brand-col">
            <Image
              src="/logo/wohnlagencheck24.svg"
              alt="Wohnlagencheck24 – Immobilienmarkt & Standortprofile"
              className="home-cutout-logo"
              width={240}
              height={72}
              priority
            />

            <h1 className="home-cutout-title">
              {resolvePortalCmsField(homeEntries, "home_hero", "headline", "Wohnlagencheck24 - Immobilienmarkt & Standortprofile")}
            </h1>

            <p className="home-cutout-claim">
              {resolvePortalCmsField(homeEntries, "home_hero", "claim", "DATA-DRIVEN. EXPERT-LED.")}
            </p>

            <p className="home-cutout-text">
              {resolvePortalCmsField(
                homeEntries,
                "home_hero",
                "intro",
                "Immobilienmarkt & Standortprofile: Regionale Wohnlagenanalysen mit strukturierten Kennzahlen zu Preisen, Mieten und Standortfaktoren.",
              )}
            </p>

            <div className="home-cutout-actions">
              {bundeslaender.map((bl) => (
                <Link
                  key={bl.slug}
                  href={buildLocalizedHref(locale, `/immobilienmarkt/${bl.slug}`)}
                  className="btn btn-outline-dark fw-semibold px-4 py-2"
                >
                  {bl.name}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </section>

      <section className="home-breaker">
        <div className="home-breaker-inner">
          <div className="home-breaker-left">
            <div className="home-breaker-claim">
              {resolvePortalCmsField(homeEntries, "home_breaker", "eyebrow", "DATA-DRIVEN. EXPERT-LED.")}
            </div>
            <div className="home-breaker-subclaim">
              {resolvePortalCmsField(homeEntries, "home_breaker", "subheadline", "Harte Daten. Lokales Gespuer.")}
            </div>
          </div>
          <div className="home-breaker-right">
            <p className="home-breaker-text">
              <span className="home-breaker-line">
                {resolvePortalCmsField(
                  homeEntries,
                  "home_breaker",
                  "body",
                  "Wir verbinden harte Marktdaten mit lokaler Expertise, um Wohnlagen verlaesslich einzuordnen.",
                )}
              </span>
              
              
            </p>
          </div>
        </div>
      </section>

      {latestBlog ? (
        <section className="home-blog-section">
          <div className="home-blog-inner">
            <div className="home-blog-header">
              <div className="home-blog-kicker">Neuester Marktbeitrag</div>
              <h2 className="home-blog-title">{latestBlog.headline}</h2>
              {latestBlog.subline ? (
                <p className="home-blog-subline">{latestBlog.subline}</p>
              ) : null}
            </div>
            <div className="home-blog-body">
              {latestBlog.body_md ? renderMarkdown(latestBlog.body_md) : null}
            </div>
            <div className="home-blog-author">
              {(() => {
                const fallbackImage =
                  latestBlog.bundesland_slug && latestBlog.kreis_slug
                    ? buildWebAssetUrl(
                        `/images/immobilienmarkt/${latestBlog.bundesland_slug}/${latestBlog.kreis_slug}/immobilienberatung-${latestBlog.kreis_slug}.png`,
                      )
                    : null;
                const imageSrc = latestBlog.author_image_url || fallbackImage || null;
                return (
                  <BlogAuthorImage
                    src={imageSrc}
                    fallbackSrc="/images/avatars/berater-placeholder.svg"
                    alt={latestBlog.author_name || 'Berater'}
                    className="home-blog-author-image"
                  />
                );
              })()}
              <div>
                <div className="home-blog-author-name">
                  {latestBlog.author_name || 'Berater'}
                </div>
                {latestBlog.area_name ? (
                  <div className="home-blog-author-meta">{latestBlog.area_name}</div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
  
    </div>
  );
}

export default async function HomePage() {
  return <HomeLandingPage locale="de" />;
}
