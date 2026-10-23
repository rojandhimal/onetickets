import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';

// S2-3 ticket screen (artboard 4) at 375 and 1280 px, under the site-wide enforced CSP (#52). The
// tickets api is still being built, so its one read is answered here from a fake order of fake
// people; checkout (S2-2) lands on this page with the key in the fragment.

const KEY = 'tk_e2e_abcdefghijklmnop'; // gitleaks:allow (fake ticket key)
const ORDER = 'ord-e2e-1';

const ticket = (n: number, holderName: string) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  ref: `K7Q4${n}M9X`,
  holderName,
  ticketTypeName: 'General admission',
  qr: `OT1.k1.evt_e2e.tkt_${n}.1792677665.c2lnbmF0dXJl`,
  status: 'valid',
  issuedAt: '2027-01-10T03:00:00Z',
});

const order = {
  orderId: ORDER,
  email: 'jordan@example.test',
  event: {
    slug: 'screen-printing-k7q4',
    name: 'Screen printing for beginners',
    startsAt: '2027-03-13T10:00:00+11:00',
    endsAt: '2027-03-13T13:00:00+11:00',
    timeZone: 'Australia/Sydney',
    venue: {
      kind: 'place',
      placeId: 'pl_1',
      name: 'The Print Shed',
      address: '12 Sydenham Rd, Marrickville NSW 2204',
      suburb: 'Marrickville',
      city: 'sydney',
      lat: -33.91,
      lng: 151.16,
    },
    organiser: { name: 'Marrickville Print Club' },
  },
  tickets: [ticket(1, 'Jordan Lee'), ticket(2, 'Sam Lee')],
};

/** Answers the order read like the api will: only with the right key, and not when offline. */
async function fakeTicketsApi(context: BrowserContext) {
  const state = { online: true, reads: 0 };
  await context.route('**/api/public/orders/*/tickets', async (route) => {
    if (!state.online) return route.abort('internetdisconnected');
    state.reads += 1;
    const auth = route.request().headers()['authorization'];
    if (auth !== `Bearer ${KEY}`) return route.fulfill({ status: 404, json: { statusCode: 404 } });
    return route.fulfill({ json: order, headers: { 'cache-control': 'private, no-store' } });
  });
  return state;
}

const open = (page: Page, key = KEY) => page.goto(`/tickets/${ORDER}#key=${key}`);

test('the confirmation shows each ticket, pages between them and adds to a calendar', async ({
  page,
  context,
}) => {
  await fakeTicketsApi(context);
  await open(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're going!");
  // The key leaves the address bar as soon as the page has it.
  await expect(page).toHaveURL(new RegExp(`/tickets/${ORDER}$`));
  await expect(
    page.getByText("We've also emailed your tickets to jordan@example.test"),
  ).toBeVisible();
  const first = page.getByRole('article', { name: 'Ticket 1 of 2' });
  await expect(first.getByRole('img', { name: 'QR code for ticket K7Q4-1M9X' })).toBeVisible();
  await expect(first).toContainText('Jordan Lee');
  await expect(page.getByRole('button', { name: /wallet/i })).toHaveCount(0);
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Next ticket' }).click();
  await expect(page.getByText('Ticket 2 of 2')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Ticket 2 of 2' })).toContainText('Sam Lee');
  await expect(page.getByRole('button', { name: 'Next ticket' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  const calendar = page.getByRole('button', { name: 'Add to calendar' });
  await calendar.click();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Apple Calendar or Outlook' }).click();
  expect((await download).suggestedFilename()).toBe('screen-printing-k7q4.ics');
  await calendar.click();
  await expect(page.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute(
    'href',
    /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&/,
  );
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(calendar).toBeFocused();
  await expect(calendar).toHaveAttribute('aria-expanded', 'false');
});

test('after the first visit the tickets open with no signal', async ({ page, context }) => {
  const api = await fakeTicketsApi(context);
  await open(page);
  await expect(page.getByText('Works offline')).toBeVisible();

  api.online = false;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're going!");
  await expect(page.getByRole('img', { name: 'QR code for ticket K7Q4-1M9X' })).toBeVisible();
  await expect(page.getByText('Works offline')).toBeVisible();
  await context.setOffline(false);
});

test('"Remove tickets from this phone" leaves nothing saved on the device', async ({
  page,
  context,
}) => {
  await fakeTicketsApi(context);
  await open(page);
  await expect(page.getByText('Works offline')).toBeVisible();
  const saved = () =>
    page.evaluate(async () => ({
      caches: await caches.keys(),
      workers: (await navigator.serviceWorker.getRegistrations()).length,
      key: Object.keys(sessionStorage).filter((k) => k.startsWith('onetickets:')),
    }));
  expect((await saved()).caches).toEqual(['onetickets-tickets-v1']);

  await page.getByRole('button', { name: 'Remove tickets from this phone' }).click();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(
    page.getByText('Removed from this phone. Your tickets are still in your email.'),
  ).toBeFocused();
  await expect(page.getByText('Works offline')).toHaveCount(0);
  expect(await saved()).toEqual({ caches: [], workers: 0, key: [] });
  await expectAccessible(page);
});

test('a wrong key shows no tickets', async ({ page, context }) => {
  await fakeTicketsApi(context);
  await open(page, 'tk_wrong_key_0123456789');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    "That link doesn't work any more.",
  );
  await expectAccessible(page);
});

test('the service worker and ticket pages are never kept by a shared cache', async ({
  request,
}) => {
  const worker = await request.get('/tickets-sw.js');
  expect(worker.ok()).toBe(true);
  expect(worker.headers()['content-type']).toMatch(/javascript/);
  expect(worker.headers()['cache-control']).toMatch(/no-store|no-cache/);
  // Scope stays /tickets/, as registered; nothing widens it.
  expect(worker.headers()['service-worker-allowed']).toBeUndefined();

  const page = await request.get(`/tickets/${ORDER}`);
  expect(page.headers()['cache-control']).toContain('no-store');
  expect(page.headers()['referrer-policy']).toBe('no-referrer');
});
