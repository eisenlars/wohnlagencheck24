import { applyDataDrivenTexts } from "@/lib/text-core";
import { INDIVIDUAL_MANDATORY_KEYS } from "@/lib/text-key-registry";

const SUPABASE_BUCKET = "immobilienmarkt";
const STANDARD_TEXT_PATH = "text-standards/kreis/text_standard_kreis.json";

export type AreaRow = {
  id: string;
  slug: string;
  name?: string | null;
  parent_slug?: string | null;
  bundesland_slug: string;
};

type JsonObject = Record<string, unknown>;
type TextGroup = Record<string, string>;
type TextTree = Record<string, TextGroup>;

type StandardPayload = {
  text?: unknown;
  kreisname?: { text?: unknown };
  ortslagenname?: { text?: unknown };
};

type StorageClient = {
  from: (bucket: string) => {
    download: (path: string) => Promise<{ data?: Blob | null; error?: { message?: string } | null }>;
    upload: (
      path: string,
      body: string,
      options: { upsert: boolean; contentType: string; cacheControl: string },
    ) => Promise<{ error?: { message?: string } | null }>;
  };
};

type AdminStorageLike = {
  storage: StorageClient;
};

export type BootstrapStatus = "updated" | "skipped" | "error";

export type BootstrapResult = {
  area_id: string;
  report_path: string;
  status: BootstrapStatus;
  reason?: string;
  changed_keys?: number;
};

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTextTree(value: unknown): TextTree {
  if (!isRecord(value)) return {};
  const out: TextTree = {};
  for (const [groupKey, groupValue] of Object.entries(value)) {
    if (!isRecord(groupValue)) continue;
    const normalizedGroup: TextGroup = {};
    for (const [textKey, textValue] of Object.entries(groupValue)) {
      normalizedGroup[textKey] = String(textValue ?? "");
    }
    out[groupKey] = normalizedGroup;
  }
  return out;
}

function cloneTextTree(tree: TextTree): TextTree {
  const out: TextTree = {};
  for (const [groupKey, group] of Object.entries(tree)) {
    out[groupKey] = { ...group };
  }
  return out;
}

function mergeTextTrees(baseTree: TextTree, overlayTree: TextTree): TextTree {
  const out = cloneTextTree(baseTree);
  for (const [groupKey, group] of Object.entries(overlayTree)) {
    out[groupKey] = {
      ...(out[groupKey] ?? {}),
      ...group,
    };
  }
  return out;
}

function hasStructuredText(tree: TextTree): boolean {
  return Object.values(tree).some((group) => Object.keys(group).length > 0);
}

function mandatoryFallbackGroup(textKey: string): string {
  if (textKey.startsWith("berater_")) return "berater";
  if (textKey.startsWith("makler_")) return "makler";
  return "immobilienmarkt";
}

function setMandatoryKeysEmpty(textTree: TextTree): TextTree {
  const out = cloneTextTree(textTree);
  for (const key of INDIVIDUAL_MANDATORY_KEYS) {
    if (key.startsWith("media_")) continue;
    let found = false;
    for (const group of Object.values(out)) {
      if (Object.prototype.hasOwnProperty.call(group, key)) {
        group[key] = "";
        found = true;
      }
    }
    if (!found) {
      const groupKey = mandatoryFallbackGroup(key);
      out[groupKey] = {
        ...(out[groupKey] ?? {}),
        [key]: "",
      };
    }
  }
  return out;
}

function isKreisArea(area: AreaRow): boolean {
  return String(area.parent_slug ?? "") === String(area.bundesland_slug ?? "");
}

export function buildReportPath(area: AreaRow): string {
  if (isKreisArea(area)) {
    return `reports/deutschland/${area.bundesland_slug}/${area.slug}.json`;
  }
  return `reports/deutschland/${area.bundesland_slug}/${String(area.parent_slug ?? "")}/${area.slug}.json`;
}

function resolveStandardTree(payload: StandardPayload | null, scope: "kreis" | "ortslage"): TextTree {
  if (!payload) return {};
  const top = toTextTree(payload.text);
  if (Object.keys(top).length > 0) return top;
  if (scope === "ortslage") {
    const ort = toTextTree(payload.ortslagenname?.text);
    if (Object.keys(ort).length > 0) return ort;
    return toTextTree(payload.kreisname?.text);
  }
  const kreis = toTextTree(payload.kreisname?.text);
  if (Object.keys(kreis).length > 0) return kreis;
  return toTextTree(payload.ortslagenname?.text);
}

async function downloadJson(admin: AdminStorageLike, path: string): Promise<unknown | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(path);
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  return JSON.parse(raw);
}

async function uploadJson(admin: AdminStorageLike, path: string, payload: unknown): Promise<string | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).upload(path, JSON.stringify(payload), {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (res.error?.message) return res.error.message;
  return null;
}

function extractTextTreeFromReport(report: JsonObject): TextTree {
  const topText = toTextTree(report.text);
  if (Object.keys(topText).length > 0) return topText;
  const data = isRecord(report.data) ? report.data : {};
  return toTextTree(data.text);
}

function extractOrtslageNameMap(areas: AreaRow[], kreisArea: AreaRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const area of areas) {
    if (String(area.parent_slug ?? "") !== kreisArea.slug) continue;
    if (String(area.bundesland_slug ?? "") !== kreisArea.bundesland_slug) continue;
    out[area.slug] = String(area.name ?? area.slug);
  }
  return out;
}

export async function bootstrapAreaReportText(args: {
  admin: AdminStorageLike;
  area: AreaRow;
  allAreas: AreaRow[];
  standardPayload: StandardPayload | null;
  force?: boolean;
  dryRun?: boolean;
}): Promise<BootstrapResult> {
  const { admin, area, allAreas, standardPayload } = args;
  const force = args.force === true;
  const dryRun = args.dryRun === true;
  const reportPath = buildReportPath(area);

  let reportRaw: unknown;
  try {
    reportRaw = await downloadJson(admin, reportPath);
  } catch (err) {
    return {
      area_id: area.id,
      report_path: reportPath,
      status: "error",
      reason: `download_failed: ${String((err as Error)?.message ?? err)}`,
    };
  }
  if (!isRecord(reportRaw)) {
    return {
      area_id: area.id,
      report_path: reportPath,
      status: "skipped",
      reason: "report_not_found_or_invalid_json",
    };
  }

  const scope = isKreisArea(area) ? "kreis" : "ortslage";
  const standardTree = resolveStandardTree(standardPayload, scope);
  const report = { ...reportRaw };
  const existingText = extractTextTreeFromReport(report);

  if (hasStructuredText(existingText) && !force) {
    return {
      area_id: area.id,
      report_path: reportPath,
      status: "skipped",
      reason: "text_already_present",
    };
  }

  const merged = mergeTextTrees(standardTree, existingText);
  const withMandatoryEmpty = setMandatoryKeysEmpty(merged);

  const nextReport: JsonObject = {
    ...report,
    text: withMandatoryEmpty,
    data: {
      ...(isRecord(report.data) ? report.data : {}),
      text: withMandatoryEmpty,
    },
  };

  const ortslageNameMap = scope === "kreis" ? extractOrtslageNameMap(allAreas, area) : undefined;
  const withDataDriven = applyDataDrivenTexts(nextReport, area.id, ortslageNameMap);
  const withDataDrivenRecord = isRecord(withDataDriven) ? withDataDriven : nextReport;
  const finalText = setMandatoryKeysEmpty(extractTextTreeFromReport(withDataDrivenRecord));
  const finalReport: JsonObject = {
    ...withDataDrivenRecord,
    text: finalText,
    data: {
      ...(isRecord(withDataDrivenRecord.data) ? withDataDrivenRecord.data : {}),
      text: finalText,
    },
  };

  if (dryRun) {
    return {
      area_id: area.id,
      report_path: reportPath,
      status: "updated",
      reason: "dry_run",
      changed_keys: Object.values(finalText).reduce((sum, group) => sum + Object.keys(group).length, 0),
    };
  }

  const uploadError = await uploadJson(admin, reportPath, finalReport);
  if (uploadError) {
    return {
      area_id: area.id,
      report_path: reportPath,
      status: "error",
      reason: `upload_failed: ${uploadError}`,
    };
  }

  return {
    area_id: area.id,
    report_path: reportPath,
    status: "updated",
    changed_keys: Object.values(finalText).reduce((sum, group) => sum + Object.keys(group).length, 0),
  };
}

export async function fetchStandardPayload(admin: AdminStorageLike): Promise<StandardPayload | null> {
  try {
    const payload = await downloadJson(admin, STANDARD_TEXT_PATH);
    return isRecord(payload) ? (payload as StandardPayload) : null;
  } catch {
    return null;
  }
}
