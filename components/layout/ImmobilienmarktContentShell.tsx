import type { ReactNode } from "react";

export function ImmobilienmarktContentShell({ children }: { children: ReactNode }) {
  return (
    <div className="py-1">
      <div className="container">
        <div
          className="card border-0 shadow-lg"
          style={{
            borderRadius: "1.5rem",
            backgroundColor: "var(--brand-bg)",
          }}
        >
          <div className="card-body p-4 p-md-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
