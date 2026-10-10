import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';

test('api reports the database as up', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
});

test('home page loads and is accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessible(page);
});
