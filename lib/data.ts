import fs from "node:fs";
import path from "node:path";

export type Ort = {
  id: string;
  slug: string;
  name: string;
  bundesland: string;
  landkreis: string;
  lat: number;
  lng: number;
  plz: string;
  kurzbeschreibung: string;
  beschreibung: string;
  regionalschluessel: string;
};

const filePath = path.join(process.cwd(), "data", "orte.json");

export function getAllOrte(): Ort[] {
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

export function getOrtBySlug(slug: string): Ort | undefined {
  return getAllOrte().find((o) => o.slug === slug);
}
