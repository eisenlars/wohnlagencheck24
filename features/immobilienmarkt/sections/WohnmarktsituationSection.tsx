// features/immobilienmarkt/sections/WohnmarktsituationSection.tsx

import Image from "next/image";
import Link from "next/link";

import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { InteractiveMap } from "@/components/interactive-map";
import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import { VergleichBarChart } from "@/components/VergleichBarChart";
import { DoughnutChart } from "@/components/DoughnutChart";
import { StackedComboChart } from "@/components/StackedComboChart";
import { FaqSection } from "@/components/FaqSection";
import { KpiValue } from "@/components/KpiValue";
import { ImageModal } from "@/components/ImageModal";

import { formatMetric } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

import type { WohnmarktsituationVM } from "@/features/immobilienmarkt/selectors/shared/types/wohnmarktsituation";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";

const DEFAULT_ICON = "/icons/ws24_marktbericht_wohnmarktsituation.svg";

function parseSaldoValue(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const hasDot = trimmed.includes(".");
  const hasComma = trimmed.includes(",");

  let normalized = trimmed;
  if (hasDot && hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/\s+/g, "");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function ensureDoughnutSlices(slices: { label: string; value: number | null }[], totalValue: number | null) {
  const sliceTotal = (slices ?? [])
    .map((slice) => (typeof slice.value === "number" ? slice.value : 0))
    .reduce((sum, value) => sum + value, 0);

  if (sliceTotal > 0) return slices;
  if (typeof totalValue === "number" && Number.isFinite(totalValue) && totalValue > 0) {
    return [{ label: "Gesamt", value: totalValue }];
  }
  return slices;
}

export function WohnmarktsituationSection(
  props: SectionPropsBase & {
    vm: WohnmarktsituationVM;
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

  const saldoValue = parseSaldoValue(vm.kpis.wohnungsbestandWohnraumsaldo);
  const wohnungsbestandWohnraumsaldoPer1000Value = toNumberOrNull(
    vm.kpis.wohnungsbestandWohnraumsaldoPer1000,
  );
  const saldoStatus =
    saldoValue === null
      ? { label: "Wohnraumsaldo", image: "/images/wohnmarktsituation/wohnungsmarkt-ausgeglichen.svg" }
      : saldoValue > 500
        ? { label: "Wohnungsüberhang", image: "/images/wohnmarktsituation/wohnungsmarkt-ueberhang.svg" }
        : saldoValue < -500
          ? { label: "Wohnungsdefizit", image: "/images/wohnmarktsituation/wohnungsmarkt-defizit.svg" }
          : { label: "Gesunder Wohnungsmarkt", image: "/images/wohnmarktsituation/wohnungsmarkt-ausgeglichen.svg" };

  const faqItems = [
    {
      q: `Woher stammen die statistischen Daten zum Standort ${vm.regionName}?`,
      a: "Die Quelle für die statistischen Informationen zur Bevölkerung, zum Arbeitsmarkt und zur Wirtschaft sind die Statistischen Bundes- und Landesämter.",
    },
    {
      q: `Wie definieren sich die Standortfaktoren in ${vm.regionName}?`,
      a: "Die Standortfaktoren werden durch unsere regionalen Partner und Immobilienspezialisten bereitgestellt.",
    },
  ];
  const einwohnerValue = parseSaldoValue(vm.kpis.einwohner);
  const einwohnerdichteValue = parseSaldoValue(vm.kpis.einwohnerdichte);
  const siedlungsdichteValue = parseSaldoValue(vm.kpis.siedlungsdichte);
  const haushalteValue = parseSaldoValue(vm.kpis.haushalte);
  const haushaltsgroesseValue = parseSaldoValue(vm.kpis.haushaltsgroesse);
  const wanderungssaldoValue = parseSaldoValue(vm.kpis.wanderungssaldo);
  const natuerlicherSaldoValue = parseSaldoValue(vm.kpis.natuerlicherSaldo);
  const jugendquotientValue = parseSaldoValue(vm.kpis.jugendquotient);
  const altenquotientValue = parseSaldoValue(vm.kpis.altenquotient);
  const flaecheWohnbauValue = parseSaldoValue(vm.kpis.flaecheWohnbau);
  const wohnungsbestandValue = parseSaldoValue(vm.kpis.wohnungsbestand);
  const baufertigstellungenValue = parseSaldoValue(vm.kpis.baufertigstellungen);
  const baugenehmigungenValue = parseSaldoValue(vm.kpis.baugenehmigungen);
  const wohnungsbestandAnzahlAbsolutValue = parseSaldoValue(vm.kpis.wohnungsbestandAnzahlAbsolut);
  const leerstandsquoteValue = parseSaldoValue(vm.kpis.leerstandsquote);
  const wohnungsbestandMittlereWohnflaecheValue = parseSaldoValue(vm.kpis.wohnungsbestandMittlereWohnflaeche);
  const showMittlereWohnflaeche = wohnungsbestandMittlereWohnflaecheValue !== null && wohnungsbestandMittlereWohnflaecheValue !== 0;
  const wohnflaecheHasChartData = (vm.wohnungsbestandWohnflaeche ?? []).some((serie) =>
    (serie.points ?? []).some((point) => {
      const value = toNumberOrNull(point?.value);
      return typeof value === "number" && Number.isFinite(value);
    }),
  );
  const showWohnflaecheSection = showMittlereWohnflaeche || wohnflaecheHasChartData;
  const baufertigstellungenAnzahlAbsolutValue = parseSaldoValue(vm.kpis.baufertigstellungenAnzahlAbsolut);
  const baufertigstellungenFlaecheAbsolutValue = parseSaldoValue(vm.kpis.baufertigstellungenFlaecheAbsolut);
  const showBaufertigstellungenAnzahl = baufertigstellungenAnzahlAbsolutValue !== null;
  const baufertigstellungenBothZero =
    baufertigstellungenAnzahlAbsolutValue === 0 && baufertigstellungenFlaecheAbsolutValue === 0;
  const showBaufertigstellungenFlaeche =
    baufertigstellungenFlaecheAbsolutValue !== null &&
    (baufertigstellungenBothZero ||
      baufertigstellungenAnzahlAbsolutValue === null ||
      baufertigstellungenFlaecheAbsolutValue !== 0);
  const baugenehmigungenAnzahlAbsolutValue = parseSaldoValue(vm.kpis.baugenehmigungenAnzahlAbsolut);
  const baugenehmigungenFlaecheAbsolutValue = parseSaldoValue(vm.kpis.baugenehmigungenFlaecheAbsolut);
  const baugenehmigungenErloschenValue = parseSaldoValue(vm.kpis.baugenehmigungenErloschen);
  const showBaugenehmigungenAnzahl = baugenehmigungenAnzahlAbsolutValue !== null;
  const baugenehmigungenAllZero =
    baugenehmigungenAnzahlAbsolutValue === 0 &&
    baugenehmigungenFlaecheAbsolutValue === 0 &&
    baugenehmigungenErloschenValue === 0;
  const showBaugenehmigungenFlaeche =
    baugenehmigungenFlaecheAbsolutValue !== null &&
    (baugenehmigungenAllZero ||
      baugenehmigungenAnzahlAbsolutValue === null ||
      baugenehmigungenFlaecheAbsolutValue !== 0);
  const showBaugenehmigungenErloschen =
    baugenehmigungenErloschenValue !== null &&
    (baugenehmigungenAllZero ||
      baugenehmigungenAnzahlAbsolutValue === null ||
      baugenehmigungenErloschenValue !== 0);
  const baugenehmigungenVisibleCount =
    (showBaugenehmigungenAnzahl ? 1 : 0) +
    (showBaugenehmigungenFlaeche ? 1 : 0) +
    (showBaugenehmigungenErloschen ? 1 : 0);
  const baugenehmigungenColClass =
    baugenehmigungenVisibleCount === 3
      ? "col-md-4"
      : baugenehmigungenVisibleCount === 2
        ? "col-md-6"
        : "col-md-8";

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


      {/* Interaktive Karte + Leitkennzahl - Wohnungssaldo */}
      <section className="mb-5" id="wohnungssaldo">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="" style={{ width: "90%", margin: "0 auto" }}>
              {props.assets?.wohnungssaldoMapSvg ? (
                <>
                  <InteractiveMap
                    svg={props.assets?.wohnungssaldoMapSvg}
                    theme="wohnungssaldo"
                    mode="singleValue"
                    kind="anzahl"
                    unitKey="none"
                    ctx="kpi"
                  />
                  {props.assets?.wohnungssaldoLegendHtml ? (
                    <div
                      className="mt-3"
                      dangerouslySetInnerHTML={{ __html: props.assets?.wohnungssaldoLegendHtml ?? "" }}
                    />
                  ) : null}
                </>
              ) : (
                <p className="small text-muted mb-0">
                  Für diesen Landkreis liegt aktuell noch keine Wohnungssaldo-Karte vor.
                </p>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-6 d-flex align-items-center">
            <div className="w-100 align-center text-center">
              {wohnungsbestandWohnraumsaldoPer1000Value !== null &&
              Number.isFinite(wohnungsbestandWohnraumsaldoPer1000Value) ? (
                <>
                  <div className="mb-2 kpi-hero">
                    <KpiValue
                      value={wohnungsbestandWohnraumsaldoPer1000Value}
                      kind="anzahl"
                      unitKey="none"
                      ctx="kpi"
                      size="ultra"
                      showUnit={true}
                    />
                  </div>
                  <p className="mb-0">Wohnungssaldo per 1000 EW – {vm.regionName}</p>
                </>
              ) : (
                <p className="small text-muted mb-0">Keine Wohnungssaldo-Daten verfügbar.</p>
              )}
            </div>
          </div>
          
          
          
          
        </div>
      </section>

      {/* Wohnraumnachfrage */}
      <section className="mb-5" id="wohnraumnachfrage">
        <header className="mb-5 w-75 mx-auto text-center">
          {vm.headlineWohnraumnachfrageIndividuell ? (
            <>
              <h2 className="h4 text-muted mb-2">{vm.headlineWohnraumnachfrage}</h2>
              <h3 className="h2 mb-5">{vm.headlineWohnraumnachfrageIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-5">{vm.headlineWohnraumnachfrage}</h2>
          )}
        </header>

        {vm.wohnraumnachfrageText ? <p className="my-5 w-75 mx-auto">{vm.wohnraumnachfrageText}</p> : null}

        <div className="row g-3 mb-5 mt-5">
          {einwohnerValue !== null ? (
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Bevölkerung"
                    items={[{ label: "Bevölkerung", value: einwohnerValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="EW"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {einwohnerdichteValue !== null ? (
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Einwohnerdichte"
                    items={[{ label: "Einwohnerdichte", value: einwohnerdichteValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="EW pro km²"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {siedlungsdichteValue !== null ? (
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Siedlungsdichte"
                    items={[{ label: "Siedlungsdichte", value: siedlungsdichteValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="EW pro km²"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {vm.allgemeinText ? <p className="mx-auto mt-5 w-75">{vm.allgemeinText}</p> : null}
      </section>

      {/* Bevölkerungsentwicklung */}
      <section className="mb-5" id="bevoelkerungsentwicklung">
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-none h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Abs. Bevölkerungsentwicklung</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Abs. Bevölkerungsentwicklung"
                  categories={vm.bevoelkerungsentwicklungAbsolut.categories}
                  bars={vm.bevoelkerungsentwicklungAbsolut.bars}
                  lines={vm.bevoelkerungsentwicklungAbsolut.lines}
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
            <div className="card border-0 shadow-none h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Rel. Bevölkerungsentwicklung</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title={`Rel. Bevölkerungsentwicklung ${vm.bevoelkerungsentwicklungBasisjahr ? `(Basisjahr: ${vm.bevoelkerungsentwicklungBasisjahr})` : ""}`}
                  series={vm.bevoelkerungsentwicklungRelativ}
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

        {vm.bevoelkerungsentwicklungText ? <p className="mx-auto my-5 w-75">{vm.bevoelkerungsentwicklungText}</p> : null}
      
        {/* Haushalte */}
      
        <div className="row g-3 mb-3">
          {haushalteValue !== null ? (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Haushalte"
                    items={[{ label: "Haushalte", value: haushalteValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Haushalte"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {haushaltsgroesseValue !== null ? (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Ø Haushaltsgröße"
                    items={[{ label: "Ø Haushaltsgröße", value: haushaltsgroesseValue, kind: "anzahl", unitKey: "none", fractionDigits: 1 }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="EW pro Haushalt"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {vm.haushalteText ? <p className="mx-auto my-5 w-75">{vm.haushalteText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-none h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Haushalte je 1000 EW</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Haushalte je 1000 EW"
                  series={vm.haushalteJe1000}
                  kind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-none h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Haushaltsgröße nach Personenanzahl</h4>
              </div>
              <div className="card-body">
                <VergleichBarChart
                  title="Haushaltsgröße nach Personenanzahl"
                  categories={vm.haushaltsgroesseNachPersonenanzahl.categories}
                  series={vm.haushaltsgroesseNachPersonenanzahl.bars}
                  valueKind="anzahl"
                  unitKey="count"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
        
        
        
        
      </section>


      {/* Bevölkerungsbewegungen Gesamt */}
      
      <section className="mb-5" id="bevoelkerungsbewegung">
        
        <h3 className="text-center">Analyse der Bevölkerungsbewegungen</h3>
        
        {vm.natuerlicherSaldoIntro ? <p className="mx-auto my-5 w-75">{vm.natuerlicherSaldoIntro}</p> : null}

        <div className="row g-3 mb-5">
          {wanderungssaldoValue !== null ? (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Wanderungssaldo"
                    items={[{ label: "Wanderungssaldo", value: wanderungssaldoValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="EW"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {natuerlicherSaldoValue !== null ? (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Natürlicher Saldo"
                    items={[{ label: "Natürlicher Saldo", value: natuerlicherSaldoValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="EW"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card border-0 shadow-none h-100">
          <div className="card-header bg-white border-0 text-center">
            <h4 className="h5 mb-0">Gesamte Bevölkerungsbewegung</h4>
          </div>
          <div className="card-body">
            <StackedComboChart
              title="Gesamte Bevölkerungsbewegung"
              categories={vm.bevoelkerungsbewegungGesamt.categories}
              bars={vm.bevoelkerungsbewegungGesamt.bars}
              lines={vm.bevoelkerungsbewegungGesamt.lines}
              valueKind="anzahl"
              unitKey="count"
              ctx="chart"
              stacked
              svgHeight={300}
              tableClassName="visually-hidden"
            />
          </div>
        </div>
        
      </section>



      {/* Natürliche Bevölkerungsbewegung */}
      
      <section className="mb-5" id="natuerlicher-saldo">
        
        <h4 className="text-center">Natürliche Bevölkerungsbewegung</h4>
        
        {vm.natuerlicherSaldoText ? <p className="mx-auto my-5 w-75">{vm.natuerlicherSaldoText}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Natürliches Saldo – Kombination</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Natürliches Saldo – Kombination"
                  categories={vm.natuerlicheBevoelkerungsbewegung.categories}
                  bars={vm.natuerlicheBevoelkerungsbewegung.bars}
                  lines={vm.natuerlicheBevoelkerungsbewegung.lines}
                  valueKind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  stacked
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Natürliches Saldo je 1000 EW – Zeitreihe</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Natürliches Saldo je 1000 EW – Zeitreihe"
                  series={vm.natuerlicheBevoelkerungsbewegungJe1000}
                  kind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Wanderungsbewegung */}
      
      <section className="mb-5" id="wanderungssaldo">
      
        <h4 className="text-center">Wanderungsbewegung</h4>
      
        {vm.wanderungssaldoIntro ? <p className="mx-auto my-5 w-75">{vm.wanderungssaldoIntro}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Gesamtwanderung</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Gesamtwanderung"
                  categories={vm.wanderungssaldo.categories}
                  bars={vm.wanderungssaldo.bars}
                  lines={vm.wanderungssaldo.lines}
                  valueKind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  stacked
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Wanderungssaldo je 1000 EW</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Wanderungssaldo je 1000 EW"
                  series={vm.wanderungssaldoJe1000}
                  kind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>

        {vm.wanderungssaldoText ? <p className="mx-auto my-5 w-75">{vm.wanderungssaldoText}</p> : null}
        
        {/* Aussenwanderungssaldo */}

        <div className="row g-4">
       
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 text-center">
              <h4 className="h5 mb-0">Außenwanderungssaldo</h4>
            </div>
            <div className="card-body">
              <StackedComboChart
                title="Außenwanderungssaldo nach Ziel- und Herkunftsgebieten"
                categories={vm.aussenwanderungssaldo.categories}
                bars={vm.aussenwanderungssaldo.bars}
                lines={vm.aussenwanderungssaldo.lines}
                valueKind="anzahl"
                unitKey="count"
                ctx="chart"
                stacked
                svgHeight={260}
              />
            </div>
          </div> {/* <- Dieses div hat im Original gefehlt */}
        </div>

        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 text-center">
              <h4 className="h5 mb-0">Wanderungssalden nach Altersklassen</h4>
            </div>
            <div className="card-body">
              <StackedComboChart
                title={`Wanderungssalden nach Altersklassen ${vm.aussenwanderungssaldoNachAlterZeitraum ? `(Durchschnitt ${vm.aussenwanderungssaldoNachAlterZeitraum})` : ""}`}
                categories={vm.aussenwanderungssaldoNachAlter.categories}
                bars={vm.aussenwanderungssaldoNachAlter.bars}
                lines={vm.aussenwanderungssaldoNachAlter.lines}
                valueKind="anzahl"
                unitKey="count"
                ctx="chart"
                stacked
                svgHeight={260}
              />
            </div>
          </div>
        </div>
      </div>

      </section>

        



      {/* Altersstruktur */}
      
      <section className="mb-5" id="alterstruktur">
        
        <h3 className="text-center">Analyse der Altersstrukturen</h3>
        
        {vm.alterstrukturText ? <p className="mx-auto my-5 w-75">{vm.alterstrukturText}</p> : null}

        <div className="card border-0 shadow-none h-100">
          <div className="card-header bg-white border-0 text-center">
              <h4 className="h5 mb-0">Durchschnittliche Altersentwicklung</h4>
            </div>
            <div className="card-body">
              <ZeitreiheChart
                title="Durchschnittliche Altersentwicklung – Zeitreihe 2014 bis 2024"
                series={vm.bevoelkerungsaltersentwicklung}
                kind="index"
                unitKey="none"
                ctx="chart"
                svgWidth={720}
                svgHeight={260}
              />
            </div>
        </div>

        
        {/* Jugend- und Altenquotient */}
        
        {vm.jugendAltenQuotientIntro ? <p className="mx-auto my-5 w-75">{vm.jugendAltenQuotientIntro}</p> : null}

        <div className="row g-3 mb-3">
          {jugendquotientValue !== null ? (
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Jugendquotient"
                    items={[{ label: "Jugendquotient", value: jugendquotientValue, kind: "anzahl", unitKey: "none", fractionDigits: 1 }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                  />
                </div>
              </div>
            </div>
          ) : null}
 
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Altersverteilung</h4>
              </div>
              <div className="card-body">
                <DoughnutChart
                  title="Altersverteilung"
                  slices={vm.altersverteilung}
                  valueKind="anzahl"
                  unitKey="count"
                  svgSize={240}
                />
              </div>
            </div>
          </div>
          
          {altenquotientValue !== null ? (
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Altenquotient"
                    items={[{ label: "Altenquotient", value: altenquotientValue, kind: "anzahl", unitKey: "none", fractionDigits: 1 }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {vm.jugendAltenQuotientText ? <p className="mx-auto my-5 w-75">{vm.jugendAltenQuotientText}</p> : null}
        
      </section>



      {/* Wohnraumangebot */}
      
      <section className="mb-5" id="wohnraumangebot">
        
        <header className="mb-5 text-center">
          {vm.headlineWohnraumangebotIndividuell ? (
            <>
              <h2 className="h4 text-muted mb-1">{vm.headlineWohnraumangebot}</h2>
              <h3 className="h2 mb-0">{vm.headlineWohnraumangebotIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mx-auto mb-0">{vm.headlineWohnraumangebot}</h2>
          )}
        </header>

        <div className="row g-4 align-items-center mb-3" id="wohnbauflaechen">
          <div className="col-12 col-lg-4">
            <DoughnutChart
              title="Wohnbauflächenanteil"
              slices={vm.wohnbauflaechenanteil}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
          </div>
          <div className="col-12 col-lg-4">
            {flaecheWohnbauValue !== null ? (
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Flächennutzung Wohnbau"
                    items={[{ label: "Flächennutzung Wohnbau", value: flaecheWohnbauValue, kind: "anzahl", unitKey: "ha" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={true}
                    caption="Gesamtfläche Wohnbau"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-none h-100">
              <div className="card-body text-center">
                {props.assets?.flaechennutzungWohnbauImageSrc ? (
                  <ImageModal
                    src={props.assets.flaechennutzungWohnbauImageSrc}
                    alt="Flächennutzung Wohnbau"
                    thumbStyle={{ width: "100%", height: "auto" }}
                  />
                ) : (
                  <Image
                    src="/images/wohnmarktsituation/landuse-placeholder.svg"
                    alt="Flächennutzung Wohnbau"
                    width={320}
                    height={200}
                    style={{ width: "100%", height: "auto" }}
                  />
                )}
                {props.assets?.flaechennutzungWohnbauImageSrc && props.assets?.flaechennutzungWohnbauUsesKreisFallback ? (
                  <p className="small text-muted mt-2 mb-0">(Kreisangaben)</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {vm.wohnraumangebotIntro ? <p className="mx-auto my-5 w-75">{vm.wohnraumangebotIntro}</p> : null}

        <div className="row g-4 my-5" id="wohnungsbestand-gebaeude">
          <div className="col-12 col-lg-4">
            <h4 className="h5 text-center mb-3">Wohnungsbestand</h4>
            <DoughnutChart
              title="Wohnungsbestand"
              slices={ensureDoughnutSlices(vm.wohnungsbestandGebaeudeverteilung, wohnungsbestandValue)}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
            {wohnungsbestandValue !== null ? (
              <p className="text-center mt-2 mb-0">
                <strong>{formatMetric(wohnungsbestandValue, { kind: "anzahl", ctx: "kpi", unit: "none" })}</strong> Wohnungen insgesamt
              </p>
            ) : null}
          </div>
          <div className="col-12 col-lg-4">
            <h4 className="h5 text-center mb-3">Baufertigstellungen</h4>
            <DoughnutChart
              title="Baufertigstellungen"
              slices={ensureDoughnutSlices(vm.baufertigstellungenGebaeudeverteilung, baufertigstellungenValue)}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
            {baufertigstellungenValue !== null ? (
              <p className="text-center mt-2 mb-0">
                <strong>{formatMetric(baufertigstellungenValue, { kind: "anzahl", ctx: "kpi", unit: "none" })}</strong> Wohnungen insgesamt
              </p>
            ) : null}
          </div>
          <div className="col-12 col-lg-4">
            <h4 className="h5 text-center mb-3">Baugenehmigungen</h4>
            <DoughnutChart
              title="Baugenehmigungen"
              slices={ensureDoughnutSlices(vm.baugenehmigungenGebaeudeverteilung, baugenehmigungenValue)}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
            {baugenehmigungenValue !== null ? (
              <p className="text-center mt-2 mb-0">
                <strong>{formatMetric(baugenehmigungenValue, { kind: "anzahl", ctx: "kpi", unit: "none" })}</strong> Wohnungen insgesamt
              </p>
            ) : null}
          </div>
        </div>

        {vm.bautaetigkeitIntro ? <p className="mx-auto my-5 w-75">{vm.bautaetigkeitIntro}</p> : null}

        <div className="mt-3" id="bauueberhang-genehmigung-fertigstellung">
          <div className="card border-0 shadow-none h-100">
            <div className="card-header bg-white border-0 text-center">
              <h4 className="h5 mb-0">Gegenüberstellung von Genehmigungen, Fertigstellungen, Bauüberhang und Bauabgängen</h4>
            </div>
            <div className="card-body">
              <StackedComboChart
                title="Gegenüberstellung von Genehmigungen, Fertigstellungen, Bauüberhang und Bauabgängen"
                categories={vm.bauUeberhangGenehmigungFertigstellung[0]?.points.map((p) => String(p.jahr)) ?? []}
                bars={[]}
                lines={vm.bauUeberhangGenehmigungFertigstellung.map((series) => ({
                  key: series.key,
                  label: series.label,
                  values: series.points.map((p) => p.value),
                  color: series.color,
                }))}
                valueKind="anzahl"
                unitKey="count"
                ctx="chart"
                stacked={false}
                svgHeight={300}
              />
            </div>
          </div> 
        </div>
      </section>
      
      
      {/* Wohnungsbestand Anzahl */}
      <section className="mb-5" id="wohnungsbestand-anzahl">
        
        <h3 className="mx-auto text-center">Wohnungsbestand</h3>
        
        <div className="row g-3 mb-3">
          {wohnungsbestandAnzahlAbsolutValue !== null ? (
            <div className={leerstandsquoteValue ? "col-12 col-md-6" : "col-12"}>
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Wohnungen insgesamt"
                    items={[{ label: "Wohnungen insgesamt", value: wohnungsbestandAnzahlAbsolutValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Wohnungen"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {leerstandsquoteValue ? (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-none h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Leerstandsquote"
                    items={[{ label: "Leerstandsquote", value: leerstandsquoteValue * 100, kind: "quote", unitKey: "percent" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={true}
                    caption="marktaktiver Leerstand"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {vm.wohnungsbestandAnzahlText ? <p className="mx-auto my-5 w-75">{vm.wohnungsbestandAnzahlText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Wohnungsanzahl</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Wohnungsanzahl"
                  categories={vm.wohnungsbestandWohnungsanzahl.categories}
                  bars={vm.wohnungsbestandWohnungsanzahl.bars}
                  lines={vm.wohnungsbestandWohnungsanzahl.lines}
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
                <h4 className="h5 mb-0">Wohnungsanzahl pro 1000 EW</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Wohnungsanzahl pro 1000 EW"
                  series={vm.wohnungsbestandWohnungsanzahlJe1000}
                  kind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wohnfläche */}
      {showWohnflaecheSection ? (
        <section className="mb-5" id="wohnflaeche">
          {vm.wohnungsbestandWohnflaecheText ? <p className="mx-auto my-5 w-75">{vm.wohnungsbestandWohnflaecheText}</p> : null}

          <div className={`row g-4${showMittlereWohnflaeche ? "" : " justify-content-center"}`}>
            <div className={`col-12 ${showMittlereWohnflaeche ? "col-lg-6" : "col-lg-8"}`}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 text-center">
                  <h4 className="h5 mb-0">Wohnfläche pro EW</h4>
                </div>
                <div className="card-body">
                  <ZeitreiheChart
                    title="Wohnfläche pro EW"
                    series={vm.wohnungsbestandWohnflaeche}
                    kind="anzahl"
                    unitKey="count"
                    ctx="chart"
                    svgWidth={720}
                    svgHeight={260}
                  />
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              {showMittlereWohnflaeche ? (
                <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                  <div className="card-body">
                    <KpiValue
                      icon={DEFAULT_ICON}
                      iconAlt="Ø Wohnfläche"
                      items={[{ label: "Ø Wohnfläche", value: wohnungsbestandMittlereWohnflaecheValue, kind: "anzahl", unitKey: "none" }]}
                      ctx="kpi"
                      size="xl"
                      showUnit={false}
                      caption="m²"
                      captionClassName="small text-muted mt-1"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Baufertigstellungen */}
      <section className="mb-5" id="baufertigstellungen">
        <h3 className="mx-auto text-center">Baufertigstellungen</h3>
        {vm.baufertigstellungenIntro ? <p className="mx-auto my-5 w-75">{vm.baufertigstellungenIntro}</p> : null}

        <div className={`row g-3 mb-3${showBaufertigstellungenAnzahl && showBaufertigstellungenFlaeche ? "" : " justify-content-center"}`}>
          {showBaufertigstellungenAnzahl ? (
            <div className={`col-12 ${showBaufertigstellungenAnzahl && showBaufertigstellungenFlaeche ? "col-md-6" : "col-md-8"}`}>
              <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Baufertigstellungen insgesamt"
                    items={[{ label: "Baufertigstellungen insgesamt", value: baufertigstellungenAnzahlAbsolutValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Wohnungen"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {showBaufertigstellungenFlaeche ? (
            <div className={`col-12 ${showBaufertigstellungenAnzahl && showBaufertigstellungenFlaeche ? "col-md-6" : "col-md-8"}`}>
              <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Fertiggestellte Flächen"
                    items={[{ label: "Fertiggestellte Flächen", value: baufertigstellungenFlaecheAbsolutValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="1000 m²"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {vm.baufertigstellungenText ? <p className="mx-auto my-5 w-75">{vm.baufertigstellungenText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-none h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Fertiggestellte Wohnungen</h4>
              </div>
              <div className="card-body">
                <StackedComboChart
                  title="Fertiggestellte Wohnungen"
                  categories={vm.baufertigstellungenWohnungsanzahl.categories}
                  bars={vm.baufertigstellungenWohnungsanzahl.bars}
                  lines={vm.baufertigstellungenWohnungsanzahl.lines}
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
            <div className="card border-0 shadow-none h-100">
              <div className="card-header bg-white border-0 text-center">
                <h4 className="h5 mb-0">Baufertigstellungen pro 1000 EW</h4>
              </div>
              <div className="card-body">
                <ZeitreiheChart
                  title="Baufertigstellungen pro 1000 EW"
                  series={vm.baufertigstellungenWohnungsanzahlJe1000}
                  kind="anzahl"
                  unitKey="count"
                  ctx="chart"
                  svgWidth={720}
                  svgHeight={260}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Baugenehmigungen */}
      <section className="mb-5" id="baugenehmigungen">
        <h3 className="mx-auto text-center">Baugenehmigungen</h3>
        {vm.baugenehmigungenIntro ? <p className="mx-auto my-5 w-75">{vm.baugenehmigungenIntro}</p> : null}

        <div className={`row g-3 mb-3${baugenehmigungenVisibleCount < 3 ? " justify-content-center" : ""}`}>
          {showBaugenehmigungenAnzahl ? (
            <div className={`col-12 ${baugenehmigungenColClass}`}>
              <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Genehmigungen"
                    items={[{ label: "Genehmigungen", value: baugenehmigungenAnzahlAbsolutValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Wohnungen"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {showBaugenehmigungenFlaeche ? (
            <div className={`col-12 ${baugenehmigungenColClass}`}>
              <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Flächen"
                    items={[{ label: "Flächen", value: baugenehmigungenFlaecheAbsolutValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="1000 m²"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {showBaugenehmigungenErloschen ? (
            <div className={`col-12 ${baugenehmigungenColClass}`}>
              <div className="card border-0 shadow-sm h-100 text-center d-flex align-items-center">
                <div className="card-body">
                  <KpiValue
                    icon={DEFAULT_ICON}
                    iconAlt="Erloschen"
                    items={[{ label: "Erloschen", value: baugenehmigungenErloschenValue, kind: "anzahl", unitKey: "none" }]}
                    ctx="kpi"
                    size="xl"
                    showUnit={false}
                    caption="Genehmigungen"
                    captionClassName="small text-muted mt-1"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {vm.baugenehmigungenText ? <p className="mx-auto my-5 w-75">{vm.baugenehmigungenText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
            <StackedComboChart
              title="Genehmigte Wohnungen"
              categories={vm.baugenehmigungenWohnungsanzahl.categories}
              bars={vm.baugenehmigungenWohnungsanzahl.bars}
              lines={vm.baugenehmigungenWohnungsanzahl.lines}
              valueKind="anzahl"
              unitKey="count"
              ctx="chart"
              stacked={false}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Baugenehmigungen pro 1000 EW"
              series={vm.baugenehmigungenWohnungsanzahlJe1000}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Bauüberhang und Baufortschritt */}
      <section className="mb-5" id="bauueberhang-baufortschritt">
        <h3 className="mx-auto text-center">Bauüberhang und Baufortschritt</h3>
        {vm.bauueberhangBaufortschrittText ? <p className="mx-auto my-5 w-75">{vm.bauueberhangBaufortschrittText}</p> : null}

        {vm.bauueberhangBaufortschrittUsesKreisFallback ? (
          <p className="small text-muted text-center mb-3">
            Hinweis: Für die Ortsebene liegen keine Bauüberhang-Daten vor. Darstellung auf Kreisebene.
          </p>
        ) : null}

        <StackedComboChart
          title={`Bauüberhang und Baufortschritt (Wohnungsneubau)${vm.bauueberhangBaufortschrittUsesKreisFallback ? " (Kreisangaben)" : ""}`}
          categories={vm.bauueberhangBaufortschritt.categories}
          bars={vm.bauueberhangBaufortschritt.bars.filter((series) => {
            if (series.key !== "genehmigung_erloschen") return true;
            return series.values.some((value) => typeof value === "number" && Number.isFinite(value) && value !== 0);
          })}
          lines={vm.bauueberhangBaufortschritt.lines}
          valueKind="anzahl"
          unitKey="count"
          ctx="chart"
          stacked
          svgHeight={300}
        />
      </section>
      
      
      {/* Wohnraumsaldo */}
      <section className="mb-5" id="wohnraumsaldo">
        
        <h4 className="mx-auto text-center">Zusammenfassung Wohnraumsaldo</h4>
        
        {vm.wohnungsbestandIntro ? <p className="mx-auto my-5 w-75">{vm.wohnungsbestandIntro}</p> : null}

        <div className="row g-4 align-items-center my-4">
          <div className="col-12 col-lg-6 text-center">
            <Image
              src={saldoStatus.image}
              alt={saldoStatus.label}
              width={320}
              height={200}
              style={{ width: "70%", height: "auto" }}
            />
          </div>
          <div className="col-12 col-lg-6 text-center">
            <KpiValue
              icon={DEFAULT_ICON}
              iconAlt="Wohnraumsaldo"
              items={[{ label: "Wohnraumsaldo", value: saldoValue, kind: "anzahl", unitKey: "none" }]}
              ctx="kpi"
              size="ultra"
              showUnit={false}
              caption={saldoStatus.label}
              captionClassName="small text-muted mt-1"
            />
          </div>
        </div>
      </section>
      

      {/* FAQ */}
      <section className="mb-0" id="faq-wohnmarktsituation">
        <h2 className="text-center mb-3">FAQ zur Wohnmarktsituation</h2>
        <FaqSection items={faqItems} />
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
  );
}
