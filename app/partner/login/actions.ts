'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const hdrs = await headers()
  const ip = extractClientIpFromHeaders(hdrs)
  const limit = await checkRateLimitPersistent(
    `partner_login:${ip}:${String(email ?? '').trim().toLowerCase()}`,
    { windowMs: 15 * 60 * 1000, max: 8 },
  )
  if (!limit.allowed) {
    return redirect(`/partner/login?message=Zu viele Anmeldeversuche. Bitte in ${limit.retryAfterSec}s erneut versuchen.`)
  }
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/partner/login?message=Anmeldung fehlgeschlagen')
  }

  return redirect('/dashboard')
}

