export type PortalLocaleStatus = "planned" | "internal" | "live";

export type PortalContentEntryStatus = "draft" | "internal" | "live";

export type PortalLocaleConfigRecord = {
  locale: string;
  status: PortalLocaleStatus;
  partner_bookable: boolean;
  is_active: boolean;
  updated_at?: string | null;
};

export type PortalContentFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "textarea";
  placeholder?: string;
  help?: string;
};

export type PortalContentSectionDefinition = {
  page_key: string;
  section_key: string;
  label: string;
  description: string;
  fields: PortalContentFieldDefinition[];
};

export type PortalContentPageDefinition = {
  page_key: string;
  label: string;
  note: string;
  sort_order: number;
  sections: PortalContentSectionDefinition[];
};

export type PortalContentEntryRecord = {
  page_key: string;
  section_key: string;
  locale: string;
  status: PortalContentEntryStatus;
  fields_json: Record<string, string>;
  updated_at?: string | null;
};

export const DEFAULT_PORTAL_LOCALES: PortalLocaleConfigRecord[] = [
  {
    locale: "de",
    status: "live",
    partner_bookable: false,
    is_active: true,
  },
  {
    locale: "en",
    status: "planned",
    partner_bookable: false,
    is_active: false,
  },
];

const PORTAL_CMS_PAGES: PortalContentPageDefinition[] = [
  {
    page_key: "home",
    label: "Startseite",
    note: "Hero, Einfuehrung und zentrale Portalbotschaften der Startseite.",
    sort_order: 10,
    sections: [
      {
        page_key: "home",
        section_key: "home_hero",
        label: "Hero",
        description: "Einstieg oben auf der Startseite mit Hauptheadline, Claim und Intro.",
        fields: [
          { key: "headline", label: "Headline", type: "text", placeholder: "Wohnlagencheck24 - Immobilienmarkt & Standortprofile" },
          { key: "claim", label: "Claim", type: "text", placeholder: "DATA-DRIVEN. EXPERT-LED." },
          { key: "intro", label: "Intro", type: "textarea", placeholder: "Kurze Einfuehrung zur Startseite." },
        ],
      },
      {
        page_key: "home",
        section_key: "home_breaker",
        label: "Breaker",
        description: "Kurzer Leitgedanke unterhalb des Heros.",
        fields: [
          { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "DATA-DRIVEN. EXPERT-LED." },
          { key: "subheadline", label: "Subheadline", type: "text", placeholder: "Harte Daten. Lokales Gespuer." },
          { key: "body", label: "Text", type: "textarea", placeholder: "Kurze Erklaerung zum Ansatz." },
        ],
      },
      {
        page_key: "home",
        section_key: "home_more_content",
        label: "Weitere Inhalte",
        description: "Einleitung fuer spaetere Zusatzinhalte auf der Startseite.",
        fields: [
          { key: "headline", label: "Headline", type: "text", placeholder: "Weitere Inhalte" },
          { key: "body_primary", label: "Text 1", type: "textarea", placeholder: "Erster erklaerender Absatz." },
          { key: "body_secondary", label: "Text 2", type: "textarea", placeholder: "Zweiter erklaerender Absatz." },
        ],
      },
    ],
  },
  {
    page_key: "concept",
    label: "Konzept",
    note: "Konzept-Bereich der Startseite bzw. spaeter eigenstaendige Konzeptseite.",
    sort_order: 20,
    sections: [
      {
        page_key: "concept",
        section_key: "concept_intro",
        label: "Konzept Intro",
        description: "Technische Einordnung, Vision und Aufbau des Portals.",
        fields: [
          { key: "badge", label: "Badge", type: "text", placeholder: "Technisches Demo · GEO & LLM-ready" },
          { key: "headline", label: "Headline", type: "text", placeholder: "Wohnlagencheck24 - Immobilienmarkt & Standortprofile" },
          { key: "body_primary", label: "Text 1", type: "textarea", placeholder: "Erster Konzeptabsatz." },
          { key: "body_secondary", label: "Text 2", type: "textarea", placeholder: "Zweiter Konzeptabsatz." },
        ],
      },
    ],
  },
  {
    page_key: "impressum",
    label: "Impressum",
    note: "Portalweites Impressum und Anbieterkennzeichnung.",
    sort_order: 30,
    sections: [
      {
        page_key: "impressum",
        section_key: "impressum_main",
        label: "Pflichtangaben",
        description: "Zentral gepflegte Impressumsinhalte fuer das Portal.",
        fields: [
          { key: "headline", label: "Headline", type: "text", placeholder: "Impressum" },
          { key: "company_block", label: "Unternehmen / Anschrift", type: "textarea", placeholder: "Unternehmen, Anschrift, Vertretung." },
          { key: "contact_block", label: "Kontakt", type: "textarea", placeholder: "Telefon, Fax, E-Mail." },
          { key: "legal_block", label: "Rechtstext", type: "textarea", placeholder: "Rechtliche Hinweise und Haftung." },
        ],
      },
    ],
  },
  {
    page_key: "datenschutz",
    label: "Datenschutz",
    note: "Portalweite Datenschutztexte und rechtliche Hinweise.",
    sort_order: 40,
    sections: [
      {
        page_key: "datenschutz",
        section_key: "privacy_intro",
        label: "Einleitung",
        description: "Einleitende Datenschutzhinweise und Verantwortliche.",
        fields: [
          { key: "headline", label: "Headline", type: "text", placeholder: "Datenschutz" },
          { key: "intro", label: "Einleitung", type: "textarea", placeholder: "Kurze Datenschutzeinleitung." },
          { key: "responsible_party", label: "Verantwortliche Stelle", type: "textarea", placeholder: "Name, Anschrift, Kontakt." },
        ],
      },
      {
        page_key: "datenschutz",
        section_key: "privacy_collection",
        label: "Datenerhebung",
        description: "Erhebung, Speicherung und Nutzung personenbezogener Daten.",
        fields: [
          { key: "body", label: "Text", type: "textarea", placeholder: "Angaben zur Datenerhebung und Speicherung." },
        ],
      },
      {
        page_key: "datenschutz",
        section_key: "privacy_tools",
        label: "Tools und Dienste",
        description: "Hinweise zu Analyse-, Marketing- oder Trackingtools.",
        fields: [
          { key: "body", label: "Text", type: "textarea", placeholder: "Angaben zu Analytics, Marketing Automation oder weiteren Diensten." },
        ],
      },
      {
        page_key: "datenschutz",
        section_key: "privacy_rights",
        label: "Rechte und Kontakt",
        description: "Betroffenenrechte, Kontakt und abschliessende Hinweise.",
        fields: [
          { key: "body", label: "Text", type: "textarea", placeholder: "Betroffenenrechte, Kontakt und Schlussabschnitt." },
        ],
      },
    ],
  },
];

export function getPortalCmsPages(): PortalContentPageDefinition[] {
  return PORTAL_CMS_PAGES.slice().sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "de"));
}

export function getPortalCmsPage(pageKey: string): PortalContentPageDefinition | null {
  return getPortalCmsPages().find((page) => page.page_key === pageKey) ?? null;
}

export function getPortalCmsSection(pageKey: string, sectionKey: string): PortalContentSectionDefinition | null {
  const page = getPortalCmsPage(pageKey);
  return page?.sections.find((section) => section.section_key === sectionKey) ?? null;
}

export function buildPortalCmsEmptyFields(section: PortalContentSectionDefinition): Record<string, string> {
  return section.fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
}
