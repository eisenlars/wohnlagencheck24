'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit'
import { getAdminRoleForUser } from '@/lib/security/admin-auth'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const hdrs = await headers()
  const ip = extractClientIpFromHeaders(hdrs)
  const limit = await checkRateLimitPersistent(
    `admin_login:${ip}:${String(email ?? '').trim().toLowerCase()}`,
    { windowMs: 15 * 60 * 1000, max: 5 },
  )
  if (!limit.allowed) {
    return redirect(`/admin/login?message=Zu viele Anmeldeversuche. Bitte in ${limit.retryAfterSec}s erneut versuchen.`)
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data?.user?.id) {
    return redirect('/admin/login?message=Anmeldung fehlgeschlagen')
  }

  const role = getAdminRoleForUser(data.user.id)
  if (role !== 'admin_super') {
    await supabase.auth.signOut()
    return redirect('/admin/login?message=Kein Admin-Zugriff')
  }

  return redirect('/admin')
}

