const DEFAULT_WEB_ASSET_BASE_URL =
  "https://www.praxiswissen-immobilien.de/fileadmin/user_upload/immobilienmarkt";

const WEB_ASSET_BASE_URL =
  process.env.WEB_ASSET_BASE_URL ?? DEFAULT_WEB_ASSET_BASE_URL;

const ASSET_VERSION = process.env.ASSET_VERSION ?? "";

function appendAssetVersion(url: string): string {
  if (!ASSET_VERSION) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(ASSET_VERSION)}`;
}

function normalizeWebAssetPath(publicPath: string): string {
  let relPath = publicPath.replace(/^\/+/, "");
  if (relPath.startsWith("images/immobilienmarkt/")) {
    relPath = relPath.replace("images/immobilienmarkt/", "");
  }
  return relPath;
}

export function buildWebAssetUrl(publicPath: string): string {
  const base = WEB_ASSET_BASE_URL.replace(/\/+$/, "");
  const relPath = normalizeWebAssetPath(publicPath);
  return appendAssetVersion(`${base}/${relPath}`);
}
