import type { RequestMode } from "@/lib/gesuche";
import { RequestOfferLeadButton } from "./RequestOfferLeadButton";

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
};

export function RequestTipsterBox({ locale = "de", mode, pagePath, regionLabel, request, context }: Props) {
  const isEnglish = locale === "en";
  return (
    <div
      style={{
        border: "1px solid #dbe4ea",
        borderRadius: 20,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderRadius: 22,
          padding: "22px 20px",
          background: "linear-gradient(145deg, #0f172a 0%, #28465a 100%)",
          color: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.72,
          }}
        >
          {isEnglish ? "Tip-off" : "Tippgeber"}
        </div>
        <div style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", lineHeight: 1.05, fontWeight: 850 }}>
          {isEnglish ? "Know someone?" : "Sie kennen da jemanden?"}
        </div>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", lineHeight: 1.65 }}>
          {isEnglish
            ? "If you know an owner whose property could fit this request, send a short confidential hint."
            : "Wenn Sie jemanden kennen, dessen Immobilie zu diesem Gesuch passen könnte, geben Sie uns einen kurzen vertraulichen Hinweis."}
        </p>
        <RequestOfferLeadButton
          label={isEnglish ? "Claim tip commission" : "Tippprovision abholen"}
          locale={locale}
          mode={mode}
          intent="tip"
          pagePath={pagePath}
          regionLabel={regionLabel}
          request={request}
          context={context}
          style={{
            justifySelf: "start",
            marginTop: 4,
            border: "1px solid #facc15",
            background: "#facc15",
            color: "#0f172a",
            borderRadius: 999,
            padding: "11px 16px",
            fontWeight: 850,
          }}
        />
      </div>
    </div>
  );
}
