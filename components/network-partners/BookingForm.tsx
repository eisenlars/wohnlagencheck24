'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type {
  BookingStatus,
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
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
  monthly_price_eur: number;
  notes: string | null;
};

type BookingFormProps = {
  networkPartners: NetworkPartnerRecord[];
  areas: AreaOption[];
  placements: PlacementCatalogRecord[];
  onSubmit: (values: BookingFormValues) => Promise<void>;
  initialValue?: NetworkPartnerBookingRecord | null;
  submitLabel?: string;
  onCancel?: () => void;
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

function resolveEditableStatusOptions(currentStatus: BookingStatus | null): Array<{ value: BookingStatus; label: string }> {
  if (!currentStatus) {
    return [
      { value: 'active', label: 'Aktiv' },
      { value: 'paused', label: 'Inaktiv' },
    ];
  }
  if (currentStatus === 'active' || currentStatus === 'paused') {
    return [
      { value: 'active', label: 'Aktiv' },
      { value: 'paused', label: 'Inaktiv' },
    ];
  }
  if (currentStatus === 'cancelled' || currentStatus === 'expired') {
    return [
      { value: currentStatus, label: currentStatus === 'cancelled' ? 'Beendet' : 'Abgelaufen' },
    ];
  }
  return [
    { value: 'draft', label: 'Entwurf' },
    { value: 'active', label: 'Aktiv' },
  ];
}

function formatPlacementLabel(placements: PlacementCatalogRecord[], code: PlacementCode): string {
  return placements.find((placement) => placement.code === code)?.label ?? code;
}

function formatAreaLabel(areas: AreaOption[], areaId: string): string {
  return areas.find((area) => area.id === areaId)?.label ?? areaId;
}

function formatLocalitySelectLabel(label: string): string {
  const normalized = String(label ?? '').trim();
  if (!normalized) return '';
  const parts = normalized.split('->').map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

function toDistrictAreaId(areaId: string): string {
  const normalized = String(areaId ?? '').trim();
  if (!normalized) return '';
  return normalized.split('-').slice(0, 3).join('-');
}

export default function BookingForm({
  networkPartners,
  areas,
  placements,
  onSubmit,
  initialValue = null,
  submitLabel,
  onCancel,
}: BookingFormProps) {
  const placementOptions = useMemo(
    () => placements.filter((placement) => placement.is_active),
    [placements],
  );
  const isEditing = Boolean(initialValue?.id);
  const statusOptions = useMemo(
    () => resolveEditableStatusOptions(initialValue?.status ?? null),
    [initialValue?.status],
  );

  const [networkPartnerId, setNetworkPartnerId] = useState(initialValue?.network_partner_id ?? networkPartners[0]?.id ?? '');
  const [areaId, setAreaId] = useState(initialValue?.area_id ?? areas[0]?.id ?? '');
  const [placementCode, setPlacementCode] = useState<PlacementCode | ''>(initialValue?.placement_code ?? placementOptions[0]?.code ?? '');
  const [status, setStatus] = useState<BookingStatus>(initialValue?.status ?? 'active');
  const [monthlyPrice, setMonthlyPrice] = useState(initialValue?.monthly_price_eur?.toString() ?? '10');
  const [notes, setNotes] = useState(initialValue?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const fixedPortalFee = 10;
  const parsedMonthlyPrice = Number(monthlyPrice);
  const monthlyPriceValue = Number.isFinite(parsedMonthlyPrice) ? parsedMonthlyPrice : 0;
  const partnerNetRevenue = Math.max(0, monthlyPriceValue - fixedPortalFee);
  const editingBooking = isEditing ? initialValue : null;
  const districtOptions = useMemo(
    () => areas.filter((area) => area.id.split('-').length <= 3),
    [areas],
  );
  const initialDistrictAreaId = useMemo(() => {
    const baseAreaId = initialValue?.area_id ?? areas[0]?.id ?? '';
    return toDistrictAreaId(baseAreaId);
  }, [areas, initialValue?.area_id]);
  const [districtAreaId, setDistrictAreaId] = useState(initialDistrictAreaId);
  const localityOptions = useMemo(
    () => areas.filter((area) => toDistrictAreaId(area.id) === districtAreaId && area.id.split('-').length > 3),
    [areas, districtAreaId],
  );

  useEffect(() => {
    setNetworkPartnerId(initialValue?.network_partner_id ?? networkPartners[0]?.id ?? '');
    setAreaId(initialValue?.area_id ?? areas[0]?.id ?? '');
    setDistrictAreaId(toDistrictAreaId(initialValue?.area_id ?? areas[0]?.id ?? ''));
    setPlacementCode(initialValue?.placement_code ?? placementOptions[0]?.code ?? '');
    setStatus(initialValue?.status ?? 'active');
    setMonthlyPrice(initialValue?.monthly_price_eur?.toString() ?? '10');
    setNotes(initialValue?.notes ?? '');
  }, [areas, initialValue, networkPartners, placementOptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!networkPartnerId || !districtAreaId || !placementCode) return;
    const nextMonthlyPrice = Number(monthlyPrice);
    if (!Number.isFinite(nextMonthlyPrice) || nextMonthlyPrice < fixedPortalFee) return;
    setSubmitting(true);
    try {
      await onSubmit({
        network_partner_id: networkPartnerId,
        area_id: districtAreaId,
        placement_code: placementCode,
        status,
        monthly_price_eur: nextMonthlyPrice,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (!isEditing) {
        setStatus('active');
        setMonthlyPrice('10');
        setNotes('');
        setAreaId('');
        setDistrictAreaId(districtOptions[0]?.id ?? '');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
          {isEditing ? 'Buchung bearbeiten' : 'Neue Buchung anlegen'}
        </h3>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
          {isEditing
            ? 'Leistung und Gebiet bleiben bei bestehenden Buchungen stabil. Status, Preis und Notizen lassen sich direkt anpassen.'
            : 'Die Buchung gilt immer nur für einen Kreis. Soll ein Netzwerkpartner in weiteren Kreisen erscheinen, legst du dafür separate Buchungen an.'}
        </p>
      </div>

      {editingBooking ? (
        <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gap: 6, color: '#334155', fontSize: 14 }}>
            <span><strong>Leistung:</strong> {formatPlacementLabel(placements, editingBooking.placement_code)}</span>
            <span><strong>Gebiet:</strong> {formatAreaLabel(areas, editingBooking.area_id)}</span>
            <span>
              <strong>Netzwerkpartner:</strong> {networkPartners.find((partner) => partner.id === editingBooking.network_partner_id)?.company_name ?? editingBooking.network_partner_id}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={labelStyle}>
            Leistung
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
            Kreis
            <select
              value={districtAreaId}
              onChange={(event) => {
                const nextDistrict = event.target.value;
                setDistrictAreaId(nextDistrict);
                setAreaId('');
              }}
              style={inputStyle}
              required
            >
              {districtOptions.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Ortslage
            <select
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Alle Ortslagen im Kreis</option>
              {localityOptions.map((area) => (
                <option key={area.id} value={area.id}>
                  {formatLocalitySelectLabel(area.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={labelStyle}>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingStatus)}
            style={inputStyle}
            disabled={statusOptions.length === 1 && (status === 'cancelled' || status === 'expired')}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Preis
          <input
            type="number"
            min={fixedPortalFee}
            step="0.01"
            value={monthlyPrice}
            onChange={(event) => setMonthlyPrice(event.target.value)}
            style={inputStyle}
            required
          />
        </label>
      </div>

      <div style={{ borderRadius: 14, border: '1px solid #dbeafe', background: '#eff6ff', padding: '14px 16px', color: '#1e3a8a', display: 'grid', gap: 6 }}>
        <strong style={{ fontSize: 14 }}>Beispielrechnung</strong>
        <span style={{ fontSize: 14 }}>
          Preis {monthlyPriceValue.toFixed(2)} EUR minus Portalgebühr {fixedPortalFee.toFixed(2)} EUR ergibt
          {" "}
          <strong>{partnerNetRevenue.toFixed(2)} EUR</strong>
          {" "}
          Erlös für diese Buchung.
        </span>
        <span style={{ fontSize: 13, color: '#475569' }}>
          Der Preis muss mindestens {fixedPortalFee.toFixed(2)} EUR betragen.
        </span>
      </div>

      <label style={labelStyle}>
        Notiz
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          style={{ ...inputStyle, minHeight: 110 }}
          placeholder="Interne Notiz zur Buchung"
        />
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={submitting || networkPartners.length === 0 || areas.length === 0 || placementOptions.length === 0 || monthlyPriceValue < fixedPortalFee}
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
          {submitting ? 'Speichert...' : (submitLabel ?? (isEditing ? 'Buchung speichern' : 'Buchung anlegen'))}
        </button>
        {isEditing && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: 'fit-content',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Neue Buchung
          </button>
        ) : null}
      </div>
    </form>
  );
}
