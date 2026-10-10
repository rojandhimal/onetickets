import { expect, test as base } from '@playwright/test';

// Every page in the test's browser context is watched for Content-Security-Policy violations, so
// a report-only CSP regression fails e2e instead of reaching production. Violations are collected
// on the Node side, so ones on a page the test has already navigated away from still count.
// Specs import `test` and `expect` from here instead of '@playwright/test'.
export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ context }, use) => {
      const violations: string[] = [];
      await context.exposeBinding('__reportCsp', (_source, violation: string) => {
        violations.push(violation);
      });
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as unknown as { __reportCsp: (v: string) => void }).__reportCsp(
            `${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile}:${e.lineNumber})`,
          );
        });
      });
      await use();
      expect(violations, 'Content-Security-Policy violations on the page').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
