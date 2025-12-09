export default function MusterSeite() {
  return (
    <div className="text-dark">
      {/* Hero mit Kopfbild */}
      <section id="kopfbild" className="mb-5">
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
          Musterseite – Inhaltstypen
        </div>

        <h1 className="mt-3 mb-2">
          Muster-Template: Inhaltstypen für Wohnlagen- &amp; Marktseiten
        </h1>
        <p className="text-muted mb-4">
          Diese Seite zeigt typische Inhaltselemente, wie sie später auf
          Wohnlagen-, Kreis- oder Marktprofilseiten zum Einsatz kommen können –
          bereits responsiv und in deinem Farbschema.
        </p>

        <div className="card border-0 overflow-hidden">
          <div className="row g-0">
            <div className="col-md-6 p-4 p-md-5 d-flex flex-column justify-content-center">
              <h2 className="h5 mb-3">Kopfbild / Intro-Bereich</h2>
              <p className="small mb-0">
                Hier könnte später ein Foto einer Wohnlage, eine Karte oder
                eine Visualisierung des Marktprofils stehen. Der Textbereich
                erläutert kurz Lage, Rolle im Markt und Zielgruppe.
              </p>
            </div>
            <div className="col-md-6 border-top border-md-start border-md-top-0">
              <img
                src="https://via.placeholder.com/800x400?text=Kopfbild+%2F+Karte"
                alt="Kopfbild Platzhalter"
                className="img-fluid h-100 w-100 object-fit-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Inhaltsverzeichnis */}
      <section id="inhaltsverzeichnis" className="mb-5">
        <h2 className="h4 mb-3">Inhaltsverzeichnis</h2>
        <p className="small text-muted">
          Sprungmarken zu den wichtigsten Muster-Elementen:
        </p>
        <div className="row g-3">
          <div className="col-md-6">
            <ul className="list-group list-group-flush small">
              <li className="list-group-item bg-transparent px-0">
                <a href="#box" className="link-primary">
                  Boxen &amp; Highlights
                </a>
              </li>
              <li className="list-group-item bg-transparent px-0">
                <a href="#text-bild-links" className="link-primary">
                  Text mit Bild (links)
                </a>
              </li>
              <li className="list-group-item bg-transparent px-0">
                <a href="#text-bild-rechts" className="link-primary">
                  Text mit Bild (rechts)
                </a>
              </li>
              <li className="list-group-item bg-transparent px-0">
                <a href="#tabelle" className="link-primary">
                  Tabelle
                </a>
              </li>
            </ul>
          </div>
          <div className="col-md-6">
            <ul className="list-group list-group-flush small">
              <li className="list-group-item bg-transparent px-0">
                <a href="#grid-3" className="link-primary">
                  3er Grid
                </a>
              </li>
              <li className="list-group-item bg-transparent px-0">
                <a href="#grid-2" className="link-primary">
                  2er Grid
                </a>
              </li>
              <li className="list-group-item bg-transparent px-0">
                <a href="#formular" className="link-primary">
                  Formular
                </a>
              </li>
              <li className="list-group-item bg-transparent px-0">
                <a href="#chart" className="link-primary">
                  Chart-Platzhalter
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Boxen */}
      <section id="box" className="mb-5">
        <h2 className="h4 mb-3">Boxen &amp; Highlights</h2>
        <p className="small text-muted mb-4">
          Boxen dienen der Hervorhebung von Kennzahlen, Einschätzungen oder
          methodischen Hinweisen.
        </p>

        <div className="row g-3">
          {/* neutrale Box */}
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-2">Neutrale Informationsbox</h3>
                <p className="small text-muted mb-0">
                  Ideal für Kurzbeschreibungen, methodische Erläuterungen oder
                  Hinweise zur Datenbasis.
                </p>
              </div>
            </div>
          </div>

          {/* blaue Box */}
          <div className="col-12 col-md-4">
            <div
              className="card h-100 border-0 shadow-sm text-white"
              style={{ backgroundColor: "#0087CC" }}
            >
              <div className="card-body">
                <h3 className="h6 mb-2">Akzentbox (Blau)</h3>
                <p className="small mb-0">
                  Gut geeignet für Hinweise auf Tools, Services oder
                  weiterführende Analysen im Portal.
                </p>
              </div>
            </div>
          </div>

          {/* gelbe Highlight-Box */}
          <div className="col-12 col-md-4">
            <div
              className="card h-100 border-0 shadow-sm"
              style={{ backgroundColor: "#FFE000", color: "#000" }}
            >
              <div className="card-body">
                <h3 className="h6 mb-2">Highlight-Box (Gelb)</h3>
                <p className="small mb-0">
                  Für zentrale Aussagen wie &bdquo;angespannter Mietmarkt&ldquo;
                  oder &bdquo;überdurchschnittliche Preisentwicklung&ldquo;.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Text + Bild links */}
      <section id="text-bild-links" className="mb-5">
        <h2 className="h4 mb-3">Text mit Bild (links)</h2>
        <div className="row g-4 align-items-center">
          <div className="col-12 col-md-4">
            <img
              src="https://via.placeholder.com/600x400?text=Lagebild"
              alt="Platzhalterbild links"
              className="img-fluid rounded shadow-sm"
            />
          </div>
          <div className="col-12 col-md-8">
            <h3 className="h6 mb-2">Beispiel: Charakter der Wohnlage</h3>
            <p className="small text-muted mb-2">
              Bild links, Text rechts – dieses Muster eignet sich für
              Lagebeschreibungen, Quartiersfotos oder illustrative Beispiele.
            </p>
            <p className="small text-muted mb-0">
              Auf mobilen Geräten werden Bild und Text untereinander dargestellt,
              auf größeren Bildschirmen nebeneinander.
            </p>
          </div>
        </div>
      </section>

      {/* Text + Bild rechts */}
      <section id="text-bild-rechts" className="mb-5">
        <h2 className="h4 mb-3">Text mit Bild (rechts)</h2>
        <div className="row g-4 align-items-center flex-md-row-reverse">
          <div className="col-12 col-md-4">
            <img
              src="https://via.placeholder.com/600x400?text=Infrastruktur"
              alt="Platzhalterbild rechts"
              className="img-fluid rounded shadow-sm"
            />
          </div>
          <div className="col-12 col-md-8">
            <h3 className="h6 mb-2">Beispiel: Infrastruktur &amp; Erreichbarkeit</h3>
            <p className="small text-muted mb-2">
              Dieses Layout eignet sich für Inhalte zu Verkehrsanbindung,
              Fahrzeiten, ÖPNV oder Nähe zu Arbeitsmarktzentren.
            </p>
            <p className="small text-muted mb-0">
              Auch hier werden Bild und Text auf kleinen Geräten untereinander
              und auf größeren Screens nebeneinander dargestellt.
            </p>
          </div>
        </div>
      </section>

      {/* Tabelle */}
      <section id="tabelle" className="mb-5">
        <h2 className="h4 mb-3">Tabelle</h2>
        <p className="small text-muted mb-3">
          Tabellen sind ideal für Kennzahlen – strukturiert, gut lesbar und
          hervorragend von Suchmaschinen und KI-Systemen auswertbar.
        </p>
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Kennzahl</th>
                    <th scope="col">Wert</th>
                    <th scope="col">Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Ø Angebotsmiete</td>
                    <td>9,80</td>
                    <td>€/m²</td>
                  </tr>
                  <tr>
                    <td>Ø Kaufpreis</td>
                    <td>2.950</td>
                    <td>€/m²</td>
                  </tr>
                  <tr>
                    <td>Leerstandsquote</td>
                    <td>2,1</td>
                    <td>%</td>
                  </tr>
                  <tr>
                    <td>Bevölkerungsentwicklung (10 Jahre)</td>
                    <td>+4,3</td>
                    <td>%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 3er Grid */}
      <section id="grid-3" className="mb-5">
        <h2 className="h4 mb-3">3er Grid</h2>
        <p className="small text-muted mb-3">
          Ideal für kurze Zusammenfassungen – z. B. Lage, Nachfrage und
          Preisniveau.
        </p>
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-1">Wohnlage</h3>
                <p className="small text-muted mb-0">
                  Ruhige Wohnlage mit überwiegender Einfamilienhausbebauung und
                  dörflichem Charakter.
                </p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-1">Nachfrage</h3>
                <p className="small text-muted mb-0">
                  Stabile Nachfrage von Familien und Pendlern mit Bezug zu
                  umliegenden Zentren.
                </p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-1">Preisniveau</h3>
                <p className="small text-muted mb-0">
                  Preisniveau leicht über dem Kreisdurchschnitt, aber deutlich
                  unter Großstadtlagen.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2er Grid */}
      <section id="grid-2" className="mb-5">
        <h2 className="h4 mb-3">2er Grid</h2>
        <p className="small text-muted mb-3">
          Gut für Gegenüberstellungen – z. B. Bestands- und Neubaumarkt.
        </p>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-1">Bestandsmarkt</h3>
                <p className="small text-muted mb-0">
                  Gewachsener Bestand mit Modernisierungspotenzial, moderate
                  Flächenreserven und kontinuierlicher Nachfrage.
                </p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-1">Neubaumarkt</h3>
                <p className="small text-muted mb-0">
                  Punktuelle Neubauaktivität mit Fokus auf Einfamilienhäuser und
                  kleinere Mehrfamilienhausprojekte.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Formular */}
      <section id="formular" className="mb-5">
        <h2 className="h4 mb-3">Formular</h2>
        <p className="small text-muted mb-3">
          Ein einfaches Formular-Muster, z. B. für Kontaktanfragen oder
          Rückfragen zu bestimmten Wohnlagen.
        </p>
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <form className="row g-3">
              <div className="col-md-6">
                <label htmlFor="name" className="form-label small fw-semibold">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="form-control form-control-sm"
                  placeholder="Ihr Name"
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="email" className="form-label small fw-semibold">
                  E-Mail
                </label>
                <input
                  type="email"
                  id="email"
                  className="form-control form-control-sm"
                  placeholder="name@beispiel.de"
                />
              </div>
              <div className="col-12">
                <label
                  htmlFor="nachricht"
                  className="form-label small fw-semibold"
                >
                  Nachricht / Anfrage
                </label>
                <textarea
                  id="nachricht"
                  rows={4}
                  className="form-control form-control-sm"
                  placeholder="Ihre Frage zur Wohnlage, zum Markt oder zu den Daten …"
                />
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-primary btn-sm px-4">
                  Anfrage senden
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Chart-Platzhalter */}
      <section id="chart" className="mb-3">
        <h2 className="h4 mb-3">Chart-Platzhalter</h2>
        <p className="small text-muted mb-3">
          Dieser Bereich kann später mit einer echten Chart-Komponente gefüllt
          werden – etwa zur Darstellung von Preis- oder Mietenverläufen.
        </p>
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 mb-0">Beispiel-Chartbereich</h3>
              <span className="small text-muted">Datenquelle: interne Analyse</span>
            </div>
            <div
              className="bg-light d-flex align-items-center justify-content-center rounded"
              style={{ height: "180px" }}
            >
              <span className="small text-muted">
                Chart-Komponente (Platzhalter)
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
