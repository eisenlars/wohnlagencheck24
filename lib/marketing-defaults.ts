export type MarketingSectionKey =
  | "immobilienmarkt_ueberblick"
  | "immobilienpreise"
  | "mietpreise"
  | "mietrendite"
  | "wohnmarktsituation"
  | "grundstueckspreise"
  | "wohnlagencheck"
  | "wirtschaft";

export type MarketingEntry = {
  title: string;
  description: string;
  summary: string;
  primary_keyword: string;
  secondary_keywords: string;
  entities: string;
  cta: string;
};

export type MarketingDefaults = Record<MarketingSectionKey, MarketingEntry>;

export type MarketingContext = {
  level: "kreis" | "ortslage";
  kreisName: string;
  bundeslandName: string;
  ortslageName?: string;
  regionaleZuordnungKreis?: string | null;
};

const SECTION_LABELS: Record<MarketingSectionKey, string> = {
  immobilienmarkt_ueberblick: "Immobilienmarkt Überblick",
  immobilienpreise: "Immobilienpreise",
  mietpreise: "Mietpreise",
  mietrendite: "Mietrendite",
  wohnmarktsituation: "Wohnmarktsituation",
  grundstueckspreise: "Grundstückspreise",
  wohnlagencheck: "Wohnlagencheck",
  wirtschaft: "Wirtschaft",
};

function normalized(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildLocation(ctx: MarketingContext): { short: string; phrase: string } {
  const kreisName = normalized(ctx.kreisName);
  if (ctx.level === "ortslage") {
    const ort = normalized(ctx.ortslageName ?? "");
    return {
      short: ort || kreisName,
      phrase: `in ${ort || kreisName} (Kreis ${kreisName})`,
    };
  }

  const kreisLower = kreisName.toLowerCase();
  const kreisType = normalized(ctx.regionaleZuordnungKreis ?? "").toLowerCase();

  if (kreisType === "landkreis" && kreisLower.startsWith("landkreis")) {
    return { short: kreisName, phrase: `im ${kreisName}` };
  }
  if (kreisType === "landkreis") {
    return { short: `Landkreis ${kreisName}`, phrase: `im Landkreis ${kreisName}` };
  }
  return { short: kreisName, phrase: `in ${kreisName}` };
}

function secondaryKeywords(section: MarketingSectionKey, locationShort: string, bundeslandName: string): string {
  const map: Record<MarketingSectionKey, string> = {
    immobilienmarkt_ueberblick: `Immobilienmarkt ${locationShort}, Marktbericht ${locationShort}, Standortprofil ${locationShort}, Immobilienmarkt ${bundeslandName}`,
    immobilienpreise: `Hauspreise ${locationShort}, Wohnungspreise ${locationShort}, Immobilienpreisentwicklung ${locationShort}, Immobilienmarkt ${bundeslandName}`,
    mietpreise: `Mietpreise Wohnungen ${locationShort}, Mietpreise Häuser ${locationShort}, Mietpreisentwicklung ${locationShort}, Mietmarkt ${bundeslandName}`,
    mietrendite: `Bruttomietrendite ${locationShort}, Nettomietrendite ${locationShort}, Kaufpreisfaktor ${locationShort}, Rendite ${bundeslandName}`,
    wohnmarktsituation: `Wohnungsmarkt ${locationShort}, Wohnraumnachfrage ${locationShort}, Wohnraumangebot ${locationShort}, Wohnmarktsituation ${bundeslandName}`,
    grundstueckspreise: `Grundstückspreise ${locationShort}, Grundstückspreisentwicklung ${locationShort}, Baugrundstücke ${locationShort}, Grundstückspreise ${bundeslandName}`,
    wohnlagencheck: `Wohnlagen ${locationShort}, Standortfaktoren ${locationShort}, Lagebewertung ${locationShort}, Wohnlagencheck ${bundeslandName}`,
    wirtschaft: `Wirtschaftsstruktur ${locationShort}, Arbeitsmarkt ${locationShort}, Kaufkraft ${locationShort}, Wirtschaft ${bundeslandName}`,
  };
  return map[section];
}

export function buildMarketingDefaults(ctx: MarketingContext): MarketingDefaults {
  const bundeslandName = normalized(ctx.bundeslandName);
  const { short: locationShort, phrase: locationPhrase } = buildLocation(ctx);

  const out = {} as MarketingDefaults;
  (Object.keys(SECTION_LABELS) as MarketingSectionKey[]).forEach((sectionKey) => {
    const sectionLabel = SECTION_LABELS[sectionKey];
    out[sectionKey] = {
      title: `${sectionLabel} ${locationShort} | Marktbericht`,
      description: `Überblick zu ${sectionLabel} ${locationPhrase}: Entwicklung, Markttrends und regionale Einordnung im Bundesland ${bundeslandName}.`,
      summary: `Der Marktbericht fasst ${sectionLabel} ${locationPhrase} zusammen und ordnet die Entwicklung regional ein. Schwerpunkte sind zentrale Kennzahlen und Trends im Vergleich zum Umfeld.`,
      primary_keyword: `${sectionLabel} ${locationShort}`,
      secondary_keywords: secondaryKeywords(sectionKey, locationShort, bundeslandName),
      entities: `${locationShort}, ${normalized(ctx.kreisName)}, ${bundeslandName}, ${sectionLabel}, Marktbericht`,
      cta: `${sectionLabel} ${locationPhrase} jetzt prüfen.`,
    };
  });

  return out;
}
