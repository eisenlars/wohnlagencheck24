import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PartnerResetRequestedPage() {
  return (
    <div style={{ maxWidth: "420px", margin: "100px auto", fontFamily: "sans-serif" }}>
      <div
        style={{
          display: "grid",
          gap: "12px",
          border: "1px solid #ddd",
          padding: "24px",
          borderRadius: "8px",
          background: "#fff",
        }}
      >
        <h2 style={{ margin: "0 0 6px 0" }}>Passwort-Link angefordert</h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.45 }}>
          Wenn ein aktives Partnerkonto mit dieser E-Mail existiert, wurde ein Link zum Zuruecksetzen des Passworts gesendet.
          Bitte prüfe dein Postfach und ggf. den Spam-Ordner.
        </p>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Noch nicht aktivierte Partnerkonten nutzen bitte den Einladungsprozess. Der Link ist zeitlich begrenzt und kann nur einmal verwendet werden.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "6px" }}>
          <Link
            href="/partner/login"
            style={{
              textDecoration: "none",
              padding: "10px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: "13px",
              background: "#fff",
            }}
          >
            Zurück zum Login
          </Link>
          <Link
            href="/partner/login"
            style={{
              textDecoration: "none",
              padding: "10px 12px",
              border: "1px solid #0f766e",
              borderRadius: "6px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              background: "#0f766e",
            }}
          >
            Neues Passwort anfordern
          </Link>
        </div>
      </div>
    </div>
  );
}
