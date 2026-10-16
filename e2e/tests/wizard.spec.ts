import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';

// S1-1 create-event wizard against the real api and Postgres, at 375 and 1280 px (QA Sprint 1
// rows 1.1 to 1.14). The CSP guard in fixtures.ts fails any test that trips the policy.

const nextYear = new Date().getFullYear() + 1;
const eventDate = `${nextYear}-11-14`;
const status = (page: import('@playwright/test').Page) =>
  page.getByRole('banner').getByRole('status');

test('a template becomes a draft that autosaves, resumes and publishes', async ({ page }) => {
  await signUpOrganiser(page);

  // Template to draft.
  await page.getByRole('link', { name: /Workshop/ }).click();
  await page.waitForURL(/\/organiser\/events\/new\/basics\?draft=/);
  const draftUrl = new URL(page.url());
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("What's on?");
  await expect(page.locator('ol[aria-label="Steps"] [aria-current="step"]')).toHaveText('1 Basics');
  await expect(page.getByLabel('Event name')).toHaveAttribute('placeholder', /For example/);
  await expectAccessible(page);

  // Basics autosave on blur.
  await page.getByLabel('Event name').fill('Screen printing for beginners');
  await page.getByLabel('Date').fill(eventDate);
  await page.getByLabel('Starts').fill('10:00');
  await page.getByLabel('Ends').fill('13:00');
  await page.getByRole('combobox', { name: 'Venue address' }).fill('Marrickville');
  await page.getByRole('option', { name: /Marrickville Town Hall/ }).click();
  await page.getByLabel('Event name').focus();
  await page.getByLabel('Date').focus();
  await expect(status(page)).toHaveText('Draft saved');
  await expectAccessible(page);

  // Reload resumes with what was saved.
  await page.reload();
  await expect(page.getByLabel('Event name')).toHaveValue('Screen printing for beginners');
  await expect(page.getByRole('combobox', { name: 'Venue address' })).toHaveValue(
    'Marrickville Town Hall, Marrickville',
  );

  // Offline edits are kept on the device and sync when the connection returns.
  await page.context().setOffline(true);
  await page.getByLabel('Event name').fill('Screen printing for total beginners');
  await page.getByLabel('Date').focus();
  await expect(status(page)).toHaveText('Saved on this phone');
  await page.context().setOffline(false);
  await expect(status(page)).toHaveText('Draft saved');

  // Steps switch without a page load; each heading takes focus.
  await page.getByRole('link', { name: 'Next: tickets' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expectAccessible(page);
  await page.getByRole('link', { name: 'Next: details' }).click();
  await page.getByRole('link', { name: 'Next: review' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check and publish');
  await expectAccessible(page);

  // Closing keeps the draft, and the organiser home links back to the last step.
  await page.goto('/organiser?view=drafts');
  const card = page
    .getByRole('listitem')
    .filter({ hasText: 'Screen printing for total beginners' });
  await expect(card.getByText('Draft')).toBeVisible();
  await card.getByRole('link', { name: /Finish setting up/ }).click();
  await expect(page).toHaveURL(new RegExp(`/review\\?draft=${draftUrl.searchParams.get('draft')}`));
  await expectAccessible(page);

  // Publish goes live.
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page.getByRole('heading', { name: 'Your event is live' })).toBeFocused();
  await expectAccessible(page);

  await page.goto('/organiser');
  await expect(page.getByRole('link', { name: /Upcoming/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Screen printing for total beginners' }),
  ).toContainText('0 of 40 booked');
});

test('publishing with something missing says what and moves focus to the checklist', async ({
  page,
}) => {
  await signUpOrganiser(page);
  await page.getByRole('link', { name: 'Start from a blank event' }).click();
  await page.waitForURL(/\/basics\?draft=/);
  const draft = new URL(page.url()).searchParams.get('draft')!;

  await page.goto(`/organiser/events/new/review?draft=${draft}`);
  await page.getByRole('button', { name: 'Publish event' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'to publish.' });
  await expect(alert).toContainText('Everything else is ready.');
  await expect(page.getByRole('list', { name: 'Needed to publish' })).toBeFocused();
  await expectAccessible(page);
});

test('an end time equal to the start is an error, not a 24-hour event', async ({ page }) => {
  await signUpOrganiser(page);
  await page.getByRole('link', { name: /Meetup/ }).click();
  await page.waitForURL(/\/basics\?draft=/);
  await page.getByLabel('Date').fill(eventDate);
  await page.getByLabel('Starts').fill('18:00');
  await page.getByLabel('Ends').fill('18:00');
  await page.getByLabel('Event name').focus();
  await expect(page.getByLabel('Ends')).toHaveAccessibleDescription(
    'End time needs to be after the start',
  );
  await expectAccessible(page);
});
