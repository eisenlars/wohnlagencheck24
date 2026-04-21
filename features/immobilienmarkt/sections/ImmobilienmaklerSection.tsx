import Image from "next/image";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

import { asRecord, asString } from "@/utils/records";
import type { Report } from "@/lib/data";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import type { RegionalReference } from "@/lib/referenzen";
import { ReferenceExperienceMap } from "@/components/referenzen/ReferenceExperienceMap";

type ImmobilienmaklerSectionProps = {
  report: Report;
  kreisSlug: string;
  references?: RegionalReference[];
};

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return null;
}

export function ImmobilienmaklerSection({
  report,
  kreisSlug,
  references = [],
}: ImmobilienmaklerSectionProps) {
  const text = asRecord(report["text"]) ?? asRecord(asRecord(report.data)?.["text"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};

  const name = firstNonEmpty(asString(makler["makler_name"])) ?? "Maklerempfehlung";
  const empfehlung = asString(makler["makler_empfehlung"]) ?? "";
  const beschreibung = asString(makler["makler_beschreibung"]) ?? "";
  const benefitsRaw = asString(makler["makler_benefits"]) ?? "";
  const provision = asString(makler["makler_provision"]) ?? "";

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
