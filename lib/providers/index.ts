import type { PartnerIntegration, MappedOffer } from "@/lib/providers/types";
import { fetchPropstackUnits, mapPropstackUnit } from "@/lib/providers/propstack";
import { fetchOnOfficeEstates, mapOnOfficeEstate } from "@/lib/providers/onoffice";

export async function syncIntegrationOffers(
  integration: PartnerIntegration,
): Promise<MappedOffer[]> {
  if (!integration.is_active || integration.kind !== "crm") return [];

  const auth = integration.auth_config ?? {};
  const apiKey =
    typeof auth["api_key"] === "string"
      ? auth["api_key"]
      : typeof auth["token"] === "string"
        ? auth["token"]
        : null;

  if (!apiKey) {
    throw new Error(`API-Key fehlt für Provider ${integration.provider}`);
  }

  if (integration.provider === "propstack") {
    const units = await fetchPropstackUnits(integration, apiKey);
    return units.map((unit) => mapPropstackUnit(integration.partner_id, integration, unit));
  }

  if (integration.provider === "onoffice") {
    const auth = integration.auth_config ?? {};
    const token =
      typeof auth["token"] === "string"
        ? auth["token"]
        : null;
    const secret =
      typeof auth["secret"] === "string"
        ? auth["secret"]
        : null;

    if (!token || !secret) {
      throw new Error("onOffice token/secret fehlt");
    }

    const records = await fetchOnOfficeEstates(integration, token, secret);
    return records.map((record) => mapOnOfficeEstate(integration.partner_id, integration, record));
  }

  throw new Error(`Provider nicht unterstützt: ${integration.provider}`);
}
