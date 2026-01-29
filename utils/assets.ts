const DEFAULT_WEB_ASSET_BASE_URL =
  "https://www.praxiswissen-immobilien.de/fileadmin/user_upload/immobilienmarkt";
const DEFAULT_WEB_POI_BASE_URL =
  "https://praxiswissen-immobilien.de/public/fileadmin";

const WEB_ASSET_BASE_URL =
  process.env.WEB_ASSET_BASE_URL ?? DEFAULT_WEB_ASSET_BASE_URL;
const WEB_POI_BASE_URL =
  process.env.WEB_POI_BASE_URL ?? DEFAULT_WEB_POI_BASE_URL;

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
  const relPath = publicPath.replace(/^\/+/, "");
  const isPoi = relPath.startsWith("visuals/map_poi_availabilities/");
  const base = (isPoi ? WEB_POI_BASE_URL : WEB_ASSET_BASE_URL).replace(/\/+$/, "");
  const normalized = isPoi ? relPath : normalizeWebAssetPath(relPath);
  return appendAssetVersion(`${base}/${normalized}`);
}
