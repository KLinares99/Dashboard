import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // analytics CSV uploads
  },
};

export default nextConfig;
