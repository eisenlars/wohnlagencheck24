// app/immobilienmarkt/[...slug]/page.tsx

import { resolveRoute } from "@/features/immobilienmarkt/routes/resolveRoute";
import { KREIS_TABS } from "@/features/immobilienmarkt/config/kreisSections";

import { buildKreisUebersichtVM } from "@/features/immobilienmarkt/selectors/kreis/uebersicht";
import { KreisUebersichtSection } from "@/features/immobilienmarkt/sections/kreis/KreisUebersichtSection";

import { buildKreisImmobilienpreiseVM } from "@/features/immobilienmarkt/selectors/kreis/immobilienpreise";
import { KreisImmobilienpreiseSection } from "@/features/immobilienmarkt/sections/kreis/KreisImmobilienpreiseSection";

import { buildKreisMietpreiseVM } from "@/features/immobilienmarkt/selectors/kreis/mietpreise";
import { KreisMietpreiseSection } from "@/features/immobilienmarkt/sections/kreis/KreisMietpreiseSection";


//import { GaugeTacho } from "@/components/gauge-tacho";
//import { RegionHero } from "@/components/region-hero";
import { RightEdgeControls } from "@/components/right-edge-controls";


import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getReportBySlugs,
  //getBundeslaender,
  //getKreiseForBundesland,
  getOrteForKreis,
  getImmobilienpreisMapSvg,   
  getMietpreisMapSvg,   
  type Report,
} from "@/lib/data";


type ReportSection =
  | "immobilienpreise"
  | "mietpreise"
  | "mietrendite"
  | "wohnmarktsituation"
  | "grundstueckspreise"
  | "wohnlagencheck"
  | "wirtschaft"
  | "uebersicht"
  | null;
  

type ReportMetaLike = Report["meta"] & {
  bundesland_name?: string;
  amtlicher_name?: string;
};

type ReportDataLike = Report["data"] & {
  text?: {
    berater?: {
      berater_name?: string;
      berater_telefon?: string;
      berater_email?: string;
    };
  };
};


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
  const route = resolveRoute(slugs);
  const regionSlugs = route.regionSlugs;

  // Für deinen bisherigen Code: sectionSlug kompatibel halten
  const sectionSlug: ReportSection | null = route.section === "uebersicht" ? null : route.section;


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
    const [bundeslandSlug, kreisSlug] = regionSlugs;



    // --- Übersicht über Feature-System ---
    
    if (route.section === "uebersicht") {
      const activeTab =
        KREIS_TABS.find((t) => t.id === "uebersicht")!;

      const tabs = KREIS_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        iconSrc: t.iconSrc,
      }));

      const orte = getOrteForKreis(bundeslandSlug, kreisSlug);

      const vm = buildKreisUebersichtVM({
        report,
        bundeslandSlug,
        kreisSlug,
      });

      return (
        <KreisUebersichtSection
          vm={vm}
          tocItems={activeTab.toc}
          tabs={tabs}
          activeTabId="uebersicht"
          orte={orte}
          bundeslandSlug={bundeslandSlug}
          kreisSlug={kreisSlug}
        />
      );
    }
    

    // --- Immobilienpreise über Feature-System ---
    
    if (route.section === "immobilienpreise") {
      
      const data = report.data as ReportDataLike;
      // optional, falls meta gebraucht wird
      // const meta = report.meta as ReportMetaLike;
      
      const activeTab =
        KREIS_TABS.find((t) => t.id === "immobilienpreise") ??
        KREIS_TABS.find((t) => t.id === "uebersicht")!;

      const tabs = KREIS_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        iconSrc: t.iconSrc,
      }));

      const orte = getOrteForKreis(bundeslandSlug, kreisSlug);
      const immobilienpreisMapSvg = getImmobilienpreisMapSvg(bundeslandSlug, kreisSlug);

      // Hero-Image wie bei Übersicht
      const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

      // VM korrekt bauen (ohne {}!)
      const vm = buildKreisImmobilienpreiseVM({ report, bundeslandSlug, kreisSlug });

      // Optional: Berater analog zur Übersicht (wenn du es sauber übergeben willst)
      const beraterName = data.text?.berater?.berater_name ?? "Lars Hofmann";
      const beraterTaetigkeit = `Standort- / Immobilienberatung – ${vm.kreisName}`;
      const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

      return (
        <KreisImmobilienpreiseSection
          vm={vm}
          tabs={tabs}
          tocItems={activeTab.toc}
          activeTabId="immobilienpreise"
          orte={orte}
          bundeslandSlug={bundeslandSlug}
          kreisSlug={kreisSlug}
          heroImageSrc={heroImageSrc}
          immobilienpreisMapSvg={immobilienpreisMapSvg}
          berater={{
            name: beraterName,
            taetigkeit: beraterTaetigkeit,
            imageSrc: beraterImageSrc,
          }}
        />
      );
    }


    // --- Mietpreise über Feature-System ---
    
    if (route.section === "mietpreise") {
      const activeTab =
        KREIS_TABS.find((t) => t.id === route.section) ??
        KREIS_TABS.find((t) => t.id === "uebersicht")!;

      const tabs = KREIS_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        iconSrc: t.iconSrc,
      }));

      const mietpreisMapSvg = getMietpreisMapSvg(bundeslandSlug, kreisSlug);
      
      const orte = getOrteForKreis(bundeslandSlug, kreisSlug);
      
      // Hero-Image wie bei Übersicht
      const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

      const vm = buildKreisMietpreiseVM({
        report,
        bundeslandSlug,
        kreisSlug,
        mietpreisMapSvg,
      });

      return (
        <KreisMietpreiseSection
          vm={vm}
          tabs={tabs}
          tocItems={activeTab.toc}
          activeTabId={route.section}
          orte={orte}
          bundeslandSlug={bundeslandSlug}
          kreisSlug={kreisSlug}
          heroImageSrc={heroImageSrc}
        />
      );
    }

    // Alles andere bleibt vorerst beim bisherigen Code
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
  
  //const bundeslaender = getBundeslaender(); // -> einblenden wenn benötigt

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
  sectionSlug,
}: {
  report: Report;
  sectionSlug: ReportSection;
}) {
  //const bundeslandSlug = report.meta.slug;
  //const kreise = getKreiseForBundesland(bundeslandSlug);

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

  // -------------------------------------------------------------------
  // --------------------- Allgemein für alle Subseiten ----------------
  // -------------------------------------------------------------------

  const meta = report.meta as ReportMetaLike;
  const data = report.data as ReportDataLike;
  
  const [bundeslandSlug, kreisSlug] = slugs;
  //const orte = getOrteForKreis(bundeslandSlug, kreisSlug);


  //const bundeslandName = String(meta.bundesland_name ?? "").trim();
  const kreisName = String(meta.amtlicher_name ?? meta.name ?? "").trim();
  
  
  const activeSection: ReportSection = sectionSlug ?? "uebersicht";
  
  const tocItems = getTocItemsForSection(activeSection);
  

  
  // --------------- Subnavigation ----------------
  
  // --- Tabs für Kreisebene ---
  const kreisTabs = [
    {
      id: "uebersicht" as const,
      label: "Übersicht",
    },
    {
      id: "immobilienpreise" as const,
      label: "Immobilienpreise",
    },
    {
      id: "mietpreise" as const,
      label: "Mietpreise",
    },
    {
      id: "mietrendite" as const,
      label: "Mietrendite",
    },
    {
      id: "wohnmarktsituation" as const,
      label: "Wohnmarktsituation",
    },
    {
      id: "grundstueckspreise" as const,
      label: "Grundstückspreise",
    },
    {
      id: "wohnlagencheck" as const,
      label: "Wohnlagencheck",
    },
    {
      id: "wirtschaft" as const,
      label: "Wirtschaft",
    },
  ];

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;


  // --- Navigation Subnavi ---
  // Mapping: Tab → Icon 
  const TAB_ICON_MAP: Record<string, string> = {
    uebersicht: "/icons/ws24_marktbericht_ueberblick.svg",
    immobilienpreise: "/icons/ws24_marktbericht_immobilienpreise.svg",
    mietpreise: "/icons/ws24_marktbericht_mietpreise.svg",
    mietrendite: "/icons/ws24_marktbericht_mietrendite.svg",
    wohnmarktsituation: "/icons/ws24_marktbericht_wohnmarktsituation.svg",
    grundstueckspreise: "/icons/ws24_marktbericht_grundstueckspreise.svg",
    wohnlagencheck: "/icons/ws24_marktbericht_wohnlagencheck.svg",
    wirtschaft: "/icons/ws24_marktbericht_wirtschaft.svg",
  };



  // --------------- Bild Hero ----------------

  // --- Bildpfad ---
  const heroImageSrc = `/images/immobilienmarkt/${slugs.join("/",)}/immobilienmarktbericht-${slugs.at(-1)}.jpg`;
  

  // --- Overlays im Hero - Tachos, Buttons ---
  const isOverview = activeSection === "uebersicht";
  const isImmobilienpreise = activeSection === "immobilienpreise";
  const isMietpreise = activeSection === "mietpreise";

  let heroRightOverlay: React.ReactNode = null;
  let heroRightOverlayMode: "tachos" | "buttons" | undefined = undefined;

  if (isOverview) {
    heroRightOverlayMode = "tachos";
    heroRightOverlay = (
      <>
        <GaugeTacho
          value={20}
          backgroundLabel="Kauf"
          leftLabelLines={["Käufermarkt"]}
          rightLabelLines={["Verkäufermarkt"]}
          width={220}
          height={135}
        />
        <GaugeTacho
          value={-15}
          backgroundLabel="Miete"
          leftLabelLines={["Mietermarkt"]}
          rightLabelLines={["Vermietermarkt"]}
          width={220}
          height={135}
        />
      </>
    );
  } else if (isImmobilienpreise) {
    heroRightOverlayMode = "buttons";
    heroRightOverlay = (
      <>
        <button
          className="btn flex-fill fw-semibold"
          style={{
            backgroundColor: "#fff",
            color: "#000",
            border: "1px solid #fff",
            borderRadius: "1rem 1rem 0 0", // nur oben rund
            padding: "1rem 1.25rem",        // „doppelt so groß“
            fontSize: "1.1rem",
          }}
        >
          Immobilienangebote
        </button>

        <button
          className="btn fw-semibold"
          style={{
            backgroundColor: "#fff",
            color: "#000",
            border: "1px solid #fff",
            borderRadius: "1rem 1rem 0 0",
            padding: "1rem 1.25rem",
            fontSize: "1.1rem",
            flex: 1,              // nur innerhalb der maxWidth-Zone strecken
          }}
        >
          Immobiliengesuche
        </button>
      </>
    );
  } else if (isMietpreise) {
    heroRightOverlayMode = "buttons";
    heroRightOverlay = (
      <>
        <button
          className="btn flex-fill fw-semibold"
          style={{
            backgroundColor: "#fff",
            color: "#000",
            border: "1px solid #fff",
            borderRadius: "1rem 1rem 0 0", // nur oben rund
            padding: "1rem 1.25rem",        // „doppelt so groß“
            fontSize: "1.1rem",
          }}
        >
          Mietangebote
        </button>

        <button
          className="btn fw-semibold"
          style={{
            backgroundColor: "#fff",
            color: "#000",
            border: "1px solid #fff",
            borderRadius: "1rem 1rem 0 0",
            padding: "1rem 1.25rem",
            fontSize: "1.1rem",
            flex: 1,              // nur innerhalb der maxWidth-Zone strecken
          }}
        >
          Mietgesuche
        </button>
      </>
    );
    
    
    
    
  } else {
    // Fallback: z.B. kein Overlay oder später andere Inhalte
    heroRightOverlay = null;
  }




  // --------------- Inhaltsverzeichnis ---------------
  
  function getTocItemsForSection(section: ReportSection): TocItem[] {
    switch (section) {
      case "uebersicht":
        return [
          { id: "einleitung", label: "Einleitung" },
          { id: "standort", label: "Standortüberblick" },
          { id: "marktueberblick", label: "Marktüberblick" },
          { id: "preise-vergleich", label: "Überregionale Preise" },
          { id: "preise-entwicklung", label: "Preisentwicklung" },
          { id: "ortslagen-tabelle", label: "Ortslagenpreise" },
          { id: "preisspannen", label: "Teuer vs. günstig" },
          { id: "wohnlagen", label: "Wohnlagenübersicht" },
        ];

      case "immobilienpreise":
        return [
          { id: "einleitung", label: "Einleitung" },
          { id: "leitkennzahl", label: "Leitkennzahl Kaufpreis" },
          { id: "vergleich", label: "Überregionaler Vergleich" },
          { id: "kommentar", label: "Preisniveau im Kontext" },
        ];

      // falls du weitere Tabs später ausstattest:
      case "mietpreise":
        return [
          { id: "einleitung", label: "Einleitung" },
          { id: "mieten-uebersicht", label: "Mietniveau" },
          { id: "mieten-vergleich", label: "Vergleich" },
        ];

      default:
        return [];
    }
  }


  // --------------- Text + Bild Beraterkontakt ----------------
  
  const beraterName = data.text?.berater?.berater_name ?? "Lars Hofmann";
  const beraterTelefon = data.text?.berater?.berater_telefon ?? "+49 351/287051-0 ";
  const beraterEmail = data.text?.berater?.berater_email ?? "kontakt@wohnlagencheck24.de";

  
  // --- Text: dynamisch mit Kreisnamen ---
  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;
  
  // Bild: immobilienberatung-{kreisSlug}.png ---
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;



  
  
  

  
  


  return (
  

    
    <div className="text-dark">
    
      {/* Right Edge Controls zeigen */}
      {tocItems.length > 0 && (
        <RightEdgeControls tocItems={tocItems} />
      )}
    
      <div className="container immobilienmarkt-container position-relative">
    

    
    
      {/* Subnavigation Kreisebene – optisch an Card-Oberkante, sticky */}
      <section className="kreis-subnav kreis-subnav-sticky mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">

          {/* Tabs in einem horizontal scrollbaren Wrapper */}
          <div className="kreis-subnav-tabs-wrapper w-100">
            <ul className="nav nav-pills flex-nowrap small kreis-subnav-tabs">
              {kreisTabs.map((tab) => {
                const isActive =
                  activeSection === tab.id ||
                  (!sectionSlug && tab.id === "uebersicht");

                const href =
                  tab.id === "uebersicht" ? basePath : `${basePath}/${tab.id}`;

                const iconSrc = TAB_ICON_MAP[tab.id] ?? "/icons/test-icon.svg";

                return (
                  <li className="nav-item" key={tab.id}>
                    <Link
                      href={href}
                      className={
                        "nav-link d-flex flex-column align-items-center justify-content-center gap-2 rounded-pill kreis-subnav-link" +
                        (isActive
                          ? " active bg-dark text-white"
                          : " bg-light text-dark border-0")
                      }
                      aria-current={isActive ? "page" : undefined}
                    >
                      {/* Icon direkt über der Schrift */}
                      <img
                        src={iconSrc}
                        alt=""
                        aria-hidden="true"
                        className="subnav-icon-img"
                      />

                      <span className="subnav-label">{tab.label}</span>
                    </Link>
                  </li>

                );
              })}
            </ul>
          </div>
        </div>
      </section>
      
      
      
      <RegionHero
        title={kreisName}
        subtitle="regionaler Standortberater"
        imageSrc={heroImageSrc}
        rightOverlay={heroRightOverlay}
        rightOverlayMode={heroRightOverlayMode}
      />
      
      


      {/* Generischer Platzhalter für die anderen Bereiche/Themen */}
      {activeSection !== "uebersicht" &&
        activeSection !== "immobilienpreise" && 
          activeSection !== "mietpreise" && 
        (
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
        
        
        
      {/* Kontakt-Offcanvas – kreisspezifisch */}
      <div
        className="offcanvas offcanvas-end"
        tabIndex={-1}
        id="kreisKontaktOffcanvas"
        aria-labelledby="kreisKontaktOffcanvasLabel"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="kreisKontaktOffcanvasLabel">
            Kontakt zum Berater
          </h5>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Schließen"
          />
        </div>

        <div className="offcanvas-body">
          {/* Avatar + Kontaktdaten */}
          <div className="text-center mb-4">
            <div
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "50%",
                overflow: "hidden",
                margin: "0 auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <img
                src={beraterImageSrc}
                alt={beraterName}
                className="w-100 h-100 object-fit-cover"
              />
            </div>
            <p className="mt-3 mb-0 fw-semibold">{beraterName}</p>
            <p className="mb-2 small text-muted">{beraterTaetigkeit}</p>
            <a href={`tel:${beraterTelefon}`} className="d-block fw-bold mb-1">
              {beraterTelefon}
            </a>
            <a
              href={`mailto:${beraterEmail}`}
              className="d-block small text-muted mb-3"
            >
              {beraterEmail}
            </a>
          </div>

          {/* Kontaktformular – hier nur UI; Logik/APIRoute kannst du später ergänzen */}
          <form>
            <div className="mb-3">
              <label className="form-label">Firma</label>
              <input type="text" className="form-control" name="firma" />
            </div>

            <div className="row">
              <div className="col-6 mb-3">
                <label className="form-label">Vorname</label>
                <input type="text" className="form-control" name="vorname" />
              </div>
              <div className="col-6 mb-3">
                <label className="form-label">Nachname</label>
                <input type="text" className="form-control" name="nachname" />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">E-Mail</label>
              <input type="email" className="form-control" name="email" />
            </div>

            <div className="mb-3">
              <label className="form-label">Telefon</label>
              <input type="tel" className="form-control" name="telefon" />
            </div>

            <div className="mb-3">
              <label className="form-label">Nachricht</label>
              <textarea
                rows={4}
                className="form-control"
                name="nachricht"
              />
            </div>

            {/* Optional DSGVO-Hinweis */}
            {/* 
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="kontaktDatenschutz"
              />
              <label className="form-check-label small" htmlFor="kontaktDatenschutz">
                Ich habe die Datenschutzhinweise zur Kenntnis genommen.
              </label>
            </div>
            */}

            <button type="submit" className="btn btn-dark w-100 mt-1">
              Nachricht senden
            </button>
          </form>
        </div>
      </div>
        

    </div>
    
    
    {/* Floating Kontakt-Button – kreisspezifisch */}
    <button
      type="button"
      className="kontakt-fab d-flex align-items-center justify-content-center"
      data-bs-toggle="offcanvas"
      data-bs-target="#kreisKontaktOffcanvas"
      aria-controls="kreisKontaktOffcanvas"
      aria-label="Kontakt zum Berater öffnen"
    >
      {/* Optional Icon (Bootstrap Icons) */}
      {/* <i className="bi bi-envelope-fill me-1" /> */}
      Kontakt
    </button>

    
    </div>
  );
}



/**
 * Orts-Ebene – aktuell noch mit Rohdaten-Ausgabe
 */
function OrtPage({
  //report, // -> reinnehmen wenn aktiv
  //slugs, // -> reinnehmen wenn aktiv
  sectionSlug,
}: {
  //report: Report; // -> reinnehmen wenn aktiv
  //slugs: string[]; // -> reinnehmen wenn aktiv
  sectionSlug: ReportSection;
}) {
  //const name = report.meta.name;
  //const plz = report.meta.plz;

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








