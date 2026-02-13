import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main style={{ maxWidth: 560, margin: "90px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 12 }}>403 - Kein Zugriff</h1>
      <p style={{ color: "#475569", lineHeight: 1.5 }}>
        Sie haben keine Berechtigung, diesen Bereich aufzurufen.
      </p>
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <Link href="/partner/login">Zum Partner-Login</Link>
        <Link href="/admin/login">Zum Admin-Login</Link>
      </div>
    </main>
  );
}

