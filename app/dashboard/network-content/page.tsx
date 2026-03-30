import DashboardClient from '@/app/dashboard/DashboardClient';

export default function NetworkContentPage() {
  return <DashboardClient initialMainTab="network_partners" initialShowWelcome={false} initialNetworkPartnerSection="content" />;
}
