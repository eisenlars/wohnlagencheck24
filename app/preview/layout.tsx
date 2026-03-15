import { PublicSiteShell } from "@/components/layout/PublicSiteShell";

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}
