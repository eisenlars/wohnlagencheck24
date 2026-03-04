// app/layout.tsx

import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const isNoindexMode =
  process.env.NEXT_PUBLIC_SITE_NOINDEX === "1" ||
  process.env.SITE_NOINDEX === "1";

export const metadata: Metadata = {
  title: "Wohnlagencheck24 – Wohnlagen & Standortanalysen",
  description: "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.",
  icons: {
    icon: [
      { url: "/logo/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo/favicon.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [{ url: "/logo/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/logo/favicon-32.png"],
  },
  robots: {
    index: !isNoindexMode,
    follow: !isNoindexMode,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="text-light">{children}</body>
    </html>
  );
}
