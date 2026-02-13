import { login } from './actions'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams

  return (
    <div style={{ maxWidth: '420px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #ddd', padding: '24px', borderRadius: '8px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>Admin Zugriff</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>Nur für Master-Administratoren.</p>

        <label htmlFor="email">E-Mail</label>
        <input name="email" type="email" placeholder="admin@email.de" required style={{ padding: '8px' }} />

        <label htmlFor="password">Passwort</label>
        <input name="password" type="password" placeholder="••••••••" required style={{ padding: '8px' }} />

        <button formAction={login} style={{ padding: '10px', background: '#111827', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Admin anmelden
        </button>

        {params?.message && (
          <p style={{ color: '#b91c1c', fontSize: '14px', textAlign: 'center' }}>
            {params.message}
          </p>
        )}
      </form>
    </div>
  )
}

