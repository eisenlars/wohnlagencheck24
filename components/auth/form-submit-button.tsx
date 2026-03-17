"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  style: React.CSSProperties;
  spinnerColor?: string;
};

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  style,
  spinnerColor = "currentColor",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      style={{
        ...style,
        cursor: pending ? "wait" : style.cursor,
        opacity: pending ? 0.9 : style.opacity,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {pending ? (
        <span
          aria-hidden="true"
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "999px",
            border: `2px solid ${spinnerColor}`,
            borderTopColor: "transparent",
            display: "inline-block",
            animation: "wc24-spin 0.7s linear infinite",
          }}
        />
      ) : null}
      <span>{pending ? pendingLabel : idleLabel}</span>
    </button>
  );
}
