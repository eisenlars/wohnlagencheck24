import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildKreisSectionSignatures,
  buildOrtslageSectionSignatures,
  generateKreisPriceTexts,
  generateOrtslagePriceTexts,
} from "@/lib/text-core";

export const runtime = "nodejs";

type RebuildRequest = {
  area_id?: string;
  scope?: "kreis" | "ortslage";
  mode?: "full" | "textgen_only";
  previous_factors?: unknown;
  debug?: boolean;
};

type AnyRecord = Record<string, unknown>;
type DataRow = AnyRecord & { jahr?: number; region?: string; ortslage?: string };
type FactorGroup = {
  f01?: number;
  f02?: number;
  f03?: number;
  f04?: number;
  f05?: number;
  f06?: number;
};

function isEnabled() {
  return process.env.REBUILD_REGION_ENABLED === "1";
}

const SUPABASE_BUCKET = "immobilienmarkt";

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scaleRow(row: AnyRecord | null | undefined, keys: string[], factor: number) {
  if (!row || typeof row !== "object") return;
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "number") {
      row[key] = raw * factor;
    }
  }
}

function scaleRowByLabel(rows: DataRow[] | undefined, label: string, keys: string[], factor: number, labelKey = "preisinfo_label") {
  if (!Array.isArray(rows)) return;
  const target = String(label ?? "").trim().toLowerCase();
  for (const row of rows) {
    const rowLabel = String(row?.[labelKey] ?? "").trim().toLowerCase();
    if (rowLabel === target) {
      scaleRow(row, keys, factor);
    }
  }
}

function factorByYear(year: number | null, year01: number | null, group: FactorGroup | null | undefined) {
  if (typeof year01 !== "number" || typeof year !== "number") return group?.f01 ?? 1;
  const offset = year01 - year;
  if (offset < 0) return group?.f01 ?? 1;
  const index = offset + 1;
  if (index < 1 || index > 6) return group?.f01 ?? 1;
  const key = `f0${index}`;
  const value = group?.[key as keyof FactorGroup];
  return typeof value === "number" && Number.isFinite(value) ? value : group?.f01 ?? 1;
}

function scaleAllYearsByYear(rows: DataRow[] | undefined, key: string, year01: number | null, group: FactorGroup | null | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (const row of rows) {
    if (typeof row?.[key] !== "number") continue;
    const year = typeof row?.jahr === "number" ? row.jahr : null;
    row[key] = row[key] * factorByYear(year, year01, group);
  }
}

function scaleAllYearsByYearWithPairMean(
  rows: DataRow[] | undefined,
  key: string,
  year01: number | null,
  groupA: FactorGroup | null | undefined,
  groupB: FactorGroup | null | undefined,
) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (const row of rows) {
    if (typeof row?.[key] !== "number") continue;
    const year = typeof row?.jahr === "number" ? row.jahr : null;
    const factor = meanOf([factorByYear(year, year01, groupA), factorByYear(year, year01, groupB)]) ?? 1;
    row[key] = row[key] * factor;
  }
}

function setLatestYearValue(rows: DataRow[] | undefined, key: string, value: number) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const years = rows.map((r) => (typeof r?.jahr === "number" ? r.jahr : null)).filter((v) => v !== null) as number[];
  if (!years.length) return;
  const latest = Math.max(...years);
  for (const row of rows) {
    if (row?.jahr === latest) {
      row[key] = value;
    }
  }
}

function scaleRegionRow(rows: DataRow[] | undefined, regionName: string, key: string, factor: number) {
  if (!Array.isArray(rows)) return;
  const target = String(regionName ?? "").toLowerCase();
  for (const row of rows) {
    const region = String(row?.region ?? "").toLowerCase();
    if (region === target && typeof row?.[key] === "number") {
      row[key] = row[key] * factor;
    }
  }
}

function setRegionValue(rows: DataRow[] | undefined, regionName: string, key: string, value: number) {
  if (!Array.isArray(rows)) return;
  const target = String(regionName ?? "").toLowerCase();
  for (const row of rows) {
    const region = String(row?.region ?? "").toLowerCase();
    if (region === target) {
      row[key] = value;
      return;
    }
  }
}

function applyFactorsToData(data: AnyRecord, meta: AnyRecord, factors: NormalizedFactors, year01: number | null) {
  if (!data || typeof data !== "object") return;
  const kh = factors.kauf_haus?.f01 ?? 1;
  const kw = factors.kauf_wohnung?.f01 ?? 1;
  const kg = factors.kauf_grundstueck?.f01 ?? 1;
  const mh = factors.miete_haus?.f01 ?? 1;
  const mw = factors.miete_wohnung?.f01 ?? 1;
  const tImmo = factors.immobilienmarkt_trend?.immobilienmarkt ?? 0;
  const tMiete = factors.immobilienmarkt_trend?.mietmarkt ?? 0;
  const immoFactor = meanOf([kh, kw]) ?? 1;
  const rentFactor = meanOf([mh, mw]) ?? 1;
  const kreisName = meta?.kreis_name ?? meta?.amtlicher_name ?? "";
  const clamp = (value: number, min = -100, max = 100) => Math.max(min, Math.min(max, value));
  const addIndex = (value: unknown, delta: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return value;
    return clamp(value + delta);
  };

  if (data?.immobilienmarkt_situation?.[0]) {
    if (typeof data.immobilienmarkt_situation[0].immobilienmarkt_index === "number") {
      data.immobilienmarkt_situation[0].immobilienmarkt_index = addIndex(
        data.immobilienmarkt_situation[0].immobilienmarkt_index,
        tImmo,
      );
    }
    if (typeof data.immobilienmarkt_situation[0].mietmarkt_index === "number") {
      data.immobilienmarkt_situation[0].mietmarkt_index = addIndex(
        data.immobilienmarkt_situation[0].mietmarkt_index,
        tMiete,
      );
    }
  }

  scaleRow(data?.immobilien_kaufpreis?.[0], ["kaufpreis_immobilien"], immoFactor);
  scaleRow(data?.haus_kaufpreis?.[0], ["kaufpreis_haus"], kh);
  scaleRow(data?.haus_kaufpreisspanne?.[0], ["preis_haus_min", "preis_haus_avg", "preis_haus_max"], kh);
  scaleRowByLabel(data?.haus_kaufpreise_im_ueberregionalen_vergleich ?? [], "Ø Preis", ["preis"], kh);
  for (const row of data?.haus_kaufpreise_lage ?? []) {
    scaleRow(row, ["preis_einfache_lage", "preis_mittlere_lage", "preis_gute_lage", "preis_sehr_gute_lage", "preis_top_lage"], kh);
  }
  for (const row of data?.haus_kaufpreis_haustypen ?? []) {
    scaleRow(row, ["reihenhaus", "doppelhaushaelfte", "einfamilienhaus"], kh);
  }
  scaleAllYearsByYear(data?.haus_kaufpreisentwicklung ?? [], "preis_k", year01, factors.kauf_haus);
  scaleAllYearsByYear(data?.haus_kaufpreisentwicklung ?? [], "preis_ol", year01, factors.kauf_haus);

  scaleRow(data?.wohnung_kaufpreis?.[0], ["kaufpreis_wohnung"], kw);
  scaleRow(data?.wohnung_kaufpreisspanne?.[0], ["preis_wohnung_min", "preis_wohnung_avg", "preis_wohnung_max"], kw);
  scaleRowByLabel(data?.wohnung_kaufpreise_im_ueberregionalen_vergleich ?? [], "Ø Preis", ["preis"], kw);
  for (const row of data?.wohnung_kaufpreise_lage ?? []) {
    scaleRow(row, ["preis_einfache_lage", "preis_mittlere_lage", "preis_gute_lage", "preis_sehr_gute_lage", "preis_top_lage"], kw);
  }
  for (const row of data?.wohnung_kaufpreise_nach_zimmern ?? []) {
    scaleRow(row, ["preis"], kw);
  }
  for (const row of data?.wohnung_kaufpreise_nach_flaechen ?? []) {
    scaleRow(row, ["preis"], kw);
  }
  scaleAllYearsByYear(data?.wohnung_kaufpreisentwicklung ?? [], "preis_k", year01, factors.kauf_wohnung);
  scaleAllYearsByYear(data?.wohnung_kaufpreisentwicklung ?? [], "preis_ol", year01, factors.kauf_wohnung);

  scaleRow(data?.grundstueck_kaufpreis?.[0], ["kaufpreis_grundstueck"], kg);
  scaleRow(data?.grundstueck_kaufpreisspanne?.[0], ["preis_grundstueck_min", "preis_grundstueck_avg", "preis_grundstueck_max"], kg);
  scaleRowByLabel(data?.grundstueck_kaufpreise_im_ueberregionalen_vergleich ?? [], "Ø Preis", ["preis"], kg);
  scaleRegionRow(data?.grundstueckspreise_ueberregionaler_vergleich ?? [], kreisName, "grundstueckspreis", kg);

  scaleRow(data?.mietpreise_wohnung_gesamt?.[0], ["preis_wohnung_min", "preis_wohnung_avg", "preis_wohnung_max"], mw);
  for (const row of data?.mietpreise_wohnung_nach_zimmern ?? []) {
    scaleRow(row, ["kaltmiete"], mw);
  }
  for (const row of data?.mietpreise_wohnung_nach_flaechen ?? []) {
    scaleRow(row, ["kaltmiete"], mw);
  }
  for (const row of data?.mietpreise_wohnung_nach_baujahr ?? []) {
    scaleRow(row, ["kaltmiete_bestand", "kaltmiete_neubau"], mw);
  }
  scaleAllYearsByYear(data?.mietpreisentwicklung_wohnung ?? [], "preis_k", year01, factors.miete_wohnung);
  scaleAllYearsByYear(data?.mietpreisentwicklung_wohnung ?? [], "preis_ol", year01, factors.miete_wohnung);
  scaleRegionRow(data?.mietpreise_ueberregionaler_vergleich ?? [], kreisName, "kaltmiete", rentFactor);

  scaleRow(data?.mietpreise_haus_gesamt?.[0], ["preis_haus_min", "preis_haus_avg", "preis_haus_max"], mh);
  scaleAllYearsByYear(data?.mietpreisentwicklung_haus ?? [], "preis_k", year01, factors.miete_haus);
  scaleAllYearsByYear(data?.mietpreisentwicklung_haus ?? [], "preis_ol", year01, factors.miete_haus);

  for (const row of data?.ortslagen_uebersicht ?? []) {
    scaleRow(row, ["immobilienpreise_wert"], immoFactor);
    scaleRow(row, ["grundstueckspreise_wert"], kg);
    scaleRow(row, ["mietpreise_wert"], rentFactor);
  }

  scaleAllYearsByYearWithPairMean(
    data?.immobilie_kaufpreisentwicklung ?? [],
    "kaufpreisentwicklung_immobilie",
    year01,
    factors.kauf_haus,
    factors.kauf_wohnung,
  );
  scaleAllYearsByYear(data?.grundstueck_kaufpreisentwicklung ?? [], "kaufpreisentwicklung_grundstueck", year01, factors.kauf_grundstueck);
  scaleAllYearsByYearWithPairMean(
    data?.immobilie_mietpreisentwicklung ?? [],
    "mietpreisentwicklung_immobilie",
    year01,
    factors.miete_haus,
    factors.miete_wohnung,
  );
  scaleAllYearsByYear(data?.grundstueck_preisentwicklung ?? [], "angebotspreisentwicklung_grundstueck_k", year01, factors.kauf_grundstueck);
  scaleAllYearsByYear(data?.grundstueck_preisentwicklung ?? [], "verkaufspreisentwicklung_grundstueck_k", year01, factors.kauf_grundstueck);
  scaleAllYearsByYear(data?.grundstueck_preisentwicklung ?? [], "angebotspreisentwicklung_grundstueck_ol", year01, factors.kauf_grundstueck);
  scaleAllYearsByYear(data?.grundstueck_preisentwicklung ?? [], "verkaufspreisentwicklung_grundstueck_ol", year01, factors.kauf_grundstueck);

  scaleRegionRow(data?.immobilienpreise_ueberregionaler_vergleich ?? [], kreisName, "immobilienpreis", immoFactor);
}

function applyFactorsToTextInputs(inputs: AnyRecord, factors: NormalizedFactors, year01: number | null) {
  if (!inputs) return;
  const kh = factors.kauf_haus?.f01 ?? 1;
  const kw = factors.kauf_wohnung?.f01 ?? 1;
  const kg = factors.kauf_grundstueck?.f01 ?? 1;
  const mh = factors.miete_haus?.f01 ?? 1;
  const mw = factors.miete_wohnung?.f01 ?? 1;
  const immoFactor = meanOf([kh, kw]) ?? 1;
  const rentFactor = meanOf([mh, mw]) ?? 1;
  const rend = factors.rendite ?? {};
  void year01;
  const yearIndexFromKey = (key: string): number | null => {
    if (key.includes("jahr06")) return 6;
    if (key.includes("jahr05")) return 5;
    if (key.includes("jahr04")) return 4;
    if (key.includes("jahr03")) return 3;
    if (key.includes("jahr02")) return 2;
    if (key.includes("jahr01")) return 1;
    if (key.includes("vor_5_jahren")) return 5;
    if (key.includes("vorjahr")) return 2;
    return null;
  };
  const factorByIndex = (group: FactorGroup | null | undefined, index: number | null) => {
    if (!index) return group?.f01 ?? 1;
    const key = `f0${index}`;
    const value = group?.[key as keyof FactorGroup];
    return typeof value === "number" && Number.isFinite(value) ? value : group?.f01 ?? 1;
  };
  const rentFactorByIndex = (index: number | null) =>
    meanOf([factorByIndex(factors.miete_haus, index), factorByIndex(factors.miete_wohnung, index)]) ?? 1;
  const immoFactorByIndex = (index: number | null) =>
    meanOf([factorByIndex(factors.kauf_haus, index), factorByIndex(factors.kauf_wohnung, index)]) ?? 1;

  const applyMap = (obj: AnyRecord | null | undefined, fn: (key: string, value: number) => number) => {
    if (!obj || typeof obj !== "object") return;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value !== "number") continue;
      obj[key] = fn(key, value);
    }
  };

  applyMap(inputs.priceValues_properties_dict as AnyRecord | undefined, (key, value) => {
    const index = yearIndexFromKey(key);
    if (key.includes("haus")) return value * factorByIndex(factors.kauf_haus, index);
    if (key.includes("wohnung")) return value * factorByIndex(factors.kauf_wohnung, index);
    return value;
  });

  applyMap(inputs.priceValues_plots_dict as AnyRecord | undefined, (key, value) => {
    const index = yearIndexFromKey(key);
    if (key.includes("grundstueck")) return value * factorByIndex(factors.kauf_grundstueck, index);
    return value;
  });

  applyMap(inputs.priceValues_rent_dict as AnyRecord | undefined, (key, value) => {
    const index = yearIndexFromKey(key);
    if (key.includes("haus")) return value * factorByIndex(factors.miete_haus, index);
    if (key.includes("wohnung")) return value * factorByIndex(factors.miete_wohnung, index);
    if (key.includes("kaltmiete") || key.includes("miete")) return value * rentFactorByIndex(index);
    return value;
  });

  applyMap(inputs.priceValues_rendite_dict as AnyRecord | undefined, (key, value) => {
    if (key.includes("etw")) {
      if (key.includes("kaufpreisfaktor")) return value * (rend.kaufpreisfaktor_etw ?? 1);
      return value * (rend.mietrendite_etw ?? 1);
    }
    if (key.includes("efh")) {
      if (key.includes("kaufpreisfaktor")) return value * (rend.kaufpreisfaktor_efh ?? 1);
      return value * (rend.mietrendite_efh ?? 1);
    }
    if (key.includes("mfh")) {
      if (key.includes("kaufpreisfaktor")) return value * (rend.kaufpreisfaktor_mfh ?? 1);
      return value * (rend.mietrendite_mfh ?? 1);
    }
    return value;
  });

  applyMap(inputs.marketValues_generallyPrices_dict as AnyRecord | undefined, (key, value) => {
    const index = yearIndexFromKey(key);
    if (key.includes("immobilienpreise")) return value * immoFactorByIndex(index);
    if (key.includes("grundstueckspreise")) return value * factorByIndex(factors.kauf_grundstueck, index);
    if (key.includes("mietpreise")) return value * rentFactorByIndex(index);
    return value;
  });

  applyMap(inputs.ortslagenValues_dict as AnyRecord | undefined, (key, value) => {
    if (key.includes("immobilienpreis")) return value * immoFactor;
    if (key.includes("grundstueckspreis")) return value * kg;
    if (key.includes("mietpreis")) return value * rentFactor;
    return value;
  });
}

function meanOf(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function setMarketValue(obj: AnyRecord | null | undefined, keyCandidates: string[], value: number) {
  if (!obj || typeof obj !== "object") return;
  for (const key of keyCandidates) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = value;
      return;
    }
  }
  obj[keyCandidates[0]] = value;
}

function getLatestYearValue(rows: DataRow[] | undefined, key: string) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let latest = -Infinity;
  let value: number | null = null;
  for (const row of rows) {
    const year = typeof row?.jahr === "number" ? row.jahr : null;
    if (year === null) continue;
    if (year > latest && typeof row?.[key] === "number") {
      latest = year;
      value = row[key] as number;
    }
  }
  return value;
}

function getYearValue(rows: DataRow[] | undefined, year: number | null, key: string) {
  if (!Array.isArray(rows) || year === null) return null;
  for (const row of rows) {
    if (row?.jahr === year && typeof row?.[key] === "number") return row[key] as number;
  }
  return null;
}

function computeIndex(current: number | null, base: number | null) {
  if (current === null || base === null || base === 0) return null;
  return Math.round((current / base) * 100 * 100) / 100;
}

function recomputeOrtslagenMinMax(data: AnyRecord, textScopeInputs: AnyRecord) {
  const rows = (data?.ortslagen_uebersicht ?? []) as DataRow[];
  if (!Array.isArray(rows) || rows.length === 0) return;

  const pick = (key: string) => {
    let minRow: DataRow | null = null;
    let maxRow: DataRow | null = null;
    for (const row of rows) {
      const val = typeof row?.[key] === "number" ? row[key] : null;
      if (val === null) continue;
      if (!minRow || val < minRow[key]) minRow = row;
      if (!maxRow || val > maxRow[key]) maxRow = row;
    }
    return { minRow, maxRow };
  };

  const immo = pick("immobilienpreise_wert");
  const plot = pick("grundstueckspreise_wert");
  const rent = pick("mietpreise_wert");

  if (data?.ortslagen_preisgrenzen_immobilie?.[0] && immo.minRow && immo.maxRow) {
    data.ortslagen_preisgrenzen_immobilie[0].guenstigste_ortslage_immobilienpreis = immo.minRow.immobilienpreise_wert;
    data.ortslagen_preisgrenzen_immobilie[0].teuerste_ortslage_immobilienpreis = immo.maxRow.immobilienpreise_wert;
    data.ortslagen_preisgrenzen_immobilie[0].guenstigste_ortslage_immobilie = immo.minRow.ortslage;
    data.ortslagen_preisgrenzen_immobilie[0].teuerste_ortslage_immobilie = immo.maxRow.ortslage;
  }

  if (data?.ortslagen_preisgrenzen_grundstueck?.[0] && plot.minRow && plot.maxRow) {
    data.ortslagen_preisgrenzen_grundstueck[0].guenstigste_ortslage_grundstueckspreis = plot.minRow.grundstueckspreise_wert;
    data.ortslagen_preisgrenzen_grundstueck[0].teuerste_ortslage_grundstueckspreis = plot.maxRow.grundstueckspreise_wert;
    data.ortslagen_preisgrenzen_grundstueck[0].guenstigste_ortslage_grundstueck = plot.minRow.ortslage;
    data.ortslagen_preisgrenzen_grundstueck[0].teuerste_ortslage_grundstueck = plot.maxRow.ortslage;
  }

  if (data?.ortslagen_preisgrenzen_miete?.[0] && rent.minRow && rent.maxRow) {
    data.ortslagen_preisgrenzen_miete[0].guenstigste_ortslage_mietpreis = rent.minRow.mietpreise_wert;
    data.ortslagen_preisgrenzen_miete[0].teuerste_ortslage_mietpreis = rent.maxRow.mietpreise_wert;
    data.ortslagen_preisgrenzen_miete[0].guenstigste_ortslage_miete = rent.minRow.ortslage;
    data.ortslagen_preisgrenzen_miete[0].teuerste_ortslage_miete = rent.maxRow.ortslage;
  }

  if (textScopeInputs?.ortslagenValues_dict && typeof textScopeInputs.ortslagenValues_dict === "object") {
    const ortslagenValues = textScopeInputs.ortslagenValues_dict as AnyRecord;
    if (immo.minRow && immo.maxRow) {
      ortslagenValues.guenstigster_immobilienpreis_ortslage = immo.minRow.ortslage;
      ortslagenValues.guenstigster_immobilienpreis_wert = immo.minRow.immobilienpreise_wert;
      ortslagenValues.teuerster_immobilienpreis_ortslage = immo.maxRow.ortslage;
      ortslagenValues.teuerster_immobilienpreis_wert = immo.maxRow.immobilienpreise_wert;
    }
    if (plot.minRow && plot.maxRow) {
      ortslagenValues.guenstigster_grundstueckspreis_ortslage = plot.minRow.ortslage;
      ortslagenValues.guenstigster_grundstueckspreis_wert = plot.minRow.grundstueckspreise_wert;
      ortslagenValues.teuerster_grundstueckspreis_ortslage = plot.maxRow.ortslage;
      ortslagenValues.teuerster_grundstueckspreis_wert = plot.maxRow.grundstueckspreise_wert;
    }
    if (rent.minRow && rent.maxRow) {
      ortslagenValues.guenstigster_mietpreis_ortslage = rent.minRow.ortslage;
      ortslagenValues.guenstigster_mietpreis_wert = rent.minRow.mietpreise_wert;
      ortslagenValues.teuerster_mietpreis_ortslage = rent.maxRow.ortslage;
      ortslagenValues.teuerster_mietpreis_wert = rent.maxRow.mietpreise_wert;
    }
  }
}

function recomputeAggregatedPrices(
  data: AnyRecord,
  textScopeInputs: AnyRecord,
  scope: "kreis" | "ortslage",
  meta: AnyRecord,
) {
  const hausKauf = toNumber(data?.haus_kaufpreis?.[0]?.kaufpreis_haus);
  const wohnungKauf = toNumber(data?.wohnung_kaufpreis?.[0]?.kaufpreis_wohnung);
  const kaufpreisGesamt = meanOf([hausKauf, wohnungKauf]);
  if (kaufpreisGesamt !== null) {
    if (Array.isArray(data?.immobilien_kaufpreis) && data.immobilien_kaufpreis[0]) {
      data.immobilien_kaufpreis[0].kaufpreis_immobilien = kaufpreisGesamt;
    }
  if (textScopeInputs?.marketValues_generallyPrices_dict && typeof textScopeInputs.marketValues_generallyPrices_dict === "object") {
    const marketValues = textScopeInputs.marketValues_generallyPrices_dict as AnyRecord;
    setMarketValue(
      marketValues,
      scope === "ortslage"
        ? ["immobilienpreise_mittel_jahr01_ortslage", "immobilienpreise_mittel_jahr01_kreis"]
        : ["immobilienpreise_mittel_jahr01_kreis"],
      kaufpreisGesamt,
      );
    }
  }

  const hausMiete = toNumber(data?.mietpreise_haus_gesamt?.[0]?.preis_haus_avg);
  const wohnungMiete = toNumber(data?.mietpreise_wohnung_gesamt?.[0]?.preis_wohnung_avg);
  const mieteGesamt = meanOf([hausMiete, wohnungMiete]);
  if (mieteGesamt !== null) {
    if (Array.isArray(data?.mietpreise_gesamt) && data.mietpreise_gesamt[0]) {
      data.mietpreise_gesamt[0].preis_kaltmiete = mieteGesamt;
    }
  if (textScopeInputs?.marketValues_generallyPrices_dict && typeof textScopeInputs.marketValues_generallyPrices_dict === "object") {
    const marketValues = textScopeInputs.marketValues_generallyPrices_dict as AnyRecord;
    setMarketValue(
      marketValues,
      scope === "ortslage"
        ? ["mietpreise_mittel_ortslage", "mietpreise_mittel_kreis"]
        : ["mietpreise_mittel_kreis"],
      mieteGesamt,
      );
    }
  }

  const regionName =
    scope === "ortslage"
      ? (meta?.ortslage_name ?? meta?.amtlicher_name ?? meta?.kreis_name ?? "")
      : (meta?.kreis_name ?? meta?.amtlicher_name ?? "");

  if (kaufpreisGesamt !== null) {
    setRegionValue(
      data?.immobilienpreise_ueberregionaler_vergleich ?? [],
      regionName,
      "immobilienpreis",
      kaufpreisGesamt,
    );
  }
  if (mieteGesamt !== null) {
    setRegionValue(
      data?.mietpreise_ueberregionaler_vergleich ?? [],
      regionName,
      "kaltmiete",
      mieteGesamt,
    );
  }

  if (kaufpreisGesamt !== null) {
    setLatestYearValue(
      data?.immobilie_kaufpreisentwicklung ?? [],
      "kaufpreisentwicklung_immobilie",
      kaufpreisGesamt,
    );
  }
  if (mieteGesamt !== null) {
    setLatestYearValue(
      data?.immobilie_mietpreisentwicklung ?? [],
      "mietpreisentwicklung_immobilie",
      mieteGesamt,
    );
  }

  recomputeOrtslagenMinMax(data, textScopeInputs);

  const basis = data?.basisjahr?.[0] ?? {};
  const basisImmo = toNumber(basis?.basisjahr_immobilienpreisindex);
  const basisPlot = toNumber(basis?.basisjahr_grundstueckspreisindex);
  const basisMiete = toNumber(basis?.basisjahr_mietpreisindex);

  const immoSeries = data?.immobilie_kaufpreisentwicklung ?? [];
  const plotSeries = data?.grundstueck_kaufpreisentwicklung ?? [];
  const rentSeries = data?.immobilie_mietpreisentwicklung ?? [];
  const houseSeries = data?.haus_kaufpreisentwicklung ?? [];
  const wohnungSeries = data?.wohnung_kaufpreisentwicklung ?? [];
  const rentWohnungSeries = data?.mietpreisentwicklung_wohnung ?? [];

  const immoIndex = computeIndex(
    getLatestYearValue(immoSeries, "kaufpreisentwicklung_immobilie"),
    getYearValue(immoSeries, basisImmo, "kaufpreisentwicklung_immobilie"),
  );
  const plotIndex = computeIndex(
    getLatestYearValue(plotSeries, "kaufpreisentwicklung_grundstueck"),
    getYearValue(plotSeries, basisPlot, "kaufpreisentwicklung_grundstueck"),
  );
  const rentIndex = computeIndex(
    getLatestYearValue(rentSeries, "mietpreisentwicklung_immobilie"),
    getYearValue(rentSeries, basisMiete, "mietpreisentwicklung_immobilie"),
  );

  if (data?.preisindex?.[0]) {
    if (immoIndex !== null) data.preisindex[0].immobilienpreisindex = immoIndex;
    if (plotIndex !== null) data.preisindex[0].grundstueckspreisindex = plotIndex;
    if (rentIndex !== null) data.preisindex[0].mietpreisindex = rentIndex;
  }

  const houseIndex = computeIndex(
    getLatestYearValue(houseSeries, "preis_k"),
    getYearValue(houseSeries, basisImmo, "preis_k"),
  );
  const wohnungIndex = computeIndex(
    getLatestYearValue(wohnungSeries, "preis_k"),
    getYearValue(wohnungSeries, basisImmo, "preis_k"),
  );
  if (data?.immobilienpreisindex_regional?.[0]) {
    if (immoIndex !== null) data.immobilienpreisindex_regional[0].immobilienpreisindex = immoIndex;
    if (houseIndex !== null) data.immobilienpreisindex_regional[0].immobilienpreisindex_haus = houseIndex;
    if (wohnungIndex !== null) data.immobilienpreisindex_regional[0].immobilienpreisindex_wohnung = wohnungIndex;
  }

  const grundstueckIndex = computeIndex(
    getLatestYearValue(plotSeries, "kaufpreisentwicklung_grundstueck"),
    getYearValue(plotSeries, basisPlot, "kaufpreisentwicklung_grundstueck"),
  );
  if (data?.grundstueckspreisindex_regional?.[0] && grundstueckIndex !== null) {
    data.grundstueckspreisindex_regional[0].grundstueckspreisindex = grundstueckIndex;
  }

  const mietpreisIndexWohnung = computeIndex(
    getLatestYearValue(rentWohnungSeries, "preis_k"),
    getYearValue(rentWohnungSeries, basisMiete, "preis_k"),
  );
  if (data?.mietpreisindex_regional?.[0] && mietpreisIndexWohnung !== null) {
    data.mietpreisindex_regional[0].mietpreisindex_wohnung = mietpreisIndexWohnung;
  }
}

type NormalizedFactors = {
  kauf_haus: { f01: number; f02: number; f03: number; f04: number; f05: number; f06: number };
  kauf_wohnung: { f01: number; f02: number; f03: number; f04: number; f05: number; f06: number };
  kauf_grundstueck: { f01: number; f02: number; f03: number; f04: number; f05: number; f06: number };
  miete_haus: { f01: number; f02: number; f03: number; f04: number; f05: number; f06: number };
  miete_wohnung: { f01: number; f02: number; f03: number; f04: number; f05: number; f06: number };
  immobilienmarkt_trend: { immobilienmarkt: number; mietmarkt: number };
  rendite: {
    mietrendite_etw: number;
    kaufpreisfaktor_etw: number;
    mietrendite_efh: number;
    kaufpreisfaktor_efh: number;
    mietrendite_mfh: number;
    kaufpreisfaktor_mfh: number;
  };
};

const DEFAULT_FACTORS: NormalizedFactors = {
  kauf_haus: { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 },
  kauf_wohnung: { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 },
  kauf_grundstueck: { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 },
  miete_haus: { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 },
  miete_wohnung: { f01: 1, f02: 1, f03: 1, f04: 1, f05: 1, f06: 1 },
  immobilienmarkt_trend: { immobilienmarkt: 0, mietmarkt: 0 },
  rendite: {
    mietrendite_etw: 1,
    kaufpreisfaktor_etw: 1,
    mietrendite_efh: 1,
    kaufpreisfaktor_efh: 1,
    mietrendite_mfh: 1,
    kaufpreisfaktor_mfh: 1,
  },
};

function safeFactor(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function safeTrendDelta(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value === 1) return 0;
  return Math.max(-100, Math.min(100, value));
}

function normalizeFactors(raw: AnyRecord | null | undefined): NormalizedFactors {
  return {
    kauf_haus: {
      f01: safeFactor(raw?.kauf_haus?.f01),
      f02: safeFactor(raw?.kauf_haus?.f02),
      f03: safeFactor(raw?.kauf_haus?.f03),
      f04: safeFactor(raw?.kauf_haus?.f04),
      f05: safeFactor(raw?.kauf_haus?.f05),
      f06: safeFactor(raw?.kauf_haus?.f06),
    },
    kauf_wohnung: {
      f01: safeFactor(raw?.kauf_wohnung?.f01),
      f02: safeFactor(raw?.kauf_wohnung?.f02),
      f03: safeFactor(raw?.kauf_wohnung?.f03),
      f04: safeFactor(raw?.kauf_wohnung?.f04),
      f05: safeFactor(raw?.kauf_wohnung?.f05),
      f06: safeFactor(raw?.kauf_wohnung?.f06),
    },
    kauf_grundstueck: {
      f01: safeFactor(raw?.kauf_grundstueck?.f01),
      f02: safeFactor(raw?.kauf_grundstueck?.f02),
      f03: safeFactor(raw?.kauf_grundstueck?.f03),
      f04: safeFactor(raw?.kauf_grundstueck?.f04),
      f05: safeFactor(raw?.kauf_grundstueck?.f05),
      f06: safeFactor(raw?.kauf_grundstueck?.f06),
    },
    miete_haus: {
      f01: safeFactor(raw?.miete_haus?.f01),
      f02: safeFactor(raw?.miete_haus?.f02),
      f03: safeFactor(raw?.miete_haus?.f03),
      f04: safeFactor(raw?.miete_haus?.f04),
      f05: safeFactor(raw?.miete_haus?.f05),
      f06: safeFactor(raw?.miete_haus?.f06),
    },
    miete_wohnung: {
      f01: safeFactor(raw?.miete_wohnung?.f01),
      f02: safeFactor(raw?.miete_wohnung?.f02),
      f03: safeFactor(raw?.miete_wohnung?.f03),
      f04: safeFactor(raw?.miete_wohnung?.f04),
      f05: safeFactor(raw?.miete_wohnung?.f05),
      f06: safeFactor(raw?.miete_wohnung?.f06),
    },
    immobilienmarkt_trend: {
      immobilienmarkt: safeTrendDelta(raw?.immobilienmarkt_trend?.immobilienmarkt),
      mietmarkt: safeTrendDelta(raw?.immobilienmarkt_trend?.mietmarkt),
    },
    rendite: {
      mietrendite_etw: safeFactor(raw?.rendite?.mietrendite_etw),
      kaufpreisfaktor_etw: safeFactor(raw?.rendite?.kaufpreisfaktor_etw),
      mietrendite_efh: safeFactor(raw?.rendite?.mietrendite_efh),
      kaufpreisfaktor_efh: safeFactor(raw?.rendite?.kaufpreisfaktor_efh),
      mietrendite_mfh: safeFactor(raw?.rendite?.mietrendite_mfh),
      kaufpreisfaktor_mfh: safeFactor(raw?.rendite?.kaufpreisfaktor_mfh),
    },
  };
}

function computeDeltaFactors(target: NormalizedFactors, previous: NormalizedFactors): NormalizedFactors {
  return {
    kauf_haus: {
      f01: target.kauf_haus.f01 / safeFactor(previous.kauf_haus.f01),
      f02: target.kauf_haus.f02 / safeFactor(previous.kauf_haus.f02),
      f03: target.kauf_haus.f03 / safeFactor(previous.kauf_haus.f03),
      f04: target.kauf_haus.f04 / safeFactor(previous.kauf_haus.f04),
      f05: target.kauf_haus.f05 / safeFactor(previous.kauf_haus.f05),
      f06: target.kauf_haus.f06 / safeFactor(previous.kauf_haus.f06),
    },
    kauf_wohnung: {
      f01: target.kauf_wohnung.f01 / safeFactor(previous.kauf_wohnung.f01),
      f02: target.kauf_wohnung.f02 / safeFactor(previous.kauf_wohnung.f02),
      f03: target.kauf_wohnung.f03 / safeFactor(previous.kauf_wohnung.f03),
      f04: target.kauf_wohnung.f04 / safeFactor(previous.kauf_wohnung.f04),
      f05: target.kauf_wohnung.f05 / safeFactor(previous.kauf_wohnung.f05),
      f06: target.kauf_wohnung.f06 / safeFactor(previous.kauf_wohnung.f06),
    },
    kauf_grundstueck: {
      f01: target.kauf_grundstueck.f01 / safeFactor(previous.kauf_grundstueck.f01),
      f02: target.kauf_grundstueck.f02 / safeFactor(previous.kauf_grundstueck.f02),
      f03: target.kauf_grundstueck.f03 / safeFactor(previous.kauf_grundstueck.f03),
      f04: target.kauf_grundstueck.f04 / safeFactor(previous.kauf_grundstueck.f04),
      f05: target.kauf_grundstueck.f05 / safeFactor(previous.kauf_grundstueck.f05),
      f06: target.kauf_grundstueck.f06 / safeFactor(previous.kauf_grundstueck.f06),
    },
    miete_haus: {
      f01: target.miete_haus.f01 / safeFactor(previous.miete_haus.f01),
      f02: target.miete_haus.f02 / safeFactor(previous.miete_haus.f02),
      f03: target.miete_haus.f03 / safeFactor(previous.miete_haus.f03),
      f04: target.miete_haus.f04 / safeFactor(previous.miete_haus.f04),
      f05: target.miete_haus.f05 / safeFactor(previous.miete_haus.f05),
      f06: target.miete_haus.f06 / safeFactor(previous.miete_haus.f06),
    },
    miete_wohnung: {
      f01: target.miete_wohnung.f01 / safeFactor(previous.miete_wohnung.f01),
      f02: target.miete_wohnung.f02 / safeFactor(previous.miete_wohnung.f02),
      f03: target.miete_wohnung.f03 / safeFactor(previous.miete_wohnung.f03),
      f04: target.miete_wohnung.f04 / safeFactor(previous.miete_wohnung.f04),
      f05: target.miete_wohnung.f05 / safeFactor(previous.miete_wohnung.f05),
      f06: target.miete_wohnung.f06 / safeFactor(previous.miete_wohnung.f06),
    },
    immobilienmarkt_trend: {
      immobilienmarkt: target.immobilienmarkt_trend.immobilienmarkt - previous.immobilienmarkt_trend.immobilienmarkt,
      mietmarkt: target.immobilienmarkt_trend.mietmarkt - previous.immobilienmarkt_trend.mietmarkt,
    },
    rendite: {
      mietrendite_etw: target.rendite.mietrendite_etw / safeFactor(previous.rendite.mietrendite_etw),
      kaufpreisfaktor_etw: target.rendite.kaufpreisfaktor_etw / safeFactor(previous.rendite.kaufpreisfaktor_etw),
      mietrendite_efh: target.rendite.mietrendite_efh / safeFactor(previous.rendite.mietrendite_efh),
      kaufpreisfaktor_efh: target.rendite.kaufpreisfaktor_efh / safeFactor(previous.rendite.kaufpreisfaktor_efh),
      mietrendite_mfh: target.rendite.mietrendite_mfh / safeFactor(previous.rendite.mietrendite_mfh),
      kaufpreisfaktor_mfh: target.rendite.kaufpreisfaktor_mfh / safeFactor(previous.rendite.kaufpreisfaktor_mfh),
    },
  };
}

export async function POST(req: Request) {
  if (!isEnabled()) {
    return NextResponse.json({ error: "Rebuild is disabled." }, { status: 403 });
  }

  let payload: RebuildRequest = {};
  try {
    payload = (await req.json()) as RebuildRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const areaId = String(payload.area_id ?? "").trim();
  const scope = payload.scope === "ortslage" ? "ortslage" : "kreis";
  const mode = payload.mode === "textgen_only" ? "textgen_only" : "full";
  const debug = payload.debug === true;

  if (!areaId) {
    return NextResponse.json({ error: "Missing area_id." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: hasAccess, error: accessError } = await supabase
    .from("partner_area_map")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("area_id", areaId)
    .maybeSingle();

  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { data: area, error: areaError } = await admin
      .from("areas")
      .select("id, slug, parent_slug, bundesland_slug")
      .eq("id", areaId)
      .maybeSingle();

    if (areaError || !area) {
      return NextResponse.json({ error: areaError?.message ?? "Area not found." }, { status: 404 });
    }

    const pathParts =
      scope === "ortslage"
        ? ["reports", "deutschland", area.bundesland_slug, area.parent_slug, `${area.slug}.json`]
        : ["reports", "deutschland", area.bundesland_slug, `${area.slug}.json`];
    const reportPath = pathParts.join("/");
    const downloadRes = await admin.storage.from(SUPABASE_BUCKET).download(reportPath);
    if (downloadRes.error || !downloadRes.data) {
      return NextResponse.json(
        { error: downloadRes.error?.message ?? "Report not found." },
        { status: 404 },
      );
    }
    const reportRaw = await downloadRes.data.text();
    const report = JSON.parse(reportRaw);
    const data = report?.data ?? {};
    const meta = report?.meta ?? {};
    const helpers = report?.helpers ?? {};
    const text = report?.text ?? {};
    const textInputs = data?.textgen_inputs ?? {};
    const scopeInputs = scope === "ortslage" ? textInputs?.ortslage : textInputs?.kreis;

    if (!scopeInputs) {
      return NextResponse.json({ error: "textgen_inputs missing in report JSON." }, { status: 400 });
    }

    if (!helpers || typeof helpers !== "object") {
      return NextResponse.json({ error: "helpers missing in report JSON." }, { status: 400 });
    }

    let targetFactors = normalizeFactors(helpers?.applied_factors ?? DEFAULT_FACTORS);
    let debugPayload: Record<string, unknown> | null = null;
    if (mode === "full") {
      const { data: settings } = await admin
        .from("data_value_settings")
        .select("kauf_haus, kauf_wohnung, kauf_grundstueck, miete_haus, miete_wohnung, immobilienmarkt_trend, rendite")
        .eq("area_id", areaId)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      targetFactors = normalizeFactors(settings ?? DEFAULT_FACTORS);
      const previousFactorsRaw = helpers?.applied_factors ?? payload.previous_factors;
      const previousFactors = previousFactorsRaw
        ? normalizeFactors(previousFactorsRaw)
        : targetFactors;
      const deltaFactors = computeDeltaFactors(targetFactors, previousFactors);
      if (debug) {
        const publicBase = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
        const publicUrl = publicBase
          ? `${publicBase.replace(/\/+$/, "")}/${SUPABASE_BUCKET}/${reportPath}`
          : null;
        debugPayload = {
          settings,
          targetFactors,
          previousFactors,
          deltaFactors,
          reportPath,
          publicUrl,
          publicUrlFresh: publicUrl ? `${publicUrl}?ts=${Date.now()}` : null,
          before: {
            haus_kaufpreis: toNumber(data?.haus_kaufpreis?.[0]?.kaufpreis_haus),
            immobilien_kaufpreis: toNumber(data?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien),
            market_immobilienpreise: toNumber(
              scopeInputs?.marketValues_generallyPrices_dict?.immobilienpreise_mittel_jahr01_kreis ??
              scopeInputs?.marketValues_generallyPrices_dict?.immobilienpreise_mittel_jahr01_ortslage,
            ),
          },
        };
      }

      const scopeKey = scope === "ortslage" ? "ortslage" : "kreis";
      if (!meta.base_values || !meta.base_values[scopeKey]) {
        meta.base_values = {
          ...(meta.base_values ?? {}),
          [scopeKey]: {
            haus_kaufpreis: toNumber(data?.haus_kaufpreis?.[0]?.kaufpreis_haus),
            wohnung_kaufpreis: toNumber(data?.wohnung_kaufpreis?.[0]?.kaufpreis_wohnung),
            grundstueck_kaufpreis: toNumber(data?.grundstueck_kaufpreis?.[0]?.kaufpreis_grundstueck),
            miete_haus_avg: toNumber(data?.mietpreise_haus_gesamt?.[0]?.preis_haus_avg),
            miete_wohnung_avg: toNumber(data?.mietpreise_wohnung_gesamt?.[0]?.preis_wohnung_avg),
            immobilien_kaufpreis: toNumber(data?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien),
            mietpreise_gesamt: toNumber(data?.mietpreise_gesamt?.[0]?.preis_kaltmiete),
          },
        };
      }

      applyFactorsToData(
        data,
        meta,
        deltaFactors,
        typeof scopeInputs?.year01 === "number" ? scopeInputs.year01 : null,
      );
      applyFactorsToTextInputs(
        scopeInputs,
        deltaFactors,
        typeof scopeInputs?.year01 === "number" ? scopeInputs.year01 : null,
      );
      recomputeAggregatedPrices(data, scopeInputs, scope, meta);
      if (debugPayload) {
        debugPayload.after = {
          haus_kaufpreis: toNumber(data?.haus_kaufpreis?.[0]?.kaufpreis_haus),
          immobilien_kaufpreis: toNumber(data?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien),
          market_immobilienpreise: toNumber(
            scopeInputs?.marketValues_generallyPrices_dict?.immobilienpreise_mittel_jahr01_kreis ??
            scopeInputs?.marketValues_generallyPrices_dict?.immobilienpreise_mittel_jahr01_ortslage,
          ),
        };
      }
    }

    const nextSignatures =
      scope === "ortslage"
        ? buildOrtslageSectionSignatures(scopeInputs)
        : buildKreisSectionSignatures(scopeInputs);
    const previousSignatures =
      (helpers?.textgen_signatures && helpers.textgen_signatures[scope]) || {};
    const changedSignatureKeys = new Set<string>();
    for (const [sectionKey, signature] of Object.entries(nextSignatures)) {
      if (previousSignatures?.[sectionKey] !== signature) {
        changedSignatureKeys.add(sectionKey);
      }
    }
    const allowedKeys = changedSignatureKeys.size > 0 ? changedSignatureKeys : undefined;
    if (debugPayload) {
      debugPayload.changed_signature_keys = Array.from(changedSignatureKeys);
      debugPayload.signature_prev = previousSignatures;
      debugPayload.signature_next = nextSignatures;
    }

    if (changedSignatureKeys.size > 0) {
      const keysToReset = Array.from(changedSignatureKeys);
      const { error: resetError } = await admin
        .from("report_texts")
        .delete()
        .eq("area_id", areaId)
        .in("section_key", keysToReset);
      if (resetError) {
        console.warn("report_texts reset failed:", resetError.message);
      }
    }

    const updatedText =
      scope === "ortslage"
        ? generateOrtslagePriceTexts(text, scopeInputs, allowedKeys)
        : generateKreisPriceTexts(text, scopeInputs, allowedKeys);

    report.text = updatedText;
    report.data = { ...data, textgen_inputs: textInputs };
    report.meta = {
      ...meta,
    };
    report.helpers = {
      ...helpers,
      textgen_last_aktualisierung: meta?.aktualisierung ?? null,
      applied_factors: targetFactors,
      textgen_signatures: {
        ...(helpers?.textgen_signatures ?? {}),
        [scope]: nextSignatures,
      },
    };

    const uploadRes = await admin.storage
      .from(SUPABASE_BUCKET)
      .upload(reportPath, JSON.stringify(report), {
        upsert: true,
        contentType: "application/json",
        cacheControl: "0",
      });

    if (uploadRes.error) {
      return NextResponse.json({ error: uploadRes.error.message }, { status: 500 });
    }

    revalidateTag("reports", "max");
    return NextResponse.json({ ok: true, area_id: areaId, scope, mode, upload_summary: null, debug: debugPayload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : null;
    return NextResponse.json(
      { error: message ?? "Rebuild failed." },
      { status: 500 },
    );
  }
}
