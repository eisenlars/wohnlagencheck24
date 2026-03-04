"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getProviderSpec, getProvidersForKind } from "@/lib/integrations/providers";
import FullscreenLoader from "@/components/ui/FullscreenLoader";
export type SettingsSection = "konto" | "profil" | "integrationen";

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
};

type IntegrationDraft = {
  kind: string;
  provider: string;
  base_url: string;
  auth_type: string;
  detail_url_template: string;
  llm_model: string;
  llm_temperature: string;
  llm_max_tokens: string;
  crm_cap_listings: boolean;
  crm_cap_references: boolean;
  crm_cap_requests: boolean;
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
    llm_temperature: defaults.llm_temperature ?? "0.4",
    llm_max_tokens: defaults.llm_max_tokens ?? "800",
    crm_cap_listings: true,
    crm_cap_references: true,
    crm_cap_requests: true,
  };
}

function buildDraftFromIntegration(integration: PartnerIntegration): IntegrationDraft {
  const settings = (integration.settings ?? {}) as Record<string, unknown>;
  const capabilities = (settings.capabilities ?? {}) as Record<string, unknown>;
  const asBoolOr = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  const defaults = getDraftDefaults(integration.kind, integration.provider);
  return {
    kind: integration.kind,
    provider: integration.provider,
    base_url: String(integration.base_url ?? defaults.base_url ?? ""),
    auth_type: String(integration.auth_type ?? getDefaultAuthType(integration.kind, integration.provider)),
    detail_url_template: String(integration.detail_url_template ?? defaults.detail_url_template ?? ""),
    llm_model: String(settings.model ?? defaults.llm_model ?? "gpt-4o-mini"),
    llm_temperature: String(settings.temperature ?? defaults.llm_temperature ?? "0.4"),
    llm_max_tokens: String(settings.max_tokens ?? defaults.llm_max_tokens ?? "800"),
    crm_cap_listings: asBoolOr(capabilities.listings, true),
    crm_cap_references: asBoolOr(capabilities.references, true),
    crm_cap_requests: asBoolOr(capabilities.requests, true),
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

function asFiniteNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildIntegrationSettings(
  draft: IntegrationDraft,
  existingSettings?: Record<string, unknown> | null,
) {
  if (draft.kind === "crm") {
    return {
      ...(existingSettings ?? {}),
      capabilities: {
        listings: draft.crm_cap_listings,
        references: draft.crm_cap_references,
        requests: draft.crm_cap_requests,
      },
    };
  }

  if (draft.kind !== "llm") return existingSettings ?? null;
  const model = draft.llm_model.trim();
  if (!model) {
    throw new Error("Für LLM-Integrationen ist ein Modell erforderlich (z. B. gpt-4o-mini).");
  }
  const temperature = asFiniteNumber(draft.llm_temperature);
  const maxTokens = asFiniteNumber(draft.llm_max_tokens);
  const settings: Record<string, unknown> = { model };
  if (temperature !== null) settings.temperature = temperature;
  if (maxTokens !== null) settings.max_tokens = Math.max(1, Math.floor(maxTokens));
  return settings;
}

function getRelevantSecretFields(integration: Pick<PartnerIntegration, "kind" | "provider" | "auth_type">): SecretFieldKey[] {
  const provider = String(integration.provider ?? "").toLowerCase();
  const kind = String(integration.kind ?? "").toLowerCase();
  const authType = String(integration.auth_type ?? "").toLowerCase();

  if (kind === "local_site") return ["token"];
  if (provider === "onoffice") return authType.includes("basic") ? ["token", "secret"] : ["token"];
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

function getIntegrationPrimaryLabel(integration: Pick<PartnerIntegration, "kind" | "provider">): string {
  if (integration.kind === "local_site" && String(integration.provider ?? "").toLowerCase() === "token") {
    return "Local Site";
  }
  const spec = getProviderSpec(integration.provider);
  if (spec?.label) return spec.label;
  if (integration.kind === "local_site") return "Local Site";
  const provider = String(integration.provider ?? "").trim();
  return provider || "Unbekannter Provider";
}

function getKindLabel(kind: string): string {
  const normalized = String(kind ?? "").toLowerCase();
  if (normalized === "crm") return "CRM";
  if (normalized === "llm") return "LLM";
  if (normalized === "local_site") return "Local Site";
  if (normalized === "other") return "Sonstige";
  return kind;
}

function getIntegrationMetaText(integration: Pick<PartnerIntegration, "kind" | "is_active" | "auth_type">): string {
  const auth = String(integration.auth_type ?? "").toLowerCase();
  const authLabel = auth ? AUTH_TYPE_LABELS[auth] ?? auth : "nicht gesetzt";
  return `Typ: ${getKindLabel(integration.kind)} · Authentifizierung: ${authLabel} · Status: ${integration.is_active ? "aktiv" : "inaktiv"}`;
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
    return { label: "API Token", placeholder: "onOffice Token eingeben" };
  }
  if (provider === "local_site" || integration.kind === "local_site") {
    return { label: "API Token", placeholder: "Token eingeben" };
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
    return "Für onOffice brauchst du in der Regel Base URL und API Token.";
  }
  if (k === "crm" && p === "openimmo") {
    return "OpenImmo läuft meist über Feed-URL, je nach Quelle optional mit Token/Basic-Login.";
  }
  if (k === "llm") {
    return "Für LLM reicht meist API Key + Modell. Base URL nur bei speziellen Setups.";
  }
  if (k === "local_site") {
    return "Für Local Site: Base URL + Token des Zielsystems.";
  }
  return "Wähle den Anbieter, den du wirklich nutzt. Nicht benötigte Felder kannst du leer lassen.";
}

function getAuthBeginnerHint(kind: string, provider: string, authType: string): string {
  const k = String(kind ?? "").toLowerCase();
  const p = String(provider ?? "").toLowerCase();
  const a = String(authType ?? "").toLowerCase();
  if (k === "crm" && p === "propstack") {
    return "Bei Propstack läuft die Authentifizierung über API Key.";
  }
  if (k === "crm" && p === "onoffice") {
    return "Bei onOffice wird in der Regel ein Token verwendet.";
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
  const [integrationFlowTab, setIntegrationFlowTab] = useState<"basis" | "ressourcen" | "zugangstest">("basis");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [secretDraft, setSecretDraft] = useState<Record<string, SecretDraft>>({});
  const [testResult, setTestResult] = useState<Record<string, { status: "ok" | "warning" | "error"; message: string }>>({});
  const providerOptions = useMemo(() => getProvidersForKind(integrationDraft.kind), [integrationDraft.kind]);
  const selectedProviderSpec = useMemo(
    () => getProviderSpec(integrationDraft.provider) ?? providerOptions[0] ?? null,
    [integrationDraft.provider, providerOptions],
  );
  const hasResourcesTab = integrationDraft.kind === "crm";
  const isLlmDraft = integrationDraft.kind === "llm";
  const currentDefaults = useMemo(
    () => getDraftDefaults(integrationDraft.kind, integrationDraft.provider),
    [integrationDraft.kind, integrationDraft.provider],
  );
  const selectedIntegration = useMemo(
    () => integrations.find((entry) => entry.id === selectedIntegrationId) ?? null,
    [integrations, selectedIntegrationId],
  );

  useEffect(() => {
    if (!hasResourcesTab && integrationFlowTab === "ressourcen") {
      setIntegrationFlowTab("basis");
    }
  }, [hasResourcesTab, integrationFlowTab]);

  useEffect(() => {
    if (!isLlmDraft) return;
    if (llmCustomModelMode) return;
    const current = String(integrationDraft.llm_model ?? "").trim();
    if (current) return;
    const fallback = getLlmModelSuggestions(integrationDraft.provider)[0] ?? "";
    if (!fallback) return;
    setIntegrationDraft((v) => ({ ...v, llm_model: fallback }));
  }, [isLlmDraft, llmCustomModelMode, integrationDraft.provider, integrationDraft.llm_model]);

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
      api<{ integrations: PartnerIntegration[] }>("/api/partner/integrations"),
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
      <div style={contentStyle}>
        <div style={settingsTabsBarStyle}>
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
            Integrationen
          </button>
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
          <h3 style={integrationTitleStyle}>Integrationen</h3>
          <div style={integrationIntroCardStyle}>
            <p style={integrationIntroHeadlineStyle}>Integration in 3 Schritten</p>
            <p style={integrationIntroTextStyle}>
              1. Anbieter auswählen, 2. Basisdaten speichern, 3. Verbindung testen.
            </p>
          </div>
          <div style={integrationCreateRowStyle}>
            <button
              style={buttonGreenGhostStyle}
              disabled={busy}
              onClick={beginCreateIntegration}
            >
              Neue Integration anlegen
            </button>
          </div>
          <div style={integrationLayoutStyle}>
            <aside style={integrationListPaneStyle}>
              <div style={integrationListHeaderStyle}>
                <strong style={integrationListHeadingStyle}>Gespeicherte Integrationen</strong>
              </div>
              <div style={integrationListStyle}>
                {integrations.length === 0 ? (
                  <p style={emptyHintStyle}>Noch keine Integration gespeichert.</p>
                ) : (
                  integrations.map((integration) => (
                    <button
                      key={integration.id}
                      style={integrationListItemStyle(selectedIntegrationId === integration.id && !isCreateMode)}
                      onClick={() => selectIntegration(integration)}
                      disabled={busy}
                    >
                      <strong>{getIntegrationPrimaryLabel(integration)}</strong>
                      <span style={integrationMetaSubStyle}>{getIntegrationMetaText(integration)}</span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div style={integrationDetailPaneStyle}>
              <div style={integrationDetailHeaderStyle}>
                <strong>{isCreateMode ? "Neue Integration" : "Integration bearbeiten"}</strong>
                {!isCreateMode && selectedIntegration ? (
                  <button
                    style={integrationToggleButtonStyle(selectedIntegration.is_active)}
                    disabled={busy}
                    onClick={() =>
                      run(selectedIntegration.is_active ? "Integration deaktivieren" : "Integration aktivieren", async () => {
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
                    {selectedIntegration.is_active ? "Integration deaktivieren" : "Integration aktivieren"}
                  </button>
                ) : null}
              </div>

              <div style={integrationFlowTabsStyle}>
                <button
                  type="button"
                  style={integrationFlowTabButtonStyle(integrationFlowTab === "basis")}
                  onClick={() => setIntegrationFlowTab("basis")}
                >
                  1. Basisdaten
                </button>
                {hasResourcesTab ? (
                  <button
                    type="button"
                    style={integrationFlowTabButtonStyle(integrationFlowTab === "ressourcen")}
                    onClick={() => setIntegrationFlowTab("ressourcen")}
                  >
                    2. Ressourcen
                  </button>
                ) : null}
                <button
                  type="button"
                  style={integrationFlowTabButtonStyle(integrationFlowTab === "zugangstest")}
                  onClick={() => setIntegrationFlowTab("zugangstest")}
                >
                  {hasResourcesTab ? "3. Zugangstest" : "2. Zugangstest"}
                </button>
              </div>

              {integrationFlowTab === "basis" ? (
                <>
                  {isCreateMode ? (
                    <div style={grid3Style}>
                      <div style={fieldWrapStyle}>
                        <label style={fieldLabelStyle}>Integrationstyp</label>
                        <select
                          style={selectStyle}
                          aria-label="Integrationstyp"
                          value={integrationDraft.kind}
                          disabled={!isCreateMode}
                          onChange={(e) =>
                            setIntegrationDraft((v) => {
                              const nextKind = e.target.value;
                              const nextProvider = getDefaultProviderId(nextKind);
                              const nextAuth = getDefaultAuthType(nextKind, nextProvider);
                              return {
                                ...v,
                                kind: nextKind,
                                provider: nextProvider,
                                auth_type: nextAuth,
                                ...getDraftDefaults(nextKind, nextProvider),
                              };
                            })
                          }
                        >
                          <option value="crm">crm</option>
                          <option value="llm">llm</option>
                          <option value="local_site">local_site</option>
                          <option value="other">other</option>
                        </select>
                        <span style={fieldHintStyle}>Was willst du anbinden? CRM für Objekte, LLM für KI-Texte, Local Site für deine Website.</span>
                      </div>
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
                          marginBottom: 10,
                          color: "#0f172a",
                          fontSize: 22,
                          fontWeight: 800,
                          lineHeight: 1.2,
                        }}
                      >
                        {getKindLabel(integrationDraft.kind)} · {getIntegrationPrimaryLabel(integrationDraft)}
                      </div>
                      {hasResourcesTab ? (
                        <p style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: "#475569" }}>
                          REST API fuer Objekt- und Gesuche, Referenzdaten.
                        </p>
                      ) : null}
                    </>
                  )}
                  {isLlmDraft && !isCreateMode ? (
                    <p style={{ marginTop: -8, marginBottom: 14, fontSize: 13, color: "#475569" }}>
                      Wähle hier dein bevorzugtes Modell dieses Anbieters zur Textaufbereitung.
                    </p>
                  ) : null}

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
                    </div>
                  ) : null}

                  <p style={{ marginTop: 16, marginBottom: 0, fontSize: 11, color: "#64748b" }}>
                    Hinweis: Pro Integrationstyp wird genau eine aktive Konfiguration gespeichert.
                  </p>

                  <div style={{ marginTop: 10 }}>
                    <button
                      style={buttonGreenGhostStyle}
                      disabled={busy}
                      onClick={() =>
                        run(isCreateMode ? "Integration anlegen" : "Basisdaten speichern", async () => {
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
                      {isCreateMode ? "Integration anlegen" : "Basisdaten bearbeiten"}
                    </button>
                  </div>
                </>
              ) : null}

              {integrationFlowTab === "ressourcen" ? (
                hasResourcesTab ? (
                  <div style={crmCapsWrapStyle}>
                    <strong style={{ fontSize: 12, color: "#0f172a" }}>Ressourcen synchronisieren</strong>
                    <div style={crmCapsGridStyle}>
                      <label style={crmCapItemStyle}>
                        <input
                          type="checkbox"
                          checked={integrationDraft.crm_cap_listings}
                          onChange={(e) =>
                            setIntegrationDraft((v) => ({ ...v, crm_cap_listings: e.target.checked }))
                          }
                        />
                        <span>Angebote (listings)</span>
                      </label>
                      <label style={crmCapItemStyle}>
                        <input
                          type="checkbox"
                          checked={integrationDraft.crm_cap_references}
                          onChange={(e) =>
                            setIntegrationDraft((v) => ({ ...v, crm_cap_references: e.target.checked }))
                          }
                        />
                        <span>Referenzen (references)</span>
                      </label>
                      <label style={crmCapItemStyle}>
                        <input
                          type="checkbox"
                          checked={integrationDraft.crm_cap_requests}
                          onChange={(e) =>
                            setIntegrationDraft((v) => ({ ...v, crm_cap_requests: e.target.checked }))
                          }
                        />
                        <span>Gesuche (requests)</span>
                      </label>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <button
                        style={buttonGreenGhostStyle}
                        disabled={busy || isCreateMode}
                        onClick={() =>
                          run("Ressourcen speichern", async () => {
                            if (isCreateMode) throw new Error("Bitte zuerst Basisdaten anlegen.");
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
                          })
                        }
                      >
                        Ressourcen speichern
                      </button>
                    </div>
                    {isCreateMode ? (
                      <p style={fieldHintStyle}>
                        Lege zuerst die Basisdaten an, danach kannst du Ressourcen speichern.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p style={emptyHintStyle}>Für diesen Integrationstyp gibt es keine separaten Ressourcen.</p>
                )
              ) : null}

              {integrationFlowTab === "zugangstest" ? (
                !isCreateMode && selectedIntegration ? (
                <div style={integrationSecretsSectionStyle}>
                  <h4 style={h4Style}>Zugangsdaten und Test</h4>
                  <p style={secretPrivacyHintStyle}>
                    Anfänger-Hinweis: Trage nur die Felder ein, die dein Anbieter wirklich verlangt. Speichere danach und teste die Verbindung.
                  </p>
                  {(() => {
                    const integration = selectedIntegration;
                    const draft = secretDraft[integration.id] ?? { api_key: "", token: "", secret: "" };
                    const settings = (integration.settings ?? {}) as Record<string, unknown>;
                    const lastTestedAt = asText(settings.last_tested_at);
                    const lastTestStatus = asText(settings.last_test_status);
                    const lastTestMessage = asText(settings.last_test_message);
                    const relevantSecretFields = getRelevantSecretFields(integration);
                    const supportsSecrets = relevantSecretFields.length > 0;
                    return (
                      <>
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
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                            Für diese Integration sind bei der gewählten Authentifizierung keine zusätzlichen Zugangsdaten erforderlich.
                          </p>
                        )}
                        <div style={secretActionsWrapStyle}>
                          <p style={secretPrivacyHintStyle}>
                            Datenschutz: Zugangsdaten nur eintragen, wenn sie für die API-Verbindung zwingend erforderlich sind.
                          </p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {supportsSecrets ? (
                              <button
                                style={buttonStyle}
                                disabled={busy}
                                onClick={() =>
                                  run("Secrets speichern", async () => {
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
                                      [integration.id]: { api_key: "", token: "", secret: "" },
                                    }));
                                    await loadAll(integration.id);
                                  })
                                }
                              >
                                Speichern
                              </button>
                            ) : null}
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
                          </div>
                          <p style={fieldHintStyle}>
                            Nach dem Test siehst du sofort, ob die Verbindung ok ist oder welche Eingabe fehlt.
                          </p>
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

const h4Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 14,
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
  borderTop: "1px solid #e2e8f0",
  paddingTop: 10,
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
  marginTop: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  textAlign: "left",
  width: "100%",
};

const integrationMetaSubStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
};

const crmCapsWrapStyle: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 12px",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const crmCapsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
};

const crmCapItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "#334155",
};

const integrationIntroCardStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 10,
  padding: "10px 12px",
  marginTop: 4,
  marginBottom: 10,
  display: "grid",
  gap: 4,
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
