import Image from "next/image";

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

import { formatMetric } from "@/utils/format";

import type { WohnmarktsituationVM } from "@/features/immobilienmarkt/selectors/shared/types/wohnmarktsituation";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";

type KpiCardProps = {
  iconSrc?: string;
  title: string;
  value: number | string | null;
  unit?: string;
};

const DEFAULT_ICON = "/icons/ws24_marktbericht_wohnmarktsituation.svg";

function parseSaldoValue(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function isEmptyValue(value: number | string | null): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return !Number.isFinite(value);
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  const num = parseSaldoValue(trimmed);
  return num === null;
}

function formatKpiValue(value: number | string | null, kind: "anzahl" | "index" | "quote" = "anzahl"): string {
  if (value === null || value === undefined) return "–";
  if (typeof value === "number") {
    return formatMetric(value, { kind, ctx: "kpi", unit: "none" });
  }
  return String(value);
}

function KpiCard({ iconSrc = DEFAULT_ICON, title, value, unit }: KpiCardProps) {
  if (isEmptyValue(value)) return null;

  return (
    <div className="card border-0 shadow-sm h-100 text-center">
      <div className="card-body">
        <Image src={iconSrc} alt="" width={32} height={32} className="mb-2" />
        <div className="small text-muted">{title}</div>
        <div className="h4 mb-0">{formatKpiValue(value)}</div>
        {unit ? <div className="small text-muted">{unit}</div> : null}
      </div>
    </div>
  );
}

export function WohnmarktsituationSection(
  props: SectionPropsBase & {
    vm: WohnmarktsituationVM;
  },
) {
  const { vm, tocItems, tabs, activeTabId } = props;

  const heroImageSrc = props.assets?.heroImageSrc ?? vm.hero.imageSrc ?? "";
  const basePath = props.basePath ?? vm.basePath;

  const saldoValue = parseSaldoValue(vm.kpis.wohnungsbestandWohnraumsaldo);
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

      {/* Einleitung */}
      <section className="mb-4" id="einleitung">
        <h1 className="mt-3 mb-1">{vm.headlineMain}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.updatedAt ?? "–"}</p>
        {vm.introText ? <p className="teaser-text">{vm.introText}</p> : null}

        <BeraterBlock
          name={vm.berater.name}
          taetigkeit={vm.berater.taetigkeit}
          imageSrc={vm.berater.imageSrc}
        />
      </section>

      {/* Wohnungssaldo */}
      <section className="mb-5" id="wohnungssaldo">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="h-100" style={{ width: "90%", margin: "0 auto" }}>
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
            <div className="w-100 text-center">
              <div className="mb-2" style={{ color: "#486b7a", fontSize: "5rem" }}>
                {formatKpiValue(vm.kpis.wohnungsbestandWohnraumsaldoPer1000)}
              </div>
              <p className="mb-0">Wohnungssaldo per 1000 EW</p>
            </div>
          </div>
        </div>
      </section>

      {/* Wohnraumnachfrage */}
      <section className="mb-5" id="wohnraumnachfrage">
        <header className="mb-3">
          {vm.headlineWohnraumnachfrageIndividuell ? (
            <>
              <h2 className="h5 text-muted text-uppercase mb-1">{vm.headlineWohnraumnachfrage}</h2>
              <h3 className="h2 mb-0">{vm.headlineWohnraumnachfrageIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineWohnraumnachfrage}</h2>
          )}
        </header>

        {vm.wohnraumnachfrageText ? <p>{vm.wohnraumnachfrageText}</p> : null}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <KpiCard title="Bevölkerung" value={vm.kpis.einwohner} unit="EW" />
          </div>
          <div className="col-12 col-md-4">
            <KpiCard title="Einwohnerdichte" value={vm.kpis.einwohnerdichte} unit="EW pro km²" />
          </div>
          <div className="col-12 col-md-4">
            <KpiCard title="Siedlungsdichte" value={vm.kpis.siedlungsdichte} unit="EW pro km²" />
          </div>
        </div>

        {vm.allgemeinText ? <p>{vm.allgemeinText}</p> : null}
      </section>

      {/* Bevölkerungsentwicklung */}
      <section className="mb-5" id="bevoelkerungsentwicklung">
        <div className="row g-4">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title={`Rel. Bevölkerungsentwicklung ${vm.bevoelkerungsentwicklungBasisjahr ? `(Basisjahr: ${vm.bevoelkerungsentwicklungBasisjahr})` : ""}`}
              series={vm.bevoelkerungsentwicklungRelativ}
              kind="index"
              unitKey="none"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>

        {vm.bevoelkerungsentwicklungText ? <p className="mt-3">{vm.bevoelkerungsentwicklungText}</p> : null}
      </section>

      {/* Haushalte */}
      <section className="mb-5" id="haushalte">
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <KpiCard title="Haushalte" value={vm.kpis.haushalte} unit="Haushalte" />
          </div>
          <div className="col-12 col-md-6">
            <KpiCard title="Ø Haushaltsgröße" value={vm.kpis.haushaltsgroesse} unit="EW pro Haushalt" />
          </div>
        </div>

        {vm.haushalteText ? <p>{vm.haushalteText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Haushalte je 1000 EW"
              series={vm.haushalteJe1000}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <VergleichBarChart
              title="Haushaltsgröße nach Personenanzahl"
              categories={vm.haushaltsgroesseNachPersonenanzahl.categories}
              series={vm.haushaltsgroesseNachPersonenanzahl.bars}
              valueKind="anzahl"
              unitKey="count"
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Bevölkerungsbewegungen */}
      <section className="mb-5" id="bevoelkerungsbewegung">
        <h4>Analyse der Bevölkerungsbewegungen</h4>
        {vm.natuerlicherSaldoIntro ? <p>{vm.natuerlicherSaldoIntro}</p> : null}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <KpiCard title="Wanderungssaldo" value={vm.kpis.wanderungssaldo} unit="EW" />
          </div>
          <div className="col-12 col-md-6">
            <KpiCard title="Natürlicher Saldo" value={vm.kpis.natuerlicherSaldo} unit="EW" />
          </div>
        </div>

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
        />
      </section>

      {/* Natürlicher Saldo */}
      <section className="mb-5" id="natuerlicher-saldo">
        {vm.natuerlicherSaldoText ? <p>{vm.natuerlicherSaldoText}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <StackedComboChart
              title="Natürliches Saldo"
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
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Natürliches Saldo je 1000 EW"
              series={vm.natuerlicheBevoelkerungsbewegungJe1000}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Wanderungssaldo */}
      <section className="mb-5" id="wanderungssaldo">
        {vm.wanderungssaldoIntro ? <p>{vm.wanderungssaldoIntro}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Wanderungssaldo je 1000 EW"
              series={vm.wanderungssaldoJe1000}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>

        {vm.wanderungssaldoText ? <p className="mt-3">{vm.wanderungssaldoText}</p> : null}
      </section>

      {/* Aussenwanderungssaldo */}
      <section className="mb-5" id="aussenwanderungssaldo">
        <div className="row g-4">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
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
      </section>

      {/* Altersstruktur */}
      <section className="mb-5" id="alterstruktur">
        <h5>Analyse der Altersstrukturen</h5>
        {vm.alterstrukturText ? <p>{vm.alterstrukturText}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <DoughnutChart
              title="Altersverteilung"
              slices={vm.altersverteilung}
              valueKind="anzahl"
              unitKey="count"
              svgSize={240}
            />
          </div>
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Durchschnittliche Altersentwicklung"
              series={vm.bevoelkerungsaltersentwicklung}
              kind="index"
              unitKey="none"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Jugend- und Altenquotient */}
      <section className="mb-5" id="jugend-altenquotient">
        {vm.jugendAltenQuotientIntro ? <p>{vm.jugendAltenQuotientIntro}</p> : null}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <KpiCard title="Jugendquotient" value={vm.kpis.jugendquotient} />
          </div>
          <div className="col-12 col-md-6">
            <KpiCard title="Altenquotient" value={vm.kpis.altenquotient} />
          </div>
        </div>

        {vm.jugendAltenQuotientText ? <p>{vm.jugendAltenQuotientText}</p> : null}
      </section>

      {/* Wohnraumangebot */}
      <section className="mb-5" id="wohnraumangebot">
        <header className="mb-3">
          {vm.headlineWohnraumangebotIndividuell ? (
            <>
              <h2 className="h5 text-muted text-uppercase mb-1">{vm.headlineWohnraumangebot}</h2>
              <h3 className="h2 mb-0">{vm.headlineWohnraumangebotIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineWohnraumangebot}</h2>
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
            <KpiCard title="Flächennutzung Wohnbau" value={vm.kpis.flaecheWohnbau} unit="Hektar" />
          </div>
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <Image
                  src="/images/wohnmarktsituation/landuse-placeholder.svg"
                  alt="Flächennutzung Wohnbau"
                  width={320}
                  height={200}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </div>
        </div>

        {vm.wohnraumangebotIntro ? <p>{vm.wohnraumangebotIntro}</p> : null}

        <div className="row g-4 mt-2" id="wohnungsbestand-gebaeude">
          <div className="col-12 col-lg-4">
            <DoughnutChart
              title="Wohnungsbestand"
              slices={vm.wohnungsbestandGebaeudeverteilung}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
            {vm.kpis.wohnungsbestand ? (
              <p className="text-center mt-2 mb-0">
                <strong>{formatKpiValue(vm.kpis.wohnungsbestand)}</strong> Wohnungen insgesamt
              </p>
            ) : null}
          </div>
          <div className="col-12 col-lg-4">
            <DoughnutChart
              title="Baufertigstellungen"
              slices={vm.baufertigstellungenGebaeudeverteilung}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
            {vm.kpis.baufertigstellungen ? (
              <p className="text-center mt-2 mb-0">
                <strong>{formatKpiValue(vm.kpis.baufertigstellungen)}</strong> Wohnungen insgesamt
              </p>
            ) : null}
          </div>
          <div className="col-12 col-lg-4">
            <DoughnutChart
              title="Baugenehmigungen"
              slices={vm.baugenehmigungenGebaeudeverteilung}
              valueKind="anzahl"
              unitKey="count"
              svgSize={220}
            />
            {vm.kpis.baugenehmigungen ? (
              <p className="text-center mt-2 mb-0">
                <strong>{formatKpiValue(vm.kpis.baugenehmigungen)}</strong> Wohnungen insgesamt
              </p>
            ) : null}
          </div>
        </div>

        {vm.bautaetigkeitIntro ? <p className="mt-3">{vm.bautaetigkeitIntro}</p> : null}

        <div className="mt-3" id="bauueberhang-genehmigung-fertigstellung">
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
      </section>

      {/* Wohnraumsaldo */}
      <section className="mb-5" id="wohnraumsaldo">
        <h4>Wohnraumbestand und Wohnraumsaldo</h4>
        {vm.wohnungsbestandIntro ? <p>{vm.wohnungsbestandIntro}</p> : null}

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
            <div className="h2 mb-1">{formatKpiValue(vm.kpis.wohnungsbestandWohnraumsaldo)}</div>
            <div className="text-muted">{saldoStatus.label}</div>
          </div>
        </div>
      </section>

      {/* Wohnungsbestand Anzahl */}
      <section className="mb-5" id="wohnungsbestand-anzahl">
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <KpiCard title="Wohnungen insgesamt" value={vm.kpis.wohnungsbestandAnzahlAbsolut} unit="Wohnungen" />
          </div>
          <div className="col-12 col-md-6">
            <KpiCard title="Leerstandsquote" value={vm.kpis.leerstandsquote} />
          </div>
        </div>

        {vm.wohnungsbestandAnzahlText ? <p>{vm.wohnungsbestandAnzahlText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Wohnungsanzahl pro 1000 EW"
              series={vm.wohnungsbestandWohnungsanzahlJe1000}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Wohnfläche */}
      <section className="mb-5" id="wohnflaeche">
        {vm.wohnungsbestandWohnflaecheText ? <p>{vm.wohnungsbestandWohnflaecheText}</p> : null}

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Wohnfläche pro EW"
              series={vm.wohnungsbestandWohnflaeche}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
          <div className="col-12 col-lg-6">
            <KpiCard title="Ø Wohnfläche" value={vm.kpis.wohnungsbestandMittlereWohnflaeche} unit="m²" />
          </div>
        </div>
      </section>

      {/* Baufertigstellungen */}
      <section className="mb-5" id="baufertigstellungen">
        <h4>Baufertigstellungen</h4>
        {vm.baufertigstellungenIntro ? <p>{vm.baufertigstellungenIntro}</p> : null}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <KpiCard title="Baufertigstellungen insgesamt" value={vm.kpis.baufertigstellungenAnzahlAbsolut} unit="Wohnungen" />
          </div>
          <div className="col-12 col-md-6">
            <KpiCard title="Fertiggestellte Flächen" value={vm.kpis.baufertigstellungenFlaecheAbsolut} unit="1000 m²" />
          </div>
        </div>

        {vm.baufertigstellungenText ? <p>{vm.baufertigstellungenText}</p> : null}

        <div className="row g-4 mt-2">
          <div className="col-12 col-lg-6">
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
          <div className="col-12 col-lg-6">
            <ZeitreiheChart
              title="Baufertigstellungen pro 1000 EW"
              series={vm.baufertigstellungenWohnungsanzahlJe1000}
              kind="anzahl"
              unitKey="count"
              ctx="chart"
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Baugenehmigungen */}
      <section className="mb-5" id="baugenehmigungen">
        <h4>Baugenehmigungen</h4>
        {vm.baugenehmigungenIntro ? <p>{vm.baugenehmigungenIntro}</p> : null}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <KpiCard title="Genehmigungen" value={vm.kpis.baugenehmigungenAnzahlAbsolut} unit="Wohnungen" />
          </div>
          <div className="col-12 col-md-4">
            <KpiCard title="Flächen" value={vm.kpis.baugenehmigungenFlaecheAbsolut} unit="1000 m²" />
          </div>
          <div className="col-12 col-md-4">
            <KpiCard title="Erloschen" value={vm.kpis.baugenehmigungenErloschen} unit="Genehmigungen" />
          </div>
        </div>

        {vm.baugenehmigungenText ? <p>{vm.baugenehmigungenText}</p> : null}

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
              svgWidth={420}
              svgHeight={260}
            />
          </div>
        </div>
      </section>

      {/* Bauüberhang und Baufortschritt */}
      <section className="mb-5" id="bauueberhang-baufortschritt">
        <h4>Bauüberhang und Baufortschritt</h4>
        {vm.bauueberhangBaufortschrittText ? <p>{vm.bauueberhangBaufortschrittText}</p> : null}

        <StackedComboChart
          title="Bauüberhang und Baufortschritt (Wohnungsneubau)"
          categories={vm.bauueberhangBaufortschritt.categories}
          bars={vm.bauueberhangBaufortschritt.bars}
          lines={vm.bauueberhangBaufortschritt.lines}
          valueKind="anzahl"
          unitKey="count"
          ctx="chart"
          stacked
          svgHeight={300}
        />
      </section>

      {/* FAQ */}
      <section className="mb-5" id="faq-wohnmarktsituation">
        <h2 className="h4 mb-3">FAQ zu Standortinformationen</h2>
        <FaqSection items={faqItems} />
      </section>
    </div>
  );
}
