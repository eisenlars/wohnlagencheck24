// app/login/page.tsx

import { login } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #ddd', padding: '24px', borderRadius: '8px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>Partner Portal</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>Melden Sie sich an, um Ihre Marktdaten zu verwalten.</p>
        
        <label htmlFor="email">E-Mail</label>
        <input name="email" type="email" placeholder="ihre@email.de" required style={{ padding: '8px' }} />
        
        <label htmlFor="password">Passwort</label>
        <input name="password" type="password" placeholder="••••••••" required style={{ padding: '8px' }} />
        
        <button formAction={login} style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Anmelden
        </button>

        {searchParams?.message && (
          <p style={{ color: 'red', fontSize: '14px', textAlign: 'center' }}>
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}