import {
  MARKET_EXPLANATION_STANDARD_TABS,
  type MarketExplanationStandardTabId,
} from "@/lib/market-explanation-standard-text-definitions";

export type MarketExplanationFaqEntryStatus = "draft" | "internal" | "live";

export type MarketExplanationFaqEntryRecord = {
  tab_id: MarketExplanationStandardTabId;
  item_id: string;
  locale: string;
  status: MarketExplanationFaqEntryStatus;
  question: string;
  answer: string;
  sort_order: number;
  updated_at?: string | null;
};

export type MarketExplanationFaqI18nMetaRecord = {
  tab_id: MarketExplanationStandardTabId;
  item_id: string;
  locale: string;
  source_locale: string;
  source_snapshot_hash: string | null;
  source_updated_at: string | null;
  translation_origin: "manual" | "ai" | "sync_copy_all" | "sync_fill_missing";
  updated_at?: string | null;
};

export type MarketExplanationFaqI18nMetaViewRecord =
  MarketExplanationFaqI18nMetaRecord & {
    translation_is_stale: boolean;
    effective_source_question: string;
    effective_source_answer: string;
  };

export type MarketExplanationFaqItem = {
  item_id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export type MarketExplanationFaqMap = Record<MarketExplanationStandardTabId, MarketExplanationFaqItem[]>;

const GENERAL_DEFAULT_ITEMS: MarketExplanationFaqItem[] = [
  {
    item_id: "faq_01",
    question: "Wie aktuell sind die Daten im Marktbericht?",
    answer:
      "Die Kennzahlen basieren auf aktuellen Angebotsdaten. Das Aktualisierungsdatum finden Sie im Kopfbereich des Reports (Meta).",
    sort_order: 0,
  },
  {
    item_id: "faq_02",
    question: 'Was bedeutet "Angebotsmiete"?',
    answer:
      "Angebotsmieten sind inserierte Neuangebote. Sie koennen von tatsaechlich vereinbarten Mieten abweichen (z. B. durch Verhandlung oder abweichende Ausstattung).",
    sort_order: 1,
  },
  {
    item_id: "faq_03",
    question: "Warum unterscheiden sich Preise und Mieten zwischen Ortslagen so stark?",
    answer:
      "Preis- und Mietunterschiede ergeben sich u. a. aus Lagequalitaet, Mikrolage, Objektmix, Zustand/Energieeffizienz sowie Angebot und Nachfrage.",
    sort_order: 2,
  },
  {
    item_id: "faq_04",
    question: "Sind die Werte fuer Haeuser und Wohnungen direkt vergleichbar?",
    answer:
      "Nicht vollstaendig. Haeuser und Wohnungen unterscheiden sich haeufig in Objektqualitaet, Flaechenstruktur, Grundstuecksanteil und Nachfrageprofil. Vergleiche sollten stets innerhalb derselben Objektgruppe erfolgen.",
    sort_order: 3,
  },
  {
    item_id: "faq_05",
    question: "Wie lese ich Vorjahresveraenderungen und Indizes?",
    answer:
      "Vorjahreswerte zeigen die Veraenderung gegenueber dem Vorjahr. Indizes setzen ein Basisjahr oder eine Referenz auf 100 und zeigen die relative Entwicklung bzw. das relative Niveau.",
    sort_order: 4,
  },
];

const DE_DEFAULTS: MarketExplanationFaqMap = {
  uebersicht: GENERAL_DEFAULT_ITEMS,
  immobilienpreise: GENERAL_DEFAULT_ITEMS,
  mietpreise: GENERAL_DEFAULT_ITEMS,
  mietrendite: GENERAL_DEFAULT_ITEMS,
  wohnmarktsituation: [
    {
      item_id: "statistische_daten",
      question: "Woher stammen die statistischen Daten zum Standort {regionName}?",
      answer:
        "Die Quelle fuer die statistischen Informationen zur Bevoelkerung, zum Arbeitsmarkt und zur Wirtschaft sind die Statistischen Bundes- und Landesaemter.",
      sort_order: 0,
    },
    {
      item_id: "standortfaktoren",
      question: "Wie definieren sich die Standortfaktoren in {regionName}?",
      answer:
        "Die Standortfaktoren werden durch unsere regionalen Partner und Immobilienspezialisten bereitgestellt.",
      sort_order: 1,
    },
  ],
  grundstueckspreise: GENERAL_DEFAULT_ITEMS,
  wohnlagencheck: GENERAL_DEFAULT_ITEMS,
  wirtschaft: GENERAL_DEFAULT_ITEMS,
};

function cloneFaqItems(items: MarketExplanationFaqItem[]): MarketExplanationFaqItem[] {
  return items.map((item) => ({
    item_id: item.item_id,
    question: item.question,
    answer: item.answer,
    sort_order: item.sort_order,
  }));
}

export function normalizeMarketExplanationFaqTabId(value: unknown): MarketExplanationStandardTabId {
  const normalized = String(value ?? "").trim();
  if (!MARKET_EXPLANATION_STANDARD_TABS.some((tab) => tab.id === normalized)) {
    throw new Error(`Unbekannter Markterklaerung-FAQ-Tab: ${normalized}`);
  }
  return normalized as MarketExplanationStandardTabId;
}

export function getMarketExplanationFaqDefaultItems(
  tabId: MarketExplanationStandardTabId,
): MarketExplanationFaqItem[] {
  return cloneFaqItems(DE_DEFAULTS[tabId] ?? []);
}

export function getMarketExplanationFaqDefaultMap(): MarketExplanationFaqMap {
  return MARKET_EXPLANATION_STANDARD_TABS.reduce<MarketExplanationFaqMap>((acc, tab) => {
    acc[tab.id] = getMarketExplanationFaqDefaultItems(tab.id);
    return acc;
  }, {} as MarketExplanationFaqMap);
}

export function formatMarketExplanationFaqText(
  template: string,
  replacements: Record<string, string | number | null | undefined>,
): string {
  return String(template ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const value = replacements[token];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function buildMarketExplanationFaqEffectiveGermanItems(args: {
  tabId: MarketExplanationStandardTabId;
  entries: MarketExplanationFaqEntryRecord[];
}): MarketExplanationFaqItem[] {
  const germanRows = args.entries
    .filter((entry) => entry.tab_id === args.tabId && entry.locale === "de")
    .sort((left, right) => left.sort_order - right.sort_order || left.item_id.localeCompare(right.item_id));
  if (germanRows.length > 0) {
    return germanRows.map((entry) => ({
      item_id: entry.item_id,
      question: entry.question,
      answer: entry.answer,
      sort_order: entry.sort_order,
    }));
  }
  return getMarketExplanationFaqDefaultItems(args.tabId);
}
