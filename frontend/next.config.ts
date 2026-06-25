import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static export - need SSR for authenticated routes
  output: undefined,

  // Configure image domains for optimized images
  images: {
    domains: [],
  },

  // Proxy API requests and uploads to backend
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3001/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
