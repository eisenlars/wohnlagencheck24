"use client";

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
    <div className="lead-consent-fields">
      <label className="lead-consent-fields__label">
        <input
          type="checkbox"
          checked={value.privacy}
          onChange={(event) => onChange({ ...value, privacy: event.target.checked })}
          required
          className="lead-consent-fields__checkbox"
        />
        <span>
          {copy.privacy}{" "}
          <a href={privacyHref} target="_blank" rel="noreferrer" className="lead-consent-fields__link">
            {copy.privacyLink}
          </a>
        </span>
      </label>
      <label className="lead-consent-fields__label">
        <input
          type="checkbox"
          checked={value.forwarding}
          onChange={(event) => onChange({ ...value, forwarding: event.target.checked })}
          required
          className="lead-consent-fields__checkbox"
        />
        <span>{copy.forwarding}</span>
      </label>
      {includeTipTerms ? (
        <label className="lead-consent-fields__label">
          <input
            type="checkbox"
            checked={Boolean(value.tipTerms)}
            onChange={(event) => onChange({ ...value, tipTerms: event.target.checked })}
            required
            className="lead-consent-fields__checkbox"
          />
          <span>{copy.tipTerms}</span>
        </label>
      ) : null}
    </div>
  );
}
