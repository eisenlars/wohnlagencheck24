import Image from "next/image";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

import { asArray, asRecord, asString } from "@/utils/records";
import { buildWebAssetUrl } from "@/utils/assets";
import type { Report } from "@/lib/data";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import type { RegionalReference } from "@/lib/referenzen";
import { ReferenceExperienceMap } from "@/components/referenzen/ReferenceExperienceMap";
import { RegionImageGallery } from "@/components/immobilienmarkt/RegionImageGallery";
import type { Offer } from "@/lib/angebote";
import type { RegionalRequest } from "@/lib/gesuche";
import { buildNewMarketingBadge } from "@/lib/offer-marketing-flags";
import { slugifyOfferTitle, slugifyRequestTitle } from "@/utils/slug";

type ImmobilienmaklerSectionProps = {
  report: Report;
  bundeslandSlug: string;
  kreisSlug: string;
  basePath: string;
  references?: RegionalReference[];
  featuredBuyOffer?: Offer | null;
  featuredRentOffer?: Offer | null;
  featuredBuyRequest?: RegionalRequest | null;
  featuredRentRequest?: RegionalRequest | null;
};

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return null;
}

function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "").trim();
  if (!compact) return null;
  try {
    const parsed = new URL(compact);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function formatCurrency(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatArea(value: number | null): string | null {
  if (value === null) return null;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} m²`;
}

function formatObjectType(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "haus") return "Haus";
  if (normalized === "wohnung") return "Wohnung";
  return normalized || "Immobilie";
}

function buildOfferHref(basePath: string, offer: Offer): string {
  const segment = offer.offerType === "miete" ? "mietangebote" : "immobilienangebote";
  return `${basePath}/${segment}/${offer.id}_${slugifyOfferTitle(offer.title)}`;
}

function buildOfferListHref(basePath: string, offerType: "kauf" | "miete"): string {
  return `${basePath}/${offerType === "miete" ? "mietangebote" : "immobilienangebote"}`;
}

function buildRequestHref(basePath: string, request: RegionalRequest): string {
  const segment = request.requestType === "miete" ? "mietgesuche" : "immobiliengesuche";
  return `${basePath}/${segment}/${request.id}_${slugifyRequestTitle(request.title)}`;
}

function buildRequestListHref(basePath: string, requestType: "kauf" | "miete"): string {
  return `${basePath}/${requestType === "miete" ? "mietgesuche" : "immobiliengesuche"}`;
}

function hasNewOfferBadge(offer: Offer): boolean {
  return (offer.marketingBadges ?? []).some((badge) => badge.key === "new");
}

function shouldShowNewOfferBadge(offer: Offer): boolean {
  return hasNewOfferBadge(offer) || Boolean(buildNewMarketingBadge(offer.updatedAt));
}

function NewImageBadge() {
  return (
    <span
      className="badge text-bg-warning position-absolute top-0 start-0 m-2"
      style={{ zIndex: 2, width: "auto", height: "auto", display: "inline-flex" }}
    >
      NEU
    </span>
  );
}

function MarketOfferCard(props: {
  offer: Offer;
  detailHref: string;
  listHref: string;
  detailLabel: string;
  listLabel: string;
}) {
  const { offer, detailHref, listHref, detailLabel, listLabel } = props;
  const imageSrc = sanitizeImageUrl(offer.imageUrl);
  const showNewBadge = shouldShowNewOfferBadge(offer);

  return (
    <article className="card border-0 bg-light rounded-4 h-100 overflow-hidden">
      {imageSrc ? (
        <a href={detailHref} className="ratio ratio-16x9 d-block position-relative">
          {showNewBadge ? <NewImageBadge /> : null}
          <Image
            src={imageSrc}
            alt={offer.title}
            fill
            sizes="(min-width: 992px) 40vw, 100vw"
            className="object-fit-cover"
          />
        </a>
      ) : null}
      <div className="card-body p-3">
        <div className="d-flex flex-wrap gap-2 mb-2">
          <span className="badge rounded-pill text-bg-light border">{formatObjectType(offer.objectType)}</span>
          <span className="badge rounded-pill text-bg-light border">
            {offer.offerType === "miete" ? "Mietangebot" : "Kaufangebot"}
          </span>
        </div>
        <h3 className="h6 mb-2">
          <a href={detailHref} className="link-dark text-decoration-none">
            {offer.title}
          </a>
        </h3>
        <p className="text-body-secondary mb-3">
          {[formatCurrency(offer.offerType === "miete" ? offer.rent : offer.price), formatArea(offer.areaSqm)]
            .filter(Boolean)
            .join(" · ") || "Details auf Anfrage"}
        </p>
        <div className="d-flex flex-wrap gap-2">
          <a href={detailHref} className="btn btn-outline-dark btn-sm">
            {detailLabel}
          </a>
          <a href={listHref} className="btn btn-light border btn-sm fw-semibold">
            {listLabel}
          </a>
        </div>
      </div>
    </article>
  );
}

function MarketRequestCard(props: {
  request: RegionalRequest;
  detailHref: string;
  listHref: string;
  detailLabel: string;
  listLabel: string;
}) {
  const { request, detailHref, listHref, detailLabel, listLabel } = props;
  const imageSrc = request.imageUrl;
  const showNewBadge = Boolean(buildNewMarketingBadge(request.updatedAt));

  return (
    <article className="card border-0 bg-light rounded-4 h-100 overflow-hidden">
      {imageSrc ? (
        <a href={detailHref} className="ratio ratio-16x9 d-block position-relative">
          {showNewBadge ? <NewImageBadge /> : null}
          <Image
            src={imageSrc}
            alt={request.imageAlt ?? request.imageTitle ?? request.title}
            fill
            sizes="(min-width: 992px) 40vw, 100vw"
            className="object-fit-cover"
          />
        </a>
      ) : null}
      <div className="card-body p-3">
        <div className="d-flex flex-wrap gap-2 mb-2">
          <span className="badge rounded-pill text-bg-light border">{formatObjectType(request.objectType)}</span>
          <span className="badge rounded-pill text-bg-light border">
            {request.requestType === "miete" ? "Mietgesuch" : "Kaufgesuch"}
          </span>
        </div>
        <h3 className="h6 mb-2">
          <a href={detailHref} className="link-dark text-decoration-none">
            {request.title}
          </a>
        </h3>
        <p className="text-body-secondary mb-3">
          {[formatCurrency(request.maxPrice), formatArea(request.maxAreaSqm)]
            .filter(Boolean)
            .join(" · ") || "Suchprofil auf Anfrage"}
        </p>
        <div className="d-flex flex-wrap gap-2">
          <a href={detailHref} className="btn btn-outline-dark btn-sm">
            {detailLabel}
          </a>
          <a href={listHref} className="btn btn-light border btn-sm fw-semibold">
            {listLabel}
          </a>
        </div>
      </div>
    </article>
  );
}

function selectLocalitySlugs(report: Report, kreisSlug: string): string[] {
  const data = asRecord(report.data) ?? {};
  return asArray(data["ortslagen_uebersicht"])
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => {
      const kreis = String(item["kreis"] ?? "").trim().toLowerCase();
      return !kreis || kreis === kreisSlug;
    })
    .map((item) => String(item["ortslage"] ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function ImmobilienmaklerSection({
  report,
  bundeslandSlug,
  kreisSlug,
  basePath,
  references = [],
  featuredBuyOffer = null,
  featuredRentOffer = null,
  featuredBuyRequest = null,
  featuredRentRequest = null,
}: ImmobilienmaklerSectionProps) {
  const text = asRecord(report["text"]) ?? asRecord(asRecord(report.data)?.["text"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};
  const wohnlagencheck = asRecord(text["wohnlagencheck"]) ?? {};

  const name = firstNonEmpty(asString(makler["makler_name"])) ?? "Maklerempfehlung";
  const intro = asString(makler["makler_empfehlung"]) ?? "";
  const beschreibung = asString(makler["makler_beschreibung"]) ?? "";
  const benefitsRaw = asString(makler["makler_benefits"]) ?? "";
  const provision = asString(makler["makler_provision"]) ?? "";
  const wohnlagencheckAllgemein = asString(wohnlagencheck["wohnlagencheck_allgemein"]) ?? "";

  const benefits = benefitsRaw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const logoOverride = asString(makler["media_makler_logo"]) ?? "";
  const imageSrc = resolveMandatoryMediaSrc("media_makler_logo", logoOverride);
  const berater = asRecord(text["berater"]) ?? {};
  const emailTarget =
    firstNonEmpty(
      asString(makler["makler_email"]),
      asString(berater["berater_email"]),
    ) ??
    "kontakt@wohnlagencheck24.de";
  const gallery = [
    resolveMandatoryMediaSrc("media_makler_bild_01", asString(makler["media_makler_bild_01"])),
    resolveMandatoryMediaSrc("media_makler_bild_02", asString(makler["media_makler_bild_02"])),
  ];

  const meta = asRecord(report.meta) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? kreisSlug;
  const localityGallery = selectLocalitySlugs(report, kreisSlug).map((ortSlug) => ({
    src: buildWebAssetUrl(
      `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}/immobilienmarktbericht-${ortSlug}-standortcheck-01.webp`,
    ),
    alt: `${kreisName} ${ortSlug}`,
  }));
  const regionalGallery = [
    ...[1, 2, 3].map((idx) => ({
      src: buildWebAssetUrl(
        `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}-standortcheck-0${idx}.webp`,
      ),
      alt: kreisName,
    })),
    ...localityGallery,
  ].slice(0, 6);
  const hasMarketItems = Boolean(featuredBuyOffer || featuredBuyRequest || featuredRentOffer || featuredRentRequest);

  return (
    <div className="d-flex flex-column gap-4">
      <section className="row g-3">
        {gallery.map((src) => (
          <div key={src} className="col-12 col-md-6">
            <div className="ratio ratio-4x3 overflow-hidden rounded-4 bg-light">
              <Image
                src={src}
                alt={`Immobilienmakler ${kreisName}`}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-fit-cover"
              />
            </div>
          </div>
        ))}
      </section>

      <section>
        <p className="small text-uppercase text-body-secondary fw-semibold mb-2">WOHNLAGENCHECK24 Maklerempfehlung</p>
        <h1 className="mb-3">Immobilienmakler in {kreisName}</h1>
        {intro ? (
          <p className="text-body-secondary mb-0">{intro}</p>
        ) : (
          <p className="text-body-secondary mb-0">
            Unser Portal empfiehlt Ihnen einen erfahrenen Immobilienmakler aus der Region {kreisName}.
            Die Partnerauswahl basiert auf Marktkenntnis, Servicequalitaet und nachweislicher Performance.
          </p>
        )}
      </section>

      {beschreibung ? (
        <section className="card border-0 shadow-none rounded-4">
          <div className="card-body p-3">
            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-auto">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body p-3">
                    <Image
                      src={imageSrc}
                      alt={`Maklerempfehlung ${kreisName}`}
                      width={220}
                      height={220}
                      className="rounded-circle object-fit-cover bg-light"
                    />
                  </div>
                </div>
              </div>
              <div className="col">
                <h2 className="mb-2">{name}</h2>
                <p className="text-body-secondary mb-0">{beschreibung}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {references.length > 0 ? (
        <ReferenceExperienceMap
          items={references}
          heading="Referenzen aus der Vermittlungspraxis"
          intro={`Vermittlungserfolge unseres Partners in der Region ${kreisName}.`}
          enable3dToggle
          initialViewMode="3d"
          showCountInHeading
        />
      ) : null}

      {wohnlagencheckAllgemein || regionalGallery.length > 0 ? (
        <section className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-3 p-lg-4">
            <div className="row g-4 align-items-start">
              <div className="col-12 col-lg-5">
                <p className="small text-uppercase text-body-secondary fw-semibold mb-2">Unsere Region</p>
                <h2 className="mb-2">{kreisName}</h2>
                {wohnlagencheckAllgemein ? (
                  <p className="text-body-secondary mb-0">{wohnlagencheckAllgemein}</p>
                ) : null}
              </div>
              <div className="col-12 col-lg-7">
                <RegionImageGallery items={regionalGallery} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="row g-4 align-items-start">
        {benefits.length ? (
          <div className="col-12 col-lg-5">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-3 p-lg-4">
                <h2>Leistungen & Vorteile</h2>
                <ul className="text-body-secondary mb-0 ps-3">
                  {benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <div className={benefits.length ? "col-12 col-lg-7" : "col-12"}>
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-3 p-lg-4">
              <h2>Makler anfragen</h2>
              <p className="text-body-secondary">
                Teilen Sie uns hier Ihre Eckdaten mit. Wir finden eine maßgeschneiderte Lösung für Ihr Anliegen.
              </p>
              <KontaktForm
                targetEmail={emailTarget}
                scope="makler"
                regionLabel={`Maklerempfehlung – ${kreisName}`}
              />
            </div>
          </div>
        </div>
      </section>

      {hasMarketItems ? (
        <section className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-3 p-lg-4">
            <div className="mb-3">
              <div>
                <p className="small text-uppercase text-body-secondary fw-semibold mb-2">Aktuell aus der Region</p>
                <h2 className="mb-0">Neue Objekte und Gesuche im {kreisName}</h2>
              </div>
            </div>
            <div className="d-flex flex-column gap-4">
              {featuredBuyOffer || featuredBuyRequest ? (
                <div className="rounded-4 bg-light p-3">
                  <h3 className="h5 mb-3">Kaufen</h3>
                  <div className="row g-3">
                    {featuredBuyOffer ? (
                      <div className="col-12 col-lg-6">
                        <MarketOfferCard
                          offer={featuredBuyOffer}
                          detailHref={buildOfferHref(basePath, featuredBuyOffer)}
                          listHref={buildOfferListHref(basePath, "kauf")}
                          detailLabel="Kaufangebot ansehen"
                          listLabel="Alle Kaufangebote"
                        />
                      </div>
                    ) : null}

                    {featuredBuyRequest ? (
                      <div className="col-12 col-lg-6">
                        <MarketRequestCard
                          request={featuredBuyRequest}
                          detailHref={buildRequestHref(basePath, featuredBuyRequest)}
                          listHref={buildRequestListHref(basePath, "kauf")}
                          detailLabel="Kaufgesuch ansehen"
                          listLabel="Alle Kaufgesuche"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {featuredRentOffer || featuredRentRequest ? (
                <div className="rounded-4 bg-light p-3">
                  <h3 className="h5 mb-3">Mieten</h3>
                  <div className="row g-3">
                    {featuredRentOffer ? (
                      <div className="col-12 col-lg-6">
                        <MarketOfferCard
                          offer={featuredRentOffer}
                          detailHref={buildOfferHref(basePath, featuredRentOffer)}
                          listHref={buildOfferListHref(basePath, "miete")}
                          detailLabel="Mietangebot ansehen"
                          listLabel="Alle Mietangebote"
                        />
                      </div>
                    ) : null}

                    {featuredRentRequest ? (
                      <div className="col-12 col-lg-6">
                        <MarketRequestCard
                          request={featuredRentRequest}
                          detailHref={buildRequestHref(basePath, featuredRentRequest)}
                          listHref={buildRequestListHref(basePath, "miete")}
                          detailLabel="Mietgesuch ansehen"
                          listLabel="Alle Mietgesuche"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {provision ? (
        <section className="card border-0 shadow-none rounded-4">
          <div className="card-body p-4">
            <h2>Maklerprovision & Kosten</h2>
            <p className="text-body-secondary mb-0">{provision}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
