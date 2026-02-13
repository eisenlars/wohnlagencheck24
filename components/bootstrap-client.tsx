// components/bootstrap-client.tsx

"use client";
import { useEffect } from "react";

let bootstrapped = false;

export function BootstrapClient() {
  useEffect(() => {
    if (bootstrapped) return;

    let cancelled = false;
    const loadBootstrap = () => {
      if (cancelled || bootstrapped) return;
      bootstrapped = true;
      import("bootstrap/dist/js/bootstrap.bundle.min.js").catch((err) => {
        console.error("Fehler beim Laden von Bootstrap JS:", err);
      });
    };

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => loadBootstrap(), { timeout: 4000 });
    } else if (typeof window !== "undefined") {
      timeoutId = window.setTimeout(loadBootstrap, 2200);
    } else {
      loadBootstrap();
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (typeof window !== "undefined" && timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}
