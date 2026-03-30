import DashboardClient from '@/app/dashboard/DashboardClient';

export default function NetworkInventoryPage() {
  return <DashboardClient initialMainTab="network_partners" initialShowWelcome={false} initialNetworkPartnerSection="inventory" />;
}
