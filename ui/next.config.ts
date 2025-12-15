import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API requests to backend during development
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Configure image domains (using remotePatterns instead of deprecated domains)
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
    ],
  },

  // Set turbopack root to avoid workspace detection warnings
  turbopack: {
    root: __dirname,
  },

  // Environment variables for WebSocket
  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    NEXT_PUBLIC_MAX_UPLOAD_SIZE: process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE || '52428800',
  },
};

export default nextConfig;