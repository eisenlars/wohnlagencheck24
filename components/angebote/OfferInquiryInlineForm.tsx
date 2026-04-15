"use client";

import { useState, type FormEvent } from "react";

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
    name: "",
    email: "",
    phone: "",
    propertyLocation: props.offer.address ?? "",
    note: "",
  });

  const copy = locale === "en"
    ? {
        title: "Contact form",
        intro: "Use this form to request further information or a viewing for this property.",
        name: "Name",
        email: "Email",
        phone: "Phone",
        propertyLocation: "Property location",
        note: "Short message",
        send: "Send inquiry",
        sending: "Sending...",
        success: "Your inquiry has been sent.",
        error: "The inquiry could not be sent right now.",
      }
    : {
        title: "Kontaktformular",
        intro: "Nutze dieses Formular, um weitere Informationen oder einen Besichtigungstermin für dieses Objekt anzufragen.",
        name: "Name",
        email: "E-Mail",
        phone: "Telefon",
        propertyLocation: "Standort des Objekts",
        note: "Kurze Nachricht",
        send: "Anfrage senden",
        sending: "Wird gesendet...",
        success: "Deine Anfrage wurde versendet.",
        error: "Die Anfrage konnte gerade nicht versendet werden.",
      };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setMessage(null);

    const response = await fetch("/api/offer-inquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale,
        pagePath: props.pagePath,
        regionLabel: props.regionLabel,
        offer: props.offer,
        context: props.context,
        contact: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
        inquiry: {
          location: form.propertyLocation.trim(),
          message: form.note.trim(),
        },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(
        body.error === "RATE_LIMIT"
          ? (locale === "en" ? "Please wait a moment before trying again." : "Bitte warte kurz, bevor du es erneut versuchst.")
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
        <div>
          <label className="form-label request-offer-required" htmlFor={`offer_inquiry_name_${props.offer.id}`}>{copy.name}</label>
          <input
            id={`offer_inquiry_name_${props.offer.id}`}
            className="form-control"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            autoComplete="name"
            required
          />
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
          <label className="form-label" htmlFor={`offer_inquiry_location_${props.offer.id}`}>{copy.propertyLocation}</label>
          <input
            id={`offer_inquiry_location_${props.offer.id}`}
            className="form-control"
            value={form.propertyLocation}
            onChange={(event) => setForm((current) => ({ ...current, propertyLocation: event.target.value }))}
            placeholder={locale === "en" ? "City, district or address" : "Ort, Stadtteil oder Adresse"}
            required
          />
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
