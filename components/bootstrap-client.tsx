"use client";

import { useEffect } from "react";

export function BootstrapClient() {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js")
      .catch((err) => {
        console.error("Fehler beim Laden von Bootstrap JS:", err);
      });
  }, []);

  return null;
}
