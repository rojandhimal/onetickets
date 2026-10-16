import { expect, type Page } from '@playwright/test';

/**
 * Picks Marrickville Town Hall in the wizard's venue box and waits until the draft has saved it.
 * Choosing a suggestion first looks the place up, and only then autosaves it. Until that save
 * lands the draft has no venue, even though the header can still read "Draft saved" from the
 * previous save. A test that leaves the page in that window publishes a draft without a venue.
 */
export async function pickMarrickville(page: Page) {
  const venueSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/organisations\/[^/]+\/events\/[^/]+$/.test(new URL(response.url()).pathname) &&
      (response.request().postData() ?? '').includes('"venue"'),
  );
  const combobox = page.getByRole('combobox', { name: 'Venue address' });
  await combobox.fill('Marrickville');
  await page.getByRole('option', { name: /Marrickville Town Hall/ }).click();
  await expect(combobox).toHaveValue('Marrickville Town Hall, Marrickville');
  expect((await venueSaved).ok(), 'the venue autosave succeeded').toBe(true);
}
