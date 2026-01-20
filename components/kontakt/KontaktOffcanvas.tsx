// components/kontakt/KontaktOffcanvas.tsx

"use client";

import Image from "next/image";
import { useKontakt } from "./contact-context";
import { KontaktForm } from "./KontaktForm";

export function KontaktOffcanvas() {
  const { vm } = useKontakt();

  // Fallback (falls Setter nicht greift)
  if (!vm) {
    return (
      <>
        <p className="text-muted">Kontaktinformationen werden geladen …</p>
      </>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-3">
        {vm.imageSrc ? (
          <Image
            src={vm.imageSrc}
            alt={vm.name}
            width={56}
            height={56}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        ) : null}

        <div>
          <div className="fw-semibold">{vm.title}</div>
          <div className="small text-muted">{vm.regionLabel ?? ""}</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="fw-semibold">{vm.name}</div>
        <a className="text-decoration-none" href={`mailto:${vm.email}`}>
          {vm.email}
        </a>
        {vm.phone ? <div className="small text-muted">{vm.phone}</div> : null}
      </div>

      <KontaktForm
        targetEmail={vm.email}
        scope={vm.scope}
        regionLabel={vm.regionLabel}
      />
    </div>
  );
}
