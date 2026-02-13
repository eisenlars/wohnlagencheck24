"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getProviderSpec, getProvidersForKind } from "@/lib/integrations/providers";

type Partner = {
  id: string;
  company_name: string;
  contact_email?: string | null;
  contact_person?: string | null;
  website_url?: string | null;
  is_active?: boolean;
};

type AreaMapping = {
  id: string;
  auth_user_id: string;
  area_id: string;
  is_active: boolean;
  areas?: {
    name?: string | null;
    slug?: string | null;
    parent_slug?: string | null;
    bundesland_slug?: string | null;
  } | null;
};

type Integration = {
  id: string;
  partner_id: string;
  kind: string;
  provider: string;
  base_url?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, unknown> | null;
  detail_url_template?: string | null;
  is_active: boolean;
  settings?: Record<string, unknown> | null;
  last_sync_at?: string | null;
};

type AreaOption = {
  id: string;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type AuditLogRow = {
  id: string;
  actor_user_id?: string | null;
  actor_role: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
};

type DisplayAreaRow = {
  key: string;
  displayKreisId: string;
  mapping: AreaMapping;
  derivedFromOrtslagen: boolean;
  sourceCount: number;
};

type AreaOverviewRow = {
  key: string;
  kreisId: string;
  kreisName: string;
  partnerId: string;
  partnerName: string;
  isActive: boolean;
};

type AdminView = "new_partner" | "partner_edit" | "partner_integrations" | "audit";
type AdminNavMode = "partners" | "areas";

type HandoverApiResponse = {
  ok?: boolean;
  handover?: {
    area_id?: string;
    area_name?: string;
    old_partner?: { id?: string; company_name?: string };
    new_partner?: { id?: string; company_name?: string };
    deactivate_old_partner_requested?: boolean;
    deactivate_old_partner_applied?: boolean;
    deactivate_old_partner_skipped_reason?: string | null;
    deactivate_old_integrations?: boolean;
  };
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

export default function AdminClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [areaMappings, setAreaMappings] = useState<AreaMapping[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [status, setStatus] = useState<string>("Lade Admin-Daten...");
  const [busy, setBusy] = useState<boolean>(false);
  const [areaQuery, setAreaQuery] = useState<string>("");
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>([]);

  const [createPartner, setCreatePartner] = useState({
    company_name: "",
    contact_email: "",
    contact_person: "",
    website_url: "",
  });

  const [editPartner, setEditPartner] = useState({
    company_name: "",
    contact_email: "",
    contact_person: "",
    website_url: "",
    is_active: true,
  });

  const [assignAreaId, setAssignAreaId] = useState("");
  const [handoverDraft, setHandoverDraft] = useState({
    area_id: "",
    new_partner_id: "",
    deactivate_old_partner: false,
    deactivate_old_integrations: true,
  });

  const [createIntegration, setCreateIntegration] = useState({
    kind: "crm",
    provider: getDefaultProviderId("crm"),
    base_url: "",
    auth_type: getDefaultAuthType("crm", getDefaultProviderId("crm")),
    detail_url_template: "",
    is_active: true,
  });
  const providerOptions = useMemo(() => getProvidersForKind(createIntegration.kind), [createIntegration.kind]);
  const selectedProviderSpec = useMemo(
    () => getProviderSpec(createIntegration.provider) ?? providerOptions[0] ?? null,
    [createIntegration.provider, providerOptions],
  );

  const [secretDraft, setSecretDraft] = useState<Record<string, { api_key: string; token: string; secret: string }>>(
    {},
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [areaOverview, setAreaOverview] = useState<AreaOverviewRow[]>([]);
  const [activeView, setActiveView] = useState<AdminView>("partner_edit");
  const [navMode, setNavMode] = useState<AdminNavMode>("partners");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [onlyActiveList, setOnlyActiveList] = useState(true);
  const [successModal, setSuccessModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });
  const [handoverConfirmModal, setHandoverConfirmModal] = useState<{
    open: boolean;
    areaId: string;
    oldPartnerId: string;
    newPartnerId: string;
    deactivateOldPartner: boolean;
    deactivateOldIntegrations: boolean;
  }>({
    open: false,
    areaId: "",
    oldPartnerId: "",
    newPartnerId: "",
    deactivateOldPartner: false,
    deactivateOldIntegrations: true,
  });
  const [handoverStatusModal, setHandoverStatusModal] = useState<{
    open: boolean;
    title: string;
    lines: string[];
    done: boolean;
    hasError: boolean;
  }>({
    open: false,
    title: "",
    lines: [],
    done: false,
    hasError: false,
  });
  const [auditFilters, setAuditFilters] = useState({
    entity_type: "",
    event_type: "",
    actor_user_id: "",
    created_from: "",
    created_to: "",
    limit: 100,
  });
  const successModalRef = useRef<HTMLDivElement | null>(null);
  const handoverConfirmModalRef = useRef<HTMLDivElement | null>(null);
  const handoverStatusModalRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const anyModalOpen =
      successModal.open || handoverConfirmModal.open || handoverStatusModal.open;

    if (anyModalOpen) {
      if (!lastFocusedElementRef.current && document.activeElement instanceof HTMLElement) {
        lastFocusedElementRef.current = document.activeElement;
      }
      const target =
        (successModal.open ? successModalRef.current : null) ??
        (handoverConfirmModal.open ? handoverConfirmModalRef.current : null) ??
        (handoverStatusModal.open ? handoverStatusModalRef.current : null);
      if (target) {
        window.setTimeout(() => target.focus(), 0);
      }
      return;
    }

    if (lastFocusedElementRef.current) {
      lastFocusedElementRef.current.focus();
      lastFocusedElementRef.current = null;
    }
  }, [successModal.open, handoverConfirmModal.open, handoverStatusModal.open]);

  const selectedPartnerLabel = selectedPartner
    ? `${selectedPartner.company_name} (${selectedPartner.id})`
    : "Kein Partner ausgewählt";

  const filteredPartners = useMemo(() => {
    const q = partnerFilter.trim().toLowerCase();
    return partners.filter((p) => {
      if (onlyActiveList && !p.is_active) return false;
      if (!q) return true;
      const hay = [
        p.company_name ?? "",
        p.contact_email ?? "",
        p.id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [partners, partnerFilter, onlyActiveList]);

  const filteredAreaOverview = useMemo(() => {
    const q = areaFilter.trim().toLowerCase();
    return areaOverview.filter((row) => {
      if (onlyActiveList && !row.isActive) return false;
      if (!q) return true;
      const hay = [
        row.kreisName,
        row.kreisId,
        row.partnerName,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [areaOverview, areaFilter, onlyActiveList]);

  async function loadAreaOverview(partnerList?: Partner[]) {
    const source = partnerList ?? partners;
    if (!source.length) {
      setAreaOverview([]);
      return;
    }

    const details = await Promise.all(
      source.map(async (partner) => {
        try {
          const data = await api<{ area_mappings: AreaMapping[] }>(`/api/admin/partners/${partner.id}`);
          return { partner, mappings: data.area_mappings ?? [] };
        } catch {
          return { partner, mappings: [] as AreaMapping[] };
        }
      }),
    );

    const rows = new Map<string, AreaOverviewRow>();
    for (const detail of details) {
      for (const mapping of detail.mappings) {
        const kreisId = String(mapping.area_id ?? "").split("-").slice(0, 3).join("-");
        if (kreisId.split("-").length !== 3) continue;
        const key = `${detail.partner.id}:${kreisId}`;
        if (rows.has(key)) continue;
        rows.set(key, {
          key,
          kreisId,
          kreisName: String(mapping.areas?.name ?? kreisId),
          partnerId: detail.partner.id,
          partnerName: detail.partner.company_name,
          isActive: Boolean(mapping.is_active),
        });
      }
    }

    setAreaOverview(
      Array.from(rows.values()).sort((a, b) => {
        const byKreis = a.kreisId.localeCompare(b.kreisId, "de");
        if (byKreis !== 0) return byKreis;
        return a.partnerName.localeCompare(b.partnerName, "de");
      }),
    );
  }

  const displayAreaRows = useMemo<DisplayAreaRow[]>(() => {
    const getKreisId = (areaId: string) =>
      String(areaId ?? "")
        .split("-")
        .slice(0, 3)
        .join("-");

    const kreisLevel = areaMappings.filter((m) => String(m.area_id ?? "").split("-").length <= 3);
    if (kreisLevel.length > 0) {
      return kreisLevel.map((mapping) => ({
        key: mapping.id,
        displayKreisId: mapping.area_id,
        mapping,
        derivedFromOrtslagen: false,
        sourceCount: 1,
      }));
    }

    const byKreis = new Map<string, { mapping: AreaMapping; count: number }>();
    for (const mapping of areaMappings) {
      const kreisId = getKreisId(mapping.area_id) || mapping.area_id;
      const existing = byKreis.get(kreisId);
      if (!existing) {
        byKreis.set(kreisId, { mapping, count: 1 });
      } else {
        byKreis.set(kreisId, { mapping: existing.mapping, count: existing.count + 1 });
      }
    }

    return Array.from(byKreis.entries()).map(([kreisId, value]) => ({
      key: `${kreisId}:${value.mapping.id}`,
      displayKreisId: kreisId,
      mapping: value.mapping,
      derivedFromOrtslagen: true,
      sourceCount: value.count,
    }));
  }, [areaMappings]);

  const handoverAreaOptions = useMemo(
    () => displayAreaRows.map((row) => ({ id: row.displayKreisId, label: row.mapping.areas?.name ?? row.displayKreisId })),
    [displayAreaRows],
  );
  const handoverNewPartnerOptions = useMemo(
    () => partners.filter((p) => p.id !== selectedPartnerId),
    [partners, selectedPartnerId],
  );
  const handoverTargetPartner = useMemo(
    () => partners.find((p) => p.id === handoverDraft.new_partner_id) ?? null,
    [partners, handoverDraft.new_partner_id],
  );

  async function loadPartners(selectId?: string) {
    const data = await api<{ partners: Partner[] }>("/api/admin/partners?include_inactive=1");
    setPartners(data.partners ?? []);
    await loadAreaOverview(data.partners ?? []);

    const nextId = selectId ?? selectedPartnerId ?? data.partners?.[0]?.id ?? "";
    if (nextId) {
      setSelectedPartnerId(nextId);
      await loadPartnerDetails(nextId);
    } else {
      setSelectedPartner(null);
      setAreaMappings([]);
      setIntegrations([]);
    }
  }

  async function loadPartnerDetails(partnerId: string) {
    if (!partnerId) return;
    const [partnerData, integrationsData] = await Promise.all([
      api<{ partner: Partner; area_mappings: AreaMapping[] }>(`/api/admin/partners/${partnerId}`),
      api<{ integrations: Integration[] }>(`/api/admin/partners/${partnerId}/integrations`),
    ]);
    setSelectedPartner(partnerData.partner);
    setAreaMappings(partnerData.area_mappings ?? []);
    setIntegrations(integrationsData.integrations ?? []);
    setEditPartner({
      company_name: partnerData.partner.company_name ?? "",
      contact_email: partnerData.partner.contact_email ?? "",
      contact_person: partnerData.partner.contact_person ?? "",
      website_url: partnerData.partner.website_url ?? "",
      is_active: Boolean(partnerData.partner.is_active),
    });
  }

  async function loadAuditLogs() {
    const params = new URLSearchParams();
    if (auditFilters.entity_type.trim()) params.set("entity_type", auditFilters.entity_type.trim());
    if (auditFilters.event_type.trim()) params.set("event_type", auditFilters.event_type.trim());
    if (auditFilters.actor_user_id.trim()) params.set("actor_user_id", auditFilters.actor_user_id.trim());
    if (auditFilters.created_from.trim()) params.set("created_from", auditFilters.created_from.trim());
    if (auditFilters.created_to.trim()) params.set("created_to", auditFilters.created_to.trim());
    params.set("limit", String(auditFilters.limit));

    const data = await api<{ logs: AuditLogRow[] }>(`/api/admin/audit-log?${params.toString()}`);
    setAuditLogs(data.logs ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadPartners();
        await loadAuditLogs();
        setStatus("Admin-Bereich bereit.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Fehler beim Laden");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!areaQuery.trim()) {
      setAreaOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api<{ areas: AreaOption[] }>(
          `/api/admin/areas?q=${encodeURIComponent(areaQuery)}&limit=20`,
        );
        setAreaOptions(data.areas ?? []);
      } catch {
        setAreaOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [areaQuery]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
      setStatus(`${label} erfolgreich.`);
      setSuccessModal({
        open: true,
        title: "Erfolgreich",
        message: `${label} wurde erfolgreich ausgefuehrt.`,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} fehlgeschlagen.`);
    } finally {
      setBusy(false);
    }
  }

  async function selectPartnerView(partnerId: string, view: AdminView) {
    if (!partnerId) return;
    setBusy(true);
    setStatus("Partner wird geladen...");
    try {
      setSelectedPartnerId(partnerId);
      await loadPartnerDetails(partnerId);
      setActiveView(view);
      setStatus("Partner geladen.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Partner konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function executeHandoverWithStatus(input: {
    areaId: string;
    oldPartnerId: string;
    newPartnerId: string;
    deactivateOldPartner: boolean;
    deactivateOldIntegrations: boolean;
  }) {
    setBusy(true);
    setHandoverStatusModal({
      open: true,
      title: "Gebietsübergabe läuft",
      lines: [
        `Kreis: ${input.areaId}`,
        "1/4 Übergabe auf Server starten...",
      ],
      done: false,
      hasError: false,
    });
    try {
      const result = await api<HandoverApiResponse>("/api/admin/handovers", {
        method: "POST",
        body: JSON.stringify({
          area_id: input.areaId,
          old_partner_id: input.oldPartnerId,
          new_partner_id: input.newPartnerId,
          deactivate_old_partner: input.deactivateOldPartner,
          deactivate_old_integrations: input.deactivateOldIntegrations,
        }),
      });
      setHandoverStatusModal((m) => ({
        ...m,
        lines: [
          ...m.lines,
          "2/4 Server-Übergabe abgeschlossen.",
          `Partner alt deaktiviert: ${result.handover?.deactivate_old_partner_applied ? "Ja" : "Nein"}`,
          result.handover?.deactivate_old_partner_skipped_reason
            ? `Hinweis: ${result.handover.deactivate_old_partner_skipped_reason}`
            : "Hinweis: Kein Skip-Grund.",
          "3/4 Partner- und Gebietsübersicht aktualisieren...",
        ],
      }));

      await loadPartners(input.newPartnerId);
      setHandoverStatusModal((m) => ({
        ...m,
        lines: [...m.lines, "4/4 Audit-Log aktualisieren..."],
      }));
      await loadAuditLogs();
      setHandoverDraft({
        area_id: "",
        new_partner_id: "",
        deactivate_old_partner: false,
        deactivate_old_integrations: true,
      });

      setHandoverStatusModal((m) => ({
        ...m,
        title: "Gebietsübergabe abgeschlossen",
        lines: [
          ...m.lines,
          `Ergebnis: ${result.handover?.area_id ?? input.areaId} wurde erfolgreich übertragen.`,
        ],
        done: true,
      }));
      setStatus("Gebietsübergabe erfolgreich.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setHandoverStatusModal((m) => ({
        ...m,
        title: "Gebietsübergabe fehlgeschlagen",
        lines: [...m.lines, `Fehler: ${message}`],
        done: true,
        hasError: true,
      }));
      setStatus(`Gebietsübergabe fehlgeschlagen: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrapStyle}>
      {successModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => setSuccessModal((v) => ({ ...v, open: false }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSuccessModal((v) => ({ ...v, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={successModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
            aria-describedby="success-modal-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="success-modal-title" style={modalTitleStyle}>{successModal.title}</h3>
            <p id="success-modal-message" style={modalMessageStyle}>{successModal.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                style={btnStyle}
                onClick={() => setSuccessModal((v) => ({ ...v, open: false }))}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {handoverConfirmModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => setHandoverConfirmModal((v) => ({ ...v, open: false }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setHandoverConfirmModal((v) => ({ ...v, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={handoverConfirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="handover-confirm-title"
            aria-describedby="handover-confirm-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="handover-confirm-title" style={modalTitleStyle}>Gebietsübergabe bestätigen</h3>
            <p id="handover-confirm-message" style={modalMessageStyle}>
              Kreis <strong>{handoverConfirmModal.areaId}</strong> wird von
              {" "}
              <strong>{selectedPartner?.company_name ?? handoverConfirmModal.oldPartnerId}</strong>
              {" "}an{" "}
              <strong>{partners.find((p) => p.id === handoverConfirmModal.newPartnerId)?.company_name ?? handoverConfirmModal.newPartnerId}</strong>
              {" "}übergeben.
            </p>
            <p style={{ ...modalMessageStyle, marginTop: -4 }}>
              Integrationen alt deaktivieren: {handoverConfirmModal.deactivateOldIntegrations ? "Ja" : "Nein"} | Partner alt deaktivieren: {handoverConfirmModal.deactivateOldPartner ? "Ja" : "Nein"}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={btnGhostStyle}
                onClick={() => setHandoverConfirmModal((v) => ({ ...v, open: false }))}
              >
                Abbrechen
              </button>
              <button
                style={btnDangerStyle}
                onClick={() => {
                  const payload = handoverConfirmModal;
                  setHandoverConfirmModal((v) => ({ ...v, open: false }));
                  executeHandoverWithStatus({
                    areaId: payload.areaId,
                    oldPartnerId: payload.oldPartnerId,
                    newPartnerId: payload.newPartnerId,
                    deactivateOldPartner: payload.deactivateOldPartner,
                    deactivateOldIntegrations: payload.deactivateOldIntegrations,
                  });
                }}
              >
                Übergabe jetzt ausführen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {handoverStatusModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            if (!handoverStatusModal.done) return;
            setHandoverStatusModal((m) => ({ ...m, open: false }));
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || !handoverStatusModal.done) return;
            setHandoverStatusModal((m) => ({ ...m, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={handoverStatusModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="handover-status-title"
            aria-describedby="handover-status-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="handover-status-title" style={modalTitleStyle}>{handoverStatusModal.title}</h3>
            <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              {handoverStatusModal.lines.map((line, idx) => (
                <div key={`${idx}:${line}`} style={{ fontSize: 13, color: "#334155" }}>
                  {line}
                </div>
              ))}
            </div>
            <span id="handover-status-message" className="visually-hidden">
              Status der Gebietsübergabe
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={handoverStatusModal.done ? (handoverStatusModal.hasError ? btnDangerStyle : btnStyle) : btnGhostStyle}
                disabled={!handoverStatusModal.done}
                onClick={() => setHandoverStatusModal((m) => ({ ...m, open: false }))}
              >
                {handoverStatusModal.done ? "Schließen" : "Läuft..."}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Admin Konsole</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={btnStyle}
            onClick={() => setActiveView("new_partner")}
          >
            Neuen Partner
          </button>
        </div>
      </header>

      <p style={statusStyle}>{status}</p>

      <div style={adminLayoutStyle}>
        <aside style={modeBarStyle}>
          <button
            style={modeButtonStyle(navMode === "partners")}
            onClick={() => setNavMode("partners")}
            title="Partner"
          >
            👥
          </button>
          <button
            style={modeButtonStyle(navMode === "areas")}
            onClick={() => setNavMode("areas")}
            title="Gebiete"
          >
            🗺
          </button>
          <div style={{ flex: 1 }} />
          <button
            style={modeButtonStyle(activeView === "audit")}
            onClick={() => setActiveView("audit")}
            title="Audit-Log"
          >
            🧾
          </button>
          <button
            style={modeButtonStyle(false)}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            title="Abmelden"
          >
            ⎋
          </button>
        </aside>

        <aside style={listPaneStyle}>
          <div style={sidebarSectionHeaderStyle}>{navMode === "partners" ? "Partnerübersicht" : "Gebietsübersicht"}</div>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <input
              style={inputStyle}
              placeholder={navMode === "partners" ? "Suche: Name, E-Mail oder ID" : "Suche: Kreisname, ID oder Partner"}
              aria-label={navMode === "partners" ? "Partner suchen" : "Gebiet suchen"}
              value={navMode === "partners" ? partnerFilter : areaFilter}
              onChange={(e) => (navMode === "partners" ? setPartnerFilter(e.target.value) : setAreaFilter(e.target.value))}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
              <input
                type="checkbox"
                checked={onlyActiveList}
                onChange={(e) => setOnlyActiveList(e.target.checked)}
              />
              nur aktiv
            </label>
          </div>
          <div style={sidebarListStyle}>
            {navMode === "partners"
              ? filteredPartners.map((p) => (
                  <button
                    key={p.id}
                    style={listLinkRowStyle(selectedPartnerId === p.id)}
                    onClick={() => selectPartnerView(p.id, "partner_edit")}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.company_name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{p.is_active ? "aktiv" : "inaktiv"}</div>
                  </button>
                ))
              : filteredAreaOverview.map((row) => (
                  <button
                    key={row.key}
                    style={listLinkRowStyle(selectedPartnerId === row.partnerId)}
                    onClick={() => selectPartnerView(row.partnerId, "partner_edit")}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.kreisName}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{row.kreisId}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{row.partnerName}</div>
                  </button>
                ))}
          </div>
        </aside>

        <div style={contentPaneStyle}>
      {activeView === "new_partner" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Partner anlegen (Invite-Link)</h2>
        <div style={grid2Style}>
          <input
            placeholder="Firmenname"
            aria-label="Firmenname"
            style={inputStyle}
            value={createPartner.company_name}
            onChange={(e) => setCreatePartner((v) => ({ ...v, company_name: e.target.value }))}
          />
          <input
            placeholder="Kontakt-E-Mail"
            aria-label="Kontakt-E-Mail"
            style={inputStyle}
            value={createPartner.contact_email}
            onChange={(e) => setCreatePartner((v) => ({ ...v, contact_email: e.target.value }))}
          />
          <input
            placeholder="Kontaktperson"
            aria-label="Kontaktperson"
            style={inputStyle}
            value={createPartner.contact_person}
            onChange={(e) => setCreatePartner((v) => ({ ...v, contact_person: e.target.value }))}
          />
          <input
            placeholder="Website URL"
            aria-label="Website URL"
            style={inputStyle}
            value={createPartner.website_url}
            onChange={(e) => setCreatePartner((v) => ({ ...v, website_url: e.target.value }))}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy}
            onClick={() =>
              run("Partner anlegen", async () => {
                if (!createPartner.company_name.trim() || !createPartner.contact_email.trim()) {
                  throw new Error("Bitte Firmenname und Kontakt-E-Mail ausfuellen.");
                }
                const created = await api<{ partner: { id: string } }>("/api/admin/partners", {
                  method: "POST",
                  body: JSON.stringify(createPartner),
                });
                setCreatePartner({
                  company_name: "",
                  contact_email: "",
                  contact_person: "",
                  website_url: "",
                });
                await loadPartners(created.partner.id);
                setActiveView("partner_edit");
              })
            }
          >
            Einladung senden und Partner anlegen
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "partner_edit" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Partnerdetails</h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {selectedPartner ? `${selectedPartner.company_name} (${selectedPartner.id})` : "Bitte links einen Partner auswählen."}
        </p>
      </section>
      ) : null}

      {activeView === "partner_edit" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Partner bearbeiten</h2>
        <p style={mutedStyle}>{selectedPartnerLabel}</p>
        <div style={grid2Style}>
          <input
            placeholder="Firmenname"
            aria-label="Firmenname bearbeiten"
            style={inputStyle}
            value={editPartner.company_name}
            onChange={(e) => setEditPartner((v) => ({ ...v, company_name: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Kontakt-E-Mail"
            aria-label="Kontakt-E-Mail bearbeiten"
            style={inputStyle}
            value={editPartner.contact_email}
            onChange={(e) => setEditPartner((v) => ({ ...v, contact_email: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Kontaktperson"
            aria-label="Kontaktperson bearbeiten"
            style={inputStyle}
            value={editPartner.contact_person}
            onChange={(e) => setEditPartner((v) => ({ ...v, contact_person: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Website URL"
            aria-label="Website URL bearbeiten"
            style={inputStyle}
            value={editPartner.website_url}
            onChange={(e) => setEditPartner((v) => ({ ...v, website_url: e.target.value }))}
            disabled={!selectedPartner}
          />
        </div>
        <label style={{ display: "block", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={editPartner.is_active}
            disabled={!selectedPartner}
            onChange={(e) => setEditPartner((v) => ({ ...v, is_active: e.target.checked }))}
          />
          <span style={{ marginLeft: 8 }}>Partner aktiv</span>
        </label>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy || !selectedPartner}
            onClick={() =>
              run("Partner aktualisieren", async () => {
                if (!selectedPartnerId) return;
                await api(`/api/admin/partners/${selectedPartnerId}`, {
                  method: "PATCH",
                  body: JSON.stringify(editPartner),
                });
                await loadPartners(selectedPartnerId);
              })
            }
          >
            Speichern
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "partner_edit" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Gebietszuordnung</h2>
        <div style={rowStyle}>
          <input
            placeholder="Kreis suchen (Name oder ID, z. B. Leipzig oder 14)"
            aria-label="Kreis zuordnen"
            style={inputStyle}
            value={assignAreaId}
            onChange={(e) => {
              setAssignAreaId(e.target.value);
              setAreaQuery(e.target.value);
            }}
            disabled={!selectedPartner}
          />
          <button
            style={btnStyle}
            disabled={busy || !selectedPartner}
            onClick={() =>
              run("Gebiet zuordnen", async () => {
                if (!selectedPartnerId || !assignAreaId.trim()) return;
                await api(`/api/admin/partners/${selectedPartnerId}/areas`, {
                  method: "POST",
                  body: JSON.stringify({ area_id: assignAreaId.trim(), is_active: true }),
                });
                setAssignAreaId("");
                setAreaQuery("");
                await loadPartnerDetails(selectedPartnerId);
                await loadAreaOverview();
              })
            }
          >
            Zuordnen
          </button>
        </div>
        {areaOptions.length > 0 ? (
          <div style={suggestBoxStyle}>
            {areaOptions.map((a) => (
              <button
                key={a.id}
                style={suggestBtnStyle}
                onClick={() => {
                  setAssignAreaId(a.id);
                  setAreaQuery("");
                  setAreaOptions([]);
                }}
              >
                {a.name ?? a.id} - {a.id}
              </button>
            ))}
          </div>
        ) : null}
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Area</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {displayAreaRows.map((row) => (
              <tr key={row.key}>
                <td style={tdStyle}>
                  <div>{row.mapping.areas?.name ?? row.displayKreisId}</div>
                  <small style={mutedStyle}>{row.displayKreisId}</small>
                </td>
                <td style={tdStyle}>{row.mapping.is_active ? "aktiv" : "inaktiv"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={btnGhostStyle}
                      disabled={busy || !selectedPartner || row.derivedFromOrtslagen}
                      onClick={() =>
                        run("Mapping Status ändern", async () => {
                          await api(`/api/admin/partners/${selectedPartnerId}/areas/${row.mapping.area_id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ is_active: !row.mapping.is_active }),
                          });
                          await loadPartnerDetails(selectedPartnerId);
                          await loadAreaOverview();
                        })
                      }
                    >
                      {row.mapping.is_active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button
                      style={btnDangerStyle}
                      disabled={busy || !selectedPartner || row.derivedFromOrtslagen}
                      onClick={() =>
                        run("Mapping löschen", async () => {
                          await api(`/api/admin/partners/${selectedPartnerId}/areas/${row.mapping.area_id}`, {
                            method: "DELETE",
                          });
                          await loadPartnerDetails(selectedPartnerId);
                          await loadAreaOverview();
                        })
                      }
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      ) : null}

      {activeView === "partner_edit" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Gebiet übergeben</h2>
        <p style={mutedStyle}>
          Gebiet vom aktuell ausgewählten Partner an einen anderen Partner übertragen.
        </p>
        <div style={grid2Style}>
          <select
            style={inputStyle}
            aria-label="Kreis für Übergabe auswählen"
            value={handoverDraft.area_id}
            disabled={!selectedPartner}
            onChange={(e) => setHandoverDraft((v) => ({ ...v, area_id: e.target.value }))}
          >
            <option value="">Kreis wählen</option>
            {handoverAreaOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.id})
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            aria-label="Neuen Partner für Übergabe auswählen"
            value={handoverDraft.new_partner_id}
            disabled={!selectedPartner}
            onChange={(e) => setHandoverDraft((v) => ({ ...v, new_partner_id: e.target.value }))}
          >
            <option value="">Neuen Partner wählen</option>
            {handoverNewPartnerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.company_name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
            <input
              type="checkbox"
              checked={handoverDraft.deactivate_old_integrations}
              onChange={(e) => setHandoverDraft((v) => ({ ...v, deactivate_old_integrations: e.target.checked }))}
            />
            alte Integrationen deaktivieren
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
            <input
              type="checkbox"
              checked={handoverDraft.deactivate_old_partner}
              onChange={(e) => setHandoverDraft((v) => ({ ...v, deactivate_old_partner: e.target.checked }))}
            />
            alten Partner deaktivieren
          </label>
        </div>
        <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", background: "#f8fafc" }}>
          <div style={{ fontSize: 12, color: "#334155" }}>
            <strong>Vorschau:</strong>{" "}
            {selectedPartner && handoverDraft.area_id && handoverTargetPartner
              ? `${handoverDraft.area_id} von ${selectedPartner.company_name} zu ${handoverTargetPartner.company_name}`
              : "Bitte Kreis und Zielpartner auswählen."}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnDangerStyle}
            disabled={busy || !selectedPartner || !handoverDraft.area_id || !handoverDraft.new_partner_id}
            onClick={() => {
              if (!selectedPartnerId || !handoverDraft.area_id || !handoverDraft.new_partner_id) return;
              setHandoverConfirmModal({
                open: true,
                areaId: handoverDraft.area_id,
                oldPartnerId: selectedPartnerId,
                newPartnerId: handoverDraft.new_partner_id,
                deactivateOldPartner: handoverDraft.deactivate_old_partner,
                deactivateOldIntegrations: handoverDraft.deactivate_old_integrations,
              });
            }}
          >
            Übergabe ausführen
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "partner_integrations" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Integrationen</h2>
        <div style={grid2Style}>
          <select
            style={inputStyle}
            aria-label="Integrationstyp"
            value={createIntegration.kind}
            onChange={(e) =>
              setCreateIntegration((v) => {
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
            aria-label="Integrationsprovider"
            value={createIntegration.provider}
            onChange={(e) =>
              setCreateIntegration((v) => ({
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
          <input
            placeholder="Base URL"
            aria-label="Integrations Base URL"
            style={inputStyle}
            value={createIntegration.base_url}
            onChange={(e) => setCreateIntegration((v) => ({ ...v, base_url: e.target.value }))}
          />
          <select
            style={inputStyle}
            aria-label="Authentifizierungstyp"
            value={createIntegration.auth_type}
            onChange={(e) => setCreateIntegration((v) => ({ ...v, auth_type: e.target.value }))}
          >
            {(selectedProviderSpec?.authTypes ?? []).map((authType) => (
              <option key={authType} value={authType}>
                {AUTH_TYPE_LABELS[authType] ?? authType}
              </option>
            ))}
          </select>
          <input
            placeholder="Detail URL Template"
            aria-label="Detail URL Template"
            style={inputStyle}
            value={createIntegration.detail_url_template}
            onChange={(e) => setCreateIntegration((v) => ({ ...v, detail_url_template: e.target.value }))}
          />
        </div>
        {selectedProviderSpec ? (
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#475569" }}>
            {selectedProviderSpec.description}
            {selectedProviderSpec.requiresBaseUrl ? " Base URL ist erforderlich." : " Base URL ist optional."}
          </p>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy || !selectedPartner}
            onClick={() =>
              run("Integration anlegen", async () => {
                if (!selectedPartnerId) return;
                await api(`/api/admin/partners/${selectedPartnerId}/integrations`, {
                  method: "POST",
                  body: JSON.stringify(createIntegration),
                });
                const nextProvider = getDefaultProviderId(createIntegration.kind);
                setCreateIntegration((v) => ({
                  ...v,
                  provider: nextProvider,
                  auth_type: getDefaultAuthType(v.kind, nextProvider),
                  base_url: "",
                  detail_url_template: "",
                }));
                await loadPartnerDetails(selectedPartnerId);
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
              <th style={thStyle}>Secrets</th>
              <th style={thStyle}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => {
              const draft = secretDraft[integration.id] ?? { api_key: "", token: "", secret: "" };
              return (
                <tr key={integration.id}>
                  <td style={tdStyle}>{integration.kind}</td>
                  <td style={tdStyle}>{integration.provider}</td>
                  <td style={tdStyle}>{integration.is_active ? "aktiv" : "inaktiv"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
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
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        style={btnStyle}
                        disabled={busy}
                        onClick={() =>
                          run("Secret speichern", async () => {
                            const payload: Record<string, string> = {};
                            if (draft.api_key.trim()) payload.api_key = draft.api_key.trim();
                            if (draft.token.trim()) payload.token = draft.token.trim();
                            if (draft.secret.trim()) payload.secret = draft.secret.trim();
                            await api(`/api/admin/integrations/${integration.id}/secrets`, {
                              method: "POST",
                              body: JSON.stringify(payload),
                            });
                            setSecretDraft((prev) => ({
                              ...prev,
                              [integration.id]: { api_key: "", token: "", secret: "" },
                            }));
                          })
                        }
                      >
                        Secret speichern
                      </button>
                      <button
                        style={btnGhostStyle}
                        disabled={busy}
                        onClick={() =>
                          run("Integration Status ändern", async () => {
                            await api(
                              `/api/admin/integrations/${integration.id}/${integration.is_active ? "deactivate" : "reactivate"}`,
                              { method: "POST" },
                            );
                            await loadPartnerDetails(selectedPartnerId);
                          })
                        }
                      >
                        {integration.is_active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      ) : null}

      {activeView === "audit" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Security Audit Log</h2>
        <div style={grid3Style}>
          <input
            placeholder="entity_type"
            aria-label="Audit-Filter entity_type"
            style={inputStyle}
            value={auditFilters.entity_type}
            onChange={(e) => setAuditFilters((v) => ({ ...v, entity_type: e.target.value }))}
          />
          <input
            placeholder="event_type"
            aria-label="Audit-Filter event_type"
            style={inputStyle}
            value={auditFilters.event_type}
            onChange={(e) => setAuditFilters((v) => ({ ...v, event_type: e.target.value }))}
          />
          <input
            placeholder="actor_user_id"
            aria-label="Audit-Filter actor_user_id"
            style={inputStyle}
            value={auditFilters.actor_user_id}
            onChange={(e) => setAuditFilters((v) => ({ ...v, actor_user_id: e.target.value }))}
          />
          <input
            type="datetime-local"
            aria-label="Audit-Filter Startzeit"
            style={inputStyle}
            value={auditFilters.created_from}
            onChange={(e) => setAuditFilters((v) => ({ ...v, created_from: e.target.value }))}
          />
          <input
            type="datetime-local"
            aria-label="Audit-Filter Endzeit"
            style={inputStyle}
            value={auditFilters.created_to}
            onChange={(e) => setAuditFilters((v) => ({ ...v, created_to: e.target.value }))}
          />
          <input
            type="number"
            min={1}
            max={500}
            aria-label="Audit-Filter Ergebnislimit"
            style={inputStyle}
            value={auditFilters.limit}
            onChange={(e) =>
              setAuditFilters((v) => ({
                ...v,
                limit: Math.min(500, Math.max(1, Number(e.target.value) || 100)),
              }))
            }
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy}
            onClick={() =>
              run("Audit-Log laden", async () => {
                await loadAuditLogs();
              })
            }
          >
            Audit-Log aktualisieren
          </button>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Zeit</th>
              <th style={thStyle}>Actor</th>
              <th style={thStyle}>Event</th>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{new Date(row.created_at).toLocaleString("de-DE")}</td>
                <td style={tdStyle}>
                  <div>{row.actor_role}</div>
                  <small style={mutedStyle}>{row.actor_user_id ?? "-"}</small>
                </td>
                <td style={tdStyle}>{row.event_type}</td>
                <td style={tdStyle}>
                  <div>{row.entity_type}</div>
                  <small style={mutedStyle}>{row.entity_id}</small>
                </td>
                <td style={tdStyle}>
                  <pre style={preStyle}>{JSON.stringify(row.payload ?? {}, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      ) : null}
        </div>
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  width: "100%",
  margin: 0,
  padding: "16px 16px 32px 0",
  color: "#0f172a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const statusStyle: React.CSSProperties = {
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 16,
};

const adminLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "112px 360px minmax(0, 1fr)",
  gap: 0,
  alignItems: "stretch",
  minHeight: "calc(100vh - 120px)",
};

const modeBarStyle: React.CSSProperties = {
  background: "rgb(72, 107, 122)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  position: "sticky",
  top: 0,
  minHeight: "calc(100vh - 120px)",
};

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  height: 76,
  border: `1px solid ${active ? "#facc15" : "rgba(255,255,255,0.25)"}`,
  borderRadius: 10,
  background: active ? "rgba(15, 23, 42, 0.35)" : "rgba(255,255,255,0.08)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 26,
});

const listPaneStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  alignSelf: "start",
  borderRight: "1px solid #e2e8f0",
  borderTop: "1px solid #e2e8f0",
  borderBottom: "1px solid #e2e8f0",
  background: "#ffffff",
  padding: 12,
  maxHeight: "calc(100vh - 80px)",
  overflowY: "auto",
};

const sidebarSectionHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.2,
  textTransform: "uppercase",
  color: "#475569",
  marginBottom: 8,
};

const sidebarListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const contentPaneStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "0 0 0 14px",
};

const listLinkRowStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  border: `1px solid ${active ? "#0f766e" : "#e2e8f0"}`,
  borderRadius: 8,
  background: active ? "#f0fdfa" : "#ffffff",
  padding: "10px 12px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
});

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#ffffff",
  padding: 16,
  marginBottom: 16,
};

const h2Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 18,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const grid3Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  width: "100%",
};

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

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 6px",
  fontSize: 13,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: "8px 6px",
  verticalAlign: "top",
};

const mutedStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const suggestBoxStyle: React.CSSProperties = {
  marginTop: 8,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  maxHeight: 180,
  overflowY: "auto",
};

const suggestBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: 0,
  borderBottom: "1px solid #f1f5f9",
  background: "#fff",
  padding: "8px 10px",
  cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 420,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 11,
  lineHeight: 1.35,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1200,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  borderRadius: 12,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.2)",
  padding: 18,
};

const modalTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 18,
  color: "#0f172a",
};

const modalMessageStyle: React.CSSProperties = {
  margin: "0 0 14px",
  color: "#334155",
  lineHeight: 1.45,
};
