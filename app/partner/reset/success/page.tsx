import Link from "next/link";

export default function PartnerResetSuccessPage() {
  return (
    <div style={{ maxWidth: 420, margin: "100px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8, background: "#fff" }}>
        <h2 style={{ margin: 0, color: "#111827" }}>Passwort erfolgreich gesetzt</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.45 }}>
          Dein neues Passwort wurde gespeichert. Du kannst dich jetzt mit dem neuen Passwort anmelden.
        </p>
        <Link
          href="/partner/login"
          style={{
            textDecoration: "none",
            padding: "10px 12px",
            border: "1px solid #0f766e",
            borderRadius: 6,
            color: "#fff",
            fontWeight: 700,
            textAlign: "center",
            background: "#0f766e",
          }}
        >
          Zur Anmeldeseite
        </Link>
      </div>
    </div>
  );
}
