// app/immobilienmarkt/page.tsx

import Link from "next/link";
import {
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
} from "@/lib/data";

export default function ImmobilienmarktOverviewPage() {
  const bundeslaender = getBundeslaender();

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

      {bundeslaender.map((bl) => {
        const kreise = getKreiseForBundesland(bl.slug);

        return (
          <section key={bl.slug} className="mb-4">
            <h2 className="h5 mb-2">
              <Link
                href={`/immobilienmarkt/${bl.slug}`}
                className="link-dark text-decoration-none"
              >
                {bl.name}
              </Link>
            </h2>

            <div className="row g-3">
              {kreise.map((kreis) => {
                const orte = getOrteForKreis(bl.slug, kreis.slug);
                return (
                  <div key={kreis.slug} className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h3 className="h6 mb-2">
                          <Link
                            href={`/immobilienmarkt/${bl.slug}/${kreis.slug}`}
                            className="link-dark"
                          >
                            Landkreis {kreis.name}
                          </Link>
                        </h3>
                        <ul className="list-unstyled mb-0 small">
                          {orte.map((ort) => (
                            <li key={ort.slug} className="mb-1">
                              <Link
                                href={`/immobilienmarkt/${bl.slug}/${kreis.slug}/${ort.slug}`}
                                className="link-primary"
                              >
                                {ort.name}
                              </Link>
                            </li>
                          ))}
                          {orte.length === 0 && (
                            <li className="text-muted">
                              (Ortslagen werden noch ergänzt)
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
