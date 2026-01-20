// utils/supabase/server.ts

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  // In Next.js 15+ ist cookies() ein Promise. 
  // Da createServerClient synchron initialisiert wird, nutzen wir diesen Wrapper:
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        async get(name: string) {
          const store = await cookieStore
          return store.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          const store = await cookieStore
          try {
            store.set({ name, value, ...options })
          } catch (error) {
            // Ignoriert in Server Components
          }
        },
        async remove(name: string, options: CookieOptions) {
          const store = await cookieStore
          try {
            store.set({ name, value: '', ...options })
          } catch (error) {
            // Ignoriert in Server Components
          }
        },
      },
    }
  )
}
