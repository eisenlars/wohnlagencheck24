export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;

  // Wenn es schon eine Number ist: direkt prüfen
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  // Strings robust behandeln (falls irgendwo doch Legacy reinkommt)
  const s = String(v).trim();
  if (!s) return null;

  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
