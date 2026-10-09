import { expect, test } from '@playwright/test';
import { expectAccessible } from './a11y';

// S0-3 web. Loads each page from the production build, so a server render error fails here
// even when unit tests pass. The sign-in api arrives in its own PR; these need no session.

test('sign-up asks only for an email', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('input:not([type=hidden])')).toHaveCount(1);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expectAccessible(page);
});

test('sign-up shows an inline error for an empty email', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: /email me|send|continue/i }).click();
  await expect(page.getByLabel(/email/i)).toBeFocused();
  await expect(page.getByLabel(/email/i)).toHaveAttribute('aria-invalid', 'true');
  await expectAccessible(page);
});

test('sign-in loads and shows a known error message', async ({ page }) => {
  await page.goto('/signin?error=google_unavailable');
  await expect(page.getByRole('alert').filter({ hasText: /Google/ })).toBeVisible();
  await expectAccessible(page);
});

test('an unknown error code is not echoed back', async ({ page }) => {
  await page.goto('/signin?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  await expect(page.getByText('<script>')).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
});

test('a sign-in link without a token says it has expired', async ({ page }) => {
  await page.goto('/auth/verify');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/expired/i);
  await expect(page.getByRole('link', { name: /new link|sign in/i })).toHaveAttribute(
    'href',
    '/signin',
  );
  await expectAccessible(page);
});
