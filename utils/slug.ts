export function slugifyOfferTitle(input: string): string {
  const normalized = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "angebot";
}

export function parseOfferParam(param: string): { id: string; slug: string } {
  const raw = String(param ?? "");
  const [id, ...rest] = raw.split("_");
  return {
    id: id || raw,
    slug: rest.join("_"),
  };
}
