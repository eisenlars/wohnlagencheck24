"use client";

import { useState, type FormEvent } from "react";
import type { RequestMode } from "@/lib/gesuche";

type Props = {
  locale?: string;
  mode: RequestMode;
  pagePath: string;
  regionLabel: string;
  request: {
    id: string;
    title: string;
    objectType: string | null;
  };
  context: {
    bundeslandSlug?: string;
    kreisSlug?: string;
    ortSlug?: string;
  };
  hideHeading?: boolean;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function RequestOfferLeadInlineForm(props: Props) {
  const locale = props.locale === "en" ? "en" : "de";
  const isRental = props.mode === "miete";
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    propertyLocation: "",
    note: "",
  });

  const copy = locale === "en"
    ? {
        title: "Offer property",
        intro: "Submit your property directly for this request.",
        name: "Name",
        email: "Email",
        phone: "Phone",
        propertyLocation: "Property location",
        note: "Short message",
        send: "Send offer",
        sending: "Sending...",
        success: "Your property offer has been sent.",
        error: "The offer could not be sent right now.",
      }
    : {
        title: "Passt Ihre Immobilie?",
        intro: isRental
          ? "Sie möchten vermieten und Ihre Immobilie passt zu dieser Suchanfrage? Dann nehmen Sie hier Kontakt auf."
          : "Sie möchten verkaufen und Ihre Immobilie passt zu dieser Suchanfrage? Dann nehmen Sie hier Kontakt auf.",
        name: "Name",
        email: "E-Mail",
        phone: "Telefon",
        propertyLocation: "Standort des Objekts",
        note: "Kurze Nachricht",
        send: isRental ? "Mietinteressenten kennenlernen" : "Interessenten kennenlernen",
        sending: "Wird gesendet...",
        success: "Dein Objektangebot wurde versendet.",
        error: "Das Objektangebot konnte gerade nicht versendet werden.",
      };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setMessage(null);

    const response = await fetch("/api/request-offer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale,
        pagePath: props.pagePath,
        regionLabel: props.regionLabel,
        request: props.request,
        context: props.context,
        contact: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
        property: {
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
    <div id="request-offer-form" className="request-offer-inline-block">
      {!props.hideHeading ? (
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{copy.title}</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{copy.intro}</p>
        </div>
      ) : (
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{copy.intro}</p>
      )}

      <form onSubmit={handleSubmit} className="request-offer-form-grid">
        <div>
          <label className="form-label request-offer-required" htmlFor={`inline_offer_name_${props.request.id}`}>{copy.name}</label>
          <input
            id={`inline_offer_name_${props.request.id}`}
            className="form-control"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            autoComplete="name"
            required
          />
        </div>
        <div className="request-offer-contact-grid">
          <div>
            <label className="form-label request-offer-required" htmlFor={`inline_offer_email_${props.request.id}`}>{copy.email}</label>
            <input
              id={`inline_offer_email_${props.request.id}`}
              className="form-control"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="form-label request-offer-required" htmlFor={`inline_offer_phone_${props.request.id}`}>{copy.phone}</label>
            <input
              id={`inline_offer_phone_${props.request.id}`}
              className="form-control"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              autoComplete="tel"
              required
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor={`inline_offer_location_${props.request.id}`}>{copy.propertyLocation}</label>
          <input
            id={`inline_offer_location_${props.request.id}`}
            className="form-control"
            value={form.propertyLocation}
            onChange={(event) => setForm((current) => ({ ...current, propertyLocation: event.target.value }))}
            placeholder={locale === "en" ? "City, district or address" : "Ort, Stadtteil oder Adresse"}
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor={`inline_offer_note_${props.request.id}`}>{copy.note}</label>
          <textarea
            id={`inline_offer_note_${props.request.id}`}
            className="form-control"
            rows={5}
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder={locale === "en" ? "Briefly describe the property" : "Beschreibe das Objekt kurz"}
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
