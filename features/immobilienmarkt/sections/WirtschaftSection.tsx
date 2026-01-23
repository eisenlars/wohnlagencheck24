// features/immobilienmarkt/sections/WirtschaftSection.tsx

import Link from "next/link";

import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { InteractiveMap } from "@/components/interactive-map";
import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import { DoughnutChart } from "@/components/DoughnutChart";
import { StackedComboChart } from "@/components/StackedComboChart";
import { KpiValue } from "@/components/KpiValue";
import { ImageModal } from "@/components/ImageModal";
import { FaqSection } from "@/components/FaqSection";

import type { WirtschaftVM } from "@/features/immobilienmarkt/selectors/shared/types/wirtschaft";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";
import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

const DEFAULT_ICON = "/icons/ws24_marktbericht_wirtschaft.svg";

export function WirtschaftSection(
  props: SectionPropsBase & {
    vm: WirtschaftVM;
  },
) {
  const { vm, tocItems, tabs, activeTabId } = props;

  const bundeslandSlug = props.ctx?.bundeslandSlug ?? "";
  const kreisSlug = props.ctx?.kreisSlug ?? "";
  const heroImageSrc = props.assets?.heroImageSrc ?? vm.hero.imageSrc ?? "";
  const basePath = props.basePath ?? vm.basePath;
  const kontaktHref =
    bundeslandSlug && kreisSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung`
      : "/immobilienmarkt";

  const mapSvg = props.assets?.kaufkraftindexMapSvg ?? null;
  const legendHtml = props.assets?.kaufkraftindexLegendHtml ?? null;
  const landuseImageSrc = props.assets?.flaechennutzungGewerbeImageSrc ?? null;
  const bipCategories = Array.from(
    new Set(vm.bipAbs.flatMap((s) => (s.points ?? []).map((p) => p.jahr))),
  ).sort((a, b) => a - b);
  const bipBars = vm.bipAbs.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    values: bipCategories.map((year) => s.points.find((p) => p.jahr === year)?.value ?? null),
  }));
  const svbWohnortCategories = Array.from(
    new Set(vm.svbWohnortAbs.flatMap((s) => (s.points ?? []).map((p) => p.jahr))),
  ).sort((a, b) => a - b);
  const svbWohnortBars = vm.svbWohnortAbs.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    values: svbWohnortCategories.map((year) => s.points.find((p) => p.jahr === year)?.value ?? null),
  }));
  const svbArbeitsortCategories = Array.from(
    new Set(vm.svbArbeitsortAbs.flatMap((s) => (s.points ?? []).map((p) => p.jahr))),
  ).sort((a, b) => a - b);
  const svbArbeitsortBars = vm.svbArbeitsortAbs.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    values: svbArbeitsortCategories.map((year) => s.points.find((p) => p.jahr === year)?.value ?? null),
  }));
  const arbeitslosenzahlenCategories = Array.from(
    new Set(vm.arbeitslosenzahlen.flatMap((s) => (s.points ?? []).map((p) => p.jahr))),
  ).sort((a, b) => a - b);
  const arbeitslosenzahlenBars = vm.arbeitslosenzahlen.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    values: arbeitslosenzahlenCategories.map((year) => s.points.find((p) => p.jahr === year)?.value ?? null),
  }));

  return (
    <div className="text-dark">
      {tocItems.length > 0 && <RightEdgeControls tocItems={tocItems} />}

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


      {/* Interaktive Karte + Leitkennzahl - Kaufkraftindex */}
      <section className="mb-5" id="kaufkraftindex">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="" style={{ width: "90%", margin: "0 auto" }}>
              {mapSvg ? (
                <>
                  <InteractiveMap
                    svg={mapSvg}
                    theme="kaufkraftindex"
                    mode="singleValue"
                    kind="index"
                    unitKey="none"
                    ctx="kpi"
                  />
                  {legendHtml ? (
                    <div className="mt-3" dangerouslySetInnerHTML={{ __html: legendHtml }} />
                  ) : null}
                </>
              ) : (
                <p className="small text-muted mb-0">
                  Für diesen Landkreis liegt aktuell noch keine Kaufkraftindex-Karte vor.
                </p>
              )}
            </div>
          </div>
          <div className="col-12 col-lg-6 d-flex align-items-center">
            <div className="w-100 text-center">
              <div className="mb-2 kpi-hero">
                <KpiValue value={vm.kpis.kaufkraftindex} kind="index" unitKey="none" ctx="kpi" size="mega" />
              </div>
              <p className="mb-0">Kaufkraftindex (Basis D = 100)</p>
            </div>
          </div>
        </div>
      </section>
      
      
      


      <section className="mb-4" id="wirtschaft">
        <header className="mb-5 w-75 mx-auto text-center">
          {vm.headlineWirtschaftIndividuell ? (
            <>
              <h2 className="h4 text-muted mb-1">{vm.headlineWirtschaft}</h2>
              <h3 className="h2 mb-0">{vm.headlineWirtschaftIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineWirtschaft}</h2>
          )}
        </header>
        
        <div className="row g-4 align-items-center">
          <div className="col-12 col-lg-4">
            <DoughnutChart
              title="Gewerbeflächenanteil"
              slices={vm.gewerbeflaechenanteil}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
          </div>
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
              <div className="card-body">
                <KpiValue
                  icon={DEFAULT_ICON}
                  iconAlt="Flächennutzung Industrie und Gewerbe"
                  items={[
                    {
                      label: "Flächennutzung Industrie und Gewerbe",
                      value: vm.kpis.flaecheGewerbe,
                      kind: "anzahl",
                      unitKey: "ha",
                    },
                  ]}
                  ctx="kpi"
                  size="ultra"
                  showUnit={true}
                  caption="Gesamtfläche Industrie & Gewerbe"
                  captionClassName="small text-muted mt-1"
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-none h-100">
              <div className="card-body text-center">
                {landuseImageSrc ? (
                  <ImageModal
                    src={landuseImageSrc}
                    alt={`Flächennutzung Gewerbe ${vm.regionName}`}
                    thumbStyle={{ width: "100%", height: "auto" }}
                  />
                ) : (
                  <p className="small text-muted mb-0">
                    Für diesen Landkreis liegt aktuell noch keine Flächennutzungskarte vor.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

      </section>



      <section className="mb-5" id="bip">
      
        <h3 className="text-center">Bruttoinlandsprodukt</h3>
        
        {vm.bruttoinlandsproduktText ? <p className="mx-auto my-5 w-75">{vm.bruttoinlandsproduktText}</p> : null}
        
        <div className="row g-4">
          
          <div className="col-12 col-lg-12">
            {vm.kpis.bip !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Bruttoinlandsprodukt"
                    items={[{ label: "Bruttoinlandsprodukt", value: vm.kpis.bip, kind: "anzahl", unitKey: "eur" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="€"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
    
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Bruttoinlandsprodukt</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Bruttoinlandsprodukt"
                  categories={bipCategories}
                  bars={bipBars}
                  valueKind="anzahl"
                  unitKey="eur"
                  ctx="chart"
                  stacked={false}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Bruttoinlandsprodukt pro EW</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Bruttoinlandsprodukt pro EW"
                  series={vm.bipProEw}
                  kind="anzahl"
                  unitKey="eur"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
        
      </section>

      <section className="mb-5" id="gewerbesaldo">
        
        <h3 className="text-center">Gewerbesaldo</h3>
      
        <div className="row g-4">
          <div className="col-12 col-lg-12">
            {vm.kpis.gewerbesaldo !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Gewerbesaldo"
                    items={[{ label: "Gewerbesaldo", value: vm.kpis.gewerbesaldo, kind: "anzahl", unitKey: "count" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Unternehmen"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        
        {vm.gewerbesaldoText ? <p className="mx-auto my-5 w-75">{vm.gewerbesaldoText}</p> : null}
        
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Gewerbesaldo absolut</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Gewerbesaldo absolut"
                  categories={vm.gewerbesaldoAbs.categories}
                  bars={vm.gewerbesaldoAbs.bars}
                  lines={vm.gewerbesaldoAbs.lines}
                  valueKind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  stacked={false}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Gewerbesaldo pro 1000 EW</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Gewerbesaldo pro 1000 EW"
                  series={vm.gewerbesaldoPro1000}
                  kind="quote"
                  unitKey="none"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5" id="einkommen">
      
        <h3 className="text-center">Nettoeinkommen und Kaufkraft</h3>
      
        {vm.einkommenText ? <p className="mx-auto my-5 w-75">{vm.einkommenText}</p> : null}
        
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            {vm.kpis.kaufkraftNominal !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Nominales Einkommen"
                    items={[{ label: "Nominales Einkommen", value: vm.kpis.kaufkraftNominal, kind: "anzahl", unitKey: "eur" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="€ pro EW"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="col-12 col-lg-6">
            {vm.kpis.kaufkraftReal !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Reales Einkommen"
                    items={[{ label: "Reales Einkommen", value: vm.kpis.kaufkraftReal, kind: "anzahl", unitKey: "eur" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="€ pro EW"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        
        <div className="mt-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 text-center">
              <h4 className="h6 mb-0">Verfügbares Einkommen pro EW</h4>
            </div>
            <div className="card-body">
              <ZeitreiheChart
                title="Verfügbares Einkommen pro EW"
                series={vm.nettoeinkommenProEw}
                kind="anzahl"
                unitKey="eur"
                ctx="chart"
                svgWidth={720}
                svgHeight={260}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5 d-none" id="einkommen-pro-haushalt">
        <ZeitreiheChart
          title="Verfügbares Einkommen pro Haushalt"
          series={vm.nettoeinkommenProHh}
          kind="anzahl"
          unitKey="eur"
          ctx="chart"
          svgWidth={720}
          svgHeight={260}
        />
      </section>

      
      <section className="mb-5" id="arbeitsmarkt">
        <header className="mb-5 w-75 mx-auto text-center">
          {vm.headlineArbeitsmarktIndividuell ? (
            <>
              <h2 className="h4 text-muted mb-1">{vm.headlineArbeitsmarkt}</h2>
              <h3 className="h2 mb-0">{vm.headlineArbeitsmarktIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineArbeitsmarkt}</h2>
          )}
        </header>

        {vm.arbeitsmarktText ? <p className="mx-auto my-5 w-75">{vm.arbeitsmarktText}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-12">
            {vm.kpis.arbeitsplatzzentralitaet !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Arbeitsplatzzentralität"
                    items={[{ label: "Arbeitsplatzzentralität", value: vm.kpis.arbeitsplatzzentralitaet, kind: "quote", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {vm.arbeitsplatzzentralitaetText ? <p className="mx-auto my-5 w-75">{vm.arbeitsplatzzentralitaetText}</p> : null}
       
        
        
        
        <div className="row g-4">
          <div className="col-12 col-lg-12">
            {vm.kpis.pendlersaldo !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Pendlersaldo"
                    items={[{ label: "Pendlersaldo", value: vm.kpis.pendlersaldo, kind: "anzahl", unitKey: "count" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Pendler"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        
        {vm.pendlerText ? <p className="mx-auto my-5 w-75">{vm.pendlerText}</p> : null}
      
      </section>




      <section className="mb-5" id="beschaeftigung">
      
        <h3 className="text-center">Beschäftigung</h3>
        {vm.svBeschaeftigteWohnortText ? <p className="mx-auto my-5 w-75">{vm.svBeschaeftigteWohnortText}</p> : null}
        
        <div className="row g-4">
          <div className="col-12 col-lg-12">
            {vm.kpis.beschaeftigtenquote !== null ? (
              <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Beschäftigtenquote"
                    items={[{ label: "Beschäftigtenquote", value: vm.kpis.beschaeftigtenquote, kind: "quote", unitKey: "percent" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={true}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">SVB absolut am Wohnort</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="SVB absolut am Wohnort"
                  categories={svbWohnortCategories}
                  bars={svbWohnortBars}
                  valueKind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  stacked={false}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">SVB am Wohnort (Index)</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="SVB am Wohnort (Index)"
                  series={vm.svbWohnortIndex}
                  kind="index"
                  unitKey="none"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
     
        {vm.svBeschaeftigteArbeitsortText ? <p className="mx-auto my-5 w-75">{vm.svBeschaeftigteArbeitsortText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">SVB absolut am Arbeitsort</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="SVB absolut am Arbeitsort"
                  categories={svbArbeitsortCategories}
                  bars={svbArbeitsortBars}
                  valueKind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  stacked={false}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">SVB am Arbeitsort (Index)</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="SVB am Arbeitsort (Index)"
                  series={vm.svbArbeitsortIndex}
                  kind="index"
                  unitKey="none"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="mb-5" id="arbeitslosigkeit">
      
        <h3 className="text-center">Arbeitslosigkeit</h3>
        {vm.arbeitslosenquoteText ? <p className="mx-auto my-5 w-75">{vm.arbeitslosenquoteText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-12">
            {vm.kpis.arbeitslosenquote !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Arbeitslosenquote"
                    items={[{ label: "Arbeitslosenquote", value: vm.kpis.arbeitslosenquote, kind: "quote", unitKey: "percent" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={true}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        
        <div className="row g-4 mt-5">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Arbeitslosenzahlen</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Arbeitslosenstatistik"
                  categories={arbeitslosenzahlenCategories}
                  bars={arbeitslosenzahlenBars}
                  valueKind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  stacked={false}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
    
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Arbeitslosenquoten</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Arbeitslosenquoten"
                  series={vm.arbeitslosenquoten}
                  kind="quote"
                  unitKey="percent"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-12 col-lg-12 mt-5">
          {vm.kpis.arbeitslosendichte !== null ? (
            <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
              <div className="card-body">
                <KpiValue
                  icon={DEFAULT_ICON}
                  iconAlt="Arbeitslosendichte"
                  items={[{ label: "Arbeitslosendichte", value: vm.kpis.arbeitslosendichte, kind: "quote", unitKey: "none" }]}
                  ctx="kpi"
                  size="xl"
                  showUnit={false}
                />
              </div>
            </div>
          ) : null}
        </div>
        
        {vm.arbeitslosendichteText ? <p className="mx-auto my-5 w-75">{vm.arbeitslosendichteText}</p> : null}
      
      </section>



      {/* FAQ */}
      <section className="mb-5" id="faq-wirtschaft">
        <h2 className="text-center mb-3">FAQ zu Wirtschaft und Arbeitsmarkt</h2>
        <FaqSection id="faq" title={`FAQ – Wirtschaft ${vm.regionName}`} items={FAQ_IMMOBILIENMARKT_ALLGEMEIN} />
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
  );
}
