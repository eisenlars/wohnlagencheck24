import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import { createAdminClient } from "@/utils/supabase/admin";

type AreaRow = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type PartnerAreaMapRow = {
  area_id?: string | null;
  areas?: AreaRow | AreaRow[] | null;
};

type AreaOption = {
  id: string;
  label: string;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeArea(value: unknown): AreaRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  if (!id) return null;
  return {
    id,
    name: asText(row.name) || null,
    slug: asText(row.slug) || null,
    parent_slug: asText(row.parent_slug) || null,
    bundesland_slug: asText(row.bundesland_slug) || null,
  };
}

function toDistrictAreaId(areaId: string): string {
  return asText(areaId).split("-").slice(0, 3).join("-");
}

export async function GET() {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("partner_area_map")
      .select("area_id, areas(id, name, slug, parent_slug, bundesland_slug)")
      .eq("auth_user_id", actor.partnerId)
      .eq("is_active", true)
      .order("area_id", { ascending: true });

    if (error) {
      throw new Error(error.message ?? "PARTNER_AREA_LOOKUP_FAILED");
    }

    const mappedRows = Array.isArray(data) ? (data as PartnerAreaMapRow[]) : [];
    const districtIds = new Set<string>();
    const districtBySlug = new Map<string, { id: string; label: string; bundeslandSlug: string | null }>();
    const mappedLocalityRows: AreaOption[] = [];

    for (const row of mappedRows) {
      const areaId = asText(row.area_id);
      if (!areaId) continue;
      const area = Array.isArray(row.areas) ? normalizeArea(row.areas[0]) : normalizeArea(row.areas);
      const districtId = toDistrictAreaId(areaId);
      if (!districtId) continue;
      districtIds.add(districtId);
      if (areaId.split("-").length <= 3) {
        const districtSlug = asText(area?.slug);
        if (districtSlug && !districtBySlug.has(districtSlug)) {
          districtBySlug.set(districtSlug, {
            id: districtId,
            label: asText(area?.name) || districtId,
            bundeslandSlug: asText(area?.bundesland_slug) || null,
          });
        }
      } else {
        const parentSlug = asText(area?.parent_slug);
        if (parentSlug && !districtBySlug.has(parentSlug)) {
          districtBySlug.set(parentSlug, {
            id: districtId,
            label: districtId,
            bundeslandSlug: asText(area?.bundesland_slug) || null,
          });
        }
        mappedLocalityRows.push({
          id: areaId,
          label: area?.name ? `${districtId} -> ${area.name}` : areaId,
        });
      }
    }

    const districtRows: AreaOption[] = Array.from(districtIds)
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((districtId) => {
        const match = Array.from(districtBySlug.values()).find((entry) => entry.id === districtId);
        return {
          id: districtId,
          label: match?.label ?? districtId,
        };
      });

    const districtSlugs = Array.from(districtBySlug.keys());
    let localityRows: AreaOption[] = [];

    if (districtSlugs.length > 0) {
      const bundeslandSlugs = Array.from(new Set(
        Array.from(districtBySlug.values())
          .map((entry) => asText(entry.bundeslandSlug))
          .filter(Boolean),
      ));

      let localityQuery = admin
        .from("areas")
        .select("id, name, slug, parent_slug, bundesland_slug")
        .in("parent_slug", districtSlugs)
        .order("name", { ascending: true });

      if (bundeslandSlugs.length > 0) {
        localityQuery = localityQuery.in("bundesland_slug", bundeslandSlugs);
      }

      const { data: localities, error: localityError } = await localityQuery;
      if (localityError) {
        throw new Error(localityError.message ?? "AREA_CHILDREN_LOOKUP_FAILED");
      }

      localityRows = ((localities ?? []) as AreaRow[])
        .map((row) => {
          const areaId = asText(row.id);
          const parentSlug = asText(row.parent_slug);
          const localityName = asText(row.name);
          if (!areaId || !parentSlug) return null;
          const district = districtBySlug.get(parentSlug);
          if (!district) return null;
          return {
            id: areaId,
            label: district.label && localityName
              ? `${district.label} -> ${localityName}`
              : (localityName || areaId),
          };
        })
        .filter((entry): entry is AreaOption => Boolean(entry))
        .sort((a, b) => a.label.localeCompare(b.label, "de"));
    }

    const mergedLocalityRows = Array.from(new Map(
      [...mappedLocalityRows, ...localityRows].map((entry) => [entry.id, entry] as const),
    ).values()).sort((a, b) => a.label.localeCompare(b.label, "de"));

    return NextResponse.json({
      ok: true,
      areas: [...districtRows, ...mergedLocalityRows],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
