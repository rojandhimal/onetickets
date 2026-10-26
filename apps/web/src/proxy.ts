import { type NextRequest, NextResponse } from 'next/server';
import { TURNSTILE_PATHS } from './lib/flags';
import { strictSiteCsp } from './lib/security-headers';

// Site-wide enforced per-request nonce CSP (SEC-14, ADR 0018). Every document request receives a
// fresh nonce and an enforced Content-Security-Policy header. Next adds the nonce to its inline
// bootstrap scripts.
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = strictSiteCsp(nonce, {
    dev: process.env.NODE_ENV === 'development',
    // Only where the widget loads, and only with SEC-10 on.
    turnstile:
      process.env.TURNSTILE_ENABLED === 'true' &&
      TURNSTILE_PATHS.includes(request.nextUrl.pathname),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  // The nonce is per response, so no shared cache or CDN may hand this HTML to anyone else.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|csp-report|internal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
      // Router prefetches fetch the RSC payload, not a document. A browser's own prefetch
      // (`Purpose: prefetch`) can become the page the visitor sees, so it still gets the policy.
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
