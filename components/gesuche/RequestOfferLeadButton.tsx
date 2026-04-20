"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import type { RequestMode } from "@/lib/gesuche";

type RequestOfferLeadButtonProps = {
  label: string;
  locale?: string;
  className?: string;
  style?: CSSProperties;
  mode?: RequestMode;
  intent?: "offer" | "tip";
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

const labelStyle: CSSProperties = {
  color: "#0f172a",
  fontWeight: 650,
};

const consentListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 13px",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
};

const consentLabelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
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
    privacyConsent: false,
    tipConsent: false,
  });

  const locale = props.locale === "en" ? "en" : "de";
  const isTip = props.intent === "tip";
  const copy = locale === "en"
    ? isTip
      ? {
          title: "Send a confidential tip",
          intro: "Share a confidential hint. The request goes directly to the responsible advisor.",
          name: "Your name",
          email: "Email",
          phone: "Phone",
          propertyLocation: "Known location",
          note: "Who or what should we know about?",
          locationPlaceholder: "City, district or rough location",
          notePlaceholder: "Briefly describe the owner or property hint",
          privacyConsent: "I agree that my details will be processed to handle this tip and forwarded to the responsible advisor.",
          tipConsent: "I submit this tip voluntarily and confirm that I am allowed to share the information. Any possible tip commission will be reviewed and agreed separately.",
          cancel: "Cancel",
          send: "Send confidential tip",
          sending: "Sending...",
          success: "Your tip has been sent.",
          error: "The tip could not be sent right now.",
          consentError: "Please confirm the required consent fields.",
        }
      : {
          title: "Offer property",
          intro: "Submit your property in a few steps. The request goes directly to the responsible advisor.",
          name: "Name",
          email: "Email",
          phone: "Phone",
          propertyLocation: "Property location",
          note: "Short message",
          locationPlaceholder: "City, district or address",
          notePlaceholder: "Briefly describe the property",
          privacyConsent: "",
          tipConsent: "",
          cancel: "Cancel",
          send: "Send offer",
          sending: "Sending...",
          success: "Your property offer has been sent.",
          error: "The offer could not be sent right now.",
          consentError: "",
        }
    : isTip
      ? {
          title: "Tippgeber-Hinweis senden",
          intro: "Geben Sie einen vertraulichen Hinweis. Die Nachricht geht direkt an den zuständigen Berater.",
          name: "Ihr Name",
          email: "E-Mail",
          phone: "Telefon",
          propertyLocation: "Bekannter Standort",
          note: "Wen oder welches Objekt sollten wir kennen?",
          locationPlaceholder: "Ort, Stadtteil oder grobe Lage",
          notePlaceholder: "Beschreiben Sie den Tipp kurz",
          privacyConsent: "Ich bin einverstanden, dass meine Angaben zur Bearbeitung dieses Hinweises verarbeitet und an den zuständigen Ansprechpartner weitergeleitet werden.",
          tipConsent: "Ich gebe diesen Hinweis freiwillig ab und bestätige, zur Weitergabe der Informationen berechtigt zu sein. Eine mögliche Tippgebervergütung wird gesondert geprüft und vereinbart.",
          cancel: "Abbrechen",
          send: "Hinweis vertraulich senden",
          sending: "Wird gesendet...",
          success: "Ihr Hinweis wurde versendet.",
          error: "Der Hinweis konnte gerade nicht versendet werden.",
          consentError: "Bitte bestätige die erforderlichen Zustimmungen.",
        }
      : {
          title: "Objekt anbieten",
          intro: "Biete dein Objekt in wenigen Schritten an. Die Anfrage geht direkt an den zuständigen Berater.",
          name: "Name",
          email: "E-Mail",
          phone: "Telefon",
          propertyLocation: "Standort des Objekts",
          note: "Kurze Nachricht",
          locationPlaceholder: "Ort, Stadtteil oder Adresse",
          notePlaceholder: "Beschreibe das Objekt kurz",
          privacyConsent: "",
          tipConsent: "",
          cancel: "Abbrechen",
          send: "Objekt anbieten",
          sending: "Wird gesendet...",
          success: "Dein Objektangebot wurde versendet.",
          error: "Das Objektangebot konnte gerade nicht versendet werden.",
          consentError: "",
        };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    if (isTip && (!form.privacyConsent || !form.tipConsent)) {
      setState("error");
      setMessage(copy.consentError);
      return;
    }
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
          message: isTip ? `[Tippgeber-Hinweis] ${form.note.trim()}` : form.note.trim(),
        },
        consent: isTip
          ? {
              privacy: form.privacyConsent,
              tipTerms: form.tipConsent,
            }
          : undefined,
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
                  <label className="form-label request-offer-required" htmlFor={`offer_name_${props.request.id}`} style={labelStyle}>{copy.name}</label>
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
                    <label className="form-label request-offer-required" htmlFor={`offer_email_${props.request.id}`} style={labelStyle}>{copy.email}</label>
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
                    <label className="form-label request-offer-required" htmlFor={`offer_phone_${props.request.id}`} style={labelStyle}>{copy.phone}</label>
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
                  <label className="form-label request-offer-required" htmlFor={`offer_location_${props.request.id}`} style={labelStyle}>{copy.propertyLocation}</label>
                  <input
                    id={`offer_location_${props.request.id}`}
                    className="form-control"
                    value={form.propertyLocation}
                    onChange={(event) => setForm((current) => ({ ...current, propertyLocation: event.target.value }))}
                    placeholder={copy.locationPlaceholder}
                    required
                  />
                </div>
                <div>
                  <label className="form-label request-offer-required" htmlFor={`offer_note_${props.request.id}`} style={labelStyle}>{copy.note}</label>
                  <textarea
                    id={`offer_note_${props.request.id}`}
                    className="form-control"
                    rows={4}
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder={copy.notePlaceholder}
                    required
                  />
                </div>
                {isTip ? (
                  <div style={consentListStyle}>
                    <label style={consentLabelStyle}>
                      <input
                        type="checkbox"
                        checked={form.privacyConsent}
                        onChange={(event) => setForm((current) => ({ ...current, privacyConsent: event.target.checked }))}
                        required
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        {copy.privacyConsent}{" "}
                        <a href={locale === "en" ? "/en/datenschutz" : "/datenschutz"} target="_blank" rel="noreferrer" style={{ color: "#486b7a", fontWeight: 800 }}>
                          {locale === "en" ? "Privacy policy" : "Datenschutzerklärung"}
                        </a>
                      </span>
                    </label>
                    <label style={consentLabelStyle}>
                      <input
                        type="checkbox"
                        checked={form.tipConsent}
                        onChange={(event) => setForm((current) => ({ ...current, tipConsent: event.target.checked }))}
                        required
                        style={{ marginTop: 3 }}
                      />
                      <span>{copy.tipConsent}</span>
                    </label>
                  </div>
                ) : null}
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
                <button
                  type="submit"
                  className="btn request-offer-submit"
                  disabled={state === "submitting" || state === "success"}
                  style={isTip ? tipSubmitStyle : defaultSubmitStyle}
                >
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

const defaultSubmitStyle: CSSProperties = {
  background: "#0f172a",
  borderColor: "#0f172a",
  color: "#fff",
};

const tipSubmitStyle: CSSProperties = {
  background: "#facc15",
  borderColor: "#facc15",
  color: "#0f172a",
  fontWeight: 850,
};
