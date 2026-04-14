import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import type { RequestMode } from "@/lib/gesuche";

function capitalizeWords(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRequestModeLabel(value: string | RequestMode | null | undefined): string {
  if (!value) return "—";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "kauf") return "Kauf";
  if (normalized === "miete") return "Miete";
  return capitalizeWords(String(value).trim());
}

export function formatRequestObjectTypeLabel(
  value: string | null | undefined,
  texts?: PortalSystemTextMap,
): string {
  if (!value) return texts?.object_generic ?? "Objekt";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "haus") return texts?.house ?? "Haus";
  if (normalized === "wohnung") return texts?.apartment ?? "Wohnung";
  return capitalizeWords(String(value).trim());
}

export function formatRequestSubtypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return capitalizeWords(String(value).trim());
}
