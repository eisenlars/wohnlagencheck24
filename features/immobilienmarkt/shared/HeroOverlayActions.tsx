// features/immobilienmarkt/shared/HeroOverlayActions.tsx

export function HeroOverlayActions(props: { variant: "immo" | "miete" }) {
  const isImmo = props.variant === "immo";

  const leftLabel = isImmo ? "Immobilienangebote" : "Mietangebote";
  const rightLabel = isImmo ? "Immobiliengesuche" : "Mietgesuche";

  return (
    <>
      <button className="btn flex-fill fw-semibold hero-overlay-action">
        {leftLabel}
      </button>

      <button className="btn fw-semibold hero-overlay-action">
        {rightLabel}
      </button>
    </>
  );
}
