import type { MappedOffer, PartnerIntegration } from "@/lib/providers/types";

type OnOfficeRecord = {
  id?: number | string;
  type?: string;
  elements?: Record<string, unknown>;
};

type OnOfficeResponse = {
  response?: {
    results?: Array<{
      data?: {
        records?: OnOfficeRecord[];
      };
    }>;
  };
};

const ACTION_READ = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";
const RESOURCE_ESTATE = "estate";

function normalizeOfferType(value?: string | null): "kauf" | "miete" {
  const v = String(value ?? "").toLowerCase();
  if (v === "miete" || v === "rent") return "miete";
  return "kauf";
}

function normalizeObjectType(value?: string | null): "wohnung" | "haus" {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("haus")) return "haus";
  return "wohnung";
}

function buildAddress(elements: Record<string, unknown>): string | null {
  const parts = [
    String(elements["strasse"] ?? "").trim(),
    String(elements["hausnummer"] ?? "").trim(),
    String(elements["plz"] ?? "").trim(),
    String(elements["ort"] ?? "").trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function buildDetailUrl(template: string | null, elements: Record<string, unknown>): string | null {
  if (!template) return null;
  const exposeeId = elements["objektnr_extern"] ?? "";
  const id = elements["Id"] ?? elements["id"] ?? "";
  return template
    .replace("{exposee_id}", String(exposeeId))
    .replace("{id}", String(id));
}

function extractImages(elements: Record<string, unknown>): string[] {
  const rawImg = elements["img"];
  if (!rawImg) return [];
  if (Array.isArray(rawImg)) {
    return rawImg
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const url = (item as Record<string, unknown>).url;
        return typeof url === "string" ? url : null;
      })
      .filter((url): url is string => typeof url === "string" && url.length > 0);
  }
  if (typeof rawImg === "object") {
    const url = (rawImg as Record<string, unknown>).url;
    return typeof url === "string" ? [url] : [];
  }
  return [];
}

export async function fetchOnOfficeEstates(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeRecord[]> {
  const base = integration.base_url?.trim() || "https://api.onoffice.de/api/stable/api.php";
  const fields = [
    "Id",
    "objekttitel",
    "objektnr_extern",
    "vermarktungsart",
    "objektart",
    "kaufpreis",
    "kaltmiete",
    "warmmiete",
    "wohnflaeche",
    "anzahl_zimmer",
    "nutzflaeche",
    "plz",
    "ort",
    "strasse",
    "hausnummer",
    "land",
    "breitengrad",
    "laengengrad",
    "baujahr",
    "energiepass_art",
    "energieverbrauchkennwert",
    "freitext_lage",
    "freitext_ausstattung",
    "balkon_terrasse",
    "img",
  ];

  const allRecords: OnOfficeRecord[] = [];
  const listlimit = 50;
  let listoffset = 0;

  while (true) {
    const body = {
      token,
      secret,
      actionid: ACTION_READ,
      resourceid: RESOURCE_ESTATE,
      parameters: {
        data: fields,
        listlimit,
        listoffset,
        filter: {
          status: [{ op: "=", val: 1 }],
        },
      },
    };

    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`onOffice fetch failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as OnOfficeResponse;
    const records =
      json?.response?.results?.[0]?.data?.records ?? [];

    if (!Array.isArray(records) || records.length === 0) break;

    allRecords.push(...records);

    if (records.length < listlimit) break;
    listoffset += listlimit;
  }

  return allRecords;
}

export function mapOnOfficeEstate(
  partnerId: string,
  integration: PartnerIntegration,
  record: OnOfficeRecord,
): MappedOffer {
  const elements = (record.elements ?? {}) as Record<string, unknown>;
  const gallery = extractImages(elements);
  const address = buildAddress(elements);

  const rent =
    toNumber(elements["warmmiete"]) ??
    toNumber(elements["kaltmiete"]);

  return {
    partner_id: partnerId,
    source: "onoffice",
    external_id: String(elements["Id"] ?? record.id ?? ""),
    offer_type: normalizeOfferType(String(elements["vermarktungsart"] ?? "")),
    object_type: normalizeObjectType(String(elements["objektart"] ?? "")),
    title: String(elements["objekttitel"] ?? ""),
    price: toNumber(elements["kaufpreis"]),
    rent,
    area_sqm: toNumber(elements["wohnflaeche"]),
    rooms: toNumber(elements["anzahl_zimmer"]),
    address,
    image_url: gallery[0] ?? null,
    detail_url: buildDetailUrl(integration.detail_url_template, elements),
    is_top: false,
    updated_at: null,
    raw: {
      exposee_id: elements["objektnr_extern"] ?? null,
      description: elements["freitext_lage"] ?? null,
      features_note: elements["freitext_ausstattung"] ?? null,
      energy: {
        type: elements["energiepass_art"] ?? null,
        demand: elements["energieverbrauchkennwert"] ?? null,
        year: elements["baujahr"] ?? null,
      },
      gallery,
      lat: elements["breitengrad"] ?? null,
      lng: elements["laengengrad"] ?? null,
    },
  };
}
