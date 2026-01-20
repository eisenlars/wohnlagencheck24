// components/kontakt/KontaktForm.tsx

"use client";

import { useState } from "react";

type KontaktFormProps = {
  targetEmail: string;
  scope: "portal" | "berater" | "makler";
  regionLabel?: string;
};

export function KontaktForm({ targetEmail, scope, regionLabel }: KontaktFormProps) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="alert alert-success" role="status">
        Vielen Dank! Ihre Anfrage wurde gesendet. Wir melden uns zeitnah bei Ihnen.
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="mb-3">
        <label className="form-label" htmlFor="kontakt_name">Name</label>
        <input className="form-control" id="kontakt_name" name="name" autoComplete="name" required />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="kontakt_email">E-Mail</label>
        <input className="form-control" id="kontakt_email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="kontakt_phone">Telefon</label>
        <input className="form-control" id="kontakt_phone" name="phone" autoComplete="tel" />
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="kontakt_msg">Nachricht</label>
        <textarea className="form-control" id="kontakt_msg" name="message" rows={5} required />
      </div>

      {/* Hidden target */}
      <input type="hidden" name="targetEmail" value={targetEmail} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="regionLabel" value={regionLabel ?? ""} />

      <button type="submit" className="btn btn-dark w-100">
        Senden
      </button>
    </form>
  );
}
