'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendAdminPartnerOnboardedEmail } from '@/lib/notifications/admin-review-email'

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/partner/login?message=Anmeldung fehlgeschlagen')
  }

  const authUserId = String(data.user?.id ?? '').trim()
  if (authUserId) {
    try {
      const admin = createAdminClient()
      const { data: partnerBefore } = await admin
        .from('partners')
        .select('id, company_name, contact_email, is_active')
        .eq('id', authUserId)
        .maybeSingle()

      await admin.from('partners').update({ is_active: true }).eq('id', authUserId)

      const wasActive = Boolean((partnerBefore as { is_active?: boolean } | null)?.is_active)
      if (!wasActive) {
        await sendAdminPartnerOnboardedEmail({
          partnerId: authUserId,
          partnerName: String((partnerBefore as { company_name?: string } | null)?.company_name ?? '').trim() || null,
          partnerEmail: String((partnerBefore as { contact_email?: string } | null)?.contact_email ?? '').trim().toLowerCase() || null,
          loggedInAtIso: new Date().toISOString(),
        })
      }
    } catch {
      // Login darf durch Aktivierungs-Update nicht fehlschlagen.
    }
  }

  return redirect('/dashboard')
}
