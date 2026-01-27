// features/immobilienmarkt/shared/HeroOverlayActions.tsx

export function HeroOverlayActions(props: { variant: "immo" | "miete" }) {
  const isImmo = props.variant === "immo";

  const leftLabel = isImmo ? "Angebote" : "Mietangebote";
  const rightLabel = isImmo ? "Gesuche" : "Mietgesuche";

  return (
    <>
      <button className="btn fw-semibold hero-overlay-action">
        {leftLabel}
      </button>

      <button className="btn fw-semibold hero-overlay-action">
        {rightLabel}
      </button>
    </>
  );
}
