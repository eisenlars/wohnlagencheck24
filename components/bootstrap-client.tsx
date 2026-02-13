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

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const win = typeof window !== "undefined" ? window : null;

    if (win && "requestIdleCallback" in win) {
      idleId = win.requestIdleCallback(() => loadBootstrap(), { timeout: 4000 });
    } else if (win) {
      timeoutId = setTimeout(loadBootstrap, 2200);
    } else {
      loadBootstrap();
    }

    return () => {
      cancelled = true;
      if (win && idleId !== null && "cancelIdleCallback" in win) {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}
