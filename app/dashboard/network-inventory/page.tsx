'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import InventoryForm from '@/components/network-partners/InventoryForm';
import InventoryTable from '@/components/network-partners/InventoryTable';
import type { PartnerAreaInventoryRecord, PlacementCatalogRecord } from '@/lib/network-partners/types';
import {
  workflowHeaderStyle,
  workflowPanelCardStyle,
  workflowTopCardStyle,
} from '@/app/dashboard/workflow-ui';

type AreaOption = {
  id: string;
  label: string;
};

type InventoryPayload = {
  inventory?: PartnerAreaInventoryRecord[];
  placement_catalog?: PlacementCatalogRecord[];
  error?: string;
};

type BootstrapPayload = {
  configs?: Array<{
    area_id?: string;
    areas?: { name?: string };
  }>;
};

function mapAreaLabel(areaId: string, areaName?: string): string {
  return areaName ? `${areaId} ${areaName}` : areaId;
}

export default function NetworkInventoryPage() {
  const [inventory, setInventory] = useState<PartnerAreaInventoryRecord[]>([]);
  const [placements, setPlacements] = useState<PlacementCatalogRecord[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchPageData() {
    const [inventoryResponse, bootstrapResponse] = await Promise.all([
      fetch('/api/partner/network-inventory', { method: 'GET', cache: 'no-store' }),
      fetch('/api/partner/dashboard/bootstrap', { method: 'GET', cache: 'no-store' }),
    ]);

    const inventoryPayload = (await inventoryResponse.json().catch(() => null)) as InventoryPayload | null;
    const bootstrapPayload = (await bootstrapResponse.json().catch(() => null)) as BootstrapPayload | null;
    return { inventoryResponse, inventoryPayload, bootstrapPayload };
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { inventoryResponse, inventoryPayload, bootstrapPayload } = await fetchPageData();
      if (!active) return;
      if (!inventoryResponse.ok) {
        setInventory([]);
        setPlacements([]);
        setAreas([]);
        setError(String(inventoryPayload?.error ?? 'Inventar konnte nicht geladen werden.'));
        setLoading(false);
        return;
      }

      const nextAreas = Array.from(new Map(
        (Array.isArray(bootstrapPayload?.configs) ? bootstrapPayload.configs : [])
          .map((config) => {
            const areaId = String(config.area_id ?? '').trim();
            if (!areaId) return null;
            return [areaId, { id: areaId, label: mapAreaLabel(areaId, config.areas?.name) }];
          })
          .filter((entry): entry is [string, AreaOption] => Boolean(entry)),
      ).values());

      setInventory(Array.isArray(inventoryPayload?.inventory) ? inventoryPayload.inventory : []);
      setPlacements(Array.isArray(inventoryPayload?.placement_catalog) ? inventoryPayload.placement_catalog : []);
      setAreas(nextAreas);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const activeAreaCount = useMemo(() => new Set(inventory.map((entry) => entry.area_id)).size, [inventory]);

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 56px', display: 'grid', gap: 18 }}>
      <section style={workflowTopCardStyle}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Netzwerkpartner-Plattform
          </span>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, lineHeight: 1.2 }}>Inventar pro Gebiet</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 760, lineHeight: 1.6 }}>
            Hier wird festgelegt, welche Placements in welchen Partnergebieten überhaupt verkauft werden dürfen.
          </p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#fff', fontWeight: 700 }}>
            <span>Gebiete mit Inventar: {activeAreaCount}</span>
            <Link href="/dashboard/network-partners" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Netzwerkpartner
            </Link>
            <Link href="/dashboard/network-bookings" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Buchungen
            </Link>
            <Link href="/dashboard/network-content" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Content & Review
            </Link>
            <Link href="/dashboard/network-billing" style={{ color: '#fff', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Billing
            </Link>
          </div>
        </div>
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Inventar anlegen</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Buchungen sind nur auf aktivem Inventar möglich. Die Platztypen kommen direkt aus dem zentralen Placement-Katalog.
          </p>
        </div>
        {message ? <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{message}</p> : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
        <InventoryForm
          areas={areas}
          placements={placements}
          onSubmit={async (values) => {
            setError(null);
            setMessage(null);
            const response = await fetch('/api/partner/network-inventory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
              setError(String(payload?.error ?? 'Inventar konnte nicht angelegt werden.'));
              return;
            }
            setMessage('Inventar wurde angelegt.');
            setLoading(true);
            const { inventoryResponse, inventoryPayload, bootstrapPayload } = await fetchPageData();
            if (!inventoryResponse.ok) {
              setInventory([]);
              setPlacements([]);
              setAreas([]);
              setError(String(inventoryPayload?.error ?? 'Inventar konnte nicht geladen werden.'));
              setLoading(false);
              return;
            }
            const nextAreas = Array.from(new Map(
              (Array.isArray(bootstrapPayload?.configs) ? bootstrapPayload.configs : [])
                .map((config) => {
                  const areaId = String(config.area_id ?? '').trim();
                  if (!areaId) return null;
                  return [areaId, { id: areaId, label: mapAreaLabel(areaId, config.areas?.name) }];
                })
                .filter((entry): entry is [string, AreaOption] => Boolean(entry)),
            ).values());
            setInventory(Array.isArray(inventoryPayload?.inventory) ? inventoryPayload.inventory : []);
            setPlacements(Array.isArray(inventoryPayload?.placement_catalog) ? inventoryPayload.placement_catalog : []);
            setAreas(nextAreas);
            setLoading(false);
          }}
        />
      </section>

      <section style={workflowPanelCardStyle}>
        <div style={workflowHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Aktuelles Inventar</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Die Tabelle zeigt den aktuellen Verkaufsscope des Portal-Partners über alle zugeordneten Gebiete.
          </p>
        </div>
        {loading ? (
          <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
        ) : (
          <InventoryTable inventory={inventory} areas={areas} placements={placements} />
        )}
      </section>
    </main>
  );
}
