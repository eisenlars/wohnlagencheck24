"use client";

import React, { useState } from "react";

type AccordionSectionProps = {
  id: string;
  teaser: React.ReactNode;
  children: React.ReactNode;
  openLabel?: string;
  closedLabel?: string;
  buttonId?: string;
};

export function AccordionSection({
  id,
  teaser,
  children,
  openLabel = "Weniger anzeigen",
  closedLabel = "Mehr anzeigen",
  buttonId,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`acc-teaser ${open ? "open" : ""}`} id={`acc-teaser-${id}`}>
        {teaser}
      </div>

      <div
        className="acc-content"
        id={`acc-content-${id}`}
        style={{ display: open ? "block" : "none" }}
      >
        {children}
      </div>

      <div className="dyn-cols">
        <div className="dyn--col">
          <div className="dyn--col-box">
            <button
              className="acc-button"
              id={buttonId ?? `acc-button-${id}`}
              type="button"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? openLabel : closedLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
