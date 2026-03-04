import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type ValidateOutboundUrlOptions = {
  allowHttp?: boolean;
};

export type ValidateOutboundUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((v) => Number(v));
  if (parts.length !== 4 || parts.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true; // fe80::/10
  }
  return false;
}

function isPrivateOrLocalIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export async function validateOutboundUrl(
  rawUrl: string,
  options: ValidateOutboundUrlOptions = {},
): Promise<ValidateOutboundUrlResult> {
  const allowHttp = options.allowHttp === true;
  const input = String(rawUrl ?? "").trim();
  if (!input) return { ok: false, reason: "url_missing" };

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "url_invalid" };
  }

  if (!allowHttp && url.protocol !== "https:") {
    return { ok: false, reason: "protocol_not_https" };
  }
  if (allowHttp && url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "protocol_not_allowed" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_not_allowed" };
  }

  const host = String(url.hostname ?? "").trim().toLowerCase();
  if (!host) return { ok: false, reason: "host_missing" };
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "host_localhost_blocked" };
  }

  if (isIP(host)) {
    if (isPrivateOrLocalIp(host)) {
      return { ok: false, reason: "ip_private_blocked" };
    }
    return { ok: true, url: url.toString() };
  }

  try {
    const resolved = await lookup(host, { all: true });
    if (!resolved || resolved.length === 0) {
      return { ok: false, reason: "dns_empty" };
    }
    for (const addr of resolved) {
      if (isPrivateOrLocalIp(String(addr.address ?? ""))) {
        return { ok: false, reason: "dns_private_ip_blocked" };
      }
    }
  } catch {
    return { ok: false, reason: "dns_lookup_failed" };
  }

  return { ok: true, url: url.toString() };
}

