import { login, requestPasswordReset } from './actions'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams

  return (
    <div style={{ maxWidth: '420px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #ddd', padding: '24px', borderRadius: '8px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>Admin Zugriff</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>Nur für berechtigte Administratoren.</p>

        <form action={login} style={{ display: "grid", gap: "12px" }}>
          <label htmlFor="email">E-Mail</label>
          <input name="email" type="email" placeholder="admin@email.de" required style={{ padding: '8px' }} />

          <label htmlFor="password">Passwort</label>
          <input name="password" type="password" placeholder="••••••••" required style={{ padding: '8px' }} />

          <button type="submit" style={{ padding: '10px', background: '#111827', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Admin anmelden
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
                  window.location.replace("/auth/setup?aud=admin" + hash);
                } catch (_) {}
              })();
            `,
          }}
        />

        {params?.message && (
          <p style={{ color: '#b91c1c', fontSize: '14px', textAlign: 'center' }}>
            {params.message}
          </p>
        )}
      </div>
    </div>
  )
}
