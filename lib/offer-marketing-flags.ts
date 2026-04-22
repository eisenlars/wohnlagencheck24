export type MarketingBadgeTone = "dark" | "success" | "warning" | "info" | "neutral";

export type MarketingBadge = {
  key: string;
  label: string;
  tone: MarketingBadgeTone;
};

const DEFAULT_NEW_DAYS = 14;

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

function readAnyFlag(raw: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!raw) return false;
  const marketing = isRecord(raw.marketing) ? raw.marketing : {};
  for (const key of keys) {
    if (readBoolean(raw[key]) || readBoolean(marketing[key])) return true;
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

export function buildNewMarketingBadge(updatedAt: string | null | undefined, days = DEFAULT_NEW_DAYS): MarketingBadge | null {
  if (!hasRecentDate(updatedAt, days)) return null;
  return { key: "new", label: "NEU", tone: "warning" };
}

export function normalizeOfferMarketingBadges(args: {
  raw?: Record<string, unknown> | null;
  isTop?: boolean | null;
  updatedAt?: string | null;
  statusBadge?: string | null;
}): MarketingBadge[] {
  const raw = args.raw ?? null;
  const badges: MarketingBadge[] = [];

  if (args.isTop) {
    addBadge(badges, { key: "top", label: "Top", tone: "dark" });
  }

  if (readAnyFlag(raw, ["is_new", "new", "neu", "new_listing", "new_object", "objekt_neu"])) {
    addBadge(badges, { key: "new", label: "NEU", tone: "warning" });
  } else {
    const recentBadge = buildNewMarketingBadge(args.updatedAt);
    if (recentBadge) addBadge(badges, recentBadge);
  }

  if (readAnyFlag(raw, ["property_of_the_week", "object_of_week", "objekt_der_woche", "immobilie_der_woche"])) {
    addBadge(badges, { key: "object_of_week", label: "Objekt der Woche", tone: "info" });
  }

  if (readAnyFlag(raw, ["property_of_the_day", "object_of_day", "objekt_des_tages", "immobilie_des_tages"])) {
    addBadge(badges, { key: "object_of_day", label: "Objekt des Tages", tone: "info" });
  }

  if (readAnyFlag(raw, ["featured", "highlight", "highlighted", "is_featured"])) {
    addBadge(badges, { key: "featured", label: "Highlight", tone: "dark" });
  }

  if (readAnyFlag(raw, ["free_commission", "courtage_frei", "commission_free", "provisionsfrei"])) {
    addBadge(badges, { key: "commission_free", label: "Courtagefrei", tone: "success" });
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
