import Image from "next/image";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

import { asRecord, asString } from "@/utils/records";
import { buildWebAssetUrl } from "@/utils/assets";
import type { Report } from "@/lib/data";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import styles from "./ImmobilienberatungSection.module.css";

type ContactItem = { label: string; value: string; href?: string };

const consultationReasons = [
  "Sie planen einen Verkauf und moechten den realistischen Marktwert kennen.",
  "Sie haben ein Objekt geerbt und brauchen eine neutrale Einordnung.",
  "Sie pruefen, ob eine Vermietung, ein Verkauf oder eine Sanierung sinnvoller ist.",
  "Sie benoetigen eine belastbare Grundlage fuer Preisverhandlungen.",
  "Sie moechten Lage, Nachfrage und Zielgruppe regional einschaetzen lassen.",
];

const processSteps = [
  {
    title: "Anfrage",
    text: "Sie schildern kurz Objekt, Standort und Anlass der Beratung.",
  },
  {
    title: "Erstgespraech",
    text: "Wir klaeren Ziel, Zeitplan und welche Unterlagen fuer die Einschaetzung relevant sind.",
  },
  {
    title: "Regionale Einordnung",
    text: "Markt-, Lage- und Nachfrageindikatoren werden mit der konkreten Objektsituation abgeglichen.",
  },
  {
    title: "Empfehlung",
    text: "Sie erhalten eine klare Orientierung zu Wert, Strategie und naechsten Schritten.",
  },
];

const faqs = [
  {
    question: "Muss ich bereits verkaufen wollen?",
    answer:
      "Nein. Die Beratung ist auch sinnvoll, wenn Sie Optionen pruefen oder eine Entscheidung vorbereiten moechten.",
  },
  {
    question: "Welche Unterlagen sind hilfreich?",
    answer:
      "Hilfreich sind Adresse, Objektart, Wohn- oder Nutzflaeche, Baujahr, Zustand und vorhandene Grundrisse oder Fotos.",
  },
  {
    question: "Wird die Region konkret beruecksichtigt?",
    answer:
      "Ja. Die Einschaetzung verbindet Objektdaten mit regionalen Markt-, Lage- und Nachfrageindikatoren.",
  },
  {
    question: "Ist eine Beratung auch vor einer Sanierung sinnvoll?",
    answer:
      "Ja. Gerade vor groesseren Investitionen hilft eine Markteinordnung, damit Aufwand und erwartbarer Mehrwert zusammenpassen.",
  },
];

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "");
}

type ImmobilienberatungSectionProps = {
  report: Report;
  bundeslandSlug: string;
  kreisSlug: string;
};

export function ImmobilienberatungSection({
  report,
  bundeslandSlug,
  kreisSlug,
}: ImmobilienberatungSectionProps) {
  const text = asRecord(report["text"]) ?? asRecord(asRecord(report.data)?.["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const avatarOverride = asString(berater["media_berater_avatar"]) ?? "";
  const avatarSrc = resolveMandatoryMediaSrc("media_berater_avatar", avatarOverride);

  const name = asString(berater["berater_name"]) ?? "Berater";
  const beschreibung = asString(berater["berater_beschreibung"]) ?? "";
  const ausbildungRaw = asString(berater["berater_ausbildung"]) ?? "";
  const ausbildung = ausbildungRaw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email = asString(berater["berater_email"]) ?? "";
  const emailTarget = email || "kontakt@wohnlagencheck24.de";
  const telMobil = asString(berater["berater_telefon_mobil"]) ?? "";
  const telFestnetz = asString(berater["berater_telefon_fest"]) ?? "";
  const telLegacy = asString(berater["berater_telefon"]) ?? "";
  const telPrimary = telMobil || telFestnetz || telLegacy;

  const strasse = asString(berater["berater_adresse_strasse"]) ?? "";
  const hnr = asString(berater["berater_adresse_hnr"]) ?? "";
  const plz = asString(berater["berater_adresse_plz"]) ?? "";
  const ort = asString(berater["berater_adresse_ort"]) ?? "";
  const adresse =
    [strasse, hnr].filter(Boolean).join(" ") +
    (plz || ort ? `, ${[plz, ort].filter(Boolean).join(" ")}` : "");

  const contactItems: ContactItem[] = [
    email ? { label: "E-Mail", value: email, href: `mailto:${email}` } : null,
    telMobil ? { label: "Telefon (Mobil)", value: telMobil, href: `tel:${normalizePhone(telMobil)}` } : null,
    telFestnetz ? { label: "Telefon (Festnetz)", value: telFestnetz, href: `tel:${normalizePhone(telFestnetz)}` } : null,
    (!telMobil && !telFestnetz && telLegacy)
      ? { label: "Telefon", value: telLegacy, href: `tel:${normalizePhone(telLegacy)}` }
      : null,
    adresse ? { label: "Adresse", value: adresse } : null,
  ].filter(Boolean) as ContactItem[];

  const meta = asRecord(report.meta) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? kreisSlug;
  const regionImageSrc = buildWebAssetUrl(
    `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.webp`,
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.portrait}>
            <div className={styles.avatar}>
              <Image
                src={avatarSrc}
                alt={`Berater: ${name}`}
                width={220}
                height={220}
                className={styles.avatarImg}
              />
            </div>
            <div className={styles.basics}>
              <h1 className={styles.title}>{name}</h1>
              <p className={styles.role}>Standort- / Immobilienberatung</p>
              <div className={styles.cta}>
                {email ? (
                  <a className={`${styles.btn} ${styles.btnPrimary}`} href={`mailto:${email}`}>
                    Kontakt aufnehmen
                  </a>
                ) : null}
                {telPrimary ? (
                  <a className={`${styles.btn} ${styles.btnSecondary}`} href={`tel:${normalizePhone(telPrimary)}`}>
                    Rueckruf anfordern
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className={styles.heroText}>
            <h2>Profil</h2>
            {beschreibung
              .split(/\n\n+/)
              .map((block) => block.trim())
              .filter(Boolean)
              .map((block) => (
                <p key={block} className={styles.text}>
                  {block}
                </p>
              ))}
          </div>
          <div className={styles.regionVisual}>
            <Image
              src={regionImageSrc}
              alt={`Immobilienberatung in ${kreisName}`}
              width={1280}
              height={720}
              className={styles.regionVisualImage}
            />
            <div className={styles.regionVisualCaption}>
              Immobilienberatung fuer die Region {kreisName}
            </div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <h3>Ausbildung & Qualifikation</h3>
            {ausbildung.length ? (
              <ul>
                {ausbildung.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Keine Angaben vorhanden.</p>
            )}
          </div>
          <div className={styles.card}>
            <h3>Kontakt</h3>
            <div className={styles.contactList}>
              {contactItems.map((item) => (
                <div key={item.label} className={styles.contactItem}>
                  <span className={styles.contactLabel}>{item.label}</span>
                  {item.href ? (
                    <a href={item.href} className={styles.contactValue}>
                      {item.value}
                    </a>
                  ) : (
                    <span className={styles.contactValue}>{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <h3>Regionale Expertise</h3>
            <div className={styles.chipRow}>
              {[kreisSlug, bundeslandSlug].map((chip) => (
                <span key={chip} className={styles.chip}>
                  {chip}
                </span>
              ))}
            </div>
            <p className={styles.muted}>
              Fokus auf Marktanalysen, Standortprofile und individuelle Bewertungen in der Region.
            </p>
          </div>
        </section>

        <section className={styles.guidanceGrid}>
          <div className={`${styles.card} ${styles.guidanceCard}`}>
            <span className={styles.eyebrow}>Orientierung</span>
            <h2>Wann lohnt sich eine Immobilienberatung?</h2>
            <p className={styles.sectionIntro}>
              Eine Beratung ist vor allem dann sinnvoll, wenn Entscheidungen rund um Verkauf,
              Vermietung oder Investitionen nicht allein auf Bauchgefuehl basieren sollen.
            </p>
            <ul className={styles.reasonList}>
              {consultationReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className={`${styles.card} ${styles.processCard}`}>
            <span className={styles.eyebrow}>Ablauf</span>
            <h2>So laeuft die Beratung ab</h2>
            <div className={styles.processList}>
              {processSteps.map((step, index) => (
                <div key={step.title} className={styles.processStep}>
                  <span className={styles.processNumber}>{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>Fragen</span>
            <h2>Haeufige Fragen zur Immobilienberatung</h2>
          </div>
          <div className={styles.faqGrid}>
            {faqs.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.ctaFooter}>
          <div>
            <h2>Jetzt unverbindlich anfragen</h2>
            <p className={styles.muted}>
              Sie erhalten eine persoenliche Einschaetzung und klare Handlungsempfehlungen.
            </p>
          </div>
          <div className={styles.formWrap}>
            <KontaktForm
              targetEmail={emailTarget}
              scope="berater"
              regionLabel={`Standort- / Immobilienberatung – ${kreisSlug}`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
