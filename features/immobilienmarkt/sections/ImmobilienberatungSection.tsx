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

  const email = asString(berater["berater_email"]) ?? "";
  const emailTarget = email || "kontakt@wohnlagencheck24.de";
  const tel = asString(berater["berater_telefon"]) ?? "";
  const telWhatsApp = asString(berater["berater_telefon_whatsApp"]) ?? "";

  const strasse = asString(berater["berater_adresse_strasse"]) ?? "";
  const hnr = asString(berater["berater_adresse_hnr"]) ?? "";
  const plz = asString(berater["berater_adresse_plz"]) ?? "";
  const ort = asString(berater["berater_adresse_ort"]) ?? "";
  const adresse =
    [strasse, hnr].filter(Boolean).join(" ") +
    (plz || ort ? `, ${[plz, ort].filter(Boolean).join(" ")}` : "");

  const contactItems: ContactItem[] = [
    email ? { label: "E-Mail", value: email, href: `mailto:${email}` } : null,
    tel ? { label: "Telefon", value: tel, href: `tel:${normalizePhone(tel)}` } : null,
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
                {email ? (
                  <a className={`${styles.btn} ${styles.btnPrimary}`} href={`mailto:${email}`}>
                    Kontakt aufnehmen
                  </a>
                ) : null}
                {tel ? (
                  <a className={`${styles.btn} ${styles.btnSecondary}`} href={`tel:${normalizePhone(tel)}`}>
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
