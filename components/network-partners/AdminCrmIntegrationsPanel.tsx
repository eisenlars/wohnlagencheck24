"use client";

import { useEffect, useState } from "react";

type CrmResourceKey = "offers" | "references" | "requests";

type SyncLogPayload = {
  at?: string | null;
  step?: string | null;
  status?: "running" | "ok" | "warning" | "error" | null;
  message?: string | null;
};

type CrmSyncResultPayload = {
  listings_count: number;
  references_count: number;
  requests_count: number;
  offers_count: number;
  deactivated_listings: number;
  deactivated_offers: number;
  skipped: boolean;
  reason?: string;
  notes?: string[];
};

type IntegrationSyncSummary = {
  status: "ok" | "warning" | "error" | "running";
  resource: "offers" | "references" | "requests" | "all";
  mode?: "guarded" | "full" | null;
  message: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastSyncAt?: string | null;
  errorClass?: string | null;
  requestCount?: number | null;
  pagesFetched?: number | null;
  traceId?: string | null;
  step?: string | null;
  heartbeatAt?: string | null;
  deadlineAt?: string | null;
  cancelRequested?: boolean;
  log?: SyncLogPayload[];
  result?: CrmSyncResultPayload | null;
};

type IntegrationPreviewSummary = {
  status: "ok" | "warning" | "error";
  resource: "offers" | "references" | "requests" | "all";
  message: string;
  testedAt?: string | null;
  traceId?: string | null;
};

type CrmSyncWarningBox = {
  title: string;
  cause: string;
  effect: string;
  action: string;
  tone: "warning" | "error";
};

type CrmIntegrationAdminDraft = {
  listingsStatusIds: string;
  referencesArchived: string;
  referencesStatusIds: string;
  referencesCustomFieldKey: string;
  onOfficeReferenceFieldKey: string;
  onOfficeReferenceSoldStatusId: string;
  onOfficeReferenceRentedStatusId: string;
  guardedUnitsTargetObjects: string;
  guardedReferencesTargetObjects: string;
  guardedSavedQueriesTargetObjects: string;
  offersSyncMaxRuntimeSec: string;
  referencesSyncMaxRuntimeSec: string;
  requestsSyncMaxRuntimeSec: string;
  offersAutoSyncEnabled: boolean;
  offersAutoSyncMode: "guarded" | "full";
  offersAutoSyncIntervalMinutes: string;
  offersAutoSyncNightOnly: boolean;
  referencesAutoSyncEnabled: boolean;
  referencesAutoSyncMode: "guarded" | "full";
  referencesAutoSyncIntervalMinutes: string;
  referencesAutoSyncNightOnly: boolean;
  requestsAutoSyncEnabled: boolean;
  requestsAutoSyncMode: "guarded" | "full";
  requestsAutoSyncIntervalMinutes: string;
  requestsAutoSyncNightOnly: boolean;
  requestFreshnessEnabled: boolean;
  requestFreshnessBasis: "source_updated_at" | "last_seen_at";
  requestFreshnessBuyDays: string;
  requestFreshnessRentDays: string;
  requestFreshnessFallbackToLastSeen: boolean;
};

type IntegrationRecord = {
  id: string;
  provider: string;
  is_active: boolean;
};

type OnOfficeFieldOption = {
  value: string;
  label: string;
};

type OnOfficeFieldConfigPayload = {
  estate_status_field_key?: string | null;
  estate_status_field_label?: string | null;
  estate_status_options?: OnOfficeFieldOption[];
  has_reference_status_candidates?: boolean;
};

type AdminCrmIntegrationsPanelProps = {
  integration: IntegrationRecord;
  draft: CrmIntegrationAdminDraft;
  activeResourceKey: CrmResourceKey;
  onActiveResourceChange: (resource: CrmResourceKey) => void;
  onDraftChange: (nextDraft: CrmIntegrationAdminDraft) => void;
  onSaveSettings: (integrationId: string, draft: CrmIntegrationAdminDraft) => void;
  onPreview: (integrationId: string, resource: CrmResourceKey) => void;
  onSync: (integrationId: string, resource: CrmResourceKey, mode: "guarded" | "full") => void;
  onCancelSync: (integrationId: string, resource: CrmResourceKey) => void;
  busy: boolean;
  syncSummary: IntegrationSyncSummary | null;
  previewSummary: IntegrationPreviewSummary | null;
  anotherSyncRunning: boolean;
  syncWarning: CrmSyncWarningBox | null;
};

type DetailModalState = "preview" | "sync" | null;

const resourceKeys: CrmResourceKey[] = ["offers", "references", "requests"];

function formatCrmResourceLabel(resource: CrmResourceKey): string {
  if (resource === "offers") return "Angebote";
  if (resource === "references") return "Referenzen";
  return "Gesuche";
}

function isOnOfficeProvider(provider: string): boolean {
  return String(provider ?? "").trim().toLowerCase() === "onoffice";
}

function formatResourceLabelForProvider(provider: string, resource: CrmResourceKey): string {
  if (resource === "offers" && isOnOfficeProvider(provider)) return "Objekte";
  return formatCrmResourceLabel(resource);
}

function formatAdminDateTime(value: string | null | undefined): string {
  const iso = String(value ?? "").trim();
  if (!iso) return "Noch keiner";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("de-DE");
}

function formatProviderLabel(provider: string): string {
  const normalized = String(provider ?? "").trim().toLowerCase();
  if (normalized === "propstack") return "Propstack";
  if (!normalized) return "CRM";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusLabel(summary: IntegrationSyncSummary | null): string {
  if (!summary) return "Noch kein Lauf";
  if (summary.status === "running") return "Läuft";
  if (summary.status === "ok") return "OK";
  if (summary.status === "warning") return "Achtung";
  return "Fehler";
}

function getStatusColor(summary: IntegrationSyncSummary | null): string {
  if (!summary) return "#475569";
  if (summary.status === "ok") return "#15803d";
  if (summary.status === "warning") return "#b45309";
  if (summary.status === "running") return "#1d4ed8";
  return "#b91c1c";
}

function getPreviewStatusColor(summary: IntegrationPreviewSummary | null): string {
  if (!summary) return "#0f172a";
  if (summary.status === "ok") return "#15803d";
  if (summary.status === "warning") return "#b45309";
  return "#b91c1c";
}

function getResourceResultLabel(
  summary: IntegrationSyncSummary | null,
  resource: CrmResourceKey,
  provider: string,
): string {
  const result = summary?.result;
  if (!result || summary?.mode !== "full") {
    return `Noch kein Vollsync für ${formatResourceLabelForProvider(provider, resource)}`;
  }
  const count =
    resource === "offers"
      ? result.offers_count
      : resource === "references"
        ? result.references_count
        : result.requests_count;
  return `${count} ${formatResourceLabelForProvider(provider, resource)}`;
}

function updateDraft(
  draft: CrmIntegrationAdminDraft,
  patch: Partial<CrmIntegrationAdminDraft>,
): CrmIntegrationAdminDraft {
  return { ...draft, ...patch };
}

function renderImportRules(
  provider: string,
  resourceKey: CrmResourceKey,
  draft: CrmIntegrationAdminDraft,
  onOfficeEstateStatusOptions: OnOfficeFieldOption[],
  onOfficeEstateStatusLoading: boolean,
  onOfficeEstateStatusError: string | null,
  onOfficeEstateStatusFieldKey: string | null,
  onOfficeEstateStatusFieldLabel: string | null,
  onOfficeHasReferenceStatusCandidates: boolean,
  onChange: (nextDraft: CrmIntegrationAdminDraft) => void,
) {
  const onOffice = isOnOfficeProvider(provider);

  if (resourceKey === "offers") {
    return (
      <>
        {onOffice ? (
          <div style={helperTextStyle}>
            Quelle: <code>estate</code>. Optional kannst du den Objektabruf hier auf bestimmte onOffice-Status-IDs begrenzen.
          </div>
        ) : null}
        <label style={labelStyle}>
          {onOffice ? "Status-IDs für Objekte" : "Status-IDs"}
          <input
            style={inputStyle}
            value={draft.listingsStatusIds}
            onChange={(event) => onChange(updateDraft(draft, { listingsStatusIds: event.target.value }))}
            placeholder={onOffice ? "z. B. 1, 2" : "z. B. 274, 276"}
          />
        </label>
      </>
    );
  }

  if (resourceKey === "references") {
    if (onOffice) {
      return (
        <>
          <div style={helperTextStyle}>
            Referenzen werden aus <code>estate</code>-Datensätzen abgeleitet. Dafür nutzt Wohnlagencheck24 die in onOffice gepflegten Objektstatus-IDs für verkauft und vermietet.
          </div>
          {onOfficeEstateStatusFieldKey ? (
            <div style={helperTextStyle}>
              Erkanntes Statusfeld: <code>{onOfficeEstateStatusFieldKey}</code>
              {onOfficeEstateStatusFieldLabel ? ` (${onOfficeEstateStatusFieldLabel})` : ""}
            </div>
          ) : null}
          {onOfficeEstateStatusLoading ? (
            <div style={helperTextStyle}>Statuswerte aus onOffice werden geladen.</div>
          ) : null}
          {onOfficeEstateStatusError ? (
            <div style={helperTextErrorStyle}>{onOfficeEstateStatusError}</div>
          ) : null}
          {!onOfficeEstateStatusLoading && !onOfficeEstateStatusError && onOfficeEstateStatusOptions.length === 0 ? (
            <div style={helperTextErrorStyle}>
              Es konnten keine statusbasierten Auswahlwerte aus onOffice gelesen werden. Bitte vorerst das Feld und die IDs manuell pflegen.
            </div>
          ) : null}
          {onOfficeEstateStatusOptions.length > 0 && !onOfficeHasReferenceStatusCandidates ? (
            <div style={helperTextErrorStyle}>
              Der aktuelle onOffice-Status enthält keine eindeutigen Werte für verkauft oder vermietet. Bitte Referenzstatus vorerst manuell pflegen.
            </div>
          ) : null}
          <label style={labelStyle}>
            Statusfeld für Referenzen
            <input
              style={inputStyle}
              value={draft.onOfficeReferenceFieldKey}
              onChange={(event) => onChange(updateDraft(draft, { onOfficeReferenceFieldKey: event.target.value }))}
              placeholder={onOfficeEstateStatusFieldKey ?? "z. B. status2"}
            />
          </label>
          {onOfficeEstateStatusOptions.length > 0 && onOfficeHasReferenceStatusCandidates ? (
            <>
              <label style={labelStyle}>
                verkauft
                <select
                  style={inputStyle}
                  value={draft.onOfficeReferenceSoldStatusId}
                  onChange={(event) => onChange(updateDraft(draft, { onOfficeReferenceSoldStatusId: event.target.value }))}
                >
                  <option value="">Bitte auswählen</option>
                  {onOfficeEstateStatusOptions.map((option) => (
                    <option key={`sold-${option.value}`} value={option.value}>
                      {option.label} ({option.value})
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                vermietet
                <select
                  style={inputStyle}
                  value={draft.onOfficeReferenceRentedStatusId}
                  onChange={(event) => onChange(updateDraft(draft, { onOfficeReferenceRentedStatusId: event.target.value }))}
                >
                  <option value="">Bitte auswählen</option>
                  {onOfficeEstateStatusOptions.map((option) => (
                    <option key={`rented-${option.value}`} value={option.value}>
                      {option.label} ({option.value})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label style={labelStyle}>
            Objektstatus-ID verkauft
            <input
              style={inputStyle}
              value={draft.onOfficeReferenceSoldStatusId}
              onChange={(event) => onChange(updateDraft(draft, { onOfficeReferenceSoldStatusId: event.target.value }))}
              placeholder="z. B. 5"
            />
          </label>
          <label style={labelStyle}>
            Objektstatus-ID vermietet
            <input
              style={inputStyle}
              value={draft.onOfficeReferenceRentedStatusId}
              onChange={(event) => onChange(updateDraft(draft, { onOfficeReferenceRentedStatusId: event.target.value }))}
              placeholder="z. B. 6"
            />
          </label>
        </>
      );
    }

    return (
      <>
        <label style={labelStyle}>
          Referenz-Archivfilter
          <select
            style={inputStyle}
            value={draft.referencesArchived}
            onChange={(event) => onChange(updateDraft(draft, { referencesArchived: event.target.value }))}
          >
            <option value="">Provider-Default</option>
            <option value="1">Nur archivierte</option>
            <option value="-1">Aktive + archivierte</option>
            <option value="0">Nur aktive</option>
          </select>
        </label>
        <label style={labelStyle}>
          Status-IDs
          <input
            style={inputStyle}
            value={draft.referencesStatusIds}
            onChange={(event) => onChange(updateDraft(draft, { referencesStatusIds: event.target.value }))}
            placeholder="z. B. 274, 311"
          />
        </label>
        <label style={labelStyle}>
          Custom-Field
          <input
            style={inputStyle}
            value={draft.referencesCustomFieldKey}
            onChange={(event) => onChange(updateDraft(draft, { referencesCustomFieldKey: event.target.value }))}
            placeholder="z. B. referenz_webseite"
          />
        </label>
      </>
    );
  }

  return (
    <>
      {onOffice ? (
        <div style={helperTextStyle}>
          Quelle: <code>searchcriteria</code> mit <code>active = 1</code>. Die Freshness-Regel wirkt nach dem API-Abruf auf eure interne Gesuchssicht.
        </div>
      ) : null}
      <label style={{ ...checkboxLabelStyle, marginTop: 2 }}>
        <input
          type="checkbox"
          checked={draft.requestFreshnessEnabled}
          onChange={(event) => onChange(updateDraft(draft, { requestFreshnessEnabled: event.target.checked }))}
        />
        <span>Freshness aktiv</span>
      </label>
      <label style={labelStyle}>
        Freshness-Basis
        <select
          style={inputStyle}
          value={draft.requestFreshnessBasis}
          onChange={(event) => onChange(updateDraft(draft, { requestFreshnessBasis: event.target.value as "source_updated_at" | "last_seen_at" }))}
        >
          <option value="source_updated_at">source_updated_at</option>
          <option value="last_seen_at">last_seen_at</option>
        </select>
      </label>
      <label style={labelStyle}>
        Kauf max_age_days
        <input
          style={inputStyle}
          value={draft.requestFreshnessBuyDays}
          onChange={(event) => onChange(updateDraft(draft, { requestFreshnessBuyDays: event.target.value }))}
          placeholder="z. B. 180"
        />
      </label>
      <label style={labelStyle}>
        Miete max_age_days
        <input
          style={inputStyle}
          value={draft.requestFreshnessRentDays}
          onChange={(event) => onChange(updateDraft(draft, { requestFreshnessRentDays: event.target.value }))}
          placeholder="z. B. 90"
        />
      </label>
      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={draft.requestFreshnessFallbackToLastSeen}
          onChange={(event) => onChange(updateDraft(draft, { requestFreshnessFallbackToLastSeen: event.target.checked }))}
        />
        <span>Fallback auf last_seen_at</span>
      </label>
    </>
  );
}

function renderTestMode(
  provider: string,
  resourceKey: CrmResourceKey,
  draft: CrmIntegrationAdminDraft,
  onChange: (nextDraft: CrmIntegrationAdminDraft) => void,
) {
  const resourceLabel = formatResourceLabelForProvider(provider, resourceKey);

  if (resourceKey === "offers") {
    return (
      <label style={labelStyle}>
        Guarded target_objects für {resourceLabel}
        <input
          style={inputStyle}
          value={draft.guardedUnitsTargetObjects}
          onChange={(event) => onChange(updateDraft(draft, { guardedUnitsTargetObjects: event.target.value }))}
          placeholder="z. B. 100"
        />
      </label>
    );
  }

  if (resourceKey === "references") {
    return (
      <label style={labelStyle}>
        Guarded target_objects für {resourceLabel}
        <input
          style={inputStyle}
          value={draft.guardedReferencesTargetObjects}
          onChange={(event) => onChange(updateDraft(draft, { guardedReferencesTargetObjects: event.target.value }))}
          placeholder="z. B. 100"
        />
      </label>
    );
  }

  return (
    <label style={labelStyle}>
      Guarded target_objects für {resourceLabel}
      <input
        style={inputStyle}
        value={draft.guardedSavedQueriesTargetObjects}
        onChange={(event) => onChange(updateDraft(draft, { guardedSavedQueriesTargetObjects: event.target.value }))}
        placeholder="z. B. 50"
      />
    </label>
  );
}

function renderFullSyncSettings(
  provider: string,
  resourceKey: CrmResourceKey,
  draft: CrmIntegrationAdminDraft,
  onChange: (nextDraft: CrmIntegrationAdminDraft) => void,
) {
  const resourceLabel = formatResourceLabelForProvider(provider, resourceKey);

  if (resourceKey === "offers") {
    return (
      <>
        <label style={labelStyle}>
          Vollsync Timeout für {resourceLabel} (Sek.)
          <input
            style={inputStyle}
            value={draft.offersSyncMaxRuntimeSec}
            onChange={(event) => onChange(updateDraft(draft, { offersSyncMaxRuntimeSec: event.target.value }))}
            placeholder="z. B. 300"
          />
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.offersAutoSyncEnabled}
            onChange={(event) => onChange(updateDraft(draft, { offersAutoSyncEnabled: event.target.checked }))}
          />
          <span>Auto-Sync aktiv</span>
        </label>
        <label style={labelStyle}>
          Auto-Sync Intervall (Min.)
          <input
            style={inputStyle}
            value={draft.offersAutoSyncIntervalMinutes}
            onChange={(event) => onChange(updateDraft(draft, { offersAutoSyncIntervalMinutes: event.target.value }))}
            placeholder="z. B. 60"
          />
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.offersAutoSyncNightOnly}
            onChange={(event) => onChange(updateDraft(draft, { offersAutoSyncNightOnly: event.target.checked }))}
          />
          <span>Nur nachts</span>
        </label>
      </>
    );
  }

  if (resourceKey === "references") {
    return (
      <>
        <label style={labelStyle}>
          Vollsync Timeout für {resourceLabel} (Sek.)
          <input
            style={inputStyle}
            value={draft.referencesSyncMaxRuntimeSec}
            onChange={(event) => onChange(updateDraft(draft, { referencesSyncMaxRuntimeSec: event.target.value }))}
            placeholder="z. B. 300"
          />
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.referencesAutoSyncEnabled}
            onChange={(event) => onChange(updateDraft(draft, { referencesAutoSyncEnabled: event.target.checked }))}
          />
          <span>Auto-Sync aktiv</span>
        </label>
        <label style={labelStyle}>
          Auto-Sync Intervall (Min.)
          <input
            style={inputStyle}
            value={draft.referencesAutoSyncIntervalMinutes}
            onChange={(event) => onChange(updateDraft(draft, { referencesAutoSyncIntervalMinutes: event.target.value }))}
            placeholder="z. B. 1440"
          />
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.referencesAutoSyncNightOnly}
            onChange={(event) => onChange(updateDraft(draft, { referencesAutoSyncNightOnly: event.target.checked }))}
          />
          <span>Nur nachts</span>
        </label>
      </>
    );
  }

  return (
    <>
      <label style={labelStyle}>
        Vollsync Timeout für {resourceLabel} (Sek.)
        <input
          style={inputStyle}
          value={draft.requestsSyncMaxRuntimeSec}
          onChange={(event) => onChange(updateDraft(draft, { requestsSyncMaxRuntimeSec: event.target.value }))}
          placeholder="z. B. 300"
        />
      </label>
      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={draft.requestsAutoSyncEnabled}
          onChange={(event) => onChange(updateDraft(draft, { requestsAutoSyncEnabled: event.target.checked }))}
        />
        <span>Auto-Sync aktiv</span>
      </label>
      <label style={labelStyle}>
        Auto-Sync Intervall (Min.)
        <input
          style={inputStyle}
          value={draft.requestsAutoSyncIntervalMinutes}
          onChange={(event) => onChange(updateDraft(draft, { requestsAutoSyncIntervalMinutes: event.target.value }))}
          placeholder="z. B. 1440"
        />
      </label>
      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={draft.requestsAutoSyncNightOnly}
          onChange={(event) => onChange(updateDraft(draft, { requestsAutoSyncNightOnly: event.target.checked }))}
        />
        <span>Nur nachts</span>
      </label>
    </>
  );
}

export default function AdminCrmIntegrationsPanel({
  integration,
  draft,
  activeResourceKey,
  onActiveResourceChange,
  onDraftChange,
  onSaveSettings,
  onPreview,
  onSync,
  onCancelSync,
  busy,
  syncSummary,
  previewSummary,
  anotherSyncRunning,
  syncWarning,
}: AdminCrmIntegrationsPanelProps) {
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);
  const [onOfficeEstateStatusOptions, setOnOfficeEstateStatusOptions] = useState<OnOfficeFieldOption[]>([]);
  const [onOfficeEstateStatusError, setOnOfficeEstateStatusError] = useState<string | null>(null);
  const [onOfficeEstateStatusFieldKey, setOnOfficeEstateStatusFieldKey] = useState<string | null>(null);
  const [onOfficeEstateStatusFieldLabel, setOnOfficeEstateStatusFieldLabel] = useState<string | null>(null);
  const [onOfficeHasReferenceStatusCandidates, setOnOfficeHasReferenceStatusCandidates] = useState(false);

  const isRunningThisResource = syncSummary?.status === "running";
  const statusColor = getStatusColor(syncSummary);
  const previewStatusColor = getPreviewStatusColor(previewSummary);
  const fullSyncAvailable = syncSummary?.mode === "full";
  const sectionTitle = formatResourceLabelForProvider(integration.provider, activeResourceKey);
  const onOfficeEstateStatusLoading =
    isOnOfficeProvider(integration.provider)
    && onOfficeEstateStatusOptions.length === 0
    && onOfficeEstateStatusError === null;

  useEffect(() => {
    let active = true;
    if (!isOnOfficeProvider(integration.provider)) {
      return () => {
        active = false;
      };
    }

    void fetch(`/api/admin/integrations/${integration.id}/field-config`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null) as ({ error?: string } & OnOfficeFieldConfigPayload) | null;
        if (!res.ok) {
          throw new Error(String(payload?.error ?? `HTTP ${res.status}`));
        }
        if (!active) return;
        setOnOfficeEstateStatusOptions(Array.isArray(payload?.estate_status_options) ? payload.estate_status_options : []);
        setOnOfficeEstateStatusFieldKey(typeof payload?.estate_status_field_key === "string" ? payload.estate_status_field_key : null);
        setOnOfficeEstateStatusFieldLabel(typeof payload?.estate_status_field_label === "string" ? payload.estate_status_field_label : null);
        setOnOfficeHasReferenceStatusCandidates(payload?.has_reference_status_candidates === true);
        setOnOfficeEstateStatusError(null);
        if (!String(draft.onOfficeReferenceFieldKey ?? "").trim() && typeof payload?.estate_status_field_key === "string" && payload.estate_status_field_key.trim()) {
          onDraftChange(updateDraft(draft, { onOfficeReferenceFieldKey: payload.estate_status_field_key }));
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOnOfficeEstateStatusOptions([]);
        setOnOfficeEstateStatusFieldKey(null);
        setOnOfficeEstateStatusFieldLabel(null);
        setOnOfficeHasReferenceStatusCandidates(false);
        setOnOfficeEstateStatusError(error instanceof Error ? error.message : "Statuswerte konnten nicht geladen werden.");
      })
      .finally(() => {
        return undefined;
      });

    return () => {
      active = false;
    };
  }, [draft.onOfficeReferenceFieldKey, integration.id, integration.provider, onDraftChange]);

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={panelTitleStyle}>Anbindung · {formatProviderLabel(integration.provider)}</div>
          <div style={resourceTabBarStyle}>
            {resourceKeys.map((resourceKey) => {
              const active = activeResourceKey === resourceKey;
              return (
                <button
                  key={`${integration.id}-${resourceKey}`}
                  type="button"
                  onClick={() => onActiveResourceChange(resourceKey)}
                  style={resourceTabButtonStyle(active)}
                >
                  {formatResourceLabelForProvider(integration.provider, resourceKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={resourceCardStyle}>
        <div style={resourceTitleStyle}>{sectionTitle}</div>

        <section style={blockStyle}>
          <h3 style={blockTitleStyle}>Sync-Status</h3>
          <div style={statusGridStyle}>
            <div style={statusCardStyle}>
              <div style={statusCardLabelStyle}>Status</div>
              <div style={{ ...statusCardValueStyle, color: statusColor }}>{getStatusLabel(syncSummary)}</div>
            </div>
            <div style={statusCardStyle}>
              <div style={statusCardLabelStyle}>Letzter Test</div>
              <div style={{ ...statusCardValueStyle, color: previewStatusColor }}>
                {formatAdminDateTime(previewSummary?.testedAt)}
              </div>
            </div>
            <div style={statusCardStyle}>
              <div style={statusCardLabelStyle}>Letzter Voll-Sync</div>
              <div style={statusCardValueStyle}>
                {fullSyncAvailable ? formatAdminDateTime(syncSummary?.finishedAt) : "Noch keiner"}
              </div>
            </div>
            <div style={statusCardStyle}>
              <div style={statusCardLabelStyle}>Sync-Ergebnis</div>
              <div style={statusCardValueStyle}>
                {getResourceResultLabel(syncSummary, activeResourceKey, integration.provider)}
              </div>
            </div>
          </div>
          {syncWarning ? (
            <div style={warningBoxStyle(syncWarning.tone)}>
              <div style={warningTitleStyle(syncWarning.tone)}>{syncWarning.title}</div>
              <div style={warningTextStyle}><strong>Ursache:</strong> {syncWarning.cause}</div>
              <div style={warningTextStyle}><strong>Wirkung:</strong> {syncWarning.effect}</div>
              <div style={warningTextStyle}><strong>Nächster Schritt:</strong> {syncWarning.action}</div>
            </div>
          ) : null}
        </section>

        <section style={blockStyle}>
          <h3 style={blockTitleStyle}>Einstellungen</h3>
          <div style={settingsGridStyle}>
            <div style={settingsCardStyle}>
              <div style={settingsCardTitleStyle}>Importregeln</div>
              <div style={settingsFieldsStyle}>
                {renderImportRules(
                  integration.provider,
                  activeResourceKey,
                  draft,
                  onOfficeEstateStatusOptions,
                  onOfficeEstateStatusLoading,
                  onOfficeEstateStatusError,
                  onOfficeEstateStatusFieldKey,
                  onOfficeEstateStatusFieldLabel,
                  onOfficeHasReferenceStatusCandidates,
                  onDraftChange,
                )}
              </div>
            </div>
            <div style={settingsCardStyle}>
              <div style={settingsCardTitleStyle}>Testmodus</div>
              <div style={settingsFieldsStyle}>
                {renderTestMode(integration.provider, activeResourceKey, draft, onDraftChange)}
              </div>
            </div>
            <div style={settingsCardStyle}>
              <div style={settingsCardTitleStyle}>Vollsynchronisation</div>
              <div style={settingsFieldsStyle}>
                {renderFullSyncSettings(integration.provider, activeResourceKey, draft, onDraftChange)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              style={btnStyle}
              disabled={busy}
              onClick={() => onSaveSettings(integration.id, draft)}
            >
              Einstellungen speichern
            </button>
          </div>
        </section>

        <section style={blockStyle}>
          <h3 style={blockTitleStyle}>Aktionen</h3>
          {anotherSyncRunning ? (
            <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
              Andere Ressource läuft gerade.
            </div>
          ) : null}
          <div style={actionRowStyle}>
            <button
              type="button"
              style={btnGhostStyle}
              disabled={busy || !integration.is_active || anotherSyncRunning}
              onClick={() => onPreview(integration.id, activeResourceKey)}
            >
              Abruf testen
            </button>
            <button
              type="button"
              style={btnGhostStyle}
              disabled={busy || !integration.is_active || anotherSyncRunning || isRunningThisResource}
              onClick={() => onSync(integration.id, activeResourceKey, "guarded")}
            >
              {isRunningThisResource && syncSummary?.mode === "guarded" ? "Guarded-Sync läuft..." : "Guarded-Sync"}
            </button>
            <button
              type="button"
              style={btnDangerStyle}
              disabled={busy || !integration.is_active || anotherSyncRunning || isRunningThisResource}
              onClick={() => onSync(integration.id, activeResourceKey, "full")}
            >
              Vollsync
            </button>
            {isRunningThisResource ? (
              <button
                type="button"
                style={btnGhostStyle}
                disabled={busy}
                onClick={() => onCancelSync(integration.id, activeResourceKey)}
              >
                Synchronisierung abbrechen
              </button>
            ) : null}
          </div>
          <div style={detailLinkRowStyle}>
            <button
              type="button"
              style={detailLinkStyle(Boolean(previewSummary))}
              disabled={!previewSummary}
              onClick={() => setDetailModal("preview")}
            >
              Test Details
            </button>
            <button
              type="button"
              style={detailLinkStyle(Boolean(fullSyncAvailable))}
              disabled={!fullSyncAvailable}
              onClick={() => setDetailModal("sync")}
            >
              Vollsync Details
            </button>
          </div>
        </section>
      </div>

      {detailModal === "preview" && previewSummary ? (
        <div role="dialog" aria-modal="true" style={modalOverlayStyle} onClick={() => setDetailModal(null)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={modalTitleStyle}>Letzter {sectionTitle}-Abruf-Test</div>
            <div style={modalBodyStyle}>
              <p style={modalParagraphStyle}>{previewSummary.message}</p>
              <p style={modalParagraphStyle}>Zuletzt getestet: {formatAdminDateTime(previewSummary.testedAt)}</p>
              {previewSummary.traceId ? (
                <p style={{ ...modalParagraphStyle, wordBreak: "break-all" }}>Trace-ID: {previewSummary.traceId}</p>
              ) : null}
            </div>
            <div style={modalFooterStyle}>
              <button type="button" style={btnGhostStyle} onClick={() => setDetailModal(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailModal === "sync" && fullSyncAvailable && syncSummary ? (
        <div role="dialog" aria-modal="true" style={modalOverlayStyle} onClick={() => setDetailModal(null)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={modalTitleStyle}>Letzter {sectionTitle}-Vollsync</div>
            <div style={modalBodyStyle}>
              <p style={modalParagraphStyle}>
                Vollsync: mit Stale-Deaktivierung, sofern der Fetch nicht an Safety-Limits abgeschnitten wurde.
              </p>
              <p style={modalParagraphStyle}>
                {getResourceResultLabel(syncSummary, activeResourceKey, integration.provider)}
              </p>
              {syncSummary.step ? (
                <p style={modalParagraphStyle}>
                  Aktueller Schritt: {syncSummary.step}
                  {syncSummary.cancelRequested ? " · Abbruch angefordert" : ""}
                </p>
              ) : null}
              {syncSummary.heartbeatAt ? (
                <p style={modalParagraphStyle}>Letzter Heartbeat: {formatAdminDateTime(syncSummary.heartbeatAt)}</p>
              ) : null}
              {(typeof syncSummary.requestCount === "number" || typeof syncSummary.pagesFetched === "number") ? (
                <p style={modalParagraphStyle}>
                  Provider-Last: {typeof syncSummary.requestCount === "number" ? `${syncSummary.requestCount} Requests` : "0 Requests"}
                  {typeof syncSummary.pagesFetched === "number" ? ` · ${syncSummary.pagesFetched} Seiten` : ""}
                </p>
              ) : null}
              {syncSummary.traceId ? (
                <p style={{ ...modalParagraphStyle, wordBreak: "break-all" }}>Trace-ID: {syncSummary.traceId}</p>
              ) : null}

              {Array.isArray(syncSummary.result?.notes) && syncSummary.result.notes.length > 0 ? (
                <div style={modalSectionStyle}>
                  <div style={modalSectionTitleStyle}>Sync-Notes</div>
                  {syncSummary.result.notes.slice(0, 8).map((note, index) => (
                    <p key={`sync-note-${activeResourceKey}-${index}`} style={modalParagraphStyle}>{note}</p>
                  ))}
                </div>
              ) : null}

              {Array.isArray(syncSummary.log) && syncSummary.log.length > 0 ? (
                <div style={modalSectionStyle}>
                  <div style={modalSectionTitleStyle}>Sync-Debug</div>
                  {syncSummary.log.slice(-8).map((entry, index) => (
                    <p key={`${entry.at ?? "log"}-${entry.step ?? "step"}-${index}`} style={modalParagraphStyle}>
                      {entry.at ? new Date(entry.at).toLocaleTimeString("de-DE") : "--:--:--"} · {entry.step ?? "step"} · {entry.message ?? ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={modalFooterStyle}>
              <button type="button" style={btnGhostStyle} onClick={() => setDetailModal(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#f8fbff",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
};

const resourceTabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const resourceTabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 999,
  border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
  background: active ? "#dbeafe" : "#fff",
  color: active ? "#1d4ed8" : "#334155",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const resourceCardStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#fff",
  display: "grid",
  gap: 16,
};

const resourceTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#0f172a",
};

const blockStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const blockTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
};

const statusGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
};

const statusCardStyle: React.CSSProperties = {
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #e2e8f0",
  padding: 12,
  minHeight: 84,
};

const statusCardLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  marginBottom: 6,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const statusCardValueStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
  lineHeight: 1.4,
};

const warningBoxStyle = (tone: "warning" | "error"): React.CSSProperties => ({
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${tone === "error" ? "#fca5a5" : "#fcd34d"}`,
  background: tone === "error" ? "#fef2f2" : "#fffbeb",
});

const warningTitleStyle = (tone: "warning" | "error"): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 800,
  color: tone === "error" ? "#b91c1c" : "#b45309",
  marginBottom: 8,
});

const warningTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#334155",
  lineHeight: 1.5,
  marginTop: 4,
};

const settingsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const settingsCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const settingsCardTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a",
};

const settingsFieldsStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#475569",
};

const helperTextErrorStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#b91c1c",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "#334155",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  width: "100%",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const detailLinkRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const detailLinkStyle = (enabled: boolean): React.CSSProperties => ({
  border: "none",
  background: "transparent",
  color: enabled ? "#0f766e" : "#94a3b8",
  fontWeight: 700,
  padding: 0,
  cursor: enabled ? "pointer" : "not-allowed",
  textDecoration: "underline",
});

const btnStyle: React.CSSProperties = {
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const btnGhostStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const btnDangerStyle: React.CSSProperties = {
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#b91c1c",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 1000,
};

const modalCardStyle: React.CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "80vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.2)",
  padding: 20,
  display: "grid",
  gap: 14,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const modalBodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const modalParagraphStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#334155",
  lineHeight: 1.55,
};

const modalSectionStyle: React.CSSProperties = {
  marginTop: 4,
  padding: 12,
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: 6,
};

const modalSectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#334155",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};
