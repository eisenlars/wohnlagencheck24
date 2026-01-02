// utils/getText.ts

export function getText(
  obj: unknown,
  path: string,
  fallback = "",
): string {
  if (!obj || typeof obj !== "object") return fallback;

  const parts = path.split(".");
  let cur: any = obj;

  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = cur[p];
    } else {
      return fallback;
    }
  }

  return typeof cur === "string" ? cur : fallback;
}
