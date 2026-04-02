import { parseOpenImmoDocument } from "@/lib/openimmo/parse";
import { mapOpenImmoListingToOffer, mapOpenImmoListingToRawListing } from "@/lib/openimmo/map";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import type {
  PartnerIntegration,
  ResourceSyncData,
  MappedOffer,
  RawReference,
  RawRequest,
} from "@/lib/providers/types";
import type { IntegrationSyncOptions } from "@/lib/providers";

const PROVIDER_FETCH_TIMEOUT_MS = 12000;

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PROVIDER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export function buildOpenImmoRequestHeaders(
  integration: Pick<PartnerIntegration, "auth_type" | "auth_config">,
): HeadersInit {
  const headers: HeadersInit = {
    accept: "application/xml, text/xml, application/octet-stream;q=0.9, */*;q=0.8",
  };
  const authType = String(integration.auth_type ?? "").trim().toLowerCase();
  const auth = (integration.auth_config ?? {}) as Record<string, unknown>;
  const token = readSecretFromAuthConfig(auth, "token") ?? asText(auth.token);
  const secret = readSecretFromAuthConfig(auth, "secret") ?? asText(auth.secret);

  if (authType.includes("basic") && token && secret) {
    headers.authorization = `Basic ${Buffer.from(`${token}:${secret}`, "utf8").toString("base64")}`;
  } else if (authType.includes("token") && token) {
    headers.authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function fetchOpenImmoFeedXml(
  integration: Pick<PartnerIntegration, "base_url" | "settings" | "auth_type" | "auth_config">,
): Promise<string> {
  const feedUrl =
    asText(integration.base_url)
    ?? asText((integration.settings ?? {})["feed_url"])
    ?? asText((integration.settings ?? {})["base_url"]);
  if (!feedUrl) {
    throw new Error("OpenImmo Feed-URL fehlt.");
  }

  const response = await fetchWithTimeout(feedUrl, {
    method: "GET",
    headers: buildOpenImmoRequestHeaders(integration),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenImmo Feed-Abruf fehlgeschlagen (${response.status}): ${body.slice(0, 300)}`);
  }
  return response.text();
}

export async function syncOpenImmoResources(
  integration: PartnerIntegration,
  options?: IntegrationSyncOptions,
): Promise<ResourceSyncData & { offers: MappedOffer[] }> {
  const resource = options?.resource ?? "all";
  const notes: string[] = [];

  if (resource === "references") {
    notes.push("OpenImmo-Referenzen sind im aktuellen Grundgerüst noch nicht implementiert.");
    return {
      offers: [],
      listings: [],
      references: [],
      requests: [],
      referencesFetched: false,
      requestsFetched: false,
      notes,
      diagnostics: {
        provider_request_count: 0,
        provider_pages_fetched: 0,
        references_source: "unavailable",
        requests_source: "unavailable",
        resource,
        mode: options?.mode,
      },
    };
  }

  if (resource === "requests") {
    notes.push("OpenImmo-Gesuche sind im aktuellen Grundgerüst noch nicht implementiert.");
    return {
      offers: [],
      listings: [],
      references: [],
      requests: [],
      referencesFetched: false,
      requestsFetched: false,
      notes,
      diagnostics: {
        provider_request_count: 0,
        provider_pages_fetched: 0,
        references_source: "unavailable",
        requests_source: "unavailable",
        resource,
        mode: options?.mode,
      },
    };
  }

  const xml = await fetchOpenImmoFeedXml(integration);
  const parsed = parseOpenImmoDocument(xml);
  const offers = parsed.listings.map((listing) =>
    mapOpenImmoListingToOffer(integration.partner_id, integration, listing),
  );
  const listings = parsed.listings.map((listing) =>
    mapOpenImmoListingToRawListing(integration.partner_id, listing),
  );

  if (resource === "all") {
    notes.push("OpenImmo-Referenzen und -Gesuche folgen in einem separaten Ausbau.");
  }

  return {
    offers,
    listings,
    references: [] as RawReference[],
    requests: [] as RawRequest[],
    referencesFetched: false,
    requestsFetched: false,
    notes: [...parsed.notes, ...notes],
    diagnostics: {
      provider_request_count: 1,
      provider_pages_fetched: 1,
      references_source: "unavailable",
      requests_source: "unavailable",
      resource,
      mode: options?.mode,
    },
  };
}
