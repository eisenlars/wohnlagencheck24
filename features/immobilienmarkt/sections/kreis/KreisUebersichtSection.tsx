import Link from "next/link";

import { GaugeTacho } from "@/components/gauge-tacho";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";

import { VergleichChart } from "@/components/VergleichChart";
import { ZeitreiheChart } from "@/components/ZeitreiheChart";
import { PreisindexBox } from "@/components/PreisindexBox";

import {
  OrtslagenUebersichtTable,
} from "@/components/OrtslagenUebersichtTable";

import { PreisgrenzenRow } from "@/components/PreisgrenzenRow";

import type { TocItem } from "../../config/kreisSections";
import type { KreisUebersichtVM } from "../../selectors/kreis/uebersicht";

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
  const shaftH = (120 - shaftY) - N.hubR * 0.5;

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

        <g
          opacity={GAUGE_STYLE.tickOpacity}
          stroke={GAUGE_STYLE.tickColor}
          strokeWidth={3}
          strokeLinecap="round"
        >
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
          <polygon
            points={`120,${headTopY} ${120 - 8},${headBaseY} ${120 + 8},${headBaseY}`}
            fill={needleColor}
          />
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

function StandortTeaserBlock(props: { kreisName: string; teaserText: string; imageSrc?: string }) {
  const { kreisName, teaserText, imageSrc } = props;

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
            }}
          >
            <img src={imageSrc} alt={`Standort ${kreisName}`} className="w-100 h-100 object-fit-cover" />
          </div>
        </div>

        <div className="col-12 col-md-7">
          <h2 className="h2 mb-3">Wohnlagencheck {kreisName}</h2>
          <p className="text-muted mb-4">{teaserText}</p>
          <a href="/wohnlagencheck" className="btn btn-outline-dark fw-semibold px-4 py-2">
            Wohnlagencheck
          </a>
        </div>
      </div>
    </div>
  );
}

function MaklerEmpfehlungBlock(props: { kreisName: string; agentSuggestText: string; imageSrc?: string }) {
  const { kreisName, agentSuggestText, imageSrc } = props;

  return (
    <div className="card bg-transparent border-0 mb-5">
      <h2 className="h2 mb-0 align-center text-center">Maklerempfehlung {kreisName}</h2>

      <div className="row g-4 align-items-center">
        <div className="col-12 col-md-5 d-flex justify-content-center">
          <div
            className="shadow-sm overflow-hidden"
            style={{
              width: "100%",
              maxWidth: "400px",
              aspectRatio: "1",
              borderRadius: "50%",
            }}
          >
            <img src={imageSrc} alt={`Maklerempfehlung ${kreisName}`} className="w-100 h-100 object-fit-cover" />
          </div>
        </div>

        <div className="col-12 col-md-7">
          <p className="mb-4">{agentSuggestText}</p>
          <a href="/makler" className="btn btn-outline-dark fw-semibold px-4 py-2">
            Maklerempfehlung
          </a>
        </div>
      </div>
    </div>
  );
}

export function KreisUebersichtSection(props: {
  vm: KreisUebersichtVM;
  tocItems: TocItem[];
  tabs: { id: string; label: string; iconSrc: string }[];
  activeTabId: string; // "uebersicht"
  orte: { slug: string; name: string; plz?: string }[];
  bundeslandSlug: string;
  kreisSlug: string;
}) {
  const { vm, tocItems, tabs, activeTabId, orte, bundeslandSlug, kreisSlug } = props;

  return (
    <div className="text-dark">
      {tocItems.length > 0 ? <RightEdgeControls tocItems={tocItems} /> : null}

      {/* Subnavigation */}
      <section className="kreis-subnav kreis-subnav-sticky mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <div className="kreis-subnav-tabs-wrapper w-100">
            <ul className="nav nav-pills flex-nowrap small kreis-subnav-tabs">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const href = tab.id === "uebersicht" ? vm.basePath : `${vm.basePath}/${tab.id}`;

                return (
                  <li className="nav-item" key={tab.id}>
                    <Link
                      href={href}
                      className={
                        "nav-link d-flex flex-column align-items-center justify-content-center gap-2 rounded-pill kreis-subnav-link" +
                        (isActive ? " active bg-dark text-white" : " bg-light text-dark border-0")
                      }
                      aria-current={isActive ? "page" : undefined}
                    >
                      <img src={tab.iconSrc} alt="" aria-hidden="true" className="subnav-icon-img" />
                      <span className="subnav-label">{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <RegionHero
        title={vm.hero.title}
        subtitle={vm.hero.subtitle}
        imageSrc={vm.hero.imageSrc}
        rightOverlayMode="tachos"
        rightOverlay={
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
        }
      />

      {/* Einleitung */}
      <section className="mb-3" id="einleitung">
        <h1 className="mt-3 mb-1">Standort & Immobilienmarkt 2025 {vm.kreisName}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.kreisName}</p>

        {vm.texts.teaser ? <p className="teaser-text">{vm.texts.teaser}</p> : null}

        <BeraterBlock
          name={vm.berater.name}
          taetigkeit={vm.berater.taetigkeit}
          imageSrc={vm.berater.imageSrc}
        />
      </section>

      {/* Standortüberblick */}
      {(vm.standort.bevoelkerungsdynamik !== null ||
        vm.standort.arbeitsmarktdynamik !== null ||
        vm.standort.wirtschaftskraft !== null) ? (
        <section className="mb-5" id="standort">
          <h2 className="h2 mb-3 align-center text-center">Standortüberblick</h2>
          <p className="small text-muted mb-4 text-center">
            Die folgenden Indikatoren beschreiben die strukturelle Dynamik des Kreises {vm.kreisName}.
          </p>

          <div className="row g-3 mb-5">
            {vm.standort.bevoelkerungsdynamik !== null ? (
              <div className="col-12 col-md-4 mb-3">
                <div className="card bg-transparent border-0">
                  <div className="card-body d-flex flex-column align-items-center">
                    <h5 className="h5 mb-3 w-100 text-start text-center">Bevölkerungsdynamik</h5>
                    <TrendGaugeCircle
                      label="Bevölkerungsdynamik"
                      value={vm.standort.bevoelkerungsdynamik}
                      mode="trend"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {vm.standort.arbeitsmarktdynamik !== null ? (
              <div className="col-12 col-md-4 mb-3">
                <div className="card bg-transparent border-0">
                  <div className="card-body d-flex flex-column align-items-center">
                    <h5 className="h5 mb-3 w-100 text-start text-center">Arbeitsmarktdynamik</h5>
                    <TrendGaugeCircle
                      label="Arbeitsmarktdynamik"
                      value={vm.standort.arbeitsmarktdynamik}
                      mode="trend"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {vm.standort.wirtschaftskraft !== null ? (
              <div className="col-12 col-md-4 mb-3">
                <div className="card bg-transparent border-0">
                  <div className="card-body d-flex flex-column align-items-center">
                    <h5 className="h5 mb-3 w-100 text-start text-center">Wirtschaftskraft</h5>
                    <TrendGaugeCircle
                      label="Wirtschaftskraft"
                      value={vm.standort.wirtschaftskraft}
                      mode="trend"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {vm.texts.standortTeaser ? (
            <StandortTeaserBlock
              kreisName={vm.kreisName}
              teaserText={vm.texts.standortTeaser}
              imageSrc={vm.images.teaserImage}
            />
          ) : null}
        </section>
      ) : null}

      {/* Marktüberblick */}
      <section className="mb-5" id="marktueberblick">
        <h2 className="h2 mb-5 align-center text-center">Immobilienmarkt {vm.kreisName} - Überblick</h2>

        {vm.standort.wohnraumsituation !== null ? (
          <>
            <h5 className="h5 mb-3 text-center">Wohnraumsituation</h5>
            <p className="small text-muted mb-3 text-center teaser-text-narrow mx-auto">
              Der Wohnungssaldo beschreibt, ob die Region tendenziell eher ein Wohnungsdefizit
              oder ein Wohnungsüberangebot aufweist.
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
        <div className="row g-3 mb-5">
          <div className="col-12 col-md-4 mb-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <h5 className="h5 mb-3">Ø Immobilien-Kaufpreis</h5>
                {vm.kpis.kaufpreis !== null ? (
                  <>
                    <p className="h4 mb-4 fs-1 fw-bold">{vm.kpis.kaufpreisLabel}</p>
                    <p className="small text-muted mb-4">
                      <a href="/immobilienpreise" className="btn btn-outline-dark fw-semibold px-4 py-2">
                        Immobilien-Kaufpreise
                      </a>
                    </p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Kaufpreisdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4 mb-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <h5 className="h5 mb-3">Ø Grundstückspreis</h5>
                {vm.kpis.grundstueckspreis !== null ? (
                  <>
                    <p className="h4 mb-4 fs-1 fw-bold">{vm.kpis.grundstueckLabel}</p>
                    <p className="small text-muted mb-4">
                      <a href="/grundstueckspreise" className="btn btn-outline-dark fw-semibold px-4 py-2">
                        Grundstückspreise
                      </a>
                    </p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Grundstücksdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4 mb-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body text-center">
                <h5 className="h5 mb-3 text-center">Ø Kaltmiete</h5>
                {vm.kpis.kaltmiete !== null ? (
                  <>
                    <p className="h4 mb-4 fs-1 fw-bold">{vm.kpis.kaltmieteLabel}</p>
                    <p className="small text-muted mb-4">
                      <a href="/mietpreise" className="btn btn-outline-dark fw-semibold px-4 py-2">
                        Mietpreise
                      </a>
                    </p>
                  </>
                ) : (
                  <p className="small text-muted mb-0">Keine Mietdaten verfügbar.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {vm.texts.individual01 ? (
          <div style={{ margin: "2.5rem 0" }}>
            <p>{vm.texts.individual01}</p>
          </div>
        ) : null}

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

        {vm.texts.individual02 ? (
          <div style={{ margin: "2.5rem 0" }}>
            <p>{vm.texts.individual02}</p>
          </div>
        ) : null}
      </section>

      {/* Vergleich */}
      <section className="mb-5" id="preise-vergleich">
        <h2 className="h2 mb-3 align-center text-center">
          Immobilienpreise {vm.kreisName} im überregionalen Vergleich
        </h2>

        <p className="small text-muted mb-5 text-center teaser-text-narrow mx-auto">
          Die folgenden Diagramme zeigen den Landkreis im Vergleich zu Deutschland und dem Bundesland – jeweils auf Basis
          der aktuellen Angebotsdaten.
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

      {/* Entwicklung */}
      <section className="mb-5" id="preise-entwicklung">
        <h2 className="h2 mb-3 align-center text-center">Immobilienpreisentwicklung - {vm.kreisName}</h2>

        <p className="small text-muted mb-5 text-center teaser-text-narrow mx-auto">
          Die folgenden Diagramme zeigen die Entwicklung der durchschnittlichen Immobilienpreise, Grundstückspreise und
          Angebotsmieten je Quadratmeter im Landkreis {vm.kreisName} nach Kalenderjahr.
        </p>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h5 className="h5 mb-4 text-center">Historie Immobilien-Kaufpreise</h5>
                <ZeitreiheChart
                  title="Immobilien-Kaufpreise"
                  ariaLabel={`Entwicklung der durchschnittlichen Kaufpreise für Wohnimmobilien im Kreis ${vm.kreisName}`}
                  series={[
                    {
                      key: "kreis",
                      label: vm.kreisName,
                      points: vm.historien.immobilien,
                      color: "rgba(75,192,192)",
                    },
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
                  ariaLabel={`Entwicklung der durchschnittlichen Grundstückspreise im Landkreis ${vm.kreisName}`}
                  series={[
                    {
                      key: "kreis",
                      label: vm.kreisName,
                      points: vm.historien.grundstueck,
                      color: "rgb(72, 107, 122)",
                    },
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
                  ariaLabel={`Entwicklung der durchschnittlichen Angebotsmieten je Quadratmeter Wohnfläche im Landkreis ${vm.kreisName}`}
                  series={[
                    {
                      key: "kreis",
                      label: vm.kreisName,
                      points: vm.historien.miete,
                      color: "rgb(200, 213, 79)",
                    },
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

        {vm.texts.beschreibung01 ? (
          <div style={{ margin: "2.5rem 0" }}>
            <p>{vm.texts.beschreibung01}</p>
          </div>
        ) : null}
      </section>

      {/* Ortslagen Tabelle */}
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

        {vm.texts.beschreibung02 ? (
          <div style={{ margin: "2.5rem 0" }}>
            <p>{vm.texts.beschreibung02}</p>
          </div>
        ) : null}
      </section>

      {/* Preisspannen */}
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

      {/* Wissen + Makler */}
      <section className="mb-5" id="maklerempfehlung">
        {vm.texts.marketBasicKnowledge ? (
          <div className="mb-5">
            <p>{vm.texts.marketBasicKnowledge}</p>
          </div>
        ) : null}

        {vm.texts.agentSuggest ? (
          <MaklerEmpfehlungBlock
            kreisName={vm.kreisName}
            agentSuggestText={vm.texts.agentSuggest}
            imageSrc={vm.images.agentSuggestImage}
          />
        ) : null}
      </section>

      {/* Erfasste Wohnlagen */}
      <section className="mb-4" id="wohnlagen">
        <h2 className="h2 mb-3 align-center text-center">Erfasste Wohnlagen – {vm.kreisName}</h2>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <nav className="nav nav-pills flex-wrap gap-2 justify-content-center" aria-label="Wohnlagen Navigation">
              {orte.map((ort) => (
                <Link
                  key={ort.slug}
                  href={`/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ort.slug}`}
                  className="nav-link px-3 py-2 rounded-pill fw-semibold small bg-light text-dark"
                >
                  {ort.name}
                  {ort.plz ? <span className="ms-2 text-muted fw-normal">({ort.plz})</span> : null}
                </Link>
              ))}
            </nav>

            {orte.length === 0 ? (
              <p className="small text-muted mb-0 text-center">
                Für diesen Landkreis liegen noch keine einzelnen Wohnlagen vor.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
