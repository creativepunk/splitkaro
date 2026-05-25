/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        // Ignore SQLite files — Prisma writes to these on every query,
        // which would otherwise trigger an HMR reload loop in dev.
        ignored: /prisma[/\\].*\.db/,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Ensure the pre-built SQLite template is bundled into every
    // serverless function so ensureDevDb() can copy it at cold-start.
    outputFileTracingIncludes: {
      "**": ["./prisma/dev.db.template"],
    },
  },
};

export default nextConfig;
