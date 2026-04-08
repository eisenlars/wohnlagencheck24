'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import type { NetworkPartnerRecord } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
} from '@/app/dashboard/workflow-ui';

type NetworkPartnerIntegrationsWorkspaceProps = {
  partner: NetworkPartnerRecord;
  onPartnerUpdated: (partner: NetworkPartnerRecord) => void;
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const summaryCardStyle: CSSProperties = {
  border: '1px solid #dbeafe',
  borderRadius: 16,
  background: '#f8fbff',
  padding: 16,
  display: 'grid',
  gap: 8,
  alignContent: 'start',
};

export default function NetworkPartnerIntegrationsWorkspace({
  partner,
  onPartnerUpdated,
}: NetworkPartnerIntegrationsWorkspaceProps) {
  const [llmAllowed, setLlmAllowed] = useState(partner.llm_partner_managed_allowed !== false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLlmAllowed(partner.llm_partner_managed_allowed !== false);
  }, [partner.id, partner.llm_partner_managed_allowed]);

  async function saveLlmSetting() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/partner/network-partners/${encodeURIComponent(partner.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_partner_managed_allowed: llmAllowed,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        network_partner?: NetworkPartnerRecord;
      } | null;
      if (!response.ok || !payload?.network_partner) {
        throw new Error(String(payload?.error ?? 'LLM-Freigabe konnte nicht gespeichert werden.'));
      }
      onPartnerUpdated(payload.network_partner);
      setMessage('LLM-Freigabe wurde gespeichert.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'LLM-Freigabe konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={workflowPanelCardStyle}>
      <div style={{ display: 'grid', gap: 22 }}>
        <div style={workflowHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Anbindungen</h3>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            LLM-Freigabe und CRM-Setup des Netzwerkpartners werden hier getrennt von Profil und Abrechnung gebündelt.
          </p>
        </div>

        {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}

        <div style={summaryGridStyle}>
          <article style={summaryCardStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8' }}>LLM-Freigabe</div>
            <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>
              Netzwerkpartner sollen eigene LLMs standardmäßig selbst anbinden dürfen, damit deren KI-Abrechnung separat bleibt.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#334155', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={llmAllowed}
                disabled={busy}
                onChange={(event) => setLlmAllowed(event.target.checked)}
              />
              Partner-eigene LLM-Anbindungen erlauben
            </label>
            <button
              type="button"
              onClick={() => void saveLlmSetting()}
              disabled={busy}
              style={{
                borderRadius: 10,
                border: '1px solid #1d4ed8',
                background: '#1d4ed8',
                color: '#fff',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.65 : 1,
                width: 'fit-content',
              }}
            >
              {busy ? 'Speichert...' : 'Freigabe speichern'}
            </button>
          </article>

          <article style={summaryCardStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f766e' }}>CRM-Anbindungen</div>
            <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>
              Propstack und onOffice bleiben die relevanten CRM-Pfade. Die bestehende Admin-CRM-Logik wurde im ersten Pass auf vier Karten geschärft:
            </div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
              Importregeln<br />
              abgesicherter Testmodus<br />
              Vollsynchronisation<br />
              Teilsynchronisation
            </div>
          </article>

          <article style={summaryCardStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed' }}>Teilsynchronisation</div>
            <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>
              Die provider-spezifischen Teilpfade bleiben getrennt:
            </div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
              Propstack: Webhook-/Trigger-Setup<br />
              onOffice: Delta-Polling über <code>geaendert_am</code>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
