// features/immobilienmarkt/sections/UebersichtSection.tsx

import Link from "next/link";
import Image from "next/image";
import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";

import type { UebersichtVM } from "@/features/immobilienmarkt/selectors/shared/types/uebersicht";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";

import { GaugeTacho } from "@/components/gauge-tacho";
import { RegionHero } from "@/components/region-hero";
import { BundeslandHero } from "@/components/bundesland-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";

import { VergleichChart } from "@/components/VergleichChart";
import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import { PreisindexBox } from "@/components/PreisindexBox";

import { OrtslagenUebersichtTable } from "@/components/OrtslagenUebersichtTable";
import { PreisgrenzenRow } from "@/components/PreisgrenzenRow";

type GaugeMode = "trend" | "saldo";

// Farbendefinitionen (wie im Bestand)
const COLOR_IMMO = "rgb(75,192,192,0.6)";
const COLOR_GRUND = "rgb(72,107,122,0.6)";
const COLOR_MIETE = "rgb(200,213,79,0.6)";

const BG_IMMO = "rgba(75,192,192,0.1)";
const BG_GRUND = "rgba(72,107,122,0.1)";
const BG_MIETE = "rgba(200,213,79,0.1)";

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

// Gauge Style (aus deinem Bestand übernommen)
const GAUGE_STYLE = {
  circleR: 106,
  bg: "#f0f0f0",
  trackWidth: 16,
  tickColor: "#000",
  tickOpacity: 0.35,
  gradNeg: "#e0744f",
  gradPos: "#7fb36a",
  gradCi: "#ffe000",
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

function TrendGaugeCircle(props: {
  label: string;
  value: number;
  mode?: GaugeMode;
  extraText?: string;
}) {
  const { label, value, mode = "trend", extraText } = props;

  const C = GAUGE_STYLE.circleR;
  const W = GAUGE_STYLE.trackWidth;
  const R = C - W / 2;
  const x0 = 120 - R;
  const x1 = 120 + R;
  const y = 120;

  const gradId = `grad-${label.replace(/\s+/g, "-").toLowerCase()}-${mode}`;

  const deg = clampAngleFromPercent(value);
  const formattedValue = (value > 0 ? "+" : "") + value.toFixed(1).replace(".", ",") + " %";

  const needleColor = GAUGE_STYLE.needleColor;
  const N = GAUGE_STYLE.needle;

  const headTopY = y - (R - N.headTopInset);
  const headBaseY = y - (R - N.headBaseInset);
  const shaftY = y - (R - N.shaftTopInset);
  const shaftH = 120 - shaftY - N.hubR * 0.5;

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

        <circle cx={120} cy={120} r={C} fill={GAUGE_STYLE.bg} />

        <defs>
          <linearGradient id={gradId} x1={x0} y1={y} x2={x1} y2={y} gradientUnits="userSpaceOnUse">
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

        <g opacity={GAUGE_STYLE.tickOpacity} stroke={GAUGE_STYLE.tickColor} strokeWidth={3} strokeLinecap="round">
          <line x1={120} y1={y - (R + W / 2) - 8} x2={120} y2={y - (R + W / 2) + 10} />
          <line x1={x0 + 18} y1={y} x2={x0 + 36} y2={y} />
          <line x1={x1 - 36} y1={y} x2={x1 - 18} y2={y} />
        </g>

        <g transform={`rotate(${deg} 120 120)`}>
          <rect
            x={120 - N.shaftW / 2}
            y={shaftY}
            width={N.shaftW}
            height={shaftH}
            rx={N.shaftR}
            ry={N.shaftR}
            fill={needleColor}
          />
          <polygon points={`120,${headTopY} ${120 - 8},${headBaseY} ${120 + 8},${headBaseY}`} fill={needleColor} />
          <circle cx={120} cy={120} r={N.hubR} fill={needleColor} />
        </g>
      </svg>

      <div className="mt-2 text-center">
        <div className="fw-bold">{formattedValue}</div>
        {extraText ? <div className="small text-muted">{extraText}</div> : null}
      </div>
    </div>
  );
}

function StandortTeaserBlock(props: { regionName: string; teaserText: string; imageSrc?: string }) {
  const { regionName, teaserText, imageSrc } = props;

  return (
    <div className="card bg-transparent border-0 mb-5">
      <div className="row g-4 align-items-center">
        <div className="col-12 col-md-5 d-flex justify-content-center">
          <div
            className="shadow-sm overflow-hidden"
            style={{
              width: "100%",
              maxWidth: "400px",
              aspectRatio: "1",
              borderRadius: "50%",
              position: "relative",
            }}
          >
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={`Standort ${regionName}`}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                style={{ objectFit: "cover" }}
              />
            ) : null}
          </div>
        </div>

        <div className="col-12 col-md-7">
          <h2 className="h2 mb-3">Wohnlagencheck {regionName}</h2>
          <p className="text-muted mb-4">{teaserText}</p>
        </div>
      </div>
    </div>
  );
}

function MaklerEmpfehlungBlock(props: {
  regionName: string;
  agentSuggestText: string;
  imageSrc?: string;
  linkHref: string;
}) {
  const { regionName, agentSuggestText, imageSrc, linkHref } = props;

  return (
    <div className="card bg-transparent border-0 mb-5">
      <h2 className="h2 mb-0 align-center text-center">Maklerempfehlung {regionName}</h2>

      <div className="row g-4 align-items-center">
        <div className="col-12 col-md-5 d-flex justify-content-center">
          <div
            className="shadow-sm overflow-hidden"
            style={{
              width: "100%",
              maxWidth: "400px",
              aspectRatio: "1",
              borderRadius: "50%",
              position: "relative",
            }}
          >
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={`Maklerempfehlung ${regionName}`}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                style={{ objectFit: "cover" }}
              />
            ) : null}
          </div>
        </div>

        <div className="col-12 col-md-7">
          <p className="mb-4">{agentSuggestText}</p>
          <a href={linkHref} className="btn btn-outline-dark fw-semibold px-4 py-2">
            Maklerempfehlung
          </a>
        </div>
      </div>
    </div>
  );
}

export function UebersichtSection(
  props: SectionPropsBase & { vm: UebersichtVM },
) {
  const { vm, tocItems, tabs, activeTabId } = props;

  const orte = Array.isArray(props.ctx?.orte) ? props.ctx?.orte : [];
  const bundeslandSlug = props.ctx?.bundeslandSlug ?? "";
  const kreisSlug = props.ctx?.kreisSlug ?? "";

  const basePath = props.basePath ?? vm.basePath;
  const heroImageSrc = vm.hero.imageSrc ?? props.assets?.heroImageSrc ?? "";
  const kontaktHref =
    bundeslandSlug && kreisSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung`
      : "/immobilienmarkt";
  
  const isBundesland = vm.level === "bundesland";
  const bundeslandBerater = isBundesland ? (props.ctx?.berater ?? []) : [];
  const bundeslandMakler = isBundesland ? (props.ctx?.makler ?? []) : [];
  const kreisMapSvg = props.assets?.kreisuebersichtMapSvg ?? null;
  const heroSlidesBase = isBundesland
    ? (orte ?? []).map(
        (item) =>
          `/images/immobilienmarkt/${bundeslandSlug}/${item.slug}/immobilienmarktbericht-${item.slug}.jpg`,
      )
    : [];
  const heroSlides =
    heroSlidesBase.length > 0
      ? Array.from({ length: 5 }, (_, index) => heroSlidesBase[index % heroSlidesBase.length])
      : undefined;

  const hasStandort =
    vm.standort.bevoelkerungsdynamik !== null ||
    vm.standort.arbeitsmarktdynamik !== null ||
    vm.standort.wirtschaftskraft !== null;

  const hasVergleich =
    Array.isArray(vm.vergleich.immobilien) && vm.vergleich.immobilien.length > 0;

  const hasHistorien =
    (Array.isArray(vm.historien.immobilien) && vm.historien.immobilien.length > 0) ||
    (Array.isArray(vm.historien.grundstueck) && vm.historien.grundstueck.length > 0) ||
    (Array.isArray(vm.historien.miete) && vm.historien.miete.length > 0);

  const showOrtslagenTable = vm.level === "kreis" && Array.isArray(vm.ortslagenUebersicht) && vm.ortslagenUebersicht.length > 0;

  return (
    <div className="text-dark">
      {tocItems?.length > 0 ? <RightEdgeControls tocItems={tocItems} /> : null}

      {/* Subnavigation */}
      {!isBundesland ? (
        <TabNav tabs={tabs} activeTabId={activeTabId} basePath={basePath} parentBasePath={props.parentBasePath} />
      ) : null}

      {!isBundesland ? (
        <ImmobilienmarktBreadcrumb
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
      ) : null}

      {isBundesland ? (
        <BundeslandHero
          title={vm.hero.title}
          subtitle={vm.hero.subtitle}
          imageSrc={heroImageSrc}
          imageSrcs={heroSlides}
          mapSvg={kreisMapSvg}
          mapTheme="kreisuebersicht"
          mapMode="singleValue"
          mapKind="anzahl"
          mapUnitKey="none"
          mapCtx="kpi"
        />
      ) : (
        <div className="position-relative" style={{ overflow: "visible" }}>
          <RegionHero
            title={vm.hero.title}
            subtitle={vm.hero.subtitle}
            imageSrc={heroImageSrc}
            imageSrcs={heroSlides}
            mediaClassName={isBundesland ? "region-hero-bundesland" : undefined}
            // Für Bundesland keine Gauges/Buttons – Map kommt unten als Overlay
            rightOverlayMode={isBundesland ? undefined : "tachos"}
            rightOverlay={
              isBundesland ? null : (
                <>
                  <GaugeTacho
                    value={vm.hero.kaufmarktValue}
                    backgroundLabel="Kauf"
                    leftLabelLines={["Käufermarkt"]}
                    rightLabelLines={["Verkäufermarkt"]}
                    width={220}
                    height={135}
                  />
                  <GaugeTacho
                    value={vm.hero.mietmarktValue}
                    backgroundLabel="Miete"
                    leftLabelLines={["Mietermarkt"]}
                    rightLabelLines={["Vermietermarkt"]}
                    width={220}
                    height={135}
                  />
                </>
              )
            }
          />
        </div>
      )}

      {isBundesland ? (
        <ImmobilienmarktBreadcrumb
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
      ) : null}




      {/* Einleitung */}
      <section className="mb-3" id="einleitung">
        <h1 className="mt-3 mb-1">{vm.headlineMain}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.updatedAt ?? "–"}</p>

        {vm.teaser ? <p className="teaser-text">{vm.teaser}</p> : null}

        {!isBundesland && vm.berater.imageSrc ? (
          <BeraterBlock
            name={vm.berater.name}
            taetigkeit={vm.berater.taetigkeit}
            imageSrc={vm.berater.imageSrc}
            kontaktHref={kontaktHref}
          />
        ) : null}
      </section>

      {isBundesland && bundeslandBerater.length > 0 ? (
        <section className="mb-5" id="berater">
          <h2 className="h2 mb-4 align-center text-center">Unsere Standortberater in {vm.regionName}</h2>
          <div className="row g-4 justify-content-center">
            {bundeslandBerater.map((berater) => (
              <div key={berater.slug} className="col-12 col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <div
                      className="mx-auto mb-3"
                      style={{
                        width: "140px",
                        height: "140px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Image
                        src={berater.imageSrc}
                        alt={`Berater: ${berater.name}`}
                        fill
                        sizes="140px"
                        style={{ objectFit: "cover" }}
                      />
                    </div>

                    <h5 className="h5 mb-3">{berater.name}</h5>
                    <Link href={berater.kontaktHref} className="btn btn-outline-dark fw-semibold px-4 py-2">
                      Kontakt aufnehmen
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Standortüberblick */}
      {hasStandort ? (
        <section className="mb-5" id="standort">
          <h2 className="h2 mb-3 align-center text-center">Standortüberblick</h2>
          <p className="small text-muted mb-4 text-center">
            Die folgenden Indikatoren beschreiben die strukturelle Dynamik der Region {vm.regionName}.
          </p>

          <div className="row g-3 mb-5">
            {vm.standort.bevoelkerungsdynamik !== null ? (
              <div className="col-12 col-md-4 mb-3">
                <div className="card bg-transparent border-0">
                  <div className="card-body d-flex flex-column align-items-center">
                    <h5 className="h5 mb-3 w-100 text-start text-center">Bevölkerungsdynamik</h5>
                    <TrendGaugeCircle label="Bevölkerungsdynamik" value={vm.standort.bevoelkerungsdynamik} mode="trend" />
                  </div>
                </div>
              </div>
            ) : null}

            {vm.standort.arbeitsmarktdynamik !== null ? (
              <div className="col-12 col-md-4 mb-3">
                <div className="card bg-transparent border-0">
                  <div className="card-body d-flex flex-column align-items-center">
                    <h5 className="h5 mb-3 w-100 text-start text-center">Arbeitsmarktdynamik</h5>
                    <TrendGaugeCircle label="Arbeitsmarktdynamik" value={vm.standort.arbeitsmarktdynamik} mode="trend" />
                  </div>
                </div>
              </div>
            ) : null}

            {vm.standort.wirtschaftskraft !== null ? (
              <div className="col-12 col-md-4 mb-3">
                <div className="card bg-transparent border-0">
                  <div className="card-body d-flex flex-column align-items-center">
                    <h5 className="h5 mb-3 w-100 text-start text-center">Wirtschaftskraft</h5>
                    <TrendGaugeCircle label="Wirtschaftskraft" value={vm.standort.wirtschaftskraft} mode="trend" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {vm.texts.standortTeaser ? (
            <StandortTeaserBlock regionName={vm.regionName} teaserText={vm.texts.standortTeaser} imageSrc={vm.images.teaserImage} />
          ) : null}
        </section>
      ) : null}

      {/* Marktüberblick */}
      <section className="mb-5" id="marktueberblick">
        <h2 className="h2 mb-5 align-center text-center">Immobilienmarkt {vm.regionName} - Überblick</h2>

        {vm.standort.wohnraumsituation !== null ? (
          <>
            <h5 className="h5 mb-3 text-center">Wohnraumsituation</h5>
            <p className="small text-muted mb-3 text-center teaser-text-narrow mx-auto">
              Der Wohnungssaldo beschreibt, ob die Region tendenziell eher ein Wohnungsdefizit oder ein Wohnungsüberangebot aufweist.
            </p>

            <div className="card bg-transparent border-0 mb-5">
              <div className="card-body d-flex flex-column align-items-center">
                <TrendGaugeCircle
                  label="Wohnungssaldo"
                  value={vm.standort.wohnraumsituation}
                  mode="saldo"
                  extraText={getWohnungssaldoText(vm.standort.wohnraumsituation)}
                />
              </div>
            </div>
          </>
        ) : null}

        {/* KPI Karten */}
        <div className="row g-3 mb-0">
          <div className="col-12 col-md-4 mb-0">
            <div className="card border-0 shadow-none h-100">
              <div className="card-body text-center">
                <h5 className="h5 mb-3">Ø Immobilien-Kaufpreis</h5>
                {vm.kpis.kaufpreis !== null ? (
                  <>
                    <p className="h4 mb-4 fs-1 fw-bold">{vm.kpis.kaufpreisLabel}</p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Kaufpreisdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4 mb-0">
            <div className="card border-0 shadow-none h-100">
              <div className="card-body text-center">
                <h5 className="h5 mb-3">Ø Grundstückspreis</h5>
                {vm.kpis.grundstueckspreis !== null ? (
                  <>
                    <p className="h4 mb-4 fs-1 fw-bold">{vm.kpis.grundstueckLabel}</p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Grundstücksdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4 mb-30">
            <div className="card border-0 shadow-none h-100">
              <div className="card-body text-center">
                <h5 className="h5 mb-3 text-center">Ø Kaltmiete</h5>
                {vm.kpis.kaltmiete !== null ? (
                  <>
                    <p className="h4 mb-4 fs-1 fw-bold">{vm.kpis.kaltmieteLabel}</p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Mietdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Persönliche Markteinschätzung */}
      <section className="mb-5 bg-light p-4" id="persoenliche_markteinschaetzung">
        <h2 className="text-center my-4">
          {isBundesland ? `Markteinschätzung - ${vm.regionName}` : `Persönliche Markteinschätzung  - ${vm.regionName}`}
        </h2>
        
        {!isBundesland ? (
          <div className="card border-0 bg-transparent shadow-none h-100">
            <div className="card-body text-center">
              {vm.berater.imageSrc ? (
                <div
                  className="mx-auto mb-3"
                  style={{
                    width: "140px",
                    height: "140px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Image
                    src={vm.berater.imageSrc}
                    alt={`Berater: ${vm.berater.name}`}
                    fill
                    sizes="140px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ) : null}
            </div>

            <h5 className="h5 mb-3 text-center">{vm.berater.name}</h5>
          </div>
        ) : null}
  
        {vm.texts.individual01 ? <div style={{ margin: "2.5rem 0" }}><p>{vm.texts.individual01}</p></div> : null}

        {vm.texts.zitat ? (
          <div style={{ margin: "2.5rem 0" }}>
            <blockquote className="zitat">
              <p className="zitat-text">{vm.texts.zitat}</p>
              <footer className="zitat-footer">
                <cite className="zitat-autor">{vm.berater.name}</cite>
              </footer>
            </blockquote>
          </div>
        ) : null}

        {vm.texts.individual02 ? <div ><p>{vm.texts.individual02}</p></div> : null}
      </section>

      {/* Vergleich */}
      {hasVergleich ? (
        <section className="mb-5" id="preise-vergleich">
          <h2 className="h2 mb-3 align-center text-center">Immobilienpreise {vm.regionName} im überregionalen Vergleich</h2>

          <p className="small text-muted mb-5 text-center teaser-text-narrow mx-auto">
            Die folgenden Diagramme zeigen die Region im Vergleich zu Deutschland und dem Bundesland – jeweils auf Basis der aktuellen Angebotsdaten.
          </p>

          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-2 text-center">Immobilienpreise</h5>
                  <VergleichChart
                    title="Immobilienpreise"
                    items={vm.vergleich.immobilien}
                    barColor="rgba(75,192,192)"
                    valueKind="kaufpreis_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-2 text-center">Grundstückspreise</h5>
                  <VergleichChart
                    title="Grundstückspreise"
                    items={vm.vergleich.grundstueck}
                    barColor="rgb(72, 107, 122)"
                    valueKind="grundstueck_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h5 className="h5 mb-2 text-center">Kaltmieten</h5>
                  <VergleichChart
                    title="Kaltmieten"
                    items={vm.vergleich.miete}
                    barColor="rgba(200,213,79)"
                    valueKind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Entwicklung */}
      {hasHistorien ? (
        <section className="mb-5" id="preise-entwicklung">
          <h2 className="h2 mb-3 align-center text-center">Immobilienpreisentwicklung - {vm.regionName}</h2>

          <p className="small text-muted mb-5 text-center teaser-text-narrow mx-auto">
            Die folgenden Diagramme zeigen die Entwicklung der durchschnittlichen Immobilienpreise, Grundstückspreise und Angebotsmieten je Quadratmeter nach Kalenderjahr.
          </p>

          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="h5 mb-4 text-center">Historie Immobilien-Kaufpreise</h5>
                  <ZeitreiheChart
                    title="Immobilien-Kaufpreise"
                    ariaLabel={`Entwicklung der durchschnittlichen Kaufpreise für Wohnimmobilien in ${vm.regionName}`}
                    series={[
                      { key: "region", label: vm.regionName, points: vm.historien.immobilien, color: "rgba(75,192,192)" },
                    ]}
                    kind="kaufpreis_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                  />
                </div>
              </div>

              <div className="card border-0 shadow-sm mt-2">
                <div className="card-body">
                  <PreisindexBox
                    title="Immobilienpreisindex"
                    index={vm.preisindex.indexImmobilien}
                    basisjahr={vm.preisindex.basisjahrImmobilien}
                    color="rgba(75,192,192)"
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="h5 mb-4 text-center">Historie Grundstückspreise</h5>
                  <ZeitreiheChart
                    title="Grundstückspreise"
                    ariaLabel={`Entwicklung der durchschnittlichen Grundstückspreise in ${vm.regionName}`}
                    series={[
                      { key: "region", label: vm.regionName, points: vm.historien.grundstueck, color: "rgb(72, 107, 122)" },
                    ]}
                    kind="grundstueck_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                  />
                </div>
              </div>

              <div className="card border-0 shadow-sm mt-2">
                <div className="card-body">
                  <PreisindexBox
                    title="Grundstückspreisindex"
                    index={vm.preisindex.indexGrundstueck}
                    basisjahr={vm.preisindex.basisjahrGrundstueck}
                    color="rgb(72,107,122)"
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="h5 mb-4 text-center">Historie Angebotsmieten</h5>
                  <ZeitreiheChart
                    title="Kaltmieten"
                    ariaLabel={`Entwicklung der durchschnittlichen Angebotsmieten je Quadratmeter Wohnfläche in ${vm.regionName}`}
                    series={[
                      { key: "region", label: vm.regionName, points: vm.historien.miete, color: "rgb(200, 213, 79)" },
                    ]}
                    kind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="chart"
                  />
                </div>
              </div>

              <div className="card border-0 shadow-sm mt-2">
                <div className="card-body">
                  <PreisindexBox
                    title="Mietpreisindex"
                    index={vm.preisindex.indexMiete}
                    basisjahr={vm.preisindex.basisjahrMiete}
                    color="rgb(200,213,79)"
                  />
                </div>
              </div>
            </div>
          </div>

          {vm.texts.beschreibung01 ? <div><p className="my-5 w-75 mx-auto">{vm.texts.beschreibung01}</p></div> : null}
        </section>
      ) : null}

      {/* Ortslagen Tabelle */}
      {showOrtslagenTable ? (
        <section className="mb-5" id="ortslagen-tabelle">
          <h2 className="h2 mb-3 align-center text-center">Ortslagen-Preise und Vorjahresveränderung</h2>

          <p className="small text-muted mb-3 text-center teaser-text-narrow mx-auto">
            Die Tabelle zeigt die durchschnittlichen Immobilienpreise, Grundstückspreise und Angebotsmieten je Quadratmeter
            für die erfassten Ortslagen – jeweils inklusive prozentualer Veränderung gegenüber dem Vorjahr.
          </p>

          <OrtslagenUebersichtTable
            rows={vm.ortslagenUebersicht}
            orte={orte}
            bundeslandSlug={bundeslandSlug}
            kreisSlug={kreisSlug}
            colorImmo={COLOR_IMMO}
            colorGrund={COLOR_GRUND}
            colorMiete={COLOR_MIETE}
            bgImmo={BG_IMMO}
            bgGrund={BG_GRUND}
            bgMiete={BG_MIETE}
            ctx="table"
          />

          {vm.texts.beschreibung02 ? <div style={{ margin: "2.5rem 0" }}><p className="my-5 w-75 mx-auto">{vm.texts.beschreibung02}</p></div> : null}
        </section>
      ) : null}

      {/* Preisspannen (nur wenn vorhanden) */}
      {(vm.preisgrenzen.immobilie || vm.preisgrenzen.grund || vm.preisgrenzen.miete) ? (
        <section className="mb-5" id="preisspannen">
          <h2 className="h2 mb-3 align-center text-center">Wo ist es teuer und wo preiswert(er)?</h2>

          <div className="row g-4">
            {vm.preisgrenzen.immobilie ? (
              <div className="col-12">
                <PreisgrenzenRow
                  color={COLOR_IMMO}
                  iconLabel="K"
                  valueKind="kaufpreis_qm"
                  unitKey="eur_per_sqm"
                  cheapestName={vm.preisgrenzen.immobilie.cheapestName}
                  cheapestValue={vm.preisgrenzen.immobilie.cheapestValue}
                  priciestName={vm.preisgrenzen.immobilie.priciestName}
                  priciestValue={vm.preisgrenzen.immobilie.priciestValue}
                />
              </div>
            ) : null}

            {vm.preisgrenzen.grund ? (
              <div className="col-12">
                <PreisgrenzenRow
                  color={COLOR_GRUND}
                  iconLabel="B"
                  valueKind="grundstueck_qm"
                  unitKey="eur_per_sqm"
                  cheapestName={vm.preisgrenzen.grund.cheapestName}
                  cheapestValue={vm.preisgrenzen.grund.cheapestValue}
                  priciestName={vm.preisgrenzen.grund.priciestName}
                  priciestValue={vm.preisgrenzen.grund.priciestValue}
                />
              </div>
            ) : null}

            {vm.preisgrenzen.miete ? (
              <div className="col-12">
                <PreisgrenzenRow
                  color={COLOR_MIETE}
                  iconLabel="M"
                  valueKind="miete_qm"
                  unitKey="eur_per_sqm"
                  cheapestName={vm.preisgrenzen.miete.cheapestName}
                  cheapestValue={vm.preisgrenzen.miete.cheapestValue}
                  priciestName={vm.preisgrenzen.miete.priciestName}
                  priciestValue={vm.preisgrenzen.miete.priciestValue}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Kaufnebenkosten */}
      {vm.texts.marketBasicKnowledge ? (
        <section className="mb-5" id="kaufnebenkosten">
          <div className="mb-5">
            <h2 className="h2 mb-3 align-center text-center">Kaufnebenkosten in {vm.regionName}</h2>
            <p className="my-5 w-75 mx-auto">{vm.texts.marketBasicKnowledge}</p>
          </div>
        </section>
      ) : null}

      {/* Maklerempfehlung */}
      {vm.texts.agentSuggest ? (
        <section className="mb-5" id="maklerempfehlung">
          {isBundesland ? (
            <>
              <h2 className="h2 mb-4 align-center text-center">WOHNLAGENCHECK24 Maklerempfehlungen<br />für {vm.regionName}</h2>
              <div className="mb-5">
                <p className="my-5 w-75 mx-auto">{vm.texts.agentSuggest}</p>
              </div>

              {bundeslandMakler.length > 0 ? (
                <div className="row g-4 justify-content-center">
                  {bundeslandMakler.map((makler) => (
                    <div key={makler.slug} className="col-12 col-md-6 col-lg-4">
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                          <div
                            className="mx-auto mb-3"
                            style={{
                              width: "140px",
                              height: "140px",
                              borderRadius: "50%",
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            <Image
                              src={makler.imageSrc}
                              alt={`Makler: ${makler.name}`}
                              fill
                              sizes="140px"
                              style={{ objectFit: "cover" }}
                            />
                          </div>

                          <h5 className="h5 mb-3">{makler.name}</h5>
                          <Link href={makler.kontaktHref} className="btn btn-outline-dark fw-semibold px-4 py-2">
                            Kontakt aufnehmen
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <MaklerEmpfehlungBlock
              regionName={vm.regionName}
              agentSuggestText={vm.texts.agentSuggest}
              imageSrc={vm.images.agentSuggestImage}
              linkHref={
                bundeslandSlug && kreisSlug
                  ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmakler`
                  : "/immobilienmarkt"
              }
            />
          )}
        </section>
      ) : null}

      {/* Erfasste Wohnlagen (nur Kreis) */}
      <section className="mb-4" id="wohnlagen">
        <h2 className="h2 mb-3 align-center text-center">
          {isBundesland ? `Erfasste Kreise – ${vm.regionName}` : `Erfasste Wohnlagen – ${vm.regionName}`}
        </h2>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <nav className="nav nav-pills flex-wrap gap-2 justify-content-center" aria-label="Navigation">
              {(orte ?? []).map((item) => {
                const href = isBundesland
                  ? `/immobilienmarkt/${bundeslandSlug}/${item.slug}`
                  : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${item.slug}`;

                return (
                  <Link
                    key={item.slug}
                    href={href}
                    className="nav-link px-3 py-2 rounded-pill fw-semibold small bg-light text-dark"
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {(orte ?? []).length === 0 ? (
              <p className="small text-muted mb-0 text-center">
                {isBundesland
                  ? "Für dieses Bundesland liegen noch keine Kreise vor."
                  : "Für diesen Landkreis liegen noch keine einzelnen Wohnlagen vor."}
              </p>
            ) : null}
          </div>
        </div>
      </section>
      
    </div>
  );
}
