"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type RegionImageGalleryItem = {
  src: string;
  alt: string;
};

type RegionImageGalleryProps = {
  items: RegionImageGalleryItem[];
};

export function RegionImageGallery({ items }: RegionImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => {
          if (current === null) return current;
          return (current - 1 + items.length) % items.length;
        });
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => {
          if (current === null) return current;
          return (current + 1) % items.length;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, items.length]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="row g-2">
        {items.map((item, index) => (
          <div key={item.src} className="col-12 col-md-4">
            <button
              type="button"
              className="ratio ratio-4x3 overflow-hidden rounded-4 bg-light border-0 p-0 w-100"
              onClick={() => setActiveIndex(index)}
              aria-label={`${item.alt} in Galerie öffnen`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 992px) 18vw, (min-width: 768px) 33vw, 100vw"
                className="object-fit-cover"
              />
            </button>
          </div>
        ))}
      </div>

      {activeItem ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75"
          style={{ zIndex: 1080 }}
          role="dialog"
          aria-modal="true"
          aria-label="Regionale Bildergalerie"
          onClick={() => setActiveIndex(null)}
        >
          <div className="position-absolute top-0 end-0 p-3" style={{ zIndex: 2 }}>
            <button
              type="button"
              className="btn btn-light rounded-pill fw-semibold"
              onClick={() => setActiveIndex(null)}
            >
              Schließen
            </button>
          </div>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="btn btn-light rounded-circle position-absolute top-50 start-0 translate-middle-y ms-3"
                style={{ zIndex: 2 }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((current) => {
                    if (current === null) return current;
                    return (current - 1 + items.length) % items.length;
                  });
                }}
                aria-label="Vorheriges Bild"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn btn-light rounded-circle position-absolute top-50 end-0 translate-middle-y me-3"
                style={{ zIndex: 2 }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((current) => {
                    if (current === null) return current;
                    return (current + 1) % items.length;
                  });
                }}
                aria-label="Nächstes Bild"
              >
                ›
              </button>
            </>
          ) : null}
          <div
            className="position-absolute top-50 start-50 translate-middle w-100 h-100 p-4 p-lg-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="position-relative w-100 h-100">
              <Image
                src={activeItem.src}
                alt={activeItem.alt}
                fill
                sizes="100vw"
                className="object-fit-contain"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
