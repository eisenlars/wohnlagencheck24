import { KontaktProvider } from "@/components/kontakt/contact-context";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <KontaktProvider>{children}</KontaktProvider>;
}
