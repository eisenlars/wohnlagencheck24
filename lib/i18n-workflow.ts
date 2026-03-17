import type { DisplayTextClass } from "@/lib/text-display-class";

export type I18nChannel = "portal" | "local_site" | "marketing";
export type I18nScope = "current_area" | "kreis_ortslagen";

export const I18N_CHANNEL_OPTIONS: Array<{
  value: I18nChannel;
  label: string;
  description: string;
}> = [
  {
    value: "portal",
    label: "Berichte & Texte",
    description: "Redaktionelle Portaltexte und Marktberichte fuer das aktuell ausgewaehlte Gebiet.",
  },
  {
    value: "local_site",
    label: "Lokale Website",
    description: "Texte fuer die lokale Website inklusive sprachspezifischer Feinanpassungen.",
  },
  {
    value: "marketing",
    label: "SEO & Geo",
    description: "Strukturierte Marketing- und Suchmaschineninhalte fuer die Sichtbarkeit je Gebiet.",
  },
];

export const I18N_SCOPE_OPTIONS: Array<{
  value: I18nScope;
  label: string;
  description: string;
}> = [
  {
    value: "current_area",
    label: "Dieses Gebiet",
    description: "Arbeitet nur auf dem aktuell geoeffneten Kreis oder der aktuell geoeffneten Ortslage.",
  },
  {
    value: "kreis_ortslagen",
    label: "Kreis + Ortslagen",
    description: "Gebuendelter Lauf ueber Kreis und zugeordnete Ortslagen. Wird im naechsten Schritt umgesetzt.",
  },
];

export function isDistrictArea(areaId: string): boolean {
  return String(areaId ?? "").trim().split("-").length <= 3;
}

export function i18nWorkflowClassTitle(displayClass: DisplayTextClass): string {
  if (displayClass === "general") return "General";
  if (displayClass === "data_driven") return "Data-Driven";
  if (displayClass === "profile") return "Profile";
  if (displayClass === "marketing") return "Marketing";
  return "Market Expert";
}

export function i18nWorkflowClassDescription(displayClass: DisplayTextClass): string {
  if (displayClass === "general") return "texttyp: Allgemein, Erklaerung";
  if (displayClass === "data_driven") return "texttyp: Datenbasierender Text";
  if (displayClass === "profile") return "texttyp: Vortstellung Berater, Makler";
  if (displayClass === "marketing") return "texttyp: SEO, GEO";
  return "texttyp: Expertentext zu Markt/Region";
}

export function i18nWorkflowClassCycle(displayClass: DisplayTextClass): string {
  if (displayClass === "general") return "zyklus: einmal, punktuell";
  if (displayClass === "data_driven") return "zyklus: quartal";
  if (displayClass === "profile") return "zyklus: einmal, punktuell";
  if (displayClass === "marketing") return "zyklus: quartal";
  return "zyklus: quartal";
}

export function i18nWorkflowNeedsQualityCheck(displayClass: DisplayTextClass): boolean {
  return displayClass !== "data_driven";
}
