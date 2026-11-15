import type { BrowserContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';

// S2-4 "My tickets" attendee portal e2e tests (Sprint 2 QA checklist rows 4.1, 4.2, 4.3, 4.7).
// Runs against real Next.js web server with enforced CSP, at 375 px and 1280 px.

test('signed-out visitor sees ticket lookup with anti-enumeration message (Row 4.2)', async ({
  page,
}) => {
  await page.goto('/my-tickets');

  // Verify heading and form elements
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find your tickets');
  const emailInput = page.getByLabel('Email');
  await expect(emailInput).toBeVisible();

  // Row 4.2: Submitting a valid email displays neutral anti-enumeration message
  const testEmail = 'alex.attendee@example.test';
  await emailInput.fill(testEmail);
  await page.getByRole('button', { name: 'Email me a link' }).click();

  await expect(
    page.getByText(`Check your email. If ${testEmail} has tickets, the link is on its way.`),
  ).toBeVisible();

  // Accessibility check on lookup view
  await expectAccessible(page);
});

test('verify page immediately strips hash fragment from address bar (Row 4.3)', async ({
  page,
}) => {
  // Navigate with fragment token
  await page.goto('/my-tickets/verify#token=test-fragment-token-12345');

  // Row 4.3: Hash token is immediately stripped before verification to prevent Referer leaks
  await expect(page).not.toHaveURL(/#token=/);
  await expect(page).toHaveURL(/\/my-tickets\/verify$/);

  // Expired / invalid token state renders gracefully
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /That link doesn['’]t work|Link expired|Verification failed/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();

  // Accessibility check on verify error view
  await expectAccessible(page);
});

async function mockAttendeeSession(
  context: BrowserContext,
  orders: unknown[] = [],
  email = 'alex.attendee@example.test',
) {
  await context.route('**/api/attendee/session', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          permissions: ['tickets:read'],
        }),
      });
    }
    return route.continue();
  });

  await context.route('**/api/attendee/orders*', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders,
          nextCursor: null,
        }),
      });
    }
    return route.continue();
  });
}

test('signed-in attendee empty state displays browse link (Row 4.7)', async ({ page, context }) => {
  await mockAttendeeSession(context, []);
  await page.goto('/my-tickets');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My tickets');
  await expect(page.getByRole('tab', { name: /Upcoming/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Past/ })).toBeVisible();

  // Row 4.7: Empty state copy and Browse CTA
  await expect(page.getByText('No upcoming tickets.')).toBeVisible();
  const browseLink = page.getByRole('link', { name: 'Find something on this weekend' });
  await expect(browseLink).toBeVisible();
  await expect(browseLink).toHaveAttribute('href', '/');

  await expectAccessible(page);
});

test('signed-in attendee renders orders with upcoming and past tabs (Row 4.1)', async ({
  page,
  context,
}) => {
  const futureYear = new Date().getFullYear() + 1;
  const mockOrders = [
    {
      orderId: '00000000-0000-4000-8000-000000000001',
      totalCents: 0,
      createdAt: '2026-11-10T10:00:00Z',
      event: {
        id: 'evt_future',
        slug: 'sydney-design-night',
        name: 'Sydney Design Night',
        startsAt: `${futureYear}-12-15T18:00:00+11:00`,
        endsAt: `${futureYear}-12-15T21:00:00+11:00`,
        timeZone: 'Australia/Sydney',
        venue: {
          kind: 'place',
          name: 'Powerhouse Museum',
          suburb: 'Ultimo',
          city: 'sydney',
        },
      },
      tickets: [
        {
          id: '00000000-0000-4000-8000-000000000011',
          ticketTypeId: 'tt_1',
          ref: 'K7Q1M1',
          holderName: 'Alex Attendee',
          ticketTypeName: 'General admission',
          qr: 'OT1.k1.evt_future.tkt_1.1792677665.sig1',
          status: 'valid',
          issuedAt: '2026-11-10T10:00:00Z',
        },
        {
          id: '00000000-0000-4000-8000-000000000012',
          ticketTypeId: 'tt_1',
          ref: 'K7Q1M2',
          holderName: 'Jordan Guest',
          ticketTypeName: 'General admission',
          qr: 'OT1.k1.evt_future.tkt_2.1792677665.sig2',
          status: 'valid',
          issuedAt: '2026-11-10T10:00:00Z',
        },
      ],
    },
    {
      orderId: '00000000-0000-4000-8000-000000000002',
      totalCents: 0,
      createdAt: '2025-01-10T10:00:00Z',
      event: {
        id: 'evt_past',
        slug: 'pottery-basics-2025',
        name: 'Pottery Basics',
        startsAt: '2025-02-10T10:00:00+11:00',
        endsAt: '2025-02-10T13:00:00+11:00',
        timeZone: 'Australia/Sydney',
        venue: {
          kind: 'place',
          name: 'The Print Shed',
          suburb: 'Marrickville',
          city: 'sydney',
        },
      },
      tickets: [
        {
          id: '00000000-0000-4000-8000-000000000021',
          ticketTypeId: 'tt_2',
          ref: 'K7Q2M1',
          holderName: 'Alex Attendee',
          ticketTypeName: 'General admission',
          qr: 'OT1.k1.evt_past.tkt_1.1739145600.sig3',
          status: 'valid',
          issuedAt: '2025-01-10T10:00:00Z',
        },
      ],
    },
  ];

  await mockAttendeeSession(context, mockOrders);
  await page.goto('/my-tickets');

  // Row 4.1: Upcoming tab displays active order card
  await expect(page.getByRole('heading', { level: 2, name: 'Sydney Design Night' })).toBeVisible();
  await expect(page.getByText('Ultimo · Powerhouse Museum')).toBeVisible();
  await expect(page.getByText('2 tickets')).toBeVisible();

  const showQrBtn = page.getByRole('link', { name: 'Show QR for Sydney Design Night' });
  await expect(showQrBtn).toBeVisible();
  await expect(showQrBtn).toHaveAttribute('href', '/tickets/00000000-0000-4000-8000-000000000001');

  // Switch to Past tab
  const pastTab = page.getByRole('tab', { name: /Past/ });
  await pastTab.click();
  await expect(pastTab).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByRole('heading', { level: 2, name: 'Pottery Basics' })).toBeVisible();
  await expect(page.getByText('Marrickville · The Print Shed')).toBeVisible();
  await expect(page.getByText('1 ticket', { exact: true })).toBeVisible();

  await expectAccessible(page);
});
