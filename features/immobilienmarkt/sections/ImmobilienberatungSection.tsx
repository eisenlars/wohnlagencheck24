import Image from "next/image";
import Link from "next/link";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

import { asRecord, asString } from "@/utils/records";
import { buildWebAssetUrl } from "@/utils/assets";
import type { Report } from "@/lib/data";
import { KontaktForm } from "@/components/kontakt/KontaktForm";
import { FaqSection } from "@/components/FaqSection";

type ContactItem = { label: string; value: string; href?: string };
type RegionBadge = { label: string; href: string };

const consultationReasons = [
  "Sie planen einen Verkauf und moechten den realistischen Marktwert kennen.",
  "Sie haben ein Objekt geerbt und brauchen eine neutrale Einordnung.",
  "Sie pruefen, ob eine Vermietung, ein Verkauf oder eine Sanierung sinnvoller ist.",
  "Sie benoetigen eine belastbare Grundlage fuer Preisverhandlungen.",
  "Sie moechten Lage, Nachfrage und Zielgruppe regional einschaetzen lassen.",
];

const faqs = [
  {
    q: "Muss ich bereits verkaufen wollen?",
    a:
      "Nein. Die Beratung ist auch sinnvoll, wenn Sie Optionen pruefen oder eine Entscheidung vorbereiten moechten.",
  },
  {
    q: "Welche Unterlagen sind hilfreich?",
    a:
      "Hilfreich sind Adresse, Objektart, Wohn- oder Nutzflaeche, Baujahr, Zustand und vorhandene Grundrisse oder Fotos.",
  },
  {
    q: "Wird die Region konkret beruecksichtigt?",
    a:
      "Ja. Die Einschaetzung verbindet Objektdaten mit regionalen Markt-, Lage- und Nachfrageindikatoren.",
  },
  {
    q: "Ist eine Beratung auch vor einer Sanierung sinnvoll?",
    a:
      "Ja. Gerade vor groesseren Investitionen hilft eine Markteinordnung, damit Aufwand und erwartbarer Mehrwert zusammenpassen.",
  },
];

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "");
}

function parseStructuredText(value: string): { isList: boolean; items: string[] } {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const listItems = lines
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  const isList = lines.length > 0 && lines.every((line) => /^([-*•]\s+|\d+[.)]\s+)/.test(line));
  return { isList, items: isList ? listItems : lines };
}

function dedupeRegionBadges(items: RegionBadge[]): RegionBadge[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

type ImmobilienberatungSectionProps = {
  report: Report;
  bundeslandSlug: string;
  kreisSlug: string;
  regionLinks?: RegionBadge[];
};

export function ImmobilienberatungSection({
  report,
  bundeslandSlug,
  kreisSlug,
  regionLinks = [],
}: ImmobilienberatungSectionProps) {
  const text = asRecord(report["text"]) ?? asRecord(asRecord(report.data)?.["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const avatarOverride = asString(berater["media_berater_avatar"]) ?? "";
  const avatarSrc = resolveMandatoryMediaSrc("media_berater_avatar", avatarOverride);

  const name = asString(berater["berater_name"]) ?? "Berater";
  const beschreibung = asString(berater["berater_beschreibung"]) ?? "";
  const ausbildungRaw = asString(berater["berater_ausbildung"]) ?? "";
  const ausbildung = parseStructuredText(ausbildungRaw);

  const email = asString(berater["berater_email"]) ?? "";
  const emailTarget = email || "kontakt@wohnlagencheck24.de";
  const telMobil = asString(berater["berater_telefon_mobil"]) ?? "";
  const telFestnetz = asString(berater["berater_telefon_fest"]) ?? "";
  const telLegacy = asString(berater["berater_telefon"]) ?? "";
  const telPrimary = telMobil || telFestnetz || telLegacy;

  const contactItems: ContactItem[] = [
    email ? { label: "E-Mail", value: email, href: `mailto:${email}` } : null,
    telMobil ? { label: "Telefon (Mobil)", value: telMobil, href: `tel:${normalizePhone(telMobil)}` } : null,
    telFestnetz ? { label: "Telefon (Festnetz)", value: telFestnetz, href: `tel:${normalizePhone(telFestnetz)}` } : null,
    (!telMobil && !telFestnetz && telLegacy)
      ? { label: "Telefon", value: telLegacy, href: `tel:${normalizePhone(telLegacy)}` }
      : null,
  ].filter(Boolean) as ContactItem[];

  const meta = asRecord(report.meta) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? kreisSlug;
  const bundeslandName = asString(meta["bundesland_name"]) ?? bundeslandSlug;
  const regionImageSrc = buildWebAssetUrl(
    `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.webp`,
  );
  const regionBadges: RegionBadge[] = [
    { label: kreisName, href: `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}` },
    { label: bundeslandName, href: `/immobilienmarkt/${bundeslandSlug}` },
  ];
  const advisorRegions = dedupeRegionBadges([
    ...(regionLinks.length ? regionLinks : [regionBadges[0]]),
    regionBadges[1],
  ]);

  return (
    <div className="d-flex flex-column gap-4">
      <section className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-lg-6 text-lg-center">
              <div className="d-flex flex-wrap align-items-center justify-content-center gap-4">
                <Image
                  src={avatarSrc}
                  alt={`Berater: ${name}`}
                  width={160}
                  height={160}
                  className="rounded-circle object-fit-cover bg-light border border-4 border-white shadow-sm"
                />
                <div>
                  <h1 className="mb-2">{name}</h1>
                  <p className="fw-semibold text-body-secondary mb-3">Standort- / Immobilienberatung</p>
                  <div className="d-flex flex-wrap justify-content-center gap-2">
                    <a className="btn btn-dark rounded-pill px-4" href="#berater-kontaktformular">
                      Kontakt aufnehmen
                    </a>
                    {telPrimary ? (
                      <a className="btn btn-outline-dark rounded-pill px-4" href={`tel:${normalizePhone(telPrimary)}`}>
                        Rueckruf anfordern
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <h2 className="mb-3">Regionale Expertise</h2>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {advisorRegions.map((badge) => (
                  <Link
                    key={badge.href}
                    href={badge.href}
                    className="badge rounded-pill text-bg-light border text-capitalize text-decoration-none"
                  >
                    {badge.label}
                  </Link>
                ))}
              </div>
              <div className="d-grid gap-2">
                {beschreibung
                  .split(/\n\n+/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block) => (
                    <p key={block} className="text-body-secondary mb-0">
                      {block}
                    </p>
                  ))}
              </div>
            </div>
          </div>

          <div className="position-relative overflow-hidden rounded-4 bg-light mt-5">
            <div className="ratio ratio-21x9">
              <Image
                src={regionImageSrc}
                alt={`Immobilienberatung in ${kreisName}`}
                fill
                sizes="(min-width: 1200px) 1140px, 100vw"
                className="object-fit-cover"
              />
            </div>
            <div className="position-absolute bottom-0 start-0 m-3 px-3 py-2 rounded-pill bg-dark bg-opacity-75 text-white small fw-semibold">
              Immobilienberatung fuer die Region {kreisName}
            </div>
          </div>
        </div>
      </section>

      <section className="row g-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4">
              <h3>Meine Qualifikation & Erfahrung</h3>
              {ausbildung.items.length && ausbildung.isList ? (
                <ul className="text-body-secondary mb-0 ps-3">
                  {ausbildung.items.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : ausbildung.items.length ? (
                <div className="d-grid gap-2">
                  {ausbildung.items.map((block, index) => (
                    <p key={`${block}-${index}`} className="text-body-secondary mb-0">
                      {block}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-body-secondary mb-0">Keine Angaben vorhanden.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="row g-4 align-items-start">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4 d-grid gap-3">
              <div>
                <span className="badge rounded-pill text-bg-light border text-uppercase">
                  Orientierung
                </span>
              </div>
              <h2 className="mb-0">Wann lohnt sich eine Immobilienberatung?</h2>
              <p className="text-body-secondary mb-0">
                Eine Beratung ist vor allem dann sinnvoll, wenn Entscheidungen rund um Verkauf,
                Vermietung oder Investitionen nicht allein auf Bauchgefuehl basieren sollen.
              </p>
              <ul className="text-body-secondary mb-0 ps-3">
                {consultationReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {contactItems.length ? (
                <div className="border-top pt-3">
                  <div className="fw-semibold mb-2">Kontakt:</div>
                  <div className="d-flex flex-wrap gap-2">
                    {contactItems.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        className="badge rounded-pill text-bg-light border text-decoration-none text-dark"
                      >
                        {item.label}: {item.value}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div id="berater-kontaktformular" className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 p-lg-5">
              <h2>Jetzt unverbindlich anfragen</h2>
              <p className="text-body-secondary">
                Sie erhalten eine persoenliche Einschaetzung und klare Handlungsempfehlungen.
              </p>
              <KontaktForm
                targetEmail={emailTarget}
                scope="berater"
                regionLabel={`Standort- / Immobilienberatung – ${kreisSlug}`}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-center mb-3">Haeufige Fragen zur Immobilienberatung</h2>
        <FaqSection id="faq-immobilienberatung" items={faqs} />
      </section>

      <section className="text-center mb-5">
        <h2 className="mb-3">Meine Region</h2>
        <nav className="nav nav-pills justify-content-center gap-2" aria-label="Regionen des Beraters">
          {advisorRegions.map((badge) => (
            <Link key={badge.href} href={badge.href} className="nav-link border text-dark">
              {badge.label}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
