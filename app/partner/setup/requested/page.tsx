import Link from "next/link";

export default function PartnerSetupRequestedPage() {
  return (
    <div style={{ maxWidth: 420, margin: "100px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8, background: "#fff" }}>
        <h2 style={{ margin: 0, color: "#111827" }}>Partnerkonto aktivieren</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.45 }}>
          Der Admin ist informiert und schickt eine neue Einladung heraus.
        </p>
        <Link
          href="/partner/login"
          style={{
            textDecoration: "none",
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            color: "#0f172a",
            fontWeight: 700,
            textAlign: "center",
            background: "#fff",
          }}
        >
          Zur Anmeldeseite
        </Link>
      </div>
    </div>
  );
}
