import { normalizePublicLocale } from "@/lib/public-locale-routing";

type PortalSystemTextMap = {
  skip_to_content: string;
  preview: string;
  navigation: string;
  open_navigation: string;
  close: string;
  contact: string;
  all_rights_reserved: string;
  imprint: string;
  privacy: string;
  price_check: string;
  market_profiles: string;
  concept: string;
  more_content: string;
};

const PORTAL_SYSTEM_TEXTS: Record<string, PortalSystemTextMap> = {
  de: {
    skip_to_content: "Zum Inhalt springen",
    preview: "Preview",
    navigation: "Navigation",
    open_navigation: "Navigation öffnen",
    close: "Schließen",
    contact: "Kontakt",
    all_rights_reserved: "Alle Rechte vorbehalten.",
    imprint: "Impressum",
    privacy: "Datenschutz",
    price_check: "Preischeck",
    market_profiles: "Immobilienmarkt & Standortprofile",
    concept: "Konzept",
    more_content: "Weitere Inhalte",
  },
  en: {
    skip_to_content: "Skip to content",
    preview: "Preview",
    navigation: "Navigation",
    open_navigation: "Open navigation",
    close: "Close",
    contact: "Contact",
    all_rights_reserved: "All rights reserved.",
    imprint: "Legal notice",
    privacy: "Privacy",
    price_check: "Price check",
    market_profiles: "Market & location profiles",
    concept: "Concept",
    more_content: "More content",
  },
};

export function getPortalSystemTexts(locale: string | null | undefined): PortalSystemTextMap {
  const normalized = normalizePublicLocale(locale);
  return PORTAL_SYSTEM_TEXTS[normalized] ?? PORTAL_SYSTEM_TEXTS.de;
}
