import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// Signs a new organiser up through the real flow. The api runs with MAIL_TRANSPORT=console and
// playwright.config.ts keeps its output in .logs/api.log, where the sign-in link is printed.
const API_LOG = new URL('../.logs/api.log', import.meta.url);

/** The latest sign-in link mailed to `email`; workers run in parallel, so match the address. */
function signInLink(email: string): string | null {
  let log: string;
  try {
    log = readFileSync(API_LOG, 'utf8');
  } catch {
    return null;
  }
  const mails = log.split('--- mail').filter((m) => m.includes(`To: ${email}`));
  return mails.at(-1)?.match(/https?:\/\/\S+\/auth\/verify#token=[\w-]+/)?.[0] ?? null;
}

/** A fresh owner with an organisation, signed in on `page`, landing on /organiser. */
export async function signUpOrganiser(page: Page, organiserName = 'E2E Print Club') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto('/signup');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /email me/i }).click();
  await expect
    .poll(() => signInLink(email), { message: 'sign-in link in the api log' })
    .not.toBeNull();
  await page.goto(signInLink(email)!);
  await page.waitForURL(/\/organiser\/setup/);
  await page.getByLabel(/organiser name/i).fill(organiserName);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL(/\/organiser$/);
  return { email };
}
