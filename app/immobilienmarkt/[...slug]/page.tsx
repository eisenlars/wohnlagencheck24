// app/immobilienmarkt/[...slug]/page.tsx

import { GaugeTacho } from "@/components/gauge-tacho";
import { RegionHero } from "@/components/region-hero";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getReportBySlugs,
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
  type Report,
} from "@/lib/data";


const REPORT_SECTIONS = [
  "immobilienpreise",
  "mietpreise",
  "mietrendite",
  "wohnmarktsituation",
  "grundstueckspreise",
  "wohnlagencheck",
  "wirtschaft",
] as const;

type ReportSection = (typeof REPORT_SECTIONS)[number] | "uebersicht" | null;

type PageParams = {
  slug?: string[];
};

type PageProps = {
  params: Promise<PageParams>; // WICHTIG: params ist ein Promise
};

export default async function ImmobilienmarktHierarchiePage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];

  // Prüfen: letzter Slug = Report-Section?
  let sectionSlug: ReportSection = null;
  let regionSlugs = slugs;

  if (slugs.length > 0) {
    const last = slugs[slugs.length - 1];
    if (REPORT_SECTIONS.includes(last as (typeof REPORT_SECTIONS)[number])) {
      sectionSlug = last as ReportSection;
      regionSlugs = slugs.slice(0, -1);
    }
  }

  const report = getReportBySlugs(regionSlugs);
  if (!report) {
    notFound();
  }

  const level = regionSlugs.length;

  // 0 = Deutschland
  // 1 = Bundesland
  // 2 = Kreis
  // 3+ = Ort
  if (level === 0) {
    return <DeutschlandPage report={report} sectionSlug={sectionSlug} />;
  }

  if (level === 1) {
    return (
      <BundeslandPage
        report={report}
        slugs={regionSlugs}
        sectionSlug={sectionSlug}
      />
    );
  }

  if (level === 2) {
    return (
      <KreisPage
        report={report}
        slugs={regionSlugs}
        sectionSlug={sectionSlug}
      />
    );
  }

  // level >= 3
  return (
    <OrtPage
      report={report}
      slugs={regionSlugs}
      sectionSlug={sectionSlug}
    />
  );
}


/**
 * Deutschland-Ebene
 */
function DeutschlandPage({
  report,
  sectionSlug,
}: {
  report: Report;
  sectionSlug: ReportSection;
}) {
  const bundeslaender = getBundeslaender();

  return (
    <div className="text-dark">
      <section className="mb-4">
        <h1 className="h3 mb-2">
          Immobilienmarkt Deutschland – Übersicht der Bundesländer
        </h1>
        <p className="small text-muted mb-0">
          {report.meta.name || "Deutschland"} – aggregiertes Marktprofil.
        </p>
        {sectionSlug && (
          <p className="small text-muted mb-0">
            Hinweis: Berichtsebene <strong>{sectionSlug}</strong> ist auf
            Deutschland-Ebene noch nicht separat ausgearbeitet.
          </p>
        )}
      </section>
      ...
    </div>
  );
}


/**
 * Bundesland-Ebene:
 * zeigt alle Kreise + deren Ortslagen
 */
 
function BundeslandPage({
  report,
  slugs,
  sectionSlug,
}: {
  report: Report;
  slugs: string[];
  sectionSlug: ReportSection;
}) {
  const bundeslandSlug = report.meta.slug;
  const kreise = getKreiseForBundesland(bundeslandSlug);

  return (
    <div className="text-dark">
      {/* Header */}
      <section className="mb-4">
        ...
        {sectionSlug && (
          <p className="small text-muted mt-1">
            Aktive Berichtsebene: <strong>{sectionSlug}</strong> (Detailaufbau
            folgt).
          </p>
        )}
      </section>
      ...
    </div>
  );
}


/**
 * Kreis-Ebene
 */
 
 
function KreisPage({
  report,
  slugs,
  sectionSlug,
}: {
  report: Report;
  slugs: string[];
  sectionSlug: ReportSection;
}) {
  const [bundeslandSlug, kreisSlug] = slugs;
  const orte = getOrteForKreis(bundeslandSlug, kreisSlug);

  const kreisName = report.meta.name;
  const activeSection: ReportSection = sectionSlug ?? "uebersicht";

  // Basis-Preisdaten aus dem Report

  // Immobilien-Kaufpreis
  const kaufpreisRoh =
    (report.data as any)?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien ??
    null;
  const kaufpreis =
    kaufpreisRoh !== null
      ? Number(
          kaufpreisRoh.toString().replace(".", "").replace(",", "."),
        )
      : null;

  // Grundstückskaufpreis
  const grundstueckRoh =
    (report.data as any)?.grundstueck_kaufpreis?.[0]?.kaufpreis_grundstueck ??
    null;
  const grundstueckspreis =
    grundstueckRoh !== null
      ? Number(
          grundstueckRoh.toString().replace(".", "").replace(",", "."),
        )
      : null;

  // Kaltmiete
  const mieteRoh =
    (report.data as any)?.mietpreise_gesamt?.[0]?.preis_kaltmiete ?? null;
  const kaltmiete =
    mieteRoh !== null
      ? Number(mieteRoh.toString().replace(".", "").replace(",", "."))
      : null;

  // Überregionaler Vergleich: Immobilienpreise
  type VergleichItem = { region: string; value: number };

  const immVergleichRaw =
    (report.data as any)?.immobilienpreise_ueberregionaler_vergleich ?? [];

  const immVergleich: VergleichItem[] = immVergleichRaw
    .map((item: any) => ({
      region: String(item.region),
      value: Number(item.immobilienpreis),
    }))
    .filter((item: VergleichItem) => item.region && !Number.isNaN(item.value));

  // Überregionaler Vergleich: Grundstückspreise
  const grundVergleichRaw =
    (report.data as any)?.grundstueckspreise_ueberregionaler_vergleich ?? [];

  const grundVergleich: VergleichItem[] = grundVergleichRaw
    .map((item: any) => ({
      region: String(item.region),
      value: Number(item.grundstueckspreis),
    }))
    .filter((item: VergleichItem) => item.region && !Number.isNaN(item.value));

  // Überregionaler Vergleich: Mietpreise (Kaltmiete)
  const mieteVergleichRaw =
    (report.data as any)?.mietpreise_ueberregionaler_vergleich ?? [];

  const mieteVergleich: VergleichItem[] = mieteVergleichRaw
    .map((item: any) => ({
      region: String(item.region),
      value: Number(item.kaltmiete),
    }))
    .filter((item: VergleichItem) => item.region && !Number.isNaN(item.value));

  // Hero-Bildpfad
  const heroImageSrc = `/images/immobilienmarkt/${slugs.join(
    "/",
  )}/immobilienmarktbericht-${slugs.at(-1)}.jpg`;

  // Tabs für Kreisebene
  const kreisTabs = [
    {
      id: "uebersicht" as const,
      label: "Übersicht",
      badge: "R",
    },
    {
      id: "immobilienpreise" as const,
      label: "Immobilienpreise",
      badge: "K",
    },
    {
      id: "mietpreise" as const,
      label: "Mietpreise",
      badge: "M",
    },
    {
      id: "mietrendite" as const,
      label: "Mietrendite",
      badge: "R",
    },
    {
      id: "wohnmarktsituation" as const,
      label: "Wohnmarktsituation",
      badge: "S",
    },
    {
      id: "grundstueckspreise" as const,
      label: "Grundstückspreise",
      badge: "B",
    },
    {
      id: "wohnlagencheck" as const,
      label: "Wohnlagencheck",
      badge: "L",
    },
    {
      id: "wirtschaft" as const,
      label: "Wirtschaft",
      badge: "W",
    },
  ];

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  return (
    <div className="text-dark">
      <RegionHero
        title={kreisName}
        subtitle="Immobilienmarkt & Standortprofil"
        imageSrc={heroImageSrc}
        rightOverlay={
          <>
            <GaugeTacho
              value={20}
              backgroundLabel="Kauf"
              leftLabelLines={["Käufermarkt"]}
              rightLabelLines={["Verkäufermarkt"]}
              width={280}
              height={160}
            />
            <GaugeTacho
              value={-15}
              backgroundLabel="Miete"
              leftLabelLines={["Mietermarkt"]}
              rightLabelLines={["Vermietermarkt"]}
              width={280}
              height={160}
            />
          </>
        }
      />

      {/* Header */}
      <section className="mb-3">
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
          Immobilienmarkt – Landkreis
        </div>

        <h1 className="mt-3 mb-1">{kreisName}</h1>
        <p className="small text-muted mb-0">
          Markt- und Standortprofil des Landkreises {kreisName}.
        </p>
      </section>

      {/* Subnavigation Kreisebene */}
      <section className="mb-4">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small text-uppercase text-muted me-2">
            Berichtsebenen
          </span>
          <ul className="nav nav-pills flex-wrap gap-2 small">
            {kreisTabs.map((tab) => {
              const isActive =
                activeSection === tab.id ||
                (!sectionSlug && tab.id === "uebersicht");

              const href =
                tab.id === "uebersicht" ? basePath : `${basePath}/${tab.id}`;

              return (
                <li className="nav-item" key={tab.id}>
                  <Link
                    href={href}
                    className={
                      "nav-link d-flex align-items-center gap-2 py-1 px-2 rounded-pill" +
                      (isActive
                        ? " active bg-dark text-white"
                        : " bg-light text-dark border-0")
                    }
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={
                        "d-inline-flex align-items-center justify-content-center rounded-circle small fw-semibold" +
                        (isActive
                          ? " bg-warning text-dark"
                          : " bg-dark text-white")
                      }
                      style={{
                        width: "22px",
                        height: "22px",
                      }}
                    >
                      {tab.badge}
                    </span>
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CONTENT je Berichtsebene */}

      {/* Übersicht */}
      {activeSection === "uebersicht" && (
        <>
          {/* Kennzahlen */}
          <section className="mb-4">
            <div className="row g-3">
              {/* Immobilien-Kaufpreis */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h2 className="h6 mb-2">Ø Immobilien-Kaufpreis</h2>

                    {kaufpreis !== null ? (
                      <>
                        <p className="h4 mb-1">
                          {kaufpreis.toLocaleString("de-DE")} €
                          <small className="text-muted"> / m²</small>
                        </p>
                        <p className="small text-muted mb-0">
                          Angebotsniveau im Landkreis
                        </p>
                      </>
                    ) : (
                      <p className="small text-muted mb-0">
                        Keine Kaufpreisdaten verfügbar.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Grundstückskaufpreis */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h2 className="h6 mb-2">Ø Grundstückspreis</h2>

                    {grundstueckspreis !== null ? (
                      <>
                        <p className="h4 mb-1">
                          {grundstueckspreis.toLocaleString("de-DE")} €
                          <small className="text-muted"> / m²</small>
                        </p>
                        <p className="small text-muted mb-0">
                          Durchschnittlicher Bodenrichtwert
                        </p>
                      </>
                    ) : (
                      <p className="small text-muted mb-0">
                        Keine Grundstücksdaten verfügbar.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Kaltmiete */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h2 className="h6 mb-2">Ø Kaltmiete</h2>

                    {kaltmiete !== null ? (
                      <>
                        <p className="h4 mb-1">
                          {kaltmiete.toLocaleString("de-DE")} €
                          <small className="text-muted"> / m²</small>
                        </p>
                        <p className="small text-muted mb-0">
                          Angebotsmieten im Landkreis
                        </p>
                      </>
                    ) : (
                      <p className="small text-muted mb-0">
                        Keine Mietdaten verfügbar.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Überregionaler Vergleich */}
          <section className="mb-4">
            <h2 className="h6 mb-3">Überregionaler Vergleich</h2>
            <p className="small text-muted mb-3">
              Die folgenden Diagramme zeigen den Landkreis im Vergleich zu
              Deutschland und dem Bundesland – jeweils auf Basis der aktuellen
              Angebotsdaten.
            </p>

            <div className="row g-3">
              {/* Immobilienpreise */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h3 className="h6 mb-2">Immobilienpreise</h3>
                    <VergleichChart
                      title="Immobilienpreise"
                      unit="€/m²"
                      items={immVergleich}
                      barColor="rgba(75,192,192)"
                    />
                  </div>
                </div>
              </div>

              {/* Grundstückspreise */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h3 className="h6 mb-2">Grundstückspreise</h3>
                    <VergleichChart
                      title="Grundstückspreise"
                      unit="€/m²"
                      items={grundVergleich}
                      barColor="rgb(72, 107, 122)"
                    />
                  </div>
                </div>
              </div>

              {/* Mietpreise (Kaltmiete) */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h3 className="h6 mb-2">Kaltmieten</h3>
                    <VergleichChart
                      title="Kaltmieten"
                      unit="€/m²"
                      items={mieteVergleich}
                      barColor="rgba(200,213,79)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Erfasste Wohnlagen */}
          <section className="mb-4">
            <h2 className="h6 mb-3">Erfasste Wohnlagen im Landkreis</h2>
            <div className="row g-3">
              {orte.map((ort) => (
                <div key={ort.slug} className="col-12 col-md-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h3 className="h6 mb-1">
                        <Link
                          href={`/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ort.slug}`}
                          className="link-primary"
                        >
                          {ort.name}
                        </Link>
                      </h3>
                      {ort.plz && (
                        <p className="small text-muted mb-0">
                          PLZ {ort.plz}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {orte.length === 0 && (
                <p className="small text-muted mb-0">
                  Für diesen Landkreis liegen noch keine einzelnen Wohnlagen
                  vor.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {/* Immobilienpreise-Ansicht */}
      {activeSection === "immobilienpreise" && (
        <>
          <section className="mb-4">
            <h2 className="h5 mb-2">
              Immobilienpreise im Landkreis {kreisName}
            </h2>
            <p className="small text-muted mb-2">
              In diesem Abschnitt werden die Angebotspreise für Wohnimmobilien
              im Landkreis {kreisName} vertieft betrachtet – inklusive
              Einordnung im Vergleich zu Deutschland und zum jeweiligen
              Bundesland.
            </p>
            <p className="small text-muted mb-0">
              Die nachfolgenden Kennzahlen und Diagramme sind zunächst als
              Platzhalter angelegt und können später direkt aus deiner
              JSON-Struktur gespeist und textlich kommentiert werden.
            </p>
          </section>

          {/* Leitkennzahl Immobilien-Kaufpreis */}
          <section className="mb-4">
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h3 className="h6 mb-2">Ø Kaufpreis Wohnimmobilien</h3>
                    {kaufpreis !== null ? (
                      <>
                        <p className="display-6 mb-1">
                          {kaufpreis.toLocaleString("de-DE")} €
                          <small className="text-muted fs-6">
                            {" "}
                            / m² Wfl.
                          </small>
                        </p>
                        <p className="small text-muted mb-0">
                          Angebotsniveau für typische Wohnimmobilien im
                          Landkreis {kreisName}. Die Werte basieren auf
                          inserierten Objekten.
                        </p>
                      </>
                    ) : (
                      <p className="small text-muted mb-0">
                        Für diesen Landkreis liegen aktuell keine
                        Kaufpreisdaten vor.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Platzhalter für zusätzliche Kennzahlen */}
              <div className="col-12 col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h3 className="h6 mb-2">Weitere Kennzahlen (Platzhalter)</h3>
                    <p className="small text-muted mb-2">
                      Hier können später weitere Kennzahlen ergänzt werden, z. B.:
                    </p>
                    <ul className="small text-muted mb-0">
                      <li>Spannweite der Kaufpreise nach Lagequalität</li>
                      <li>Preisniveaus für Wohnungen vs. Einfamilienhäuser</li>
                      <li>Segmentierung nach Baualtersklassen</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Überregionaler Vergleich nur für Immobilienpreise */}
          <section className="mb-4">
            <h3 className="h6 mb-3">
              Überregionaler Vergleich der Immobilienpreise
            </h3>
            <p className="small text-muted mb-3">
              Der Landkreis wird hier den durchschnittlichen
              Wohnimmobilienpreisen in Deutschland und im jeweiligen Bundesland
              gegenübergestellt.
            </p>
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <VergleichChart
                  title="Immobilienpreise"
                  unit="€/m²"
                  items={immVergleich}
                  barColor="rgba(75,192,192)"
                />
              </div>
            </div>
          </section>

          {/* Textplatzhalter für beschreibende Auswertung */}
          <section className="mb-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h3 className="h6 mb-2">Preisniveau im Kontext</h3>
                <p className="small text-muted mb-2">
                  An dieser Stelle kann später ein automatisch generierter Text
                  entstehen, der das Preisniveau des Landkreises {kreisName} im
                  Verhältnis zu Deutschland und zum Bundesland beschreibt – zum
                  Beispiel in Form von Prozentabweichungen oder Rangplätzen.
                </p>
                <p className="small text-muted mb-0">
                  Die dafür erforderlichen Relationen lassen sich direkt aus den
                  JSON-Daten ableiten, ohne zusätzliche Quellen abfragen zu
                  müssen.
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Generischer Platzhalter für die anderen Bereiche */}
      {activeSection !== "uebersicht" &&
        activeSection !== "immobilienpreise" && (
          <section className="mb-4">
            <h2 className="h6 mb-2">
              Bereich:{" "}
              {kreisTabs.find((t) => t.id === activeSection)?.label ??
                activeSection ??
                "unbekannt"}
            </h2>
            <p className="small text-muted mb-2">
              Für diese Berichtsebene ist derzeit noch kein spezielles Layout
              hinterlegt. Die Seite ist bereits über die URL-Struktur
              erreichbar und kann in einem nächsten Schritt mit eigenen
              Kennzahlen, Charts und Textbausteinen gefüllt werden.
            </p>
          </section>
        )}
    </div>
  );
}






/**
 * Orts-Ebene – aktuell noch mit Rohdaten-Ausgabe
 */
function OrtPage({
  report,
  slugs,
  sectionSlug,
}: {
  report: Report;
  slugs: string[];
  sectionSlug: ReportSection;
}) {
  const name = report.meta.name;
  const plz = report.meta.plz;

  return (
    <div className="text-dark">
      <section className="mb-4">
        ...
        {sectionSlug && (
          <p className="small text-muted mt-1">
            Berichtsebene <strong>{sectionSlug}</strong> – spezialisierte
            Auswertung auf Wohnlagenebene folgt.
          </p>
        )}
      </section>
      ...
    </div>
  );
}








////////////////// Helper


type VergleichItem = { region: string; value: number };

function VergleichChart({
  title,
  unit,
  items,
  barColor,
}: {
  title: string;
  unit: string;
  items: VergleichItem[];
  barColor: string;
}) {
  if (!items || items.length === 0) {
    return (
      <p className="small text-muted mb-0">
        Für diesen Vergleich liegen aktuell keine Daten vor.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.value));

  // Größeres Chart, mehr vertikaler Raum
  const svgHeight = 220;
  const paddingTop = 28;
  const paddingBottom = 52;
  const barGap = 28;

  const barWidth = 64;
  const svgWidth =
    items.length * barWidth + (items.length - 1) * barGap + 48;

  const label = `${title} – überregionaler Vergleich`;

  // Label fürs SVG verkürzen, voller Name steht in der Liste
  function getShortLabel(region: string): string {
    let text = region.trim();

    if (text.toLowerCase().startsWith("landkreis ")) {
      text = "LK " + text.slice(10);
    }

    if (text.length <= 14) return text;
    return text.slice(0, 13) + "…";
  }

  return (
    <>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height={svgHeight}
        preserveAspectRatio="xMidYMid meet"
        className="mb-3"
        suppressHydrationWarning
      >
        {items.map((item, index) => {
          const ratio = max > 0 ? item.value / max : 0;

          // Maximal verfügbare Höhe für Balken
          const availableHeight = svgHeight - paddingTop - paddingBottom;
          const barHeight = ratio * availableHeight;

          const x = 24 + index * (barWidth + barGap);
          const y = svgHeight - paddingBottom - barHeight;

          // Position der Zahl: bevorzugt über dem Balken,
          // sonst mittig im Balken (mit anderer Textfarbe)
          const valueAboveY = y - 10;
          const canPlaceAbove = valueAboveY >= paddingTop;

          const valueY = canPlaceAbove
            ? valueAboveY
            : y + barHeight / 2 + 4;

          const valueColor = canPlaceAbove ? "#333" : "#fff";

          // Opazität rein nach Index:
          // 0 = Deutschland, 1 = Bundesland, 2+ = Kreis
          const opacity =
            index === 0 ? 0.35 : index === 1 ? 0.6 : 1.0;

          const shortLabel = getShortLabel(item.region);

          return (
            <g key={item.region}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={8}
                ry={8}
                fill={barColor}
                fillOpacity={opacity}
              />

              {/* Wert (über oder im Balken) */}
              <text
                x={x + barWidth / 2}
                y={valueY}
                textAnchor="middle"
                dominantBaseline={canPlaceAbove ? "auto" : "middle"}
                fontSize="12"
                fontWeight={600}
                fill={valueColor}
              >
                {item.value.toLocaleString("de-DE")}
              </text>

              {/* Regionslabel – ggf. gekürzt */}
              <text
                x={x + barWidth / 2}
                y={svgHeight - 18}
                textAnchor="middle"
                fontSize="11"
                fill="#555"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Textliche Darstellung (SEO/GEO – voll ausgeschrieben) */}
      <ul className="small text-muted mb-0">
        {items.map((item) => (
          <li key={item.region}>
            <strong>{item.region}:</strong>{" "}
            {item.value.toLocaleString("de-DE")} {unit}
          </li>
        ))}
      </ul>
    </>
  );
}








