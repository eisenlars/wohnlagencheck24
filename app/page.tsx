// app/page.tsx

import Link from "next/link";
import {
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
} from "@/lib/data";

export default function HomePage() {
  const bundeslaender = getBundeslaender();

  // Struktur: Bundesland -> Kreise -> Ortslagen
  const struktur = bundeslaender.map((bl) => {
    const kreise = getKreiseForBundesland(bl.slug).map((kreis) => {
      const orte = getOrteForKreis(bl.slug, kreis.slug);
      return { ...kreis, orte };
    });
    return { ...bl, kreise };
  });

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
          Technisches Demo · GEO &amp; LLM-ready
        </div>

        <h1 className="mt-3 mb-2 h3">
          Wohnlagencheck24 – Immobilienmarkt &amp; Standortprofile
        </h1>
        <p className="small text-muted mb-2">
          Wohnlagencheck24 stellt strukturierte Informationen zu Wohnlagen,
          Standorten und regionalen Immobilienmärkten bereit. Die Inhalte sind
          so aufgebaut, dass sie für Nutzer, klassische Suchmaschinen und
          KI-Suchsysteme gleichermaßen gut auswertbar sind.
        </p>
        <p className="small text-muted mb-0">
          Dieses Demo bildet den technischen Unterbau für ein späteres Portal
          mit vielen tausend Wohnlagen – inklusive klarer URL-Struktur und
          Einstieg über Bundesländer, Landkreise und Wohnlagen.
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
                            {ort.plz && (
                              <span className="text-muted">
                                {" "}
                                (PLZ {ort.plz})
                              </span>
                            )}
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
        <h2 className="h4 mb-2">Weitere Inhalte</h2>
        <p className="small text-muted mb-1">
          Hier können später zusätzliche Inhalte entstehen – zum Beispiel
          methodische Erläuterungen zum Wohnlagenmodell, regionale
          Vergleichsanalysen oder ein Glossar wichtiger Begriffe rund um
          Immobilienmärkte und Standorte.
        </p>
        <p className="small text-muted mb-0">
          Die Musterseite zeigt verschiedene Inhaltstypen, die später auf
          Wohnlagen- und Marktprofilseiten eingesetzt werden können: Tabellen,
          Grids, Formulare und Chart-Platzhalter.
        </p>
      </section>
    </div>
  );
}
