function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isRadiusContextSegment(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.startsWith("umkreis") || /^\d+\s*km\s+um\b/.test(normalized);
}

export function cleanRequestRegionTargetLabel(
  value: string | null | undefined,
  city?: string | null,
): string {
  const label = String(value ?? "").trim();
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isRadiusContextSegment(part));
  if (parts.length > 0) return parts[0] ?? "";
  const cityText = String(city ?? "").trim();
  return isRadiusContextSegment(cityText) ? "" : cityText;
}
