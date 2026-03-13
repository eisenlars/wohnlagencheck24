"use client";

import { useEffect } from "react";
import PasswordSetupClient from "@/components/auth/password-setup-client";

function readHashParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  return new URLSearchParams(raw);
}

function readSearchParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
  return new URLSearchParams(raw);
}

export default function AuthSetupCompatClient() {
  useEffect(() => {
    const search = readSearchParams();
    const hash = readHashParams();
    const type = String(hash.get("type") || search.get("type") || "").trim().toLowerCase();
    if (type === "invite") {
      window.location.replace(`/partner/setup${window.location.search}${window.location.hash}`);
      return;
    }
    if (type === "recovery") {
      window.location.replace(`/partner/reset${window.location.search}${window.location.hash}`);
      return;
    }
  }, []);

  return <PasswordSetupClient title="Zugang einrichten" defaultAudience="partner" />;
}
