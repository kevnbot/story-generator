import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "**.fal.ai" },
    ],
  },
  serverExternalPackages: ["twilio"],
};

export default nextConfig;
