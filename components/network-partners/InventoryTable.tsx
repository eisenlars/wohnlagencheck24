'use client';

import type { PartnerAreaInventoryRecord, PlacementCatalogRecord } from '@/lib/network-partners/types';

type AreaOption = {
  id: string;
  label: string;
};

type InventoryTableProps = {
  inventory: PartnerAreaInventoryRecord[];
  areas: AreaOption[];
  placements: PlacementCatalogRecord[];
};

function findAreaLabel(areas: AreaOption[], areaId: string): string {
  return areas.find((area) => area.id === areaId)?.label ?? areaId;
}

function findPlacementLabel(placements: PlacementCatalogRecord[], code: string): string {
  return placements.find((placement) => placement.code === code)?.label ?? code;
}

export default function InventoryTable({ inventory, areas, placements }: InventoryTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '10px 12px' }}>Gebiet</th>
            <th style={{ padding: '10px 12px' }}>Placement</th>
            <th style={{ padding: '10px 12px' }}>Slot-Limit</th>
            <th style={{ padding: '10px 12px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((entry) => (
            <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px', color: '#0f172a' }}>{findAreaLabel(areas, entry.area_id)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{findPlacementLabel(placements, entry.placement_code)}</td>
              <td style={{ padding: '12px', color: '#334155' }}>{entry.slot_limit}</td>
              <td style={{ padding: '12px', color: entry.is_active ? '#166534' : '#92400e' }}>
                {entry.is_active ? 'Aktiv' : 'Inaktiv'}
              </td>
            </tr>
          ))}
          {inventory.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '18px 12px', color: '#64748b' }}>
                Noch keine Werbeformate für Netzwerkpartner angelegt.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
