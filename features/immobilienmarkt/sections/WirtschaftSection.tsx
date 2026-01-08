import Image from "next/image";
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
import { FaqSection } from "@/components/FaqSection";

import type { WirtschaftVM } from "@/features/immobilienmarkt/selectors/shared/types/wirtschaft";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";
import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

type KpiCardProps = {
  iconSrc?: string;
  title: string;
  value: number | null;
  unit?: string;
  kind?: "anzahl" | "quote" | "index";
  unitKey?: "eur" | "percent" | "count" | "none";
};

const DEFAULT_ICON = "/icons/ws24_marktbericht_wirtschaft.svg";

function isEmptyValue(value: number | null): boolean {
  return value === null || !Number.isFinite(value);
}

function KpiCard({
  iconSrc = DEFAULT_ICON,
  title,
  value,
  unit,
  kind = "anzahl",
  unitKey = "none",
}: KpiCardProps) {
  if (isEmptyValue(value)) return null;

  return (
    <div className="card border-0 shadow-sm h-100 text-center">
      <div className="card-body">
        <Image src={iconSrc} alt="" width={32} height={32} className="mb-2" />
        <div className="small text-muted">{title}</div>
        <div className="h4 mb-0">
          <KpiValue value={value} kind={kind} unitKey={unitKey} ctx="kpi" showUnit={false} />
        </div>
        {unit ? <div className="small text-muted">{unit}</div> : null}
      </div>
    </div>
  );
}

export function WirtschaftSection(
  props: SectionPropsBase & {
    vm: WirtschaftVM;
  },
) {
  const { vm, tocItems, tabs, activeTabId } = props;

  const heroImageSrc = props.assets?.heroImageSrc ?? vm.hero.imageSrc ?? "";
  const basePath = props.basePath ?? vm.basePath;

  const mapSvg = props.assets?.kaufkraftindexMapSvg ?? null;
  const legendHtml = props.assets?.kaufkraftindexLegendHtml ?? null;
  const landuseImageSrc = props.assets?.flaechennutzungGewerbeImageSrc ?? null;

  return (
    <div className="text-dark">
      {tocItems.length > 0 && <RightEdgeControls tocItems={tocItems} />}

      <TabNav tabs={tabs} activeTabId={activeTabId} basePath={basePath} parentBasePath={props.parentBasePath} />

      <RegionHero
        title={vm.hero.title}
        subtitle={vm.hero.subtitle}
        imageSrc={heroImageSrc}
        rightOverlay={<HeroOverlayActions variant="immo" />}
        rightOverlayMode="buttons"
      />

      <section className="mb-4" id="einleitung">
        <h1 className="mt-3 mb-1">{vm.headlineMain}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.updatedAt ?? "–"}</p>
        {vm.introText ? <p className="teaser-text">{vm.introText}</p> : null}
        <BeraterBlock name={vm.berater.name} taetigkeit={vm.berater.taetigkeit} imageSrc={vm.berater.imageSrc} />
      </section>

      <section className="mb-5" id="kaufkraftindex">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="h-100" style={{ width: "90%", margin: "0 auto" }}>
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
              <div className="mb-2" style={{ color: "#486b7a", fontSize: "5rem" }}>
                <KpiValue value={vm.kpis.kaufkraftindex} kind="index" unitKey="none" ctx="kpi" size="xl" />
              </div>
              <p className="mb-0">Kaufkraftindex (Basis D = 100)</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5" id="flaechengewerbe">
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
            <KpiValue
              items={[
                {
                  label: "Flächennutzung Industrie und Gewerbe",
                  value: vm.kpis.flaecheGewerbe,
                  kind: "anzahl",
                  unitKey: "none",
                },
              ]}
              ctx="kpi"
              size="md"
              showUnit={false}
            />
            <div className="small text-muted mt-1 text-center">Hektar</div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                {landuseImageSrc ? (
                  <Image
                    src={landuseImageSrc}
                    alt={`Flächennutzung Gewerbe ${vm.regionName}`}
                    width={320}
                    height={200}
                    style={{ width: "100%", height: "auto" }}
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

      <section className="mb-4" id="wirtschaft">
        <header className="mb-3">
          {vm.headlineWirtschaftIndividuell ? (
            <>
              <h2 className="h5 text-muted text-uppercase mb-1">{vm.headlineWirtschaft}</h2>
              <h3 className="h2 mb-0">{vm.headlineWirtschaftIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineWirtschaft}</h2>
          )}
        </header>

        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <KpiCard title="Bruttoinlandsprodukt" value={vm.kpis.bip} unit="€" kind="anzahl" unitKey="eur" />
          </div>
          <div className="col-12 col-lg-4">
            <KpiCard title="Gewerbesaldo" value={vm.kpis.gewerbesaldo} unit="Unternehmen" kind="anzahl" unitKey="count" />
          </div>
        </div>
      </section>

      <section className="mb-5" id="bip">
        {vm.bruttoinlandsproduktText ? <p>{vm.bruttoinlandsproduktText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Bruttoinlandsprodukt"
              series={vm.bipAbs}
              kind="anzahl"
              unitKey="eur"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Bruttoinlandsprodukt pro EW"
              series={vm.bipProEw}
              kind="anzahl"
              unitKey="eur"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      <section className="mb-5" id="gewerbesaldo">
        {vm.gewerbesaldoText ? <p>{vm.gewerbesaldoText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Gewerbesaldo pro 1000 EW"
              series={vm.gewerbesaldoPro1000}
              kind="quote"
              unitKey="none"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      <section className="mb-5" id="einkommen">
        {vm.einkommenText ? <p>{vm.einkommenText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <KpiCard title="Nominales Einkommen" value={vm.kpis.kaufkraftNominal} unit="€ pro EW" kind="anzahl" unitKey="eur" />
          </div>
          <div className="col-12 col-lg-6">
            <KpiCard title="Reales Einkommen" value={vm.kpis.kaufkraftReal} unit="€ pro EW" kind="anzahl" unitKey="eur" />
          </div>
        </div>
        <div className="mt-4">
          <ZeitreiheChart
            title="Verfügbares Einkommen pro EW"
            series={vm.nettoeinkommenProEw}
            kind="anzahl"
            unitKey="eur"
            ctx="chart"
            svgWidth={520}
            svgHeight={260}
          />
        </div>
      </section>

      <section className="mb-5 d-none" id="einkommen-pro-haushalt">
        <ZeitreiheChart
          title="Verfügbares Einkommen pro Haushalt"
          series={vm.nettoeinkommenProHh}
          kind="anzahl"
          unitKey="eur"
          ctx="chart"
          svgWidth={520}
          svgHeight={260}
        />
      </section>

      <section className="mb-4" id="arbeitsmarkt">
        <header className="mb-3">
          {vm.headlineArbeitsmarktIndividuell ? (
            <>
              <h2 className="h5 text-muted text-uppercase mb-1">{vm.headlineArbeitsmarkt}</h2>
              <h3 className="h2 mb-0">{vm.headlineArbeitsmarktIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineArbeitsmarkt}</h2>
          )}
        </header>

        {vm.arbeitsmarktText ? <p>{vm.arbeitsmarktText}</p> : null}
      </section>

      <section className="mb-5" id="arbeitsplatzzentralitaet">
        {vm.arbeitsplatzzentralitaetText ? <p>{vm.arbeitsplatzzentralitaetText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <KpiCard title="Arbeitsplatzzentralität" value={vm.kpis.arbeitsplatzzentralitaet} kind="quote" unitKey="none" />
          </div>
          <div className="col-12 col-lg-6">
            <KpiCard title="Pendlersaldo" value={vm.kpis.pendlersaldo} unit="Pendler" kind="anzahl" unitKey="count" />
          </div>
        </div>
        {vm.pendlerText ? <p className="mt-3">{vm.pendlerText}</p> : null}
      </section>

      <section className="mb-5" id="svb-wohnort">
        {vm.svBeschaeftigteWohnortText ? <p>{vm.svBeschaeftigteWohnortText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="SVB absolut am Wohnort"
              series={vm.svbWohnortAbs}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="SVB am Wohnort (Index)"
              series={vm.svbWohnortIndex}
              kind="index"
              unitKey="none"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      <section className="mb-5" id="svb-arbeitsort">
        {vm.svBeschaeftigteArbeitsortText ? <p>{vm.svBeschaeftigteArbeitsortText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="SVB absolut am Arbeitsort"
              series={vm.svbArbeitsortAbs}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="SVB am Arbeitsort (Index)"
              series={vm.svbArbeitsortIndex}
              kind="index"
              unitKey="none"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      <section className="mb-5" id="arbeitslosigkeit">
        {vm.arbeitslosenquoteText ? <p>{vm.arbeitslosenquoteText}</p> : null}
        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <KpiCard title="Arbeitslosenquote" value={vm.kpis.arbeitslosenquote} unit="%" kind="quote" unitKey="percent" />
          </div>
          <div className="col-12 col-lg-4">
            <KpiCard title="Beschäftigtenquote" value={vm.kpis.beschaeftigtenquote} unit="%" kind="quote" unitKey="percent" />
          </div>
          <div className="col-12 col-lg-4">
            <KpiCard title="Arbeitslosendichte" value={vm.kpis.arbeitslosendichte} kind="anzahl" unitKey="none" />
          </div>
        </div>
        <div className="row g-4 mt-3">
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Arbeitslosenstatistik"
              series={vm.arbeitslosenzahlen}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Arbeitslosenquoten"
              series={vm.arbeitslosenquoten}
              kind="quote"
              unitKey="percent"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
        {vm.arbeitslosendichteText ? <p className="mt-3">{vm.arbeitslosendichteText}</p> : null}
      </section>

      {/* FAQ */}
      <section className="mb-5" id="faq-wirtschaft">
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
