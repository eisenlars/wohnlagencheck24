'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type {
  AIBillingMode,
  BookingStatus,
  NetworkPartnerRecord,
  PartnerAreaInventoryRecord,
  PlacementCatalogRecord,
  PlacementCode,
} from '@/lib/network-partners/types';

type AreaOption = {
  id: string;
  label: string;
};

type BookingFormValues = {
  network_partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  status: BookingStatus;
  starts_at: string;
  ends_at: string | null;
  monthly_price_eur: number;
  portal_fee_eur: number;
  billing_cycle_day: number;
  required_locales: string[];
  ai_billing_mode: AIBillingMode;
  ai_monthly_budget_eur: number;
  notes: string | null;
};

type BookingFormProps = {
  networkPartners: NetworkPartnerRecord[];
  areas: AreaOption[];
  placements: PlacementCatalogRecord[];
  inventory: PartnerAreaInventoryRecord[];
  onSubmit: (values: BookingFormValues) => Promise<void>;
};

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
  background: '#fff',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
};

export default function BookingForm({
  networkPartners,
  areas,
  placements,
  inventory,
  onSubmit,
}: BookingFormProps) {
  const [networkPartnerId, setNetworkPartnerId] = useState(networkPartners[0]?.id ?? '');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const placementOptions = useMemo(
    () => inventory
      .filter((entry) => entry.area_id === areaId && entry.is_active)
      .map((entry) => placements.find((placement) => placement.code === entry.placement_code))
      .filter((entry): entry is PlacementCatalogRecord => Boolean(entry)),
    [areaId, inventory, placements],
  );
  const [placementCode, setPlacementCode] = useState<PlacementCode | ''>(placementOptions[0]?.code ?? '');
  const [status, setStatus] = useState<BookingStatus>('draft');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [portalFee, setPortalFee] = useState('');
  const [billingCycleDay, setBillingCycleDay] = useState('1');
  const [requiredLocales, setRequiredLocales] = useState('de');
  const [aiBillingMode, setAiBillingMode] = useState<AIBillingMode>('included');
  const [aiMonthlyBudget, setAiMonthlyBudget] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!networkPartnerId && networkPartners[0]?.id) {
      setNetworkPartnerId(networkPartners[0].id);
    }
  }, [networkPartnerId, networkPartners]);

  useEffect(() => {
    if (!areaId && areas[0]?.id) {
      setAreaId(areas[0].id);
    }
  }, [areaId, areas]);

  useEffect(() => {
    const availableCodes = new Set(placementOptions.map((entry) => entry.code));
    if (placementCode && availableCodes.has(placementCode)) return;
    setPlacementCode(placementOptions[0]?.code ?? '');
  }, [placementCode, placementOptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!networkPartnerId || !areaId || !placementCode) return;
    setSubmitting(true);
    try {
      await onSubmit({
        network_partner_id: networkPartnerId,
        area_id: areaId,
        placement_code: placementCode,
        status,
        starts_at: startsAt,
        ends_at: endsAt.trim() ? endsAt.trim() : null,
        monthly_price_eur: Number(monthlyPrice),
        portal_fee_eur: Number(portalFee),
        billing_cycle_day: Number(billingCycleDay),
        required_locales: requiredLocales
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        ai_billing_mode: aiBillingMode,
        ai_monthly_budget_eur: Number(aiMonthlyBudget),
        notes: notes.trim() ? notes.trim() : null,
      });
      setStatus('draft');
      setStartsAt('');
      setEndsAt('');
      setMonthlyPrice('');
      setPortalFee('');
      setBillingCycleDay('1');
      setRequiredLocales('de');
      setAiBillingMode('included');
      setAiMonthlyBudget('0');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={labelStyle}>
          Netzwerkpartner
          <select value={networkPartnerId} onChange={(event) => setNetworkPartnerId(event.target.value)} style={inputStyle} required>
            {networkPartners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.company_name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Gebiet
          <select value={areaId} onChange={(event) => setAreaId(event.target.value)} style={inputStyle} required>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Placement
          <select
            value={placementCode}
            onChange={(event) => setPlacementCode(event.target.value as PlacementCode)}
            style={inputStyle}
            required
          >
            {placementOptions.map((placement) => (
              <option key={placement.code} value={placement.code}>
                {placement.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as BookingStatus)} style={inputStyle}>
            <option value="draft">draft</option>
            <option value="pending_review">pending_review</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="cancelled">cancelled</option>
            <option value="expired">expired</option>
          </select>
        </label>
        <label style={labelStyle}>
          Startdatum
          <input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Enddatum
          <input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Monatspreis in EUR
          <input type="number" min={0} step="0.01" value={monthlyPrice} onChange={(event) => setMonthlyPrice(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Portalfee in EUR
          <input type="number" min={0} step="0.01" value={portalFee} onChange={(event) => setPortalFee(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Abrechnungstag
          <input type="number" min={1} max={28} value={billingCycleDay} onChange={(event) => setBillingCycleDay(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Pflichtsprachen
          <input value={requiredLocales} onChange={(event) => setRequiredLocales(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          KI-Abrechnungsmodus
          <select value={aiBillingMode} onChange={(event) => setAiBillingMode(event.target.value as AIBillingMode)} style={inputStyle}>
            <option value="included">included</option>
            <option value="credit_based">credit_based</option>
            <option value="blocked">blocked</option>
          </select>
        </label>
        <label style={labelStyle}>
          KI-Monatsbudget in EUR
          <input type="number" min={0} step="0.01" value={aiMonthlyBudget} onChange={(event) => setAiMonthlyBudget(event.target.value)} style={inputStyle} required />
        </label>
      </div>

      <label style={labelStyle}>
        Notizen
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...inputStyle, minHeight: 96 }} />
      </label>

      <button
        type="submit"
        disabled={submitting || networkPartners.length === 0 || areas.length === 0 || placementOptions.length === 0}
        style={{
          width: 'fit-content',
          borderRadius: 10,
          border: '1px solid #0f766e',
          background: '#0f766e',
          color: '#fff',
          padding: '10px 14px',
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.65 : 1,
        }}
      >
        {submitting ? 'Speichert...' : 'Buchung anlegen'}
      </button>
    </form>
  );
}
