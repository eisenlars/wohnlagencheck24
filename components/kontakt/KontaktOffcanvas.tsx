// components/kontakt/KontaktOffcanvas.tsx

"use client";

import Image from "next/image";
import { useKontakt } from "./contact-context";

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

      <form>
        <div className="mb-3">
          <label className="form-label" htmlFor="kontakt_name">Name</label>
          <input className="form-control" id="kontakt_name" name="name" autoComplete="name" />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="kontakt_email">E-Mail</label>
          <input className="form-control" id="kontakt_email" name="email" type="email" autoComplete="email" />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="kontakt_msg">Nachricht</label>
          <textarea className="form-control" id="kontakt_msg" name="message" rows={5} />
        </div>

        {/* Hidden target */}
        <input type="hidden" name="targetEmail" value={vm.email} />
        <input type="hidden" name="scope" value={vm.scope} />
        <input type="hidden" name="regionLabel" value={vm.regionLabel ?? ""} />

        <button type="submit" className="btn btn-dark w-100">
          Senden
        </button>
      </form>
    </div>
  );
}
