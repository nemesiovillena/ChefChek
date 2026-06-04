import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static export - need SSR for authenticated routes
  output: undefined,

  // Configure image domains for optimized images
  images: {
    domains: [],
  },

  // Experimental: disable ISR for now
  experimental: {
    // Optimize package imports
  },
};

export default nextConfig;
