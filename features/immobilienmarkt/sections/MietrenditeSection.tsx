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
import { FaqSection } from "@/components/FaqSection";

import { FAQ_IMMOBILIENMARKT_ALLGEMEIN } from "@/content/faqs";

import type { MietrenditeVM } from "@/features/immobilienmarkt/selectors/shared/types/mietrendite";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";

export function MietrenditeSection(
  props: SectionPropsBase & {
    vm: MietrenditeVM;
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

      <TabNav tabs={tabs} activeTabId={activeTabId} basePath={basePath} parentBasePath={props.parentBasePath} />

      <RegionHero
        title={vm.hero.title}
        subtitle={vm.hero.subtitle}
        imageSrc={heroImageSrc}
        rightOverlay={<HeroOverlayActions variant="immo" />}
        rightOverlayMode="buttons"
      />

      {/* Einleitung */}
      <section className="mb-3" id="einleitung">
        <h1 className="mt-3 mb-1">{vm.headlineMain}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.updatedAt ?? "–"}</p>

        {vm.introText ? <p className="teaser-text">{vm.introText}</p> : null}

        <BeraterBlock
          name={vm.berater.name}
          taetigkeit={vm.berater.taetigkeit}
          imageSrc={vm.berater.imageSrc}
        />
      </section>

      {/* Kaufpreisfaktor + Gesamt-KPI */}
      <section className="mb-5" id="kaufpreisfaktor-gesamt">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="h-100" style={{ width: "90%", margin: "0 auto" }}>
              {props.assets?.kaufpreisfaktorMapSvg ? (
                <InteractiveMap
                  svg={props.assets?.kaufpreisfaktorMapSvg}
                  theme="kaufpreisfaktor"
                  mode="singleValue"
                  kind="index"
                  unitKey="none"
                  ctx="kpi"
                />
              ) : (
                <p className="small text-muted mb-0">
                  Für diesen Landkreis liegt aktuell noch keine interaktive Kaufpreisfaktor-Karte vor.
                </p>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-6 d-flex align-items-center">
            <div className="w-100 text-center">
              {vm.gesamt.kaufpreisfaktor !== null ? (
                <>
                  <div className="mb-2" style={{ color: "#486b7a", fontSize: "7rem" }}>
                    <KpiValue
                      value={vm.gesamt.kaufpreisfaktor}
                      kind="index"
                      unitKey="none"
                      ctx="kpi"
                      size="ultra"
                      showUnit={false}
                    />
                  </div>
                  <p className="mb-0">Ø Kaufpreisfaktor – {vm.regionName}</p>
                </>
              ) : (
                <p className="small text-muted mb-0">Keine Kaufpreisfaktor-Daten verfügbar.</p>
              )}
            </div>
          </div>
        </div>

        {vm.kaufpreisfaktorText ? <p className="mt-3 mb-0">{vm.kaufpreisfaktorText}</p> : null}
      </section>

      {/* Kaufpreisfaktor-Entwicklung */}
      <section className="mb-5" id="kaufpreisfaktor-entwicklung">
        <h2 className="h5 text-muted mb-1">Kaufpreisfaktor-Entwicklung</h2>
        <ZeitreiheChart
          title="Kaufpreisfaktor-Entwicklung"
          series={vm.kaufpreisfaktorSeries}
          kind="index"
          unitKey="none"
          ctx="chart"
          svgWidth={640}
          svgHeight={320}
        />
      </section>

      {/* Allgemein */}
      <section className="mb-5" id="rendite-allgemein">
        <header className="mb-3">
          {vm.headlineBruttoNettoIndividuell ? (
            <>
              <h2 className="h5 text-muted text-uppercase mb-1">{vm.headlineBruttoNetto}</h2>
              <h3 className="h2 mb-0">{vm.headlineBruttoNettoIndividuell}</h3>
            </>
          ) : (
            <h2 className="h2 mb-0">{vm.headlineBruttoNetto}</h2>
          )}
        </header>

        {vm.allgemeinText ? <p className="mb-3">{vm.allgemeinText}</p> : null}

        <div className="text-center">
          <KpiValue
            icon="/icons/ws24_marktbericht_mietrendite.svg"
            items={[
              { label: "Bruttomietrendite", value: vm.gesamt.bruttomietrendite, kind: "quote", unitKey: "percent" },
              { label: "Nettomietrendite", value: vm.gesamt.nettomietrendite, kind: "quote", unitKey: "percent" },
            ]}
            ctx="kpi"
            size="md"
            highlightBg="transparent"
            highlightValueColor="#486b7a"
            normalValueColor="#6c757d"
          />
        </div>
      </section>

      {/* Hinweis */}
      <section className="mb-5" id="rendite-hinweis">
        {vm.hinweisText ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h3 className="h5 text-primary mb-2">Praxiswissen-Hinweis</h3>
              <p className="mb-0">{vm.hinweisText}</p>
            </div>
          </div>
        ) : null}
      </section>

      {/* ETW */}
      <section className="mb-5" id="rendite-etw">
        <h3 className="h5 text-muted mb-1">Mietrendite Eigentumswohnungen</h3>
        {vm.etwText ? <p className="mb-3">{vm.etwText}</p> : null}

        <KpiValue
          icon="/icons/ws24_marktbericht_mietrendite.svg"
          items={[
            { label: "Brutto", value: vm.etw.brutto, kind: "quote", unitKey: "percent" },
            { label: "Kaufpreisfaktor", value: vm.etw.kaufpreisfaktor, kind: "index", unitKey: "none", highlight: true },
            { label: "Netto", value: vm.etw.netto, kind: "quote", unitKey: "percent" },
          ]}
          ctx="kpi"
          size="md"
          highlightBg="transparent"
          highlightValueColor="#486b7a"
          normalValueColor="#6c757d"
        />

        {vm.etw.table ? (
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <MatrixTable model={vm.etw.table} headerBg="#f5f5f5" />
            </div>
          </div>
        ) : (
          <p className="small text-muted mb-0">Keine ETW-Detaildaten verfügbar.</p>
        )}
      </section>

      {/* EFH */}
      <section className="mb-5" id="rendite-efh">
        <h3 className="h5 text-muted mb-1">Mietrendite Einfamilienhäuser</h3>
        {vm.efhText ? <p className="mb-3">{vm.efhText}</p> : null}

        <KpiValue
          icon="/icons/ws24_marktbericht_mietrendite.svg"
          items={[
            { label: "Brutto", value: vm.efh.brutto, kind: "quote", unitKey: "percent" },
            { label: "Kaufpreisfaktor", value: vm.efh.kaufpreisfaktor, kind: "index", unitKey: "none", highlight: true },
            { label: "Netto", value: vm.efh.netto, kind: "quote", unitKey: "percent" },
          ]}
          ctx="kpi"
          size="md"
          highlightBg="transparent"
          highlightValueColor="#486b7a"
          normalValueColor="#6c757d"
        />

        {vm.efh.table ? (
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <MatrixTable model={vm.efh.table} headerBg="#f5f5f5" />
            </div>
          </div>
        ) : (
          <p className="small text-muted mb-0">Keine EFH-Detaildaten verfügbar.</p>
        )}
      </section>

      {/* MFH */}
      <section className="mb-5" id="rendite-mfh">
        <h3 className="h5 text-muted mb-1">Mietrendite Mehrfamilienhäuser</h3>
        {vm.mfhText ? <p className="mb-3">{vm.mfhText}</p> : null}

        <KpiValue
          icon="/icons/ws24_marktbericht_mietrendite.svg"
          items={[
            { label: "Brutto", value: vm.mfh.brutto, kind: "quote", unitKey: "percent" },
            { label: "Kaufpreisfaktor", value: vm.mfh.kaufpreisfaktor, kind: "index", unitKey: "none", highlight: true },
            { label: "Netto", value: vm.mfh.netto, kind: "quote", unitKey: "percent" },
          ]}
          ctx="kpi"
          size="md"
          highlightBg="transparent"
          highlightValueColor="#486b7a"
          normalValueColor="#6c757d"
        />

        {vm.mfh.table ? (
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <MatrixTable model={vm.mfh.table} headerBg="#f5f5f5" />
            </div>
          </div>
        ) : (
          <p className="small text-muted mb-0">Keine MFH-Detaildaten verfügbar.</p>
        )}
      </section>

      {/* Brutto-Mietrendite-Entwicklung */}
      <section className="mb-5" id="brutto-entwicklung">
        <h2 className="h5 text-muted mb-1">Bruttomietrendite-Entwicklung</h2>
        <ZeitreiheChart
          title="Bruttomietrendite-Entwicklung"
          series={vm.bruttoRenditeSeries}
          kind="quote"
          unitKey="percent"
          ctx="chart"
          svgWidth={640}
          svgHeight={320}
        />
      </section>

      {/* FAQ */}
      <section className="mb-5" id="faq-mietrendite">
        <FaqSection id="faq" title={`FAQ – Mietrendite ${vm.regionName}`} items={FAQ_IMMOBILIENMARKT_ALLGEMEIN} />
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
                      {ort.plz ? (
                        <span className={`ms-2 fw-normal ${isActive ? "text-white-50" : "text-muted"}`}>
                          ({ort.plz})
                        </span>
                      ) : null}
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
