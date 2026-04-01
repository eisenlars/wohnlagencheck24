import DashboardClient from '@/app/dashboard/DashboardClient';

export default function NetworkBookingsPage() {
  return <DashboardClient initialMainTab="network_partners" initialShowWelcome={false} initialNetworkPartnerSection="overview" />;
}
