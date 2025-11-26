import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  webpack: (config) => {
    // Handle large files better
    config.module.rules.push({
      test: /\.(webm|mp4)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;
