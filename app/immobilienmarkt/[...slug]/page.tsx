// app/immobilienmarkt/[...slug]/page.tsx




import { resolveRoute } from "@/features/immobilienmarkt/routes/resolveRoute";
import { KREIS_TABS } from "@/features/immobilienmarkt/config/kreisSections";

import { buildKreisUebersichtVM } from "@/features/immobilienmarkt/selectors/kreis/uebersicht";
import { KreisUebersichtSection } from "@/features/immobilienmarkt/sections/kreis/KreisUebersichtSection";

import { buildKreisImmobilienpreiseVM } from "@/features/immobilienmarkt/selectors/kreis/immobilienpreise";
import { KreisImmobilienpreiseSection } from "@/features/immobilienmarkt/sections/kreis/KreisImmobilienpreiseSection";

import { buildKreisMietpreiseVM } from "@/features/immobilienmarkt/selectors/kreis/mietpreise";
import { KreisMietpreiseSection } from "@/features/immobilienmarkt/sections/kreis/KreisMietpreiseSection";


import { GaugeTacho } from "@/components/gauge-tacho";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { InteractiveMap } from "@/components/interactive-map";

import { MatrixTable } from "@/components/MatrixTable";
import { VergleichBarChart } from "@/components/VergleichBarChart";
import { buildBarModel } from "@/utils/barModel";

import { FaqSection } from "@/components/FaqSection";

import { VergleichChart } from "@/components/VergleichChart";
import type { VergleichItem } from "@/components/VergleichChart";

import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import type { Zeitpunkt } from "@/components/ZeitreiheChart";

import { PreisindexBox } from "@/components/PreisindexBox";

import {
  OrtslagenUebersichtTable,
  type OrtslagenUebersichtRow,
} from "@/components/OrtslagenUebersichtTable";

import { PreisgrenzenRow } from "@/components/PreisgrenzenRow";

import { KpiValue } from "@/components/KpiValue";

import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

  
import { toNumberOrNull } from "@/utils/toNumberOrNull";  
import { parseNumberDE } from "@/utils/parseNumber";
import {
  formatMetric,
  formatEurPerSqm,
  formatValueCtx,
  formatIndexDelta,
  formatIndexFactor,
  formatPercentSigned,
  formatWithUnit,
} from "@/utils/format";

import { buildTableModel } from "@/utils/buildTableModel";


import { getText } from "@/utils/getText";


import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getReportBySlugs,
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
  getImmobilienpreisMapSvg,   
  getMietpreisMapSvg,   
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


    // Übersicht über Feature-System
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
    

    // Immobilienpreise über Feature-System
    if (route.section === "immobilienpreise") {
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
      const beraterName =
        (report.data as any)?.text?.berater?.berater_name ?? "Lars Hofmann";
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




    // Mietpreise über Feature-System
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

      const vm = buildKreisMietpreiseVM({
        report,
        bundeslandSlug,
        kreisSlug,
        mietpreisMapSvg,
      });

      return (
        <KreisMietpreiseSection
          vm={vm}
          tocItems={activeTab.toc}
          tabs={tabs}
          activeTabId={route.section}
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

  
  
  
  
  
  
  
  // -------------------------------------------------------------------
  // --------------------- Allgemein für alle Subseiten ----------------
  // -------------------------------------------------------------------

  
  
  
  const [bundeslandSlug, kreisSlug] = slugs;
  const orte = getOrteForKreis(bundeslandSlug, kreisSlug);

  const bundeslandName = report.meta.bundesland_name;
  const kreisName = report.meta.amtlicher_name;
  
  const activeSection: ReportSection = sectionSlug ?? "uebersicht";
  
  const tocItems = getTocItemsForSection(activeSection);
  
 
  
  // Farbendefinitionen für Preiskategorien (Header voll, Zellen leicht getönt)
  const COLOR_IMMO = "rgb(75,192,192,0.6)";
  const COLOR_GRUND = "rgb(72,107,122,0.6)";
  const COLOR_MIETE = "rgb(200,213,79,0.6)";

  // RGB-Anteile für eigene Opazitäten
  const COLOR_IMMO_RGB = "75,192,192";
  const COLOR_GRUND_RGB = "72,107,122";
  const COLOR_MIETE_RGB = "200,213,79";

  // Sehr leichte Tönung für Zellen
  const BG_IMMO = `rgba(${COLOR_IMMO_RGB}, 0.1)`;
  const BG_GRUND = `rgba(${COLOR_GRUND_RGB}, 0.1)`;
  const BG_MIETE = `rgba(${COLOR_MIETE_RGB}, 0.1)`;
  
  
  
  
  
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
  
  const beraterName = (report.data as any)?.text?.berater?.berater_name ?? "Lars Hofmann";
  
  const beraterTelefon = (report.data as any)?.text?.berater?.berater_telefon ?? "+49 351/287051-0 ";

  const beraterEmail = (report.data as any)?.text?.berater?.berater_email ?? "kontakt@wohnlagencheck24.de";
  
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
      
      





      {/* CONTENT je Berichtsebene */}




{/****************** Immobilienpreise-Ansicht **************/}

      {activeSection === "immobilienpreise" && (
        <>
        
        
        
        {/* Headline Immobilienpreise */}
        <section className="mb-3" id="einleitung">
          <h1 className="mt-3 mb-1">Immobilienpreise 2025 - {kreisName}</h1>
          <p className="small text-muted mb-4">
            Aktualisiert am: {kreisName}
          </p>

          {/* Einleitungstext */}
          <div>
            <p className="teaser-text">
              {teaserImmobilienpreise}
            </p>
          </div>


          {/* Beraterkontakt */}
          <BeraterBlock
            name={beraterName}
            taetigkeit={beraterTaetigkeit}
            imageSrc={beraterImageSrc}
          />

        </section>
        
        
        
        {/* Leitkennzahl + Interaktive Karte */}
        <section className="mb-5">
          <div className="row g-4 align-items-stretch">
            {/* Linke Spalte: Karte */}
            <div className="col-12 col-lg-6">
              <div className="h-100" style={{ width: "90%", margin: "0 auto" }}>
                {immobilienpreisMapSvg ? (
            
                  <InteractiveMap
                    svg={immobilienpreisMapSvg}
                    theme="immobilienpreis"
                    mode="singleValue"
                    kind="kaufpreis_qm"
                    unitKey="eur_per_sqm"
                    ctx="kpi"
                  />
      
                ) : (
                  <p className="small text-muted mb-0">
                    Für diesen Landkreis liegt aktuell noch keine interaktive
                    Immobilienpreis-Karte vor.
                  </p>
                )}
              </div>
            </div>

            {/* Rechte Spalte: Hauptindikator */}
            <div className="col-12 col-lg-6 d-flex align-items-center">
              <div className="w-100 align-center text-center">
                {kaufpreis !== null && Number.isFinite(kaufpreis) ? (
                  <>
                    <p
                      className="display-1 fw-bold mb-2"
                      style={{ color: "#486b7a", fontSize: "7rem" }}
                    >
                      <KpiValue
                        value={kaufpreis}
                        kind="kaufpreis_qm"
                        unitKey="eur_per_sqm"
                        ctx="kpi"
                        size="ultra"          // ultrahighlight
                        showUnit={true}
                      />
                    </p>
                    <p className="mb-0">Ø Immobilienpreis – {kreisName}</p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Kaufpreisdaten verfügbar.</p>
                )}
              </div>
            </div>
            
          </div>
        </section>



        
        

        {/* Hauspreise – Standard-/Individualüberschrift + Intro */}
        <section className="mb-4" id="hauspreise">
          
          <header className="mb-3">
            {ueberschriftHausIndividuell ? (
              <>
                {/* Standardüberschrift: leicht, damit die Individualüberschrift hervorsticht */}
                <h2 className="h5 text-muted text-uppercase mb-1">
                  Kaufpreise für Häuser in {kreisName}
                </h2>
                {/* Individualüberschrift: optisch wie H2 */}
                <h3 className="h2 mb-0">
                  {ueberschriftHausIndividuell}
                </h3>
              </>
            ) : (
              /* Fallback: nur Standardüberschrift, aber im vollen H2-Stil */
              <h2 className="h2 mb-0">
                Kaufpreise für Häuser in {kreisName}
              </h2>
            )}
          </header>

          {hauspreiseIntro && (
            <p className="teaser-text">
              {hauspreiseIntro}
            </p>
          )}

        {/* --- Hauspreisspanne --- */}
        <KpiValue
          icon="/icons/ws24_marktbericht_immobilienpreise.svg" // optional
          items={[
            { label: "min", value: hausMin, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
            { label: "Durchschnitt", value: hausAvg, kind: "kaufpreis_qm", unitKey: "eur_per_sqm", highlight: true },
            { label: "max", value: hausMax, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
          ]}
          ctx="kpi"
          size="md"
          highlightBg="transparent"            // oder z.B. "#fff3cd"
          highlightValueColor="#486b7a"
          normalValueColor="#6c757d"
        />
        
        </section>
          
          

        {/* --- Kaufpreise für Häuser im überregionalen Vergleich (Tabelle) --- */}
        
          
        <section className="mb-5">

          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">
            Kaufpreise für Häuser im überregionalen Vergleich
          </h3>

          {/* --- Text überregionaler Vergleich Haus --- */}
          {hausVergleichIntro && <p className="mb-3">{hausVergleichIntro}</p>}
          
          
          {/* --- Hauspreisindex --- */}
          {indexHaus !== null && (
          <KpiValue
            icon="/icons/ws24_marktbericht_immobilienpreise.svg"
            iconAlt="Immobilienpreisindex Haus"
            items={[
              { label: "Immobilienpreisindex Haus", value: indexHaus, kind: "index", unitKey: "none" },
            ]}
            ctx="kpi"
            size="lg"
            showUnit={false}
            caption="Basis: D = 100"
          />
          )}

          {/* --- Tabelle überregionaler Vergleich Haus --- */}
          <MatrixTable
            model={ueberregionalModel_haus}
            highlightColLabel="Ø Preis"
            highlightBg="#c8d54f"
            headerBg="#f5f5f5"
          />

        </section>
       
        
        
        {/* --- Kaufpreise für Häuser nach Lage (Tabelle) --- */}
        
        <section className="mb-5" id="hauspreise-lage">

          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">Hauspreise nach Lagequalität</h3>

          {/* Text aus JSON */}
          {text_haus_lage && <p className="mb-3">{text_haus_lage}</p>}

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <MatrixTable
                model={lageModel_haus}
                highlightColLabel="Ø Preis"
                highlightBg="#c8d54f"
                headerBg="#f5f5f5"
              />
            </div>
          </div>
        </section>
   
        
        
        
        {/* --- Kaufpreisentwicklung für Häuser (Chart) --- */}

        {hausKaufpreisentwicklungSeries.length > 0 && (
          <section className="mb-5" id="haus-kaufpreisentwicklung">
            
            {/* Standard-Überschrift */}
            <h3 className="h5 text-muted mb-1">Preisentwicklung: Häuser (Kauf)</h3>
            
            {/* Text aus JSON */}
            {text_haus_kaufpreisentwicklung && <p className="mb-3">{text_haus_kaufpreisentwicklung}</p>}

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <ZeitreiheChart
                  title="Haus-Kaufpreise"
                  ariaLabel={`Preisentwicklung Haus-Kaufpreise: ${kreisName} im Vergleich zu ${bundeslandName ?? "Bundesland"} und Deutschland`}
                  series={hausKaufpreisentwicklungSeries}
                  kind="kaufpreis_qm"
                  unitKey="eur_per_sqm"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={360}
                />
              </div>
            </div>
            
            
            
          </section>
        )}

        
        
        
        
        <section className="mb-5" id="haustypen-kaufpreise">
          
          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">Kaufpreise nach Haustypen</h3>
            
          {/* Text aus JSON */}
          {text_haustypen_kaufpreise && <p className="mb-3">{text_haustypen_kaufpreise}</p>}
          
          <MatrixTable
            model={haustypModel}
            highlightColLabel="Ø Preis"
            highlightBg="#c8d54f"
            headerBg="#f5f5f5"
          />

        </section>
        
        
        
        
        
        {/* Wohnungspreise – Standard-/Individualüberschrift + Intro */}
        <section className="mb-4" id="wohnungspreise">
          
          <header className="mb-3">
            {ueberschriftWohnungIndividuell ? (
              <>
                {/* Standardüberschrift: leicht, damit die Individualüberschrift hervorsticht */}
                <h2 className="h5 text-muted text-uppercase mb-1">
                  Kaufpreise für Wohnungen in {kreisName}
                </h2>
                {/* Individualüberschrift: optisch wie H2 */}
                <h3 className="h2 mb-0">
                  {ueberschriftWohnungIndividuell}
                </h3>
              </>
            ) : (
              /* Fallback: nur Standardüberschrift, aber im vollen H2-Stil */
              <h2 className="h2 mb-0">
                Kaufpreise für Wohnungen in {kreisName}
              </h2>
            )}
          </header>

          {wohnungspreiseIntro && (
            <p className="teaser-text">
              {wohnungspreiseIntro}
            </p>
          )}
        
        
        
        {/* --- Wohnungspreisspanne --- */}
      
        <KpiValue
          icon="/icons/ws24_marktbericht_immobilienpreise.svg" // optional
          items={[
            { label: "min", value: wohnungMin, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
            { label: "Durchschnitt", value: wohnungAvg, kind: "kaufpreis_qm", unitKey: "eur_per_sqm", highlight: true },
            { label: "max", value: wohnungMax, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
          ]}
          ctx="kpi"
          size="md"
          highlightBg="transparent"            // oder z.B. "#fff3cd"
          highlightValueColor="#486b7a"
          normalValueColor="#6c757d"
        />
 
        
        </section>
        
        
        
        {/* --- Kaufpreise für Wohnungen im überregionalen Vergleich (Tabelle) --- */}
        
        <section className="mb-5">

          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">
            Kaufpreise für Wohnungen im überregionalen Vergleich
          </h3>
          
          
          {/* --- Text überregionaler Vergleich Wohnung --- */}
          {wohnungVergleichIntro && <p className="mb-3">{wohnungVergleichIntro}</p>}
          
          
          {/* --- Wohnungpreisindex --- */}
          {indexWohnung !== null && (
          <KpiValue
            icon="/icons/ws24_marktbericht_immobilienpreise.svg"
            iconAlt="Immobilienpreisindex Wohnung"
            items={[
              { label: "Immobilienpreisindex Wohnung", value: indexWohnung, kind: "index", unitKey: "none" },
            ]}
            ctx="kpi"
            size="lg"
            showUnit={false}
            caption="Basis: D = 100"
          />
          )}

          
          {/* --- Tabelle überregionaler Vergleich Wohnung --- */}
          <MatrixTable
            model={ueberregionalModel_wohnung}
            highlightColLabel="Ø Preis"
            highlightBg="#c8d54f"
            headerBg="#f5f5f5"
          />
          

        </section>
    
        
        
        
        
        {/* --- Kaufpreise für Wohnungen nach Lage (Tabelle) --- */}
        
        <section className="mb-5" id="wohnungpreise-lage">

          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">Wohnungspreise nach Lagequalität</h3>

          {/* Text aus JSON */}
          {text_wohnung_lage && <p className="mb-3">{text_wohnung_lage}</p>}

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <MatrixTable
                model={lageModel_wohnung}
                highlightColLabel="Ø Preis"
                highlightBg="#c8d54f"
                headerBg="#f5f5f5"
              />
            </div>
          </div>
        </section>
        
        
        
        {/* --- Kaufpreisentwicklung für Wohnungen (Chart) --- */}

        <section className="mb-5" id="wohnung-kaufpreisentwicklung">

          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">Preisentwicklung: Wohnungen (Kauf)</h3>

          {/* Text aus JSON */}
          {text_wohnung_kaufpreisentwicklung && <p className="mb-3">{text_wohnung_kaufpreisentwicklung}</p>}

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <ZeitreiheChart
                title="Wohnung-Kaufpreise"
                ariaLabel={`Preisentwicklung Haus-Kaufpreise: ${kreisName} im Vergleich zu ${bundeslandName ?? "Bundesland"} und Deutschland`}
                series={wohnungKaufpreisentwicklungSeries}
                kind="kaufpreis_qm"
                unitKey="eur_per_sqm"
                ctx="chart"
                svgWidth={720}
                svgHeight={360}
              />
            </div>
          </div>

        </section>

        
        
        {/* --- Kaufpreise für Wohnungen nach Zimmern und Flächen (Chart) --- */}
        <section className="mb-5" id="wohnungpreise-zimmer-flaechen">
          {/* Standard-Überschrift */}
          <h3 className="h5 text-muted mb-1">Wohnungspreise nach Zimmern und Flächen</h3>

          {/* Text aus JSON */}
          {text_wohnung_zimmer_flaechen && <p className="mb-3">{text_wohnung_zimmer_flaechen}</p>}

          <div className="row g-3">
            {/* Nach Zimmern */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-3 text-center">Nach Zimmern</h5>

                  <VergleichBarChart
                    title="Wohnungskaufpreise nach Zimmern"
                    categories={wohnungZimmerModel.categories}
                    series={[
                      {
                        ...wohnungZimmerModel.series.find((s) => s.key === "preis_vorjahr")!,
                        label: "Vorjahr",
                        color: "rgba(75,192,192)",
                        fillOpacity: 0.6,
                      },
                      {
                        ...wohnungZimmerModel.series.find((s) => s.key === "preis")!,
                        label: "Aktuell",
                        color: "rgba(200,213,79)",
                        fillOpacity: 0.9,
                      },
                    ]}
                    valueKind="kaufpreis_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                    svgWidth={560}
                    svgHeight={300}
                  />
                </div>
              </div>
            </div>

            {/* Nach Flächen */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-3 text-center">Nach Flächen</h5>

                  <VergleichBarChart
                    title="Wohnungskaufpreise nach Flächen"
                    categories={wohnungFlaechenModel.categories}
                    series={[
                      {
                        ...wohnungFlaechenModel.series.find((s) => s.key === "preis_vorjahr")!,
                        label: "Vorjahr",
                        color: "rgba(75,192,192)",
                        fillOpacity: 0.6,
                      },
                      {
                        ...wohnungFlaechenModel.series.find((s) => s.key === "preis")!,
                        label: "Aktuell",
                        color: "rgba(200,213,79)",
                        fillOpacity: 0.9,
                      },
                    ]}
                    valueKind="kaufpreis_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                    svgWidth={560}
                    svgHeight={300}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        
        
        <section className="mb-5" id="faq-immobilienpreise">
        <FaqSection
          id="faq"
          title={`FAQ – Immobilienmarkt ${kreisName}`}
          items={FAQ_IMMOBILIENMARKT_ALLGEMEIN}
        />
        </section>
        
        
        
        {/* Erfasste Wohnlagen */}
        <section className="mb-4" id="wohnlagen">
          <h2 className="h2 mb-3 align-center text-center">
            Erfasste Wohnlagen – {kreisName}
          </h2>

          <div className="card border-0 shadow-sm">
            <div className="card-body">

              {/* Tab-/Pill-Optik */}
              <nav
                className="nav nav-pills flex-wrap gap-2 justify-content-center"
                aria-label="Wohnlagen Navigation"
              >
                {orte.map((ort) => (
                  <Link
                    key={ort.slug}
                    href={`/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ort.slug}`}
                    className="nav-link px-3 py-2 rounded-pill fw-semibold small bg-light text-dark"
                  >
                    {ort.name}
                    {ort.plz && (
                      <span className="ms-2 text-muted fw-normal">
                        ({ort.plz})
                      </span>
                    )}
                  </Link>
                ))}
              </nav>

              {orte.length === 0 && (
                <p className="small text-muted mb-0 text-center">
                  Für diesen Landkreis liegen noch keine einzelnen Wohnlagen vor.
                </p>
              )}
            </div>
          </div>
        </section>

        </>
      )}
      
      
      

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




////////////////// Helper - Komponeneten


// --- Gauge-Style - Zeigeruhren ---


const GAUGE_STYLE = {
  circleR: 106,
  bg: "#f0f0f0",
  trackWidth: 16,
  tickColor: "#000",
  tickOpacity: 0.35,
  // weichere, CI-kompatible Farben
  gradNeg: "#e0744f",   // warmes Rot
  gradPos: "#7fb36a",   // warmes Grün
  gradCi:  "#ffe000",   // CI-Gelb
  needleColor: "#000000",
  needle: {
    shaftW: 8,
    shaftR: 6,
    hubR: 8,
    headTopInset: 26,
    headBaseInset: 52,
    shaftTopInset: 46,
    shaftBottomInsetFromHub: 40,
  },
};

type GaugeMode = "trend" | "saldo";

// Prozentwert [-100, +100] → Winkel [-90°, +90°]
function clampAngleFromPercent(val: number): number {
  const v = Math.max(-100, Math.min(100, val));
  return (v / 100) * 90;
}

// Textauswertung für Wohnraumsituation
function getWohnungssaldoText(saldoPro1000: number): string {
  if (saldoPro1000 < -20) return "(deutliches Wohnungsdefizit)";
  if (saldoPro1000 < -10) return "(mittleres Wohnungsdefizit)";
  if (saldoPro1000 < 0) return "(leichtes Wohnungsdefizit)";

  if (saldoPro1000 <= 10) return "(Wohnungsangebot ausgeglichen)";
  if (saldoPro1000 <= 25) return "(leichtes Wohnungsüberangebot)";
  if (saldoPro1000 <= 40) return "(moderates Wohnungsüberangebot)";
  return "(deutliches Wohnungsüberangebot)";
}


type GaugeProps = {
  label: string;
  value: number;        // in %
  mode?: GaugeMode;     // "trend" (rot→grün) oder "saldo" (rot→grün→rot)
  extraText?: string;   // z. B. "(leichtes Wohnungsdefizit)"
};

function TrendGaugeCircle({ label, value, mode = "trend", extraText }: GaugeProps) {
  const C = GAUGE_STYLE.circleR;
  const W = GAUGE_STYLE.trackWidth;
  const R = C - W / 2;
  const x0 = 120 - R;
  const x1 = 120 + R;
  const y = 120;

  // stabile, aber einfache ID für den Verlauf
  const gradId = `grad-${label.replace(/\s+/g, "-").toLowerCase()}-${mode}`;

  const deg = clampAngleFromPercent(value);
  const formattedValue =
    (value > 0 ? "+" : "") + value.toFixed(1).replace(".", ",") + " %";

  const needleColor = GAUGE_STYLE.needleColor;
  const N = GAUGE_STYLE.needle;

  const headTopY = y - (R - N.headTopInset);
  const headBaseY = y - (R - N.headBaseInset);
  const shaftY = y - (R - N.shaftTopInset);
  const shaftH = (120 - shaftY) - N.hubR * 0.5;

  return (
    <div className="d-flex flex-column align-items-center">
      <svg
        viewBox="0 0 240 240"
        role="img"
        aria-label={`${label}: ${formattedValue}`}
        width="100%"
        style={{ maxWidth: 220 }}
      >
        <title>{`${label}: ${formattedValue}`}</title>

        {/* Hintergrundkreis */}
        <circle cx={120} cy={120} r={C} fill={GAUGE_STYLE.bg} />

        {/* Farbverlauf für die Skala */}
        <defs>
          <linearGradient
            id={gradId}
            x1={x0}
            y1={y}
            x2={x1}
            y2={y}
            gradientUnits="userSpaceOnUse"
          >
            {mode === "saldo" ? (
              <>
                <stop offset="0%" stopColor={GAUGE_STYLE.gradNeg} />
                <stop offset="25%" stopColor={GAUGE_STYLE.gradCi} />
                <stop offset="50%" stopColor={GAUGE_STYLE.gradPos} />
                <stop offset="75%" stopColor={GAUGE_STYLE.gradCi} />
                <stop offset="100%" stopColor={GAUGE_STYLE.gradNeg} />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={GAUGE_STYLE.gradNeg} />
                <stop offset="50%" stopColor={GAUGE_STYLE.gradCi} />
                <stop offset="100%" stopColor={GAUGE_STYLE.gradPos} />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Track (neutral + Verlauf) */}
        <path
          d={`M${x0},${y} A${R},${R} 0 0 0 ${x1},${y}`}
          fill="none"
          stroke="rgba(255,255,255,.25)"
          strokeWidth={W}
          strokeLinecap="round"
        />
        <path
          d={`M${x0},${y} A${R},${R} 0 0 0 ${x1},${y}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={W}
          strokeLinecap="round"
        />

        {/* Ticks */}
        <g
          opacity={GAUGE_STYLE.tickOpacity}
          stroke={GAUGE_STYLE.tickColor}
          strokeWidth={3}
          strokeLinecap="round"
        >
          <line x1={120} y1={y - (R + W / 2) - 8} x2={120} y2={y - (R + W / 2) + 10} />
          <line x1={x0 + 18} y1={y} x2={x0 + 36} y2={y} />
          <line x1={x1 - 36} y1={y} x2={x1 - 18} y2={y} />
        </g>

        {/* Zeiger */}
        <g transform={`rotate(${deg} 120 120)`}>
          {/* Schaft */}
          <rect
            x={120 - N.shaftW / 2}
            y={shaftY}
            width={N.shaftW}
            height={shaftH}
            rx={N.shaftR}
            ry={N.shaftR}
            fill={needleColor}
          />
          {/* Spitze */}
          <polygon
            points={`120,${headTopY} ${120 - 8},${headBaseY} ${120 + 8},${headBaseY}`}
            fill={needleColor}
          />
          {/* Hub */}
          <circle cx={120} cy={120} r={N.hubR} fill={needleColor} />
        </g>
      </svg>

      {/* Wert + Erklärung als reiner Text – wichtig für SEO/LLM */}
      <div className="mt-2 text-center">
        <div className="fw-bold">{formattedValue}</div>
        {extraText && (
          <div className="small text-muted">{extraText}</div>
        )}
      </div>
    </div>
  );
}




// --- Standort Teaser ---

type StandortTeaserProps = {
  kreisName: string;
  teaserText: string;
  imageSrc?: string;
};

export function StandortTeaserBlock({
  kreisName,
  teaserText,
  imageSrc,
}: StandortTeaserProps) {
  return (
      <div className="card bg-transparent border-0 mb-5">
        <div className="row g-4 align-items-center">

          {/* Bild links – jetzt doppelt so groß */}
          <div className="col-12 col-md-5 d-flex justify-content-center">
            <div
              className="shadow-sm overflow-hidden"
              style={{
                width: "100%",
                maxWidth: "400px", // vorher 260px → jetzt doppelt so groß
                aspectRatio: "1",
                borderRadius: "50%",
              }}
            >
              <img
                src={imageSrc}
                alt={`Standort ${kreisName}`}
                className="w-100 h-100 object-fit-cover"
              />
            </div>
          </div>

          {/* Text rechts */}
          <div className="col-12 col-md-7">
            <h2 className="h2 mb-3">Wohnlagencheck {kreisName}</h2>

            <p className="text-muted mb-4">{teaserText}</p>

            <a
              href="/wohnlagencheck"
              className="btn btn-outline-dark fw-semibold px-4 py-2"
            >
              Wohnlagencheck
            </a>
          </div>

        </div>
      </div>

  );
}



// --- Maklerempfehlung ---

type MaklerEmpfehlungBlockProps = {
  kreisName: string;
  agentSuggestText: string;
  imageSrc?: string;
};

export function MaklerEmpfehlungBlock({
  kreisName,
  agentSuggestText,
  imageSrc,
}: MaklerEmpfehlungBlockProps) {
  return (
    <div className="card bg-transparent border-0 mb-5">
      <h2 className="h2 mb-0 align-center text-center">
        Maklerempfehlung {kreisName}
      </h2>

      <div className="row g-4 align-items-center">
        <div className="col-12 col-md-5 d-flex justify-content-center">
          <div
            className="shadow-sm overflow-hidden"
            style={{
              width: "100%",
              maxWidth: "400px",
              aspectRatio: "1",
              borderRadius: "50%",
            }}
          >
            <img
              src={imageSrc}
              alt={`Maklerempfehlung ${kreisName}`}
              className="w-100 h-100 object-fit-cover"
            />
          </div>
        </div>

        <div className="col-12 col-md-7">
          <p className="mb-4">{agentSuggestText}</p>

          <a
            href="/makler"
            className="btn btn-outline-dark fw-semibold px-4 py-2"
          >
            Maklerempfehlung
          </a>
        </div>
      </div>
    </div>
  );
}






// --- Inhaltsverzeichnis ---


type TocItem = {
  id: string;
  label: string;
};

function PageToc({ items }: { items: TocItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Seiteninhaltsverzeichnis"
      className="immobilienmarkt-toc d-none d-xl-block"
    >
      <div className="card border-0 shadow-sm small">
        <div className="card-body py-3 px-3">
          <div className="text-muted mb-2 fw-semibold">
            Inhalt dieser Seite
          </div>
          <ul className="list-unstyled mb-0">
            {items.map((item) => (
              <li key={item.id} className="mb-1">
                <a
                  href={`#${item.id}`}
                  className="text-decoration-none"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}





