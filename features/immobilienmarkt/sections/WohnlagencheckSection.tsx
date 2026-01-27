// features/immobilienmarkt/sections/WohnlagencheckSection.tsx

import Image from "next/image";
import Link from "next/link";

import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { InteractiveMap } from "@/components/interactive-map";
import { DoughnutChart } from "@/components/DoughnutChart";
import { RadarChartSvg } from "@/components/RadarChartSvg";
import { KpiValue } from "@/components/KpiValue";
import { FaqSection } from "@/components/FaqSection";
import { ImageModal } from "@/components/ImageModal";

import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

import { formatMetric } from "@/utils/format";

import type { WohnlagencheckVM } from "@/features/immobilienmarkt/selectors/shared/types/wohnlagencheck";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";

export function WohnlagencheckSection(
  props: SectionPropsBase & {
    vm: WohnlagencheckVM;
  },
) {
  const { vm, tocItems, tabs, activeTabId } = props;
  const isOrt = vm.level === "ort";

  const orte = Array.isArray(props.ctx?.orte) ? props.ctx?.orte : [];
  const bundeslandSlug = props.ctx?.bundeslandSlug ?? "";
  const kreisSlug = props.ctx?.kreisSlug ?? "";
  const ortSlug = props.ctx?.ortSlug ?? "";

  const heroImageSrc = props.assets?.heroImageSrc ?? vm.hero.imageSrc ?? "";
  const basePath = props.basePath ?? vm.basePath;
  const kontaktHref =
    bundeslandSlug && kreisSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung`
      : "/immobilienmarkt";
  const gallery = vm.gallery ?? [];

  const flaecheFormatted =
    vm.flaecheGesamt !== null
      ? formatMetric(vm.flaecheGesamt, { kind: "anzahl", ctx: "kpi", unit: "ha" })
      : "–";

  const factorMapSvgs = props.assets?.wohnlagencheckMapSvgs ?? {};
  const factorLegendHtml = props.assets?.wohnlagencheckLegendHtml ?? {};
  const mobilitaet = vm.faktoren.find((factor) => factor.theme === "mobilitaet") ?? null;
  const bildung = vm.faktoren.find((factor) => factor.theme === "bildung") ?? null;
  const gesundheit = vm.faktoren.find((factor) => factor.theme === "gesundheit") ?? null;
  const naherholung = vm.faktoren.find((factor) => factor.theme === "naherholung") ?? null;
  const nahversorgung = vm.faktoren.find((factor) => factor.theme === "nahversorgung") ?? null;
  const kulturFreizeit = vm.faktoren.find((factor) => factor.theme === "kultur_freizeit") ?? null;
  const mobilitaetMapSvg = mobilitaet ? factorMapSvgs[mobilitaet.theme] ?? null : null;
  const bildungMapSvg = bildung ? factorMapSvgs[bildung.theme] ?? null : null;
  const gesundheitMapSvg = gesundheit ? factorMapSvgs[gesundheit.theme] ?? null : null;
  const naherholungMapSvg = naherholung ? factorMapSvgs[naherholung.theme] ?? null : null;
  const nahversorgungMapSvg = nahversorgung ? factorMapSvgs[nahversorgung.theme] ?? null : null;
  const kulturFreizeitMapSvg = kulturFreizeit ? factorMapSvgs[kulturFreizeit.theme] ?? null : null;

  const renderFaktorAccordionHeader = () => (
    <div className="text-dark mt-5">
      <p className="h5 text-center small text-muted mb-3">Teilindikatoren (Auszug)</p>
    </div>
  );

  return (
    <div className="text-dark">
      {tocItems.length > 0 ? <RightEdgeControls tocItems={tocItems} /> : null}

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
          kreisName: vm.kreisName,
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


      {/* Einleitung - Hier ohne Teaser und Berater */}
      <section className="mb-3" id="einleitung">
        <h1 className="mt-3 mb-1">{vm.headlineMain}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.updatedAt ?? "–"}</p>
        
        {vm.headlineAllgemeinIndividuell ? (
          <>
            <h2 className="h4 text-muted mb-2">{vm.regionName} - Charakter, Historisches, Lage</h2>
            <h3 className="h2 mb-5">{vm.headlineAllgemeinIndividuell}</h3>
          </>
        ) : (
          <h2 className="h2 mb-5">{vm.regionName} - Charakter, Historisches, Lage</h2>
        )}
        
        {vm.textAllgemein ? <p className="mb-5">{vm.textAllgemein}</p> : null}
        
        {gallery.length > 0 ? (
          <section className="mb-3" id="galerie">
            <div className="row g-3">
              {gallery.map((item) => (
                <div key={item.src} className="col-12 col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm">
                    <div className="ratio ratio-4x3">
                      <Image
                        src={item.src}
                        alt={item.alt}
                        width={400}
                        height={300}
                        className="card-img-top object-fit-cover"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        
        {vm.textLage ? <p className="mb-0">{vm.textLage}</p> : null}
        
      </section>




        <section className="mb-5" id="flaechen">
          <div className="row g-4">
            
            <div className="col-12 col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h3 className="h5 mb-3 text-center">Flächenverteilung</h3>
                  <DoughnutChart
                    title="Flächenverteilung"
                    slices={vm.flaechenverteilung}
                    valueKind="anzahl"
                    unitKey="count"
                    ctx="chart"
                    svgSize={220}
                  />
                </div>
              </div>
            </div>
            
            <div className="col-12 col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center h-100 card-center-content">
                  <Image
                    src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                    alt=""
                    width={40}
                    height={40}
                    className="mb-2 mx-auto d-block"
                  />
                  <h3 className="h4 text-uppercase text-muted mb-2 text-center">Fläche</h3>
                  <KpiValue
                    value={vm.flaecheGesamt ?? null}
                    kind="flaeche"
                    unitKey="ha"
                    ctx="kpi"
                    size="xl"
                    showUnit
                    caption={`Gesamtfläche ${vm.regionName}`}
                    captionClassName="small text-muted mt-1"
                  />
                  {vm.quellenangabeGebiete ? (
                    <p className="small text-muted mt-2 mb-0">{vm.quellenangabeGebiete}</p>
                  ) : null}
                </div>
              </div>
            </div>
            
            <div className="col-12 col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h3 className="h5 mb-3 text-center">Siedlungsflächen</h3>
                  <DoughnutChart
                    title="Siedlungsflächen"
                    slices={vm.siedlungsflaechenverteilung}
                    valueKind="anzahl"
                    unitKey="count"
                    ctx="chart"
                    svgSize={220}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        
        <section className="mb-5" id="standortfaktoren-uebersicht">
          <header className="mb-5">
            <h2 className="h2 mb-4">{vm.headlineFaktoren || "Standortfaktoren"}</h2>
            {vm.standortfaktorenIntro ? <p className="small text-muted mb-0">{vm.standortfaktorenIntro}</p> : null}
          </header>
          
          
          <BeraterBlock
            name={vm.berater.name}
            taetigkeit={vm.berater.taetigkeit}
            imageSrc={vm.berater.imageSrc}
            kontaktHref={kontaktHref}
          />
          
          
          
          <RadarChartSvg points={vm.radarPoints} title="Standortfaktoren" maxValue={10} size={630} />
        </section>




        {mobilitaet ? (
          <section className="mt-5 mb-5" id="mobilitaet">
            <header className="mb-3 text-center">
              <h3 className="h3 mb-2 text-muted text-center">Local Score</h3>
              <h2 className="h2 mb-5" style={{ color: mobilitaet.index.color ?? "#486b7a" }}>
                {mobilitaet.title}
              </h2>
            </header>

            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {mobilitaetMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={mobilitaetMapSvg}
                        theme={mobilitaet.theme}
                        mode="singleValue"
                        kind="index"
                        unitKey="none"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Für diese Auswertung ist aktuell keine Karte hinterlegt.
                    </p>
                  )}
                </div>
                <p className="text-center w-100 mt-0 mb-0">Niveau regional</p>
              </div>

              <div className="col-12 col-lg-6 d-flex flex-column align-items-start justify-content-center">
                <div className="w-100 kpi-index-bg">
                  {mobilitaet.index.value !== null ? (
                    <KpiValue
                      value={mobilitaet.index.value}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="mega"
                      showUnit={false}
                      highlightValueColor={mobilitaet.index.color ?? "#486b7a"}
                      normalValueColor={mobilitaet.index.color ?? "#486b7a"}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Indexdaten verfügbar.</p>
                  )}
                  <p className="w-100 text-center mt-2 mb-0">
                    Niveau deutschlandweit<br />
                    (Einordnung gleicher Regionentypen)
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-5">
            {factorLegendHtml[mobilitaet.theme] ? (
              <div dangerouslySetInnerHTML={{ __html: factorLegendHtml[mobilitaet.theme] as string }} />
            ) : null}
            </div>
            
            <div className="mt-5">
            {mobilitaet.text ? <p className="small text-muted mb-0">{mobilitaet.text}</p> : null}
            </div>

            {renderFaktorAccordionHeader()}
            <div className="acc-wrap">
              <input className="acc-toggle" type="checkbox" id="acc-toggle-mobilitaet" />
              <div className="acc-teaser" id="acc-teaser-mobilitaet">
            <div className="mt-5">
              <h3 className="h3 mb-3 text-center">Anbindung Fernverkehr</h3>
              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <div className="text-center" style={{ minHeight: "10rem" }}>
                        <Image
                          src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                          alt=""
                          width={40}
                          height={40}
                          className="mb-2"
                        />
                        <h4 className="h6 mb-1">
                          Autobahn ({formatMetric(mobilitaet.values.autobahnCount ?? null, { kind: "anzahl", ctx: "kpi", unit: "none" })})
                        </h4>
                        {mobilitaet.fernanbindung.autobahn ? (
                          <div className="tooltipText-wrapper">
                            <span className="tooltipText-text small text-muted mb-0">
                              {mobilitaet.fernanbindung.autobahn}
                            </span>
                            <div className="tooltipText-popup">
                              {mobilitaet.fernanbindung.autobahn}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="d-flex justify-content-between mb-4">
                        <div className="w-100 text-center">
                          <KpiValue
                            value={mobilitaet.values.autobahnDistance ?? null}
                            kind="distance_km"
                            unitKey="km"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="⌀ km ab Wohnungsnähe"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        {mobilitaet.maps.autobahn ? (
                          <div className="image-container">
                            <ImageModal
                              src={mobilitaet.maps.autobahn.src}
                              alt={mobilitaet.maps.autobahn.alt}
                              thumbStyle={{ width: "60%", margin: "0 auto", display: "block" }}
                            />
                          </div>
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                        <p className="small text-muted mb-0">
                          einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Autobahnanbindung
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <div className="text-center" style={{ minHeight: "10rem" }}>
                        <Image
                          src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                          alt=""
                          width={40}
                          height={40}
                          className="mb-2"
                        />
                        <h4 className="h6 mb-1">
                          Flughafen ({formatMetric(mobilitaet.values.flughafenCount ?? null, { kind: "anzahl", ctx: "kpi", unit: "none" })})
                        </h4>
                        {mobilitaet.fernanbindung.flughafen ? (
                          <div className="tooltipText-wrapper">
                            <span className="tooltipText-text small text-muted mb-0">
                              {mobilitaet.fernanbindung.flughafen}
                            </span>
                            <div className="tooltipText-popup">
                              {mobilitaet.fernanbindung.flughafen}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="d-flex justify-content-between mb-4">
                        <div className="w-100 text-center">
                          <KpiValue
                            value={mobilitaet.values.flughafenDistance ?? null}
                            kind="distance_km"
                            unitKey="km"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="⌀ km ab Wohnungsnähe"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        {mobilitaet.maps.flughafen ? (
                          <div className="image-container">
                            <ImageModal
                              src={mobilitaet.maps.flughafen.src}
                              alt={mobilitaet.maps.flughafen.alt}
                              thumbStyle={{ width: "60%", margin: "0 auto", display: "block" }}
                            />
                          </div>
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                        <p className="small text-muted mb-0">
                          einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zum nächsten Flughafen
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <div className="text-center" style={{ minHeight: "10rem" }}>
                        <Image
                          src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                          alt=""
                          width={40}
                          height={40}
                          className="mb-2"
                        />
                        <h4 className="h6 mb-1">
                          Bahnhof ({formatMetric(mobilitaet.values.bahnhofCount ?? null, { kind: "anzahl", ctx: "kpi", unit: "none" })})
                        </h4>
                        {mobilitaet.fernanbindung.bahnhof ? (
                          <div className="tooltipText-wrapper">
                            <span className="tooltipText-text small text-muted mb-0">
                              {mobilitaet.fernanbindung.bahnhof}
                            </span>
                            <div className="tooltipText-popup">
                              {mobilitaet.fernanbindung.bahnhof}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="d-flex justify-content-between mb-4">
                        <div className="w-100 text-center">
                          <KpiValue
                            value={mobilitaet.values.bahnhofDistance ?? null}
                            kind="distance_km"
                            unitKey="km"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="⌀ km ab Wohnungsnähe"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        {mobilitaet.maps.bahnhof ? (
                          <div className="image-container">
                            <ImageModal
                              src={mobilitaet.maps.bahnhof.src}
                              alt={mobilitaet.maps.bahnhof.alt}
                              thumbStyle={{ width: "60%", margin: "0 auto", display: "block" }}
                            />
                          </div>
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                        <p className="small text-muted mb-0">
                          einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zum nächsten Bahnhof
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              </div>
              <div className="acc-content" id="acc-content-mobilitaet">
            <div className="mt-5">
              <h3 className="h3 mb-3 text-center">Versorgung</h3>
              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Tankstellen</h4>
                      <KpiValue
                        value={mobilitaet.values.tankstellen ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Autogas (LPG)</h4>
                      <KpiValue
                        value={mobilitaet.values.autogas ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">eLadesäulen</h4>
                      <KpiValue
                        value={mobilitaet.values.eladesaeulen ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="h3 mb-3 text-center">
                Verkehrsflächen
                {mobilitaet.verkehrsflaechenanteilRegionLabel ? (
                  <span className="ms-2 small text-muted">{mobilitaet.verkehrsflaechenanteilRegionLabel}</span>
                ) : null}
              </h3>
              <div className="row g-4">
                <div className="col-12">
                  <div className="d-flex justify-content-center">
                    <div style={{ width: "100%", maxWidth: "320px" }}>
                      <DoughnutChart
                        title="Verkehrsflächenanteil"
                        slices={mobilitaet.verkehrsflaechenanteil}
                        valueKind="anzahl"
                        unitKey="count"
                        ctx="chart"
                        svgSize={320}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="h3 mb-3 text-center">Personennahverkehr</h3>
              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Ticketpreis</h4>
                      <KpiValue
                        value={mobilitaet.values.ticketpreis ?? null}
                        kind="currency"
                        unitKey="eur"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="Preis Standardticket Einzelfahrt"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">ÖPNV Erreichbarkeit</h4>
                      <KpiValue
                        value={mobilitaet.values.oepnvErreichbarkeit ?? null}
                        kind="distance_m"
                        unitKey="m"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ m ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {mobilitaet.maps.oepnv ? (
                          <ImageModal
                            src={mobilitaet.maps.oepnv.src}
                            alt={mobilitaet.maps.oepnv.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fußweg 250m²-fassender Wohnabschnitte zur nächsten Haltestelle
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Linien-Dichte</h4>
                      <KpiValue
                        value={mobilitaet.values.linienDichte ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Linienanzahl Gebietsfläche"
                        captionClassName="small text-muted mt-1"
                      />
                      {mobilitaet.oepnvLinien ? (
                        <div className="small text-muted mt-2">Tramlinien: {mobilitaet.oepnvLinien}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
              </div>
              <div className="acc-button-row">
                <label
                  htmlFor="acc-toggle-mobilitaet"
                  className="acc-button"
                  data-open="Weniger anzeigen"
                  data-closed="Mehr anzeigen"
                />
              </div>
            </div>
          </section>
        ) : null}




        {bildung ? (
          <section className="mb-5" id="bildung">
            <header className="mb-3 text-center">
              <h3 className="h3 mb-2 text-muted text-center">Local Score</h3>
              <h2 className="h2 mb-5" style={{ color: bildung.index.color ?? "#486b7a" }}>
                {bildung.title}
              </h2>
            </header>

            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {bildungMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={bildungMapSvg}
                        theme={bildung.theme}
                        mode="singleValue"
                        kind="index"
                        unitKey="none"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Für diese Auswertung ist aktuell keine Karte hinterlegt.
                    </p>
                  )}
                </div>
                <p className="text-center w-100 mt-0 mb-0">Niveau regional</p>
              </div>

              <div className="col-12 col-lg-6 d-flex flex-column align-items-start justify-content-center">
                <div className="w-100 kpi-index-bg">
                  {bildung.index.value !== null ? (
                    <KpiValue
                      value={bildung.index.value}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="mega"
                      showUnit={false}
                      highlightValueColor={bildung.index.color ?? "#486b7a"}
                      normalValueColor={bildung.index.color ?? "#486b7a"}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Indexdaten verfügbar.</p>
                  )}
                  <p className="w-100 text-center mt-2 mb-0">
                    Niveau deutschlandweit<br />
                    (Einordnung gleicher Regionentypen)
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-5">
              {factorLegendHtml[bildung.theme] ? (
                <div dangerouslySetInnerHTML={{ __html: factorLegendHtml[bildung.theme] as string }} />
              ) : null}
            </div>

            <div className="mt-5">
              {bildung.text ? <p className="small text-muted mb-0">{bildung.text}</p> : null}
            </div>

            {renderFaktorAccordionHeader()}
            <div className="acc-wrap">
              <input className="acc-toggle" type="checkbox" id="acc-toggle-bildung" />
              <div className="acc-teaser" id="acc-teaser-bildung">
            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">frühkindliche Bildung, Erziehung</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">päd. Fachpersonal</h4>
                      <KpiValue
                        value={bildung.values.fachpersonal ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="päd. Fachpersonal pro Kita"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Tageseinrichtungen</h4>
                      <KpiValue
                        value={bildung.values.kitas ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anzahl pro 10000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">integrative Ausrichtung</h4>
                      <KpiValue
                        value={bildung.values.integrativ ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anteil int. Plätze in Einrichtungen"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-4 mt-1">
                <div className="col-12">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Wohnungsnahe Erreichbarkeit</h4>
                      <KpiValue
                        value={bildung.values.kitaErreichbarkeit ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {bildung.maps.kita ? (
                          <ImageModal
                            src={bildung.maps.kita.src}
                            alt={bildung.maps.kita.alt}
                            thumbStyle={{ width: "25%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Kita
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="acc-content" id="acc-content-bildung">
            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Allgemeinbildung</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Erreichbarkeit Grundschule</h4>
                      <KpiValue
                        value={bildung.values.grundschuleErreichbarkeit ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {bildung.maps.grundschule ? (
                          <ImageModal
                            src={bildung.maps.grundschule.src}
                            alt={bildung.maps.grundschule.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Grundschule
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body text-center">
                      <div className="mb-4">
                        <h4 className="h6 mb-1">allgemeinbildende Schulen</h4>
                        <KpiValue
                          value={bildung.values.allgemeinbildendeSchulen ?? null}
                          kind="anzahl"
                          unitKey="none"
                          ctx="kpi"
                          size="lg"
                          showUnit={false}
                          caption="Anzahl pro 10000 EW"
                          captionClassName="small text-muted mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="h6 mb-1">Förderschulen</h5>
                        <KpiValue
                          value={bildung.values.foerderschulen ?? null}
                          kind="anzahl"
                          unitKey="none"
                          ctx="kpi"
                          size="lg"
                          showUnit={false}
                          caption="Anzahl pro 10000 EW"
                          captionClassName="small text-muted mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Erreichbarkeit Gymnasium</h4>
                      <KpiValue
                        value={bildung.values.gymnasiumErreichbarkeit ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {bildung.maps.gymnasium ? (
                          <ImageModal
                            src={bildung.maps.gymnasium.src}
                            alt={bildung.maps.gymnasium.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Gymnasium
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="h5 mb-3 text-center">
                Absolventenstatistik
                {bildung.absolventenverteilungRegionLabel ? (
                  <span className="ms-2 small text-muted">{bildung.absolventenverteilungRegionLabel}</span>
                ) : null}
              </h3>
              <div className="row g-4 align-items-center">
                <div className="col-12 col-lg-3">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">ohne Abschluss</h4>
                      <KpiValue
                        value={bildung.values.ohneAbschluss ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anteil an Gesamtschülerzahl"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="d-flex justify-content-center">
                    <div style={{ width: "100%", maxWidth: "360px" }}>
                      <DoughnutChart
                        title="Absolventenverteilung"
                        slices={bildung.absolventenverteilung}
                        valueKind="anzahl"
                        unitKey="count"
                        ctx="chart"
                        svgSize={320}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-3">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Hochschulreife</h4>
                      <KpiValue
                        value={bildung.values.hochschulreife ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anteil an Gesamtschülerzahl"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Hochschulbildung</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Internationalisierungsgrad</h4>
                      <KpiValue
                        value={bildung.values.internationalisierung ?? null}
                        kind="quote"
                        unitKey="percent"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="Anteil ausl. Studenten"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Hochschulen</h4>
                      <KpiValue
                        value={bildung.values.hochschulen ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anzahl pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Studenten</h4>
                      <KpiValue
                        value={bildung.values.studenten ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anzahl pro 1000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          
              </div>
              <div className="acc-button-row">
                <label
                  htmlFor="acc-toggle-bildung"
                  className="acc-button"
                  data-open="Weniger anzeigen"
                  data-closed="Mehr anzeigen"
                />
              </div>
            </div>
          </section>
        ) : null}

        {gesundheit ? (
          <section className="mb-5" id="gesundheit">
            <header className="mb-3 text-center">
              <h3 className="h3 mb-2 text-muted text-center">Local Score</h3>
              <h2 className="h2 mb-5" style={{ color: gesundheit.index.color ?? "#486b7a" }}>
                {gesundheit.title}
              </h2>
            </header>

            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {gesundheitMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={gesundheitMapSvg}
                        theme={gesundheit.theme}
                        mode="singleValue"
                        kind="index"
                        unitKey="none"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Für diese Auswertung ist aktuell keine Karte hinterlegt.
                    </p>
                  )}
                </div>
                <p className="text-center w-100 mt-0 mb-0">Niveau regional</p>
              </div>

              <div className="col-12 col-lg-6 d-flex flex-column align-items-start justify-content-center">
                <div className="w-100 kpi-index-bg">
                  {gesundheit.index.value !== null ? (
                    <KpiValue
                      value={gesundheit.index.value}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="mega"
                      showUnit={false}
                      highlightValueColor={gesundheit.index.color ?? "#486b7a"}
                      normalValueColor={gesundheit.index.color ?? "#486b7a"}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Indexdaten verfügbar.</p>
                  )}
                  <p className="w-100 text-center mt-2 mb-0">
                    Niveau deutschlandweit<br />
                    (Einordnung gleicher Regionentypen)
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-5">
              {factorLegendHtml[gesundheit.theme] ? (
                <div dangerouslySetInnerHTML={{ __html: factorLegendHtml[gesundheit.theme] as string }} />
              ) : null}
            </div>

            <div className="mt-5">
              {gesundheit.text ? <p className="small text-muted mb-0">{gesundheit.text}</p> : null}
            </div>

            {renderFaktorAccordionHeader()}
            <div className="acc-wrap">
              <input className="acc-toggle" type="checkbox" id="acc-toggle-gesundheit" />
              <div className="acc-teaser" id="acc-teaser-gesundheit">
            <div className="mt-5">
              <h3 className="h3 mb-3 text-center">Wohnungsnahe medizinische Versorgung</h3>
              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Arztpraxis</h4>
                      <KpiValue
                        value={gesundheit.values.arzt ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {gesundheit.maps.arzt ? (
                          <ImageModal
                            src={gesundheit.maps.arzt.src}
                            alt={gesundheit.maps.arzt.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Arztpraxis
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Zahnarzt</h4>
                      <KpiValue
                        value={gesundheit.values.zahnarzt ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {gesundheit.maps.zahnarzt ? (
                          <ImageModal
                            src={gesundheit.maps.zahnarzt.src}
                            alt={gesundheit.maps.zahnarzt.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Zahnarztpraxis
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <Image
                        src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                        alt=""
                        width={40}
                        height={40}
                        className="mb-2"
                      />
                      <h4 className="h6 mb-1">Apotheke</h4>
                      <KpiValue
                        value={gesundheit.values.apotheke ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {gesundheit.maps.apotheke ? (
                          <ImageModal
                            src={gesundheit.maps.apotheke.src}
                            alt={gesundheit.maps.apotheke.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Apotheke
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              </div>
              <div className="acc-content" id="acc-content-gesundheit">
            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Kliniken</h3>
              </div>
              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Kliniken</h4>
                      <KpiValue
                        value={gesundheit.values.kliniken ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Einrichtungen pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Erreichbarkeit von Kliniken</h4>
                      <KpiValue
                        value={gesundheit.values.klinikenErreichbarkeit ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {gesundheit.maps.kliniken ? (
                          <ImageModal
                            src={gesundheit.maps.kliniken.src}
                            alt={gesundheit.maps.kliniken.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Klinik
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Rehaeinrichtungen</h4>
                      <KpiValue
                        value={gesundheit.values.reha ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Einrichtungen pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            
            
            
            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Pflegeeinrichtungen</h3>
              </div>
              <div className="row g-4">
                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Pflegenheime stationär</h4>
                      <KpiValue
                        value={gesundheit.values.pflegeStationaer ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Einrichtungen pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Pflegenheime ambulant</h4>
                      <KpiValue
                        value={gesundheit.values.pflegeAmbulant ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Einrichtungen pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5" id="tabellenausgabe-gesundheit">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Kapazitäten</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Betten in Kliniken</h4>
                      <KpiValue
                        value={gesundheit.values.bettenKliniken ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Betten pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Betten in Rehaeinrichtungen</h4>
                      <KpiValue
                        value={gesundheit.values.bettenReha ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Betten pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Plätze in Pflegeeinrichtungen</h4>
                      <KpiValue
                        value={gesundheit.values.plaetzePflege ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Plätze pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            
              </div>
              <div className="acc-button-row">
                <label
                  htmlFor="acc-toggle-gesundheit"
                  className="acc-button"
                  data-open="Weniger anzeigen"
                  data-closed="Mehr anzeigen"
                />
              </div>
            </div>
          </section>
        ) : null}







        {naherholung ? (
          <section className="mb-5" id="naherholung">
            <header className="mb-3 text-center">
              <h3 className="h3 mb-2 text-muted text-center">Local Score</h3>
              <h2 className="h2 mb-5" style={{ color: naherholung.index.color ?? "#486b7a" }}>
                {naherholung.title}
              </h2>
            </header>

            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {naherholungMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={naherholungMapSvg}
                        theme={naherholung.theme}
                        mode="singleValue"
                        kind="index"
                        unitKey="none"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Für diese Auswertung ist aktuell keine Karte hinterlegt.
                    </p>
                  )}
                </div>
                <p className="text-center w-100 mt-0 mb-0">Niveau regional</p>
              </div>

              <div className="col-12 col-lg-6 d-flex flex-column align-items-start justify-content-center">
                <div className="w-100 kpi-index-bg">
                  {naherholung.index.value !== null ? (
                    <KpiValue
                      value={naherholung.index.value}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="mega"
                      showUnit={false}
                      highlightValueColor={naherholung.index.color ?? "#486b7a"}
                      normalValueColor={naherholung.index.color ?? "#486b7a"}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Indexdaten verfügbar.</p>
                  )}
                  <p className="w-100 text-center mt-2 mb-0">
                    Niveau deutschlandweit<br />
                    (Einordnung gleicher Regionentypen)
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-5">
              {factorLegendHtml[naherholung.theme] ? (
                <div dangerouslySetInnerHTML={{ __html: factorLegendHtml[naherholung.theme] as string }} />
              ) : null}
            </div>

            <div className="mt-5">
              {naherholung.text ? <p className="small text-muted mb-0">{naherholung.text}</p> : null}
            </div>

            {renderFaktorAccordionHeader()}
            <div className="acc-wrap">
              <input className="acc-toggle" type="checkbox" id="acc-toggle-naherholung" />
              <div className="acc-teaser" id="acc-teaser-naherholung">
                <div className="mt-5">
                  <div className="text-center gap-3 mb-3">
                    <Image
                      src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                      alt=""
                      width={40}
                      height={40}
                    />
                    <h3 className="h3 mt-2">
                      Vegetationsflächen
                      {naherholung.vegetationsflaechenanteilRegionLabel ? (
                        <span className="ms-2 small text-muted">{naherholung.vegetationsflaechenanteilRegionLabel}</span>
                      ) : null}
                    </h3>
                  </div>

                  <div className="row g-4 align-items-center">
                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Waldfläche</h4>
                          <KpiValue
                            value={naherholung.values.wald ?? null}
                            kind="quote"
                            unitKey="percent"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="Anteil an Vegetationsfläche"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="d-flex justify-content-center">
                        <div style={{ width: "100%", maxWidth: "280px" }}>
                          <DoughnutChart
                            title="Vegetationsflächenanteil"
                            slices={naherholung.vegetationsflaechenanteil}
                            valueKind="anzahl"
                            unitKey="count"
                            ctx="chart"
                            svgSize={260}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Wasserfläche</h4>
                          <KpiValue
                            value={naherholung.values.wasser ?? null}
                            kind="quote"
                            unitKey="percent"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="Anteil an Vegetationsfläche"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="acc-content" id="acc-content-naherholung">
                <div className="mt-5">
                  <div className="text-center gap-3 mb-3">
                    <Image
                      src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                      alt=""
                      width={40}
                      height={40}
                    />
                    <h3 className="h3 mt-2">Erholungs- / Parkflächen</h3>
                  </div>

                  <div className="row g-4">
                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Parkflächenanteil</h4>
                          <KpiValue
                            value={naherholung.values.parkanteil ?? null}
                            kind="quote"
                            unitKey="percent"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="Anteil an Siedlungsfläche (%)"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Erreichbarkeit Parkanlagen</h4>
                          <KpiValue
                            value={naherholung.values.parkErreichbarkeit ?? null}
                            kind="distance_m"
                            unitKey="m"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="⌀ m ab Wohnungsnähe"
                            captionClassName="small text-muted mt-1"
                          />
                          <div className="image-container mt-3">
                            {naherholung.maps.parks ? (
                              <ImageModal
                                src={naherholung.maps.parks.src}
                                alt={naherholung.maps.parks.alt}
                                thumbStyle={{ width: "100%", margin: "0 auto", display: "block" }}
                              />
                            ) : (
                              <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                            )}
                          </div>
                          <p className="small text-muted mb-0">
                            einwohnergewichteter Fussweg 250m²-fassender Wohnabschnitte zur nächsten Parkanlage
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Parkflächenbereitstellung</h4>
                          <KpiValue
                            value={naherholung.values.parkBereitstellung ?? null}
                            kind="anzahl"
                            unitKey="none"
                            ctx="kpi"
                            size="lg"
                            showUnit={false}
                            caption="Flächenbereitstellung pro 1000 EW"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-center gap-3 mb-3">
                    <Image
                      src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                      alt=""
                      width={40}
                      height={40}
                    />
                    <h3 className="h3 mt-2">Luft- und Landschaft</h3>
                  </div>

                  <div className="row g-4">
                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Naturschutzgebiete</h4>
                          <KpiValue
                            value={naherholung.values.naturschutz ?? null}
                            kind="quote"
                            unitKey="percent"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="Anteil Naturschutzgebiete an der Gesamtfläche"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Luftqualität</h4>
                          <KpiValue
                            value={naherholung.values.luftqualitaet ?? null}
                            kind="anzahl"
                            unitKey="none"
                            ctx="kpi"
                            size="lg"
                            showUnit={false}
                            caption="1 - 5 (1 Sehr gut, 5 sehr schlecht)"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Landschaftqualität</h4>
                          <KpiValue
                            value={naherholung.values.landschaftqualitaet ?? null}
                            kind="anzahl"
                            unitKey="none"
                            ctx="kpi"
                            size="lg"
                            showUnit={false}
                            caption="Maß menschlicher Eingriffe in den Naturhaushalt (1-7)"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="acc-button-row">
                <label
                  htmlFor="acc-toggle-naherholung"
                  className="acc-button"
                  data-open="Weniger anzeigen"
                  data-closed="Mehr anzeigen"
                />
              </div>
            </div>
          </section>
        ) : null}

        {nahversorgung ? (
          <section className="mb-5" id="nahversorgung">
            <header className="mb-3 text-center">
              <h3 className="h3 mb-2 text-muted text-center">Local Score</h3>
              <h2 className="h2 mb-5" style={{ color: nahversorgung.index.color ?? "#486b7a" }}>
                {nahversorgung.title}
              </h2>
            </header>

            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {nahversorgungMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={nahversorgungMapSvg}
                        theme={nahversorgung.theme}
                        mode="singleValue"
                        kind="index"
                        unitKey="none"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Für diese Auswertung ist aktuell keine Karte hinterlegt.
                    </p>
                  )}
                </div>
                <p className="text-center w-100 mt-0 mb-0">Niveau regional</p>
              </div>

              <div className="col-12 col-lg-6 d-flex flex-column align-items-start justify-content-center">
                <div className="w-100 kpi-index-bg">
                  {nahversorgung.index.value !== null ? (
                    <KpiValue
                      value={nahversorgung.index.value}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="mega"
                      showUnit={false}
                      highlightValueColor={nahversorgung.index.color ?? "#486b7a"}
                      normalValueColor={nahversorgung.index.color ?? "#486b7a"}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Indexdaten verfügbar.</p>
                  )}
                  <p className="w-100 text-center mt-2 mb-0">
                    Niveau deutschlandweit<br />
                    (Einordnung gleicher Regionentypen)
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-5">
              {factorLegendHtml[nahversorgung.theme] ? (
                <div dangerouslySetInnerHTML={{ __html: factorLegendHtml[nahversorgung.theme] as string }} />
              ) : null}
            </div>

            <div className="mt-5">
              {nahversorgung.text ? <p className="small text-muted mb-0">{nahversorgung.text}</p> : null}
            </div>

            {renderFaktorAccordionHeader()}
            <div className="acc-wrap">
              <input className="acc-toggle" type="checkbox" id="acc-toggle-nahversorgung" />
              <div className="acc-teaser" id="acc-teaser-nahversorgung">
                <div className="mt-4">
                  <div className="row g-4 align-items-stretch">
                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Supermarktversorgung</h4>
                          <KpiValue
                            items={[
                              {
                                value: nahversorgung.values.supermarktVersorgung ?? null,
                                kind: "anzahl",
                                unitKey: "none",
                                ctx: "kpi",
                                fractionDigits: 2,
                              },
                            ]}
                            size="lg"
                            showUnit={false}
                            caption="Supermärkte pro 1000 EW"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <div className="image-container">
                            {nahversorgung.maps.supermaerkte ? (
                              <ImageModal
                                src={nahversorgung.maps.supermaerkte.src}
                                alt={nahversorgung.maps.supermaerkte.alt}
                                thumbStyle={{ width: "100%", margin: "0 auto", display: "block" }}
                              />
                            ) : (
                              <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                            )}
                          </div>
                          <p className="small text-muted mb-0">
                            einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zum nächsten Supermarkt
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="card border-0 shadow-sm h-100 text-center">
                        <div className="card-body">
                          <h4 className="h6 mb-1">Supermarkterreichbarkeit</h4>
                          <KpiValue
                            value={nahversorgung.values.supermarktErreichbarkeit ?? null}
                            kind="distance_km"
                            unitKey="km"
                            ctx="kpi"
                            size="lg"
                            showUnit
                            caption="⌀ km ab Wohnungsnähe"
                            captionClassName="small text-muted mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="acc-content" id="acc-content-nahversorgung">
                <p className="small text-muted mt-4 mb-0 text-center">
                  Weitere Teilindikatoren sind aktuell nicht hinterlegt.
                </p>
              </div>
              <div className="acc-button-row">
                <label
                  htmlFor="acc-toggle-nahversorgung"
                  className="acc-button"
                  data-open="Weniger anzeigen"
                  data-closed="Mehr anzeigen"
                />
              </div>
            </div>
          </section>
        ) : null}

        {kulturFreizeit ? (
          <section className="mb-5" id="kultur-freizeit">
            <header className="mb-3 text-center">
              <h3 className="h3 mb-2 text-muted text-center">Local Score</h3>
              <h2 className="h2 mb-5" style={{ color: kulturFreizeit.index.color ?? "#486b7a" }}>
                {kulturFreizeit.title}
              </h2>
            </header>

            <div className="row g-4 align-items-stretch">
              <div className="col-12 col-lg-6">
                <div className="" style={{ width: "90%", margin: "0 auto" }}>
                  {kulturFreizeitMapSvg ? (
                    <>
                      <InteractiveMap
                        svg={kulturFreizeitMapSvg}
                        theme={kulturFreizeit.theme}
                        mode="singleValue"
                        kind="index"
                        unitKey="none"
                        ctx="kpi"
                        activeSubregionName={isOrt ? vm.regionName : undefined}
                        inactiveOpacity={isOrt ? 0.1 : 1}
                      />
                    </>
                  ) : (
                    <p className="small text-muted mb-0">
                      Für diese Auswertung ist aktuell keine Karte hinterlegt.
                    </p>
                  )}
                </div>
                <p className="text-center w-100 mt-0 mb-0">Niveau regional</p>
              </div>

              <div className="col-12 col-lg-6 d-flex flex-column align-items-start justify-content-center">
                <div className="w-100 kpi-index-bg">
                  {kulturFreizeit.index.value !== null ? (
                    <KpiValue
                      value={kulturFreizeit.index.value}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="mega"
                      showUnit={false}
                      highlightValueColor={kulturFreizeit.index.color ?? "#486b7a"}
                      normalValueColor={kulturFreizeit.index.color ?? "#486b7a"}
                    />
                  ) : (
                    <p className="small text-muted mb-0">Keine Indexdaten verfügbar.</p>
                  )}
                  <p className="w-100 text-center mt-2 mb-0">
                    Niveau deutschlandweit<br />
                    (Einordnung gleicher Regionentypen)
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-5">
              {factorLegendHtml[kulturFreizeit.theme] ? (
                <div dangerouslySetInnerHTML={{ __html: factorLegendHtml[kulturFreizeit.theme] as string }} />
              ) : null}
            </div>

            <div className="mt-5">
              {kulturFreizeit.text ? <p className="small text-muted mb-0">{kulturFreizeit.text}</p> : null}
            </div>

            {renderFaktorAccordionHeader()}
            <div className="acc-wrap">
              <input className="acc-toggle" type="checkbox" id="acc-toggle-kultur" />
              <div className="acc-teaser" id="acc-teaser-kultur">
            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Kultureinrichtungen</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Museum</h4>
                      <KpiValue
                        value={kulturFreizeit.values.museum ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anzahl pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Theater, Oper</h4>
                      <KpiValue
                        value={kulturFreizeit.values.theater ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anzahl pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Kino</h4>
                      <KpiValue
                        value={kulturFreizeit.values.kino ?? null}
                        kind="anzahl"
                        unitKey="none"
                        ctx="kpi"
                        size="lg"
                        showUnit={false}
                        caption="Anzahl pro 100000 EW"
                        captionClassName="small text-muted mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-4 mt-1">
                <div className="col-12">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Erreichbarkeit Kultureinrichtungen</h4>
                      <KpiValue
                        value={kulturFreizeit.values.kulturErreichbarkeit ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {kulturFreizeit.maps.kultur ? (
                          <ImageModal
                            src={kulturFreizeit.maps.kultur.src}
                            alt={kulturFreizeit.maps.kultur.alt}
                            thumbStyle={{ width: "25%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Kulturstätte
                        (Museum, Theater, Oper, Kino)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              </div>
              <div className="acc-content" id="acc-content-kultur">
            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h5 mt-2">Sport und Freizeiteinrichtungen</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Sportanlagen</h4>
                      <KpiValue
                        value={kulturFreizeit.values.sportanlagen ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {kulturFreizeit.maps.sport ? (
                          <ImageModal
                            src={kulturFreizeit.maps.sport.src}
                            alt={kulturFreizeit.maps.sport.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Sporteinrichtung
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Spielplätze</h4>
                      <KpiValue
                        value={kulturFreizeit.values.spielplaetze ?? null}
                        kind="distance_m"
                        unitKey="m"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ m ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {kulturFreizeit.maps.spielplaetze ? (
                          <ImageModal
                            src={kulturFreizeit.maps.spielplaetze.src}
                            alt={kulturFreizeit.maps.spielplaetze.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fußweg 250m²-fassender Wohnabschnitte zum nächsten Spielplatz
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Schwimmbäder</h4>
                      <KpiValue
                        value={kulturFreizeit.values.schwimmbaeder ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {kulturFreizeit.maps.schwimmbaeder ? (
                          <ImageModal
                            src={kulturFreizeit.maps.schwimmbaeder.src}
                            alt={kulturFreizeit.maps.schwimmbaeder.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zum nächsten Schwimmbad
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-center gap-3 mb-3">
                <Image
                  src="/icons/ws24_marktbericht_wohnlagencheck.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <h3 className="h3 mt-2">Gastro / Nightlife</h3>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Essen &amp; Trinken</h4>
                      <KpiValue
                        value={kulturFreizeit.values.essenTrinken ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {kulturFreizeit.maps.essenTrinken ? (
                          <ImageModal
                            src={kulturFreizeit.maps.essenTrinken.src}
                            alt={kulturFreizeit.maps.essenTrinken.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten gastronomischen Einrichtung
                        (Restaurant, Biergarten, Cafe, Fastfood)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm h-100 text-center">
                    <div className="card-body">
                      <h4 className="h6 mb-1">Nightlife</h4>
                      <KpiValue
                        value={kulturFreizeit.values.nightlife ?? null}
                        kind="distance_km"
                        unitKey="km"
                        ctx="kpi"
                        size="lg"
                        showUnit
                        caption="⌀ km ab Wohnungsnähe"
                        captionClassName="small text-muted mt-1"
                      />
                      <div className="image-container mt-3">
                        {kulturFreizeit.maps.nightlife ? (
                          <ImageModal
                            src={kulturFreizeit.maps.nightlife.src}
                            alt={kulturFreizeit.maps.nightlife.alt}
                            thumbStyle={{ width: "50%", margin: "0 auto", display: "block" }}
                          />
                        ) : (
                          <p className="small text-muted mb-0">Keine Karte verfügbar.</p>
                        )}
                      </div>
                      <p className="small text-muted mb-0">
                        einwohnergewichteter Fahrweg 250m²-fassender Wohnabschnitte zur nächsten Nightlife
                        (Disco, Bar, Kneipe, Rotlicht)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              </div>
              <div className="acc-button-row">
                <label
                  htmlFor="acc-toggle-kultur"
                  className="acc-button"
                  data-open="Weniger anzeigen"
                  data-closed="Mehr anzeigen"
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* FAQ */}
        <section className="mb-5" id="faq-wohnlagencheck">
          <FaqSection id="faq" title={`FAQ – Wohnlagencheck ${vm.regionName}`} items={FAQ_IMMOBILIENMARKT_ALLGEMEIN} />
        </section>

        {/* Erfasste Wohnlagen */}
        {(vm.level === "kreis" || vm.level === "ort") ? (
          <section className="mb-4" id="wohnlagen">
            <h2 className="h2 mb-3 align-center text-center">
              Erfasste Wohnlagen – {vm.level === "ort" ? (props.ctx?.kreisSlug ?? vm.regionName) : vm.regionName}
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
