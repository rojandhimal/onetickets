import type { NextConfig } from 'next';

// The browser only ever talks to /api on the web origin, so the session cookie stays
// first-party. Next forwards those calls to the NestJS api.
const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@onetickets/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
