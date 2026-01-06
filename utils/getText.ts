// utils/getText.ts

import { asRecord } from "@/utils/records";

export function getText(
  obj: unknown,
  path: string,
  fallback = "",
): string {
  const parts = path.split(".");
  let cur: unknown = obj;

  for (const p of parts) {
    const rec = asRecord(cur);
    if (rec && p in rec) {
      cur = rec[p];
    } else {
      return fallback;
    }
  }

  return typeof cur === "string" ? cur : fallback;
}
