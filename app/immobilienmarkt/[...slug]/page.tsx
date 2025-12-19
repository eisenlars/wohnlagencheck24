// app/immobilienmarkt/[...slug]/page.tsx

import { GaugeTacho } from "@/components/gauge-tacho";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { InteractiveMap } from "@/components/interactive-map";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getReportBySlugs,
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
  getImmobilienpreisMapSvg,   // NEU
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

  
  
  
  
  
  
  
  // -------------------------------------------------------------------
  // --------------------- Allgemein für alle Subseiten ----------------
  // -------------------------------------------------------------------

  
  
  
  const [bundeslandSlug, kreisSlug] = slugs;
  const orte = getOrteForKreis(bundeslandSlug, kreisSlug);

  const kreisName = report.meta.name;
  
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



  
  
  // --------------------------------------------------------------
  // --------------------- Texte + Bilder + Daten -----------------
  // --------------------------------------------------------------



  // --------------- Seite Marktüberblick ----------------


  // --- Text Einleitung ---
  const teaserImmobilienmarktUeberblick = (report.data as any)?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_allgemein ?? "";
  
  
  // --- Daten: Bevölkerungsdynamik, Wohnraumsituation, Arbeitsmarkt, Wirtschaftskraft ---

  const standortAllgemein = (report.data as any)?.standort_allgemein?.[0] ?? null;

  const bevoelkerungsdynamik =
    standortAllgemein && typeof standortAllgemein.bevoelkerungsdynamik === "number"
      ? standortAllgemein.bevoelkerungsdynamik
      : null;
      
  const arbeitsmarktdynamik =
    standortAllgemein && typeof standortAllgemein.arbeitsmarktdynamik === "number"
      ? standortAllgemein.arbeitsmarktdynamik
      : null;

  const wirtschaftskraft =
    standortAllgemein && typeof standortAllgemein.wirtschaftskraft === "number"
      ? standortAllgemein.wirtschaftskraft
      : null;
      
  const wohnraumsituation =
  standortAllgemein && typeof standortAllgemein.wohnraumsituation === "number"
      ? standortAllgemein.wohnraumsituation
      : null;


  // --- Text + Bild Standort ---
  
  const teaserText = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_standort_teaser ?? null;
  const teaserImage = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}-preview.jpg`;

  
  
  // --- Daten Basis-Preisdaten ---

  // Immobilien-Kaufpreisdaten
  const kaufpreisRoh =
    (report.data as any)?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien ??
    null;
  const kaufpreis =
    kaufpreisRoh !== null
      ? Number(
          kaufpreisRoh.toString().replace(".", "").replace(",", "."),
        )
      : null;

  // Grundstückskaufpreisdaten
  const grundstueckRoh =
    (report.data as any)?.grundstueck_kaufpreis?.[0]?.kaufpreis_grundstueck ??
    null;
  const grundstueckspreis =
    grundstueckRoh !== null
      ? Number(
          grundstueckRoh.toString().replace(".", "").replace(",", "."),
        )
      : null;

  // Kaltmietedaten
  const mieteRoh =
    (report.data as any)?.mietpreise_gesamt?.[0]?.preis_kaltmiete ?? null;
  const kaltmiete =
    mieteRoh !== null
      ? Number(mieteRoh.toString().replace(".", "").replace(",", "."))
      : null;



  // --- Text Individualtext01 ---
  const individualText01 = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_individuell_01 ?? null;
  
  // --- Text Zitat ---
  const zitat = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_zitat ?? null;
  
  // --- Text Individualtext02 ---
  const individualText02 = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_individuell_02 ?? null;




  // --- Text zu Kaufnebenkosten (Makerprovision, Grundsteuer etc.) ---
  const marketBasicKnowledgeText = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_besonderheiten ?? null;
  
  // --- Text + Bild Maklerempfehlung ---
  const agentSuggestText = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_maklerempfehlung ?? null;
  const agentSuggestImage = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/makler-${kreisSlug}-logo.jpg`;



  
  // --- Daten Überregionaler Vergleich ---

  type VergleichItem = { region: string; value: number };

  // --- Daten Immobilienpreise ---
  const immVergleichRaw =
    (report.data as any)?.immobilienpreise_ueberregionaler_vergleich ?? [];
  const immVergleich: VergleichItem[] = immVergleichRaw
    .map((item: any) => ({
      region: String(item.region),
      value: Number(item.immobilienpreis),
    }))
    .filter((item: VergleichItem) => item.region && !Number.isNaN(item.value));

  // --- Daten Grundstückspreise ---
  const grundVergleichRaw =
    (report.data as any)?.grundstueckspreise_ueberregionaler_vergleich ?? [];
  const grundVergleich: VergleichItem[] = grundVergleichRaw
    .map((item: any) => ({
      region: String(item.region),
      value: Number(item.grundstueckspreis),
    }))
    .filter((item: VergleichItem) => item.region && !Number.isNaN(item.value));

  // --- Daten Mietpreise (Kaltmiete) ---
  const mieteVergleichRaw =
    (report.data as any)?.mietpreise_ueberregionaler_vergleich ?? [];
  const mieteVergleich: VergleichItem[] = mieteVergleichRaw
    .map((item: any) => ({
      region: String(item.region),
      value: Number(item.kaltmiete),
    }))
    .filter((item: VergleichItem) => item.region && !Number.isNaN(item.value));



  // --- Daten Preis-Historie ---

  type Zeitreihenpunkt = { jahr: number; value: number };

  // --- Daten Historie Immobilienpreise ---

  const immobilienKaufHistorieRaw =
    (report.data as any)?.immobilie_kaufpreisentwicklung ?? [];
  const immobilienKaufHistorie: Zeitreihenpunkt[] = Array.isArray(
    immobilienKaufHistorieRaw,
  )
    ? immobilienKaufHistorieRaw
        .map((item: any) => ({
          jahr: Number(item.jahr),
          value: Number(item.kaufpreisentwicklung_immobilie),
        }))
        .filter(
          (p) =>
            Number.isFinite(p.jahr) &&
            Number.isFinite(p.value) &&
            p.jahr > 1900,
        )
        .sort((a, b) => a.jahr - b.jahr)
    : [];
    
    
  // --- Daten Historie Grundstückspreise ---

  const grundstueckKaufHistorieRaw =
    (report.data as any)?.grundstueck_kaufpreisentwicklung ?? [];

  const grundstueckKaufHistorie: Zeitreihenpunkt[] = Array.isArray(
    grundstueckKaufHistorieRaw,
  )
    ? grundstueckKaufHistorieRaw
        .map((item: any) => ({
          jahr: Number(item.jahr),
          value: Number(item.kaufpreisentwicklung_grundstueck),
        }))
        .filter(
          (p) =>
            Number.isFinite(p.jahr) &&
            Number.isFinite(p.value) &&
            p.jahr > 1900,
        )
        .sort((a, b) => a.jahr - b.jahr)
    : [];
    
    
  // --- Daten Historie Mietpreise ---

  const mietpreisHistorieRaw =
    (report.data as any)?.immobilie_mietpreisentwicklung ?? [];

  const mietpreisHistorie: Zeitreihenpunkt[] = Array.isArray(
    mietpreisHistorieRaw,
  )
    ? mietpreisHistorieRaw
        .map((item: any) => ({
          jahr: Number(item.jahr),
          value: Number(item.mietpreisentwicklung_immobilie),
        }))
        .filter(
          (p) =>
            Number.isFinite(p.jahr) &&
            Number.isFinite(p.value) &&
            p.jahr > 1900,
        )
        .sort((a, b) => a.jahr - b.jahr)
    : [];


  // --- Text Beschreibungstext01 ---
  const beschreibungText01 = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_beschreibung_01 ?? null;

  // --- Text Beschreibungstext02 ---
  const beschreibungText02 = report.data?.text?.immobilienmarkt_ueberblick?.immobilienmarkt_beschreibung_02 ?? null;



  // --- Daten Preisindizes ---

  const basisjahrRaw =
    (report.data as any)?.basisjahr?.[0] ?? {};

  const preisindexRaw =
    (report.data as any)?.preisindex?.[0] ?? {};

  const basisjahrImmobilien = Number(basisjahrRaw.basisjahr_immobilienpreisindex ?? null);
  const basisjahrGrundstueck = Number(basisjahrRaw.basisjahr_grundstueckspreisindex ?? null);
  const basisjahrMiete = Number(basisjahrRaw.basisjahr_mietpreisindex ?? null);

  const indexImmobilien = Number(preisindexRaw.immobilienpreisindex ?? null);
  const indexGrundstueck = Number(preisindexRaw.grundstueckspreisindex ?? null);
  const indexMiete = Number(preisindexRaw.mietpreisindex ?? null);


  // --- Daten Ortslagen-Übersicht: Preise & Vorjahresveränderung ---

  type OrtslagenUebersichtRow = {
    kreis: string;
    ortslage: string;
    immobilienpreise_wert?: string;
    immobilienpreise_tendenz?: string;
    grundstueckspreise_wert?: string;
    grundstueckspreise_tendenz?: string;
    mietpreise_wert?: string;
    mietpreise_tendenz?: string;
  };

  const ortslagenUebersichtRaw =
    (report.data as any)?.ortslagen_uebersicht ?? [];

  const ortslagenUebersicht: OrtslagenUebersichtRow[] =
    Array.isArray(ortslagenUebersichtRaw)
      ? ortslagenUebersichtRaw
          .filter(
            (item: any) =>
              !item.kreis || String(item.kreis).toLowerCase() === kreisSlug,
          )
          .map((item: any) => ({
            kreis: String(item.kreis ?? ""),
            ortslage: String(item.ortslage ?? ""),
            
            immobilienpreise_wert: String(item.immobilienpreise_wert ?? "",).trim(),
            immobilienpreise_tendenz: String(item.immobilienpreise_tendenz ?? "",).trim(),
            
            grundstueckspreise_wert: String(item.grundstueckspreise_wert ?? "",).trim(),
            grundstueckspreise_tendenz: String(item.grundstueckspreise_tendenz ?? "",).trim(),
            
            mietpreise_wert: String(item.mietpreise_wert ?? "").trim(),
            mietpreise_tendenz: String(item.mietpreise_tendenz ?? "",).trim(),
          }))
      : [];
      

  function parseTendenzToNumber(value?: string): number | null {
    if (!value) return null;
    const cleaned = value
      .replace("%", "")
      .replace(" ", "")
      .replace(",", ".")
      .trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  
  // Farbendefinitionen für Preiskategorien (Header voll, Zellen leicht getönt)
  const COLOR_IMMO = "rgb(75,192,192,0.6)";
  const COLOR_GRUND = "rgb(72,107,122,0.6)";
  const COLOR_MIETE = "rgb(200,213,79,0.6)";

  // RGB-Anteile für eigene Opazitäten
  const COLOR_IMMO_RGB = "75,192,192";
  const COLOR_GRUND_RGB = "72,107,122";
  const COLOR_MIETE_RGB = "200,213,79";

  // Sehr leichte Tönung für Zellen (Alpha kannst du nach Belieben anpassen)
  const BG_IMMO = `rgba(${COLOR_IMMO_RGB}, 0.1)`;
  const BG_GRUND = `rgba(${COLOR_GRUND_RGB}, 0.1)`;
  const BG_MIETE = `rgba(${COLOR_MIETE_RGB}, 0.1)`;
  



  // --- Daten Preisgrenzen Ortslagen: teuerste vs. günstigste ---

  const preisgrenzenImmobilie = (report.data as any)?.ortslagen_preisgrenzen_immobilie?.[0] ?? null;
  const preisgrenzenGrund = (report.data as any)?.ortslagen_preisgrenzen_grundstueck?.[0] ?? null;
  const preisgrenzenMiete = (report.data as any)?.ortslagen_preisgrenzen_miete?.[0] ?? null;
    
    
  
  // --------------- Seite Immobilienpreise ----------------
    
  // --- Text Einleitung ---
  const teaserImmobilienpreise = (report.data as any)?.text?.immobilienpreise?.immobilienpreise_intro ?? "";  
    
  // --- Map SVG + Daten Immobilienpreis ---

  const immobilienpreisMapSvg = getImmobilienpreisMapSvg(bundeslandSlug,kreisSlug,);

  const immobilienpreisRoh = (report.data as any)?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien ?? null;
  const immobilienpreis = immobilienpreisRoh !== null ? Number(immobilienpreisRoh.toString().replace(".", "").replace(",", "."),): null;

  // --- Überschriften und Text Hauspreise ---
  
  const ueberschriftHausIndividuell = report.data?.text?.ueberschriften_kreis?.ueberschrift_immobilienpreise_haus ?? null;
  const hauspreiseIntro = report.data?.text?.immobilienpreise?.immobilienpreise_haus_intro ?? null;

  // --- Daten HausPreisspanne ---
  
  function parsePreis(value?: string | number | null): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(String(value).trim());
    return Number.isFinite(num) ? num : null;
  }


  const hausPreisspanne = report.data?.haus_kaufpreisspanne?.[0] ?? null;

  const hausMin = parsePreis(hausPreisspanne?.preis_haus_min);
  const hausAvg = parsePreis(hausPreisspanne?.preis_haus_avg);
  const hausMax = parsePreis(hausPreisspanne?.preis_haus_max);

  
  // --- Daten Tabelle Überregionaler Vergleich ---
  
  type HausPreisVergleichRow = {
    preisinfo_label: string;
    preis: string;
  };

  const hausPreisVergleichRaw = (report.data as any)?.haus_kaufpreise_im_ueberregionalen_vergleich ?? [];

  const hausPreisVergleich: HausPreisVergleichRow[] = Array.isArray(
    hausPreisVergleichRaw,
  )
    ? hausPreisVergleichRaw.map((item: any) => ({
        preisinfo_label: String(item.preisinfo_label ?? "").trim(),
        preis: String(item.preis ?? "").trim(),
      }))
    : [];
    
    
  // --- Text zu Hauspreisen im Vergleich ---
  const hausVergleichIntro = report.data?.text?.immobilienpreise?.immobilienpreise_haus_allgemein ?? null;


  // --- Daten regionaler Preisindex Haus ---
  const preisindexHaus = report.data?.immobilienpreisindex_haus ?? report.data?.immobilienpreisindex_regional?.[0]?.immobilienpreisindex_haus ?? null;




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

      {/* Übersicht */}
      {activeSection === "uebersicht" && (
        <>
        
        
          
        
          
          {/* Headline Marktüberblick */}
          <section className="mb-3" id="einleitung">
            <h1 className="mt-3 mb-1">Standort & Immobilienmarkt 2025 {kreisName}</h1>
            <p className="small text-muted mb-4">
              Aktualisiert am: {kreisName}
            </p>
          
            {/* Einleitungstext */}
            <div>
              <p className="teaser-text">
                {teaserImmobilienmarktUeberblick}
              </p>
            </div>
            
            
            {/* Beraterkontakt */}
            <BeraterBlock
              name={beraterName}
              taetigkeit={beraterTaetigkeit}
              imageSrc={beraterImageSrc}
            />

          </section>
        
        
        
          
        
        
        
          {/* Standortüberblick – Dynamik & Wirtschaftskraft */}
          {standortAllgemein && (
            <section className="mb-5" id="standort">
              <h2 className="h2 mb-3 align-center text-center">Standortüberblick</h2>
              <p className="small text-muted mb-4 text-center">
                Die folgenden Indikatoren beschreiben die strukturelle Dynamik des
                Kreises {kreisName}.
              </p>

              <div className="row g-3 mb-5">
                {/* Bevölkerungsdynamik */}
                {bevoelkerungsdynamik !== null && (
                  <div className="col-12 col-md-4 mb-3">
                    <div className="card bg-transparent border-0">
                      <div className="card-body d-flex flex-column align-items-center">
                        <h5 className="h5 mb-3 w-100 text-start text-center">
                          Bevölkerungsdynamik
                        </h5>
                        <TrendGaugeCircle
                          label="Bevölkerungsdynamik"
                          value={bevoelkerungsdynamik}
                          mode="trend"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Arbeitsmarktdynamik */}
                {arbeitsmarktdynamik !== null && (
                  <div className="col-12 col-md-4 mb-3">
                    <div className="card bg-transparent border-0">
                      <div className="card-body d-flex flex-column align-items-center">
                        <h5 className="h5 mb-3 w-100 text-start text-center">
                          Arbeitsmarktdynamik
                        </h5>
                        <TrendGaugeCircle
                          label="Arbeitsmarktdynamik"
                          value={arbeitsmarktdynamik}
                          mode="trend"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Wirtschaftskraft */}
                {wirtschaftskraft !== null && (
                  <div className="col-12 col-md-4 mb-3">
                    <div className="card bg-transparent border-0">
                      <div className="card-body d-flex flex-column align-items-center">
                        <h5 className="h5 mb-3 w-100 text-start text-center">
                          Wirtschaftskraft
                        </h5>
                        <TrendGaugeCircle
                          label="Wirtschaftskraft"
                          value={wirtschaftskraft}
                          mode="trend"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              
              {/* Standort-Teaser */}
              {teaserText && (
                <StandortTeaserBlock
                  kreisName={kreisName}
                  teaserText={teaserText}
                  imageSrc={teaserImage}
                />
              )}
              
              
            </section>
          )}

          

          
   
          
        
          {/* Headline Immobilienmarktüberblick*/}
          <section className="mb-5" id="marktueberblick">
            <h2 className="h2 mb-5 align-center text-center">Immobilienmarkt {kreisName} - Überblick</h2>

            {/* Wohnraumsituation */}
            {wohnraumsituation !== null && (
              <>
                <h5 className="h5 mb-3 text-center">Wohnraumsituation</h5>
                <p className="small text-muted mb-3 text-center teaser-text-narrow mx-auto">
                  Der Wohnungssaldo beschreibt, ob die Region tendenziell eher ein
                  Wohnungsdefizit oder ein Wohnungsüberangebot aufweist.
                </p>

                <div className="card bg-transparent border-0 mb-5">
                  <div className="card-body d-flex flex-column align-items-center">
                    <TrendGaugeCircle
                      label="Wohnungssaldo"
                      value={wohnraumsituation}
                      mode="saldo"
                      extraText={getWohnungssaldoText(wohnraumsituation)}
                    />
                  </div>
                </div>
              </>
            )}


            {/* Immobilienpreis Kennzahlen */}
            <div className="row g-3 mb-5">
            
              {/* Immobilien-Kaufpreis */}
              <div className="col-12 col-md-4 mb-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <h5 className="h5 mb-3">Ø Immobilien-Kaufpreis</h5>

                    {kaufpreis !== null ? (
                      <>
                        <p className="h4 mb-4 fs-1 fw-bold">
                          {kaufpreis.toLocaleString("de-DE")} €
                          <small> / m²</small>
                        </p>

                        <p className="small text-muted mb-4">
                          <a
                            href="/immobilienpreise"
                            className="btn btn-outline-dark fw-semibold px-4 py-2"
                          >
                            Immobilien-Kaufpreise
                          </a>
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
              <div className="col-12 col-md-4 mb-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <h5 className="h5 mb-3">Ø Grundstückspreis</h5>

                    {grundstueckspreis !== null ? (
                      <>
                        <p className="h4 mb-4 fs-1 fw-bold">
                          {grundstueckspreis.toLocaleString("de-DE")} €
                          <small> / m²</small>
                        </p>
                        <p className="small text-muted mb-4">
                          <a
                            href="/grundstueckspreise"
                            className="btn btn-outline-dark fw-semibold px-4 py-2"
                          >
                            Grundstückspreise
                          </a>
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
              <div className="col-12 col-md-4 mb-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <h5 className="h5 mb-3 text-center">Ø Kaltmiete</h5>

                    {kaltmiete !== null ? (
                      <>
                        <p className="h4 mb-4 fs-1 fw-bold">
                          {kaltmiete.toLocaleString("de-DE")} €
                          <small> / m²</small>
                        </p>
                        <p className="small text-muted mb-4">
                          <a
                            href="/mietpreise"
                            className="btn btn-outline-dark fw-semibold px-4 py-2"
                          >
                            Mietpreise
                          </a>
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

   
            {/* Individualtext01 */}
            <div style={{ margin: "2.5rem 0" }}>
              <p>
                {individualText01}
              </p>
            </div>

            {/* Zitat */}
            <div style={{ margin: "2.5rem 0" }}>
              <blockquote className="zitat">
                <p className="zitat-text">
                  {zitat}
                </p>
                <footer className="zitat-footer">
                  <cite className="zitat-autor">{beraterName}</cite>
                </footer>
              </blockquote>
            </div>
            
          
            {/* Individualtext02 */}
            <div style={{ margin: "2.5rem 0" }}>
              <p>
                {individualText02}
              </p>
            </div>
            
          </section>
          
   

         
   
 
          {/* Headline Immobilienpreise im überregionalen Vergleich*/}
          <section className="mb-5" id="preise-vergleich">
            <h2 className="h2 mb-3 align-center text-center">Immobilienpreise {kreisName} im überregionalen Vergleich</h2>
            <p className="small text-muted mb-5 text-center teaser-text-narrow mx-auto">
              Die folgenden Diagramme zeigen den Landkreis im Vergleich zu
              Deutschland und dem Bundesland – jeweils auf Basis der aktuellen
              Angebotsdaten.
            </p>

            {/* Charts Überregionaler Vergleich */}
            <div className="row g-3">
              {/* Immobilienpreise */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="h5 mb-2 text-center">Immobilienpreise</h5>
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
                    <h5 className="h5 mb-2 text-center">Grundstückspreise</h5>
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
                    <h5 className="h5 mb-2 text-center">Kaltmieten</h5>
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
          
          
   
       
          
          
          {/* Headline Immobilienpreisentwicklung*/}
          <section className="mb-5" id="preise-entwicklung">
            <h2 className="h2 mb-3 align-center text-center">Immobilienpreisentwicklung - {kreisName} </h2>
            <p className="small text-muted mb-3 text-center teaser-text-narrow mx-auto mb-5">
              Die folgenden Diagramme zeigen die Entwicklung der
              durchschnittlichen Immobilienpreise, Grundstückspreise und
              Angebotsmieten je Quadratmeter im Landkreis {kreisName} nach
              Kalenderjahr.
            </p>
       
            {/* Preisentwicklung im Zeitverlauf */}
            <div className="row g-3">
              {/* Charts Immobilien-Kaufpreise */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <h5 className="h5 mb-4 text-center">
                      Historie Immobilien-Kaufpreise
                    </h5>
                    <ZeitreiheChart
                      title="Immobilien-Kaufpreise"
                      unit="€/m²"
                      points={immobilienKaufHistorie}
                      ariaLabel={`Entwicklung der durchschnittlichen Kaufpreise für Wohnimmobilien im Kreis ${kreisName}`}
                      color="rgba(75,192,192)"  // Immobilienpreise
                    />
               
                  </div>
                </div>
                <div className="card border-0 shadow-sm mt-2">
                  <div className="card-body">
                    <PreisindexBox
                      title="Immobilienpreisindex"
                      index={indexImmobilien}
                      basisjahr={basisjahrImmobilien}
                      color="rgba(75,192,192)"
                    />
                  </div>
                </div>
              </div>

              {/* Charts Grundstückskaufpreise */}
              <div className="col-12 col-md-4">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <h5 className="h5 mb-4 text-center">
                      Historie Grundstückspreise
                    </h5>
                    <ZeitreiheChart
                      title="Grundstückspreise"
                      unit="€/m²"
                      points={grundstueckKaufHistorie}
                      ariaLabel={`Entwicklung der durchschnittlichen Grundstückspreise im Landkreis ${kreisName}`}
                      color="rgb(72, 107, 122)"  // Grundstückspreise
                    />
                  </div>
                </div>
                <div className="card border-0 shadow-sm mt-2">
                  <div className="card-body">
                    <PreisindexBox
                      title="Grundstückspreisindex"
                      index={indexGrundstueck}
                      basisjahr={basisjahrGrundstueck}
                      color="rgb(72,107,122)"
                    />
                  </div>
                </div>
                
              </div>

              {/* Charts Mietpreise */}
              <div className="col-12 col-md-4">
                
                <div className="card border-0 shadow-sm ">
                  <div className="card-body">
                    <h5 className="h5 mb-4 text-center">Historie Angebotsmieten</h5>
                    <ZeitreiheChart
                      title="Kaltmieten"
                      unit="€/m²"
                      points={mietpreisHistorie}
                      ariaLabel={`Entwicklung der durchschnittlichen Angebotsmieten je Quadratmeter Wohnfläche im Landkreis ${kreisName}`}
                      color="rgba(200,213,79)"   // Kaltmiete
                    />
                  </div>
                </div>
                <div className="card border-0 shadow-sm mt-2">
                  <div className="card-body">
                    <PreisindexBox
                      title="Mietpreisindex"
                      index={indexMiete}
                      basisjahr={basisjahrMiete}
                      color="rgba(200,213,79)"
                    />
                  </div>
                </div>
                
              </div>
            </div>

            {/* Beschreibungstext01 */}
            <div style={{ margin: "2.5rem 0" }}>
              <p>
                {beschreibungText01}
              </p>
            </div>
          </section>
          
          
          
                    
          
     
          
          
          
          
          
          {/* Headline Ortslagenübersicht-Tabelle: Preise & Vorjahresveränderung*/}
          <section className="mb-5" id="ortslagen-tabelle">
            
            <h2 className="h2 mb-3 align-center text-center">Ortslagen-Preise und Vorjahresveränderung</h2>
            <p className="small text-muted mb-3 text-center teaser-text-narrow mx-auto">
              Die Tabelle zeigt die durchschnittlichen Immobilienpreise, Grundstückspreise und Angebotsmieten je Quadratmeter für die erfassten Ortslagen – jeweils inklusive prozentualer Veränderung gegenüber dem Vorjahr.
            </p>
  
            {/* Kreis - Ortslagenübersicht-Tabelle: Preise & Vorjahresveränderung */}
            <div className="card border-0 shadow-sm">
              <div className="card-body">

                <div className="table-responsive">
                  <table
                    className="table table-borderless align-middle mb-0 text-nowrap"
                    style={{
                      borderCollapse: "separate",
                      borderSpacing: "2px", // „cellspacing“-Effekt
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          className="text-start"
                          style={{
                            backgroundColor: "#f5f5f5",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Ortslage
                        </th>

                        <th
                          scope="col"
                          className="text-center"
                          style={{
                            backgroundColor: COLOR_IMMO,
                            color: "#000",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Ø Immobilienpreis
                        </th>
                        <th
                          scope="col"
                          className="text-center"
                          style={{
                            backgroundColor: COLOR_IMMO,
                            color: "#000",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Tendenz
                        </th>

                        <th
                          scope="col"
                          className="text-center"
                          style={{
                            backgroundColor: COLOR_GRUND,
                            color: "#fff",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Ø Grundstückspreis
                        </th>
                        <th
                          scope="col"
                          className="text-center"
                          style={{
                            backgroundColor: COLOR_GRUND,
                            color: "#fff",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Tendenz
                        </th>

                        <th
                          scope="col"
                          className="text-center"
                          style={{
                            backgroundColor: COLOR_MIETE,
                            color: "#000",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Ø Mietpreis
                        </th>
                        <th
                          scope="col"
                          className="text-center"
                          style={{
                            backgroundColor: COLOR_MIETE,
                            color: "#000",
                            padding: "0.55rem 0.85rem",
                          }}
                        >
                          Tendenz
                        </th>
                      </tr>
                    </thead>
                    <tbody className="small">
                      {ortslagenUebersicht.map((row, index) => {
                        const ortMatch = orte.find(
                          (ort) => ort.slug === row.ortslage,
                        );

                        const tImmo = parseTendenzToNumber(
                          row.immobilienpreise_tendenz,
                        );
                        const tGrund = parseTendenzToNumber(
                          row.grundstueckspreise_tendenz,
                        );
                        const tMiete = parseTendenzToNumber(
                          row.mietpreise_tendenz,
                        );

                        const tImmoColor =
                          tImmo === null
                            ? "#212529"
                            : tImmo > 0
                            ? "#198754"
                            : tImmo < 0
                            ? "#b02a37"
                            : "#6c757d";

                        const tGrundColor =
                          tGrund === null
                            ? "#212529"
                            : tGrund > 0
                            ? "#198754"
                            : tGrund < 0
                            ? "#b02a37"
                            : "#6c757d";

                        const tMieteColor =
                          tMiete === null
                            ? "#212529"
                            : tMiete > 0
                            ? "#198754"
                            : tMiete < 0
                            ? "#b02a37"
                            : "#6c757d";

                        return (
                          <tr key={row.ortslage || index}>
                            {/* Ortslage – linksbündig */}
                            <td
                              className="text-start"
                              style={{
                                backgroundColor: "#f5f5f5",
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {ortMatch ? (
                                <Link
                                  href={`/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortMatch.slug}`}
                                  className="link-primary text-decoration-none"
                                >
                                  {ortMatch.name}
                                </Link>
                              ) : (
                                row.ortslage || "–"
                              )}
                            </td>

                            {/* Immobilienpreise – zentriert */}
                            <td
                              className="text-center"
                              style={{
                                backgroundColor: BG_IMMO,
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {row.immobilienpreise_wert || "–"}
                            </td>
                            <td
                              className="text-center"
                              style={{
                                backgroundColor: BG_IMMO,
                                color: tImmoColor,
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {row.immobilienpreise_tendenz || "–"}
                            </td>

                            {/* Grundstückspreise – Body-Schrift schwarz */}
                            <td
                              className="text-center"
                              style={{
                                backgroundColor: BG_GRUND,
                                color: "#000", // hier jetzt schwarz
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {row.grundstueckspreise_wert || "–"}
                            </td>
                            <td
                              className="text-center"
                              style={{
                                backgroundColor: BG_GRUND,
                                color: tGrundColor,
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {row.grundstueckspreise_tendenz || "–"}
                            </td>

                            {/* Mietpreise – zentriert */}
                            <td
                              className="text-center"
                              style={{
                                backgroundColor: BG_MIETE,
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {row.mietpreise_wert || "–"}
                            </td>
                            <td
                              className="text-center"
                              style={{
                                backgroundColor: BG_MIETE,
                                color: tMieteColor,
                                padding: "0.55rem 0.85rem",
                              }}
                            >
                              {row.mietpreise_tendenz || "–"}
                            </td>
                          </tr>
                        );
                      })}

                      {ortslagenUebersicht.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-muted py-3">
                            Für diesen Landkreis liegen aktuell noch keine
                            Ortslagen-Preisübersichten vor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Beschreibungstext02 */}
            <div style={{ margin: "2.5rem 0" }}>
              <p>
                {beschreibungText02}
              </p>
            </div>
            
          </section>
          
          
          
          
          {/* Headline Preisspannen zwischen günstigsten und teuersten Ortslagen*/}
          <section className="mb-5" id="preisspannen">
            
            <h2 className="h2 mb-3 align-center text-center">Wo ist es teuer und wo preiswert(er)?</h2>
 
            {/* Preisspannen zwischen günstigsten und teuersten Ortslagen */}
    
            <div className="row g-4">

              {preisgrenzenImmobilie && (
                <div className="col-12">
                  <PreisgrenzenRow
                    
                    color={COLOR_IMMO}
                    iconLabel="K"
                    cheapestName={preisgrenzenImmobilie.guenstigste_ortslage_immobilie}
                    cheapestPrice={preisgrenzenImmobilie.guenstigste_ortslage_immobilienpreis}
                    priciestName={preisgrenzenImmobilie.teuerste_ortslage_immobilie}
                    priciestPrice={preisgrenzenImmobilie.teuerste_ortslage_immobilienpreis}
                  />
                </div>
              )}

              {preisgrenzenGrund && (
                <div className="col-12">
                  <PreisgrenzenRow
                    
                    color={COLOR_GRUND}
                    iconLabel="B"
                    cheapestName={preisgrenzenGrund.guenstigste_ortslage_grundstueck}
                    cheapestPrice={preisgrenzenGrund.guenstigste_ortslage_grundstueckspreis}
                    priciestName={preisgrenzenGrund.teuerste_ortslage_grundstueck}
                    priciestPrice={preisgrenzenGrund.teuerste_ortslage_grundstueckspreis}
                  />
                </div>
              )}

              {preisgrenzenMiete && (
                <div className="col-12">
                  <PreisgrenzenRow
                    
                    color={COLOR_MIETE}
                    iconLabel="M"
                    cheapestName={preisgrenzenMiete.guenstigste_ortslage_miete}
                    cheapestPrice={preisgrenzenMiete.guenstigste_ortslage_mietpreis}
                    priciestName={preisgrenzenMiete.teuerste_ortslage_miete}
                    priciestPrice={preisgrenzenMiete.teuerste_ortslage_mietpreis}
                  />
                </div>
              )}

            </div>
          </section>



          <section className="mb-5" id="maklerempfehlung">

            {/* Marktinformation-Kaufnebenkosten */}
            <div className="mb-5">
              <p>
                {marketBasicKnowledgeText}
              </p>
            </div>

            {/* Makler-Empfehlung */}
            {agentSuggestText && (
              <MaklerEmpfehlungBlock
                kreisName={kreisName}
                agentSuggestText={agentSuggestText}
                imageSrc={agentSuggestImage}
              />
            )}
          
          </section>


          {/* Erfasste Wohnlagen */}
          <section className="mb-4" id="wohnlagen">
            <h2 className="h2 mb-3 align-center text-center">Erfasste Wohnlagen - {kreisName}</h2>
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
        
        
        
        {/* Headline Marktüberblick */}
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
              <div className="h-100" style={{ width: "90%", margin:"0 auto" }}>
                {immobilienpreisMapSvg ? (
                  <InteractiveMap
                    svg={immobilienpreisMapSvg}
                    theme="immobilienpreis"
                    mode="singleValue" // nutzt data-value und formatiert als €/m²
                    // optional:
                    // activeSubregionName={kreisNameOderOrt}
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
                
                {kaufpreis !== null ? (
                  <>
                    <p className="display-1 fw-bold mb-2" style={{ color: "#486b7a", fontSize: "7rem" }}>
                      {kaufpreis.toLocaleString("de-DE")} €
                      <small className="fs-5"> / m²</small>
                    </p>
                    <p className="mb-0">Ø Immobilienpreis – {kreisName}</p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">
                    Keine Kaufpreisdaten verfügbar.
                  </p>
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
        </section>
        
        
        {/* --- Hauspreisspanne --- */}
        {hausMin !== null && hausAvg !== null && hausMax !== null && (
          <div className="d-flex justify-content-center align-items-end gap-4 mb-4">

            {/* MIN */}
            <div className="text-center">
              <div className="text-muted small mb-1">min</div>
              <div className="fw-semibold" style={{ fontSize: "1.4rem", color: "#6c757d" }}>
                {hausMin.toLocaleString("de-DE")} €
                <small className="fs-6"> / m²</small>
              </div>
            </div>

            {/* AVG – hervorgehoben */}
            <div className="text-center">
              <div className="text-muted small mb-1">Durchschnitt</div>
              <div className="fw-bold" style={{ fontSize: "2.2rem", color: "#486b7a" }}>
                {hausAvg.toLocaleString("de-DE")} €
                <small className="fs-5"> / m²</small>
              </div>
            </div>

            {/* MAX */}
            <div className="text-center">
              <div className="text-muted small mb-1">max</div>
              <div className="fw-semibold" style={{ fontSize: "1.4rem", color: "#6c757d" }}>
                {hausMax.toLocaleString("de-DE")} €
                <small className="fs-6"> / m²</small>
              </div>
            </div>

          </div>
        )}


        {/* --- Kaufpreise für Häuser im überregionalen Vergleich --- */}
        {hausPreisVergleich.length > 0 && (
          <section className="mb-5">
            {/* Standard-Überschrift */}
            <h2 className="h5 text-muted mb-1">
              Kaufpreise für Häuser im überregionalen Vergleich
            </h2>

            {/* Individualtext aus JSON – wenn vorhanden */}
            {hausVergleichIntro && (
              <p className="mb-3">
                {hausVergleichIntro}
              </p>
            )}
            
            
            {/* --- Preisindex Haus (zentriert) --- */}
            {preisindexHaus && (
              <div className="text-center mb-4">
                <div
                  className="fw-bold"
                  style={{
                    fontSize: "2.8rem",
                    lineHeight: 1.1,
                    color: "#486b7a",
                  }}
                >
                  {preisindexHaus}
                </div>
                <div className="small text-muted" style={{ marginTop: "-4px" }}>
                  Basis: D = 100
                </div>
              </div>
            )}

            

            {/* Tabelle mit 5 Spalten, horizontal angeordnet */}
            <div className="table-responsive">
              <table
                className="table table-borderless align-middle mb-0 text-nowrap"
                style={{
                  borderCollapse: "separate",
                  borderSpacing: "1px", // optische Trennung
                }}
              >
                <thead>
                  <tr>
                    {hausPreisVergleich.map((row) => {
                      const isAvgCol =
                        row.preisinfo_label.toLowerCase() === "ø preis";

                      return (
                        <th
                          key={row.preisinfo_label}
                          scope="col"
                          className="small text-center"
                          style={{
                            backgroundColor: isAvgCol ? "#c8d54f" : "#f5f5f5",
                            padding: "0.55rem 0.85rem",
                            fontWeight: isAvgCol ? 700 : 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.preisinfo_label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="small">
                  <tr>
                    {hausPreisVergleich.map((row) => {
                      const isAvgCol =
                        row.preisinfo_label.toLowerCase() === "ø preis";

                      return (
                        <td
                          key={row.preisinfo_label}
                          className="text-center"
                          style={{
                            backgroundColor: isAvgCol ? "#c8d54f" : "#f5f5f5",
                            padding: "0.55rem 0.85rem",
                            fontWeight: isAvgCol ? 700 : 400,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.preis}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        


        
        

        </>
      )}

      {/* Generischer Platzhalter für die anderen Bereiche/Themen */}
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





function ZeitreiheChart({
  title,
  unit,
  points,
  ariaLabel,
  color,
}: {
  title: string;
  unit: string;
  points: { jahr: number; value: number }[];
  ariaLabel?: string;
  color?: string; // NEU: individuelle Farbsteuerung
}) {
  if (!points || points.length === 0) {
    return (
      <p className="small text-muted mb-0">
        Für diese Zeitreihe liegen aktuell keine Daten vor.
      </p>
    );
  }

  const minYear = Math.min(...points.map((p) => p.jahr));
  const maxYear = Math.max(...points.map((p) => p.jahr));
  const minValue = Math.min(...points.map((p) => p.value));
  const maxValue = Math.max(...points.map((p) => p.value));

  const svgWidth = 360;
  const svgHeight = 220;
  const paddingLeft = 40;   // bei Bedarf leicht erhöhen, z. B. 48
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = svgWidth - paddingLeft - paddingRight;
  const innerHeight = svgHeight - paddingTop - paddingBottom;

  const yearSpan = maxYear - minYear || 1;
  const valueSpan = maxValue - minValue || 1;

  const scaleX = (year: number) =>
    paddingLeft + ((year - minYear) / yearSpan) * innerWidth;

  const scaleY = (value: number) =>
    paddingTop + innerHeight - ((value - minValue) / valueSpan) * innerHeight;

  const pathD = points
    .map((p, index) => {
      const x = scaleX(p.jahr);
      const y = scaleY(p.value);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const label =
    ariaLabel ??
    `${title} – Entwicklung von ${minYear} bis ${maxYear} in ${unit}`;

  const strokeColor = color ?? "#0077b6";

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
        {/* X-Achse */}
        <line
          x1={paddingLeft}
          y1={svgHeight - paddingBottom}
          x2={svgWidth - paddingRight}
          y2={svgHeight - paddingBottom}
          stroke="#ccc"
          strokeWidth={1}
        />

        {/* Y-Achse */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={svgHeight - paddingBottom}
          stroke="#ccc"
          strokeWidth={1}
        />

        {/* Line-Chart */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Punkte */}
        {points.map((p) => {
          const x = scaleX(p.jahr);
          const y = scaleY(p.value);
          return (
            <g key={p.jahr}>
              <circle cx={x} cy={y} r={6} fill="white" fillOpacity={0.8} />
              <circle cx={x} cy={y} r={3} fill={strokeColor} />
            </g>
          );
        })}

        {/* Jahreslabels */}
        {points.map((p) => {
          const x = scaleX(p.jahr);
          return (
            <text
              key={`year-${p.jahr}`}
              x={x}
              y={svgHeight - paddingBottom + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#555"
            >
              {p.jahr}
            </text>
          );
        })}

        {/* Min/Max-Werte an der Y-Achse – OHNE Einheit, um Platz zu sparen */}

        <text
          x={paddingLeft - 6}
          y={paddingTop - 3}   // vorher: paddingTop + 4
          textAnchor="end"
          fontSize="11"
          fill="#888"
        >
          {maxValue.toLocaleString("de-DE")}
        </text>

        {/* Min-Wert um 5px nach oben versetzt */}
        <text
          x={paddingLeft - 6}
          y={svgHeight - paddingBottom - 7}  // vorher: svgHeight - paddingBottom
          textAnchor="end"
          dominantBaseline="hanging"
          fontSize="11"
          fill="#888"
        >
          {minValue.toLocaleString("de-DE")}
        </text>

      </svg>

      {/* Textliche Zeitreihe (inkl. Einheit) */}
      <ul className="small text-muted mb-0">
        {points.map((p) => (
          <li key={p.jahr}>
            <strong>{p.jahr}:</strong>{" "}
            {p.value.toLocaleString("de-DE", {
              maximumFractionDigits: 2,
            })}{" "}
            {unit}
          </li>
        ))}
      </ul>
    </>
  );
}



function PreisindexBox({
  title,
  index,
  basisjahr,
  color,
}: {
  title: string;
  index: number | null;
  basisjahr: number | null;
  color: string;
}) {
  if (!index || !basisjahr) {
    return null;
  }

  return (
    <div className="text-center mt-3 mb-2">
      <div
        className="fw-semibold mb-2"
        style={{ color }}
      >
        {title}
      </div>

      <div
        className="display-6 fw-bold mb-2"
        style={{ lineHeight: "1", color }}
      >
        {index}
      </div>

      <div className="small text-muted">
        Basisjahr {basisjahr} = Index&nbsp;100
      </div>
    </div>
  );
}





function PreisgrenzenRow({
  color,
  iconLabel,
  cheapestName,
  cheapestPrice,
  priciestName,
  priciestPrice,
}: {
  color: string;
  iconLabel: string;
  cheapestName: string;
  cheapestPrice: string;
  priciestName: string;
  priciestPrice: string;
}) {
  if (
    !cheapestName ||
    !cheapestPrice ||
    !priciestName ||
    !priciestPrice
  ) {
    return null;
  }

  const iconBg = color;
  const iconTextColor =
    color === "rgb(72,107,122)" ? "#fff" : "#000";

  return (
    <div className="card border-0 shadow-sm w-100">
      <div className="card-body py-5 px-5">


        {/* Flexbox: drei Spalten, alle gleich breit auf Desktop */}
        <div className="d-flex flex-column flex-lg-row align-items-center justify-content-between gap-4 w-100">

          {/* Linke Spalte */}
          <div className="flex-lg-1 text-start w-100">
            <div className="small text-muted mb-1">Günstigste Ortslage</div>
            <div className="fw-semibold mb-1 fs-1">{cheapestName}</div>
            <div className="fw-bold fs-1" style={{ color }}>
              {cheapestPrice}
            </div>
          </div>

          {/* Icon (mittig, gleich breite Spalte) */}
          <div className="flex-lg-1 d-flex justify-content-center align-items-center w-100">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center"
              style={{
                width: "120px",
                height: "120px",
                backgroundColor: iconBg,
                color: iconTextColor,
                fontWeight: 700,
                fontSize: "2.2rem",
              }}
            >
              {iconLabel}
            </div>
          </div>

          {/* Rechte Spalte */}
          <div className="flex-lg-1 text-end w-100">
            <div className="small text-muted mb-1">Teuerste Ortslage</div>
            <div className="fw-semibold mb-1 fs-1">{priciestName}</div>
            <div className="fw-bold fs-1" style={{ color }}>
              {priciestPrice}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}






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

type MaklerEmpfehlungBlock = {
  kreisName: string;
  agentSuggestText: string;
  imageSrc?: string;
};

export function MaklerEmpfehlungBlock({
  kreisName,
  agentSuggestText,
  imageSrc,
}: StandortTeaserProps) {
  return (
      <div className="card bg-transparent border-0 mb-5">
        
        <h2 className="h2 mb-0 align-center text-center">Maklerempfehlung {kreisName}</h2>
        
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
                alt={`Maklerempfehlung ${kreisName}`}
                className="w-100 h-100 object-fit-cover"
              />
            </div>
          </div>

          {/* Text rechts */}
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







