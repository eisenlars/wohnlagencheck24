// components/kontakt/contact-context.tsx

"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type KontaktVM = {
  scope: "portal" | "berater";
  title: string;

  name: string;
  email: string;
  phone?: string;
  imageSrc?: string;

  // optional: z.B. Kreisname, SLUGS, Tracking
  regionLabel?: string;

  // Formular-Defaults
  subjectDefault?: string;
};

type KontaktContextValue = {
  vm: KontaktVM | null;
  setVm: (vm: KontaktVM) => void;
};

const KontaktContext = createContext<KontaktContextValue | null>(null);

export function KontaktProvider({ children }: { children: React.ReactNode }) {
  const [vm, setVm] = useState<KontaktVM | null>(null);

  const value = useMemo(() => ({ vm, setVm }), [vm]);
  return <KontaktContext.Provider value={value}>{children}</KontaktContext.Provider>;
}

export function useKontakt() {
  const ctx = useContext(KontaktContext);
  if (!ctx) throw new Error("useKontakt must be used within KontaktProvider");
  return ctx;
}
