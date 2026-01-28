// app/sitemap.ts

import type { MetadataRoute } from "next";
import {
  getBundeslaender,
  getKreiseForBundesland,
  getOrteForKreis,
  getReportBySlugs,
  type Report,
} from "@/lib/data";
import { asArray, asRecord, asString } from "@/utils/records";

const BASE_URL = "https://www.wohnlagencheck24.de";

/**
 * Hilfsfunktion: "01.12.2025" -> Date
 */
function parseGermanDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return undefined;

  const [dd, mm, yyyy] = parts;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!day || !month || !year) return undefined;

  // Lokales Datum (Mitternacht)
  return new Date(year, month - 1, day);
}

/**
 * Hilfsfunktion: zieht aus einem Report das Aktualisierungsdatum,
 * z. B. aus data.konfiguration[0].aktualisierung
 */
function getLastModifiedFromReport(report: Report | null): Date | undefined {
  if (!report) return undefined;

  const konf = asArray(report.data && asRecord(report.data)?.["konfiguration"]);
  if (konf.length > 0) {
    const raw = asString(asRecord(konf[0])?.["aktualisierung"]);
    const parsed = parseGermanDate(raw);
    if (parsed) return parsed;
  }

  return undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // 1) Statische Seiten
  const now = new Date();

  const staticPaths = [
    "/",
    "/immobilienmarkt",
    "/musterseite",
    "/impressum",
    "/datenschutz",
  ];

  for (const path of staticPaths) {
    entries.push({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: path === "/" ? 1.0 : 0.7,
    });
  }

  // 2) Dynamische Immobilienmarkt-Hierarchie aus Reports
  const bundeslaender = await getBundeslaender();

  for (const bl of bundeslaender) {
    // Bundesland-URL
    const blReport = await getReportBySlugs([bl.slug]);
    const blLastMod = getLastModifiedFromReport(blReport) ?? now;

    entries.push({
      url: `${BASE_URL}/immobilienmarkt/${bl.slug}`,
      lastModified: blLastMod,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    const kreise = await getKreiseForBundesland(bl.slug);

    for (const kreis of kreise) {
      // Kreis-URL
      const kreisReport = await getReportBySlugs([bl.slug, kreis.slug]);
      const kreisLastMod = getLastModifiedFromReport(kreisReport) ?? blLastMod;

      entries.push({
        url: `${BASE_URL}/immobilienmarkt/${bl.slug}/${kreis.slug}`,
        lastModified: kreisLastMod,
        changeFrequency: "weekly",
        priority: 0.7,
      });

      const orte = await getOrteForKreis(bl.slug, kreis.slug);

      for (const ort of orte) {
        // Ortslagen-URL
        const ortLastMod = kreisLastMod;

        entries.push({
          url: `${BASE_URL}/immobilienmarkt/${bl.slug}/${kreis.slug}/${ort.slug}`,
          lastModified: ortLastMod,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  }

  return entries;
}
