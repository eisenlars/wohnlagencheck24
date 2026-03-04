export const MANDATORY_MEDIA_KEYS = [
  "media_berater_avatar",
  "media_makler_logo",
  "media_makler_bild_01",
  "media_makler_bild_02",
] as const;

export type MandatoryMediaKey = (typeof MANDATORY_MEDIA_KEYS)[number];

export type MandatoryMediaSpec = {
  key: MandatoryMediaKey;
  label: string;
  maxWidth: number;
  maxHeight: number;
  maxUploadBytes: number;
};

export const MANDATORY_MEDIA_SPECS: Record<MandatoryMediaKey, MandatoryMediaSpec> = {
  media_berater_avatar: {
    key: "media_berater_avatar",
    label: "Berater-Avatar",
    maxWidth: 220,
    maxHeight: 220,
    maxUploadBytes: 300_000,
  },
  media_makler_logo: {
    key: "media_makler_logo",
    label: "Makler-Logo",
    maxWidth: 240,
    maxHeight: 240,
    maxUploadBytes: 300_000,
  },
  media_makler_bild_01: {
    key: "media_makler_bild_01",
    label: "Makler-Bild 01",
    maxWidth: 1040,
    maxHeight: 720,
    maxUploadBytes: 450_000,
  },
  media_makler_bild_02: {
    key: "media_makler_bild_02",
    label: "Makler-Bild 02",
    maxWidth: 1040,
    maxHeight: 720,
    maxUploadBytes: 450_000,
  },
};

export function isMandatoryMediaKey(value: string): value is MandatoryMediaKey {
  return (MANDATORY_MEDIA_KEYS as readonly string[]).includes(value);
}

export function getMandatoryMediaLabel(key: string): string {
  if (isMandatoryMediaKey(key)) return MANDATORY_MEDIA_SPECS[key].label;
  return key;
}

export function buildMandatoryMediaStoragePath(args: {
  partnerId: string;
  areaId: string;
  key: MandatoryMediaKey;
}): string {
  const partner = String(args.partnerId).trim();
  const area = String(args.areaId).trim();
  const key = String(args.key).trim();
  return `media/partner/${partner}/${area}/${key}.webp`;
}

export function looksLikePlaceholderMediaUrl(url: string): boolean {
  const normalized = String(url ?? "").toLowerCase();
  if (!normalized) return true;
  return normalized.includes("placeholder");
}

export function getMandatoryMediaPlaceholderPath(key: MandatoryMediaKey): string {
  switch (key) {
    case "media_berater_avatar":
      return "/images/placeholders/berater-avatar-placeholder.svg";
    case "media_makler_logo":
      return "/images/placeholders/makler-logo-placeholder.svg";
    case "media_makler_bild_01":
      return "/images/placeholders/makler-bild-01-placeholder.svg";
    case "media_makler_bild_02":
      return "/images/placeholders/makler-bild-02-placeholder.svg";
    default:
      return "/images/placeholders/image-placeholder.svg";
  }
}

export function resolveMandatoryMediaSrc(key: MandatoryMediaKey, candidate: unknown): string {
  const raw = String(candidate ?? "").trim();
  if (!raw) return getMandatoryMediaPlaceholderPath(key);

  const normalized = raw.toLowerCase();
  const isPartnerStoragePublicUrl = normalized.includes(
    "/storage/v1/object/public/immobilienmarkt/media/partner/",
  );
  const isPartnerStorageRelativePath = normalized.startsWith("/media/partner/");
  const isLocalPlaceholder = normalized.startsWith("/images/placeholders/");

  if (isPartnerStoragePublicUrl || isPartnerStorageRelativePath || isLocalPlaceholder) {
    return raw;
  }

  return getMandatoryMediaPlaceholderPath(key);
}
