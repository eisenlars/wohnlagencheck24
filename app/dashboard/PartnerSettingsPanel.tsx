"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getProviderSpec, getProvidersForKind } from "@/lib/integrations/providers";
import FullscreenLoader from "@/components/ui/FullscreenLoader";
import IntegrationTriggerPanel from "@/components/network-partners/self-service/IntegrationTriggerPanel";
import styles from "./styles/partner-settings.module.css";
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
  api_key?: string | null;
  token?: string | null;
  secret?: string | null;
  local_site_api_key?: string | null;
  has_api_key?: boolean;
  has_token?: boolean;
  has_secret?: boolean;
  has_trigger_token?: boolean;
  has_trigger_secret?: boolean;
  last_sync_at?: string | null;
};

type TriggerConfig = {
  provider: string;
  token: string | null;
  webhook_url: string | null;
  has_secret: boolean;
  is_configured: boolean;
  last_received_at: string | null;
  last_processed_at: string | null;
  last_status: string | null;
  events_today: number | null;
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
type SecretVisibilityState = Record<string, Partial<Record<SecretFieldKey, boolean>>>;
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

function settingsTabClass(active: boolean): string {
  return `${styles.tabButton} ${active ? styles.tabButtonActive : ""}`;
}

function integrationListItemClass(active: boolean): string {
  return `${styles.integrationListItem} ${active ? styles.integrationListItemActive : ""}`;
}

function flowTabClass(active: boolean): string {
  return settingsTabClass(active);
}

function advancedToggleClass(open: boolean): string {
  return `${styles.advancedToggleButton} ${open ? styles.advancedToggleButtonOpen : ""}`;
}

function integrationToggleClass(isActive: boolean): string {
  return isActive ? styles.buttonDangerGhost : styles.buttonGhost;
}

function secretGridClass(fieldCount: number): string {
  if (fieldCount <= 1) return `${styles.secretGrid} ${styles.secretGridOne}`;
  if (fieldCount === 2) return `${styles.secretGrid} ${styles.secretGridTwo}`;
  return `${styles.secretGrid} ${styles.secretGridThree}`;
}

function testResultClass(status: "ok" | "warning" | "error"): string {
  if (status === "ok") return styles.testResultOk;
  if (status === "warning") return styles.testResultWarning;
  return styles.testResultError;
}

function featureBadgeClass(enabled: boolean): string {
  return enabled ? styles.featureActiveBadge : styles.featureInactiveBadge;
}

function usageModeButtonClass(active: boolean): string {
  return `${styles.usageModeButton} ${active ? styles.usageModeButtonActive : ""}`;
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

function getIntegrationMetaText(
  integration: Pick<PartnerIntegration, "kind" | "is_active" | "auth_type" | "has_trigger_token" | "has_trigger_secret">,
): string {
  const auth = String(integration.auth_type ?? "").toLowerCase();
  const authLabel = auth ? AUTH_TYPE_LABELS[auth] ?? auth : "nicht gesetzt";
  const direction = String(integration.kind ?? "").toLowerCase() === "local_site" ? "Ausspielkanal" : "Datenquelle";
  const triggerStatus =
    integration.has_trigger_token && integration.has_trigger_secret ? "eingerichtet" : "offen";
  return `Typ: ${getKindLabel(integration.kind)} · Rolle: ${direction} · Authentifizierung: ${authLabel} · Auto-Update: ${triggerStatus} · Status: ${integration.is_active ? "aktiv" : "inaktiv"}`;
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

function hasStoredSecret(integration: PartnerIntegration, field: SecretFieldKey): boolean {
  if (field === "api_key") return integration.has_api_key === true;
  if (field === "token") return integration.has_token === true;
  return integration.has_secret === true;
}

function applyProviderSelection(
  draft: IntegrationDraft,
  nextProvider: string,
): IntegrationDraft {
  const nextAuthType = getDefaultAuthType(draft.kind, nextProvider);
  const nextDefaults = getDraftDefaults(draft.kind, nextProvider);
  const nextDraft: IntegrationDraft = {
    ...draft,
    provider: nextProvider,
    auth_type: nextAuthType,
  };

  if ("base_url" in nextDefaults) {
    nextDraft.base_url = nextDefaults.base_url ?? "";
  }
  if ("detail_url_template" in nextDefaults) {
    nextDraft.detail_url_template = nextDefaults.detail_url_template ?? "";
  }
  if (draft.kind === "llm") {
    if ("llm_model" in nextDefaults) nextDraft.llm_model = nextDefaults.llm_model ?? "";
    if ("llm_api_version" in nextDefaults) nextDraft.llm_api_version = nextDefaults.llm_api_version ?? "";
    if ("llm_temperature" in nextDefaults) nextDraft.llm_temperature = nextDefaults.llm_temperature ?? "";
    if ("llm_max_tokens" in nextDefaults) nextDraft.llm_max_tokens = nextDefaults.llm_max_tokens ?? "";
  }

  return nextDraft;
}

function renderSecretVisibilityIcon(visible: boolean) {
  const baseProps = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (visible) {
    return (
      <svg {...baseProps}>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...baseProps}>
      <path d="m3 3 18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 13.3 13.4" />
      <path d="M9.9 5.2A11.4 11.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2" />
      <path d="M6.2 6.2C3.7 8 2 12 2 12a17.7 17.7 0 0 0 7.2 5.4" />
    </svg>
  );
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

function getIntegrationDeleteConfirmationMessage(integration: Pick<PartnerIntegration, "kind" | "provider">): string {
  const kind = String(integration.kind ?? "").trim().toLowerCase();
  const providerLabel = formatProviderLabel(integration.provider);
  if (kind === "crm") {
    return [
      `${providerLabel}-Anbindung wirklich löschen?`,
      "",
      "Dabei werden auch importierte CRM-Daten dieses Systems, zugehörige Overrides und Übersetzungen entfernt.",
      "Diesen Schritt nur ausführen, wenn die neue CRM-Anbindung bereits geprüft wurde.",
    ].join("\n");
  }
  return `${providerLabel}-Anbindung wirklich löschen?\n\nDie gespeicherte Anbindung wird entfernt. Importierte CRM-Daten sind davon nicht betroffen.`;
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
  const [integrationFlowTab, setIntegrationFlowTab] = useState<"basis" | "zugangstest" | "trigger">("basis");
  const [costMonitorTab, setCostMonitorTab] = useState<"tokenverbrauch" | "portalabo" | "features">("tokenverbrauch");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const selectedIntegrationIdRef = useRef<string | null>(null);
  const isCreateModeRef = useRef(false);
  const bootstrapDoneRef = useRef(false);
  const [secretDraft, setSecretDraft] = useState<Record<string, SecretDraft>>({});
  const [secretVisibility, setSecretVisibility] = useState<SecretVisibilityState>({});
  const [testResult, setTestResult] = useState<Record<string, { status: "ok" | "warning" | "error"; message: string }>>({});
  const [triggerConfigByIntegration, setTriggerConfigByIntegration] = useState<Record<string, TriggerConfig>>({});
  const [generatedTriggerSecretByIntegration, setGeneratedTriggerSecretByIntegration] = useState<Record<string, string>>({});
  const [triggerLoadingByIntegration, setTriggerLoadingByIntegration] = useState<Record<string, boolean>>({});
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [integrationsLoaded, setIntegrationsLoaded] = useState(false);
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

  useEffect(() => {
    let active = true;
    async function loadTriggerConfig() {
      const integrationId = selectedIntegration?.id ?? null;
      const kind = String(selectedIntegration?.kind ?? "").toLowerCase();
      if (!integrationId || kind !== "crm") return;
      setTriggerLoadingByIntegration((prev) => ({ ...prev, [integrationId]: true }));
      try {
        const payload = await api<{ config?: TriggerConfig }>(
          `/api/partner/integrations/${integrationId}/trigger-config`,
        );
        if (!active) return;
        if (payload.config) {
          setTriggerConfigByIntegration((prev) => ({ ...prev, [integrationId]: payload.config as TriggerConfig }));
        }
      } catch {
        if (!active) return;
        setTriggerConfigByIntegration((prev) => {
          const next = { ...prev };
          delete next[integrationId];
          return next;
        });
      } finally {
        if (active) {
          setTriggerLoadingByIntegration((prev) => ({ ...prev, [integrationId]: false }));
        }
      }
    }
    void loadTriggerConfig();
    return () => {
      active = false;
    };
  }, [selectedIntegration?.id, selectedIntegration?.kind]);
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

  function getDefaultTintClass(field: keyof IntegrationDraft): string {
    const current = String(integrationDraft[field] ?? "").trim();
    const defaultValueRaw = (currentDefaults as Record<string, unknown>)[field];
    const defaultValue = String(defaultValueRaw ?? "").trim();
    if (defaultValue && current === defaultValue) return styles.inputMuted;
    return styles.input;
  }

  useEffect(() => {
    selectedIntegrationIdRef.current = selectedIntegrationId;
  }, [selectedIntegrationId]);

  useEffect(() => {
    isCreateModeRef.current = isCreateMode;
  }, [isCreateMode]);

  const loadProfile = useCallback(async () => {
    const profileRes = await api<{ profile: PartnerProfile }>("/api/partner/profile");
    setProfile(profileRes.profile);
    setProfileDraft({
      company_name: profileRes.profile.company_name ?? "",
      contact_email: profileRes.profile.contact_email ?? "",
      contact_first_name: profileRes.profile.contact_first_name ?? "",
      contact_last_name: profileRes.profile.contact_last_name ?? "",
      website_url: profileRes.profile.website_url ?? "",
    });
    setProfileLoaded(true);
  }, []);

  const loadIntegrations = useCallback(async (preferredIntegrationId?: string | null) => {
    const integrationsRes = await api<{ integrations: PartnerIntegration[]; policy?: IntegrationPolicy }>("/api/partner/integrations");
    const nextIntegrations = integrationsRes.integrations ?? [];
    setIntegrationPolicy(integrationsRes.policy ?? { llm_partner_managed_allowed: true });
    setIntegrations(nextIntegrations);
    setIntegrationsLoaded(true);
    if (isCreateModeRef.current && !preferredIntegrationId) return;

    const desiredId = preferredIntegrationId ?? selectedIntegrationIdRef.current;
    const resolved =
      (desiredId ? nextIntegrations.find((entry) => entry.id === desiredId) : null) ??
      nextIntegrations[0] ??
      null;
    if (resolved) {
      selectedIntegrationIdRef.current = resolved.id;
      isCreateModeRef.current = false;
      setSelectedIntegrationId(resolved.id);
      setIntegrationDraft(buildDraftFromIntegration(resolved));
      setIsCreateMode(false);
    } else {
      selectedIntegrationIdRef.current = null;
      isCreateModeRef.current = true;
      setSelectedIntegrationId(null);
      setIntegrationDraft(buildDefaultDraft("crm"));
      setIsCreateMode(true);
    }
  }, []);

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
    isCreateModeRef.current = true;
    selectedIntegrationIdRef.current = null;
    setIsCreateMode(true);
    setSelectedIntegrationId(null);
    setAdvancedAuthOpen(false);
    setLlmCustomModelMode(false);
    setIntegrationFlowTab("basis");
    setIntegrationDraft(buildDefaultDraft("crm"));
    setGeneratedTriggerSecretByIntegration({});
  }

  function selectIntegration(integration: PartnerIntegration) {
    isCreateModeRef.current = false;
    selectedIntegrationIdRef.current = integration.id;
    setIsCreateMode(false);
    setSelectedIntegrationId(integration.id);
    setAdvancedAuthOpen(false);
    setLlmCustomModelMode(false);
    setIntegrationFlowTab("basis");
    setIntegrationDraft(buildDraftFromIntegration(integration));
    setGeneratedTriggerSecretByIntegration((prev) => {
      const next = { ...prev };
      delete next[integration.id];
      return next;
    });
  }

  function updateIntegrationProvider(nextProvider: string) {
    setIntegrationDraft((prev) => applyProviderSelection(prev, nextProvider));
    if (selectedIntegrationIdRef.current) {
      const integrationId = selectedIntegrationIdRef.current;
      setTestResult((prev) => {
        if (!prev[integrationId]) return prev;
        const next = { ...prev };
        delete next[integrationId];
        return next;
      });
    }
  }

  useEffect(() => {
    if (bootstrapDoneRef.current) return;
    bootstrapDoneRef.current = true;
    let active = true;
    (async () => {
      try {
        if (section === "profil") {
          await loadProfile();
        } else if (section === "integrationen" || section === "kostenmonitor") {
          await loadIntegrations();
        }
        if (!active) return;
        setStatus("Einstellungen geladen.");
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Fehler beim Laden");
      } finally {
        if (active) setInitialLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadIntegrations, loadProfile, section]);

  useEffect(() => {
    if (initialLoading) return;
    if (section !== "profil") return;
    if (profileLoaded) return;
    let active = true;
    setBusy(true);
    setStatus("Partnerprofil wird geladen...");
    void loadProfile()
      .then(() => {
        if (active) setStatus("Partnerprofil geladen.");
      })
      .catch((error) => {
        if (active) setStatus(error instanceof Error ? error.message : "Partnerprofil konnte nicht geladen werden.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [initialLoading, loadProfile, profileLoaded, section]);

  useEffect(() => {
    if (initialLoading) return;
    if (section !== "integrationen" && section !== "kostenmonitor") return;
    if (integrationsLoaded) return;
    let active = true;
    setBusy(true);
    setStatus(section === "integrationen" ? "Anbindungen werden geladen..." : "Monitor wird vorbereitet...");
    void loadIntegrations()
      .then(() => {
        if (active) setStatus(section === "integrationen" ? "Anbindungen geladen." : "Monitor bereit.");
      })
      .catch((error) => {
        if (active) setStatus(error instanceof Error ? error.message : "Anbindungen konnten nicht geladen werden.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [initialLoading, integrationsLoaded, loadIntegrations, section]);

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
    <div className="d-flex justify-content-stretch w-100">
      <FullscreenLoader show={busy} label="Sektionen werden geladen..." />
      <div className={styles.content}>
        <div className={`${styles.tabsBar} mb-5`}>
          <button
            type="button"
            className={settingsTabClass(section === "konto")}
            onClick={() => onSectionChange?.("konto")}
          >
            Konto
          </button>
          <button
            type="button"
            className={settingsTabClass(section === "profil")}
            onClick={() => onSectionChange?.("profil")}
          >
            Partnerprofil
          </button>
          <button
            type="button"
            className={settingsTabClass(section === "integrationen")}
            onClick={() => onSectionChange?.("integrationen")}
          >
            Anbindungen
          </button>
          {showsPortalLlmUsage ? (
              <button
                type="button"
                className={settingsTabClass(section === "kostenmonitor")}
                onClick={() => onSectionChange?.("kostenmonitor")}
              >
                Monitor
              </button>
          ) : null}
        </div>
        <p className={styles.status}>{status}</p>

        {section === "konto" ? <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Konto</h3>
          <div className="row g-2">
            <input
              type="password"
              placeholder="Neues Passwort"
              aria-label="Neues Passwort"
              className="form-control col-12 col-md-6"
              value={passwordDraft.password}
              onChange={(e) => setPasswordDraft((v) => ({ ...v, password: e.target.value }))}
            />
            <input
              type="password"
              placeholder="Passwort wiederholen"
              aria-label="Passwort wiederholen"
              className="form-control col-12 col-md-6"
              value={passwordDraft.password_confirm}
              onChange={(e) => setPasswordDraft((v) => ({ ...v, password_confirm: e.target.value }))}
            />
          </div>
          <div className="mt-2">
            <button
              className={styles.buttonPrimary}
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
          <div className={styles.privacyHint}>
            Datenschutz: Passwortänderungen wirken sofort. Dein Passwort wird in der Oberfläche nicht angezeigt.
          </div>
        </section> : null}

        {section === "profil" ? <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Partnerprofil</h3>
          <div className="row g-2">
            <input
              placeholder="Firmenname"
              aria-label="Firmenname"
              className="form-control col-12 col-md-6"
              value={profileDraft.company_name}
              onChange={(e) => setProfileDraft((v) => ({ ...v, company_name: e.target.value }))}
            />
            <input
              placeholder="Kontakt-E-Mail"
              aria-label="Kontakt-E-Mail"
              className="form-control col-12 col-md-6"
              value={profileDraft.contact_email}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_email: e.target.value }))}
            />
            <input
              placeholder="Vorname"
              aria-label="Vorname"
              className="form-control col-12 col-md-6"
              value={profileDraft.contact_first_name}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_first_name: e.target.value }))}
            />
            <input
              placeholder="Nachname"
              aria-label="Nachname"
              className="form-control col-12 col-md-6"
              value={profileDraft.contact_last_name}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_last_name: e.target.value }))}
            />
            <input
              placeholder="Website URL"
              aria-label="Website URL"
              className="form-control col-12 col-md-6"
              value={profileDraft.website_url}
              onChange={(e) => setProfileDraft((v) => ({ ...v, website_url: e.target.value }))}
            />
          </div>
          <div className="mt-2">
            <button
              className={styles.buttonPrimary}
              disabled={busy || !profile}
              onClick={() =>
                run("Partnerprofil speichern", async () => {
                  await api("/api/partner/profile", {
                    method: "PATCH",
                    body: JSON.stringify(profileDraft),
                  });
                  await loadProfile();
                })
              }
            >
              Profil speichern
            </button>
          </div>
          <div className={styles.privacyHint}>
            Datenschutz: Hinterlege nur Kontaktdaten, die öffentlich angezeigt werden sollen.
          </div>
        </section> : null}

        {section === "integrationen" ? <section className={styles.section}>
          <h3 className={styles.integrationTitle}>Anbindungen</h3>
          <div className={styles.introCard}>
            <p className={styles.introHeadline}>Anbindung in 3 Schritten</p>
            <p className={styles.introText}>
              1. Anbieter auswählen, 2. Basisdaten speichern, 3. Verbindung testen. CRM/LLM sind Datenquellen, Local Site ist ein Ausspielkanal.
            </p>
          </div>
          <div className="mt-3 mb-4">
            <button
              className={styles.buttonGreenGhost}
              disabled={busy}
              onClick={beginCreateIntegration}
            >
              Neue Anbindung anlegen
            </button>
          </div>
          <div className={styles.integrationLayout}>
            <aside className={styles.integrationListPane}>
              <div className="d-flex align-items-center justify-content-start mb-2">
                <strong className="text-dark fw-bold">Gespeicherte Anbindungen</strong>
              </div>
              <div className="d-flex flex-column gap-2">
                {integrations.length === 0 ? (
                  <p className={styles.emptyHint}>Noch keine Anbindung gespeichert.</p>
                ) : (
                  integrations.map((integration) => (
                    <button
                      key={integration.id}
                      className={integrationListItemClass(selectedIntegrationId === integration.id && !isCreateMode)}
                      onClick={() => selectIntegration(integration)}
                      disabled={busy}
                    >
                      <strong>{getIntegrationListLabel(integration)}</strong>
                      <span className={styles.integrationMetaSub}>{getIntegrationMetaText(integration)}</span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className={styles.integrationDetailPane}>
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <strong className={styles.detailTitle}>{isCreateMode ? "Neue Anbindung" : "Anbindung bearbeiten"}</strong>
                {!isCreateMode && selectedIntegration ? (
                  <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                    <button
                      className={integrationToggleClass(selectedIntegration.is_active)}
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
                          await loadIntegrations(selectedIntegration.id);
                        })
                      }
                    >
                      {selectedIntegration.is_active ? "Anbindung deaktivieren" : "Anbindung aktivieren"}
                    </button>
                    <button
                      className={styles.buttonDangerGhost}
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(getIntegrationDeleteConfirmationMessage(selectedIntegration))) return;
                        void run("Anbindung löschen", async () => {
                          const purgeImportedData = String(selectedIntegration.kind ?? "").trim().toLowerCase() === "crm";
                          const params = purgeImportedData ? "?purge_imported_data=1" : "";
                          await api(`/api/partner/integrations/${selectedIntegration.id}${params}`, {
                            method: "DELETE",
                          });
                          await loadIntegrations(null);
                        });
                      }}
                    >
                      Anbindung löschen
                    </button>
                  </div>
                ) : null}
              </div>

              <div className={styles.introCard}>
                <p className={styles.introHeadline}>{getIntegrationSetupHeadline(integrationDraft.kind)}</p>
                <ol className={styles.introList}>
                  {getIntegrationSetupSteps(integrationDraft.kind).map((step) => (
                    <li key={step} className={styles.introListItem}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className={`${styles.tabsBar} mb-4`}>
                <button
                  type="button"
                  className={flowTabClass(integrationFlowTab === "basis")}
                  onClick={() => setIntegrationFlowTab("basis")}
                >
                  1. Basisdaten
                </button>
                <button
                  type="button"
                  className={flowTabClass(integrationFlowTab === "zugangstest")}
                  onClick={() => setIntegrationFlowTab("zugangstest")}
                >
                  2. API-Key
                </button>
                <button
                  type="button"
                  className={flowTabClass(integrationFlowTab === "trigger")}
                  onClick={() => setIntegrationFlowTab("trigger")}
                >
                  3. Automatische Aktualisierung
                </button>
              </div>

              {integrationFlowTab === "basis" ? (
                <>
                  {isCreateMode ? (
                    <div className="row g-2 mt-5">
                      <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>Anbindungstyp</label>
                        <select
                          className={styles.selectInput}
                          aria-label="Anbindungstyp"
                          value={integrationDraft.kind}
                          disabled={!isCreateMode}
                          onChange={(e) =>
                            setIntegrationDraft((v) => {
                              const nextKind = e.target.value;
                              const nextProvider = getDefaultProviderId(nextKind);
                              return applyProviderSelection({
                                ...v,
                                kind: nextKind,
                                ...(nextKind === "llm"
                                  ? {
                                      llm_model: v.llm_model,
                                      llm_api_version: v.llm_api_version,
                                      llm_temperature: v.llm_temperature,
                                      llm_max_tokens: v.llm_max_tokens,
                                    }
                                  : {}),
                              }, nextProvider);
                            })
                          }
                        >
                          <option value="crm">CRM</option>
                          {llmPartnerManagedAllowed ? <option value="llm">LLM</option> : null}
                          <option value="local_site">Local Site</option>
                        </select>
                        <span className={styles.fieldHint}>Was willst du anbinden?</span>
                      </div>
                      {isLocalSiteDraft ? (
                        <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Kanal</label>
                          <input
                            className={styles.inputMuted}
                            aria-label="Kanal"
                            value="Local Site (Ausspielkanal)"
                            readOnly
                          />
                          <span className={styles.fieldHint}>{getProviderBeginnerHint(integrationDraft.kind, integrationDraft.provider)}</span>
                        </div>
                      ) : (
                        <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Provider</label>
                          <select
                            className={styles.selectInput}
                            aria-label="Provider"
                            value={integrationDraft.provider}
                            disabled={!isCreateMode}
                            onChange={(e) => updateIntegrationProvider(e.target.value)}
                          >
                            {providerOptions.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.label}
                              </option>
                            ))}
                          </select>
                          <span className={styles.fieldHint}>{getProviderBeginnerHint(integrationDraft.kind, integrationDraft.provider)}</span>
                        </div>
                      )}
                      {(selectedProviderSpec?.authTypes?.length ?? 0) > 1 ? (
                        <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Authentifizierung (Erweitert)</label>
                          <button
                            type="button"
                            className={advancedToggleClass(advancedAuthOpen)}
                            onClick={() => setAdvancedAuthOpen((v) => !v)}
                          >
                            {advancedAuthOpen ? "Erweitert ausblenden" : "Erweitert: Authentifizierung anpassen"}
                          </button>
                          {!advancedAuthOpen ? (
                            <span className={styles.fieldHint}>
                              Standard: {AUTH_TYPE_LABELS[String(selectedProviderSpec?.defaultAuthType ?? integrationDraft.auth_type)] ?? String(selectedProviderSpec?.defaultAuthType ?? integrationDraft.auth_type)}
                            </span>
                          ) : (
                            <>
                              <select
                                className={styles.selectInput}
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
                              <span className={styles.fieldHint}>
                                {getAuthBeginnerHint(integrationDraft.kind, integrationDraft.provider, integrationDraft.auth_type)}
                              </span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="row g-2 mt-5">
                      <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>Anbindungstyp</label>
                        <input
                          className={styles.inputMuted}
                          aria-label="Anbindungstyp"
                          value={getKindLabel(integrationDraft.kind)}
                          readOnly
                        />
                        <span className={styles.fieldHint}>Der Anbindungstyp bleibt bei bestehenden Einträgen fix.</span>
                      </div>
                      {isLocalSiteDraft ? (
                        <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Kanal</label>
                          <input
                            className={styles.inputMuted}
                            aria-label="Kanal"
                            value="Local Site (Ausspielkanal)"
                            readOnly
                          />
                          <span className={styles.fieldHint}>{getProviderBeginnerHint(integrationDraft.kind, integrationDraft.provider)}</span>
                        </div>
                      ) : (
                        <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Provider</label>
                          <select
                            className={styles.selectInput}
                            aria-label="Provider"
                            value={integrationDraft.provider}
                            onChange={(e) => updateIntegrationProvider(e.target.value)}
                          >
                            {providerOptions.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.label}
                              </option>
                            ))}
                          </select>
                          <span className={styles.fieldHint}>{getProviderBeginnerHint(integrationDraft.kind, integrationDraft.provider)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!isLocalSiteDraft ? (
                    <div className="row g-2 mt-3">
                      <div className="col-12 col-md-6 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>Base URL</label>
                        <input
                          placeholder={isLlmDraft ? "https://api.openai.com/v1" : "https://api.propstack.de/v1"}
                          aria-label="Base URL"
                          className={getDefaultTintClass("base_url")}
                          value={integrationDraft.base_url}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, base_url: e.target.value }))}
                        />
                        <span className={styles.fieldHint}>
                          API-Startadresse des Anbieters. Beispiel: `https://api.propstack.de/v1`
                        </span>
                      </div>
                      {!isLlmDraft ? (
                        <div className="col-12 col-md-6 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Detail URL Template</label>
                          <input
                            placeholder="https://www.partnerdomain.de/expose/{exposee_id}"
                            aria-label="Detail URL Template"
                            className={getDefaultTintClass("detail_url_template")}
                            value={integrationDraft.detail_url_template}
                            onChange={(e) => setIntegrationDraft((v) => ({ ...v, detail_url_template: e.target.value }))}
                          />
                          <span className={styles.fieldHint}>
                            Optional. Nur erforderlich, wenn ein externer Partner-Exposé-Link erzeugt werden soll.
                          </span>
                        </div>
                      ) : (
                        <div className="col-12 col-md-6" />
                      )}
                    </div>
                  ) : (
                    <div className="row g-2 mt-3">
                      <div className="col-12 col-md-6 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>URL deiner Website</label>
                        <input
                          placeholder="https://www.deine-website.de"
                          aria-label="URL deiner Website"
                          className={getDefaultTintClass("base_url")}
                          value={integrationDraft.base_url}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, base_url: e.target.value }))}
                        />
                        <span className={styles.fieldHint}>
                          Diese URL wird als Kennung der Local-Site-Anbindung angezeigt (z. B. links in der Anbindungsliste).
                        </span>
                      </div>
                      <div className="col-12 col-md-6" />
                    </div>
                  )}

                  {isLlmDraft ? (
                    <div className="row g-2 mt-3">
                      <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>{getLlmModelFieldLabel(integrationDraft.provider)}</label>
                        <select
                          aria-label={getLlmModelFieldLabel(integrationDraft.provider)}
                          className={`${styles.selectInput} ${getDefaultTintClass("llm_model")}`}
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
                            className={getDefaultTintClass("llm_model")}
                            value={integrationDraft.llm_model}
                            onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_model: e.target.value }))}
                          />
                        ) : null}
                        <span className={styles.fieldHint}>{getLlmModelHint(integrationDraft.provider)}</span>
                      </div>
                      <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>Temperature</label>
                        <input
                          placeholder="0.4"
                          aria-label="Temperature"
                          className={getDefaultTintClass("llm_temperature")}
                          value={integrationDraft.llm_temperature}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_temperature: e.target.value }))}
                        />
                        <span className={styles.fieldHint}>
                          Steuert die Kreativität der Ausgabe. Niedrig = sachlicher, höher = variabler.
                        </span>
                      </div>
                      <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                        <label className={styles.fieldLabel}>Max Tokens</label>
                        <input
                          placeholder="800"
                          aria-label="Max Tokens"
                          className={getDefaultTintClass("llm_max_tokens")}
                          value={integrationDraft.llm_max_tokens}
                          onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_max_tokens: e.target.value }))}
                        />
                        <span className={styles.fieldHint}>
                          Maximale Antwortlänge. Höher erlaubt längere Texte, erhöht aber meist Kosten und Laufzeit.
                        </span>
                      </div>
                      {String(integrationDraft.provider ?? "").toLowerCase() === "azure_openai" ? (
                        <div className="col-12 col-lg-4 d-flex flex-column gap-1">
                          <label className={styles.fieldLabel}>Azure API-Version</label>
                          <input
                            placeholder="2024-10-21"
                            aria-label="Azure API-Version"
                            className={getDefaultTintClass("llm_api_version")}
                            value={integrationDraft.llm_api_version}
                            onChange={(e) => setIntegrationDraft((v) => ({ ...v, llm_api_version: e.target.value }))}
                          />
                          <span className={styles.fieldHint}>
                            Version laut Azure-Endpoint (z. B. 2024-10-21). Muss zum Deployment passen.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={isLlmDraft ? "mt-4" : "mt-5"}>
                    <button
                      className={styles.buttonGreenGhost}
                      disabled={busy}
                      onClick={() =>
                        run(isCreateMode ? "Anbindung anlegen" : "Basisdaten speichern", async () => {
                          if (isLocalSiteDraft && !integrationDraft.base_url.trim()) {
                            throw new Error("Bitte URL deiner Website eintragen.");
                          }
                          const providerChanged =
                            !isCreateMode
                            && String(selectedIntegration?.kind ?? "").toLowerCase() === "crm"
                            && String(selectedIntegration?.provider ?? "").toLowerCase() !== String(integrationDraft.provider ?? "").toLowerCase();
                          const builtSettings = buildIntegrationSettings(integrationDraft, selectedIntegration?.settings ?? null);
                          const settings =
                            builtSettings && typeof builtSettings === "object"
                              ? { ...(builtSettings as Record<string, unknown>) }
                              : builtSettings;
                          if (providerChanged && settings && typeof settings === "object") {
                            delete (settings as Record<string, unknown>).last_tested_at;
                            delete (settings as Record<string, unknown>).last_test_status;
                            delete (settings as Record<string, unknown>).last_test_message;
                            delete (settings as Record<string, unknown>).last_test_http_status;
                            delete (settings as Record<string, unknown>).sync_state;
                            delete (settings as Record<string, unknown>).sync_started_at;
                            delete (settings as Record<string, unknown>).sync_finished_at;
                            delete (settings as Record<string, unknown>).sync_message;
                            delete (settings as Record<string, unknown>).sync_error;
                            delete (settings as Record<string, unknown>).sync_result;
                            delete (settings as Record<string, unknown>).sync_job_id;
                          }
                          const response = await api<{ integration?: PartnerIntegration }>("/api/partner/integrations", {
                            method: "POST",
                            body: JSON.stringify({
                              integration_id: selectedIntegration?.id ?? undefined,
                              ...integrationDraft,
                              settings,
                              is_active:
                                String(integrationDraft.kind ?? "").toLowerCase() === "crm"
                                  ? true
                                  : (selectedIntegration?.is_active ?? true),
                            }),
                          });
                          const savedId = response.integration?.id ?? selectedIntegration?.id ?? null;
                          await loadIntegrations(savedId);
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
                <div className="mt-3 pt-0">
                  <div className="mt-5 mb-2 text-dark fs-5 fw-bold lh-sm">
                    API-Key und Test
                  </div>
                  <p className={`${styles.secretPrivacyHint} mb-4`}>
                    {getSecretsStepHint(selectedIntegration.kind)}
                  </p>
                  {(() => {
                    const integration = selectedIntegration;
                    const isLocalSiteIntegration = String(integration.kind ?? "").toLowerCase() === "local_site";
                    const isCrmIntegration = String(integration.kind ?? "").toLowerCase() === "crm";
                    const draft = secretDraft[integration.id] ?? {
                      api_key: asText(integration.api_key) ?? "",
                      token: asText(isLocalSiteIntegration ? integration.local_site_api_key : integration.token) ?? "",
                      secret: asText(integration.secret) ?? "",
                    };
                    const visibility = secretVisibility[integration.id] ?? {};
                    const settings = (integration.settings ?? {}) as Record<string, unknown>;
                    const lastTestedAt = asText(settings.last_tested_at);
                    const lastTestStatus = asText(settings.last_test_status);
                    const lastTestMessage = asText(settings.last_test_message);
                    const relevantSecretFields = getRelevantSecretFields(integration);
                    const supportsSecrets = relevantSecretFields.length > 0;
                    return (
                      <>
                        {supportsSecrets && isLocalSiteIntegration ? (
                          <div className="mt-0 mb-4">
                            <button
                              className={styles.buttonGreenGhost}
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
                          <div className={secretGridClass(relevantSecretFields.length)}>
                            {relevantSecretFields.map((field) => (
                              <div key={`${integration.id}-${field}`} className="d-flex flex-column align-items-stretch text-start w-100 gap-1">
                                <label className={styles.fieldLabel}>{getSecretFieldMeta(integration, field).label}</label>
                                <div className={styles.secretInputWrap}>
                                  <input
                                    type={visibility[field] ? "text" : "password"}
                                    placeholder={getSecretFieldMeta(integration, field).placeholder}
                                    aria-label={`${getSecretFieldMeta(integration, field).label} für ${integration.provider}`}
                                    className={styles.secretInput}
                                    value={draft[field]}
                                    onChange={(e) =>
                                      setSecretDraft((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, [field]: e.target.value },
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className={styles.secretVisibilityButton}
                                    aria-label={visibility[field] ? "Wert verbergen" : "Wert anzeigen"}
                                    aria-pressed={visibility[field] === true}
                                    onClick={() =>
                                      setSecretVisibility((prev) => ({
                                        ...prev,
                                        [integration.id]: {
                                          ...(prev[integration.id] ?? {}),
                                          [field]: !Boolean(prev[integration.id]?.[field]),
                                        },
                                      }))
                                    }
                                  >
                                    {renderSecretVisibilityIcon(Boolean(visibility[field]))}
                                  </button>
                                </div>
                                {isLocalSiteIntegration && field === "token" ? (
                                  <span className={styles.fieldHint}>
                                    Das ist dein geheimer API-Key. Gib ihn nicht öffentlich weiter.
                                  </span>
                                ) : null}
                                {!isLocalSiteIntegration && !String(draft[field] ?? "").trim() && hasStoredSecret(integration, field) ? (
                                  <span className={styles.fieldHint}>
                                    Bereits gespeichert. Aus Sicherheitsgründen wird der Wert hier nicht erneut angezeigt.
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`${styles.secretPrivacyHint} mb-2`}>
                            Für diese Anbindung sind bei der gewählten Authentifizierung keine zusätzlichen Zugangsdaten erforderlich.
                          </p>
                        )}
                        <div className="d-flex flex-column align-items-stretch text-start w-100 mt-5">
                          <div className="d-flex gap-2 flex-wrap">
                            {supportsSecrets ? (
                              <button
                                className={styles.buttonPrimary}
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
                                    setSecretDraft((prev) => ({
                                      ...prev,
                                      [integration.id]: {
                                        api_key: payload.api_key ?? draft.api_key,
                                        token: payload.token ?? draft.token,
                                        secret: payload.secret ?? draft.secret,
                                      },
                                    }));
                                    await loadIntegrations(integration.id);
                                  })
                                }
                              >
                                Speichern
                              </button>
                            ) : null}
                            {!isLocalSiteIntegration ? (
                              <button
                                className={styles.buttonGhost}
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
                                    await loadIntegrations(integration.id);
                                  })
                                }
                              >
                                Verbindung testen
                              </button>
                            ) : null}
                            {isCrmIntegration ? (
                              <span className={`${styles.fieldHint} align-self-center`}>
                                CRM-Testläufe und Referenz-Mappings werden zentral im Admin-Bereich gesteuert.
                              </span>
                            ) : null}
                          </div>
                          {!isLocalSiteIntegration ? (
                            <>
                              {testResult[integration.id] ? (
                                <p
                                  className={`${styles.testResult} ${testResultClass(testResult[integration.id].status)}`}
                                >
                                  {testResult[integration.id].message}
                                </p>
                              ) : null}
                              {lastTestedAt ? (
                                <p className={styles.lastTestHint}>
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
                <p className={styles.emptyHint}>
                  Nach dem Anlegen kannst du hier Zugangsdaten speichern und die Verbindung testen.
                </p>
                )
              ) : null}

              {integrationFlowTab === "trigger" ? (
                !isCreateMode && selectedIntegration ? (
                  String(selectedIntegration.kind ?? "").toLowerCase() === "crm" ? (
                    <div className="mt-5">
                      <IntegrationTriggerPanel
                        config={triggerConfigByIntegration[selectedIntegration.id] ?? null}
                        generatedSecret={generatedTriggerSecretByIntegration[selectedIntegration.id] ?? null}
                        disabled={busy}
                        loading={triggerLoadingByIntegration[selectedIntegration.id] === true}
                        onGenerate={async () => {
                          setTriggerLoadingByIntegration((prev) => ({ ...prev, [selectedIntegration.id]: true }));
                          try {
                            const payload = await api<{ config?: TriggerConfig; generated_secret?: string | null }>(
                              `/api/partner/integrations/${selectedIntegration.id}/trigger-config`,
                              { method: "POST" },
                            );
                            if (payload.config) {
                              setTriggerConfigByIntegration((prev) => ({
                                ...prev,
                                [selectedIntegration.id]: payload.config as TriggerConfig,
                              }));
                            }
                            setGeneratedTriggerSecretByIntegration((prev) => ({
                              ...prev,
                              [selectedIntegration.id]: String(payload.generated_secret ?? ""),
                            }));
                            await loadIntegrations(selectedIntegration.id);
                          } finally {
                            setTriggerLoadingByIntegration((prev) => ({ ...prev, [selectedIntegration.id]: false }));
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <p className={styles.emptyHint}>
                      Automatische Aktualisierung steht aktuell nur für CRM-Anbindungen bereit.
                    </p>
                  )
                ) : (
                  <p className={styles.emptyHint}>
                    Nach dem Anlegen der CRM-Anbindung kannst du hier die automatische Aktualisierung einrichten.
                  </p>
                )
              ) : null}
            </div>
          </div>
        </section> : null}
        {section === "kostenmonitor" ? (
          <section className={styles.section}>
            <h3 className={styles.integrationTitle}>Monitor</h3>
            <div className={`${styles.tabsBar} mt-3 mb-5`}>
              {showsPortalLlmUsage ? (
                <button
                  type="button"
                  className={settingsTabClass(costMonitorTab === "tokenverbrauch")}
                  onClick={() => setCostMonitorTab("tokenverbrauch")}
                >
                  Tokenverbrauch
                </button>
              ) : null}
              <button
                type="button"
                className={settingsTabClass(costMonitorTab === "portalabo")}
                onClick={() => setCostMonitorTab("portalabo")}
              >
                Portalabo
              </button>
              <button
                type="button"
                className={settingsTabClass(costMonitorTab === "features")}
                onClick={() => setCostMonitorTab("features")}
              >
                Features
              </button>
            </div>
            <div className={styles.usageWrap}>
              {costMonitorTab === "tokenverbrauch" ? (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className={usageModeButtonClass(llmUsagePeriod === "timeline")}
                      onClick={() => setLlmUsagePeriod("timeline")}
                    >
                      Monate
                    </button>
                    <button
                      type="button"
                      className={usageModeButtonClass(llmUsagePeriod === "year")}
                      onClick={() => setLlmUsagePeriod("year")}
                    >
                      Jahr
                    </button>
                  </div>
                  {llmUsagePeriod === "timeline" ? (
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className={styles.buttonGhost}
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
                        className={styles.usageCompactInput}
                        value={llmUsageMonth}
                        disabled={!llmUsageBounds.has_usage}
                        onChange={(e) => setLlmUsageMonth(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.buttonGhost}
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
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="number"
                        aria-label="Jahr"
                        className={styles.usageYearInput}
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
                    className={styles.buttonPrimary}
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
                  <div className={`${styles.tableWrap} mt-5`}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th>Modell</th>
                          <th>Input Tokens</th>
                          <th>Output Tokens</th>
                          <th>Gesamt Tokens</th>
                          <th>Preisinfo USD / 1k (Input | Output)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {llmUsageRows.length === 0 ? (
                          <tr>
                            <td colSpan={6}>
                              Noch keine Nutzung im gewählten Monat.
                            </td>
                          </tr>
                        ) : (
                          llmUsageRows.map((row) => (
                            <tr key={`${row.provider}:${row.model}`}>
                              <td>{formatProviderLabel(row.provider)}</td>
                              <td>{row.model}</td>
                              <td>{row.input_tokens}</td>
                              <td>{row.output_tokens}</td>
                              <td>{row.total_tokens}</td>
                              <td>
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
                  <div className={styles.usageTotals}>
                    Nutzung: Input <strong>{llmUsageTotals.input_tokens}</strong>
                    {" | "}
                    Output <strong>{llmUsageTotals.output_tokens}</strong>
                    {" | "}
                    Gesamt <strong>{llmUsageTotals.total_tokens}</strong>
                  </div>
                  <div className={styles.usageTotals}>
                    Geschätzte Kosten gesamt (netto, unverbindlich): <strong>{llmUsageTotals.cost_eur.toFixed(4)} EUR</strong>
                  </div>
                  <div className={styles.usageTotals}>
                    Preisinfo je Modell basiert auf den aktuell gepflegten Providerpreisen.
                    {llmUsageFxRate
                      ? ` Monats-FX (USD→EUR): ${llmUsageFxRate.toFixed(6)}.`
                      : " Monats-FX (USD→EUR) derzeit nicht verfügbar."}
                  </div>
                </>
              ) : null}
              {costMonitorTab === "portalabo" ? (
                <div className="d-grid gap-2">
                  <p className={styles.usageTotals}>
                    Es werden nur deine aktuell aktiven Kreise angezeigt. Ortslagenexport nutzt derzeit alle Ortslagen je Kreis.
                  </p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Kreis</th>
                          <th>Kreis-ID</th>
                          <th>Grundpreis EUR / Monat</th>
                          <th>Preis je Ortslage EUR</th>
                          <th>Ortslagen gesamt EUR</th>
                          <th>Ortslagenexport</th>
                          <th>Ortslagenexport gesamt EUR</th>
                          <th>Gesamtpreis EUR / Monat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portalAboRows.length === 0 ? (
                          <tr>
                            <td colSpan={8}>
                              Noch keine aktiven Kreise zugeordnet.
                            </td>
                          </tr>
                        ) : (
                          portalAboRows.map((row) => (
                          <tr key={`portalabo:${row.key}`}>
                            <td>{row.kreis_name}</td>
                            <td>{row.kreis_id}</td>
                            <td>{row.base_price_eur.toFixed(2)}</td>
                            <td>{row.ortslage_price_eur.toFixed(2)}</td>
                            <td>{row.ortslagen_total_price_eur.toFixed(2)}</td>
                            <td>
                              {row.export_ortslagen_count} von {row.ortslagen_count}
                            </td>
                            <td>{row.export_ortslagen_total_price_eur.toFixed(2)}</td>
                            <td>{row.total_price_eur.toFixed(2)}</td>
                          </tr>
                        ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {portalAboRows.length > 0 ? (
                    <>
                      <div className={styles.usageTotals}>
                        Gesamtpreis über alle Kreise: <strong>{portalAboGrandTotal.toFixed(2)} EUR / Monat</strong>
                      </div>
                      <div className={styles.usageTotals}>
                        Alle Preise netto pro Monat, zzgl. gesetzlicher Umsatzsteuer.
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              {costMonitorTab === "features" ? (
                <div className="d-grid gap-2">
                  <p className={styles.usageTotals}>
                    Feature-Preise werden pro Partner durch die Administration gepflegt und monatlich abgerechnet.
                  </p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Status</th>
                          <th>Festpreis</th>
                          <th>Hinweis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {featureRows.map((feature) => (
                          <tr key={feature.key}>
                            <td>{feature.label}</td>
                            <td>
                              <span className={featureBadgeClass(feature.enabled)}>
                                {feature.enabled ? "Aktiv" : "Nicht aktiv"}
                              </span>
                            </td>
                            <td>
                              {feature.monthly_price_eur.toFixed(2)} EUR
                              {feature.billing_unit ? ` (${feature.billing_unit})` : ""}
                            </td>
                            <td>{feature.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.usageTotals}>
                    Gesamtpreis aktive Features: <strong>{featureGrandTotal.toFixed(2)} EUR / Monat</strong>
                  </div>
                  <div className={styles.usageTotals}>
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
