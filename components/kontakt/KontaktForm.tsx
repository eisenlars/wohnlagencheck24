// components/kontakt/KontaktForm.tsx

"use client";

import { useId, useState } from "react";
import { LeadConsentFields, type LeadConsentValue } from "@/components/LeadConsentFields";

type KontaktFormProps = {
  targetEmail: string;
  scope: "portal" | "berater" | "makler";
  regionLabel?: string;
};

export function KontaktForm({ targetEmail, scope, regionLabel }: KontaktFormProps) {
  const formId = useId();
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState<LeadConsentValue>({
    privacy: false,
    forwarding: false,
  });
  const [consentError, setConsentError] = useState(false);

  if (submitted) {
    return (
      <div className="alert alert-success" role="status">
        Vielen Dank! Ihre Anfrage wurde gesendet. Wir melden uns zeitnah bei Ihnen.
      </div>
    );
  }

  return (
    <form
      className="request-offer-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        if (!consent.privacy || !consent.forwarding) {
          setConsentError(true);
          return;
        }
        setConsentError(false);
        setSubmitted(true);
      }}
    >
      <div className="request-offer-contact-grid">
        <div>
          <label className="form-label request-offer-required" htmlFor={`${formId}-kontakt-first-name`}>Vorname</label>
          <input className="form-control" id={`${formId}-kontakt-first-name`} name="firstName" autoComplete="given-name" required />
        </div>
        <div>
          <label className="form-label request-offer-required" htmlFor={`${formId}-kontakt-last-name`}>Nachname</label>
          <input className="form-control" id={`${formId}-kontakt-last-name`} name="lastName" autoComplete="family-name" required />
        </div>
      </div>

      <div>
        <label className="form-label request-offer-required" htmlFor={`${formId}-kontakt-email`}>E-Mail</label>
        <input className="form-control" id={`${formId}-kontakt-email`} name="email" type="email" autoComplete="email" required />
      </div>

      <div>
        <label className="form-label request-offer-required" htmlFor={`${formId}-kontakt-phone`}>Telefon</label>
        <input className="form-control" id={`${formId}-kontakt-phone`} name="phone" autoComplete="tel" required />
      </div>

      <div>
        <label className="form-label request-offer-required" htmlFor={`${formId}-kontakt-msg`}>Nachricht</label>
        <textarea className="form-control" id={`${formId}-kontakt-msg`} name="message" rows={5} required />
      </div>

      <LeadConsentFields value={consent} onChange={setConsent} />

      {consentError ? (
        <div className="alert alert-danger" role="status" style={{ marginBottom: 0 }}>
          Bitte bestätigen Sie die erforderlichen Zustimmungen.
        </div>
      ) : null}

      {/* Hidden target */}
      <input type="hidden" name="targetEmail" value={targetEmail} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="regionLabel" value={regionLabel ?? ""} />

      <button type="submit" className="btn btn-dark w-100 request-offer-submit">
        Senden
      </button>
    </form>
  );
}
