import { PublicSiteShell } from "@/components/layout/PublicSiteShell";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}
