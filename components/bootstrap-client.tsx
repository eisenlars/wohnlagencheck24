// components/bootstrap-client.tsx
"use client";

import { useEffect } from "react";

export function BootstrapClient() {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js")
      .then((module) => {
        // Falls das Bundle einen Default-Export hat → bevorzugen
        const bs = (module as any).default || module;
        (window as any).bootstrap = bs;
      })
      .catch((err) => {
        console.error("Fehler beim Laden von Bootstrap JS:", err);
      });
  }, []);

  return null;
}

