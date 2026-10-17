import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';

// S1-5 public browse page (QA Sprint 1 rows 5.1 to 5.8): lists upcoming published events by city,
// filters by deselectable When and Price chips, announces result counts via role="status", shows
// the empty state when nothing matches, and links to /e/:slug with plain <a> tags so the event
// page's enforced nonce CSP loads (ADR 0018).

type DraftEvent = { id: string; version: number; slug: string | null };

const revalidateSecret = Buffer.alloc(32, 9).toString('base64');

function futureWindow(daysAhead: number, timeZone: string) {
  const start = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timeZone,
  };
}

async function createDraft(
  page: import('@playwright/test').Page,
  orgId: string,
  origin: string,
  patch: Record<string, unknown>,
): Promise<DraftEvent> {
  const created = await page.request.post(`/api/organisations/${orgId}/events`, {
    headers: { origin },
    data: { template: 'workshop' },
  });
  expect(created.ok()).toBe(true);
  const draft = (await created.json()) as DraftEvent;

  const updated = await page.request.patch(`/api/organisations/${orgId}/events/${draft.id}`, {
    headers: { origin },
    data: { version: draft.version, ...patch },
  });
  expect(updated.ok()).toBe(true);
  return (await updated.json()) as DraftEvent;
}

test('visitors can browse upcoming events, switch city, toggle filters and open an event', async ({
  page,
  context,
}) => {
  const tag = Math.random().toString(36).slice(2, 8);
  const sydneyTitle = `Sydney Zine Fair ${tag}`;
  const draftTitle = `Unpublished Draft ${tag}`;
  const melbourneTitle = `Collingwood Synth Night ${tag}`;

  await signUpOrganiser(page, `Browse Org ${tag}`);
  const origin = new URL(page.url()).origin;
  const meRes = await page.request.get('/api/me');
  expect(meRes.ok()).toBe(true);
  const me = (await meRes.json()) as { organisation: { id: string } };
  const orgId = me.organisation.id;

  const sydneyPlace = await (
    await page.request.get('/api/places/fake-marrickville-town-hall')
  ).json();
  const melbournePlace = await (await page.request.get('/api/places/fake-the-tote')).json();

  // 1. Published Sydney event (2 days from now -> within Next 7 days).
  const sydneyDraft = await createDraft(page, orgId, origin, {
    name: sydneyTitle,
    ...futureWindow(2, 'Australia/Sydney'),
    venue: sydneyPlace,
  });
  const pubSydney = await page.request.post(
    `/api/organisations/${orgId}/events/${sydneyDraft.id}/publish`,
    { headers: { origin } },
  );
  expect(pubSydney.ok()).toBe(true);
  const publishedSydney = (await pubSydney.json()) as DraftEvent;

  // 2. Unpublished Sydney draft (must never appear in public browse, row 5.1).
  await createDraft(page, orgId, origin, {
    name: draftTitle,
    ...futureWindow(2, 'Australia/Sydney'),
    venue: sydneyPlace,
  });

  // 3. Published Melbourne event (must appear under Melbourne, not Sydney, rows 5.1 & 5.2).
  const melbourneDraft = await createDraft(page, orgId, origin, {
    name: melbourneTitle,
    ...futureWindow(2, 'Australia/Melbourne'),
    venue: melbournePlace,
  });
  const pubMel = await page.request.post(
    `/api/organisations/${orgId}/events/${melbourneDraft.id}/publish`,
    { headers: { origin } },
  );
  expect(pubMel.ok()).toBe(true);
  const publishedMel = (await pubMel.json()) as DraftEvent;

  // Ensure the web app's data cache has processed the revalidation before opening `/`.
  const revalidated = await page.request.post('/internal/revalidate', {
    headers: { authorization: `Bearer ${revalidateSecret}` },
    data: { slugs: [publishedSydney.slug!, publishedMel.slug!] },
  });
  expect(revalidated.status()).toBe(204);

  // Public visitor with no session.
  await context.clearCookies();
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coming up near you');
  await expect(page.getByText('Prices shown are what you pay. No fees added later.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/^\d+ events?$/);

  // Row 5.1: Sydney shows the published Sydney event, excludes the draft and Melbourne event.
  await expect(page.getByRole('heading', { name: sydneyTitle })).toBeVisible();
  await expect(page.getByText(draftTitle)).toHaveCount(0);
  await expect(page.getByText(melbourneTitle)).toHaveCount(0);

  // Row 5.5: Card is a single link whose aria-label reads all four facts.
  const cardLink = page.getByRole('link', { name: new RegExp(sydneyTitle) });
  await expect(cardLink).toHaveAttribute(
    'aria-label',
    new RegExp(`${sydneyTitle}, .+, Marrickville · Marrickville Town Hall, Free`),
  );
  await expect(cardLink.getByText('Workshop')).toBeVisible();
  await expect(cardLink.getByText('Marrickville · Marrickville Town Hall')).toBeVisible();
  await expectAccessible(page);

  // Row 5.3: When chips are single-select and deselectable, and heading follows the When chip.
  const whenGroup = page.getByRole('group', { name: 'When' });
  const next7Chip = whenGroup.getByRole('button', { name: 'Next 7 days' });
  await next7Chip.click();
  await expect(next7Chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Next 7 days');
  await expect(page.getByRole('heading', { name: sydneyTitle })).toBeVisible();

  await next7Chip.click();
  await expect(next7Chip).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coming up near you');

  // Row 5.3 & 5.7: Price chip Paid shows the empty state and announces 0 events.
  const priceGroup = page.getByRole('group', { name: 'Price' });
  const paidChip = priceGroup.getByRole('button', { name: 'Paid' });
  await paidChip.click();
  await expect(paidChip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Nothing on for that yet. Try Next 7 days.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('0 events');
  await expectAccessible(page);

  await paidChip.click();
  await expect(paidChip).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: sydneyTitle })).toBeVisible();

  // Row 5.2: Changing city to Melbourne shows Melbourne events and hides Sydney events.
  await page.getByRole('button', { name: /Near Sydney/ }).click();
  await page
    .getByRole('group', { name: 'City' })
    .getByRole('button', { name: 'Melbourne' })
    .click();
  await expect(page.getByRole('button', { name: /Near Melbourne/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: melbourneTitle })).toBeVisible();
  await expect(page.getByText(sydneyTitle)).toHaveCount(0);
  await expectAccessible(page);

  // ADR 0018: Clicking a card performs a full document navigation to /e/:slug with enforced CSP.
  const melbourneCard = page.getByRole('link', { name: new RegExp(melbourneTitle) });
  const [docResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes('/e/collingwood-synth-night-') && res.request().isNavigationRequest(),
    ),
    melbourneCard.click(),
  ]);
  expect(docResponse.headers()['content-security-policy']).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(melbourneTitle);
});
