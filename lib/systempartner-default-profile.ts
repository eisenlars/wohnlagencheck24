export const SYSTEMPARTNER_DEFAULT_PROFILE_BUCKET = "immobilienmarkt";
export const SYSTEMPARTNER_DEFAULT_PROFILE_PATH = "text-standards/systempartner/systempartner_default_profile.json";

export const SYSTEMPARTNER_DEFAULT_PROFILE_KEYS = [
  "berater_name",
  "berater_email",
  "berater_telefon_fest",
  "berater_telefon_mobil",
  "media_berater_avatar",
] as const;

export type SystempartnerDefaultProfileKey = (typeof SYSTEMPARTNER_DEFAULT_PROFILE_KEYS)[number];

export type SystempartnerDefaultProfile = Record<SystempartnerDefaultProfileKey, string>;

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
        body: string,
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
