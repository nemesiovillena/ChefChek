import type { NextConfig } from "next";

// Backend origin for server-side rewrites (proxy of /api/v1 and /uploads).
// Evaluated at build time, so BACKEND_URL must be present during `next build`
// (passed as a Docker build arg in production). Defaults to the local dev backend.
const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  // SSR standalone build: emits a self-contained server (.next/standalone)
  // for Docker. Not static export — authenticated routes need the Node runtime.
  output: "standalone",

  // Configure image domains for optimized images
  images: {
    domains: [],
  },

  // Proxy same-origin /api/v1 and /uploads to the backend (avoids CORS for
  // relative client fetches). Destination is baked at build time.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
