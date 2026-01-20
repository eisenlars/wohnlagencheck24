import Image from "next/image";

import { asRecord, asString } from "@/utils/records";
import type { Report } from "@/lib/data";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import styles from "./ImmobilienberatungSection.module.css";

type ContactItem = { label: string; value: string; href?: string };

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

  const name = asString(berater["berater_name"]) ?? "Berater";
  const beschreibung = asString(berater["berater_beschreibung"]) ?? "";
  const ausbildungRaw = asString(berater["berater_ausbildung"]) ?? "";
  const ausbildung = ausbildungRaw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email01 = asString(berater["berater_email_01"]) ?? "";
  const email02 = asString(berater["berater_email_02"]) ?? "";
  const emailTarget = email01 || email02 || "kontakt@wohnlagencheck24.de";
  const telFest = asString(berater["berater_telefon_fest"]) ?? "";
  const telMobil = asString(berater["berater_telefon_mobil"]) ?? "";
  const telWhatsApp = asString(berater["berater_telefon_whatsApp"]) ?? "";

  const strasse = asString(berater["berater_adresse_strasse"]) ?? "";
  const hnr = asString(berater["berater_adresse_hnr"]) ?? "";
  const plz = asString(berater["berater_adresse_plz"]) ?? "";
  const ort = asString(berater["berater_adresse_ort"]) ?? "";
  const adresse =
    [strasse, hnr].filter(Boolean).join(" ") +
    (plz || ort ? `, ${[plz, ort].filter(Boolean).join(" ")}` : "");

  const contactItems: ContactItem[] = [
    email01 ? { label: "E-Mail", value: email01, href: `mailto:${email01}` } : null,
    email02 && email02 !== email01 ? { label: "E-Mail 2", value: email02, href: `mailto:${email02}` } : null,
    telFest ? { label: "Telefon (Fest)", value: telFest, href: `tel:${normalizePhone(telFest)}` } : null,
    telMobil ? { label: "Telefon (Mobil)", value: telMobil, href: `tel:${normalizePhone(telMobil)}` } : null,
    telWhatsApp ? { label: "WhatsApp", value: telWhatsApp, href: `https://wa.me/${normalizePhone(telWhatsApp)}` } : null,
    adresse ? { label: "Adresse", value: adresse } : null,
  ].filter(Boolean) as ContactItem[];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.portrait}>
            <div className={styles.avatar}>
              <Image
                src={`/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`}
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
                {email01 ? (
                  <a className={`${styles.btn} ${styles.btnPrimary}`} href={`mailto:${email01}`}>
                    Kontakt aufnehmen
                  </a>
                ) : null}
                {telMobil || telFest ? (
                  <a className={`${styles.btn} ${styles.btnSecondary}`} href={`tel:${normalizePhone(telMobil || telFest)}`}>
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
