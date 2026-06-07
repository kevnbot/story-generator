import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    imageSizes: [48, 64, 72, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "**.fal.ai" },
    ],
  },
  serverExternalPackages: ["twilio"],
};

export default nextConfig;
