import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";

import type { MietpreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/mietpreise";
import type { MietpreiseReportData } from "@/types/reports";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

export function buildMietpreiseVM(args: {
  report: Report<MietpreiseReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): MietpreiseVM {
  const { report, level, bundeslandSlug, kreisSlug, ortSlug } = args;

  const meta = asRecord(report.meta) ?? {};
  const data = report.data ?? {};
  const text = asRecord(data["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};

  const regionName =
    (typeof meta["amtlicher_name"] === "string" ? meta["amtlicher_name"] : undefined) ??
    (typeof meta["name"] === "string" ? meta["name"] : undefined) ??
    (level === "ort" ? ortSlug ?? "Ort" : kreisSlug);

  const bundeslandName = typeof meta["bundesland_name"] === "string" ? meta["bundesland_name"] : undefined;

  const teaser = getText(report, "text.mietpreise.mietpreise_intro", "");

  const beraterName =
    (typeof berater["berater_name"] === "string" ? berater["berater_name"] : undefined) ??
    "Lars Hofmann";
  const beraterTelefon =
    (typeof berater["berater_telefon"] === "string" ? berater["berater_telefon"] : undefined) ??
    "+49 351/287051-0";
  const beraterEmail =
    (typeof berater["berater_email"] === "string" ? berater["berater_email"] : undefined) ??
    "kontakt@wohnlagencheck24.de";
  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${regionName}`;
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

  const mietpreiseGesamt = data.mietpreise_gesamt?.[0];

  const kaltmiete = toNumberOrNull(mietpreiseGesamt?.preis_kaltmiete);
  const nebenkosten = toNumberOrNull(mietpreiseGesamt?.preis_nebenkosten);
  const warmmiete = toNumberOrNull(mietpreiseGesamt?.preis_warmmiete);

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  return {
    level,
    regionName,
    bundeslandName,
    basePath,

    teaser,

    berater: {
      name: beraterName,
      telefon: beraterTelefon,
      email: beraterEmail,
      taetigkeit: beraterTaetigkeit,
      imageSrc: beraterImageSrc,
    },

    hero: {
      imageSrc: heroImageSrc,
      title: regionName,
      subtitle: "regionaler Standortberater",
    },

    kpis: { kaltmiete, nebenkosten, warmmiete },
  };
}
