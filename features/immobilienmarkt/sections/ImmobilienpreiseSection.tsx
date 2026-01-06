// features/immobilienmarkt/sections/ImmobilienpreiseSection.tsx

import React from "react";
import Link from "next/link";


import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { InteractiveMap } from "@/components/interactive-map";
import { MatrixTable } from "@/components/MatrixTable";
import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import { VergleichBarChart } from "@/components/VergleichBarChart";
import type { BarSeries } from "@/components/VergleichBarChart";
import { KpiValue } from "@/components/KpiValue";
import { FaqSection } from "@/components/FaqSection";

import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

import type { ImmobilienpreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/immobilienpreise";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";
import type { BarModel } from "@/utils/barModel";

type BeraterInfo = {
  name: string;
  taetigkeit: string;
  imageSrc: string;
};

type Props = SectionPropsBase & {
  vm: ImmobilienpreiseVM;
  berater?: BeraterInfo;
};

export function ImmobilienpreiseSection(props: Props) {
  const {
    vm,
    activeTabId,
  } = props;
  
  const isOrt = vm.level === "ort"; 

  const tabs = Array.isArray(props.tabs) ? props.tabs : [];
  const tocItems = Array.isArray(props.tocItems) ? props.tocItems : [];
  const orte = Array.isArray(props.ctx?.orte) ? props.ctx?.orte : [];

  const bundeslandSlug = props.ctx?.bundeslandSlug ?? "";
  const kreisSlug = props.ctx?.kreisSlug ?? "";
  const ortSlug = props.ctx?.ortSlug ?? "";
  const heroImageSrc = props.assets?.heroImageSrc;
  const immobilienpreisMapSvg = props.assets?.immobilienpreisMapSvg ?? null;

  // Fallback: wenn Page noch keinen Berater übergibt, nicht crashen
  const berater: BeraterInfo = props.berater?.name
    ? props.berater
    : {
        name: "Lars Hofmann",
        taetigkeit: `Standort- / Immobilienberatung – ${vm.regionName}`,
        imageSrc: `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`,
      };

  const basePath = props.basePath ?? vm.basePath;
  
  // Farbsystem
  const COLOR_IMMO = "rgba(75,192,192,0.9)";
  const COLOR_AKTUELL = "rgba(200,213,79,0.9)";
  
  

  // Helper: sichere Series-Auswahl für VergleichBarChart
  const pickSeries = (
    model: BarModel | null | undefined,
    key: string,
    fallbackLabel: string,
    color: string,
    fillOpacity: number,
  ): BarSeries | null => {
    const s = model?.series?.find((x) => x.key === key);
    if (!s) return null;
    return {
      key: String(s.key),
      label: fallbackLabel,
      values: Array.isArray(s.values) ? s.values : [],
      color,
      fillOpacity,
    };
  };

  const isBarSeries = (value: BarSeries | null): value is BarSeries => Boolean(value);

  return (
    <div className="text-dark">
      {tocItems.length > 0 && <RightEdgeControls tocItems={tocItems} />}

      <div className="container immobilienmarkt-container position-relative">
        
        {/* Subnavigation Kreisebene */}
        <TabNav tabs={tabs} activeTabId={activeTabId} basePath={basePath} parentBasePath={props.parentBasePath} />

        {/* Hero */}
        {heroImageSrc ? (
          <RegionHero
            title={vm.regionName}
            subtitle="regionaler Standortberater"
            imageSrc={heroImageSrc}
            rightOverlay={<HeroOverlayActions variant="immo" />}
            rightOverlayMode="buttons"

          />
        ) : null}

        {/* Intro */}
        <section className="mb-3" id="einleitung">
          <h1 className="mt-3 mb-1">Immobilienpreise 2025 - {vm.regionName}</h1>
          <p className="small text-muted mb-4">Aktualisiert am: {vm.regionName}</p>

          {vm.teaserImmobilienpreise ? <p className="teaser-text">{vm.teaserImmobilienpreise}</p> : null}

          <BeraterBlock name={berater.name} taetigkeit={berater.taetigkeit} imageSrc={berater.imageSrc} />
        </section>

        {/* Leitkennzahl + Karte */}
        <section className="mb-5" id="leitkennzahl">
          <div className="row g-4 align-items-stretch">
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
                      activeSubregionName={isOrt ? vm.regionName : undefined}
                      inactiveOpacity={isOrt ? 0.1 : 1}
                  />
                ) : (
                  <p className="small text-muted mb-0">
                    Für diesen Landkreis liegt aktuell noch keine interaktive Immobilienpreis-Karte vor.
                  </p>
                )}
              </div>
            </div>

            <div className="col-12 col-lg-6 d-flex align-items-center">
              <div className="w-100 align-center text-center">
                {vm.kaufpreisQm !== null && Number.isFinite(vm.kaufpreisQm) ? (
                  <>
                
                    <div className="mb-2" style={{ color: "#486b7a", fontSize: "7rem" }}>
                      <KpiValue
                        value={vm.kaufpreisQm}
                        kind="kaufpreis_qm"
                        unitKey="eur_per_sqm"
                        ctx="kpi"
                        size="ultra"
                        showUnit={true}
                      />
                    </div>
                    <p className="mb-0">Ø Immobilienpreis – {vm.regionName}</p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Kaufpreisdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Hauspreise */}
        <section className="mb-4" id="hauspreise">
          <header className="mb-3">
            {vm.ueberschriftHausIndividuell ? (
              <>
                <h2 className="h5 text-muted text-uppercase mb-1">Kaufpreise für Häuser in {vm.regionName}</h2>
                <h3 className="h2 mb-0">{vm.ueberschriftHausIndividuell}</h3>
              </>
            ) : (
              <h2 className="h2 mb-0">Kaufpreise für Häuser in {vm.regionName}</h2>
            )}
          </header>

          {vm.hauspreiseIntro ? <p className="teaser-text">{vm.hauspreiseIntro}</p> : null}

          <KpiValue
            icon="/icons/ws24_marktbericht_immobilienpreise.svg"
            items={[
              { label: "min", value: vm.hausMin, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
              { label: "Durchschnitt", value: vm.hausAvg, kind: "kaufpreis_qm", unitKey: "eur_per_sqm", highlight: true },
              { label: "max", value: vm.hausMax, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
            ]}
            ctx="kpi"
            size="md"
            highlightBg="transparent"
            highlightValueColor="#486b7a"
            normalValueColor="#6c757d"
          />
        </section>

        {/* Haus: Überregionaler Vergleich */}
        <section className="mb-5" id="vergleich-haus">
          <h3 className="h5 text-muted mb-1">Kaufpreise für Häuser im überregionalen Vergleich</h3>
          {vm.hausVergleichIntro ? <p className="mb-3">{vm.hausVergleichIntro}</p> : null}

          {vm.indexHaus !== null ? (
            <div className="mb-3">
              <KpiValue
                icon="/icons/ws24_marktbericht_immobilienpreise.svg"
                iconAlt="Immobilienpreisindex Haus"
                items={[{ label: "Immobilienpreisindex Haus", value: vm.indexHaus, kind: "index", unitKey: "none" }]}
                ctx="kpi"
                size="lg"
                showUnit={false}
                caption="Basis: D = 100"
              />
            </div>
          ) : null}

          {vm.ueberregionalModelHaus ? (
            <MatrixTable model={vm.ueberregionalModelHaus} highlightColLabel="Ø Preis" highlightBg="#c8d54f" headerBg="#f5f5f5" />
          ) : (
            <p className="small text-muted mb-0">Keine Vergleichsdaten verfügbar.</p>
          )}
        </section>

        {/* Haus: Lagequalität */}
        <section className="mb-5" id="hauspreise-lage">
          <h3 className="h5 text-muted mb-1">Hauspreise nach Lagequalität</h3>
          {vm.textHausLage ? <p className="mb-3">{vm.textHausLage}</p> : null}

          {vm.lageModelHaus ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <MatrixTable model={vm.lageModelHaus} highlightColLabel="Ø Preis" highlightBg="#c8d54f" headerBg="#f5f5f5" />
              </div>
            </div>
          ) : (
            <p className="small text-muted mb-0">Keine Lagedaten verfügbar.</p>
          )}
        </section>

        {/* Haus: Preisentwicklung */}
        {vm.hausKaufpreisentwicklungSeries && vm.hausKaufpreisentwicklungSeries.length > 0 ? (
          <section className="mb-5" id="haus-kaufpreisentwicklung">
            <h3 className="h5 text-muted mb-1">Preisentwicklung: Häuser (Kauf)</h3>
            {vm.textHausKaufpreisentwicklung ? <p className="mb-3">{vm.textHausKaufpreisentwicklung}</p> : null}

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <ZeitreiheChart
                  title="Haus-Kaufpreise"
                  ariaLabel={`Preisentwicklung Haus-Kaufpreise: ${vm.regionName} im Vergleich zu ${vm.bundeslandName ?? "Bundesland"} und Deutschland`}
                  series={vm.hausKaufpreisentwicklungSeries}
                  kind="kaufpreis_qm"
                  unitKey="eur_per_sqm"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={360}
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* Haus: Haustypen */}
        <section className="mb-5" id="haustypen-kaufpreise">
          <h3 className="h5 text-muted mb-1">Kaufpreise nach Haustypen</h3>
          {vm.textHaustypen ? <p className="mb-3">{vm.textHaustypen}</p> : null}

          {vm.haustypModel ? (
            <MatrixTable model={vm.haustypModel} highlightColLabel="Ø Preis" highlightBg="#c8d54f" headerBg="#f5f5f5" />
          ) : (
            <p className="small text-muted mb-0">Keine Haustyp-Daten verfügbar.</p>
          )}
        </section>

        {/* Wohnungspreise */}
        <section className="mb-4" id="wohnungspreise">
          <header className="mb-3">
            {vm.ueberschriftWohnungIndividuell ? (
              <>
                <h2 className="h5 text-muted text-uppercase mb-1">Kaufpreise für Wohnungen in {vm.regionName}</h2>
                <h3 className="h2 mb-0">{vm.ueberschriftWohnungIndividuell}</h3>
              </>
            ) : (
              <h2 className="h2 mb-0">Kaufpreise für Wohnungen in {vm.regionName}</h2>
            )}
          </header>

          {vm.wohnungspreiseIntro ? <p className="teaser-text">{vm.wohnungspreiseIntro}</p> : null}

          <KpiValue
            icon="/icons/ws24_marktbericht_immobilienpreise.svg"
            items={[
              { label: "min", value: vm.wohnungMin, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
              { label: "Durchschnitt", value: vm.wohnungAvg, kind: "kaufpreis_qm", unitKey: "eur_per_sqm", highlight: true },
              { label: "max", value: vm.wohnungMax, kind: "kaufpreis_qm", unitKey: "eur_per_sqm" },
            ]}
            ctx="kpi"
            size="md"
            highlightBg="transparent"
            highlightValueColor="#486b7a"
            normalValueColor="#6c757d"
          />
        </section>

        {/* Wohnung: Überregionaler Vergleich */}
        <section className="mb-5" id="vergleich-wohnung">
          <h3 className="h5 text-muted mb-1">Kaufpreise für Wohnungen im überregionalen Vergleich</h3>
          {vm.wohnungVergleichIntro ? <p className="mb-3">{vm.wohnungVergleichIntro}</p> : null}

          {vm.indexWohnung !== null ? (
            <div className="mb-3">
              <KpiValue
                icon="/icons/ws24_marktbericht_immobilienpreise.svg"
                iconAlt="Immobilienpreisindex Wohnung"
                items={[{ label: "Immobilienpreisindex Wohnung", value: vm.indexWohnung, kind: "index", unitKey: "none" }]}
                ctx="kpi"
                size="lg"
                showUnit={false}
                caption="Basis: D = 100"
              />
            </div>
          ) : null}

          {vm.ueberregionalModelWohnung ? (
            <MatrixTable model={vm.ueberregionalModelWohnung} highlightColLabel="Ø Preis" highlightBg="#c8d54f" headerBg="#f5f5f5" />
          ) : (
            <p className="small text-muted mb-0">Keine Vergleichsdaten verfügbar.</p>
          )}
        </section>

        {/* Wohnung: Lagequalität */}
        <section className="mb-5" id="wohnungpreise-lage">
          <h3 className="h5 text-muted mb-1">Wohnungspreise nach Lagequalität</h3>
          {vm.textWohnungLage ? <p className="mb-3">{vm.textWohnungLage}</p> : null}

          {vm.lageModelWohnung ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <MatrixTable model={vm.lageModelWohnung} highlightColLabel="Ø Preis" highlightBg="#c8d54f" headerBg="#f5f5f5" />
              </div>
            </div>
          ) : (
            <p className="small text-muted mb-0">Keine Lagedaten verfügbar.</p>
          )}
        </section>

        {/* Wohnung: Preisentwicklung */}
        <section className="mb-5" id="wohnung-kaufpreisentwicklung">
          <h3 className="h5 text-muted mb-1">Preisentwicklung: Wohnungen (Kauf)</h3>
          {vm.textWohnungKaufpreisentwicklung ? <p className="mb-3">{vm.textWohnungKaufpreisentwicklung}</p> : null}

          {vm.wohnungKaufpreisentwicklungSeries && vm.wohnungKaufpreisentwicklungSeries.length > 0 ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <ZeitreiheChart
                  title="Wohnung-Kaufpreise"
                  ariaLabel={`Preisentwicklung Wohnung-Kaufpreise: ${vm.regionName} im Vergleich zu ${vm.bundeslandName ?? "Bundesland"} und Deutschland`}
                  series={vm.wohnungKaufpreisentwicklungSeries}
                  kind="kaufpreis_qm"
                  unitKey="eur_per_sqm"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={360}
                />
              </div>
            </div>
          ) : (
            <p className="small text-muted mb-0">Keine Zeitreihendaten verfügbar.</p>
          )}
        </section>

        {/* Wohnung: Zimmer & Flächen */}
        <section className="mb-5" id="wohnungpreise-zimmer-flaechen">
          <h3 className="h5 text-muted mb-1">Wohnungspreise nach Zimmern und Flächen</h3>
          {vm.textWohnungZimmerFlaechen ? <p className="mb-3">{vm.textWohnungZimmerFlaechen}</p> : null}

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-3 text-center">Nach Zimmern</h5>

                  {vm.wohnungZimmerModel ? (
                    <VergleichBarChart
                      title="Wohnungskaufpreise nach Zimmern"
                      categories={vm.wohnungZimmerModel.categories}
                      series={[
                        pickSeries(vm.wohnungZimmerModel, "preis_vorjahr", "Vorjahr", COLOR_IMMO, 0.6),
                        pickSeries(vm.wohnungZimmerModel, "preis", "Aktuell", COLOR_AKTUELL, 0.9),
                      ].filter(isBarSeries)}
                      valueKind="kaufpreis_qm"
                      unitKey="eur_per_sqm"
                      ctx="chart"
                      svgWidth={560}
                      svgHeight={300}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Zimmertyp-Daten verfügbar.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-3 text-center">Nach Flächen</h5>

                  {vm.wohnungFlaechenModel ? (
                    <VergleichBarChart
                      title="Wohnungskaufpreise nach Flächen"
                      categories={vm.wohnungFlaechenModel.categories}
                      series={[
                        pickSeries(vm.wohnungFlaechenModel, "preis_vorjahr", "Vorjahr", COLOR_IMMO, 0.6),
                        pickSeries(vm.wohnungFlaechenModel, "preis", "Aktuell", COLOR_AKTUELL, 0.9),
                      ].filter(isBarSeries)}
                      valueKind="kaufpreis_qm"
                      unitKey="eur_per_sqm"
                      ctx="chart"
                      svgWidth={560}
                      svgHeight={300}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Flächendaten verfügbar.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-5" id="faq-immobilienpreise">
          <FaqSection id="faq" title={`FAQ – Immobilienmarkt ${vm.regionName}`} items={FAQ_IMMOBILIENMARKT_ALLGEMEIN} />
        </section>

        {/* Erfasste Wohnlagen */}
        {(vm.level === "kreis" || vm.level === "ort") ? (
          <section className="mb-4" id="wohnlagen">
            <h2 className="h2 mb-3 align-center text-center">
              Erfasste Wohnlagen – {vm.level === "ort" ? (props.kreisSlug ?? vm.regionName) : vm.regionName}
            </h2>

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <nav className="nav nav-pills flex-wrap gap-2 justify-content-center" aria-label="Wohnlagen Navigation">
                  {orte.map((ort) => {
                    const isActive = !!ortSlug && ort.slug === ortSlug;
                    const sectionSuffix = activeTabId && activeTabId !== "uebersicht" ? `/${activeTabId}` : "";
                    const href = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ort.slug}${sectionSuffix}`;

                    return (
                      <Link
                        key={ort.slug}
                        href={href}
                        className={`nav-link px-3 py-2 rounded-pill fw-semibold small ${
                          isActive ? "text-white bg-dark" : "bg-light text-dark"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {ort.name}
                        {ort.plz ? (
                          <span className={`ms-2 fw-normal ${isActive ? "text-white-50" : "text-muted"}`}>
                            ({ort.plz})
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>

                {orte.length === 0 ? (
                  <p className="small text-muted mb-0 text-center">
                    Für diesen Landkreis liegen noch keine einzelnen Wohnlagen vor.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        
      </div>
    </div>
  );
}
