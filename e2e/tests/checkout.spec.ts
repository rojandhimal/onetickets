import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';
import { pickMarrickville } from './venue';

// S2-2 One-screen free checkout e2e tests (Sprint 2 QA checklist rows 2.1 - 2.8).
// Runs against real Postgres with RLS, per-request nonce CSP, and at 375 px and 1280 px.

const nextYear = new Date().getFullYear() + 1;

async function publishFreeEvent(page: Page, name: string): Promise<{ path: string; slug: string }> {
  await signUpOrganiser(page);
  await page.getByRole('link', { name: /Workshop/ }).click();
  await page.waitForURL(/\/basics\?draft=/);
  await page.getByLabel('Event name').fill(name);
  await page.getByLabel('Date').fill(`${nextYear}-11-28`);
  await page.getByLabel('Starts').fill('19:00');
  await page.getByLabel('Ends').fill('21:00');
  await pickMarrickville(page);
  await page.getByLabel('Event name').focus();
  await expect(page.getByRole('banner').getByRole('status')).toHaveText('Draft saved');

  const draft = new URL(page.url()).searchParams.get('draft')!;
  await page.goto(`/organiser/events/new/details?draft=${draft}`);
  await page.getByRole('link', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Publish event' }).click();

  const eventLink = page.getByRole('link', { name: 'See your event page' });
  const path = await eventLink.getAttribute('href');
  const slug = path!.replace(/^\/e\//, '');
  return { path: path!, slug };
}

test('completes one-screen free checkout flow and redirects to confirmation (Rows 2.1, 2.2, 2.3, 2.7, 2.8)', async ({
  page,
  context,
}) => {
  const eventName = `Clay & Sip ${Date.now()}`;
  const { path } = await publishFreeEvent(page, eventName);

  // Clear cookies so we act as an anonymous attendee guest
  await context.clearCookies();

  // Navigate to event page and click "Get tickets"
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(eventName);
  const getTicketsBtn = page.getByRole('link', { name: 'Get tickets' });
  await expect(getTicketsBtn).toBeVisible();
  await getTicketsBtn.click();

  await page.waitForURL(/\/tickets$/);

  // Row 2.1: Heading, layout, and accessibility check at current viewport (375 px or 1280 px)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get your tickets');
  await expectAccessible(page);

  // Row 2.2: Stepper behaviour: 1 ticket preselected by default
  const holdNotice = page.getByRole('status');
  await expect(holdNotice).toHaveText(
    "We're holding 1 ticket for you while you finish. Take your time.",
  );

  const submitButton = page.getByRole('button', { name: 'Get 1 free ticket' });
  await expect(submitButton).toBeVisible();

  // Increase stepper to 2 tickets
  await page.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(holdNotice).toHaveText(
    "We're holding 2 tickets for you while you finish. Take your time.",
  );
  await expect(page.getByRole('button', { name: 'Get 2 free tickets' })).toBeVisible();

  // Row 2.7: Form validation on submit: submitting without details triggers inline errors
  await page.getByRole('button', { name: 'Get 2 free tickets' }).click();
  await expect(page.getByText('Enter the name for the ticket')).toBeVisible();
  await expect(page.getByLabel('Name')).toBeFocused();

  // Fill Name
  await page.getByLabel('Name').fill('Sam Taylor');

  // Submit with empty email
  await page.getByRole('button', { name: 'Get 2 free tickets' }).click();
  await expect(page.getByText('Enter your email address')).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeFocused();

  // Fill invalid email (no @)
  await page.getByLabel('Email address').fill('samtaylorexample.com');
  await page.getByRole('button', { name: 'Get 2 free tickets' }).click();
  await expect(page.getByText('Add an @, like jordan@example.com')).toBeVisible();

  // Fill valid email
  await page.getByLabel('Email address').fill('sam@example.test');

  // Opt-in checkbox is unchecked by default
  const optIn = page.getByLabel(/Send me news about future events/);
  expect(await optIn.isChecked()).toBe(false);

  // Row 2.8: Submission state and redirection to confirmation
  await page.getByRole('button', { name: 'Get 2 free tickets' }).click();

  // Redirects to /tickets/:orderRef
  await page.waitForURL(/\/tickets\/OT-[A-Z0-9]{8}$/);

  // Confirmation screen verification
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're going!");
  await expect(
    page.getByText(/We['’]ve also emailed your tickets to sam@example\.test/),
  ).toBeVisible();
  await expect(page.getByText('Sam Taylor')).toBeVisible();
  await expect(page.getByText(eventName)).toBeVisible();

  // Accessibility check on confirmation screen
  await expectAccessible(page);
});
