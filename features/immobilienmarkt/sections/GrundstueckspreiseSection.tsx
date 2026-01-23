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
import { KpiValue } from "@/components/KpiValue";
import { FaqSection } from "@/components/FaqSection";

import type { GrundstueckspreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/grundstueckspreise";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";
import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

type BeraterInfo = {
  name: string;
  taetigkeit: string;
  imageSrc: string;
};

type Props = SectionPropsBase & {
  vm: GrundstueckspreiseVM;
  berater?: BeraterInfo;
};

export function GrundstueckspreiseSection(props: Props) {
  const { vm, activeTabId } = props;
  const tabs = Array.isArray(props.tabs) ? props.tabs : [];
  const tocItems = Array.isArray(props.tocItems) ? props.tocItems : [];

  const isOrt = vm.level === "ort";
  const basePath = props.basePath ?? vm.basePath;
  const bundeslandSlug = props.ctx?.bundeslandSlug ?? "";
  const kreisSlug = props.ctx?.kreisSlug ?? "";
  const kontaktHref =
    bundeslandSlug && kreisSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung`
      : "/immobilienmarkt";
  const heroImageSrc = props.assets?.heroImageSrc ?? vm.hero.imageSrc;
  const grundstueckspreisMapSvg = props.assets?.grundstueckspreisMapSvg ?? null;

  const berater: BeraterInfo = props.berater?.name
    ? props.berater
    : {
        name: vm.berater.name,
        taetigkeit: vm.berater.taetigkeit,
        imageSrc: vm.berater.imageSrc,
      };

  return (
    <div className="text-dark">
      {tocItems.length > 0 && <RightEdgeControls tocItems={tocItems} />}

      <div className="container immobilienmarkt-container position-relative">
  
        
        {/* Subnavigation */}
        <TabNav
          tabs={tabs}
          activeTabId={activeTabId}
          basePath={basePath}
          parentBasePath={props.parentBasePath}
          ctx={props.ctx}
          names={{
            regionName: vm.regionName,
            bundeslandName: vm.bundeslandName,
          }}
        />

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


        {/* Einleitung */}
        <section className="mb-3" id="einleitung">
          <h1 className="mt-3 mb-1">{vm.headlineMain}</h1>
          <p className="small text-muted mb-4">Aktualisiert am: {vm.updatedAt ?? "–"}</p>
          {vm.teaser ? <p className="teaser-text">{vm.teaser}</p> : null}
          <BeraterBlock
            name={vm.berater.name}
            taetigkeit={vm.berater.taetigkeit}
            imageSrc={vm.berater.imageSrc}
            kontaktHref={kontaktHref}
          />
        </section>


        {/* Interaktive Karte + Leitkennzahl - Grundstückspreis */}
        <section className="mb-5" id="leitkennzahl">
          {vm.showMap ? (
            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {grundstueckspreisMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={grundstueckspreisMapSvg}
                        theme="grundstueckspreis"
                        mode="singleValue"
                        kind="grundstueck_qm"
                        unitKey="eur_per_sqm"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                      {props.assets?.grundstueckspreisLegendHtml ? (
                        <div
                          className="mt-3"
                          dangerouslySetInnerHTML={{ __html: props.assets?.grundstueckspreisLegendHtml ?? "" }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Fuer diesen Landkreis liegt aktuell noch keine interaktive Grundstueckskarte vor.
                    </p>
                  )}
                </div>
              </div>
              <div className="col-12 col-lg-6 d-flex align-items-center">
                <div className="w-100 align-center text-center">
                  {vm.avgPreis !== null && Number.isFinite(vm.avgPreis) ? (
                    <>
                      <div className="mb-2 kpi-hero">
                        <KpiValue
                          value={vm.avgPreis}
                          kind="grundstueck_qm"
                          unitKey="eur_per_sqm"
                          ctx="kpi"
                          size="ultra"
                          showUnit={true}
                        />
                      </div>
                      <p className="mb-0">Ø Preis in {vm.regionName}</p>
                    </>
                  ) : (
                    <p className="small text-muted mb-0">Keine Grundstueckspreisdaten verfuegbar.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              {vm.avgPreis !== null && Number.isFinite(vm.avgPreis) ? (
                <>
                  <div className="mb-2 kpi-hero">
                    <KpiValue
                      value={vm.avgPreis}
                      kind="grundstueck_qm"
                      unitKey="eur_per_sqm"
                      ctx="kpi"
                      size="ultra"
                      showUnit={true}
                    />
                  </div>
                  <p className="mb-0">Ø Preis in {vm.regionName}</p>
                </>
              ) : (
                <p className="small text-muted mb-0">Keine Grundstueckspreisdaten verfuegbar.</p>
              )}
            </div>
          )}
        </section>

        <section className="mb-4" id="grundstueckspreise-allgemein">
          <header className="mb-5 w-75 mx-auto text-center">
            {vm.headlineSectionIndividuell ? (
              <>
                <h2 className="h4 text-muted mb-1">{vm.headlineSection}</h2>
                <h3 className="h2 mb-0">{vm.headlineSectionIndividuell}</h3>
              </>
            ) : (
              <h2 className="h2 mb-0">{vm.headlineSection}</h2>
            )}
          </header>

          <KpiValue
            items={[
              { label: "min", value: vm.kpis.min, kind: "grundstueck_qm", unitKey: "eur_per_sqm" },
              {
                label: "Durchschnitt",
                value: vm.kpis.avg,
                kind: "grundstueck_qm",
                unitKey: "eur_per_sqm",
                highlight: true,
              },
              { label: "max", value: vm.kpis.max, kind: "grundstueck_qm", unitKey: "eur_per_sqm" },
            ]}
            ctx="kpi"
            size="ultra"
            highlightBg="transparent"
            highlightValueColor="#486b7a"
            normalValueColor="#6c757d"
          />

          {vm.ueberregionalText ? <p className="mx-auto my-5 w-75">{vm.ueberregionalText}</p> : null}
        </section>

        <section className="mb-5" id="grundstueckspreise-ueberregional">
          {vm.grundstueckspreisindex !== null ? (
            <div className="mb-5">
              <KpiValue
                items={[
                  {
                    label: "Grundstueckspreisindex",
                    value: vm.grundstueckspreisindex,
                    kind: "index",
                    unitKey: "none",
                  },
                ]}
                ctx="kpi"
                size="ultra"
                showUnit={false}
                caption="Basis: D = 100"
              />
            </div>
          ) : null}

          {vm.ueberregionalModel ? (
            <MatrixTable
              model={vm.ueberregionalModel}
              highlightColLabel="Ø Preis"
              highlightBg="#c8d54f"
              headerBg="#f5f5f5"
            />
          ) : (
            <p className="small text-muted mb-0">Keine Vergleichsdaten verfuegbar.</p>
          )}
        </section>

        <section className="mb-5" id="grundstueckspreise-preisentwicklung">
          <h3 className="text-center">Kaufpreis-Entwicklung fuer Grundstuecke</h3>
          {vm.preisentwicklungText ? <p className="mx-auto my-5 w-75">{vm.preisentwicklungText}</p> : null}

          {vm.preisentwicklungSeries.length > 0 ? (
            <div className="card border-0 shadow-sm">
          
              <div className="card-body">
                <div className="card-header bg-white border-0 text-center">
                  <h4 className="h6 mb-0">Kaufpreis-Entwicklung für Grundstücke</h4>
                </div>
                <div className="card-body">
                  <ZeitreiheChart
                    title="Grundstueckspreise"
                    ariaLabel={`Preisentwicklung Grundstueckspreise: ${vm.regionName}`}
                    series={vm.preisentwicklungSeries}
                    kind="grundstueck_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                    svgWidth={720}
                    svgHeight={320}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="small text-muted mb-0">Keine Zeitreihendaten verfuegbar.</p>
          )}
        </section>

        {/* FAQ */}
        <section className="mb-5" id="faq-grundstueckspreise">
          <h2 className="text-center mb-3">FAQ zu Grundstückspreisen</h2>
          <FaqSection id="faq" title={`FAQ – Grundstueckspreise ${vm.regionName}`} items={FAQ_IMMOBILIENMARKT_ALLGEMEIN} />
        </section>

        {/* Erfasste Wohnlagen */}
        {(vm.level === "kreis" || vm.level === "ort") ? (
          <section className="mb-4" id="wohnlagen">
            <h4 className="h2 mb-3 align-center text-center">
              Erfasste Wohnlagen – {vm.level === "ort" ? (props.ctx?.kreisSlug ?? vm.regionName) : vm.regionName}
            </h4>

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <nav className="nav nav-pills flex-wrap gap-2 justify-content-center" aria-label="Wohnlagen Navigation">
                  {(props.ctx?.orte ?? []).map((ort) => {
                    const isActive = !!props.ctx?.ortSlug && ort.slug === props.ctx.ortSlug;
                    const sectionSuffix = activeTabId && activeTabId !== "uebersicht" ? `/${activeTabId}` : "";
                    const href = `/immobilienmarkt/${props.ctx?.bundeslandSlug}/${props.ctx?.kreisSlug}/${ort.slug}${sectionSuffix}`;

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
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
