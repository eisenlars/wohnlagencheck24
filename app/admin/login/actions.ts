'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit'
import { getAdminRoleForUser } from '@/lib/security/admin-auth'
import { requestAdminPasswordReset } from '@/lib/auth/admin-password-reset'

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
  if (role !== 'admin_super' && role !== 'admin_ops') {
    await supabase.auth.signOut()
    return redirect('/admin/login?message=Kein Admin-Zugriff')
  }

  return redirect('/admin')
}

function redirectLoginWithMessage(message: string) {
  const params = new URLSearchParams({ message });
  return redirect(`/admin/login?${params.toString()}`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('reset_email') ?? '').trim().toLowerCase();
  if (!email) {
    return redirectLoginWithMessage('Bitte E-Mail-Adresse eingeben.');
  }

  const hdrs = await headers();
  const ip = extractClientIpFromHeaders(hdrs);
  const limit = await checkRateLimitPersistent(
    `admin_pwreset:${ip}:${email}`,
    { windowMs: 15 * 60 * 1000, max: 5 },
  );
  if (!limit.allowed) {
    return redirectLoginWithMessage(`Zu viele Reset-Anfragen. Bitte in ${limit.retryAfterSec}s erneut versuchen.`);
  }

  try {
    await requestAdminPasswordReset(email, hdrs);
  } catch {
    // Keine Detailfehler zurückgeben (User-Enumeration vermeiden).
  }

  return redirect('/admin/login?message=Wenn die E-Mail existiert, wurde ein Reset-Link versendet.');
}
