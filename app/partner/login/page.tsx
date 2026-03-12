import { login, requestPasswordReset } from "./actions";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #ddd", padding: "24px", borderRadius: "8px" }}>
        <h2 style={{ margin: "0 0 10px 0" }}>Partner Portal</h2>
        <p style={{ fontSize: "14px", color: "#666" }}>Melden Sie sich an, um Ihre Marktdaten zu verwalten.</p>

        <form action={login} style={{ display: "grid", gap: "12px" }}>
          <label htmlFor="email">E-Mail</label>
          <input name="email" type="email" placeholder="ihre@email.de" required style={{ padding: "8px" }} />

          <label htmlFor="password">Passwort</label>
          <input name="password" type="password" placeholder="••••••••" required style={{ padding: "8px" }} />

          <button type="submit" style={{ padding: "10px", background: "#0f766e", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 700 }}>
            Anmelden
          </button>
        </form>

        <form action={requestPasswordReset} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "4px", display: "grid", gap: "10px" }}>
          <strong style={{ fontSize: "14px", color: "#334155" }}>Passwort vergessen?</strong>
          <input
            name="reset_email"
            type="email"
            placeholder="E-Mail für Zurücksetzen"
            required
            style={{ padding: "8px" }}
          />
          <button
            type="submit"
            style={{
              padding: "10px",
              background: "#ffffff",
              color: "#0f766e",
              border: "3px solid #0f766e",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Link zum Zurücksetzen senden
          </button>
        </form>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if (!window.location.hash) return;
                  var hash = window.location.hash;
                  if (hash.indexOf("access_token=") === -1) return;
                  if (hash.indexOf("type=invite") === -1 && hash.indexOf("type=recovery") === -1) return;
                  window.location.replace("/auth/setup?aud=partner" + hash);
                } catch (_) {}
              })();
            `,
          }}
        />

        {params?.message && (
          <p
            style={{
              color: String(params.message).toLowerCase().includes("gesendet") ? "#166534" : "#b91c1c",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            {params.message}
          </p>
        )}
      </div>
    </div>
  );
}
