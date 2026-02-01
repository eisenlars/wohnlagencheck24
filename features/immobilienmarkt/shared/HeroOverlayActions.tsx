// features/immobilienmarkt/shared/HeroOverlayActions.tsx

import Link from "next/link";

type HeroOverlayActionsProps = {
  variant: "immo" | "miete";
  hrefLeft?: string;
  hrefRight?: string;
};

export function HeroOverlayActions(props: HeroOverlayActionsProps) {
  const isImmo = props.variant === "immo";

  const leftLabel = isImmo ? "Angebote" : "Mietangebote";
  const rightLabel = isImmo ? "Gesuche" : "Mietgesuche";

  return (
    <>
      {props.hrefLeft ? (
        <Link className="btn fw-semibold hero-overlay-action" href={props.hrefLeft}>
          {leftLabel}
        </Link>
      ) : (
        <button className="btn fw-semibold hero-overlay-action">
          {leftLabel}
        </button>
      )}

      {props.hrefRight ? (
        <Link className="btn fw-semibold hero-overlay-action" href={props.hrefRight}>
          {rightLabel}
        </Link>
      ) : (
        <button className="btn fw-semibold hero-overlay-action">
          {rightLabel}
        </button>
      )}
    </>
  );
}
