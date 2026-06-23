import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  cacheLife: {
    daily: {
      stale: 86400,
      revalidate: 86400,
      expire: 86400,
    },
    monthly: {
      stale: 2592000,
      revalidate: 2592000,
      expire: 2592000,
    },
  },
};

export default nextConfig;
