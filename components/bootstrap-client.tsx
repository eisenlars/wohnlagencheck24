// components/bootstrap-client.tsx

"use client";
import { useEffect } from "react";

let bootstrapped = false;

export function BootstrapClient() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    import("bootstrap/dist/js/bootstrap.bundle.min.js").catch((err) => {
      console.error("Fehler beim Laden von Bootstrap JS:", err);
    });
  }, []);

  return null;
}