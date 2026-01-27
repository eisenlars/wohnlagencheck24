// components/right-edge-controls.tsx

"use client";

import { useState } from "react";

type TocItem = {
  id: string;
  label: string;
};

function PageToc({ items }: { items: TocItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Seiteninhaltsverzeichnis"
      className="immobilienmarkt-toc d-none d-xl-block"
    >
      <div className="card border-0 shadow-sm small">
        <div className="card-body py-3 px-3">
          <div className="text-muted mb-2 fw-semibold">
            Inhalt dieser Seite
          </div>
          <ul className="list-unstyled mb-0">
            {items.map((item) => (
              <li key={item.id} className="mb-1">
                <a
                  href={`#${item.id}`}
                  className="text-decoration-none"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export function RightEdgeControls({
  tocItems,
  showTocInitially = true,
}: {
  tocItems: TocItem[];
  showTocInitially?: boolean;
}) {
  const [tocVisible, setTocVisible] = useState(showTocInitially);

  const handleToggleToc = () => {
    setTocVisible((v) => !v);
  };

  const tocIsOpen = tocVisible;

  return (
    <div className="right-edge-wrapper d-none d-xl-flex">
      {/* TOC Toggle oben */}
      <button
        className="edge-btn edge-btn--toc"
        type="button"
        onClick={handleToggleToc}
        aria-expanded={tocIsOpen}
        aria-label={
          tocIsOpen ? "Inhaltsverzeichnis einklappen" : "Inhaltsverzeichnis ausklappen"
        }
      >
        {/* Pfeil zeigt Richtung „Bewegung“ des Panels */}
        <i className={tocIsOpen ? "bi bi-chevron-right" : "bi bi-chevron-left"} />
        <span>{tocIsOpen ? "Inhalt >" : "< Inhalt"}</span>
      </button>

      {/* TOC in der Mitte */}
      {tocVisible && <PageToc items={tocItems} />}

      {/* Kontakt unten */}
      <button
        type="button"
        className="edge-btn edge-btn--contact"
        data-bs-toggle="offcanvas"
        data-bs-target="#kreisKontaktOffcanvas"
        aria-controls="kreisKontaktOffcanvas"
      >
        <i className="bi bi-envelope" />
        <span>Kontakt</span>
      </button>
    </div>
  );
}
