// app/immobilienmarkt/page.tsx

import Link from "next/link";
import {
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
} from "@/lib/data";
import {
  getActiveKreisSlugsForBundesland,
  getActiveOrtSlugsForKreis,
  isBundeslandVisible,
} from "@/lib/area-visibility";
import { buildLocalizedHref } from "@/lib/public-locale-routing";

export async function ImmobilienmarktOverviewContent({ locale = null }: { locale?: string | null }) {
  const bundeslaenderRaw = await getBundeslaender();
  const bundeslaender = (
    await Promise.all(
      bundeslaenderRaw.map(async (bl) => ((await isBundeslandVisible(bl.slug)) ? bl : null)),
    )
  ).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const struktur = await Promise.all(
    bundeslaender.map(async (bl) => {
      const kreiseRaw = await getKreiseForBundesland(bl.slug);
      const activeKreise = await getActiveKreisSlugsForBundesland(bl.slug);
      const kreise = kreiseRaw.filter((kreis) => activeKreise.has(kreis.slug));
      const kreiseWithVisibleOrte = await Promise.all(
        kreise.map(async (kreis) => {
          const activeOrte = await getActiveOrtSlugsForKreis(bl.slug, kreis.slug);
          const orte = await getOrteForKreis(bl.slug, kreis.slug);
          return {
            ...kreis,
            orte: orte.filter((ort) => activeOrte.has(ort.slug)),
          };
        }),
      );
      return { ...bl, kreise: kreiseWithVisibleOrte };
    }),
  );

  return (
    <div className="text-dark">
      <section className="mb-4">
        <h1 className="h3 mb-2">
          Immobilienmarkt &amp; Standortprofile in Deutschland
        </h1>
        <p className="small text-muted mb-0">
          Einstieg über Bundesländer, Landkreise und ausgewählte Wohnlagen –
          alle Standortprofile sind über eine klare URL-Hierarchie erreichbar
          und serverseitig gerendert.
        </p>
      </section>

      {struktur.map((bl) => {
        return (
          <section key={bl.slug} className="mb-4">
            <h2 className="h5 mb-2">
              <Link
                href={buildLocalizedHref(locale, `/immobilienmarkt/${bl.slug}`)}
                className="link-dark text-decoration-none"
              >
                {bl.name}
              </Link>
            </h2>

            <div className="row g-3">
              {bl.kreise.map((kreis) => (
                <div key={kreis.slug} className="col-12 col-md-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h3 className="h6 mb-2">
                        <Link
                          href={buildLocalizedHref(locale, `/immobilienmarkt/${bl.slug}/${kreis.slug}`)}
                          className="link-dark"
                        >
                          Landkreis {kreis.name}
                        </Link>
                      </h3>
                      <ul className="list-unstyled mb-0 small">
                        {kreis.orte.map((ort) => (
                          <li key={ort.slug} className="mb-1">
                            <Link
                              href={buildLocalizedHref(locale, `/immobilienmarkt/${bl.slug}/${kreis.slug}/${ort.slug}`)}
                              className="link-primary"
                            >
                              {ort.name}
                            </Link>
                          </li>
                        ))}
                        {kreis.orte.length === 0 && (
                          <li className="text-muted">
                            (Ortslagen werden noch ergänzt)
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default async function ImmobilienmarktOverviewPage() {
  return <ImmobilienmarktOverviewContent locale={null} />;
}
