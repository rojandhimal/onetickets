import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';

// S1-3 public event page: an event published through the wizard is readable by anyone, under an
// enforced nonce CSP, with no shared caching (QA Sprint 1 rows 3.x). The CSP guard in fixtures.ts
// fails the test on any violation.

const nextYear = new Date().getFullYear() + 1;

test('a published event has a public page anyone can open', async ({ page, context }) => {
  await signUpOrganiser(page);
  await page.getByRole('link', { name: /Workshop/ }).click();
  await page.waitForURL(/\/basics\?draft=/);
  await page.getByLabel('Event name').fill('Lino cut night');
  await page.getByLabel('Date').fill(`${nextYear}-11-21`);
  await page.getByLabel('Starts').fill('18:30');
  await page.getByLabel('Ends').fill('21:00');
  await page.getByRole('combobox', { name: 'Venue address' }).fill('Marrickville');
  await page.getByRole('option', { name: /Marrickville Town Hall/ }).click();
  await page.getByLabel('Event name').focus();
  await expect(page.getByRole('banner').getByRole('status')).toHaveText('Draft saved');

  const draft = new URL(page.url()).searchParams.get('draft')!;
  await page.goto(`/organiser/events/new/review?draft=${draft}`);
  await page.getByRole('button', { name: 'Publish event' }).click();
  const eventLink = page.getByRole('link', { name: 'See your event page' });
  const path = await eventLink.getAttribute('href');
  expect(path).toMatch(/^\/e\/lino-cut-night-/);

  // A visitor with no session, in the same context so the CSP guard watches the enforced policy.
  await context.clearCookies();
  const response = await page.goto(path!);
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['content-security-policy']).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(headers['cache-control']).toBe('private, no-store');

  // A browser's own document prefetch can become the page shown, so it gets the policy too.
  const prefetched = await page.request.get(path!, {
    headers: { 'sec-purpose': 'prefetch', purpose: 'prefetch' },
  });
  expect(prefetched.headers()['content-security-policy']).toMatch(/'nonce-[^']+'/);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lino cut night');
  await expect(page.getByText('Marrickville Town Hall').first()).toBeVisible();
  await expect(page.getByText('Tickets open soon').first()).toBeVisible();
  // Nothing ticked: the row says so and points ticket holders at their email (row 4.3).
  const facts = page.locator('dl');
  await expect(facts.getByText('No accessibility details yet', { exact: true })).toBeVisible();
  await expect(
    facts.getByText('Booked? Reply to your confirmation email to ask the organiser.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Accessibility' })).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  // About was left empty, so the template's prompt never reaches the public page.
  await expect(page.getByRole('region', { name: 'About' })).toHaveCount(0);
  await expect(page.getByText('What will people make or learn?')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image/,
  );
  await expectAccessible(page);
});

test('an unknown slug is a 404', async ({ page }) => {
  const response = await page.goto('/e/no-such-event-zz99');
  expect(response?.status()).toBe(404);
});
