'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import NetworkBookingsWorkspace from '@/components/network-partners/NetworkBookingsWorkspace';
import NetworkContentWorkspace from '@/components/network-partners/NetworkContentWorkspace';
import NetworkBillingWorkspace from '@/components/network-partners/NetworkBillingWorkspace';
import NetworkPartnerAccessPanel from '@/components/network-partners/NetworkPartnerAccessPanel';
import NetworkPartnerForm from '@/components/network-partners/NetworkPartnerForm';
import type { NetworkPartnerRecord } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type NetworkPartnerListPayload = {
  network_partners?: NetworkPartnerRecord[];
  error?: string;
};

export type NetworkPartnerDetailSection = 'profile' | 'bookings' | 'content' | 'billing';

type NetworkPartnerManagementWorkspaceProps = {
  initialSelectedPartnerId?: string | null;
  initialDetailSection?: NetworkPartnerDetailSection;
  onSelectedPartnerIdChange?: (partnerId: string | null) => void;
  onDetailSectionChange?: (section: NetworkPartnerDetailSection) => void;
};

function formatStatusLabel(status: NetworkPartnerRecord['status']): string {
  if (status === 'active') return 'Aktiv';
  if (status === 'paused') return 'Pausiert';
  return 'Inaktiv';
}

export default function NetworkPartnerManagementWorkspace({
  initialSelectedPartnerId,
  initialDetailSection = 'profile',
  onSelectedPartnerIdChange,
  onDetailSectionChange,
}: NetworkPartnerManagementWorkspaceProps) {
  const [networkPartners, setNetworkPartners] = useState<NetworkPartnerRecord[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initialSelectedPartnerId ?? null);
  const [detailSection, setDetailSection] = useState<NetworkPartnerDetailSection>(initialDetailSection);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchNetworkPartners = useCallback(async () => {
    const response = await fetch('/api/partner/network-partners', { method: 'GET', cache: 'no-store' });
    return {
      response,
      payload: (await response.json().catch(() => null)) as NetworkPartnerListPayload | null,
    };
  }, []);

  const loadNetworkPartners = useCallback(async (preferredPartnerId?: string | null) => {
    setLoading(true);
    setError(null);
    const { response, payload } = await fetchNetworkPartners();
    if (!response.ok) {
      setNetworkPartners([]);
      setError(String(payload?.error ?? 'Netzwerkpartner konnten nicht geladen werden.'));
      setLoading(false);
      return;
    }

    const partners = Array.isArray(payload?.network_partners) ? payload.network_partners : [];
    setNetworkPartners(partners);
    setSelectedPartnerId((current) => {
      const requested = String(preferredPartnerId ?? initialSelectedPartnerId ?? current ?? '').trim();
      const selected = requested && partners.some((partner) => partner.id === requested)
        ? requested
        : (partners[0]?.id ?? null);
      onSelectedPartnerIdChange?.(selected);
      return selected;
    });
    setLoading(false);
  }, [fetchNetworkPartners, initialSelectedPartnerId, onSelectedPartnerIdChange]);

  useEffect(() => {
    void loadNetworkPartners(initialSelectedPartnerId ?? undefined);
  }, [initialSelectedPartnerId, loadNetworkPartners]);

  useEffect(() => {
    setDetailSection(initialDetailSection);
  }, [initialDetailSection]);

  const filteredPartners = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return networkPartners;
    return networkPartners.filter((partner) => {
      const haystack = [
        partner.company_name,
        partner.legal_name,
        partner.contact_email,
      ]
        .map((value) => String(value ?? '').trim().toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });
  }, [networkPartners, searchTerm]);

  const selectedPartner = useMemo(
    () => networkPartners.find((partner) => partner.id === selectedPartnerId) ?? null,
    [networkPartners, selectedPartnerId],
  );

  function selectPartner(partnerId: string) {
    setSelectedPartnerId(partnerId);
    onSelectedPartnerIdChange?.(partnerId);
  }

  function changeDetailSection(nextSection: NetworkPartnerDetailSection) {
    setDetailSection(nextSection);
    onDetailSectionChange?.(nextSection);
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Regionale Partner
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>Netzwerkpartner Verwaltung</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 920, lineHeight: 1.6 }}>
            Links verwaltest du dein Netzwerkpartner-Portfolio. Rechts arbeitest du pro Partner in dessen Stammdaten, Zugängen, Buchungen, Content und Abrechnung.
          </p>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: '320px minmax(0, 1fr)',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 18, position: 'sticky', top: 18 }}>
          <section style={workflowPanelCardStyle}>
            <div style={workflowHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Partnerliste</h2>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                Wähle einen Netzwerkpartner aus, um rechts direkt in dessen Arbeitsbereiche zu springen.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Partner suchen"
                style={{
                  width: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '10px 12px',
                  font: 'inherit',
                  color: '#0f172a',
                  background: '#fff',
                }}
              />

              <button
                type="button"
                onClick={() => setCreateOpen((current) => !current)}
                style={{
                  width: 'fit-content',
                  borderRadius: 999,
                  border: '1px solid #1d4ed8',
                  background: createOpen ? '#1d4ed8' : '#eff6ff',
                  color: createOpen ? '#fff' : '#1d4ed8',
                  padding: '10px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {createOpen ? 'Anlage schließen' : 'Neuen Partner anlegen'}
              </button>

              {createOpen ? (
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    border: '1px solid #dbeafe',
                    background: '#f8fbff',
                  }}
                >
                  {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
                  {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
                  <NetworkPartnerForm
                    submitLabel="Netzwerkpartner anlegen"
                    onSubmit={async (values) => {
                      setError(null);
                      setMessage(null);
                      const response = await fetch('/api/partner/network-partners', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(values),
                      });
                      const payload = (await response.json().catch(() => null)) as {
                        error?: string;
                        network_partner?: NetworkPartnerRecord;
                      } | null;
                      if (!response.ok) {
                        setError(String(payload?.error ?? 'Netzwerkpartner konnte nicht angelegt werden.'));
                        return;
                      }
                      const createdPartnerId = String(payload?.network_partner?.id ?? '').trim() || null;
                      setMessage('Netzwerkpartner wurde angelegt.');
                      setCreateOpen(false);
                      changeDetailSection('profile');
                      await loadNetworkPartners(createdPartnerId);
                    }}
                  />
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: 10 }}>
                {loading ? (
                  <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
                ) : filteredPartners.length === 0 ? (
                  <p style={{ margin: 0, color: '#64748b' }}>Keine Netzwerkpartner gefunden.</p>
                ) : filteredPartners.map((partner) => {
                  const active = partner.id === selectedPartnerId;
                  return (
                    <button
                      key={partner.id}
                      type="button"
                      onClick={() => {
                        selectPartner(partner.id);
                        changeDetailSection('profile');
                      }}
                      style={{
                        display: 'grid',
                        gap: 6,
                        width: '100%',
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 16,
                        border: active ? '1px solid #1d4ed8' : '1px solid #e2e8f0',
                        background: active ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <strong style={{ color: '#0f172a', fontSize: 15 }}>{partner.company_name}</strong>
                        <span
                          style={{
                            borderRadius: 999,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: active ? '#1d4ed8' : '#475569',
                            background: active ? '#dbeafe' : '#f1f5f9',
                          }}
                        >
                          {formatStatusLabel(partner.status)}
                        </span>
                      </div>
                      <span style={{ color: '#475569', fontSize: 13 }}>{partner.contact_email}</span>
                      <span style={{ color: '#64748b', fontSize: 12 }}>
                        {partner.managed_editing_enabled ? 'Managed Editing freigegeben' : 'Moderierter Zugriff'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {selectedPartner ? (
            <>
              <section style={workflowPanelCardStyle}>
                <div style={{ ...workflowHeaderStyle, gap: 10 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>{selectedPartner.company_name}</h2>
                    <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                      Rechte Arbeitsbereiche für den ausgewählten Netzwerkpartner.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {([
                      ['profile', 'Stammdaten & Zugang'],
                      ['bookings', 'Buchungen'],
                      ['content', 'Content & Review'],
                      ['billing', 'Abrechnung'],
                    ] as const).map(([sectionKey, label]) => {
                      const active = detailSection === sectionKey;
                      return (
                        <button
                          key={sectionKey}
                          type="button"
                          onClick={() => changeDetailSection(sectionKey)}
                          style={{
                            borderRadius: 999,
                            padding: '10px 14px',
                            border: active ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                            background: active ? '#1d4ed8' : '#fff',
                            color: active ? '#fff' : '#334155',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {detailSection === 'profile' ? (
                <section style={workflowPanelCardStyle}>
                  <div style={{ display: 'grid', gap: 22 }}>
                    <div style={workflowHeaderStyle}>
                      <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Stammdaten</h3>
                      <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                        Status, Kontakt- und Managed-Editing-Regeln werden direkt am Partner gepflegt.
                      </p>
                    </div>
                    {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
                    {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
                    <NetworkPartnerForm
                      initialValues={selectedPartner}
                      submitLabel="Änderungen speichern"
                      onSubmit={async (values) => {
                        setError(null);
                        setMessage(null);
                        const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(selectedPartner.id)}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(values),
                        });
                        const payload = (await response.json().catch(() => null)) as {
                          error?: string;
                          network_partner?: NetworkPartnerRecord;
                        } | null;
                        if (!response.ok) {
                          setError(String(payload?.error ?? 'Netzwerkpartner konnte nicht aktualisiert werden.'));
                          return;
                        }
                        const updatedPartner = payload?.network_partner ?? null;
                        setNetworkPartners((current) => current.map((partner) => (
                          updatedPartner && partner.id === updatedPartner.id ? updatedPartner : partner
                        )));
                        setMessage('Änderungen wurden gespeichert.');
                      }}
                    />
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 22 }}>
                      <NetworkPartnerAccessPanel
                        networkPartnerId={selectedPartner.id}
                        contactEmail={selectedPartner.contact_email}
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {detailSection === 'bookings' ? (
                <NetworkBookingsWorkspace
                  networkPartnerId={selectedPartner.id}
                  networkPartnerName={selectedPartner.company_name}
                />
              ) : null}

              {detailSection === 'content' ? (
                <NetworkContentWorkspace
                  networkPartnerId={selectedPartner.id}
                  networkPartnerName={selectedPartner.company_name}
                />
              ) : null}

              {detailSection === 'billing' ? (
                <NetworkBillingWorkspace
                  networkPartnerId={selectedPartner.id}
                  networkPartnerName={selectedPartner.company_name}
                />
              ) : null}
            </>
          ) : (
            <section style={workflowPanelCardStyle}>
              <div style={workflowHeaderStyle}>
                <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Noch kein Netzwerkpartner ausgewählt</h2>
                <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                  Wähle links einen vorhandenen Netzwerkpartner oder lege einen neuen an.
                </p>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
