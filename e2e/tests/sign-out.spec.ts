import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';

// SEC-16: signing out ends the session and leaves nothing behind for the next person on the device.

test('signing out ends the session and clears drafts kept on this device', async ({ page }) => {
  await signUpOrganiser(page);
  await expectAccessible(page);

  // Stand in for an offline draft the wizard saved on this computer.
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

  const before = await page.context().cookies();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/signin$/);

  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name),
  );
  expect(databases).not.toContain('onetickets');
  expect((await page.context().cookies()).filter((c) => /session/i.test(c.name))).toEqual([]);

  // The old session is revoked on the server too: putting its cookie back doesn't sign us in.
  await page.context().addCookies(before);
  await page.goto('/organiser');
  await page.waitForURL(/\/signin/);
});

test('a sign-out that does not reach the api says so and keeps the page', async ({ page }) => {
  await signUpOrganiser(page);
  await page.route('**/api/auth/sign-out', (route) => route.abort('internetdisconnected'));

  await page.getByRole('button', { name: 'Sign out' }).click();
  // Next's route announcer is also role=alert, so find ours by its words.
  await expect(page.getByRole('alert').filter({ hasText: "We couldn't sign you out." })).toHaveText(
    "We couldn't sign you out. Check your connection and try again.",
  );
  await expect(page).toHaveURL(/\/organiser$/);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  await expectAccessible(page);
});
