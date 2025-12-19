// app/(statisch)/layout.tsx

import "../globals.css";
import "./static.css";
import type { ReactNode } from "react";

export default function StatischLayout({ children }: { children: ReactNode }) {
  return (
    <div className="statisch-main-wrapper">
      {children}
    </div>
  );
}
