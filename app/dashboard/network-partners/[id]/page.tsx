import DashboardClient from '@/app/dashboard/DashboardClient';

type NetworkPartnerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NetworkPartnerDetailPage({ params }: NetworkPartnerDetailPageProps) {
  const resolvedParams = await params;
  const networkPartnerId = String(resolvedParams.id ?? '').trim() || null;

  return (
    <DashboardClient
      initialMainTab="network_partners"
      initialShowWelcome={false}
      initialNetworkPartnerSection="overview"
      initialSelectedNetworkPartnerId={networkPartnerId}
      initialNetworkPartnerDetailSection="profile"
    />
  );
}
