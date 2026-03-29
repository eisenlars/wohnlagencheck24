'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/utils/supabase/admin'
import { requestNetworkPartnerPasswordReset } from '@/lib/auth/network-partner-password-reset'

async function hasNetworkPartnerMembership(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('network_partner_users')
    .select('id')
    .eq('auth_user_id', userId)
    .limit(1)

  return !error && Array.isArray(data) && data.length > 0
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = formData.get('password') as string
  const hdrs = await headers()
  const ip = extractClientIpFromHeaders(hdrs)
  const limit = await checkRateLimitPersistent(
    `network_partner_login:${ip}:${email}`,
    { windowMs: 15 * 60 * 1000, max: 8 },
  )
  if (!limit.allowed) {
    return redirect(`/network-partner/login?message=Zu viele Anmeldeversuche. Bitte in ${limit.retryAfterSec}s erneut versuchen.`)
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data?.user?.id) {
    return redirect('/network-partner/login?message=Anmeldung fehlgeschlagen')
  }

  const allowed = await hasNetworkPartnerMembership(data.user.id)
  if (!allowed) {
    await supabase.auth.signOut()
    return redirect('/network-partner/login?message=Kein Netzwerkpartner-Zugriff')
  }

  return redirect('/network-partner')
}

function redirectLoginWithMessage(message: string) {
  const params = new URLSearchParams({ message });
  return redirect(`/network-partner/login?${params.toString()}`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('reset_email') ?? '').trim().toLowerCase();
  if (!email) {
    return redirectLoginWithMessage('Bitte E-Mail-Adresse eingeben.');
  }

  const hdrs = await headers();
  const ip = extractClientIpFromHeaders(hdrs);
  const limit = await checkRateLimitPersistent(
    `network_partner_pwreset:${ip}:${email}`,
    { windowMs: 15 * 60 * 1000, max: 5 },
  );
  if (!limit.allowed) {
    return redirectLoginWithMessage(`Zu viele Reset-Anfragen. Bitte in ${limit.retryAfterSec}s erneut versuchen.`);
  }

  try {
    await requestNetworkPartnerPasswordReset(email, hdrs);
  } catch {
    // Keine Detailfehler zurückgeben (User-Enumeration vermeiden).
  }

  return redirect('/network-partner/login?message=Wenn die E-Mail existiert, wurde ein Reset-Link versendet.');
}
