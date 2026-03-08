type LocalSiteTextRow = {
  area_id?: string | null;
  section_key?: string | null;
  optimized_content?: string | null;
  status?: string | null;
  text_type?: string | null;
  last_updated?: string | null;
};

type QueryResult = {
  data?: LocalSiteTextRow[] | null;
  error?: { message?: string } | null;
};

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => Promise<QueryResult>;
};

export type LocalSiteTextMergeClient = {
  from: (table: string) => QueryBuilder;
};

export type SectionRow = {
  optimized_content?: string | null;
  status?: string | null;
  text_type?: string | null;
  last_updated?: string | null;
};

export type SectionMap = Record<string, SectionRow>;
export type AreaSectionMap = Record<string, SectionMap>;

function asNonEmpty(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function buildAreaSectionMap(rows: LocalSiteTextRow[] | null | undefined): AreaSectionMap {
  const out: AreaSectionMap = {};
  for (const row of rows ?? []) {
    const areaId = asNonEmpty(row.area_id);
    const sectionKey = asNonEmpty(row.section_key);
    if (!areaId || !sectionKey) continue;
    out[areaId] ??= {};
    out[areaId][sectionKey] = {
      optimized_content: row.optimized_content ?? null,
      status: row.status ?? null,
      text_type: row.text_type ?? null,
      last_updated: row.last_updated ?? null,
    };
  }
  return out;
}

async function loadRowsByAreaIds(
  supabase: LocalSiteTextMergeClient,
  table: "partner_local_site_texts" | "report_texts",
  partnerId: string,
  areaIds: string[],
) {
  if (areaIds.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select("area_id, section_key, optimized_content, status, text_type, last_updated")
    .eq("partner_id", partnerId)
    .in("area_id", areaIds);
  if (error || !data) {
    console.warn("[local-site-text-merge] text source query failed", {
      table,
      partner_id: partnerId,
      area_count: areaIds.length,
      error: error?.message ?? "no_data",
    });
    return [];
  }
  return data;
}

export async function loadTextSourcesByAreaIds(
  supabase: LocalSiteTextMergeClient,
  partnerId: string,
  areaIds: string[],
) {
  const [localRows, reportRows] = await Promise.all([
    loadRowsByAreaIds(supabase, "partner_local_site_texts", partnerId, areaIds),
    loadRowsByAreaIds(supabase, "report_texts", partnerId, areaIds),
  ]);

  return {
    localByArea: buildAreaSectionMap(localRows),
    reportByArea: buildAreaSectionMap(reportRows),
  };
}

export function mergeTextsWithPriority(
  baseTexts: Record<string, Record<string, string>>,
  localOverrides: SectionMap | undefined,
  reportOverrides: SectionMap | undefined,
) {
  const merged: Record<string, Record<string, string>> = {};
  const meta: Record<string, Record<string, string | null>> = {};

  Object.entries(baseTexts || {}).forEach(([groupKey, group]) => {
    merged[groupKey] = {};
    Object.entries(group || {}).forEach(([sectionKey, rawValue]) => {
      const local = localOverrides?.[sectionKey];
      const report = reportOverrides?.[sectionKey];

      const localApproved = local?.status === "approved" && asNonEmpty(local.optimized_content);
      const reportApproved = report?.status === "approved" && asNonEmpty(report.optimized_content);

      if (localApproved) {
        merged[groupKey][sectionKey] = String(local.optimized_content);
        meta[sectionKey] = {
          status: local?.status ?? "approved",
          last_updated: local?.last_updated ?? null,
          text_type: local?.text_type ?? null,
          source: "local_site_override",
        };
        return;
      }

      if (reportApproved) {
        merged[groupKey][sectionKey] = String(report.optimized_content);
        meta[sectionKey] = {
          status: report?.status ?? "approved",
          last_updated: report?.last_updated ?? null,
          text_type: report?.text_type ?? null,
          source: "report_texts",
        };
        return;
      }

      merged[groupKey][sectionKey] = rawValue;
      meta[sectionKey] = {
        status: "raw",
        last_updated: null,
        text_type: null,
        source: "raw",
      };
    });
  });

  return { merged, meta };
}
