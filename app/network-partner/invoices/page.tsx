'use client';

import { useEffect, useState } from 'react';

import InvoiceList from '@/components/network-partners/self-service/InvoiceList';
import NetworkPartnerShell from '@/components/network-partners/self-service/NetworkPartnerShell';
import { redirectIfUnauthorizedResponse } from '@/lib/auth/client-auth-redirect';
import type {
  NetworkBillingProjectionRow,
  NetworkPartnerInvoiceLineRecord,
} from '@/lib/network-partners/types';

type InvoicesPayload = {
  invoice_lines?: NetworkPartnerInvoiceLineRecord[];
  booking_projection?: NetworkBillingProjectionRow[];
  invoice_table_available?: boolean;
  error?: string;
};

export default function NetworkPartnerInvoicesPage() {
  const [invoiceLines, setInvoiceLines] = useState<NetworkPartnerInvoiceLineRecord[]>([]);
  const [bookingProjection, setBookingProjection] = useState<NetworkBillingProjectionRow[]>([]);
  const [invoiceTableAvailable, setInvoiceTableAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/network-partner/invoices', { method: 'GET', cache: 'no-store' });
      if (redirectIfUnauthorizedResponse(response, 'network_partner')) return;
      const payload = (await response.json().catch(() => null)) as InvoicesPayload | null;
      if (!active) return;
      if (!response.ok) {
        setInvoiceLines([]);
        setBookingProjection([]);
        setInvoiceTableAvailable(false);
        setError(String(payload?.error ?? 'Rechnungen konnten nicht geladen werden.'));
        setLoading(false);
        return;
      }
      setInvoiceLines(Array.isArray(payload?.invoice_lines) ? payload.invoice_lines : []);
      setBookingProjection(Array.isArray(payload?.booking_projection) ? payload.booking_projection : []);
      setInvoiceTableAvailable(payload?.invoice_table_available === true);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <NetworkPartnerShell
      title="Meine Rechnungen"
      description="Der Netzwerkpartner sieht hier die eigenen Rechnungszeilen. Solange noch keine Faktura geschrieben wird, dient die Buchungsbasis als operative Vorschau."
    >
      {error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p> : null}
      {loading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Lädt...</p>
      ) : (
        <InvoiceList
          invoiceLines={invoiceLines}
          bookingProjection={bookingProjection}
          invoiceTableAvailable={invoiceTableAvailable}
        />
      )}
    </NetworkPartnerShell>
  );
}
