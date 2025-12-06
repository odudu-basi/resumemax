import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js config here
  reactStrictMode: true,
  images: {
    domains: ['mgeppezubknkchynwydw.supabase.co'],
  },
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during production builds
    ignoreBuildErrors: true,
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: "resumemax",
  project: "javascript-nextjs",
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
