'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import NetworkBookingsWorkspace from '@/components/network-partners/NetworkBookingsWorkspace';
import NetworkContentWorkspace from '@/components/network-partners/NetworkContentWorkspace';
import NetworkBillingWorkspace from '@/components/network-partners/NetworkBillingWorkspace';
import NetworkPartnerAccessPanel from '@/components/network-partners/NetworkPartnerAccessPanel';
import NetworkPartnerForm from '@/components/network-partners/NetworkPartnerForm';
import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
} from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
} from '@/app/dashboard/workflow-ui';

type NetworkPartnerListPayload = {
  network_partners?: NetworkPartnerRecord[];
  error?: string;
};

type BookingListPayload = {
  bookings?: NetworkPartnerBookingRecord[];
  error?: string;
};

type ContentListPayload = {
  content_items?: NetworkContentRecord[];
  error?: string;
};

export type NetworkPartnerDetailSection = 'profile' | 'bookings' | 'content' | 'billing';

type AreaOption = {
  id: string;
  label: string;
};

type NetworkPartnerManagementWorkspaceProps = {
  initialSelectedPartnerId?: string | null;
  initialDetailSection?: NetworkPartnerDetailSection;
  onSelectedPartnerIdChange?: (partnerId: string | null) => void;
  onDetailSectionChange?: (section: NetworkPartnerDetailSection) => void;
  areas?: AreaOption[];
};

function formatStatusLabel(status: NetworkPartnerRecord['status']): string {
  if (status === 'active') return 'Aktiv';
  if (status === 'paused') return 'Pausiert';
  return 'Inaktiv';
}

function summarizePartnerMetrics(
  partnerId: string,
  bookings: NetworkPartnerBookingRecord[],
  contentItems: NetworkContentRecord[],
) {
  const partnerBookings = bookings.filter((booking) => booking.network_partner_id === partnerId);
  const partnerContent = contentItems.filter((item) => item.network_partner_id === partnerId);
  return {
    activeBookings: partnerBookings.filter((booking) => booking.status === 'active').length,
    totalBookings: partnerBookings.length,
    openContent: partnerContent.filter((item) => item.status !== 'live').length,
  };
}

export default function NetworkPartnerManagementWorkspace({
  initialSelectedPartnerId,
  initialDetailSection = 'profile',
  onSelectedPartnerIdChange,
  onDetailSectionChange,
  areas = [],
}: NetworkPartnerManagementWorkspaceProps) {
  const [networkPartners, setNetworkPartners] = useState<NetworkPartnerRecord[]>([]);
  const [bookings, setBookings] = useState<NetworkPartnerBookingRecord[]>([]);
  const [contentItems, setContentItems] = useState<NetworkContentRecord[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initialSelectedPartnerId ?? null);
  const [detailSection, setDetailSection] = useState<NetworkPartnerDetailSection>(initialDetailSection);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);

  const fetchWorkspaceData = useCallback(async () => {
    const [partnersResponse, bookingsResponse, contentResponse] = await Promise.all([
      fetch('/api/partner/network-partners', { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/network-bookings', { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/network-content', { method: 'GET', cache: 'no-store' }),
    ]);
    return {
      partnersResponse,
      bookingsResponse,
      contentResponse,
      partnersPayload: (await partnersResponse.json().catch(() => null)) as NetworkPartnerListPayload | null,
      bookingsPayload: (await bookingsResponse.json().catch(() => null)) as BookingListPayload | null,
      contentPayload: (await contentResponse.json().catch(() => null)) as ContentListPayload | null,
    };
  }, []);

  const loadNetworkPartners = useCallback(async (
    preferredPartnerId?: string | null,
    options?: { preserveStatusMessage?: boolean },
  ) => {
    setLoading(true);
    if (!options?.preserveStatusMessage) {
      setError(null);
      setMessage(null);
    }
    const {
      partnersResponse,
      bookingsResponse,
      contentResponse,
      partnersPayload,
      bookingsPayload,
      contentPayload,
    } = await fetchWorkspaceData();
    if (!partnersResponse.ok) {
      setNetworkPartners([]);
      setBookings([]);
      setContentItems([]);
      setError(String(partnersPayload?.error ?? 'Netzwerkpartner konnten nicht geladen werden.'));
      setLoading(false);
      return;
    }

    const partners = Array.isArray(partnersPayload?.network_partners) ? partnersPayload.network_partners : [];
    setNetworkPartners(partners);
    setBookings(Array.isArray(bookingsPayload?.bookings) && bookingsResponse.ok ? bookingsPayload.bookings : []);
    setContentItems(Array.isArray(contentPayload?.content_items) && contentResponse.ok ? contentPayload.content_items : []);
    setSelectedPartnerId((current) => {
      const requested = String(preferredPartnerId ?? initialSelectedPartnerId ?? current ?? '').trim();
      const selected = requested && partners.some((partner) => partner.id === requested)
        ? requested
        : (partners[0]?.id ?? null);
      onSelectedPartnerIdChange?.(selected);
      return selected;
    });
    setLoading(false);
  }, [fetchWorkspaceData, initialSelectedPartnerId, onSelectedPartnerIdChange]);

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

  const partnerMetrics = useMemo(
    () => new Map(networkPartners.map((partner) => [
      partner.id,
      summarizePartnerMetrics(partner.id, bookings, contentItems),
    ])),
    [bookings, contentItems, networkPartners],
  );

  function selectPartner(partnerId: string) {
    setCreateMode(false);
    setSelectedPartnerId(partnerId);
    onSelectedPartnerIdChange?.(partnerId);
  }

  function changeDetailSection(nextSection: NetworkPartnerDetailSection) {
    setDetailSection(nextSection);
    onDetailSectionChange?.(nextSection);
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMessage(null);
            setCreateMode(true);
            setSelectedPartnerId(null);
            onSelectedPartnerIdChange?.(null);
          }}
          style={{
            borderRadius: 999,
            border: '1px solid rgb(72, 107, 122)',
            background: 'rgb(72, 107, 122)',
            color: '#fff',
            padding: '12px 18px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Neuen Partner anlegen
        </button>
      </div>

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
              <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Partnerübersicht</h2>
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
                        border: active ? '1px solid rgb(72, 107, 122)' : '1px solid #e2e8f0',
                        background: active ? 'rgba(72, 107, 122, 0.08)' : '#fff',
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
                            color: active ? 'rgb(72, 107, 122)' : '#475569',
                            background: active ? 'rgba(72, 107, 122, 0.12)' : '#f1f5f9',
                          }}
                        >
                          {formatStatusLabel(partner.status)}
                        </span>
                      </div>
                      <span style={{ color: '#475569', fontSize: 13 }}>
                        {partner.legal_name?.trim() || 'Keine verantwortliche Person gepflegt'}
                      </span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 12 }}>
                        <span>{partner.contact_email}</span>
                        <span>Aktive Buchungen: {partnerMetrics.get(partner.id)?.activeBookings ?? 0}</span>
                        <span>Content offen: {partnerMetrics.get(partner.id)?.openContent ?? 0}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {createMode ? (
            <section style={workflowPanelCardStyle}>
              <div style={{ display: 'grid', gap: 22 }}>
                <div style={workflowHeaderStyle}>
                  <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>Neuen Netzwerkpartner anlegen</h2>
                  <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                    Der Partnerdatensatz und der erste Zugang werden in einer Aktion angelegt. Danach wird der Einladungslink direkt an die Kontakt-E-Mail versendet.
                  </p>
                </div>
                {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
                {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
                <NetworkPartnerForm
                  submitLabel="Einladung senden und Partner anlegen"
                  helperText="Falls der Einladungsversand scheitert, bleibt der Partner trotzdem angelegt. Der Fehler wird danach direkt im Profil angezeigt."
                  onSubmit={async (values) => {
                    setError(null);
                    setMessage(null);
                    const response = await fetch('/api/partner/network-partners', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...values,
                        send_invite: true,
                      }),
                    });
                    const payload = (await response.json().catch(() => null)) as {
                      error?: string;
                      network_partner?: NetworkPartnerRecord;
                      invite_sent?: boolean;
                      invite_error?: string;
                    } | null;
                    if (!response.ok) {
                      setError(String(payload?.error ?? 'Netzwerkpartner konnte nicht angelegt werden.'));
                      return;
                    }
                    const createdPartner = payload?.network_partner ?? null;
                    const createdPartnerId = String(createdPartner?.id ?? '').trim() || null;
                    if (createdPartner) {
                      setNetworkPartners((current) => {
                        const withoutCreated = current.filter((partner) => partner.id !== createdPartner.id);
                        return [...withoutCreated, createdPartner].sort((a, b) => a.company_name.localeCompare(b.company_name, 'de'));
                      });
                    }
                    if (payload?.invite_sent === false) {
                      setMessage('Netzwerkpartner wurde angelegt. Der Einladungsversand ist fehlgeschlagen.');
                      setError(String(payload?.invite_error ?? 'Einladungsversand fehlgeschlagen.'));
                    } else {
                      setMessage('Netzwerkpartner wurde angelegt und die Einladung wurde versendet.');
                    }
                    setCreateMode(false);
                    if (createdPartnerId) {
                      selectPartner(createdPartnerId);
                    }
                    changeDetailSection('profile');
                    await loadNetworkPartners(createdPartnerId, { preserveStatusMessage: true });
                  }}
                />
              </div>
            </section>
          ) : selectedPartner ? (
            <>
              <section style={workflowPanelCardStyle}>
                <div style={{ ...workflowHeaderStyle, gap: 10 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>{selectedPartner.company_name}</h2>
                    <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                      Stammdaten, Zugang und operative Arbeitsbereiche des ausgewählten Netzwerkpartners.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {([
                      ['profile', 'Profil'],
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
                            border: active ? '1px solid rgb(72, 107, 122)' : '1px solid #cbd5e1',
                            background: active ? 'rgb(72, 107, 122)' : '#fff',
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
                      <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Profil</h3>
                      <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                        Unternehmensname, verantwortliche Person, Kontakt und Status werden hier zentral gepflegt.
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
                      <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
                        <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Zugang & Einladung</h3>
                        <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
                          Hier wird sichtbar, ob der Login bereits aktiviert wurde oder ob eine Einladung erneut versendet werden muss.
                        </p>
                      </div>
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
                  areas={areas}
                />
              ) : null}

              {detailSection === 'content' ? (
                <NetworkContentWorkspace
                  networkPartnerId={selectedPartner.id}
                  networkPartnerName={selectedPartner.company_name}
                  areas={areas}
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
                  Wähle links einen vorhandenen Netzwerkpartner oder starte oben mit <strong>Neuen Partner anlegen</strong>.
                </p>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
