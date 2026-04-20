"use client";

import type { CSSProperties } from "react";

export type LeadConsentValue = {
  privacy: boolean;
  forwarding: boolean;
  tipTerms?: boolean;
};

type Props = {
  locale?: string;
  value: LeadConsentValue;
  onChange: (next: LeadConsentValue) => void;
  includeTipTerms?: boolean;
};

export function LeadConsentFields({ locale = "de", value, onChange, includeTipTerms = false }: Props) {
  const isEnglish = locale === "en";
  const privacyHref = isEnglish ? "/en/datenschutz" : "/datenschutz";
  const copy = isEnglish
    ? {
        privacy: "I have read the privacy policy and agree that my details will be processed to handle this request.",
        privacyLink: "Privacy policy",
        forwarding: "I agree that my details will be forwarded to the responsible advisor or portal partner for processing this request.",
        tipTerms: "I submit this tip voluntarily and confirm that I am allowed to share the information. Any possible tip commission will be reviewed and agreed separately.",
      }
    : {
        privacy: "Ich habe die Datenschutzerklärung zur Kenntnis genommen und bin einverstanden, dass meine Angaben zur Bearbeitung dieser Anfrage verarbeitet werden.",
        privacyLink: "Datenschutzerklärung",
        forwarding: "Ich bin einverstanden, dass meine Angaben zur Bearbeitung dieser Anfrage an den zuständigen Ansprechpartner oder Portalpartner weitergeleitet werden.",
        tipTerms: "Ich gebe diesen Hinweis freiwillig ab und bestätige, zur Weitergabe der Informationen berechtigt zu sein. Eine mögliche Tippgebervergütung wird gesondert geprüft und vereinbart.",
      };

  return (
    <div style={consentListStyle}>
      <label style={consentLabelStyle}>
        <input
          type="checkbox"
          checked={value.privacy}
          onChange={(event) => onChange({ ...value, privacy: event.target.checked })}
          required
          style={checkboxStyle}
        />
        <span>
          {copy.privacy}{" "}
          <a href={privacyHref} target="_blank" rel="noreferrer" style={consentLinkStyle}>
            {copy.privacyLink}
          </a>
        </span>
      </label>
      <label style={consentLabelStyle}>
        <input
          type="checkbox"
          checked={value.forwarding}
          onChange={(event) => onChange({ ...value, forwarding: event.target.checked })}
          required
          style={checkboxStyle}
        />
        <span>{copy.forwarding}</span>
      </label>
      {includeTipTerms ? (
        <label style={consentLabelStyle}>
          <input
            type="checkbox"
            checked={Boolean(value.tipTerms)}
            onChange={(event) => onChange({ ...value, tipTerms: event.target.checked })}
            required
            style={checkboxStyle}
          />
          <span>{copy.tipTerms}</span>
        </label>
      ) : null}
    </div>
  );
}

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

const checkboxStyle: CSSProperties = {
  marginTop: 3,
};

const consentLinkStyle: CSSProperties = {
  color: "#486b7a",
  fontWeight: 800,
};
