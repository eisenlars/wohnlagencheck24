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
