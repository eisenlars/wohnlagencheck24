import Image from "next/image";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

import { asRecord, asString } from "@/utils/records";
import { buildWebAssetUrl } from "@/utils/assets";
import type { Report } from "@/lib/data";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import type { RegionalReference } from "@/lib/referenzen";
import { ReferenceExperienceMap } from "@/components/referenzen/ReferenceExperienceMap";
import type { Offer } from "@/lib/angebote";
import type { RegionalRequest } from "@/lib/gesuche";
import { slugifyOfferTitle, slugifyRequestTitle } from "@/utils/slug";

type ImmobilienmaklerSectionProps = {
  report: Report;
  bundeslandSlug: string;
  kreisSlug: string;
  basePath: string;
  references?: RegionalReference[];
  featuredOffer?: Offer | null;
  featuredRequest?: RegionalRequest | null;
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

function buildRequestHref(basePath: string, request: RegionalRequest): string {
  const segment = request.requestType === "miete" ? "mietgesuche" : "immobiliengesuche";
  return `${basePath}/${segment}/${request.id}_${slugifyRequestTitle(request.title)}`;
}

export function ImmobilienmaklerSection({
  report,
  bundeslandSlug,
  kreisSlug,
  basePath,
  references = [],
  featuredOffer = null,
  featuredRequest = null,
}: ImmobilienmaklerSectionProps) {
  const text = asRecord(report["text"]) ?? asRecord(asRecord(report.data)?.["text"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};
  const wohnlagencheck = asRecord(text["wohnlagencheck"]) ?? {};

  const name = firstNonEmpty(asString(makler["makler_name"])) ?? "Maklerempfehlung";
  const empfehlung = asString(makler["makler_empfehlung"]) ?? "";
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
  const regionalGallery = [1, 2, 3].map((idx) => ({
    src: buildWebAssetUrl(
      `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}-standortcheck-0${idx}.webp`,
    ),
    alt: `Wohnlagencheck ${kreisName}`,
  }));
  const featuredOfferImage = sanitizeImageUrl(featuredOffer?.imageUrl ?? null);
  const featuredRequestImage = featuredRequest?.imageUrl ?? null;
  const featuredOfferHref = featuredOffer ? buildOfferHref(basePath, featuredOffer) : null;
  const featuredRequestHref = featuredRequest ? buildRequestHref(basePath, featuredRequest) : null;

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
        <p className="text-body-secondary mb-0">
          Unser Portal empfiehlt Ihnen einen erfahrenen Immobilienmakler aus der Region {kreisName}.
          Die Partnerauswahl basiert auf Marktkenntnis, Servicequalitaet und nachweislicher Performance.
        </p>
      </section>

      {empfehlung ? (
        <section className="card border-0 shadow-none rounded-4">
          <div className="card-body p-3">
            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-auto">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body p-3">
                    <Image
                      src={imageSrc}
                      alt={`Maklerempfehlung ${kreisName}`}
                      width={180}
                      height={180}
                      className="rounded-circle object-fit-cover bg-light"
                    />
                  </div>
                </div>
              </div>
              <div className="col">
                <h2 className="mb-1">{name}</h2>
                <p className="fw-semibold mb-0">Warum wir diesen Makler empfehlen</p>
                <p className="text-body-secondary mb-0">{empfehlung}</p>
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

      {beschreibung ? (
        <section className="card border-0 shadow-none rounded-4">
          <div className="card-body p-3">
            <h2 className="mb-1">Profil</h2>
            <p className="text-body-secondary mb-0">{beschreibung}</p>
          </div>
        </section>
      ) : null}

      {wohnlagencheckAllgemein || regionalGallery.length > 0 ? (
        <section className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-3 p-lg-4">
            <div className="row g-4 align-items-start">
              <div className="col-12 col-lg-5">
                <p className="small text-uppercase text-body-secondary fw-semibold mb-2">Regionale Einblicke</p>
                <h2 className="mb-2">Wohnlagencheck {kreisName}</h2>
                {wohnlagencheckAllgemein ? (
                  <p className="text-body-secondary mb-0">{wohnlagencheckAllgemein}</p>
                ) : null}
              </div>
              <div className="col-12 col-lg-7">
                <div className="row g-2">
                  {regionalGallery.map((item) => (
                    <div key={item.src} className="col-12 col-md-4">
                      <div className="ratio ratio-4x3 overflow-hidden rounded-4 bg-light">
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          sizes="(min-width: 992px) 18vw, (min-width: 768px) 33vw, 100vw"
                          className="object-fit-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
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
            <div className="card-body p-4 p-lg-5">
              <h2>Makler anfragen</h2>
              <p className="text-body-secondary">
                Teilen Sie uns Ihre Eckdaten mit. Wir melden uns mit einer konkreten Empfehlung.
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

      {featuredOffer || featuredRequest ? (
        <section className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-3 p-lg-4">
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-3">
              <div>
                <p className="small text-uppercase text-body-secondary fw-semibold mb-2">Aktuell aus der Region</p>
                <h2 className="mb-0">Objekte und Gesuche im Markt</h2>
              </div>
              <p className="text-body-secondary mb-0">
                Ausgewählte Live-Inhalte aus {kreisName}.
              </p>
            </div>
            <div className="row g-3">
              {featuredOffer ? (
                <div className={featuredRequest ? "col-12 col-lg-6" : "col-12"}>
                  <article className="card border-0 bg-light rounded-4 h-100 overflow-hidden">
                    {featuredOfferImage ? (
                      <a href={featuredOfferHref ?? undefined} className="ratio ratio-16x9 d-block">
                        <Image
                          src={featuredOfferImage}
                          alt={featuredOffer.title}
                          fill
                          sizes="(min-width: 992px) 40vw, 100vw"
                          className="object-fit-cover"
                        />
                      </a>
                    ) : null}
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge rounded-pill text-bg-light border">{formatObjectType(featuredOffer.objectType)}</span>
                        <span className="badge rounded-pill text-bg-light border">
                          {featuredOffer.offerType === "miete" ? "Mietangebot" : "Kaufangebot"}
                        </span>
                      </div>
                      <h3 className="h6 mb-2">
                        {featuredOfferHref ? (
                          <a href={featuredOfferHref} className="link-dark text-decoration-none">
                            {featuredOffer.title}
                          </a>
                        ) : (
                          featuredOffer.title
                        )}
                      </h3>
                      <p className="text-body-secondary mb-3">
                        {[formatCurrency(featuredOffer.offerType === "miete" ? featuredOffer.rent : featuredOffer.price), formatArea(featuredOffer.areaSqm)]
                          .filter(Boolean)
                          .join(" · ") || "Details auf Anfrage"}
                      </p>
                      {featuredOfferHref ? (
                        <a href={featuredOfferHref} className="btn btn-outline-dark btn-sm">
                          Objekt ansehen
                        </a>
                      ) : null}
                    </div>
                  </article>
                </div>
              ) : null}

              {featuredRequest ? (
                <div className={featuredOffer ? "col-12 col-lg-6" : "col-12"}>
                  <article className="card border-0 bg-light rounded-4 h-100 overflow-hidden">
                    {featuredRequestImage ? (
                      <a href={featuredRequestHref ?? undefined} className="ratio ratio-16x9 d-block">
                        <Image
                          src={featuredRequestImage}
                          alt={featuredRequest.imageAlt ?? featuredRequest.imageTitle ?? featuredRequest.title}
                          fill
                          sizes="(min-width: 992px) 40vw, 100vw"
                          className="object-fit-cover"
                        />
                      </a>
                    ) : null}
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge rounded-pill text-bg-light border">{formatObjectType(featuredRequest.objectType)}</span>
                        <span className="badge rounded-pill text-bg-light border">
                          {featuredRequest.requestType === "miete" ? "Mietgesuch" : "Kaufgesuch"}
                        </span>
                      </div>
                      <h3 className="h6 mb-2">
                        {featuredRequestHref ? (
                          <a href={featuredRequestHref} className="link-dark text-decoration-none">
                            {featuredRequest.title}
                          </a>
                        ) : (
                          featuredRequest.title
                        )}
                      </h3>
                      <p className="text-body-secondary mb-3">
                        {[formatCurrency(featuredRequest.maxPrice), formatArea(featuredRequest.maxAreaSqm)]
                          .filter(Boolean)
                          .join(" · ") || "Suchprofil auf Anfrage"}
                      </p>
                      {featuredRequestHref ? (
                        <a href={featuredRequestHref} className="btn btn-outline-dark btn-sm">
                          Gesuch ansehen
                        </a>
                      ) : null}
                    </div>
                  </article>
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
