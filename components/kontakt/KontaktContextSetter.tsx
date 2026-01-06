// components/kontakt/KontaktContextSetter.tsx

"use client";

import { useEffect } from "react";
import type { KontaktVM } from "./contact-context";
import { useKontakt } from "./contact-context";

export function KontaktContextSetter({ vm }: { vm: KontaktVM }) {
  const { setVm } = useKontakt();

  useEffect(() => {
    setVm(vm);
  }, [setVm, vm]);

  return null;
}
