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
  type: "text" | "textarea" | "block_content";
  placeholder?: string;
  help?: string;
};

export type PortalContentBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; style: "unordered" | "ordered"; items: string[] }
  | { type: "link_list"; items: Array<{ label: string; href: string }> }
  | { type: "contact"; lines: string[] }
  | { type: "note"; variant: "info" | "warning"; text: string };

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
          {
            key: "blocks",
            label: "Inhaltsblöcke",
            type: "block_content",
            help: "Strukturierte Blöcke für Überschriften, Absätze, Listen, Links und Kontaktangaben.",
          },
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
          {
            key: "blocks",
            label: "Inhaltsblöcke",
            type: "block_content",
            help: "Strukturierte Blöcke für Überschrift, Einleitung und Verantwortliche Stelle.",
          },
        ],
      },
      {
        page_key: "datenschutz",
        section_key: "privacy_collection",
        label: "Datenerhebung",
        description: "Erhebung, Speicherung und Nutzung personenbezogener Daten.",
        fields: [
          {
            key: "blocks",
            label: "Inhaltsblöcke",
            type: "block_content",
            help: "Strukturierte Blöcke für Datenerhebung, Speicherung und Nutzung.",
          },
        ],
      },
      {
        page_key: "datenschutz",
        section_key: "privacy_tools",
        label: "Tools und Dienste",
        description: "Hinweise zu Analyse-, Marketing- oder Trackingtools.",
        fields: [
          {
            key: "blocks",
            label: "Inhaltsblöcke",
            type: "block_content",
            help: "Strukturierte Blöcke für Analyse-, Marketing- oder Trackingtools.",
          },
        ],
      },
      {
        page_key: "datenschutz",
        section_key: "privacy_rights",
        label: "Rechte und Kontakt",
        description: "Betroffenenrechte, Kontakt und abschliessende Hinweise.",
        fields: [
          {
            key: "blocks",
            label: "Inhaltsblöcke",
            type: "block_content",
            help: "Strukturierte Blöcke für Betroffenenrechte, Kontakt und Schlussabschnitt.",
          },
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

function buildPortalCmsEmptyFieldValue(field: PortalContentFieldDefinition): string {
  if (field.type === "block_content") return "[]";
  return "";
}

export function buildPortalCmsEmptyFields(section: PortalContentSectionDefinition): Record<string, string> {
  return section.fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = buildPortalCmsEmptyFieldValue(field);
    return acc;
  }, {});
}

function normalizeTextLines(raw: unknown): string[] {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function migrateLegacyBlocks(pageKey: string, sectionKey: string, fields: Record<string, string>): PortalContentBlock[] | null {
  if (pageKey === "impressum" && sectionKey === "impressum_main") {
    const blocks: PortalContentBlock[] = [];
    const headline = String(fields.headline ?? "").trim();
    const companyLines = normalizeTextLines(fields.company_block);
    const contactLines = normalizeTextLines(fields.contact_block);
    const legalText = String(fields.legal_block ?? "").trim();
    if (headline) blocks.push({ type: "heading", level: 1, text: headline });
    if (companyLines.length > 0) blocks.push({ type: "contact", lines: companyLines });
    if (contactLines.length > 0) blocks.push({ type: "contact", lines: contactLines });
    if (legalText) blocks.push({ type: "paragraph", text: legalText });
    return blocks.length > 0 ? blocks : null;
  }

  if (pageKey === "datenschutz" && sectionKey === "privacy_intro") {
    const blocks: PortalContentBlock[] = [];
    const headline = String(fields.headline ?? "").trim();
    const intro = String(fields.intro ?? "").trim();
    const responsibleLines = normalizeTextLines(fields.responsible_party);
    if (headline) blocks.push({ type: "heading", level: 1, text: headline });
    if (intro) blocks.push({ type: "paragraph", text: intro });
    if (responsibleLines.length > 0) blocks.push({ type: "contact", lines: responsibleLines });
    return blocks.length > 0 ? blocks : null;
  }

  if (pageKey === "datenschutz" && ["privacy_collection", "privacy_tools", "privacy_rights"].includes(sectionKey)) {
    const body = String(fields.body ?? "").trim();
    if (!body) return null;
    return [{ type: "paragraph", text: body }];
  }

  return null;
}

export function parsePortalContentBlocks(value: string): PortalContentBlock[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const blocks: PortalContentBlock[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const block = entry as Record<string, unknown>;
      const type = String(block.type ?? "").trim();
      if (type === "heading") {
        const level = Number(block.level);
        const text = String(block.text ?? "");
        if (![1, 2, 3].includes(level) || !text.trim()) continue;
        blocks.push({ type: "heading", level: level as 1 | 2 | 3, text });
        continue;
      }
      if (type === "paragraph") {
        const text = String(block.text ?? "");
        if (text.trim()) blocks.push({ type: "paragraph", text });
        continue;
      }
      if (type === "list") {
        const style = String(block.style ?? "unordered") === "ordered" ? "ordered" : "unordered";
        const items = Array.isArray(block.items) ? block.items.map((item) => String(item ?? "")).filter((item) => item.trim()) : [];
        if (items.length > 0) blocks.push({ type: "list", style, items });
        continue;
      }
      if (type === "link_list") {
        const items = Array.isArray(block.items)
          ? block.items.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            const label = String(row.label ?? "").trim();
            const href = String(row.href ?? "").trim();
            return label && href ? [{ label, href }] : [];
          })
          : [];
        if (items.length > 0) blocks.push({ type: "link_list", items });
        continue;
      }
      if (type === "contact") {
        const lines = Array.isArray(block.lines) ? block.lines.map((line) => String(line ?? "")).filter((line) => line.trim()) : [];
        if (lines.length > 0) blocks.push({ type: "contact", lines });
        continue;
      }
      if (type === "note") {
        const variant = String(block.variant ?? "info") === "warning" ? "warning" : "info";
        const text = String(block.text ?? "");
        if (text.trim()) blocks.push({ type: "note", variant, text });
        continue;
      }
    }
    return blocks;
  } catch {
    return [];
  }
}

export function serializePortalContentBlocks(blocks: PortalContentBlock[]): string {
  return JSON.stringify(blocks);
}

export function normalizePortalCmsFields(
  section: PortalContentSectionDefinition,
  rawFields: Record<string, string> | null | undefined,
): Record<string, string> {
  const fields = rawFields ?? {};
  return section.fields.reduce<Record<string, string>>((acc, field) => {
    if (field.type === "block_content") {
      const existing = String(fields[field.key] ?? "").trim();
      if (existing) {
        const parsed = parsePortalContentBlocks(existing);
        acc[field.key] = serializePortalContentBlocks(parsed);
        return acc;
      }
      const migrated = migrateLegacyBlocks(section.page_key, section.section_key, fields);
      acc[field.key] = serializePortalContentBlocks(migrated ?? []);
      return acc;
    }
    acc[field.key] = String(fields[field.key] ?? buildPortalCmsEmptyFieldValue(field));
    return acc;
  }, {});
}
