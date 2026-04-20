import Image from "next/image";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

import { asRecord, asString } from "@/utils/records";
import type { Report } from "@/lib/data";
import styles from "./ImmobilienmaklerSection.module.css";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import type { RegionalReference } from "@/lib/referenzen";
import { ReferenceSlideshow } from "@/components/referenzen/ReferenceSlideshow";

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
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.keywordIntro}>
          
          <h1 className={styles.title}>Immobilienmakler in {kreisName}</h1>
          <p className={styles.text}>
            Unser Portal empfiehlt Ihnen einen erfahrenen Immobilienmakler aus der Region {kreisName}.
            Die Partnerauswahl basiert auf Marktkenntnis, Servicequalitaet und nachweislicher Performance.
          </p>
        </section>
        
        <section className={styles.gallery}>
          {gallery.map((src) => (
            <div key={src} className={styles.galleryItem}>
              <Image
                src={src}
                alt={`Immobilienmakler ${kreisName}`}
                width={520}
                height={360}
                className={styles.galleryImage}
              />
            </div>
          ))}
        </section>

        

        {empfehlung ? (
          <section className={styles.recommendation}>
            <div className={styles.recommendationGrid}>
              <div className={styles.recommendationLogo}>
                <Image
                  src={imageSrc}
                  alt={`Maklerempfehlung ${kreisName}`}
                  width={180}
                  height={180}
                  className={styles.recommendationLogoImage}
                />
              </div>
              <div>
                <p className={styles.eyebrow}>WOHNLAGENCHECK24 Maklerempfehlung</p>
                <h2>{name}</h2>
                <p><b>Warum wir diesen Makler empfehlen</b></p>
                <p className={styles.text}>{empfehlung}</p>
              </div>
            </div>
          </section>
        ) : null}

        {(beschreibung || benefits.length > 0) ? (
          <section className={styles.grid}>
            {beschreibung ? (
              <div className={styles.card}>
                <h2>Profil</h2>
                <p className={styles.text}>{beschreibung}</p>
              </div>
            ) : null}

            {benefits.length ? (
              <div className={styles.card}>
                <h2>Leistungen & Vorteile</h2>
                <ul className={styles.list}>
                  {benefits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={styles.contact}>
          <div>
            <h2>Makler anfragen</h2>
            <p className={styles.text}>
              Teilen Sie uns Ihre Eckdaten mit. Wir melden uns mit einer konkreten Empfehlung.
            </p>
          </div>
          <div className={styles.formWrap}>
            <KontaktForm
              targetEmail={emailTarget}
              scope="makler"
              regionLabel={`Maklerempfehlung – ${kreisName}`}
            />
          </div>
        </section>

        {provision ? (
          <section className={styles.provision}>
            <h2>Maklerprovision & Kosten</h2>
            <p className={styles.text}>{provision}</p>
          </section>
        ) : null}

        {references.length > 0 ? (
          <ReferenceSlideshow items={references.slice(0, 6)} />
        ) : null}
      </div>
    </div>
  );
}
