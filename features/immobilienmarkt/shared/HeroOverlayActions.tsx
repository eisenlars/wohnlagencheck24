// features/immobilienmarkt/shared/HeroOverlayActions.tsx

export function HeroOverlayActions(props: { variant: "immo" | "miete" }) {
  const isImmo = props.variant === "immo";

  const leftLabel = isImmo ? "Immobilienangebote" : "Mietangebote";
  const rightLabel = isImmo ? "Immobiliengesuche" : "Mietgesuche";

  const baseStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    color: "#000",
    border: "1px solid #fff",
    borderRadius: "1rem 1rem 0 0",
    padding: "1rem 1.25rem",
    fontSize: "1.1rem",
  };

  return (
    <>
      <button className="btn flex-fill fw-semibold" style={baseStyle}>
        {leftLabel}
      </button>

      <button className="btn fw-semibold" style={{ ...baseStyle, flex: 1 }}>
        {rightLabel}
      </button>
    </>
  );
}
