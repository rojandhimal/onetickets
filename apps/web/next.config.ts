import type { NextConfig } from 'next';
import { securityHeaders, verifyPageHeaders } from './src/lib/security-headers';

// The browser only ever talks to /api on the web origin, so the session cookie stays
// first-party. Next forwards those calls to the NestJS api.
const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (S0-2).
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@onetickets/shared'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Listed after the catch-all so its Referrer-Policy wins.
      { source: '/auth/verify', headers: verifyPageHeaders },
    ];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
