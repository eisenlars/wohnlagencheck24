export type IntegrationKind = "crm" | "llm" | "local_site" | "other";

export type IntegrationProviderSpec = {
  id: string;
  label: string;
  kind: IntegrationKind;
  description: string;
  authTypes: string[];
  defaultAuthType?: string;
  requiresBaseUrl: boolean;
};

export const INTEGRATION_PROVIDER_SPECS: IntegrationProviderSpec[] = [
  {
    id: "propstack",
    label: "Propstack API",
    kind: "crm",
    description: "REST API fuer Objekt- und Marktdaten.",
    authTypes: ["api_key"],
    defaultAuthType: "api_key",
    requiresBaseUrl: true,
  },
  {
    id: "onoffice",
    label: "onOffice API",
    kind: "crm",
    description: "onOffice API-Integration mit Token + Secret (HMAC).",
    authTypes: ["basic"],
    defaultAuthType: "basic",
    requiresBaseUrl: true,
  },
  {
    id: "openimmo",
    label: "OpenImmo Feed",
    kind: "crm",
    description: "OpenImmo Import ueber URL/Feed-Konfiguration.",
    authTypes: ["none", "token", "basic"],
    defaultAuthType: "none",
    requiresBaseUrl: false,
  },
  {
    id: "flowfact",
    label: "FLOWFACT API",
    kind: "crm",
    description: "FLOWFACT REST-API fuer Objekte und Kontaktprozesse.",
    authTypes: ["api_key", "bearer", "token"],
    defaultAuthType: "api_key",
    requiresBaseUrl: true,
  },
  {
    id: "generic_crm",
    label: "Generic CRM",
    kind: "crm",
    description: "Fallback fuer andere CRM-Anbieter.",
    authTypes: ["api_key", "token", "bearer", "basic", "none"],
    defaultAuthType: "api_key",
    requiresBaseUrl: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "llm",
    description: "LLM-Provider fuer Textaufbereitung.",
    authTypes: ["api_key"],
    defaultAuthType: "api_key",
    requiresBaseUrl: false,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "llm",
    description: "LLM-Provider fuer Textaufbereitung.",
    authTypes: ["api_key"],
    defaultAuthType: "api_key",
    requiresBaseUrl: false,
  },
  {
    id: "azure_openai",
    label: "Azure OpenAI",
    kind: "llm",
    description: "Azure OpenAI Endpoint mit API-Key.",
    authTypes: ["api_key"],
    defaultAuthType: "api_key",
    requiresBaseUrl: true,
  },
  {
    id: "google_gemini",
    label: "Google Gemini",
    kind: "llm",
    description: "Gemini API fuer textbasierte LLM-Workflows.",
    authTypes: ["api_key"],
    defaultAuthType: "api_key",
    requiresBaseUrl: false,
  },
  {
    id: "mistral",
    label: "Mistral",
    kind: "llm",
    description: "Mistral API fuer textbasierte LLM-Workflows.",
    authTypes: ["api_key", "bearer"],
    defaultAuthType: "api_key",
    requiresBaseUrl: false,
  },
  {
    id: "generic_llm",
    label: "Generic LLM",
    kind: "llm",
    description: "Fallback fuer sonstige LLM-Anbieter.",
    authTypes: ["api_key", "token", "bearer", "none"],
    defaultAuthType: "api_key",
    requiresBaseUrl: false,
  },
  {
    id: "local_site",
    label: "Local Site",
    kind: "local_site",
    description: "Bridge zur lokalen Website-Integration.",
    authTypes: ["token"],
    defaultAuthType: "token",
    requiresBaseUrl: true,
  },
  {
    id: "generic_other",
    label: "Generic Other",
    kind: "other",
    description: "Sonstige Integrationen.",
    authTypes: ["none", "api_key", "token", "bearer", "basic"],
    defaultAuthType: "none",
    requiresBaseUrl: false,
  },
];

export function getProviderSpec(providerId: string | null | undefined): IntegrationProviderSpec | null {
  const normalized = String(providerId ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return INTEGRATION_PROVIDER_SPECS.find((spec) => spec.id === normalized) ?? null;
}

export function getProvidersForKind(kind: string | null | undefined): IntegrationProviderSpec[] {
  const normalized = String(kind ?? "").trim().toLowerCase();
  return INTEGRATION_PROVIDER_SPECS.filter((spec) => spec.kind === normalized);
}

type ValidateInput = {
  kind: string;
  provider: string;
  authType?: string | null;
  baseUrl?: string | null;
};

export function validateIntegrationConfig(input: ValidateInput):
  | { ok: true; authType: string | null; provider: string; baseUrl: string | null }
  | { ok: false; error: string } {
  const kind = String(input.kind ?? "").trim().toLowerCase();
  const provider = String(input.provider ?? "").trim().toLowerCase();
  const baseUrl = String(input.baseUrl ?? "").trim() || null;
  const spec = getProviderSpec(provider);
  if (!spec) {
    return { ok: false, error: "Unknown provider" };
  }
  if (spec.kind !== kind) {
    return { ok: false, error: `Provider '${provider}' does not match kind '${kind}'` };
  }

  let authType = String(input.authType ?? "").trim().toLowerCase() || null;
  if (!authType) {
    authType = spec.defaultAuthType ?? (spec.authTypes.length === 1 ? spec.authTypes[0] : null);
  }
  if (authType && !spec.authTypes.includes(authType)) {
    return { ok: false, error: `Invalid auth_type '${authType}' for provider '${provider}'` };
  }
  if (spec.requiresBaseUrl && !baseUrl) {
    return { ok: false, error: `base_url is required for provider '${provider}'` };
  }

  return {
    ok: true,
    authType,
    provider,
    baseUrl,
  };
}
