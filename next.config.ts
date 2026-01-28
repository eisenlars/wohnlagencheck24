import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "www.praxiswissen-immobilien.de",
      },
      {
        protocol: "https",
        hostname: "glatwnjxpotnxroqtiee.supabase.co",
      },
    ],
  },
};

export default nextConfig;
