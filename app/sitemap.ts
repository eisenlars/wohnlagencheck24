// app/sitemap.ts

import type { MetadataRoute } from "next";
import {
  getBundeslaender,
  getReportsIndex,
  getKreiseForBundesland,
  getOrteForKreis,
} from "@/lib/data";
import {
  getActiveKreisSlugsForBundesland,
  getActiveOrtSlugsForKreis,
  isBundeslandVisible,
} from "@/lib/area-visibility";

const BASE_URL = "https://www.wohnlagencheck24.de";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // 1) Statische Seiten
  const now = new Date();

  const staticPaths = [
    "/",
    "/immobilienmarkt",
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
  const reportsIndex = await getReportsIndex();
  const bundeslaender = await getBundeslaender(reportsIndex);

  for (const bl of bundeslaender) {
    if (!(await isBundeslandVisible(bl.slug))) continue;

    // Bundesland-URL
    entries.push({
      url: `${BASE_URL}/immobilienmarkt/${bl.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    const kreise = await getKreiseForBundesland(bl.slug, reportsIndex);
    const activeKreise = await getActiveKreisSlugsForBundesland(bl.slug);

    for (const kreis of kreise) {
      if (!activeKreise.has(kreis.slug)) continue;

      // Kreis-URL
      entries.push({
        url: `${BASE_URL}/immobilienmarkt/${bl.slug}/${kreis.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });

      const orte = await getOrteForKreis(bl.slug, kreis.slug, reportsIndex);
      const activeOrte = await getActiveOrtSlugsForKreis(bl.slug, kreis.slug);

      for (const ort of orte) {
        if (!activeOrte.has(ort.slug)) continue;

        // Ortslagen-URL
        entries.push({
          url: `${BASE_URL}/immobilienmarkt/${bl.slug}/${kreis.slug}/${ort.slug}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  }

  return entries;
}
