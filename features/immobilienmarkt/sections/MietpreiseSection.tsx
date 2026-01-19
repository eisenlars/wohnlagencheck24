// features/immobilienmarkt/sections/MietpreiseSection.tsx

import Link from "next/link";

import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { KpiValue } from "@/components/KpiValue";
import { InteractiveMap } from "@/components/interactive-map";
import { MatrixTable } from "@/components/MatrixTable";
import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import { VergleichBarChart } from "@/components/VergleichBarChart";
import type { BarSeries } from "@/components/VergleichBarChart";
import { FaqSection } from "@/components/FaqSection";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";

import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

import type { MietpreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/mietpreise";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";
import type { BarModel } from "@/utils/barModel";

function pickSeries(
  model: BarModel | null | undefined,
  key: string,
  label: string,
  color: string,
  fillOpacity: number,
): BarSeries | null {
  const s = model?.series?.find((x) => x.key === key);
  if (!s) return null;
  return {
    key,
    label,
    values: s.values,
    color,
    fillOpacity,
  };
}

function isBarSeries(value: BarSeries | null): value is BarSeries {
  return value !== null;
}

export function MietpreiseSection(
  props: SectionPropsBase & {
    vm: MietpreiseVM;
  },
) {
  const { vm, tocItems, tabs, activeTabId } = props;

  const orte = Array.isArray(props.ctx?.orte) ? props.ctx?.orte : [];
  const bundeslandSlug = props.ctx?.bundeslandSlug ?? "";
  const kreisSlug = props.ctx?.kreisSlug ?? "";
  const ortSlug = props.ctx?.ortSlug ?? "";

  const heroImageSrc = props.assets?.heroImageSrc ?? vm.hero.imageSrc ?? "";

  const basePath = props.basePath ?? vm.basePath;

  return (
    <div className="text-dark">
      {tocItems.length > 0 && <RightEdgeControls tocItems={tocItems} />}


      {/* Subnavigation */}
      <TabNav tabs={tabs} activeTabId={activeTabId} basePath={basePath} parentBasePath={props.parentBasePath} />

      <ImmobilienmarktBreadcrumb
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
        />
      </section>
      

      {/* Interaktive Karte + Leitkennzahl - Mietpreis */}
      <section className="mb-5" id="leitkennzahl">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="" style={{ width: "90%", margin: "0 auto" }}>
              {props.assets?.mietpreisMapSvg ? (
                <>
                  <InteractiveMap
                    svg={props.assets?.mietpreisMapSvg}
                    theme="mietpreis"
                    mode="singleValue"
                    kind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="kpi"
                  />
                  {props.assets?.mietpreisLegendHtml ? (
                    <div
                      className="mt-3"
                      dangerouslySetInnerHTML={{ __html: props.assets?.mietpreisLegendHtml ?? "" }}
                    />
                  ) : null}
                </>
              ) : (
                <p className="small text-muted mb-0">
                  Für diesen Landkreis liegt aktuell noch keine interaktive Mietpreis-Karte vor.
                </p>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-6 d-flex align-items-center">
            <div className="w-100 text-center">
              {vm.kpis.kaltmiete !== null ? (
                <>
                  <KpiValue
                    value={vm.kpis.kaltmiete}
                    kind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="kpi"
                    size="mega"
                    showUnit={true}
                    highlightValueColor="#486b7a"
                    normalValueColor="#486b7a"
                  />
                  <p className="mb-0 mt-2">Ø Kaltmiete – {vm.regionName}</p>
                </>
              ) : (
                <p className="small text-muted mb-0">Keine Mietpreisdaten verfügbar.</p>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-center align-items-end gap-4 mb-4 mt-3">
          <KpiValue
            icon="/icons/ws24_marktbericht_mietpreise.svg"
            items={[
              { label: "Ø Nebenkosten", value: vm.kpis.nebenkosten, kind: "miete_qm", unitKey: "eur_per_sqm" },
              { label: "Ø Warmmiete", value: vm.kpis.warmmiete, kind: "miete_qm", unitKey: "eur_per_sqm" },
            ]}
            ctx="kpi"
            size="xl"
          />
        </div>
      </section>

      {/* Überregionaler Vergleich */}
      <section className="mb-5" id="mietpreise-ueberregional">
        
        <h4 className="text-center">Mietpreise im überregionalen Vergleich</h4>
        {vm.ueberregionalText ? <p className="mx-auto my-5 w-75">{vm.ueberregionalText}</p> : null}

        {vm.mietpreisindexWohnung !== null ? (
          <div className="mb-3">
            <KpiValue
              icon="/icons/ws24_marktbericht_mietpreise.svg"
              iconAlt="Mietpreisindex Wohnung"
              items={[{ label: "Mietpreisindex Wohnung", value: vm.mietpreisindexWohnung, kind: "index", unitKey: "none" }]}
              ctx="kpi"
              size="xl"
              showUnit={false}
              caption="Basis: D = 100"
            />
          </div>
        ) : null}

        {vm.ueberregionalModel ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <MatrixTable
              model={vm.ueberregionalModel}
              highlightColLabel="Ø Preis"
              highlightBg="#c8d54f"
              headerBg="#f5f5f5"
            />
          </div>
        </div>
          
        ) : (
          <p className="small text-muted mb-0">Keine Vergleichsdaten verfügbar.</p>
        )}
      </section>


      {/* Wohnungen */}
      <section className="mb-4" id="wohnungspreise">
        <header className="mb-5 w-75 mx-auto text-center">
          {vm.headlineWohnungIndividuell ? (
            <>
              <h2 className="h4 text-muted mb-2">{vm.headlineWohnung}</h2>
              <h3 className="h2 mb-5">{vm.headlineWohnungIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineWohnung}</h2>
          )}
        </header>

        {vm.wohnungText ? <p className="mx-auto my-5 w-75">{vm.wohnungText}</p> : null}

        <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
          <div className="card-body">
            <KpiValue
              icon="/icons/ws24_marktbericht_mietpreise.svg"
              items={[
                { label: "min", value: vm.wohnungMin, kind: "miete_qm", unitKey: "eur_per_sqm" },
                { label: "Durchschnitt", value: vm.wohnungAvg, kind: "miete_qm", unitKey: "eur_per_sqm", highlight: true },
                { label: "max", value: vm.wohnungMax, kind: "miete_qm", unitKey: "eur_per_sqm" },
              ]}
              ctx="kpi"
              size="xl"
              highlightBg="transparent"
              highlightValueColor="#486b7a"
              normalValueColor="#6c757d"
            />
          </div>
        </div>
      </section>

      {/* Mietpreisentwicklung Wohnung */}
      <section className="mb-5" id="wohnung-preisentwicklung">
        <h3 className="text-center">Mietpreisentwicklung Wohnungen</h3>
        {vm.wohnungEntwicklungText ? <p className="mx-auto my-5 w-75">{vm.wohnungEntwicklungText}</p> : null}

        <div className="card border-0 shadow-none h-100">
          <div className="card-header bg-white border-0 text-center">
            <h4 className="h6 mb-0">Mietpreisentwicklung Wohnungen</h4>
          </div>
          <div className="card-body">
          
            <ZeitreiheChart
              title="Mietpreisentwicklung Wohnungen"
              series={vm.wohnungEntwicklungSeries}
              kind="miete_qm"
              unitKey="eur_per_sqm"
              ctx="chart"
              svgWidth={720}
              svgHeight={260}
            />
            
            
          </div>
        </div>
      </section>

      {/* Wohnung: Zimmer/Flaechen */}
      <section className="mb-5" id="wohnung-zimmer-flaechen">
        <h3 className="text-center">Wohnungsmieten nach Zimmern und Flächen</h3>
        {vm.wohnungZimmerFlaechenText ? <p className="mx-auto my-5 w-75">{vm.wohnungZimmerFlaechenText}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h6 mb-0">Nach Zimmern</h4>
              </div>
              <div className="card-body">
                {vm.wohnungZimmerModel ? (
                  <VergleichBarChart
                    title="Mietpreise nach Zimmern"
                    categories={vm.wohnungZimmerModel.categories}
                    series={[
                      pickSeries(vm.wohnungZimmerModel, "kaltmiete_vorjahr", "Vorjahr", "rgba(75, 192, 192, 0.8)", 0.65),
                      pickSeries(vm.wohnungZimmerModel, "kaltmiete", "Kaltmiete", "rgba(200, 213, 79, 0.9)", 0.9),
                    ].filter(isBarSeries)}
                    valueKind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                    svgWidth={720}
                    svgHeight={260}
                  />
                ) : (
                  <p className="small text-muted mb-0">Keine Zimmerdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h3 className="h6 mb-0">Nach Flächen</h3>
              </div>
              <div className="card-body">
                {vm.wohnungFlaechenModel ? (
                  <VergleichBarChart
                    title="Mietpreise nach Flächen"
                    categories={vm.wohnungFlaechenModel.categories}
                    series={[
                      pickSeries(vm.wohnungFlaechenModel, "kaltmiete_vorjahr", "Vorjahr", "rgba(75, 192, 192, 0.8)", 0.65),
                      pickSeries(vm.wohnungFlaechenModel, "kaltmiete", "Kaltmiete", "rgba(200, 213, 79, 0.9)", 0.9),
                    ].filter(isBarSeries)}
                    valueKind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                    svgWidth={720}
                    svgHeight={260}
                  />
                ) : (
                  <p className="small text-muted mb-0">Keine Flächendaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wohnung: Baujahr */}
      <section className="mb-5" id="wohnung-baujahr">
        <h3 className="text-center">Wohnungsmieten nach Baujahr</h3>
        {vm.wohnungBaujahrBestand !== null || vm.wohnungBaujahrNeubau !== null ? (
        <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
          <div className="card-body">
            <KpiValue
              icon="/icons/ws24_marktbericht_mietpreise.svg"
              items={[
                { label: "Bestand", value: vm.wohnungBaujahrBestand, kind: "miete_qm", unitKey: "eur_per_sqm" },
                { label: "Neubau", value: vm.wohnungBaujahrNeubau, kind: "miete_qm", unitKey: "eur_per_sqm", highlight: true },
              ]}
              ctx="kpi"
              size="xl"
              highlightBg="transparent"
              highlightValueColor="#486b7a"
              normalValueColor="#6c757d"
            />
          </div>
        </div>
        ) : (
          <p className="small text-muted mb-0">Keine Baujahrsdaten verfügbar.</p>
        )}
      </section>

      {/* Haus */}
      <section className="mb-4" id="hauspreise">
        <header className="mb-5 w-75 mx-auto text-center">
          {vm.headlineHausIndividuell ? (
            <>
              <h2 className="h4 text-muted mb-2">{vm.headlineHaus}</h2>
              <h3 className="h2 mb-5">{vm.headlineHausIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineHaus}</h2>
          )}
        </header>

        {vm.hausText ? <p className="mx-auto my-5 w-75">{vm.hausText}</p> : null}

        <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
          <div className="card-body">
            <KpiValue
              icon="/icons/ws24_marktbericht_mietpreise.svg"
              items={[
                { label: "min", value: vm.hausMin, kind: "miete_qm", unitKey: "eur_per_sqm" },
                { label: "Durchschnitt", value: vm.hausAvg, kind: "miete_qm", unitKey: "eur_per_sqm", highlight: true },
                { label: "max", value: vm.hausMax, kind: "miete_qm", unitKey: "eur_per_sqm" },
              ]}
              ctx="kpi"
              size="xl"
              highlightBg="transparent"
              highlightValueColor="#486b7a"
              normalValueColor="#6c757d"
            />
          </div>
        </div>
        
      </section>

      {/* Mietpreisentwicklung Haus */}
      <section className="mb-5" id="haus-preisentwicklung">
        <h3 className="text-center">Mietpreisentwicklung Häuser</h3>
        {vm.hausEntwicklungText ? <p className="mx-auto my-5 w-75">{vm.hausEntwicklungText}</p> : null}

        <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-white border-0 text-center">
            <h4 className="h6 mb-0">Mietpreisentwicklung Häuser</h4>
          </div>
          <div className="card-body">
            <ZeitreiheChart
              title="Mietpreisentwicklung Häuser"
              series={vm.hausEntwicklungSeries}
              kind="miete_qm"
              unitKey="eur_per_sqm"
              ctx="chart"
              svgWidth={720}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-0" id="faq-mietpreise">
        <h2 className="text-center mb-3">FAQ zu Mietpreisen</h2>
        <FaqSection id="faq" title={`FAQ – Mietpreise ${vm.regionName}`} items={FAQ_IMMOBILIENMARKT_ALLGEMEIN} />
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
  );
}
