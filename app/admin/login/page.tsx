import { login, requestPasswordReset } from './actions'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAdminRoleForUser } from '@/lib/security/admin-auth'
import { ResetSubmitButton } from '@/components/auth/reset-submit-button'
import { FormSubmitButton } from '@/components/auth/form-submit-button'

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.id) {
    const role = getAdminRoleForUser(user.id)
    if (role === 'admin_super' || role === 'admin_ops') {
      redirect('/admin')
    }
  }

  const params = await searchParams
  const message = String(params?.message ?? '')
  const messageLower = message.toLowerCase()
  const isSuccessMessage = messageLower.includes('gesendet')
    || messageLower.includes('versendet')
    || messageLower.includes('erfolgreich')
    || messageLower.includes('wurde ein reset-link')

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #ddd", padding: "24px", borderRadius: "8px" }}>
        <h2 style={{ margin: '0 0 10px 0', color: "#111827" }}>Admin Zugriff</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>Nur für berechtigte Administratoren.</p>

        <form action={login} style={{ display: "grid", gap: "12px" }}>
          <label htmlFor="email" style={{ color: "#111827" }}>E-Mail</label>
          <input name="email" type="email" placeholder="admin@email.de" required style={{ padding: '8px' }} />

          <label htmlFor="password" style={{ color: "#111827" }}>Passwort</label>
          <input name="password" type="password" placeholder="••••••••" required style={{ padding: '8px' }} />

          <FormSubmitButton
            idleLabel="Anmelden"
            pendingLabel="Du wirst eingeloggt..."
            style={{ padding: "10px", background: "#111827", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 700 }}
            spinnerColor="#ffffff"
          />
        </form>

        <form action={requestPasswordReset} style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "4px", display: "grid", gap: "10px" }}>
          <strong style={{ fontSize: "14px", color: "#111827" }}>Passwort vergessen?</strong>
          <input
            name="reset_email"
            type="email"
            placeholder="E-Mail für Zurücksetzen"
            required
            style={{ padding: "8px" }}
          />
          <ResetSubmitButton
            idleLabel="Link zum Zurücksetzen senden"
            style={{
              padding: "10px",
              background: "#ffffff",
              color: "#111827",
              border: "3px solid #111827",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          />
        </form>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if (!window.location.hash) return;
                  var hash = window.location.hash;
                  if (hash.indexOf("access_token=") === -1) return;
                  if (hash.indexOf("type=recovery") !== -1) {
                    window.location.replace("/admin/reset" + hash);
                    return;
                  }
                  if (hash.indexOf("type=invite") === -1) return;
                  window.location.replace("/auth/setup?aud=admin" + hash);
                } catch (_) {}
              })();
            `,
          }}
        />

        {message && (
          <p style={{ color: isSuccessMessage ? "#166534" : '#b91c1c', fontSize: '14px', textAlign: 'center' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
