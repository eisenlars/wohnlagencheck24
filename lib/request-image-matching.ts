import catalogData from "@/data/request-image-catalog.v1.json";

type RequestImageCatalogAssetStatus = "planned" | "ready";

type RequestImageCatalogItem = {
  id: string;
  active: boolean;
  review_status: string;
  asset_status: RequestImageCatalogAssetStatus;
  title: string;
  image_url: string;
  thumbnail_url: string;
  alt_template: string;
  tags: {
    persona: string[];
    gender_presentation: string[];
    environment: string[];
    object_focus: string[];
    style: string[];
    mood: string[];
    life_phase: string[];
  };
  signals: string[];
  negative_signals: string[];
  priority: number;
  quality_score: number;
  last_prompt: string;
  prompt_version: string;
  generation_notes: string;
};

type RequestImageCatalog = {
  meta: {
    version: number;
    locale: string;
    description: string;
    updated_at: string;
  };
  tag_taxonomy: Record<string, string[]>;
  items: RequestImageCatalogItem[];
};

export type RequestImageMatchInput = {
  requestType?: string | null;
  objectType?: string | null;
  objectSubtype?: string | null;
  minRooms?: number | null;
  maxRooms?: number | null;
  minAreaSqm?: number | null;
  maxAreaSqm?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  radiusKm?: number | null;
  regionLabels?: string[];
  textContexts?: string[];
};

export type RequestAudienceProfile = {
  persona: string[];
  genderPresentation: string[];
  environment: string[];
  objectFocus: string[];
  style: string[];
  mood: string[];
  lifePhase: string[];
  signals: string[];
  confidence: number;
};

export type RequestImageMatchCandidate = {
  catalogId: string;
  title: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  alt: string;
  score: number;
  assetStatus: RequestImageCatalogAssetStatus;
  lastPrompt: string;
  promptVersion: string;
  generationNotes: string;
  tags: RequestAudienceProfile;
};

export type RequestImageMatchResult = {
  profile: RequestAudienceProfile;
  primary: RequestImageMatchCandidate | null;
  candidates: RequestImageMatchCandidate[];
};

const catalog = catalogData as RequestImageCatalog;
const DEFAULT_REQUEST_IMAGE_URL = "/images/requests/default_request.jpg";
const DEFAULT_REQUEST_IMAGE_ALT = "Symbolbild für Immobiliengesuch";

const POSITIVE_SIGNAL_GROUPS = {
  investor: ["investor", "kapitalanlage", "rendite", "anlage", "mfh", "mehrfamilienhaus", "wohn und geschaeftshaus"],
  seniorenpaar: ["senior", "ruhestand", "barrierearm", "barrierefrei", "altersgerecht", "aufzug"],
  familie_3plus: ["3 kinder", "drei kinder", "groesse familie", "grosse familie", "mehrere kinder"],
  familie_2_kinder: ["2 kinder", "zwei kinder", "familie mit zwei kindern"],
  familie_1_kind: ["familie", "kind", "baby", "kinderzimmer", "familienfreundlich"],
  paar: ["paar", "ehepaar", "partner"],
  single: ["single", "allein", "student", "pendler", "erste wohnung"],
  maennlich: ["single mann", "mann", "maennlich", "männlich", "herr", "junger mann"],
  weiblich: ["single frau", "frau", "weiblich", "dame", "junge frau", "seniorin", "alleinstehende seniorin"],
  urban: ["urban", "city", "innenstadt", "zentral", "stadtwohnung", "city-lage"],
  suburban: ["stadtrand", "vorort", "suburban", "randlage"],
  laendlich: ["laendlich", "dorf", "doerflich", "land", "landlich"],
  gruen: ["gruen", "garten", "park", "naturnah", "ruhig"],
  modern: ["modern", "neubau", "zeitgemaess", "stylish"],
  hochwertig: ["hochwertig", "gehoben", "premium", "exklusiv"],
  klassisch: ["klassisch", "traditionell", "altbau"],
  bodenstaendig: ["bodenstaendig", "solide", "familiennah"],
  ruhig: ["ruhig", "entspannt", "beschaulich"],
  familiaer: ["familie", "familiaer", "kinder"],
  wertig: ["wertig", "hochwertig", "gehoben"],
  serioes: ["serioes", "seriös", "diskret", "professionell"],
  erste_wohnung: ["erste wohnung", "erstbezug", "erste gemeinsame wohnung"],
  familiengruendung: ["familie", "kinder", "baby", "garten"],
  downsizing: ["downsizing", "verkleinern", "weniger flaeche", "altersgerecht"],
  altersgerecht: ["altersgerecht", "barrierearm", "barrierefrei", "senior"],
  kapitalanlage: ["kapitalanlage", "investor", "rendite", "anlage"]
} as const;

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedNeedle) return false;
  return haystack.includes(normalizedNeedle);
}

function countMatches(haystack: string, needles: readonly string[]): number {
  return needles.reduce((count, needle) => count + (hasPhrase(haystack, needle) ? 1 : 0), 0);
}

function inferObjectFocus(objectType: string, objectSubtype: string): string[] {
  const haystack = normalizeText(`${objectType} ${objectSubtype}`);
  const tags: string[] = [];
  if (hasPhrase(haystack, "mehrfamilienhaus") || hasPhrase(haystack, "mfh")) tags.push("mehrfamilienhaus", "anlage");
  if (hasPhrase(haystack, "reihenhaus")) tags.push("reihenhaus", "haus");
  if (hasPhrase(haystack, "haus")) tags.push("haus");
  if (hasPhrase(haystack, "wohnung") || hasPhrase(haystack, "apartment")) tags.push("wohnung");
  if (tags.length === 0) tags.push("wohnung");
  return dedupe(tags);
}

function inferPersona(text: string, objectFocus: string[], minRooms: number | null, maxRooms: number | null, minAreaSqm: number | null): string[] {
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.investor) > 0) return ["investor"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.seniorenpaar) > 0) return ["seniorenpaar"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.familie_3plus) > 0) return ["familie_3plus"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.familie_2_kinder) > 0) return ["familie_2_kinder"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.familie_1_kind) > 0) return ["familie_1_kind"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.paar) > 0) return ["paar"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.single) > 0) return ["single"];

  const relevantRooms = maxRooms ?? minRooms;
  if (objectFocus.includes("anlage") || objectFocus.includes("mehrfamilienhaus")) return ["investor"];
  if (objectFocus.includes("haus") && ((relevantRooms ?? 0) >= 5 || (minAreaSqm ?? 0) >= 140)) return ["familie_3plus"];
  if (objectFocus.includes("haus") && ((relevantRooms ?? 0) >= 4 || (minAreaSqm ?? 0) >= 110)) return ["familie_2_kinder"];
  if (objectFocus.includes("wohnung") && ((relevantRooms ?? 0) <= 2)) return ["single"];
  return ["paar"];
}

function inferEnvironment(text: string, regionLabels: string[], radiusKm: number | null): string[] {
  const regionText = normalizeText(regionLabels.join(" "));
  const haystack = `${text} ${regionText}`.trim();
  const tags: string[] = [];
  if (countMatches(haystack, POSITIVE_SIGNAL_GROUPS.urban) > 0) tags.push("urban", "innenstadt");
  if (countMatches(haystack, POSITIVE_SIGNAL_GROUPS.suburban) > 0) tags.push("suburban", "stadtrand");
  if (countMatches(haystack, POSITIVE_SIGNAL_GROUPS.laendlich) > 0) tags.push("laendlich", "dorf");
  if (countMatches(haystack, POSITIVE_SIGNAL_GROUPS.gruen) > 0) tags.push("gruen");
  if (tags.length === 0) {
    if (radiusKm !== null && radiusKm <= 8) tags.push("urban");
    else if (radiusKm !== null && radiusKm >= 20) tags.push("laendlich");
    else tags.push("suburban");
  }
  return dedupe(tags);
}

function inferGenderPresentation(text: string): string[] {
  const tags: string[] = [];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.maennlich) > 0) tags.push("maennlich");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.weiblich) > 0) tags.push("weiblich");
  return dedupe(tags);
}

function inferStyle(text: string): string[] {
  const tags: string[] = ["editorial"];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.modern) > 0) tags.push("modern");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.hochwertig) > 0) tags.push("hochwertig");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.klassisch) > 0) tags.push("klassisch");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.bodenstaendig) > 0) tags.push("bodenstaendig");
  if (tags.length === 1) tags.push("modern");
  return dedupe(tags);
}

function inferMood(text: string, persona: string[]): string[] {
  const tags: string[] = [];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.ruhig) > 0) tags.push("ruhig");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.familiaer) > 0 || persona.some((tag) => tag.startsWith("familie"))) tags.push("familiaer");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.wertig) > 0) tags.push("wertig");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.serioes) > 0 || persona.includes("investor")) tags.push("serioes");
  if (tags.length === 0) tags.push(persona.includes("investor") ? "serioes" : "ruhig");
  return dedupe(tags);
}

function inferLifePhase(text: string, persona: string[]): string[] {
  const tags: string[] = [];
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.erste_wohnung) > 0 || persona.includes("single")) tags.push("erste_wohnung");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.familiengruendung) > 0 || persona.some((tag) => tag.startsWith("familie"))) tags.push("familiengruendung");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.downsizing) > 0) tags.push("downsizing");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.altersgerecht) > 0 || persona.includes("seniorenpaar")) tags.push("altersgerecht");
  if (countMatches(text, POSITIVE_SIGNAL_GROUPS.kapitalanlage) > 0 || persona.includes("investor")) tags.push("kapitalanlage");
  return dedupe(tags);
}

function inferSignals(text: string, objectFocus: string[]): string[] {
  const signals: string[] = [];
  for (const signalGroup of Object.values(POSITIVE_SIGNAL_GROUPS)) {
    for (const signal of signalGroup) {
      if (hasPhrase(text, signal)) signals.push(signal);
    }
  }
  if (objectFocus.includes("haus")) signals.push("haus");
  if (objectFocus.includes("wohnung")) signals.push("wohnung");
  if (objectFocus.includes("anlage")) signals.push("anlage");
  return dedupe(signals);
}

function createCandidate(item: RequestImageCatalogItem, score: number): RequestImageMatchCandidate {
  return {
    catalogId: item.id,
    title: item.title,
    imageUrl: item.asset_status === "ready" ? item.image_url : null,
    thumbnailUrl: item.asset_status === "ready" ? item.thumbnail_url : null,
    alt: item.alt_template,
    score,
    assetStatus: item.asset_status,
    lastPrompt: item.last_prompt,
    promptVersion: item.prompt_version,
    generationNotes: item.generation_notes,
    tags: {
      persona: item.tags.persona,
      genderPresentation: item.tags.gender_presentation,
      environment: item.tags.environment,
      objectFocus: item.tags.object_focus,
      style: item.tags.style,
      mood: item.tags.mood,
      lifePhase: item.tags.life_phase,
      signals: item.signals,
      confidence: 1,
    },
  };
}

function scoreItem(item: RequestImageCatalogItem, profile: RequestAudienceProfile): number {
  const positiveScore =
    item.tags.persona.filter((tag) => profile.persona.includes(tag)).length * 40 +
    item.tags.gender_presentation.filter((tag) => profile.genderPresentation.includes(tag)).length * 5 +
    item.tags.object_focus.filter((tag) => profile.objectFocus.includes(tag)).length * 20 +
    item.tags.environment.filter((tag) => profile.environment.includes(tag)).length * 15 +
    item.tags.life_phase.filter((tag) => profile.lifePhase.includes(tag)).length * 8 +
    item.tags.mood.filter((tag) => profile.mood.includes(tag)).length * 6 +
    item.tags.style.filter((tag) => profile.style.includes(tag)).length * 4 +
    item.signals.filter((signal) => profile.signals.includes(signal)).length * 3;
  const negativeScore = item.negative_signals.filter(
    (signal) =>
      profile.persona.includes(signal) ||
      profile.environment.includes(signal) ||
      profile.objectFocus.includes(signal) ||
      profile.signals.includes(signal),
  ).length * 25;
  return positiveScore - negativeScore + Math.round(item.priority * 10) + Math.round(item.quality_score * 10);
}

export function getRequestImageCatalog(): RequestImageCatalog {
  return catalog;
}

export function matchRequestImage(input: RequestImageMatchInput): RequestImageMatchResult {
  const text = normalizeText(
    [
      input.requestType,
      input.objectType,
      input.objectSubtype,
      ...(input.regionLabels ?? []),
      ...(input.textContexts ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  const objectFocus = inferObjectFocus(String(input.objectType ?? ""), String(input.objectSubtype ?? ""));
  const persona = inferPersona(text, objectFocus, input.minRooms ?? null, input.maxRooms ?? null, input.minAreaSqm ?? null);
  const environment = inferEnvironment(text, input.regionLabels ?? [], input.radiusKm ?? null);
  const genderPresentation = inferGenderPresentation(text);
  const style = inferStyle(text);
  const mood = inferMood(text, persona);
  const lifePhase = inferLifePhase(text, persona);
  const signals = inferSignals(text, objectFocus);
  const matchedSignals =
    persona.length +
    environment.length +
    objectFocus.length +
    lifePhase.length +
    Math.min(signals.length, 6);
  const profile: RequestAudienceProfile = {
    persona,
    genderPresentation,
    environment,
    objectFocus,
    style,
    mood,
    lifePhase,
    signals,
    confidence: Math.min(0.98, Math.max(0.45, matchedSignals / 18)),
  };

  const candidates = catalog.items
    .filter((item) => item.active)
    .map((item) => createCandidate(item, scoreItem(item, profile)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const primary = candidates[0]
    ? {
        ...candidates[0],
        imageUrl: candidates[0].imageUrl ?? DEFAULT_REQUEST_IMAGE_URL,
        alt: candidates[0].imageUrl ? candidates[0].alt : DEFAULT_REQUEST_IMAGE_ALT,
      }
    : {
        catalogId: "default_request",
        title: "Standardmotiv Gesuch",
        imageUrl: DEFAULT_REQUEST_IMAGE_URL,
        thumbnailUrl: DEFAULT_REQUEST_IMAGE_URL,
        alt: DEFAULT_REQUEST_IMAGE_ALT,
        score: 0,
        assetStatus: "ready" as const,
        lastPrompt: "",
        promptVersion: "fallback",
        generationNotes: "Automatisches Fallback ohne katalogbasiertes Motiv.",
        tags: {
          ...profile,
        },
      };

  return {
    profile,
    primary,
    candidates,
  };
}
