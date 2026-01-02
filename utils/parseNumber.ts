export function parseNumberDE(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  // Neu: JSON number
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  // Alt: String "3.188,93" oder auch "3188.93"
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // Wenn Komma vorkommt, als Dezimaltrennzeichen interpretieren (de-DE).
    // Tausenderpunkte entfernen.
    const normalized = s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s;

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // Alles andere: nicht parsebar
  return null;
}