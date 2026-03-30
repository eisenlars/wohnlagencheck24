import DashboardClient from '@/app/dashboard/DashboardClient';

export default function NetworkBillingPage() {
  return <DashboardClient initialMainTab="network_partners" initialShowWelcome={false} initialNetworkPartnerSection="billing" />;
}
