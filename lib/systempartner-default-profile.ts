export const SYSTEMPARTNER_DEFAULT_PROFILE_BUCKET = "immobilienmarkt";
export const SYSTEMPARTNER_DEFAULT_PROFILE_PATH = "text-standards/systempartner/systempartner_default_profile.json";
export const SYSTEMPARTNER_DEFAULT_PROFILE_AVATAR_PATH = "media/systempartner/default/media_berater_avatar";

export const SYSTEMPARTNER_DEFAULT_PROFILE_KEYS = [
  "berater_name",
  "berater_email",
  "berater_telefon_fest",
  "berater_telefon_mobil",
  "media_berater_avatar",
] as const;

export const SYSTEMPARTNER_DEFAULT_PROFILE_REQUIRED_KEYS = [
  "berater_name",
  "berater_email",
  "berater_telefon_fest",
  "media_berater_avatar",
] as const;

export type SystempartnerDefaultProfileKey = (typeof SYSTEMPARTNER_DEFAULT_PROFILE_KEYS)[number];

export type SystempartnerDefaultProfile = Record<SystempartnerDefaultProfileKey, string>;
export type SystempartnerDefaultProfileRequiredKey = (typeof SYSTEMPARTNER_DEFAULT_PROFILE_REQUIRED_KEYS)[number];

export const EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE: SystempartnerDefaultProfile = {
  berater_name: "",
  berater_email: "",
  berater_telefon_fest: "",
  berater_telefon_mobil: "",
  media_berater_avatar: "",
};

type DownloadClient = {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{
        data?: { text: () => Promise<string> } | null;
        error?: { message?: string } | null;
      }>;
      upload: (
        path: string,
        body: string | File,
        options: { upsert: boolean; contentType: string; cacheControl: string },
      ) => Promise<{
        error?: { message?: string } | null;
      }>;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildPublicStorageUrl(relPath: string): string | null {
  const base = String(process.env.SUPABASE_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  const rel = relPath.replace(/^\/+/, "");
  return `${base}/${SYSTEMPARTNER_DEFAULT_PROFILE_BUCKET}/${rel}`;
}

export function normalizeSystempartnerDefaultProfile(value: unknown): SystempartnerDefaultProfile {
  const source = isRecord(value) ? value : {};
  return {
    berater_name: String(source.berater_name ?? ""),
    berater_email: String(source.berater_email ?? ""),
    berater_telefon_fest: String(source.berater_telefon_fest ?? ""),
    berater_telefon_mobil: String(source.berater_telefon_mobil ?? ""),
    media_berater_avatar: String(source.media_berater_avatar ?? ""),
  };
}

export async function downloadSystempartnerDefaultProfile(
  admin: DownloadClient,
): Promise<SystempartnerDefaultProfile> {
  const res = await admin.storage
    .from(SYSTEMPARTNER_DEFAULT_PROFILE_BUCKET)
    .download(SYSTEMPARTNER_DEFAULT_PROFILE_PATH);
  if (res.error || !res.data) return { ...EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE };
  const raw = await res.data.text();
  const parsed = JSON.parse(raw);
  return normalizeSystempartnerDefaultProfile(parsed);
}

export async function uploadSystempartnerDefaultProfile(
  admin: DownloadClient,
  profile: SystempartnerDefaultProfile,
): Promise<void> {
  const payload = normalizeSystempartnerDefaultProfile(profile);
  const res = await admin.storage
    .from(SYSTEMPARTNER_DEFAULT_PROFILE_BUCKET)
    .upload(SYSTEMPARTNER_DEFAULT_PROFILE_PATH, JSON.stringify(payload), {
      upsert: true,
      contentType: "application/json",
      cacheControl: "0",
    });
  if (res.error?.message) {
    throw new Error(res.error.message);
  }
}

export async function uploadSystempartnerDefaultAvatar(
  admin: DownloadClient,
  file: File,
): Promise<string> {
  const fileType = String(file.type ?? "").trim().toLowerCase();
  const contentType = fileType === "image/png" ? "image/png" : "image/webp";
  const res = await admin.storage
    .from(SYSTEMPARTNER_DEFAULT_PROFILE_BUCKET)
    .upload(SYSTEMPARTNER_DEFAULT_PROFILE_AVATAR_PATH, file, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });
  if (res.error?.message) {
    throw new Error(res.error.message);
  }
  const publicUrl = buildPublicStorageUrl(SYSTEMPARTNER_DEFAULT_PROFILE_AVATAR_PATH);
  if (!publicUrl) {
    throw new Error("SUPABASE_PUBLIC_BASE_URL fehlt");
  }
  return publicUrl;
}

export type SystempartnerDefaultProfileMandatoryResult =
  | {
      ok: true;
      missing: Array<{ key: SystempartnerDefaultProfileRequiredKey; reason: "missing" }>;
      profile: SystempartnerDefaultProfile;
    }
  | {
      ok: false;
      status: number;
      error: string;
      missing: Array<{ key: SystempartnerDefaultProfileRequiredKey; reason: "missing" }>;
      gate: "SYSTEMPARTNER_DEFAULT_MISSING";
      profile: SystempartnerDefaultProfile;
    };

export function getMissingSystempartnerDefaultProfileKeys(
  profile: SystempartnerDefaultProfile,
): SystempartnerDefaultProfileRequiredKey[] {
  return SYSTEMPARTNER_DEFAULT_PROFILE_REQUIRED_KEYS
    .filter((key) => String(profile[key] ?? "").trim().length === 0);
}

export async function checkSystempartnerDefaultProfileMandatory(
  admin: DownloadClient,
): Promise<SystempartnerDefaultProfileMandatoryResult> {
  const profile = await downloadSystempartnerDefaultProfile(admin);
  const missing = getMissingSystempartnerDefaultProfileKeys(profile)
    .map((key) => ({ key, reason: "missing" as const }));

  if (missing.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "Systempartner-Default unvollständig.",
      missing,
      gate: "SYSTEMPARTNER_DEFAULT_MISSING",
      profile,
    };
  }

  return {
    ok: true,
    missing: [],
    profile,
  };
}

export function applySystempartnerDefaultProfileToReportText(
  reportText: unknown,
  profile: SystempartnerDefaultProfile,
): Record<string, unknown> {
  const text = isRecord(reportText) ? { ...reportText } : {};
  const berater = isRecord(text.berater) ? { ...text.berater } : {};

  for (const key of SYSTEMPARTNER_DEFAULT_PROFILE_KEYS) {
    berater[key] = profile[key] ?? "";
  }

  return {
    ...text,
    berater,
  };
}
