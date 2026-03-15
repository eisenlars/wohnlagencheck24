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
  if (displayClass === "general") {
    return "Groessere Grundtexte, die erst nach inhaltlicher und qualitativer DE-Pruefung uebersetzt werden sollten.";
  }
  if (displayClass === "data_driven") {
    return "Datennahe Texte mit KPI-, Tabellen- und Chartbezug. Diese Inhalte muessen moeglichst aktuell gehalten werden.";
  }
  if (displayClass === "profile") {
    return "Kompakte Profiltexte fuer Berater und Makler, die meist nur punktuell nachgefuehrt werden.";
  }
  if (displayClass === "marketing") {
    return "SEO- und GEO-Inhalte mit Fokus auf Sichtbarkeit und konsistente Suchintention je Gebiet.";
  }
  return "Regionale Experteneinschaetzungen, die regelmaessig inhaltlich geprueft und nachgezogen werden sollten.";
}

export function i18nWorkflowClassCycle(displayClass: DisplayTextClass): string {
  if (displayClass === "general") return "Typischer Zyklus: einmalig + spaetere punktuelle Anpassungen.";
  if (displayClass === "data_driven") return "Typischer Zyklus: automatisiert bei Daten- oder Kontextaenderungen nachziehen.";
  if (displayClass === "profile") return "Typischer Zyklus: einmalig + punktuelle Profilpflege.";
  if (displayClass === "marketing") return "Typischer Zyklus: bei SEO-/GEO-Anpassungen und CTA-Aenderungen nachziehen.";
  return "Typischer Zyklus: mindestens quartalsweise und nach relevanten Marktaenderungen pruefen.";
}

export function i18nWorkflowNeedsQualityCheck(displayClass: DisplayTextClass): boolean {
  return displayClass !== "data_driven";
}
