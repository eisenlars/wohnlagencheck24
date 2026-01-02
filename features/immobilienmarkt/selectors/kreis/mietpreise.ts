import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";

export type KreisMietpreiseVM = {
  kreisName: string;
  bundeslandName?: string;
  basePath: string;

  teaser: string;

  berater: {
    name: string;
    telefon: string;
    email: string;
    taetigkeit: string;
    imageSrc: string;
  };

  hero: {
    imageSrc: string;
    title: string;
    subtitle: string;
  };

  kpis: {
    kaltmiete: number | null;
    nebenkosten: number | null;
    warmmiete: number | null;
  };

  assets: {
    mietpreisMapSvg: string | null;
  };
};

export function buildKreisMietpreiseVM(args: {
  report: Report;
  bundeslandSlug: string;
  kreisSlug: string;
  mietpreisMapSvg: string | null;
}): KreisMietpreiseVM {
  const { report, bundeslandSlug, kreisSlug, mietpreisMapSvg } = args;

  const kreisName = (report.meta as any)?.amtlicher_name ?? report.meta?.name ?? kreisSlug;
  const bundeslandName = (report.meta as any)?.bundesland_name;

  const teaser = getText(report, "text.mietpreise.mietpreise_intro", "");

  const beraterName = (report.data as any)?.text?.berater?.berater_name ?? "Lars Hofmann";
  const beraterTelefon = (report.data as any)?.text?.berater?.berater_telefon ?? "+49 351/287051-0";
  const beraterEmail = (report.data as any)?.text?.berater?.berater_email ?? "kontakt@wohnlagencheck24.de";
  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

  const mietpreiseGesamtRaw = (report.data as any)?.mietpreise_gesamt?.[0] ?? null;

  const kaltmiete = toNumberOrNull(mietpreiseGesamtRaw?.preis_kaltmiete);
  const nebenkosten = toNumberOrNull(mietpreiseGesamtRaw?.preis_nebenkosten);
  const warmmiete = toNumberOrNull(mietpreiseGesamtRaw?.preis_warmmiete);

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  return {
    kreisName,
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
      title: kreisName,
      subtitle: "regionaler Standortberater",
    },

    kpis: { kaltmiete, nebenkosten, warmmiete },

    assets: { mietpreisMapSvg },
  };
}
