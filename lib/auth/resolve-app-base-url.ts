export function resolveAppBaseUrl(hdrs: Headers): string {
  const envUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const origin = String(hdrs.get('origin') ?? '').trim();
  if (origin) return origin.replace(/\/+$/, '');
  const host = String(hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '').trim();
  const protoHeader = String(hdrs.get('x-forwarded-proto') ?? '').trim();
  const isLocalHost = /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
  const proto = protoHeader || (isLocalHost ? 'http' : 'https');
  if (!host) return 'http://localhost:3000';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export function resolvePartnerInviteRedirectUrl(hdrs: Headers): string {
  const configured = String(process.env.PARTNER_INVITE_REDIRECT_URL ?? '').trim();
  const fallback = `${resolveAppBaseUrl(hdrs)}/auth/setup?aud=partner`;
  if (!configured) return fallback;

  try {
    const url = new URL(configured);
    if (url.pathname === '/partner/setup') {
      url.pathname = '/auth/setup';
      url.searchParams.set('aud', 'partner');
      return url.toString();
    }
    if (url.pathname === '/auth/setup' && !url.searchParams.get('aud')) {
      url.searchParams.set('aud', 'partner');
      return url.toString();
    }
    return url.toString();
  } catch {
    return fallback;
  }
}
