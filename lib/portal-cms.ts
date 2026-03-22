export type PortalLocaleStatus = "planned" | "internal" | "live";

export type PortalContentEntryStatus = "draft" | "internal" | "live";

export type PortalLocaleConfigRecord = {
  locale: string;
  status: PortalLocaleStatus;
  partner_bookable: boolean;
  is_active: boolean;
  label_native?: string | null;
  label_de?: string | null;
  bcp47_tag?: string | null;
  fallback_locale?: string | null;
  text_direction?: "ltr" | "rtl" | null;
  number_locale?: string | null;
  date_locale?: string | null;
  currency_code?: string | null;
  billing_feature_code?: string | null;
  updated_at?: string | null;
};

export type PortalContentFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "textarea" | "block_content" | "content_wraps";
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

export type PortalContentWrapTextBlock = Extract<PortalContentBlock, { type: "heading" | "paragraph" }>;

export type PortalContentWrap = {
  id: string;
  title: string;
  show_title?: boolean;
  blocks: PortalContentWrapTextBlock[];
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
    label_native: "Deutsch",
    label_de: "Deutsch",
    bcp47_tag: "de-DE",
    fallback_locale: "de",
    text_direction: "ltr",
    number_locale: "de-DE",
    date_locale: "de-DE",
    currency_code: "EUR",
    billing_feature_code: "international",
  },
  {
    locale: "en",
    status: "planned",
    partner_bookable: false,
    is_active: false,
    label_native: "English",
    label_de: "Englisch",
    bcp47_tag: "en-US",
    fallback_locale: "de",
    text_direction: "ltr",
    number_locale: "en-US",
    date_locale: "en-US",
    currency_code: "EUR",
    billing_feature_code: "international_en",
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
        section_key: "impressum_content",
        label: "Content-Wraps",
        description: "Frei anlegbare Inhaltsbereiche fuer das portalweite Impressum.",
        fields: [
          {
            key: "wraps",
            label: "Content-Wraps",
            type: "content_wraps",
            help: "Frei anlegbare Inhaltsbereiche mit Titel sowie Textblöcken für Überschriften und Absätze.",
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
        section_key: "privacy_content",
        label: "Content-Wraps",
        description: "Frei anlegbare Inhaltsbereiche fuer die portalweiten Datenschutztexte.",
        fields: [
          {
            key: "wraps",
            label: "Content-Wraps",
            type: "content_wraps",
            help: "Frei anlegbare Inhaltsbereiche mit Titel sowie Textblöcken für Überschriften und Absätze.",
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
  if (field.type === "block_content" || field.type === "content_wraps") return "[]";
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

function normalizePortalWrapTitle(raw: unknown): string {
  return String(raw ?? "").trim();
}

function buildPortalWrapId(index: number): string {
  return `wrap_${index + 1}`;
}

function convertPortalBlocksToWrapTextBlocks(blocks: PortalContentBlock[]): PortalContentWrapTextBlock[] {
  const normalized: PortalContentWrapTextBlock[] = [];
  for (const block of blocks) {
    if (block.type === "heading") {
      normalized.push({ type: "heading", level: block.level, text: block.text });
      continue;
    }
    if (block.type === "paragraph") {
      normalized.push({ type: "paragraph", text: block.text });
      continue;
    }
    if (block.type === "list") {
      const lines = block.items.map((item, index) => (
        block.style === "ordered" ? `${index + 1}. ${item}` : `• ${item}`
      ));
      if (lines.length > 0) normalized.push({ type: "paragraph", text: lines.join("\n") });
      continue;
    }
    if (block.type === "link_list") {
      const lines = block.items.map((item) => `${item.label}: ${item.href}`);
      if (lines.length > 0) normalized.push({ type: "paragraph", text: lines.join("\n") });
      continue;
    }
    if (block.type === "contact") {
      if (block.lines.length > 0) normalized.push({ type: "paragraph", text: block.lines.join("\n") });
      continue;
    }
    if (block.type === "note" && block.text.trim()) {
      normalized.push({ type: "paragraph", text: block.text });
    }
  }
  return normalized;
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

function parsePortalContentWrapBlocks(value: unknown): PortalContentWrapTextBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: PortalContentWrapTextBlock[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const block = entry as Record<string, unknown>;
    const type = String(block.type ?? "").trim();
    if (type === "heading") {
      const level = Number(block.level);
      const text = String(block.text ?? "");
      if (![1, 2, 3].includes(level)) continue;
      blocks.push({ type: "heading", level: level as 1 | 2 | 3, text });
      continue;
    }
    if (type === "paragraph") {
      const text = String(block.text ?? "");
      blocks.push({ type: "paragraph", text });
    }
  }
  return blocks;
}

export function parsePortalContentWraps(value: string): PortalContentWrap[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const wraps: PortalContentWrap[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const wrap = entry as Record<string, unknown>;
      const blocks = parsePortalContentWrapBlocks(wrap.blocks);
      const title = normalizePortalWrapTitle(wrap.title);
      wraps.push({
        id: String(wrap.id ?? buildPortalWrapId(wraps.length)),
        title,
        show_title: wrap.show_title === true,
        blocks,
      });
    }
    return wraps;
  } catch {
    return [];
  }
}

export function serializePortalContentWraps(wraps: PortalContentWrap[]): string {
  return JSON.stringify(
    wraps.map((wrap, index) => ({
      id: String(wrap.id ?? buildPortalWrapId(index)),
      title: normalizePortalWrapTitle(wrap.title),
      show_title: wrap.show_title === true,
      blocks: wrap.blocks.map((block) => (
        block.type === "heading"
          ? { type: "heading", level: block.level, text: String(block.text ?? "") }
          : { type: "paragraph", text: String(block.text ?? "") }
      )),
    })),
  );
}

const LEGACY_PORTAL_WRAP_LABELS: Record<string, string> = {
  impressum_main: "Impressum",
  privacy_intro: "Einleitung",
  privacy_collection: "Datenerhebung",
  privacy_tools: "Tools und Dienste",
  privacy_rights: "Rechte und Kontakt",
};

function buildLegacyWrapFromEntry(
  sectionKey: string,
  fields: Record<string, string>,
  index: number,
): PortalContentWrap | null {
  const parsedBlocks = parsePortalContentBlocks(String(fields.blocks ?? ""));
  const migratedBlocks = parsedBlocks.length > 0
    ? convertPortalBlocksToWrapTextBlocks(parsedBlocks)
    : convertPortalBlocksToWrapTextBlocks(migrateLegacyBlocks("datenschutz", sectionKey, fields) ?? migrateLegacyBlocks("impressum", sectionKey, fields) ?? []);
  if (migratedBlocks.length === 0) return null;
  return {
    id: buildPortalWrapId(index),
    title: LEGACY_PORTAL_WRAP_LABELS[sectionKey] ?? `Bereich ${index + 1}`,
    show_title: false,
    blocks: migratedBlocks,
  };
}

export function migratePortalContentWraps(
  pageKey: string,
  entries: Array<Pick<PortalContentEntryRecord, "section_key" | "fields_json">>,
): PortalContentWrap[] {
  if (pageKey === "impressum") {
    const legacyEntry = entries.find((entry) => entry.section_key === "impressum_main");
    if (!legacyEntry) return [];
    const wrap = buildLegacyWrapFromEntry("impressum_main", legacyEntry.fields_json, 0);
    return wrap ? [wrap] : [];
  }

  if (pageKey === "datenschutz") {
    const order = ["privacy_intro", "privacy_collection", "privacy_tools", "privacy_rights"];
    return order.flatMap((sectionKey, index) => {
      const legacyEntry = entries.find((entry) => entry.section_key === sectionKey);
      if (!legacyEntry) return [];
      const wrap = buildLegacyWrapFromEntry(sectionKey, legacyEntry.fields_json, index);
      return wrap ? [wrap] : [];
    });
  }

  return [];
}

export function normalizePortalCmsFields(
  section: PortalContentSectionDefinition,
  rawFields: Record<string, string> | null | undefined,
): Record<string, string> {
  const fields = rawFields ?? {};
  return section.fields.reduce<Record<string, string>>((acc, field) => {
    if (field.type === "content_wraps") {
      const existing = String(fields[field.key] ?? "").trim();
      if (existing) {
        const parsed = parsePortalContentWraps(existing);
        acc[field.key] = serializePortalContentWraps(parsed);
        return acc;
      }
      acc[field.key] = serializePortalContentWraps([]);
      return acc;
    }
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
