import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    qualities: [72, 75],
    remotePatterns: [
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
