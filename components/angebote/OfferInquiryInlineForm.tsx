"use client";

import { useState, type FormEvent } from "react";
import { LeadConsentFields, type LeadConsentValue } from "@/components/LeadConsentFields";

type Props = {
  locale?: string;
  pagePath: string;
  regionLabel: string;
  showHeader?: boolean;
  introOverride?: string | null;
  offer: {
    id: string;
    title: string;
    objectType: string | null;
    address?: string | null;
  };
  context: {
    bundeslandSlug?: string;
    kreisSlug?: string;
    ortSlug?: string;
  };
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function OfferInquiryInlineForm(props: Props) {
  const locale = props.locale === "en" ? "en" : "de";
  const showHeader = props.showHeader !== false;
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    note: "",
  });
  const [consent, setConsent] = useState<LeadConsentValue>({
    privacy: false,
    forwarding: false,
  });

  const copy = locale === "en"
    ? {
        title: "Contact form",
        intro: "Use this form to request further information or a viewing for this property.",
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        phone: "Phone",
        note: "Short message",
        send: "Send inquiry",
        sending: "Sending...",
        success: "Your inquiry has been sent.",
        error: "The inquiry could not be sent right now.",
        consentError: "Please confirm the required consent fields.",
      }
    : {
        title: "Kontaktformular",
        intro: "Nutze dieses Formular, um weitere Informationen oder einen Besichtigungstermin für dieses Objekt anzufragen.",
        firstName: "Vorname",
        lastName: "Nachname",
        email: "E-Mail",
        phone: "Telefon",
        note: "Kurze Nachricht",
        send: "Anfrage senden",
        sending: "Wird gesendet...",
        success: "Deine Anfrage wurde versendet.",
        error: "Die Anfrage konnte gerade nicht versendet werden.",
        consentError: "Bitte bestätige die erforderlichen Zustimmungen.",
      };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    if (!consent.privacy || !consent.forwarding) {
      setState("error");
      setMessage(copy.consentError);
      return;
    }
    setState("submitting");
    setMessage(null);

    const response = await fetch("/api/offer-inquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale,
        sourceForm: "offer_inquiry_inline",
        pagePath: props.pagePath,
        regionLabel: props.regionLabel,
        offer: props.offer,
        context: props.context,
        contact: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
        inquiry: {
          message: form.note.trim(),
        },
        consent: {
          privacy: consent.privacy,
          forwarding: consent.forwarding,
        },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(
        body.error === "RATE_LIMIT"
          ? (locale === "en" ? "Please wait a moment before trying again." : "Bitte warte kurz, bevor du es erneut versuchst.")
          : body.error === "CONSENT_REQUIRED"
            ? copy.consentError
          : body.error === "ADVISOR_EMAIL_MISSING"
            ? (locale === "en" ? "No public advisor email is available for this area right now." : "Für dieses Gebiet ist aktuell keine öffentliche Beratermail hinterlegt.")
            : copy.error,
      );
      return;
    }

    setState("success");
    setMessage(copy.success);
  }

  return (
    <div className="request-offer-inline-block">
      {showHeader ? (
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{copy.title}</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{props.introOverride ?? copy.intro}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="request-offer-form-grid">
        <div className="request-offer-contact-grid">
          <div>
            <label className="form-label request-offer-required" htmlFor={`offer_inquiry_first_name_${props.offer.id}`}>{copy.firstName}</label>
            <input
              id={`offer_inquiry_first_name_${props.offer.id}`}
              className="form-control"
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              autoComplete="given-name"
              required
            />
          </div>
          <div>
            <label className="form-label request-offer-required" htmlFor={`offer_inquiry_last_name_${props.offer.id}`}>{copy.lastName}</label>
            <input
              id={`offer_inquiry_last_name_${props.offer.id}`}
              className="form-control"
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              autoComplete="family-name"
              required
            />
          </div>
        </div>
        <div className="request-offer-contact-grid">
          <div>
            <label className="form-label request-offer-required" htmlFor={`offer_inquiry_email_${props.offer.id}`}>{copy.email}</label>
            <input
              id={`offer_inquiry_email_${props.offer.id}`}
              className="form-control"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="form-label request-offer-required" htmlFor={`offer_inquiry_phone_${props.offer.id}`}>{copy.phone}</label>
            <input
              id={`offer_inquiry_phone_${props.offer.id}`}
              className="form-control"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              autoComplete="tel"
              required
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor={`offer_inquiry_note_${props.offer.id}`}>{copy.note}</label>
          <textarea
            id={`offer_inquiry_note_${props.offer.id}`}
            className="form-control"
            rows={5}
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder={locale === "en" ? "Write your inquiry briefly" : "Beschreibe dein Anliegen kurz"}
            required
          />
        </div>
        <LeadConsentFields locale={locale} value={consent} onChange={setConsent} />
        {message ? (
          <div className={`alert ${state === "success" ? "alert-success" : "alert-danger"}`} role="status" style={{ marginBottom: 0 }}>
            {message}
          </div>
        ) : null}
        <button
          type="submit"
          className="btn btn-dark w-100 request-offer-submit"
          disabled={state === "submitting" || state === "success"}
        >
          {state === "submitting" ? copy.sending : copy.send}
        </button>
      </form>
    </div>
  );
}
