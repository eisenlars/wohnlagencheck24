export type MarketingBadgeTone = "dark" | "success" | "warning" | "info" | "neutral";

export type MarketingBadge = {
  key: string;
  label: string;
  tone: MarketingBadgeTone;
};

const DEFAULT_NEW_DAYS = 14;
const TONES = new Set<MarketingBadgeTone>(["dark", "success", "warning", "info", "neutral"]);
const BADGE_DEFINITIONS: Record<string, MarketingBadge> = {
  top: { key: "top", label: "Top", tone: "dark" },
  new: { key: "new", label: "NEU", tone: "warning" },
  object_of_week: { key: "object_of_week", label: "Objekt der Woche", tone: "info" },
  object_of_day: { key: "object_of_day", label: "Objekt des Tages", tone: "info" },
  featured: { key: "featured", label: "Highlight", tone: "dark" },
  commission_free: { key: "commission_free", label: "Courtagefrei", tone: "success" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = normalizeText(value);
  return ["1", "true", "ja", "j", "yes", "y", "neu", "new"].includes(normalized);
}

function normalizeBadgeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeBadgeTone(value: unknown, fallback: MarketingBadgeTone): MarketingBadgeTone {
  const normalized = normalizeBadgeKey(value) as MarketingBadgeTone;
  return TONES.has(normalized) ? normalized : fallback;
}

function readAnyFlag(raw: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!raw) return false;
  const marketing = isRecord(raw.marketing) ? raw.marketing : {};
  const customFields = isRecord(raw.custom_fields) ? raw.custom_fields : {};
  for (const key of keys) {
    if (readBoolean(raw[key]) || readBoolean(marketing[key]) || readBoolean(customFields[key])) return true;
  }
  return false;
}

function hasRecentDate(value: string | null | undefined, days = DEFAULT_NEW_DAYS): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function addBadge(target: MarketingBadge[], badge: MarketingBadge): void {
  if (target.some((item) => item.key === badge.key)) return;
  target.push(badge);
}

export function normalizeMarketingBadgeList(value: unknown): MarketingBadge[] {
  if (!Array.isArray(value)) return [];
  const badges: MarketingBadge[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const key = normalizeBadgeKey(entry);
      const definition = BADGE_DEFINITIONS[key];
      if (definition) addBadge(badges, definition);
      continue;
    }
    if (!isRecord(entry)) continue;
    const key = normalizeBadgeKey(entry.key);
    if (!key) continue;
    const definition = BADGE_DEFINITIONS[key];
    const label = String(entry.label ?? definition?.label ?? key).trim();
    if (!label) continue;
    addBadge(badges, {
      key,
      label,
      tone: normalizeBadgeTone(entry.tone, definition?.tone ?? "neutral"),
    });
  }
  return badges;
}

export function buildNewMarketingBadge(updatedAt: string | null | undefined, days = DEFAULT_NEW_DAYS): MarketingBadge | null {
  if (!hasRecentDate(updatedAt, days)) return null;
  return BADGE_DEFINITIONS.new;
}

export function normalizeOfferMarketingBadges(args: {
  marketingFlags?: unknown;
  raw?: Record<string, unknown> | null;
  isTop?: boolean | null;
  updatedAt?: string | null;
  statusBadge?: string | null;
}): MarketingBadge[] {
  const raw = args.raw ?? null;
  const badges = normalizeMarketingBadgeList(args.marketingFlags);

  if (args.isTop || readAnyFlag(raw, ["top", "is_top", "top_object", "topobjekt", "top_angebot"])) {
    addBadge(badges, BADGE_DEFINITIONS.top);
  }

  if (readAnyFlag(raw, ["is_new", "new", "neu", "new_listing", "new_object", "objekt_neu", "is_new_listing"])) {
    addBadge(badges, BADGE_DEFINITIONS.new);
  } else if (!badges.some((badge) => badge.key === "new")) {
    const recentBadge = buildNewMarketingBadge(args.updatedAt);
    if (recentBadge) addBadge(badges, recentBadge);
  }

  if (readAnyFlag(raw, ["property_of_the_week", "object_of_week", "objekt_der_woche", "immobilie_der_woche", "property_of_week"])) {
    addBadge(badges, BADGE_DEFINITIONS.object_of_week);
  }

  if (readAnyFlag(raw, ["property_of_the_day", "object_of_day", "objekt_des_tages", "immobilie_des_tages", "property_of_day"])) {
    addBadge(badges, BADGE_DEFINITIONS.object_of_day);
  }

  if (readAnyFlag(raw, ["featured", "highlight", "highlighted", "is_featured"])) {
    addBadge(badges, BADGE_DEFINITIONS.featured);
  }

  if (readAnyFlag(raw, ["free_commission", "courtage_frei", "commission_free", "provisionsfrei"])) {
    addBadge(badges, BADGE_DEFINITIONS.commission_free);
  }

  const statusBadge = String(args.statusBadge ?? "").trim();
  if (statusBadge) {
    addBadge(badges, {
      key: statusBadge.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "status",
      label: statusBadge,
      tone: statusBadge.toLowerCase().includes("reserv") ? "neutral" : "info",
    });
  }

  return badges;
}
