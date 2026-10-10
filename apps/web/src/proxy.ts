import { type NextRequest, NextResponse } from 'next/server';
import { strictEventPageCsp } from './lib/security-headers';

// Public event pages get an enforced, per-request nonce CSP (SEC-3). Every other page keeps the
// report-only policy from next.config.ts until Next's inline scripts carry nonces everywhere.
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = strictEventPageCsp(nonce, { dev: process.env.NODE_ENV === 'development' });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/e/:slug',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
