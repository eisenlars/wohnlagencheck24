export type ClientAuthScope = "partner" | "network_partner";

function loginPathForScope(scope: ClientAuthScope): string {
  return scope === "network_partner" ? "/network-partner/login" : "/partner/login";
}

function defaultMessageForScope(scope: ClientAuthScope): string {
  return scope === "network_partner"
    ? "Deine Sitzung ist abgelaufen oder dein Zugang ist nicht mehr freigegeben. Bitte melde dich erneut an."
    : "Deine Sitzung ist abgelaufen oder dein Partnerzugang ist nicht mehr verfügbar. Bitte melde dich erneut an.";
}

export function isUnauthorizedResponse(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

export function redirectToLoginForScope(scope: ClientAuthScope, message?: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams({
    message: message ?? defaultMessageForScope(scope),
  });
  window.location.replace(`${loginPathForScope(scope)}?${params.toString()}`);
}

export function redirectIfUnauthorizedResponse(
  response: Response,
  scope: ClientAuthScope,
  message?: string,
): boolean {
  if (!isUnauthorizedResponse(response)) return false;
  redirectToLoginForScope(scope, message);
  return true;
}
