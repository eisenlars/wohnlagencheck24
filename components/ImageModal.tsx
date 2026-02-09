"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type ImageModalProps = {
  src: string;
  alt: string;
  thumbStyle?: React.CSSProperties;
  thumbClassName?: string;
};

const passthroughLoader = ({ src }: { src: string }) => src;

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
      <Image
        src={src}
        alt={alt}
        width={400}
        height={300}
        sizes="(max-width: 768px) 50vw, 200px"
        loader={passthroughLoader}
        unoptimized
        style={{ cursor: "zoom-in", width: "100%", height: "auto", ...thumbStyle }}
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
            <Image
              src={src}
              alt={alt}
              width={1200}
              height={800}
              sizes="(max-width: 1100px) 95vw, 1100px"
              loader={passthroughLoader}
              unoptimized
              className="popup-image"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
