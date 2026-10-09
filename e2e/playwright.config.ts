import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run the built web and api against a real Postgres (DATABASE_URL).
// Locally: `docker compose up -d postgres mailpit`, `pnpm build`, then `pnpm e2e`.
const webUrl = 'http://localhost:3000';
const apiUrl = 'http://localhost:3001';

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: 0, // A flaky test is a bug: fix it, don't retry it.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    // 375 px is the narrowest width the Definition of Done requires.
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @onetickets/api start',
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3001',
        WEB_URL: webUrl,
        SESSION_COOKIE_SECURE: 'false',
        MAIL_TRANSPORT: 'console',
        TRUST_PROXY_HOPS: '0',
        // A fixed test-only key: 32 bytes, base64.
        MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      },
    },
    {
      command: 'pnpm --filter @onetickets/web start',
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      env: { API_URL: apiUrl },
    },
  ],
});
