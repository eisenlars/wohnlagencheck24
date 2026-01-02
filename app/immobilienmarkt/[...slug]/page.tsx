// app/immobilienmarkt/[...slug]/page.tsx

import { KreisTabPlaceholderSection } from "@/features/immobilienmarkt/sections/kreis/KreisTabPlaceholderSection";

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
        //slugs={regionSlugs}
        sectionSlug={sectionSlug}
      />
    );
  }



  if (level === 2) {
  const [bundeslandSlug, kreisSlug] = regionSlugs;

  // Tabs (zentral)
  const tabs = KREIS_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    iconSrc: t.iconSrc,
  }));

  // aktive Tab-Konfiguration
  const activeTab =
    KREIS_TABS.find((t) => t.id === route.section) ??
    KREIS_TABS.find((t) => t.id === "uebersicht")!;

  // Shared Assets
  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  // ---------- Übersicht (Feature-System) ----------
  if (route.section === "uebersicht") {
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

  // ---------- Immobilienpreise (Feature-System) ----------
  if (route.section === "immobilienpreise") {
    const data = report.data as ReportDataLike;

    const orte = getOrteForKreis(bundeslandSlug, kreisSlug);
    const immobilienpreisMapSvg = getImmobilienpreisMapSvg(bundeslandSlug, kreisSlug);

    const vm = buildKreisImmobilienpreiseVM({
      report,
      bundeslandSlug,
      kreisSlug,
    });

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

  // ---------- Mietpreise (Feature-System) ----------
  if (route.section === "mietpreise") {
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
        tabs={tabs}
        tocItems={activeTab.toc}
        activeTabId="mietpreise"
      />
    );
  }

  // ---------- Fallback (Placeholder, ohne KreisPage) ----------
  const kreisName =
    (report.meta as any)?.amtlicher_name ?? report.meta?.name ?? kreisSlug;

  return (
    <KreisTabPlaceholderSection
      kreisName={kreisName}
      bundeslandSlug={bundeslandSlug}
      kreisSlug={kreisSlug}
      tabs={tabs}
      activeTabId={route.section}
      tocItems={activeTab.toc}
      heroImageSrc={heroImageSrc}
      overlayVariant={null}
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








