# 0018. Enforce a nonce-based CSP on public event pages first, site-wide before checkout

- Status: Accepted (event pages in S1-3; site-wide enforced in SEC-14 before S2-2 checkout)
- Date: 2026-10-10 (updated 2026-10-21 for SEC-14)
- Story: S1-3 (SEC-3), SEC-14
- Deciders: FrontendDev, Security (accepted the approach on 2026-10-10, site-wide rollout on 2026-10-21)

## Context

Event pages show text organisers wrote (name, About, access notes) to buyers who may be signed in.
A stored XSS there could act as the buyer (threat model T8). Every page already sends a
report-only CSP, but report-only blocks nothing. Enforcing it everywhere needs Next's inline
bootstrap scripts to carry a per-request nonce, which forces dynamic rendering on every page.

## Options considered

- **Enforce the existing CSP everywhere with `'unsafe-inline'` scripts.** Easy, but
  `'unsafe-inline'` lets an injected inline script run, so it doesn't stop T8.
- **Nonce CSP on every page.** Strongest, but turns every static page dynamic and touches the sign-in
  flows that are already reviewed.
- **Nonce CSP on public event pages only, report-only elsewhere (chosen).** Covers the pages where
  untrusted organiser text meets buyers. Event pages are rendered per request anyway.

## Decision

- `apps/web/src/proxy.ts` runs on `/e/:slug`. It makes a fresh nonce per request and sends an
  enforced `Content-Security-Policy` built by `strictEventPageCsp()` in
  `apps/web/src/lib/security-headers.ts`:
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`,
  `frame-ancestors 'none'`, plus the same img, font, connect and report rules as the rest of the site.
  Next adds the nonce to its own scripts.
- `style-src` keeps `'unsafe-inline'` because React style attributes (the banner focal point) need
  it. Injected styles can't run code.
- Organiser text is still plain text end to end: the api strips markup (BackendDev, SEC-3) and the
  page renders it as React text with `white-space: pre-line`, never with `dangerouslySetInnerHTML`.
  The CSP is the second layer, not the first.
- Violations go to `/csp-report` like the report-only ones (ADR 0003).

## Consequences

- **Before any checkout or payment page ships, the CSP must be enforced on every page** (Security's
  condition, 2026-10-10; fulfilled by SEC-14 on 2026-10-21). `apps/web/src/proxy.ts` applies `strictSiteCsp`
  with a per-request nonce to all document requests site-wide.
- With site-wide CSP enforced, all pages carry the nonce policy and `Cache-Control: private, no-store`.
  Navigation across the site preserves the strict security guarantees.
- Any new script on any page must be loaded by Next or carry the nonce (`headers().get('x-nonce')`),
  or it will be blocked. The e2e CSP check (PR #13) catches this.
- If About or access notes ever turn URLs into links, allow only http and https and add
  `rel="noopener noreferrer nofollow ugc"`.
- A possible tightening, not done yet: `style-src-elem 'self' 'nonce-…'` with
  `style-src-attr 'unsafe-inline'`, which keeps React style attributes but blocks injected
  `<style>` elements.
- Revisit when Next can nonce statically rendered pages, or when the report-only reports from other
  pages are clean: then move every page to the enforced policy.
