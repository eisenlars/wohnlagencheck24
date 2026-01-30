const DEFAULT_WEB_ASSET_BASE_URL =
  "https://www.praxiswissen-immobilien.de/fileadmin/user_upload/immobilienmarkt";
const DEFAULT_WEB_POI_BASE_URL =
  "https://www.praxiswissen-immobilien.de/fileadmin";
const DEFAULT_WEB_LANDUSE_BASE_URL =
  "https://www.praxiswissen-immobilien.de/fileadmin/visuals/map_landuse";

const WEB_ASSET_BASE_URL =
  process.env.WEB_ASSET_BASE_URL ?? DEFAULT_WEB_ASSET_BASE_URL;
const WEB_POI_BASE_URL =
  process.env.WEB_POI_BASE_URL ?? DEFAULT_WEB_POI_BASE_URL;
const WEB_LANDUSE_BASE_URL =
  process.env.WEB_LANDUSE_BASE_URL ?? DEFAULT_WEB_LANDUSE_BASE_URL;

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

function normalizeLandusePath(publicPath: string): string {
  let relPath = publicPath.replace(/^\/+/, "");
  if (relPath.startsWith("visuals/map_landuse/")) {
    relPath = relPath.replace("visuals/map_landuse/", "");
  }
  return relPath;
}

export function buildWebAssetUrl(publicPath: string): string {
  const relPath = publicPath.replace(/^\/+/, "");
  const isPoi = relPath.startsWith("visuals/map_poi_availabilities/");
  const isLanduse = relPath.startsWith("visuals/map_landuse/");
  const base = (isPoi ? WEB_POI_BASE_URL : isLanduse ? WEB_LANDUSE_BASE_URL : WEB_ASSET_BASE_URL).replace(/\/+$/, "");
  const normalized = isPoi ? relPath : isLanduse ? normalizeLandusePath(relPath) : normalizeWebAssetPath(relPath);
  return appendAssetVersion(`${base}/${normalized}`);
}
