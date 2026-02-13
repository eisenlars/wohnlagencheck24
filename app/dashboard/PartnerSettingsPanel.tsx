"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getProviderSpec, getProvidersForKind } from "@/lib/integrations/providers";
export type SettingsSection = "konto" | "profil" | "integrationen";

type PartnerProfile = {
  id: string;
  company_name?: string | null;
  contact_email?: string | null;
  contact_person?: string | null;
  website_url?: string | null;
};

type PartnerIntegration = {
  id: string;
  kind: string;
  provider: string;
  base_url?: string | null;
  auth_type?: string | null;
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
};

type SecretDraft = {
  api_key: string;
  token: string;
  secret: string;
};

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

export default function PartnerSettingsPanel({ section }: { section: SettingsSection }) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState("Lade Einstellungen...");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [integrations, setIntegrations] = useState<PartnerIntegration[]>([]);
  const [profileDraft, setProfileDraft] = useState({
    company_name: "",
    contact_email: "",
    contact_person: "",
    website_url: "",
  });
  const [passwordDraft, setPasswordDraft] = useState({
    password: "",
    password_confirm: "",
  });
  const [integrationDraft, setIntegrationDraft] = useState<IntegrationDraft>({
    kind: "crm",
    provider: getDefaultProviderId("crm"),
    base_url: "",
    auth_type: getDefaultAuthType("crm", getDefaultProviderId("crm")),
    detail_url_template: "",
  });
  const [secretDraft, setSecretDraft] = useState<Record<string, SecretDraft>>({});
  const [testResult, setTestResult] = useState<Record<string, { status: "ok" | "warning" | "error"; message: string }>>({});
  const providerOptions = useMemo(() => getProvidersForKind(integrationDraft.kind), [integrationDraft.kind]);
  const selectedProviderSpec = useMemo(
    () => getProviderSpec(integrationDraft.provider) ?? providerOptions[0] ?? null,
    [integrationDraft.provider, providerOptions],
  );

  async function loadAll() {
    const [profileRes, integrationsRes] = await Promise.all([
      api<{ profile: PartnerProfile }>("/api/partner/profile"),
      api<{ integrations: PartnerIntegration[] }>("/api/partner/integrations"),
    ]);
    setProfile(profileRes.profile);
    setProfileDraft({
      company_name: profileRes.profile.company_name ?? "",
      contact_email: profileRes.profile.contact_email ?? "",
      contact_person: profileRes.profile.contact_person ?? "",
      website_url: profileRes.profile.website_url ?? "",
    });
    setIntegrations(integrationsRes.integrations ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
        setStatus("Einstellungen geladen.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Fehler beim Laden");
      }
    })();
  }, []);

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
              placeholder="Kontaktperson"
              aria-label="Kontaktperson"
              style={inputStyle}
              value={profileDraft.contact_person}
              onChange={(e) => setProfileDraft((v) => ({ ...v, contact_person: e.target.value }))}
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
        </section> : null}

        {section === "integrationen" ? <section style={sectionStyle}>
          <h3 style={h3Style}>Integrationen</h3>
          <div style={grid3Style}>
            <select
              style={inputStyle}
              aria-label="Integrationstyp"
              value={integrationDraft.kind}
              onChange={(e) =>
                setIntegrationDraft((v) => {
                  const nextKind = e.target.value;
                  const nextProvider = getDefaultProviderId(nextKind);
                  const nextAuth = getDefaultAuthType(nextKind, nextProvider);
                  return { ...v, kind: nextKind, provider: nextProvider, auth_type: nextAuth };
                })
              }
            >
              <option value="crm">crm</option>
              <option value="llm">llm</option>
              <option value="local_site">local_site</option>
              <option value="other">other</option>
            </select>
            <select
              style={inputStyle}
              aria-label="Provider"
              value={integrationDraft.provider}
              onChange={(e) =>
                setIntegrationDraft((v) => ({
                  ...v,
                  provider: e.target.value,
                  auth_type: getDefaultAuthType(v.kind, e.target.value),
                }))
              }
            >
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
            <select
              style={inputStyle}
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
            <input
              placeholder="Base URL"
              aria-label="Base URL"
              style={inputStyle}
              value={integrationDraft.base_url}
              onChange={(e) => setIntegrationDraft((v) => ({ ...v, base_url: e.target.value }))}
            />
            <input
              placeholder="Detail URL Template"
              aria-label="Detail URL Template"
              style={inputStyle}
              value={integrationDraft.detail_url_template}
              onChange={(e) => setIntegrationDraft((v) => ({ ...v, detail_url_template: e.target.value }))}
            />
          </div>
          {selectedProviderSpec ? (
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#475569" }}>
              {selectedProviderSpec.description}
              {selectedProviderSpec.requiresBaseUrl ? " Base URL ist erforderlich." : " Base URL ist optional."}
            </p>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <button
              style={buttonStyle}
              disabled={busy}
              onClick={() =>
                run("Integration speichern", async () => {
                  await api("/api/partner/integrations", {
                    method: "POST",
                    body: JSON.stringify(integrationDraft),
                  });
                  const nextProvider = getDefaultProviderId(integrationDraft.kind);
                  setIntegrationDraft({
                    kind: integrationDraft.kind,
                    provider: nextProvider,
                    base_url: "",
                    auth_type: getDefaultAuthType(integrationDraft.kind, nextProvider),
                    detail_url_template: "",
                  });
                  await loadAll();
                })
              }
            >
              Integration speichern
            </button>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Kind</th>
                <th style={thStyle}>Provider</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Secrets (write-only)</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => {
                const draft = secretDraft[integration.id] ?? { api_key: "", token: "", secret: "" };
                const settings = (integration.settings ?? {}) as Record<string, unknown>;
                const lastTestedAt = asText(settings.last_tested_at);
                const lastTestStatus = asText(settings.last_test_status);
                const lastTestMessage = asText(settings.last_test_message);
                return (
                  <tr key={integration.id}>
                    <td style={tdStyle}>{integration.kind}</td>
                    <td style={tdStyle}>{integration.provider}</td>
                    <td style={tdStyle}>{integration.is_active ? "aktiv" : "inaktiv"}</td>
                    <td style={tdStyle}>
                      <div style={grid3Style}>
                        <input
                          placeholder="api_key"
                          aria-label={`API Key für ${integration.provider}`}
                          style={inputStyle}
                          value={draft.api_key}
                          onChange={(e) =>
                            setSecretDraft((prev) => ({
                              ...prev,
                              [integration.id]: { ...draft, api_key: e.target.value },
                            }))
                          }
                        />
                        <input
                          placeholder="token"
                          aria-label={`Token für ${integration.provider}`}
                          style={inputStyle}
                          value={draft.token}
                          onChange={(e) =>
                            setSecretDraft((prev) => ({
                              ...prev,
                              [integration.id]: { ...draft, token: e.target.value },
                            }))
                          }
                        />
                        <input
                          placeholder="secret"
                          aria-label={`Secret für ${integration.provider}`}
                          style={inputStyle}
                          value={draft.secret}
                          onChange={(e) =>
                            setSecretDraft((prev) => ({
                              ...prev,
                              [integration.id]: { ...draft, secret: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            style={buttonStyle}
                            disabled={busy}
                            onClick={() =>
                              run("Secrets speichern", async () => {
                                const payload: Record<string, string> = {};
                                if (draft.api_key.trim()) payload.api_key = draft.api_key.trim();
                                if (draft.token.trim()) payload.token = draft.token.trim();
                                if (draft.secret.trim()) payload.secret = draft.secret.trim();
                                if (Object.keys(payload).length === 0) throw new Error("Bitte mindestens ein Secret eingeben.");

                                await api(`/api/partner/integrations/${integration.id}/secrets`, {
                                  method: "POST",
                                  body: JSON.stringify(payload),
                                });
                                setSecretDraft((prev) => ({
                                  ...prev,
                                  [integration.id]: { api_key: "", token: "", secret: "" },
                                }));
                                await loadAll();
                              })
                            }
                          >
                            Secrets speichern
                          </button>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section> : null}
      </div>
    </div>
  );
}

const inlineWrapStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
};

const contentStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "980px",
  margin: "0 auto",
  padding: "0 8px 24px",
};

const statusStyle: React.CSSProperties = {
  margin: "10px 0 14px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  color: "#334155",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
};

const h3Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 10,
  fontSize: 16,
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

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const buttonGhostStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 6px",
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: "8px 6px",
  verticalAlign: "top",
};
