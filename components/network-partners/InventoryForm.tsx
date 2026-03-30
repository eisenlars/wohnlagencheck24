'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { PlacementCatalogRecord, PlacementCode } from '@/lib/network-partners/types';

type AreaOption = {
  id: string;
  label: string;
};

type InventoryFormValues = {
  area_id: string;
  placement_code: PlacementCode;
  slot_limit: number;
  is_active: boolean;
};

type InventoryFormProps = {
  areas: AreaOption[];
  placements: PlacementCatalogRecord[];
  onSubmit: (values: InventoryFormValues) => Promise<void>;
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

export default function InventoryForm({ areas, placements, onSubmit }: InventoryFormProps) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [placementCode, setPlacementCode] = useState<PlacementCode | ''>(placements[0]?.code ?? '');
  const [slotLimit, setSlotLimit] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!areaId && areas[0]?.id) {
      setAreaId(areas[0].id);
    }
  }, [areaId, areas]);

  useEffect(() => {
    if (!placementCode && placements[0]?.code) {
      setPlacementCode(placements[0].code);
    }
  }, [placementCode, placements]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaId || !placementCode) return;
    setSubmitting(true);
    try {
      await onSubmit({
        area_id: areaId,
        placement_code: placementCode,
        slot_limit: Number(slotLimit),
        is_active: isActive,
      });
      setSlotLimit('1');
      setIsActive(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
            {placements.map((placement) => (
              <option key={placement.code} value={placement.code}>
                {placement.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Slot-Limit
          <input
            type="number"
            min={1}
            value={slotLimit}
            onChange={(event) => setSlotLimit(event.target.value)}
            style={inputStyle}
            required
          />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#334155', fontSize: 13, fontWeight: 600 }}>
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        Werbeformat sofort aktiv schalten
      </label>

      <button
        type="submit"
        disabled={submitting || areas.length === 0 || placements.length === 0}
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
        {submitting ? 'Speichert...' : 'Werbeformat anlegen'}
      </button>
    </form>
  );
}
