import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';

// SEC-16: signing out ends the session and leaves nothing behind for the next person on the device.

test('signing out ends the session and clears drafts kept on this device', async ({ page }) => {
  await signUpOrganiser(page);
  await expectAccessible(page);

  await seedDraftsDatabase(page);

  const before = await page.context().cookies();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/signin$/);

  expect(await databaseNames(page)).not.toContain('onetickets');
  expect((await page.context().cookies()).filter((c) => /session/i.test(c.name))).toEqual([]);

  // The old session is revoked on the server too: putting its cookie back doesn't sign us in.
  await page.context().addCookies(before);
  await page.goto('/organiser');
  await page.waitForURL(/\/signin/);
});

for (const [failure, fail] of [
  ['is offline', (route: Route) => route.abort('internetdisconnected')],
  ['gets a 500', (route: Route) => route.fulfill({ status: 500, body: '' })],
] as const) {
  test(`a sign-out that ${failure} says so, keeps the page and still clears drafts`, async ({
    page,
  }) => {
    await signUpOrganiser(page);
    await seedDraftsDatabase(page);
    await page.route('**/api/auth/sign-out', fail);

    await page.getByRole('button', { name: 'Sign out' }).click();
    // Next's route announcer is also role=alert, so find ours by its words.
    await expect(
      page.getByRole('alert').filter({ hasText: "We couldn't sign you out." }),
    ).toHaveText("We couldn't sign you out. Check your connection and try again.");
    await expect(page).toHaveURL(/\/organiser$/);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeEnabled();
    expect(await databaseNames(page)).not.toContain('onetickets');
    await expectAccessible(page);
  });
}

/** Stands in for an offline draft the wizard saved on this computer. */
async function seedDraftsDatabase(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('onetickets', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('event-drafts');
        open.onsuccess = () => {
          open.result.close();
          resolve();
        };
        open.onerror = () => reject(open.error);
      }),
  );
  expect(await databaseNames(page)).toContain('onetickets');
}

function databaseNames(page: Page) {
  return page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
}
