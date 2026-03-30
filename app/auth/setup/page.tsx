import AuthSetupCompatClient from "@/components/auth/auth-setup-compat-client";
import AdminPasswordResetClient from "@/components/auth/admin-password-reset-client";
import PasswordSetupClient from "@/components/auth/password-setup-client";

export default async function AuthSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ aud?: string }>;
}) {
  const params = await searchParams;
  const aud = String(params?.aud ?? "").trim().toLowerCase();
  if (aud === "admin") {
    return <AdminPasswordResetClient />;
  }
  if (aud === "network_partner") {
    return (
      <PasswordSetupClient
        title="Netzwerkpartner-Zugang aktivieren"
        defaultAudience="network_partner"
      />
    );
  }
  return <AuthSetupCompatClient />;
}
