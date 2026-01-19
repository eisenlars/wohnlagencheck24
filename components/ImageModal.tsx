"use client";

import { useCallback, useEffect, useState } from "react";

type ImageModalProps = {
  src: string;
  alt: string;
  thumbStyle?: React.CSSProperties;
  thumbClassName?: string;
};

export function ImageModal({ src, alt, thumbStyle, thumbClassName }: ImageModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        style={{ cursor: "zoom-in", ...thumbStyle }}
        className={thumbClassName}
        onClick={open}
      />
      {isOpen ? (
        <div
          className="popup-overlay visible"
          role="dialog"
          aria-modal="true"
          aria-label={alt || "Bildvorschau"}
          onClick={close}
        >
          <div className="popup-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={close}
              aria-label="Modal schliessen"
              className="popup-close"
            >
              ×
            </button>
            <img src={src} alt={alt} className="popup-image" />
          </div>
        </div>
      ) : null}
    </>
  );
}
