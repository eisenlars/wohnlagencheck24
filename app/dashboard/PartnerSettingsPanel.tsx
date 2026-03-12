"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getProviderSpec, getProvidersForKind } from "@/lib/integrations/providers";
import FullscreenLoader from "@/components/ui/FullscreenLoader";
export type SettingsSection = "konto" | "profil" | "integrationen" | "kostenmonitor";

type PartnerProfile = {
  id: string;
  company_name?: string | null;
  contact_email?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  website_url?: string | null;
};

type PartnerIntegration = {
  id: string;
  kind: string;
  provider: string;
  base_url?: string | null;
  auth_type?: string | null;
  detail_url_template?: string | null;
  is_active: boolean;
  settings?: Record<string, unknown> | null;
  auth_config?: Record<string, unknown> | null;
  local_site_api_key?: string | null;
};

type IntegrationPolicy = {
  llm_partner_managed_allowed?: boolean;
  llm_mode_default?: string | null;
};

type PartnerLlmUsageRow = {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_eur: number;
  input_price_usd_per_1k?: number | null;
  output_price_usd_per_1k?: number | null;
};

type PartnerFeatureRow = {
  key: string;
  label: string;
  enabled: boolean;
  monthly_price_eur: number;
  billing_unit?: string | null;
  note: string;
};

type PortalAboRow = {
  key: string;
  kreis_name: string;
  kreis_id: string;
  base_price_eur: number;
  ortslage_price_eur: number;
  ortslagen_count: number;
  ortslagen_total_price_eur: number;
  export_ortslagen_count: number;
  export_ortslagen_total_price_eur: number;
  total_price_eur: number;
};

type IntegrationDraft = {
  kind: string;
  provider: string;
  base_url: string;
  auth_type: string;
  detail_url_template: string;
  llm_model: string;
  llm_api_version: string;
  llm_temperature: string;
  llm_max_tokens: string;
};

type SecretDraft = {
  api_key: string;
  token: string;
  secret: string;
};

type SecretFieldKey = keyof SecretDraft;

const AUTH_TYPE_LABELS: Record<string, string> = {
  api_key: "API Key",
  token: "Token",
  bearer: "Bearer",
  basic: "Basic",
  none: "Keine Authentifizierung",
};
const LEGACY_LOCAL_SITE_BAD_BASE_URLS = new Set([
  "https://api.propstack.de/v1",
  "http://api.propstack.de/v1",
]);

function getDefaultProviderId(kind: string): string {
  const options = getProvidersForKind(kind);
  return options[0]?.id ?? "";
}

function getDefaultAuthType(kind: string, provider: string): string {
  const spec = getProviderSpec(provider) ?? getProviderSpec(getDefaultProviderId(kind));
  if (!spec) return "";
  return spec.defaultAuthType ?? spec.authTypes[0] ?? "";
}

function buildDefaultDraft(kind: string): IntegrationDraft {
  const provider = getDefaultProviderId(kind);
  const defaults = getDraftDefaults(kind, provider);
  return {
    kind,
    provider,
    base_url: defaults.base_url ?? "",
    auth_type: getDefaultAuthType(kind, provider),
    detail_url_template: defaults.detail_url_template ?? "",
    llm_model: defaults.llm_model ?? "gpt-4o-mini",
    llm_api_version: defaults.llm_api_version ?? "",
    llm_temperature: defaults.llm_temperature ?? "0.4",
    llm_max_tokens: defaults.llm_max_tokens ?? "800",
  };
}

function buildDraftFromIntegration(integration: PartnerIntegration): IntegrationDraft {
  const settings = (integration.settings ?? {}) as Record<string, unknown>;
  const defaults = getDraftDefaults(integration.kind, integration.provider);
  return {
    kind: integration.kind,
    provider: integration.provider,
    base_url: String(integration.base_url ?? defaults.base_url ?? ""),
    auth_type: String(integration.auth_type ?? getDefaultAuthType(integration.kind, integration.provider)),
    detail_url_template: String(integration.detail_url_template ?? defaults.detail_url_template ?? ""),
    llm_model: String(settings.model ?? defaults.llm_model ?? "gpt-4o-mini"),
    llm_api_version: String(settings.api_version ?? defaults.llm_api_version ?? ""),
    llm_temperature: String(settings.temperature ?? defaults.llm_temperature ?? "0.4"),
    llm_max_tokens: String(settings.max_tokens ?? defaults.llm_max_tokens ?? "800"),
  };
}

function getDraftDefaults(kind: string, provider: string): Partial<IntegrationDraft> {
  if (kind === "crm" && provider === "propstack") {
    return {
      base_url: "https://api.propstack.de/v1",
      detail_url_template: "https://www.partnerdomain.de/expose/{exposee_id}",
    };
  }
  if (kind === "crm" && provider === "onoffice") {
    return {
      base_url: "https://api.onoffice.de/api/stable/api.php",
      detail_url_template: "https://www.partnerdomain.de/expose/{exposee_id}",
    };
  }
  if (kind === "llm") {
    if (provider === "anthropic") {
      return {
        base_url: "https://api.anthropic.com/v1",
        llm_model: "claude-opus-4-1-20250805",
        llm_temperature: "0.4",
        llm_max_tokens: "800",
      };
    }
    if (provider === "mistral") {
      return {
        base_url: "https://api.mistral.ai/v1",
        llm_model: "mistral-small-latest",
        llm_temperature: "0.4",
        llm_max_tokens: "800",
      };
    }
    if (provider === "azure_openai") {
      return {
        llm_model: "gpt-4o-prod",
        llm_api_version: "2024-10-21",
        llm_temperature: "0.4",
        llm_max_tokens: "800",
      };
    }
    if (provider === "google_gemini") {
      return {
        base_url: "https://generativelanguage.googleapis.com/v1beta",
        llm_model: "gemini-2.5-pro",
        llm_temperature: "0.4",
        llm_max_tokens: "800",
      };
    }
    return {
      base_url: "https://api.openai.com/v1",
      llm_model: "gpt-5.2",
      llm_temperature: "0.4",
      llm_max_tokens: "800",
    };
  }
  return {};
}

async function readJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function asText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function getHostnameLabelFromUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.trim().toLowerCase();
    return host || null;
  } catch {
    return raw;
  }
}

function asFiniteNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function shiftYearMonth(value: string, delta: number): string {
  const base = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!base) return value;
  const year = Number(base[1]);
  const month = Number(base[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function buildIntegrationSettings(
  draft: IntegrationDraft,
  existingSettings?: Record<string, unknown> | null,
) {
  if (draft.kind === "crm") {
    const existingCapabilities = ((existingSettings ?? {}) as Record<string, unknown>).capabilities;
    if (existingCapabilities && typeof existingCapabilities === "object") {
      return existingSettings ?? null;
    }
    return {
      ...(existingSettings ?? {}),
      capabilities: {
        listings: true,
        references: true,
        requests: true,
      },
    };
  }

  if (draft.kind !== "llm") return existingSettings ?? null;
  const model = draft.llm_model.trim();
  if (!model) {
    throw new Error("Für LLM-Integrationen ist ein Modell erforderlich (z. B. gpt-4o-mini).");
  }
  const apiVersion = draft.llm_api_version.trim();
  const temperature = asFiniteNumber(draft.llm_temperature);
  const maxTokens = asFiniteNumber(draft.llm_max_tokens);
  const settings: Record<string, unknown> = { ...((existingSettings ?? {}) as Record<string, unknown>), model };
  if (String(draft.provider ?? "").toLowerCase() === "azure_openai") {
    if (!apiVersion) {
      throw new Error("Für Azure OpenAI ist eine API-Version erforderlich (z. B. 2024-10-21).");
    }
    settings.api_version = apiVersion;
  } else {
    delete settings.api_version;
  }
  if (temperature !== null) settings.temperature = temperature;
  else delete settings.temperature;
  if (maxTokens !== null) settings.max_tokens = Math.max(1, Math.floor(maxTokens));
  else delete settings.max_tokens;
  return settings;
}

function getRelevantSecretFields(integration: Pick<PartnerIntegration, "kind" | "provider" | "auth_type">): SecretFieldKey[] {
  const provider = String(integration.provider ?? "").toLowerCase();
  const kind = String(integration.kind ?? "").toLowerCase();
  const authType = String(integration.auth_type ?? "").toLowerCase();

  if (kind === "local_site") return ["token"];
  if (provider === "onoffice") return ["token", "secret"];
  if (provider === "propstack") return ["api_key"];
  if (provider === "openimmo") {
    if (authType.includes("basic")) return ["token", "secret"];
    if (authType.includes("token")) return ["token"];
    return [];
  }
  if (kind === "llm") return ["api_key"];

  if (authType.includes("none")) return [];
  if (authType.includes("api_key")) return ["api_key"];
  if (authType.includes("token")) return ["token"];
  if (authType.includes("bearer")) return ["token"];
  if (authType.includes("basic")) return ["token", "secret"];
  return ["api_key", "token", "secret"];
}

function getIntegrationPrimaryLabel(integration: Pick<PartnerIntegration, "kind" | "provider" | "base_url">): string {
  if (integration.kind === "local_site") {
    const host = getHostnameLabelFromUrl(integration.base_url);
    return host ? `Local Site · ${host}` : "Local Site · ohne URL";
  }
  const spec = getProviderSpec(integration.provider);
  if (spec?.label) return spec.label;
  const provider = String(integration.provider ?? "").trim();
  return provider || "Unbekannter Provider";
}

function getIntegrationListLabel(integration: Pick<PartnerIntegration, "kind" | "provider" | "base_url">): string {
  if (integration.kind === "local_site") {
    return getHostnameLabelFromUrl(integration.base_url) ?? "ohne URL";
  }
  return getIntegrationPrimaryLabel(integration);
}

function getKindLabel(kind: string): string {
  const normalized = String(kind ?? "").toLowerCase();
  if (normalized === "crm") return "CRM";
  if (normalized === "llm") return "LLM";
  if (normalized === "local_site") return "Local Site";
  if (normalized === "other") return "Sonstige";
  return kind;
}

function formatProviderLabel(provider: string): string {
  const p = String(provider ?? "").toLowerCase();
  if (p === "openai") return "OpenAI";
  if (p === "anthropic") return "Anthropic";
  if (p === "google_gemini") return "Gemini";
  if (p === "azure_openai") return "Azure OpenAI";
  if (p === "mistral") return "Mistral";
  return provider || "LLM";
}

function getIntegrationMetaText(integration: Pick<PartnerIntegration, "kind" | "is_active" | "auth_type">): string {
  const auth = String(integration.auth_type ?? "").toLowerCase();
  const authLabel = auth ? AUTH_TYPE_LABELS[auth] ?? auth : "nicht gesetzt";
  const direction = String(integration.kind ?? "").toLowerCase() === "local_site" ? "Ausspielkanal" : "Datenquelle";
  return `Typ: ${getKindLabel(integration.kind)} · Rolle: ${direction} · Authentifizierung: ${authLabel} · Status: ${integration.is_active ? "aktiv" : "inaktiv"}`;
}

function getSecretFieldMeta(
  integration: Pick<PartnerIntegration, "kind" | "provider" | "auth_type">,
  field: SecretFieldKey,
) {
  const provider = String(integration.provider ?? "").toLowerCase();
  const authType = String(integration.auth_type ?? "").toLowerCase();

  if (field === "api_key") {
    return { label: "API Key", placeholder: "z. B. sk-..." };
  }

  if (provider === "onoffice") {
    if (field === "token") return { label: "API Token", placeholder: "onOffice Token eingeben" };
    if (field === "secret") return { label: "API Secret", placeholder: "onOffice Secret eingeben" };
  }
  if (provider === "local_site" || integration.kind === "local_site") {
    return { label: "API-Key", placeholder: "z. B. mein-lokaler-api-schluessel-2026" };
  }
  if (provider === "openimmo" && field === "token") {
    return authType.includes("basic")
      ? { label: "Benutzername", placeholder: "Benutzername eingeben" }
      : { label: "Feed Token", placeholder: "Token eingeben" };
  }
  if (provider === "openimmo" && field === "secret") {
    return { label: "Passwort", placeholder: "Passwort eingeben" };
  }
  if (field === "secret") {
    return { label: "API Secret", placeholder: "Secret eingeben" };
  }
  if (authType.includes("bearer")) {
    return { label: "Bearer Token", placeholder: "Bearer Token eingeben" };
  }
  return { label: "Token", placeholder: "Token eingeben" };
}

function getProviderBeginnerHint(kind: string, provider: string): string {
  const k = String(kind ?? "").toLowerCase();
  const p = String(provider ?? "").toLowerCase();
  if (k === "crm" && p === "propstack") {
    return "Für Propstack brauchst du in der Regel Base URL und API Key.";
  }
  if (k === "crm" && p === "onoffice") {
    return "Für onOffice brauchst du in der Regel Base URL, API Token und API Secret.";
  }
  if (k === "crm" && p === "openimmo") {
    return "OpenImmo läuft meist über Feed-URL, je nach Quelle optional mit Token/Basic-Login.";
  }
  if (k === "llm") {
    return "Für LLM reicht meist API Key + Modell. Base URL nur bei speziellen Setups.";
  }
  if (k === "local_site") {
    return "Für Local Site brauchst du nur einen geheimen Token. Diesen hinterlegst du einmal und trägst ihn danach auf deiner Website als Bearer-Token ein.";
  }
  return "Wähle den Anbieter, den du wirklich nutzt. Nicht benötigte Felder kannst du leer lassen.";
}

function getIntegrationSetupHeadline(kind: string): string {
  const k = String(kind ?? "").toLowerCase();
  if (k === "local_site") return "So richtest du Local Site ein";
  if (k === "crm") return "So richtest du die CRM-Anbindung ein";
  if (k === "llm") return "So richtest du die LLM-Anbindung ein";
  return "So richtest du diese Anbindung ein";
}

function getIntegrationSetupSteps(kind: string): string[] {
  const k = String(kind ?? "").toLowerCase();
  if (k === "local_site") {
    return [
      "Basisdaten speichern (Website-URL als Kennung).",
      "Im Schritt \"API-Key\" einen Schlüssel erzeugen und speichern.",
      "Diesen API-Key auf deiner Website als Bearer-Token hinterlegen.",
    ];
  }
  if (k === "crm") {
    return [
      "Anbieter und Basisdaten (z. B. Base URL) speichern.",
      "Im Schritt \"API-Key\" Zugangsdaten speichern und Verbindung testen.",
    ];
  }
  if (k === "llm") {
    return [
      "Anbieter und Basisdaten speichern.",
      "Modell und Parameter (z. B. Temperature, Max Tokens) festlegen.",
      "Im Schritt \"API-Key\" Zugangsdaten speichern und Verbindung testen.",
    ];
  }
  return [
    "Basisdaten der Anbindung speichern.",
    "Erforderliche Zugangsdaten eintragen.",
    "Verbindung testen und aktiv nutzen.",
  ];
}

function getSecretsStepHint(kind: string): string {
  const k = String(kind ?? "").toLowerCase();
  if (k === "local_site") {
    return "Lege einen API-Key fest. Diesen Schlüssel trägt deine Website später ein, um auf die Portal-API zuzugreifen.";
  }
  if (k === "crm") {
    return "Trage die Zugangsdaten deines CRM ein. Danach kannst du speichern und die Verbindung testen.";
  }
  if (k === "llm") {
    return "Trage den API-Key deines LLM-Anbieters ein. Danach kannst du speichern und die Verbindung testen.";
  }
  return "Trage die erforderlichen Zugangsdaten ein. Danach kannst du speichern und die Verbindung testen.";
}

function getAuthBeginnerHint(kind: string, provider: string, authType: string): string {
  const k = String(kind ?? "").toLowerCase();
  const p = String(provider ?? "").toLowerCase();
  const a = String(authType ?? "").toLowerCase();
  if (k === "crm" && p === "propstack") {
    return "Bei Propstack läuft die Authentifizierung über API Key.";
  }
  if (k === "crm" && p === "onoffice") {
    return "Bei onOffice werden API Token und API Secret gemeinsam verwendet.";
  }
  if (a.includes("api_key")) return "API Key wird als Zugangsschlüssel verwendet.";
  if (a.includes("bearer")) return "Bearer Token wird im Authorization-Header gesendet.";
  if (a.includes("token")) return "Token wird für die API-Anmeldung verwendet.";
  if (a.includes("basic")) return "Basic Auth nutzt Benutzername + Passwort.";
  if (a.includes("none")) return "Für diese Konfiguration sind keine Zugangsdaten erforderlich.";
  return "Wähle die Authentifizierung, die dein Anbieter vorgibt.";
}

function getLlmModelSuggestions(provider: string): string[] {
  const p = String(provider ?? "").toLowerCase();
  if (p === "openai") {
    return ["gpt-5.2", "gpt-5.2-mini", "gpt-5.2-nano", "gpt-4.1", "gpt-4o"];
  }
  if (p === "anthropic") {
    return [
      "claude-opus-4-1-20250805",
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-latest",
      "claude-3-5-haiku-latest",
    ];
  }
  if (p === "google_gemini") {
    return ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
  }
  if (p === "mistral") {
    return ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"];
  }
  if (p === "azure_openai") {
    return ["gpt-5-prod", "gpt-4.1-prod", "gpt-4o-prod"];
  }
  return ["gpt-4o-mini"];
}

function getLlmModelFieldLabel(provider: string): string {
  return String(provider ?? "").toLowerCase() === "azure_openai" ? "Deployment-Name (Azure)" : "LLM Modell";
}

function getLlmModelHint(provider: string): string {
  if (String(provider ?? "").toLowerCase() === "azure_openai") {
    return "Bei Azure wird hier der Deployment-Name eingetragen (nicht die globale Modell-ID).";
  }
  return "Wähle ein vorgeschlagenes Modell oder trage ein eigenes Modell manuell ein.";
}

function generateAccessKey() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const len = 40;
  const bytes = new Uint8Array(len);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let token = "wc24ls_";
  for (let i = 0; i < len; i += 1) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}

async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(String(data?.error ?? `HTTP ${res.status}`));
  }
  return data as T;
}

export default function PartnerSettingsPanel({
  section,
  onSectionChange,
}: {
  section: SettingsSection;
  onSectionChange?: (next: SettingsSection) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [initialLoading, setInitialLoading] = useState(true);
  const [status, setStatus] = useState("Lade Einstellungen...");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [integrations, setIntegrations] = useState<PartnerIntegration[]>([]);
  const [profileDraft, setProfileDraft] = useState({
    company_name: "",
    contact_email: "",
    contact_first_name: "",
    contact_last_name: "",
    website_url: "",
  });
  const [passwordDraft, setPasswordDraft] = useState({
    password: "",
    password_confirm: "",
  });
  const [integrationDraft, setIntegrationDraft] = useState<IntegrationDraft>(buildDefaultDraft("crm"));
  const [advancedAuthOpen, setAdvancedAuthOpen] = useState(false);
  const [llmCustomModelMode, setLlmCustomModelMode] = useState(false);
  const [integrationFlowTab, setIntegrationFlowTab] = useState<"basis" | "zugangstest">("basis");
  const [costMonitorTab, setCostMonitorTab] = useState<"tokenverbrauch" | "portalabo" | "features">("tokenverbrauch");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [secretDraft, setSecretDraft] = useState<Record<string, SecretDraft>>({});
  const [testResult, setTestResult] = useState<Record<string, { status: "ok" | "warning" | "error"; message: string }>>({});
  const [integrationPolicy, setIntegrationPolicy] = useState<IntegrationPolicy>({ llm_partner_managed_allowed: true });
  const [llmUsageMonth, setLlmUsageMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [llmUsagePeriod, setLlmUsagePeriod] = useState<"timeline" | "year">("timeline");
  const [llmUsageYear, setLlmUsageYear] = useState<number>(new Date().getUTCFullYear());
  const [llmUsageRows, setLlmUsageRows] = useState<PartnerLlmUsageRow[]>([]);
  const [llmUsageTotals, setLlmUsageTotals] = useState<{
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_eur: number;
  }>({ input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_eur: 0 });
  const [llmUsageFxRate, setLlmUsageFxRate] = useState<number | null>(null);
  const [llmUsageBounds, setLlmUsageBounds] = useState<{
    has_usage: boolean;
    earliest_month: string | null;
    latest_month: string | null;
  }>({ has_usage: false, earliest_month: null, latest_month: null });
  const [portalAboRows, setPortalAboRows] = useState<PortalAboRow[]>([]);
  const [featureRows, setFeatureRows] = useState<PartnerFeatureRow[]>([]);
  const providerOptions = useMemo(() => getProvidersForKind(integrationDraft.kind), [integrationDraft.kind]);
  const selectedProviderSpec = useMemo(
    () => getProviderSpec(integrationDraft.provider) ?? providerOptions[0] ?? null,
    [integrationDraft.provider, providerOptions],
  );
  const isLlmDraft = integrationDraft.kind === "llm";
  const isLocalSiteDraft = integrationDraft.kind === "local_site";
  const llmPartnerManagedAllowed = integrationPolicy.llm_partner_managed_allowed !== false;
  const currentDefaults = useMemo(
    () => getDraftDefaults(integrationDraft.kind, integrationDraft.provider),
    [integrationDraft.kind, integrationDraft.provider],
  );
  const selectedIntegration = useMemo(
    () => integrations.find((entry) => entry.id === selectedIntegrationId) ?? null,
    [integrations, selectedIntegrationId],
  );
  const hasActivePartnerLlm = useMemo(
    () => integrations.some((entry) => String(entry.kind ?? "").toLowerCase() === "llm" && entry.is_active === true),
    [integrations],
  );
  const partnerManagedAllowed = integrationPolicy.llm_partner_managed_allowed !== false;
  const hasUsablePartnerLlm = partnerManagedAllowed && hasActivePartnerLlm;
  const showsPortalLlmUsage = useMemo(
    () =>
      (
        String(integrationPolicy.llm_mode_default ?? "central_managed").toLowerCase() === "central_managed"
        || !partnerManagedAllowed
      )
      && !hasUsablePartnerLlm,
    [integrationPolicy.llm_mode_default, partnerManagedAllowed, hasUsablePartnerLlm],
  );
  const featureGrandTotal = useMemo(
    () => Number(featureRows.reduce((sum, row) => sum + (row.enabled ? Number(row.monthly_price_eur ?? 0) : 0), 0).toFixed(2)),
    [featureRows],
  );
  const portalAboGrandTotal = useMemo(
    () => Number(portalAboRows.reduce((sum, row) => sum + Number(row.total_price_eur ?? 0), 0).toFixed(2)),
    [portalAboRows],
  );

  useEffect(() => {
    if (!isLlmDraft) return;
    if (llmCustomModelMode) return;
    const current = String(integrationDraft.llm_model ?? "").trim();
    if (current) return;
    const fallback = getLlmModelSuggestions(integrationDraft.provider)[0] ?? "";
    if (!fallback) return;
    setIntegrationDraft((v) => ({ ...v, llm_model: fallback }));
  }, [isLlmDraft, llmCustomModelMode, integrationDraft.provider, integrationDraft.llm_model]);

  useEffect(() => {
    if (llmPartnerManagedAllowed) return;
    if (integrationDraft.kind !== "llm") return;
    setIntegrationDraft(buildDefaultDraft("crm"));
  }, [llmPartnerManagedAllowed, integrationDraft.kind]);

  useEffect(() => {
    if (!isLocalSiteDraft) return;
    const current = String(integrationDraft.base_url ?? "").trim().toLowerCase();
    if (!LEGACY_LOCAL_SITE_BAD_BASE_URLS.has(current)) return;
    setIntegrationDraft((prev) => ({ ...prev, base_url: "" }));
  }, [isLocalSiteDraft, integrationDraft.base_url]);

  useEffect(() => {
    if (showsPortalLlmUsage) return;
    if (costMonitorTab !== "tokenverbrauch") return;
    setCostMonitorTab("portalabo");
  }, [showsPortalLlmUsage, costMonitorTab]);

  function getDefaultTintStyle(field: keyof IntegrationDraft): React.CSSProperties {
    const current = String(integrationDraft[field] ?? "").trim();
    const defaultValueRaw = (currentDefaults as Record<string, unknown>)[field];
    const defaultValue = String(defaultValueRaw ?? "").trim();
    if (defaultValue && current === defaultValue) return inputMutedStyle;
    return inputStyle;
  }

  const loadAll = useCallback(async (preferredIntegrationId?: string | null) => {
    const [profileRes, integrationsRes] = await Promise.all([
      api<{ profile: PartnerProfile }>("/api/partner/profile"),
      api<{ integrations: PartnerIntegration[]; policy?: IntegrationPolicy }>("/api/partner/integrations"),
    ]);
    setProfile(profileRes.profile);
    setProfileDraft({
      company_name: profileRes.profile.company_name ?? "",
      contact_email: profileRes.profile.contact_email ?? "",
      contact_first_name: profileRes.profile.contact_first_name ?? "",
      contact_last_name: profileRes.profile.contact_last_name ?? "",
      website_url: profileRes.profile.website_url ?? "",
    });
    const nextIntegrations = integrationsRes.integrations ?? [];
    setIntegrationPolicy(integrationsRes.policy ?? { llm_partner_managed_allowed: true });
    setIntegrations(nextIntegrations);
    if (isCreateMode && !preferredIntegrationId) return;

    const desiredId = preferredIntegrationId ?? selectedIntegrationId;
    const resolved =
      (desiredId ? nextIntegrations.find((entry) => entry.id === desiredId) : null) ??
      nextIntegrations[0] ??
      null;
    if (resolved) {
      setSelectedIntegrationId(resolved.id);
      setIntegrationDraft(buildDraftFromIntegration(resolved));
      setIsCreateMode(false);
    } else {
      setSelectedIntegrationId(null);
      setIntegrationDraft(buildDefaultDraft("crm"));
      setIsCreateMode(true);
    }
  }, [isCreateMode, selectedIntegrationId]);

  const loadPartnerLlmUsage = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const effectivePeriod = llmUsagePeriod === "timeline" ? "month" : "year";
      params.set("period", effectivePeriod);
      if (effectivePeriod === "month") params.set("month", `${llmUsageMonth}-01`);
      if (effectivePeriod === "year") params.set("year", String(llmUsageYear));
      const payload = await api<{
        by_model?: PartnerLlmUsageRow[];
        totals?: { input_tokens?: number; output_tokens?: number; total_tokens?: number; tokens?: number; cost_eur?: number };
        fx_rate_usd_to_eur?: number | null;
        usage_bounds?: { has_usage?: boolean; earliest_month?: string | null; latest_month?: string | null };
      }>(
        `/api/partner/llm/usage?${params.toString()}`,
      );
      setLlmUsageRows(payload.by_model ?? []);
      setLlmUsageTotals({
        input_tokens: Number(payload.totals?.input_tokens ?? 0),
        output_tokens: Number(payload.totals?.output_tokens ?? 0),
        total_tokens: Number(payload.totals?.total_tokens ?? payload.totals?.tokens ?? 0),
        cost_eur: Number(payload.totals?.cost_eur ?? 0),
      });
      setLlmUsageFxRate(
        typeof payload.fx_rate_usd_to_eur === "number" && Number.isFinite(payload.fx_rate_usd_to_eur)
          ? payload.fx_rate_usd_to_eur
          : null,
      );
      setLlmUsageBounds({
        has_usage: payload.usage_bounds?.has_usage === true,
        earliest_month: String(payload.usage_bounds?.earliest_month ?? "").trim() || null,
        latest_month: String(payload.usage_bounds?.latest_month ?? "").trim() || null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Kostenmonitor nicht verfügbar.";
      if (msg.includes("nur für zentrale LLM-Nutzung verfügbar")) {
        setLlmUsageRows([]);
        setLlmUsageTotals({ input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_eur: 0 });
        setLlmUsageFxRate(null);
        setLlmUsageBounds({ has_usage: false, earliest_month: null, latest_month: null });
        if (section === "kostenmonitor") onSectionChange?.("integrationen");
        setStatus("Kostenmonitor ist für diese LLM-Konfiguration nicht verfügbar.");
        return;
      }
      throw error;
    }
  }, [llmUsagePeriod, llmUsageMonth, llmUsageYear, onSectionChange, section]);

  const loadPortalAboRows = useCallback(async () => {
    try {
      const payload = await api<{ rows?: PortalAboRow[] }>("/api/partner/billing/portal-abo");
      setPortalAboRows(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (error) {
      setPortalAboRows([]);
      throw error;
    }
  }, []);

  const loadFeatureRows = useCallback(async () => {
    try {
      const payload = await api<{ rows?: PartnerFeatureRow[] }>("/api/partner/billing/features");
      setFeatureRows(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (error) {
      setFeatureRows([]);
      throw error;
    }
  }, []);

  function beginCreateIntegration() {
    setIsCreateMode(true);
    setSelectedIntegrationId(null);
    setAdvancedAuthOpen(false);
    setLlmCustomModelMode(false);
    setIntegrationFlowTab("basis");
    setIntegrationDraft(buildDefaultDraft("crm"));
  }

  function selectIntegration(integration: PartnerIntegration) {
    setIsCreateMode(false);
    setSelectedIntegrationId(integration.id);
    setAdvancedAuthOpen(false);
    setLlmCustomModelMode(false);
    setIntegrationFlowTab("basis");
    setIntegrationDraft(buildDraftFromIntegration(integration));
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
        setStatus("Einstellungen geladen.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Fehler beim Laden");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [loadAll]);

  useEffect(() => {
    if (section !== "kostenmonitor") return;
    if (!showsPortalLlmUsage) return;
    void loadPartnerLlmUsage().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Kostenmonitor konnte nicht geladen werden.");
    });
  }, [section, showsPortalLlmUsage, llmUsagePeriod, llmUsageMonth, llmUsageYear, loadPartnerLlmUsage]);

  useEffect(() => {
    if (section !== "kostenmonitor") return;
    if (costMonitorTab !== "portalabo") return;
    void loadPortalAboRows().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Portalabo konnte nicht geladen werden.");
    });
  }, [section, costMonitorTab, loadPortalAboRows]);

  useEffect(() => {
    if (section !== "kostenmonitor") return;
    if (costMonitorTab !== "features") return;
    void loadFeatureRows().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Features konnten nicht geladen werden.");
    });
  }, [section, costMonitorTab, loadFeatureRows]);

  if (initialLoading) {
    return <FullscreenLoader show label="Einstellungen werden geladen..." />;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
      setStatus(`${label} erfolgreich.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} fehlgeschlagen.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={inlineWrapStyle}>
      <FullscreenLoader show={busy} label="Sektionen werden geladen..." />
      <div style={contentStyle}>
        <div style={{ ...settingsTabsBarStyle, marginBottom: 40 }}>
          <button
            type="button"
            style={settingsTabButtonStyle(section === "konto")}
            onClick={() => onSectionChange?.("konto")}
          >
            Konto
          </button>
          <button
            type="button"
            style={settingsTabButtonStyle(section === "profil")}
            onClick={() => onSectionChange?.("profil")}
          >
            Partnerprofil
          </button>
          <button
            type="button"
            style={settingsTabButtonStyle(section === "integrationen")}
            onClick={() => onSectionChange?.("integrationen")}
          >
            Anbindungen
          </button>
          {showsPortalLlmUsage ? (
              <button
                type="button"
                style={settingsTabButtonStyle(section === "kostenmonitor")}
                onClick={() => onSectionChange?.("kostenmonitor")}
              >
                Monitor
              </button>
          ) : null}
        </div>
        <p style={statusStyle}>{status}</p>

        {section === "konto" ? <section style={sectionStyle}>
          <h3 style={h3Style}>Konto</h3>
          <div style={grid2Style}>
            <input
              type="password"
              placeholder="Neues Passwort"
              aria-label="Neues Passwort"
              style={inputStyle}
              value={passwordDraft.password}
              onChange={(e) => setPasswordDraft((v) => ({ ...v, password: e.target.value }))}
            />
            <input
              type="password"
              placeholder="Passwort wiederholen"
              aria-label="Passwort wiederholen"
              style={inputStyle}
              value={passwordDraft.password_confirm}
              onChange={(e) => setPasswordDraft((v) => ({ ...v, password_confirm: e.target.value }))}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              style={buttonStyle}
              disabled={busy}
              onClick={() =>
                run("Passwort ändern", async () => {
                  if (!passwordDraft.password || passwordDraft.password.length < 10) {
                    throw new Error("Passwort muss mindestens 10 Zeichen haben.");
                  }
                  if (passwordDraft.password !== passwordDraft.password_confirm) {
                    throw new Error("Passwörter stimmen nicht überein.");
                  }
                  const { error } = await supabase.auth.updateUser({ password: passwordDraft.password });
                  if (error) throw new Error(error.message);
                  setPasswordDraft({ password: "", password_confirm: "" });
                })
              }
            >
              Passwort aktualisieren
            </button>
          </div>
          <div style={privacyHintStyle}>
            Datenschutz: Passwortänderungen wirken sofort. Dein Passwort wird in der Oberfläche nicht angezeigt.
          </div>
        </section> : null}

        {section === "profil" ? <section style={sectionStyle}>
          <h3 style={h3Style}>Partnerprofil</h3>
          <div style={grid2Style}>
            <input
              placeholder="Firmenname"
              aria-label="Firmenname"
              style={inputStyle}
              value={profileDraft.company_name}
              onChange={(e) => setProfileDraft((v) => ({ ...v, company_name: e.target.value }))}
            />
            <input
              placeholder="Kontakt-E-Mail"
              aria-label="Kontakt-E-Mail"
              style={inputStyle}
              value={profileDraft.contact_email}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_email: e.target.value }))}
            />
            <input
              placeholder="Vorname"
              aria-label="Vorname"
              style={inputStyle}
              value={profileDraft.contact_first_name}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_first_name: e.target.value }))}
            />
            <input
              placeholder="Nachname"
              aria-label="Nachname"
              style={inputStyle}
              value={profileDraft.contact_last_name}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_last_name: e.target.value }))}
            />
            <input
              placeholder="Website URL"
              aria-label="Website URL"
              style={inputStyle}
              value={profileDraft.website_url}
              onChange={(e) => setProfileDraft((v) => ({ ...v, website_url: e.target.value }))}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              style={buttonStyle}
              disabled={busy || !profile}
              onClick={() =>
                run("Partnerprofil speichern", async () => {
                  await api("/api/partner/profile", {
                    method: "PATCH",
                    body: JSON.stringify(profileDraft),
                  });
                  await loadAll();
                })
              }
            >
              Profil speichern
            </button>
          </div>
          <div style={privacyHintStyle}>
            Datenschutz: Hinterlege nur Kontaktdaten, die öffentlich angezeigt werden sollen.
          </div>
        </section> : null}

        {section === "integrationen" ? <section style={sectionStyle}>
          <h3 style={integrationTitleStyle}>Anbindungen</h3>
          <div style={integrationIntroCardStyle}>
            <p style={integrationIntroHeadlineStyle}>Anbindung in 3 Schritten</p>
            <p style={integrationIntroTextStyle}>
              1. Anbieter auswählen, 2. Basisdaten speichern, 3. Verbindung testen. CRM/LLM sind Datenquellen, Local Site ist ein Ausspielkanal.
            </p>
          </div>
          <div style={integrationCreateRowStyle}>
            <button
              style={buttonGreenGhostStyle}
              disabled={busy}
              onClick={beginCreateIntegration}
            >
              Neue Anbindung anlegen
            </button>
          </div>
          {!llmPartnerManagedAllowed ? (
            <div style={{ ...privacyHintStyle, marginTop: 0 }}>
              Eigene LLM-Anbindungen sind aktuell nicht freigeschaltet. Die zentrale KI-Nutzung ist aktiv.
              Für eine eigene LLM-Anbindung melde dich beim Admin-Support.
            </div>
          ) : null}
          <div style={integrationLayoutStyle}>
            <aside style={integrationListPaneStyle}>
              <div style={integrationListHeaderStyle}>
                <strong style={integrationListHeadingStyle}>Gespeicherte Anbindungen</strong>
              </div>
              <div style={integrationListStyle}>
                {integrations.length === 0 ? (
                  <p style={emptyHintStyle}>Noch keine Anbindung gespeichert.</p>
                ) : (
                  integrations.map((integration) => (
                    <button
                      key={integration.id}
                      style={integrationListItemStyle(selectedIntegrationId === integration.id && !isCreateMode)}
                      onClick={() => selectIntegration(integration)}
                      disabled={busy}
                    >
                      <strong>{getIntegrationListLabel(integration)}</strong>
                      <span style={integrationMetaSubStyle}>{getIntegrationMetaText(integration)}</span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div style={integrationDetailPaneStyle}>
              <div style={integrationDetailHeaderStyle}>
                <strong style={{ color: "#0f172a", fontSize: 22, lineHeight: 1.2 }}>{isCreateMode ? "Neue Anbindung" : "Anbindung bearbeiten"}</strong>
                {!isCreateMode && selectedIntegration ? (
                  <button
                    style={integrationToggleButtonStyle(selectedIntegration.is_active)}
                    disabled={busy}
                    onClick={() =>
                      run(selectedIntegration.is_active ? "Anbindung deaktivieren" : "Anbindung aktivieren", async () => {
                        await api("/api/partner/integrations", {
                          method: "POST",
                          body: JSON.stringify({
                            kind: selectedIntegration.kind,
                            provider: selectedIntegration.provider,
                            base_url: selectedIntegration.base_url ?? "",
                            auth_type: selectedIntegration.auth_type ?? "",
                            detail_url_template: selectedIntegration.detail_url_template ?? "",
                            settings: selectedIntegration.settings ?? null,
                            is_active: !selectedIntegration.is_active,
                          }),
                        });
                        await loadAll(selectedIntegration.id);
                      })
                    }
                  >
                    {selectedIntegration.is_active ? "Anbindung deaktivieren" : "Anbindung aktivieren"}
                  </button>
                ) : null}
              </div>

              <div style={integrationIntroCardStyle}>
                <p style={integrationIntroHeadlineStyle}>{getIntegrationSetupHeadline(integrationDraft.kind)}</p>
                <ol style={integrationIntroListStyle}>
                  {getIntegrationSetupSteps(integrationDraft.kind).map((step) => (
                    <li key={step} style={integrationIntroListItemStyle}>{step}</li>
                  ))}
                </ol>
              </div>

              <div style={integrationFlowTabsStyle}>
                <button
                  type="button"
                  style={integrationFlowTabButtonStyle(integrationFlowTab === "basis")}
                  onClick={() => setIntegrationFlowTab("basis")}
                >
                  1. Basisdaten
                </button>
                <button
                  type="button"
                  style={integrationFlowTabButtonStyle(integrationFlowTab === "zugangstest")}
                  onClick={() => setIntegrationFlowTab("zugangstest")}
                >
                  2. API-Key
                </button>
              </div>

              {integrationFlowTab === "basis" ? (
                <>
                  {isCreateMode ? (
                    <div style={{ ...grid3Style, marginTop: 40 }}>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>Anbindungstyp</label>
                        <select
                          style={selectStyle}
                          aria-label="Anbindungstyp"
                          value={integrationDraft.kind}
                          disabled={!isCreateMode}
                          onChange={(e) =>
                            setIntegrationDraft((v) => {
                              const nextKind = e.target.value;
                              const nextProvider = getDefaultProviderId(nextKind);
                              const nextAuth = getDefaultAuthType(nextKind, nextProvider);
                              const nextDefaults = getDraftDefaults(nextKind, nextProvider);
                              return {
                                ...v,
                                kind: nextKind,
                                provider: nextProvider,
                                auth_type: nextAuth,
                                base_url: nextDefaults.base_url ?? "",
                                detail_url_template: nextDefaults.detail_url_template ?? "",
                                ...(nextKind === "llm"
                                  ? {
                                      llm_model: nextDefaults.llm_model ?? v.llm_model,
                                      llm_api_version: nextDefaults.llm_api_version ?? v.llm_api_version,
                                      llm_temperature: nextDefaults.llm_temperature ?? v.llm_temperature,
                                      llm_max_tokens: nextDefaults.llm_max_tokens ?? v.llm_max_tokens,
                                    }
                                  : {}),
                              };
                            })
                          }
                        >
                          <option value="crm">CRM</option>
                          {llmPartnerManagedAllowed ? <option value="llm">LLM</option> : null}
                          <option value="local_site">Local Site</option>
                        </select>
                        <span style={fieldHintStyle}>Was willst du anbinden?</span>
                      </div>
                      {isLocalSiteDraft ? (
                        <div style={fieldWrapStyle}>
                          <label style={fieldLabelStyle}>Kanal</label>
                          <input
                            style={inputMutedStyle}
                            aria-label="Kanal"
                            value="Local Site (Ausspielkanal)"
                            readOnly
                          />
                          <span style={fieldHintStyle}>{getProviderBeginnerHint(integrationDraft.kind, integrationDraft.provider)}</span>
                        </div>
                      ) : (
                        <div style={fieldWrapStyle}>
                          <label style={fieldLabelStyle}>Provider</label>
                          <select
                            style={selectStyle}
                            aria-label="Provider"
                            value={integrationDraft.provider}
                            disabled={!isCreateMode}
                            onChange={(e) =>
                              setIntegrationDraft((v) => ({
                                ...v,
                                provider: e.target.value,
                                auth_type: getDefaultAuthType(v.kind, e.target.value),
                                ...getDraftDefaults(v.kind, e.target.value),
                              }))
                            }
                          >
                            {providerOptions.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.label}
                              </option>
                            ))}
                          </select>
                          <span style={fieldHintStyle}>{getProviderBeginnerHint(integrationDraft.kind, integrationDraft.provider)}</span>
                        </div>
                      )}
                      {(selectedProviderSpec?.authTypes?.length ?? 0) > 1 ? (
                        <div style={fieldWrapStyle}>
                          <label style={fieldLabelStyle}>Authentifizierung (Erweitert)</label>
                          <button
                            type="button"
                            style={advancedToggleButtonStyle(advancedAuthOpen)}
                            onClick={() => setAdvancedAuthOpen((v) => !v)}
                          >
                            {advancedAuthOpen ? "Erweitert ausblenden" : "Erweitert: Authentifizierung anpassen"}
                          </button>
                          {!advancedAuthOpen ? (
                            <span style={fieldHintStyle}>
                              Standard: {AUTH_TYPE_LABELS[String(selectedProviderSpec?.defaultAuthType ?? integrationDraft.auth_type)] ?? String(selectedProviderSpec?.defaultAuthType ?? integrationDraft.auth_type)}
                            </span>
                          ) : (
                            <>
                              <select
                                style={selectStyle}
                                aria-label="Authentifizierungstyp"
                                value={integrationDraft.auth_type}
                                onChange={(e) => setIntegrationDraft((v) => ({ ...v, auth_type: e.target.value }))}
                              >
                                {(selectedProviderSpec?.authTypes ?? []).map((authType) => (
                                  <option key={authType} value={authType}>
                                    {AUTH_TYPE_LABELS[authType] ?? authType}
                                  </option>
                                ))}
                              </select>
                              <span style={fieldHintStyle}>
                                {getAuthBeginnerHint(integrationDraft.kind, integrationDraft.provider, integrationDraft.auth_type)}
                              </span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          marginTop: 40,
                          marginBottom: 10,
                          color: "#0f172a",
                          fontSize: 18,
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
                        {isLocalSiteDraft
                          ? getIntegrationPrimaryLabel(integrationDraft)
                          : `${getKindLabel(integrationDraft.kind)} · ${getIntegrationPrimaryLabel(integrationDraft)}`}
                      </div>
                    </>
                  )}

                  {!isLocalSiteDraft ? (
                    <div style={{ ...grid2Style, marginTop: 14 }}>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>Base URL</label>
                        <input
                          placeholder={isLlmDraft ? "https://api.openai.com/v1" : "https://api.propstack.de/v1"}
                          aria-label="Base URL"
                          style={getDefaultTintStyle("base_url")}
                          value={integrationDraft.base_url}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, base_url: e.target.value }))}
                        />
                        <span style={fieldHintStyle}>
                          API-Startadresse des Anbieters. Beispiel: `https://api.propstack.de/v1`
                        </span>
                      </div>
                      {!isLlmDraft ? (
                        <div style={fieldWrapStyle}>
                          <label style={fieldLabelStyle}>Detail URL Template</label>
                          <input
                            placeholder="https://www.partnerdomain.de/expose/{exposee_id}"
                            aria-label="Detail URL Template"
                            style={getDefaultTintStyle("detail_url_template")}
                            value={integrationDraft.detail_url_template}
                            onChange={(e) => setIntegrationDraft((v) => ({ ...v, detail_url_template: e.target.value }))}
                          />
                          <span style={fieldHintStyle}>
                            Optional. Nur erforderlich, wenn ein externer Partner-Exposé-Link erzeugt werden soll.
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                  ) : (
                    <div style={{ ...grid2Style, marginTop: 14 }}>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>URL deiner Website</label>
                        <input
                          placeholder="https://www.deine-website.de"
                          aria-label="URL deiner Website"
                          style={getDefaultTintStyle("base_url")}
                          value={integrationDraft.base_url}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, base_url: e.target.value }))}
                        />
                        <span style={fieldHintStyle}>
                          Diese URL wird als Kennung der Local-Site-Anbindung angezeigt (z. B. links in der Anbindungsliste).
                        </span>
                      </div>
                      <div />
                    </div>
                  )}

                  {isLlmDraft ? (
                    <div style={{ ...grid3Style, marginTop: 16 }}>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>{getLlmModelFieldLabel(integrationDraft.provider)}</label>
                        <select
                          aria-label={getLlmModelFieldLabel(integrationDraft.provider)}
                          style={{ ...selectStyle, ...getDefaultTintStyle("llm_model") }}
                          value={
                            llmCustomModelMode
                              ? "__custom__"
                              : getLlmModelSuggestions(integrationDraft.provider).includes(integrationDraft.llm_model)
                              ? integrationDraft.llm_model
                              : getLlmModelSuggestions(integrationDraft.provider)[0] ?? ""
                          }
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next === "__custom__") {
                              setLlmCustomModelMode(true);
                              setIntegrationDraft((v) => ({ ...v, llm_model: "" }));
                              return;
                            }
                            setLlmCustomModelMode(false);
                            setIntegrationDraft((v) => ({ ...v, llm_model: next }));
                          }}
                        >
                          {getLlmModelSuggestions(integrationDraft.provider).map((modelId) => (
                            <option key={modelId} value={modelId}>
                              {modelId}
                            </option>
                          ))}
                          <option value="__custom__">Anderes Modell...</option>
                        </select>
                        {llmCustomModelMode ? (
                          <input
                            aria-label={`${getLlmModelFieldLabel(integrationDraft.provider)} (Eigenes Modell)`}
                            placeholder="Eigenes Modell eingeben"
                            style={getDefaultTintStyle("llm_model")}
                            value={integrationDraft.llm_model}
                            onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_model: e.target.value }))}
                          />
                        ) : null}
                        <span style={fieldHintStyle}>{getLlmModelHint(integrationDraft.provider)}</span>
                      </div>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>Temperature</label>
                        <input
                          placeholder="0.4"
                          aria-label="Temperature"
                          style={getDefaultTintStyle("llm_temperature")}
                          value={integrationDraft.llm_temperature}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_temperature: e.target.value }))}
                        />
                        <span style={fieldHintStyle}>
                          Steuert die Kreativität der Ausgabe. Niedrig = sachlicher, höher = variabler.
                        </span>
                      </div>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>Max Tokens</label>
                        <input
                          placeholder="800"
                          aria-label="Max Tokens"
                          style={getDefaultTintStyle("llm_max_tokens")}
                          value={integrationDraft.llm_max_tokens}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_max_tokens: e.target.value }))}
                        />
                        <span style={fieldHintStyle}>
                          Maximale Antwortlänge. Höher erlaubt längere Texte, erhöht aber meist Kosten und Laufzeit.
                        </span>
                      </div>
                      {String(integrationDraft.provider ?? "").toLowerCase() === "azure_openai" ? (
                        <div style={fieldWrapStyle}>
                          <label style={fieldLabelStyle}>Azure API-Version</label>
                          <input
                            placeholder="2024-10-21"
                            aria-label="Azure API-Version"
                            style={getDefaultTintStyle("llm_api_version")}
                            value={integrationDraft.llm_api_version}
                            onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_api_version: e.target.value }))}
                          />
                          <span style={fieldHintStyle}>
                            Version laut Azure-Endpoint (z. B. 2024-10-21). Muss zum Deployment passen.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ marginTop: isLlmDraft ? 24 : 40 }}>
                    <button
                      style={buttonGreenGhostStyle}
                      disabled={busy}
                      onClick={() =>
                        run(isCreateMode ? "Anbindung anlegen" : "Basisdaten speichern", async () => {
                          if (isLocalSiteDraft && !integrationDraft.base_url.trim()) {
                            throw new Error("Bitte URL deiner Website eintragen.");
                          }
                          const settings = buildIntegrationSettings(integrationDraft, selectedIntegration?.settings ?? null);
                          const response = await api<{ integration?: PartnerIntegration }>("/api/partner/integrations", {
                            method: "POST",
                            body: JSON.stringify({
                              integration_id: selectedIntegration?.id ?? undefined,
                              ...integrationDraft,
                              settings,
                              is_active: selectedIntegration?.is_active ?? true,
                            }),
                          });
                          const savedId = response.integration?.id ?? selectedIntegration?.id ?? null;
                          await loadAll(savedId);
                          setIsCreateMode(false);
                        })
                      }
                    >
                      {isCreateMode ? "Anbindung anlegen" : "Basisdaten bearbeiten"}
                    </button>
                  </div>
                </>
              ) : null}

              {integrationFlowTab === "zugangstest" ? (
                !isCreateMode && selectedIntegration ? (
                <div style={integrationSecretsSectionStyle}>
                  <div
                    style={{
                      marginTop: 40,
                      marginBottom: 10,
                      color: "#0f172a",
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    API-Key und Test
                  </div>
                  <p style={{ ...secretPrivacyHintStyle, marginBottom: 20 }}>
                    {getSecretsStepHint(selectedIntegration.kind)}
                  </p>
                  {(() => {
                    const integration = selectedIntegration;
                    const isLocalSiteIntegration = String(integration.kind ?? "").toLowerCase() === "local_site";
                    const savedLocalSiteToken = isLocalSiteIntegration
                      ? asText(integration.local_site_api_key)
                      : null;
                    const draft = secretDraft[integration.id] ?? {
                      api_key: "",
                      token: savedLocalSiteToken ?? "",
                      secret: "",
                    };
                    const settings = (integration.settings ?? {}) as Record<string, unknown>;
                    const lastTestedAt = asText(settings.last_tested_at);
                    const lastTestStatus = asText(settings.last_test_status);
                    const lastTestMessage = asText(settings.last_test_message);
                    const relevantSecretFields = getRelevantSecretFields(integration);
                    const supportsSecrets = relevantSecretFields.length > 0;
                    return (
                      <>
                        {supportsSecrets && isLocalSiteIntegration ? (
                          <div style={{ marginTop: 0, marginBottom: 20 }}>
                            <button
                              style={buttonGreenGhostStyle}
                              disabled={busy}
                              onClick={() =>
                                setSecretDraft((prev) => ({
                                  ...prev,
                                  [integration.id]: { ...draft, token: generateAccessKey() },
                                }))
                              }
                            >
                              API-Key erzeugen
                            </button>
                          </div>
                        ) : null}
                        {supportsSecrets ? (
                          <div style={secretGridStyle(relevantSecretFields.length)}>
                            {relevantSecretFields.map((field) => (
                              <div key={`${integration.id}-${field}`} style={fieldWrapLeftStyle}>
                                <label style={fieldLabelStyle}>{getSecretFieldMeta(integration, field).label}</label>
                                <input
                                  placeholder={getSecretFieldMeta(integration, field).placeholder}
                                  aria-label={`${getSecretFieldMeta(integration, field).label} für ${integration.provider}`}
                                  style={secretInputStyle}
                                  value={draft[field]}
                                  onChange={(e) =>
                                    setSecretDraft((prev) => ({
                                      ...prev,
                                      [integration.id]: { ...draft, [field]: e.target.value },
                                    }))
                                  }
                                />
                                {isLocalSiteIntegration && field === "token" ? (
                                  <span style={fieldHintStyle}>
                                    Das ist dein geheimer API-Key. Gib ihn nicht öffentlich weiter.
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                            Für diese Anbindung sind bei der gewählten Authentifizierung keine zusätzlichen Zugangsdaten erforderlich.
                          </p>
                        )}
                        <div style={secretActionsWrapStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {supportsSecrets ? (
                              <button
                                style={buttonStyle}
                                disabled={busy}
                                onClick={() =>
                                  run(isLocalSiteIntegration ? "API-Key speichern" : "Secrets speichern", async () => {
                                    const payload: Record<string, string> = {};
                                    relevantSecretFields.forEach((field) => {
                                      const value = draft[field].trim();
                                      if (value) payload[field] = value;
                                    });
                                    if (Object.keys(payload).length === 0) throw new Error("Bitte mindestens ein Secret eingeben.");
                                    await api(`/api/partner/integrations/${integration.id}/secrets`, {
                                      method: "POST",
                                      body: JSON.stringify(payload),
                                    });
                                    if (isLocalSiteIntegration) {
                                      setSecretDraft((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, token: payload.token ?? draft.token },
                                      }));
                                    } else {
                                      setSecretDraft((prev) => ({
                                        ...prev,
                                        [integration.id]: { api_key: "", token: "", secret: "" },
                                      }));
                                    }
                                    await loadAll(integration.id);
                                  })
                                }
                              >
                                Speichern
                              </button>
                            ) : null}
                            {!isLocalSiteIntegration ? (
                              <button
                                style={buttonGhostStyle}
                                disabled={busy}
                                onClick={() =>
                                  run("Verbindung testen", async () => {
                                    const res = await api<{
                                      result?: { status?: "ok" | "warning" | "error"; message?: string };
                                    }>(`/api/partner/integrations/${integration.id}/test`, {
                                      method: "POST",
                                    });
                                    setTestResult((prev) => ({
                                      ...prev,
                                      [integration.id]: {
                                        status: res.result?.status ?? "warning",
                                        message: res.result?.message ?? "Kein Ergebnis",
                                      },
                                    }));
                                  })
                                }
                              >
                                Verbindung testen
                              </button>
                            ) : null}
                          </div>
                          {!isLocalSiteIntegration ? (
                            <>
                              {testResult[integration.id] ? (
                                <p
                                  style={{
                                    marginTop: 8,
                                    marginBottom: 0,
                                    fontSize: 12,
                                    color:
                                      testResult[integration.id].status === "ok"
                                        ? "#15803d"
                                        : testResult[integration.id].status === "warning"
                                          ? "#b45309"
                                          : "#b91c1c",
                                  }}
                                >
                                  {testResult[integration.id].message}
                                </p>
                              ) : null}
                              {lastTestedAt ? (
                                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                                  Zuletzt getestet: {new Date(lastTestedAt).toLocaleString("de-DE")}
                                  {lastTestStatus ? ` - ${lastTestStatus}` : ""}
                                  {lastTestMessage ? ` - ${lastTestMessage}` : ""}
                                </p>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
                ) : (
                <p style={emptyHintStyle}>
                  Nach dem Anlegen kannst du hier Zugangsdaten speichern und die Verbindung testen.
                </p>
                )
              ) : null}
            </div>
          </div>
        </section> : null}
        {section === "kostenmonitor" ? (
          <section style={sectionStyle}>
            <h3 style={integrationTitleStyle}>Monitor</h3>
            <div style={{ ...settingsTabsBarStyle, marginTop: 18, marginBottom: 40 }}>
              {showsPortalLlmUsage ? (
                <button
                  type="button"
                  style={settingsTabButtonStyle(costMonitorTab === "tokenverbrauch")}
                  onClick={() => setCostMonitorTab("tokenverbrauch")}
                >
                  Tokenverbrauch
                </button>
              ) : null}
              <button
                type="button"
                style={settingsTabButtonStyle(costMonitorTab === "portalabo")}
                onClick={() => setCostMonitorTab("portalabo")}
              >
                Portalabo
              </button>
              <button
                type="button"
                style={settingsTabButtonStyle(costMonitorTab === "features")}
                onClick={() => setCostMonitorTab("features")}
              >
                Features
              </button>
            </div>
            <div style={partnerLlmUsageWrapStyle}>
              {costMonitorTab === "tokenverbrauch" ? (
                <div style={partnerLlmUsageHeaderStyle}>
                  <div style={usageModeSwitchStyle}>
                    <button
                      type="button"
                      style={usageModeButtonStyle(llmUsagePeriod === "timeline")}
                      onClick={() => setLlmUsagePeriod("timeline")}
                    >
                      Monate
                    </button>
                    <button
                      type="button"
                      style={usageModeButtonStyle(llmUsagePeriod === "year")}
                      onClick={() => setLlmUsagePeriod("year")}
                    >
                      Jahr
                    </button>
                  </div>
                  {llmUsagePeriod === "timeline" ? (
                    <div style={usagePeriodGroupStyle}>
                      <button
                        type="button"
                        style={buttonGhostStyle}
                        disabled={
                          busy
                          || !llmUsageBounds.has_usage
                          || (llmUsageBounds.earliest_month !== null && llmUsageMonth <= llmUsageBounds.earliest_month)
                        }
                        onClick={() => setLlmUsageMonth((v) => shiftYearMonth(v, -1))}
                      >
                        ◀
                      </button>
                      <input
                        type="month"
                        aria-label="Monat (Verlauf)"
                        style={usageCompactInputStyle}
                        value={llmUsageMonth}
                        disabled={!llmUsageBounds.has_usage}
                        onChange={(e) => setLlmUsageMonth(e.target.value)}
                      />
                      <button
                        type="button"
                        style={buttonGhostStyle}
                        disabled={
                          busy
                          || !llmUsageBounds.has_usage
                          || (llmUsageBounds.latest_month !== null && llmUsageMonth >= llmUsageBounds.latest_month)
                        }
                        onClick={() => setLlmUsageMonth((v) => shiftYearMonth(v, 1))}
                      >
                        ▶
                      </button>
                    </div>
                  ) : null}
                  {llmUsagePeriod === "year" ? (
                    <div style={usagePeriodGroupStyle}>
                      <input
                        type="number"
                        aria-label="Jahr"
                        style={usageYearInputStyle}
                        min={2000}
                        max={2100}
                        value={llmUsageYear}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          if (Number.isFinite(parsed)) setLlmUsageYear(Math.max(2000, Math.min(2100, Math.floor(parsed))));
                        }}
                      />
                    </div>
                  ) : null}
                  <button
                    style={buttonStyle}
                    disabled={busy}
                    onClick={() =>
                      run("Monitor laden", async () => {
                        await loadPartnerLlmUsage();
                      })
                    }
                  >
                    Aktualisieren
                  </button>
                </div>
              ) : null}
              {costMonitorTab === "tokenverbrauch" ? (
                <>
                  <div style={{ ...partnerLlmUsageTableWrapStyle, marginTop: 40 }}>
                    <table style={partnerLlmUsageTableStyle}>
                      <thead>
                        <tr>
                          <th style={partnerLlmUsageThStyle}>Provider</th>
                          <th style={partnerLlmUsageThStyle}>Modell</th>
                          <th style={partnerLlmUsageThStyle}>Input Tokens</th>
                          <th style={partnerLlmUsageThStyle}>Output Tokens</th>
                          <th style={partnerLlmUsageThStyle}>Gesamt Tokens</th>
                          <th style={partnerLlmUsageThStyle}>Preisinfo USD / 1k (Input | Output)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {llmUsageRows.length === 0 ? (
                          <tr>
                            <td style={partnerLlmUsageTdStyle} colSpan={6}>
                              Noch keine Nutzung im gewählten Monat.
                            </td>
                          </tr>
                        ) : (
                          llmUsageRows.map((row) => (
                            <tr key={`${row.provider}:${row.model}`}>
                              <td style={partnerLlmUsageTdStyle}>{formatProviderLabel(row.provider)}</td>
                              <td style={partnerLlmUsageTdStyle}>{row.model}</td>
                              <td style={partnerLlmUsageTdStyle}>{row.input_tokens}</td>
                              <td style={partnerLlmUsageTdStyle}>{row.output_tokens}</td>
                              <td style={partnerLlmUsageTdStyle}>{row.total_tokens}</td>
                              <td style={partnerLlmUsageTdStyle}>
                                {typeof row.input_price_usd_per_1k === "number" && typeof row.output_price_usd_per_1k === "number"
                                  ? `${row.input_price_usd_per_1k.toFixed(4)} | ${row.output_price_usd_per_1k.toFixed(4)}`
                                  : "k. A."}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={partnerLlmUsageTotalsStyle}>
                    Nutzung: Input <strong>{llmUsageTotals.input_tokens}</strong>
                    {" | "}
                    Output <strong>{llmUsageTotals.output_tokens}</strong>
                    {" | "}
                    Gesamt <strong>{llmUsageTotals.total_tokens}</strong>
                  </div>
                  <div style={partnerLlmUsageTotalsStyle}>
                    Geschätzte Kosten gesamt (netto, unverbindlich): <strong>{llmUsageTotals.cost_eur.toFixed(4)} EUR</strong>
                  </div>
                  <div style={partnerLlmUsageTotalsStyle}>
                    Preisinfo je Modell basiert auf den aktuell gepflegten Providerpreisen.
                    {llmUsageFxRate
                      ? ` Monats-FX (USD→EUR): ${llmUsageFxRate.toFixed(6)}.`
                      : " Monats-FX (USD→EUR) derzeit nicht verfügbar."}
                  </div>
                </>
              ) : null}
              {costMonitorTab === "portalabo" ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <p style={partnerLlmUsageTotalsStyle}>
                    Es werden nur deine aktuell aktiven Kreise angezeigt. Ortslagenexport nutzt derzeit alle Ortslagen je Kreis.
                  </p>
                  <div style={partnerLlmUsageTableWrapStyle}>
                    <table style={partnerLlmUsageTableStyle}>
                      <thead>
                        <tr>
                          <th style={partnerLlmUsageThStyle}>Kreis</th>
                          <th style={partnerLlmUsageThStyle}>Kreis-ID</th>
                          <th style={partnerLlmUsageThStyle}>Grundpreis EUR / Monat</th>
                          <th style={partnerLlmUsageThStyle}>Preis je Ortslage EUR</th>
                          <th style={partnerLlmUsageThStyle}>Ortslagen gesamt EUR</th>
                          <th style={partnerLlmUsageThStyle}>Ortslagenexport</th>
                          <th style={partnerLlmUsageThStyle}>Ortslagenexport gesamt EUR</th>
                          <th style={partnerLlmUsageThStyle}>Gesamtpreis EUR / Monat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portalAboRows.length === 0 ? (
                          <tr>
                            <td style={partnerLlmUsageTdStyle} colSpan={8}>
                              Noch keine aktiven Kreise zugeordnet.
                            </td>
                          </tr>
                        ) : (
                          portalAboRows.map((row) => (
                          <tr key={`portalabo:${row.key}`}>
                            <td style={partnerLlmUsageTdStyle}>{row.kreis_name}</td>
                            <td style={partnerLlmUsageTdStyle}>{row.kreis_id}</td>
                            <td style={partnerLlmUsageTdStyle}>{row.base_price_eur.toFixed(2)}</td>
                            <td style={partnerLlmUsageTdStyle}>{row.ortslage_price_eur.toFixed(2)}</td>
                            <td style={partnerLlmUsageTdStyle}>{row.ortslagen_total_price_eur.toFixed(2)}</td>
                            <td style={partnerLlmUsageTdStyle}>
                              {row.export_ortslagen_count} von {row.ortslagen_count}
                            </td>
                            <td style={partnerLlmUsageTdStyle}>{row.export_ortslagen_total_price_eur.toFixed(2)}</td>
                            <td style={partnerLlmUsageTdStyle}>{row.total_price_eur.toFixed(2)}</td>
                          </tr>
                        ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {portalAboRows.length > 0 ? (
                    <>
                      <div style={partnerLlmUsageTotalsStyle}>
                        Gesamtpreis über alle Kreise: <strong>{portalAboGrandTotal.toFixed(2)} EUR / Monat</strong>
                      </div>
                      <div style={partnerLlmUsageTotalsStyle}>
                        Alle Preise netto pro Monat, zzgl. gesetzlicher Umsatzsteuer.
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              {costMonitorTab === "features" ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <p style={partnerLlmUsageTotalsStyle}>
                    Feature-Preise werden pro Partner durch die Administration gepflegt und monatlich abgerechnet.
                  </p>
                  <div style={partnerLlmUsageTableWrapStyle}>
                    <table style={partnerLlmUsageTableStyle}>
                      <thead>
                        <tr>
                          <th style={partnerLlmUsageThStyle}>Feature</th>
                          <th style={partnerLlmUsageThStyle}>Status</th>
                          <th style={partnerLlmUsageThStyle}>Festpreis</th>
                          <th style={partnerLlmUsageThStyle}>Hinweis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {featureRows.map((feature) => (
                          <tr key={feature.key}>
                            <td style={partnerLlmUsageTdStyle}>{feature.label}</td>
                            <td style={partnerLlmUsageTdStyle}>
                              <span style={feature.enabled ? featureActiveBadgeStyle : featureInactiveBadgeStyle}>
                                {feature.enabled ? "Aktiv" : "Nicht aktiv"}
                              </span>
                            </td>
                            <td style={partnerLlmUsageTdStyle}>
                              {feature.monthly_price_eur.toFixed(2)} EUR
                              {feature.billing_unit ? ` (${feature.billing_unit})` : ""}
                            </td>
                            <td style={partnerLlmUsageTdStyle}>{feature.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={partnerLlmUsageTotalsStyle}>
                    Gesamtpreis aktive Features: <strong>{featureGrandTotal.toFixed(2)} EUR / Monat</strong>
                  </div>
                  <div style={partnerLlmUsageTotalsStyle}>
                    Alle Preise netto pro Monat, zzgl. gesetzlicher Umsatzsteuer.
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

const inlineWrapStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "stretch",
};

const contentStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  margin: 0,
  padding: "0 0 24px",
};

const statusStyle: React.CSSProperties = {
  margin: "0 0 14px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  color: "#334155",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 18,
  marginBottom: 14,
  background: "#ffffff",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
};

const settingsTabsBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
};

function settingsTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
    background: active ? "#ecfdf5" : "#ffffff",
    color: active ? "#065f46" : "#0f172a",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

const h3Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 10,
  fontSize: 16,
};

const integrationTitleStyle: React.CSSProperties = {
  ...h3Style,
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 6,
};

const integrationCreateRowStyle: React.CSSProperties = {
  marginTop: 14,
  marginBottom: 20,
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const grid3Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
};

const integrationLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(250px, 320px) minmax(0, 1fr)",
  gap: 16,
  alignItems: "start",
};

const integrationListPaneStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 10,
  background: "#f8fafc",
};

const integrationDetailPaneStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
};

const integrationListHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  marginBottom: 8,
};

const integrationListHeadingStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
};

const integrationListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const integrationDetailHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 16,
};

const integrationFlowTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 20,
};

function integrationFlowTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
    background: active ? "#ecfdf5" : "#ffffff",
    color: active ? "#065f46" : "#0f172a",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

const integrationSecretsSectionStyle: React.CSSProperties = {
  marginTop: 12,
  borderTop: "none",
  paddingTop: 0,
};

const emptyHintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#64748b",
};

function integrationListItemStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #0f766e" : "1px solid #e2e8f0",
    background: active ? "#ecfeff" : "#fff",
    borderRadius: 8,
    padding: "8px 10px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  };
}

function secretGridStyle(fieldCount: number): React.CSSProperties {
  if (fieldCount <= 1) return { display: "grid", gridTemplateColumns: "1fr", gap: 8, width: "100%" };
  if (fieldCount === 2) return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" };
  return { ...grid3Style, width: "100%" };
}

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const fieldWrapLeftStyle: React.CSSProperties = {
  ...fieldWrapStyle,
  alignItems: "stretch",
  textAlign: "left",
  width: "100%",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#334155",
  fontWeight: 600,
};

const fieldHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundColor: "#fff",
  paddingRight: 36,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748b' d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  backgroundSize: "10px 6px",
};

const secretInputStyle: React.CSSProperties = {
  ...inputStyle,
  minWidth: 0,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const inputMutedStyle: React.CSSProperties = {
  ...inputStyle,
  color: "#64748b",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const buttonGreenGhostStyle: React.CSSProperties = {
  border: "1px solid #16a34a",
  background: "rgba(22, 163, 74, 0.1)",
  color: "#166534",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  opacity: 0.9,
};

const buttonGhostStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

function advancedToggleButtonStyle(open: boolean): React.CSSProperties {
  return {
    border: open ? "1px solid #0f766e" : "1px solid #cbd5e1",
    background: open ? "#ecfdf5" : "#f8fafc",
    color: open ? "#065f46" : "#334155",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
  };
}

function integrationToggleButtonStyle(isActive: boolean): React.CSSProperties {
  if (!isActive) return buttonGhostStyle;
  return {
    ...buttonGhostStyle,
    border: "1px solid #dc2626",
    color: "#991b1b",
    background: "#fff7f7",
  };
}

const secretActionsWrapStyle: React.CSSProperties = {
  marginTop: 40,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  textAlign: "left",
  width: "100%",
};

const partnerLlmUsageWrapStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 10,
};

const partnerLlmUsageHeaderStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
};

const usageModeSwitchStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

function usageModeButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #111827" : "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

const usagePeriodGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const usageCompactInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: "auto",
  minWidth: 170,
};

const usageYearInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 120,
};

const partnerLlmUsageTotalsStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#334155",
};

const partnerLlmUsageTableWrapStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  overflow: "hidden",
};

const partnerLlmUsageTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const partnerLlmUsageThStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  color: "#334155",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 10px",
};

const partnerLlmUsageTdStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#0f172a",
  borderBottom: "1px solid #f1f5f9",
  padding: "8px 10px",
};

const featureActiveBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 700,
};

const featureInactiveBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 700,
};

const integrationMetaSubStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
};

const integrationIntroCardStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 10,
  padding: "12px 14px",
  marginTop: 24,
  marginBottom: 40,
  display: "grid",
  gap: 8,
};

const integrationIntroHeadlineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  color: "#1e3a8a",
};

const integrationIntroTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#334155",
  lineHeight: 1.45,
};

const integrationIntroListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: "grid",
  gap: 4,
};

const integrationIntroListItemStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#334155",
  lineHeight: 1.45,
};

const privacyHintStyle: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  color: "#475569",
};

const secretPrivacyHintStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 12,
  color: "#475569",
};
