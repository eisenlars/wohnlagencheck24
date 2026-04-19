import { asArray, asRecord } from "@/utils/records";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

export type RequestMarketRange = {
  min: number;
  avg: number;
  max: number;
};

export type RequestMarketRangeContext = {
  purchase: {
    house: RequestMarketRange | null;
    apartment: RequestMarketRange | null;
  };
  rent: {
    house: RequestMarketRange | null;
    apartment: RequestMarketRange | null;
  };
};

function toRange(
  row: Record<string, unknown> | null,
  keys: { min: string; avg: string; max: string },
): RequestMarketRange | null {
  if (!row) return null;
  const min = toNumberOrNull(row[keys.min]);
  const avg = toNumberOrNull(row[keys.avg]);
  const max = toNumberOrNull(row[keys.max]);
  if (min === null || avg === null || max === null) return null;
  return { min, avg, max };
}

export function buildRequestMarketRangeContext(report: unknown): RequestMarketRangeContext | null {
  const reportRecord = asRecord(report);
  const data = asRecord(reportRecord?.["data"]) ?? {};
  const context: RequestMarketRangeContext = {
    purchase: {
      house: toRange(
        asRecord(asArray(data["haus_kaufpreisspanne"])[0]) ?? null,
        { min: "preis_haus_min", avg: "preis_haus_avg", max: "preis_haus_max" },
      ),
      apartment: toRange(
        asRecord(asArray(data["wohnung_kaufpreisspanne"])[0]) ?? null,
        { min: "preis_wohnung_min", avg: "preis_wohnung_avg", max: "preis_wohnung_max" },
      ),
    },
    rent: {
      house: toRange(
        asRecord(asArray(data["mietpreise_haus_gesamt"])[0]) ?? null,
        { min: "preis_haus_min", avg: "preis_haus_avg", max: "preis_haus_max" },
      ),
      apartment: toRange(
        asRecord(asArray(data["mietpreise_wohnung_gesamt"])[0]) ?? null,
        { min: "preis_wohnung_min", avg: "preis_wohnung_avg", max: "preis_wohnung_max" },
      ),
    },
  };

  const hasAnyRange =
    context.purchase.house
    || context.purchase.apartment
    || context.rent.house
    || context.rent.apartment;
  return hasAnyRange ? context : null;
}
