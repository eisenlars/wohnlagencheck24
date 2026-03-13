'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit'
import { resolvePartnerPasswordResetRedirectUrl } from '@/lib/auth/resolve-app-base-url'

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

function redirectLoginWithMessage(message: string) {
  const params = new URLSearchParams({ message });
  return redirect(`/partner/login?${params.toString()}`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('reset_email') ?? '').trim().toLowerCase();
  if (!email) {
    return redirectLoginWithMessage('Bitte E-Mail-Adresse eingeben.');
  }

  const hdrs = await headers();
  const ip = extractClientIpFromHeaders(hdrs);
  const limit = await checkRateLimitPersistent(
    `partner_pwreset:${ip}:${email}`,
    { windowMs: 15 * 60 * 1000, max: 5 },
  );
  if (!limit.allowed) {
    return redirectLoginWithMessage(`Zu viele Reset-Anfragen. Bitte in ${limit.retryAfterSec}s erneut versuchen.`);
  }

  try {
    const supabase = createClient();
    const redirectTo = resolvePartnerPasswordResetRedirectUrl(hdrs);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // Keine Detailfehler zurückgeben (User-Enumeration vermeiden).
  }

  return redirect('/partner/login/reset-requested');
}
