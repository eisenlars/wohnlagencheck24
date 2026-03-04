export type GlobalPromptVariant = "tab_general" | "kreis_text" | "ort_template";

const TAB_TITLES: Record<string, string> = {
  marktueberblick: "Immobilienmarkt Überblick",
  immobilienpreise: "Immobilienpreise",
  mietpreise: "Mietpreise",
  mietrendite: "Mietrendite",
  wohnmarktsituation: "Wohnmarktsituation",
  wohnlagencheck: "Wohnlagencheck",
  wirtschaft: "Wirtschaft",
  grundstueckspreise: "Grundstückspreise",
};

function tabTitle(tabId: string) {
  return TAB_TITLES[tabId] ?? "Themenblock";
}

export function buildGlobalPromptPrefill(tabId: string, variant: GlobalPromptVariant, areaName: string): string {
  const title = tabTitle(tabId);

  if (variant === "tab_general") {
    return [
      `Optimiere den GENERAL-Text für den Themenblock "${title}" in ${areaName}.`,
      "Schreibe klar, professionell und natürlich.",
      "Keine neuen Fakten erfinden.",
      "Keine Zahlen/Fakten verfälschen, falls vorhanden.",
      "Der Text soll als redaktioneller Standardtext für die Region nutzbar sein.",
    ].join("\n");
  }

  if (variant === "kreis_text") {
    return [
      `Erstelle für den Themenblock "${title}" einen individuellen Kreistext für ${areaName}.`,
      "Der Text soll professionell, verständlich und SEO-tauglich sein.",
      "Keine neuen Fakten erfinden.",
      "Falls Fakten fehlen, neutral und allgemein formulieren.",
    ].join("\n");
  }

  return [
    `Erstelle für den Themenblock "${title}" EINEN generischen Ortslagen-Template-Text.`,
    "Der Text muss den Platzhalter {ortsname} mindestens einmal enthalten.",
    "Keine konkreten Ortsnamen einsetzen.",
    "Keine neuen Fakten erfinden.",
    "Stil: professionell, lebendig, gut lesbar.",
  ].join("\n");
}

