"use client";

import { useFormStatus } from "react-dom";

type ResetSubmitButtonProps = {
  idleLabel: string;
  style: React.CSSProperties;
};

export function ResetSubmitButton({ idleLabel, style }: ResetSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      style={{
        ...style,
        cursor: pending ? "wait" : style.cursor,
        opacity: pending ? 0.8 : style.opacity,
      }}
    >
      {pending ? "Link wird gesendet..." : idleLabel}
    </button>
  );
}
