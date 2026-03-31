'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { NetworkPartnerRecord, NetworkPartnerStatus } from '@/lib/network-partners/types';

type NetworkPartnerFormValues = {
  company_name: string;
  legal_name: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  status: NetworkPartnerStatus;
  managed_editing_enabled: boolean;
};

type NetworkPartnerFormProps = {
  initialValues?: Partial<NetworkPartnerRecord>;
  submitLabel: string;
  onSubmit: (values: NetworkPartnerFormValues) => Promise<void>;
  helperText?: string;
  showManagedEditingField?: boolean;
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

export default function NetworkPartnerForm({
  initialValues,
  submitLabel,
  onSubmit,
  helperText,
  showManagedEditingField = true,
}: NetworkPartnerFormProps) {
  const [companyName, setCompanyName] = useState(initialValues?.company_name ?? '');
  const [legalName, setLegalName] = useState(initialValues?.legal_name ?? '');
  const [contactEmail, setContactEmail] = useState(initialValues?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(initialValues?.contact_phone ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initialValues?.website_url ?? '');
  const [status, setStatus] = useState<NetworkPartnerStatus>(initialValues?.status ?? 'active');
  const [managedEditingEnabled, setManagedEditingEnabled] = useState(Boolean(initialValues?.managed_editing_enabled));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCompanyName(initialValues?.company_name ?? '');
    setLegalName(initialValues?.legal_name ?? '');
    setContactEmail(initialValues?.contact_email ?? '');
    setContactPhone(initialValues?.contact_phone ?? '');
    setWebsiteUrl(initialValues?.website_url ?? '');
    setStatus(initialValues?.status ?? 'active');
    setManagedEditingEnabled(Boolean(initialValues?.managed_editing_enabled));
  }, [initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        company_name: companyName,
        legal_name: legalName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        website_url: websiteUrl,
        status,
        managed_editing_enabled: managedEditingEnabled,
      });
      if (!initialValues?.id) {
        setCompanyName('');
        setLegalName('');
        setContactEmail('');
        setContactPhone('');
        setWebsiteUrl('');
        setStatus('active');
        setManagedEditingEnabled(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={labelStyle}>
          Unternehmensname
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Rechtlicher Name
          <input value={legalName} onChange={(event) => setLegalName(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Kontakt-E-Mail
          <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Kontakt-Telefon
          <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Website
          <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as NetworkPartnerStatus)} style={inputStyle}>
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="inactive">Inaktiv</option>
          </select>
        </label>
      </div>

      {showManagedEditingField ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#334155', fontSize: 13, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={managedEditingEnabled}
            onChange={(event) => setManagedEditingEnabled(event.target.checked)}
          />
          Portal-Partner darf Inhalte des Netzwerkpartners direkt bearbeiten
        </label>
      ) : null}

      {helperText ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
          {helperText}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
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
        {submitting ? 'Speichert...' : submitLabel}
      </button>
    </form>
  );
}
