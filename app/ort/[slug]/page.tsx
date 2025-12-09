import { notFound } from "next/navigation";
import { getOrtBySlug } from "@/lib/data";

type OrtPageProps = {
  params: {
    slug: string;
  };
};

export default function OrtPage({ params }: OrtPageProps) {
  const ort = getOrtBySlug(params.slug);

  if (!ort) {
    notFound();
  }

  const {
      name,
      bundesland,
      landkreis,
      plz,
      beschreibungKurz,
      beschreibungLang,
      lat,
      lng,
    } = ort;


  return (
    <div className="text-dark">
      {/* Header / Titelbereich */}
      <section className="mb-4">
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
          Standortprofil – Wohnlage
        </div>

        <h1 className="mt-3 mb-1">
          {name} – Wohnlage im {landkreis}
        </h1>
        <p className="small text-muted mb-1">
          {bundesland} · PLZ {plz}
        </p>
        {beschreibungKurz && (
          <p className="small mb-0">{beschreibungKurz}</p>
        )}
      </section>

      {/* Meta-Infos (Tabelle / Faktenbox) */}
      <section className="mb-4">
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-3">Steckbrief</h2>
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <tbody>
                      <tr>
                        <th scope="row" className="small text-muted">
                          Wohnlage
                        </th>
                        <td className="small">{name}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="small text-muted">
                          Landkreis
                        </th>
                        <td className="small">{landkreis}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="small text-muted">
                          Bundesland
                        </th>
                        <td className="small">{bundesland}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="small text-muted">
                          PLZ
                        </th>
                        <td className="small">{plz}</td>
                      </tr>
                      {lat && lng && (
                        <tr>
                          <th scope="row" className="small text-muted">
                            Geodaten
                          </th>
                          <td className="small">
                            Lat: {lat}, Lon: {lng}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Kurzbeschreibung / Einordnung */}
          <div className="col-12 col-md-6">
            <div
              className="card h-100 border-0 shadow-sm"
              style={{ backgroundColor: "#0087CC", color: "#fff" }}
            >
              <div className="card-body">
                <h2 className="h6 mb-3">Einordnung der Wohnlage</h2>
                <p className="small mb-2">
                  {beschreibungKurz ||
                    "Diese Wohnlage ist Teil des regionalen Wohnungsmarktes und steht exemplarisch für die örtlichen Strukturen."}
                </p>
                <p className="small mb-0 text-white-75">
                  Hier können später automatisiert Stichworte zur Nachfrage,
                  zum Preisniveau oder zur Position im regionalen Markt ergänzt
                  werden.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Text + Bild (Platzhalter für Karte/Bild) */}
      <section className="mb-4">
        <div className="row g-4 align-items-center">
          <div className="col-12 col-md-5">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-2">Lage im regionalen Kontext</h2>
                <p className="small text-muted mb-0">
                  Hier könnte eine Karte, ein Luftbild oder eine grafische
                  Darstellung der Lage im Landkreis beziehungsweise in Relation
                  zu umliegenden Zentren eingebunden werden.
                </p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-7">
            <img
              src="https://via.placeholder.com/800x400?text=Karte+%2F+Luftbild"
              alt={`Karte oder Luftbild von ${name}`}
              className="img-fluid rounded shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* Ausführliche Beschreibung / Textblocke */}
      <section className="mb-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h2 className="h6 mb-3">Beschreibung der Wohnlage</h2>
            <p className="small mb-2">
              {beschreibungLang ||
                "Die detaillierte Beschreibung der Wohnlage kann später automatisiert auf Basis deiner JSON-Daten generiert werden – zum Beispiel zur Bebauungsstruktur, Zielgruppen, Erreichbarkeit und zur Stellung im regionalen Immobilienmarkt."}
            </p>
            <p className="small text-muted mb-0">
              Zusätzlich können Abschnitte zu Infrastruktur, Bildung,
              Nahversorgung sowie zur Entwicklung von Mieten und Preisen ergänzt
              werden, um ein vollständiges Standortprofil zu geben.
            </p>
          </div>
        </div>
      </section>

      {/* Platzhalter für Kennzahlen / Charts / Marktindikatoren */}
      <section>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-3">Kennzahlen (Platzhalter)</h2>
                <p className="small text-muted mb-2">
                  Hier können später zentrale Kennzahlen zur Wohnlage eingebunden werden, zum Beispiel:
                </p>
                <ul className="small text-muted mb-0">
                  <li>Ø Angebotsmiete und -kaufpreis</li>
                  <li>Leerstandsquote &amp; Bautätigkeit</li>
                  <li>Bevölkerungs- und Haushaltsentwicklung</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-3">Chart-Bereich (Platzhalter)</h2>
                <div
                  className="bg-light d-flex align-items-center justify-content-center rounded"
                  style={{ height: "160px" }}
                >
                  <span className="small text-muted">
                    Zeitreihen-Chart (Mieten, Preise, Nachfrage …)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
