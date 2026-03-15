import type { ReactNode } from "react";

import { ImmobilienmarktContentShell } from "@/components/layout/ImmobilienmarktContentShell";

export default function PreviewImmobilienmarktLayout({ children }: { children: ReactNode }) {
  return <ImmobilienmarktContentShell>{children}</ImmobilienmarktContentShell>;
}
