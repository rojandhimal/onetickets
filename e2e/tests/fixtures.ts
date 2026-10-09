import { expect, test as base } from '@playwright/test';

// Every page load is watched for Content-Security-Policy violations, and a test fails if any
// happened. The CSP is report-only today, so a violation would otherwise only show up as a
// Sentry report in production, and would break the page once the policy is enforced.
export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        const seen: string[] = [];
        (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
        document.addEventListener('securitypolicyviolation', (e) => {
          seen.push(
            `${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile}:${e.lineNumber})`,
          );
        });
      });
      await use();
      if (page.isClosed()) return;
      const violations = await page
        .evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [])
        .catch(() => []);
      expect(violations, 'Content-Security-Policy violations on the page').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
