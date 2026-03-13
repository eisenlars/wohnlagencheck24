import AuthSetupCompatClient from "@/components/auth/auth-setup-compat-client";
import PasswordSetupClient from "@/components/auth/password-setup-client";

export default async function AuthSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ aud?: string }>;
}) {
  const params = await searchParams;
  const aud = String(params?.aud ?? "").trim().toLowerCase();
  if (aud === "admin") {
    return <PasswordSetupClient title="Passwort neu setzen" defaultAudience="admin" />;
  }
  return <AuthSetupCompatClient />;
}
