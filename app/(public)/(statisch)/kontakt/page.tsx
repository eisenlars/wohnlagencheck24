// app/page.tsx

import Link from "next/link";
import {
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
} from "@/lib/data";
import { loadPortalCmsEntriesByPage, resolvePortalCmsField } from "@/lib/portal-cms-reader";

export default async function HomePage() {
  const bundeslaender = await getBundeslaender();
  const conceptEntries = await loadPortalCmsEntriesByPage("concept", "de");
  const homeEntries = await loadPortalCmsEntriesByPage("home", "de");

  // Struktur: Bundesland -> Kreise -> Ortslagen
  const struktur = await Promise.all(
    bundeslaender.map(async (bl) => {
      const kreise = await getKreiseForBundesland(bl.slug);
      const kreiseWithOrte = await Promise.all(
        kreise.map(async (kreis) => ({
          ...kreis,
          orte: await getOrteForKreis(bl.slug, kreis.slug),
        })),
      );
      return { ...bl, kreise: kreiseWithOrte };
    }),
  );

  return (
    <div className="text-dark">
      {/* Konzept */}
      <section id="konzept" className="mb-5">
        <div className="d-inline-flex align-items-center gap-2 rounded-pill border border-warning bg-warning px-3 py-1 text-uppercase small fw-semibold">
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#000",
              display: "inline-block",
            }}
          />
          {resolvePortalCmsField(conceptEntries, "concept_intro", "badge", "Technisches Demo · GEO & LLM-ready")}
        </div>

        <h1 className="mt-3 mb-2 h3">
          {resolvePortalCmsField(conceptEntries, "concept_intro", "headline", "Wohnlagencheck24 - Immobilienmarkt & Standortprofile")}
        </h1>
        <p className="small text-muted mb-2">
          {resolvePortalCmsField(
            conceptEntries,
            "concept_intro",
            "body_primary",
            "Wohnlagencheck24 stellt strukturierte Informationen zu Wohnlagen, Standorten und regionalen Immobilienmaerkten bereit. Die Inhalte sind so aufgebaut, dass sie fuer Nutzer, klassische Suchmaschinen und KI-Suchsysteme gleichermassen gut auswertbar sind.",
          )}
        </p>
        <p className="small text-muted mb-0">
          {resolvePortalCmsField(
            conceptEntries,
            "concept_intro",
            "body_secondary",
            "Dieses Demo bildet den technischen Unterbau fuer ein spaeteres Portal mit vielen tausend Wohnlagen - inklusive klarer URL-Struktur und Einstieg ueber Bundeslaender, Landkreise und Wohnlagen.",
          )}
        </p>
      </section>

      {/* Immobilienmarkt & Standortprofile */}
      <section
        id="immobilienmarkt-standortprofile"
        className="mb-4"
        aria-labelledby="immobilienmarkt-standortprofile-heading"
      >
        <h2 id="immobilienmarkt-standortprofile-heading" className="h4 mb-2">
          Immobilienmarkt &amp; Standortprofile
        </h2>
        <p className="small text-muted mb-3">
          Der Einstieg in die Standortprofile erfolgt über die Bundesländer.
          Innerhalb eines Bundeslandes sind die erfassten Landkreise und
          ausgewählte Wohnlagen aufgeführt. Die Detailseiten folgen der
          Hierarchie:
          <br />
          <code>/immobilienmarkt/&lt;bundesland&gt;/&lt;kreis&gt;/&lt;wohnlage&gt;</code>
        </p>

        <p className="small mb-3">
          Alternativ kannst du direkt über den Menüpunkt{" "}
          <Link href="/immobilienmarkt" className="link-primary">
            Immobilienmarkt &amp; Standortprofile
          </Link>{" "}
          in die hierarchische Übersicht einsteigen.
        </p>
      </section>

      {/* Bundesländer + Kreise + Wohnlagen */}
      <section
        aria-label="Wohnlagen nach Bundesland und Landkreis"
        className="mb-5"
      >
        {struktur.map((bl) => (
          <section
            key={bl.slug}
            id={`bundeslaender-${bl.slug}`}
            className="mb-4"
          >
            <h3 className="h5 mb-3">
              <Link
                href={`/immobilienmarkt/${bl.slug}`}
                className="link-dark text-decoration-none"
              >
                {bl.name}
              </Link>
            </h3>

            <div className="row g-3">
              {bl.kreise.map((kreis) => (
                <div key={kreis.slug} className="col-12 col-md-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h4 className="h6 mb-2">
                        <Link
                          href={`/immobilienmarkt/${bl.slug}/${kreis.slug}`}
                          className="link-dark text-decoration-none"
                        >
                          Landkreis {kreis.name}
                        </Link>
                      </h4>
                      <ul className="list-unstyled mb-0 small">
                        {kreis.orte.map((ort) => (
                          <li key={ort.slug} className="mb-1">
                            <Link
                              href={`/immobilienmarkt/${bl.slug}/${kreis.slug}/${ort.slug}`}
                              className="link-primary"
                            >
                              {ort.name}
                            </Link>
                          </li>
                        ))}
                        {kreis.orte.length === 0 && (
                          <li className="text-muted">
                            (Für diesen Landkreis sind noch keine einzelnen
                            Wohnlagen hinterlegt.)
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}

              {bl.kreise.length === 0 && (
                <div className="col-12">
                  <p className="small text-muted mb-0">
                    Für dieses Bundesland liegen aktuell noch keine Kreisdaten
                    vor.
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}

        {struktur.length === 0 && (
          <p className="small text-muted mb-0">
            Es wurden noch keine Reports in der Datenstruktur hinterlegt.
          </p>
        )}
      </section>

      {/* Weitere Inhalte */}
      <section id="inhalte" className="pt-3 border-top">
        <h2 className="h4 mb-2">
          {resolvePortalCmsField(homeEntries, "home_more_content", "headline", "Weitere Inhalte")}
        </h2>
        <p className="small text-muted mb-1">
          {resolvePortalCmsField(
            homeEntries,
            "home_more_content",
            "body_primary",
            "Hier koennen spaeter zusaetzliche Inhalte entstehen - zum Beispiel methodische Erlaeuterungen zum Wohnlagenmodell, regionale Vergleichsanalysen oder ein Glossar wichtiger Begriffe rund um Immobilienmaerkte und Standorte.",
          )}
        </p>
        <p className="small text-muted mb-0">
          {resolvePortalCmsField(
            homeEntries,
            "home_more_content",
            "body_secondary",
            "Die Musterseite zeigt verschiedene Inhaltstypen, die spaeter auf Wohnlagen- und Marktprofilseiten eingesetzt werden koennen: Tabellen, Grids, Formulare und Chart-Platzhalter.",
          )}
        </p>
      </section>
    </div>
  );
}
