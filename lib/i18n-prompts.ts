import type { DisplayTextClass } from "@/lib/text-display-class";

function normalizeTargetLocale(locale: string): string {
  const raw = String(locale ?? "").trim();
  return raw ? raw.toUpperCase() : "ZIELSPRACHE";
}

export function getI18nStandardPrompt(displayClass: DisplayTextClass, locale: string): string {
  const targetLocale = normalizeTargetLocale(locale);
  const shared =
    `Uebersetze den deutschen Text nach ${targetLocale}. ` +
    "Bewahre Fakten, Zahlen, Namen und Aussagen exakt. " +
    "Keine neuen Fakten erfinden. ";

  if (displayClass === "general") {
    return `${shared}Halte Einleitungs- und Erklaerungstexte klar, ruhig und gut lesbar.`;
  }
  if (displayClass === "profile") {
    return `${shared}Halte Vorstellungs- und Profiltexte persoenlich, professionell und vertrauenswuerdig.`;
  }
  if (displayClass === "data_driven") {
    return `${shared}Halte datenbasierte Texte praezise, sachlich und terminologisch konsistent.`;
  }
  if (displayClass === "marketing") {
    return `${shared}Halte SEO- und GEO-Texte natuerlich, suchintentionstauglich und konsistent.`;
  }
  return `${shared}Halte Experten- und Markteinschaetzungen fundiert, professionell und regional stimmig.`;
}

export function buildI18nPromptWithExtras(standardPrompt: string, extraPrompt?: string | null): string {
  const base = String(standardPrompt ?? "").trim();
  const extra = String(extraPrompt ?? "").trim();
  if (!extra) return base;
  return `${base}\n\nZusaetzliche Nutzeranweisung:\n${extra}`;
}
