'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { NetworkPartnerRecord, NetworkPartnerStatus } from '@/lib/network-partners/types';

type NetworkPartnerFormValues = {
  company_name: string;
  legal_name: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  status: NetworkPartnerStatus;
};

type NetworkPartnerFormProps = {
  initialValues?: Partial<NetworkPartnerRecord>;
  submitLabel: string;
  onSubmit: (values: NetworkPartnerFormValues) => Promise<void>;
  helperText?: string;
};

export default function NetworkPartnerForm({
  initialValues,
  submitLabel,
  onSubmit,
  helperText,
}: NetworkPartnerFormProps) {
  const [companyName, setCompanyName] = useState(initialValues?.company_name ?? '');
  const [legalName, setLegalName] = useState(initialValues?.legal_name ?? '');
  const [contactEmail, setContactEmail] = useState(initialValues?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(initialValues?.contact_phone ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initialValues?.website_url ?? '');
  const [status, setStatus] = useState<NetworkPartnerStatus>(initialValues?.status ?? 'active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCompanyName(initialValues?.company_name ?? '');
    setLegalName(initialValues?.legal_name ?? '');
    setContactEmail(initialValues?.contact_email ?? '');
    setContactPhone(initialValues?.contact_phone ?? '');
    setWebsiteUrl(initialValues?.website_url ?? '');
    setStatus(initialValues?.status ?? 'active');
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
      });
      if (!initialValues?.id) {
        setCompanyName('');
        setLegalName('');
        setContactEmail('');
        setContactPhone('');
        setWebsiteUrl('');
        setStatus('active');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="d-grid gap-3">
      <section className="d-grid gap-3">
        <div className="d-grid gap-1">
          <h3 className="m-0 fs-6 text-dark">Unternehmen</h3>
        </div>
        <label className="d-grid gap-2 small fw-semibold text-secondary">
          <span>Unternehmensname</span>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="form-control" required />
        </label>
      </section>

      <section className="d-grid gap-3">
        <div className="d-grid gap-1">
          <h3 className="m-0 fs-6 text-dark">Verantwortliche Person</h3>
          <p className="m-0 small text-secondary lh-base">
            Vorname und Nachname werden aktuell gemeinsam in einem Feld gepflegt.
          </p>
        </div>
        <label className="d-grid gap-2 small fw-semibold text-secondary">
          <span>Name</span>
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className="form-control"
            placeholder="Vorname Nachname"
          />
        </label>
      </section>

      <section className="d-grid gap-3">
        <div className="d-grid gap-1">
          <h3 className="m-0 fs-6 text-dark">Kontakt</h3>
        </div>
        <div className="row g-3">
          <label className="col-12 col-lg-4 d-grid gap-2 small fw-semibold text-secondary">
            <span>E-Mail</span>
            <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="form-control" required />
          </label>
          <label className="col-12 col-lg-4 d-grid gap-2 small fw-semibold text-secondary">
            <span>Telefon</span>
            <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="form-control" />
          </label>
          <label className="col-12 col-lg-4 d-grid gap-2 small fw-semibold text-secondary">
            <span>Website</span>
            <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className="form-control" />
          </label>
        </div>
      </section>

      <section className="d-grid gap-3">
        <div className="d-grid gap-1">
          <h3 className="m-0 fs-6 text-dark">Status</h3>
        </div>
        <label className="d-grid gap-2 small fw-semibold text-secondary">
          <span>Partnerstatus</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as NetworkPartnerStatus)} className="form-select">
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="inactive">Inaktiv</option>
          </select>
        </label>
      </section>

      {helperText ? (
        <p className="m-0 small text-secondary lh-base">
          {helperText}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-success fw-bold align-self-start px-3 py-2"
      >
        {submitting ? 'Speichert...' : submitLabel}
      </button>
    </form>
  );
}
