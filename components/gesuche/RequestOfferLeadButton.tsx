"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

type RequestOfferLeadButtonProps = {
  label: string;
  locale?: string;
  className?: string;
  style?: CSSProperties;
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
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.62)",
  display: "grid",
  placeItems: "center",
  padding: "1rem",
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  width: "min(100%, 560px)",
  background: "#fff",
  borderRadius: "1rem",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  padding: "1rem 1.25rem",
  background: "#486b7a",
  color: "#fff",
};

const bodyStyle: CSSProperties = {
  padding: "1.25rem",
};

const footerStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  justifyContent: "flex-end",
  padding: "0 1.25rem 1.25rem",
};

export function RequestOfferLeadButton(props: RequestOfferLeadButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    propertyLocation: "",
    note: "",
  });

  const locale = props.locale === "en" ? "en" : "de";
  const copy = locale === "en"
    ? {
        title: "Offer property",
        intro: "Submit your property in a few steps. The request goes directly to the responsible advisor.",
        name: "Name",
        email: "Email",
        phone: "Phone",
        propertyLocation: "Property location",
        note: "Short message",
        cancel: "Cancel",
        send: "Send offer",
        sending: "Sending...",
        success: "Your property offer has been sent.",
        error: "The offer could not be sent right now.",
      }
    : {
        title: "Objekt anbieten",
        intro: "Biete dein Objekt in wenigen Schritten an. Die Anfrage geht direkt an den zuständigen Berater.",
        name: "Name",
        email: "E-Mail",
        phone: "Telefon",
        propertyLocation: "Standort des Objekts",
        note: "Kurze Nachricht",
        cancel: "Abbrechen",
        send: "Objekt anbieten",
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
    <>
      <button
        type="button"
        className={props.className ?? "btn btn-outline-dark btn-sm angebote-card-cta"}
        style={props.style}
        onClick={() => setOpen(true)}
      >
        {props.label}
      </button>
      {open ? (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={copy.title}>
          <div style={modalStyle}>
            <div style={headerStyle}>
              <strong style={{ display: "block", marginBottom: 4 }}>{copy.title}</strong>
              <span style={{ fontSize: "0.95rem", opacity: 0.92 }}>{props.request.title}</span>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={bodyStyle} className="request-offer-form-grid">
                <p style={{ margin: 0, color: "#475569" }}>{copy.intro}</p>
                <div>
                  <label className="form-label request-offer-required" htmlFor={`offer_name_${props.request.id}`}>{copy.name}</label>
                  <input
                    id={`offer_name_${props.request.id}`}
                    className="form-control"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="request-offer-contact-grid">
                  <div>
                    <label className="form-label request-offer-required" htmlFor={`offer_email_${props.request.id}`}>{copy.email}</label>
                    <input
                      id={`offer_email_${props.request.id}`}
                      className="form-control"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label request-offer-required" htmlFor={`offer_phone_${props.request.id}`}>{copy.phone}</label>
                    <input
                      id={`offer_phone_${props.request.id}`}
                      className="form-control"
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" htmlFor={`offer_location_${props.request.id}`}>{copy.propertyLocation}</label>
                  <input
                    id={`offer_location_${props.request.id}`}
                    className="form-control"
                    value={form.propertyLocation}
                    onChange={(event) => setForm((current) => ({ ...current, propertyLocation: event.target.value }))}
                    placeholder={locale === "en" ? "City, district or address" : "Ort, Stadtteil oder Adresse"}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor={`offer_note_${props.request.id}`}>{copy.note}</label>
                  <textarea
                    id={`offer_note_${props.request.id}`}
                    className="form-control"
                    rows={4}
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
              </div>
              <div style={footerStyle}>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setOpen(false)}>
                  {copy.cancel}
                </button>
                <button type="submit" className="btn btn-dark request-offer-submit" disabled={state === "submitting" || state === "success"}>
                  {state === "submitting" ? copy.sending : copy.send}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
