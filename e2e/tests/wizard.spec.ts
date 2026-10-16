import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { signUpOrganiser } from './session';
import { pickMarrickville } from './venue';

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
  await pickMarrickville(page);
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

test('free ticket types step steps capacity, adds and removes types, and validates inline', async ({
  page,
}) => {
  await signUpOrganiser(page);
  await page.getByRole('link', { name: /Workshop/ }).click();
  await page.waitForURL(/\/organiser\/events\/new\/basics\?draft=/);
  await page.getByLabel('Event name').fill('Pottery wheel taster');
  await page.getByLabel('Date').fill(eventDate);
  await page.getByLabel('Starts').fill('10:00');
  await page.getByLabel('Ends').fill('13:00');
  await page.getByLabel('Event name').focus();
  await expect(status(page)).toHaveText('Draft saved');

  await page.getByRole('link', { name: 'Next: tickets' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tickets');
  await expect(page.getByText('Free ticket. No fees for you or your guests.')).toBeVisible();
  await expect(page.getByLabel('How many tickets?')).toHaveValue('40');
  await expectAccessible(page);

  // Stepper ±5 updates capacity and persists to the API.
  await page.getByRole('button', { name: '5 more tickets' }).click();
  await expect(page.getByLabel('How many tickets?')).toHaveValue('45');
  await expect(status(page)).toHaveText('Draft saved');

  // Inline validation for capacity < 1, max per order > capacity, and sales end <= sales start.
  await page.getByLabel('How many tickets?').fill('0');
  await page.getByLabel('Ticket name').focus();
  await expect(page.getByLabel('How many tickets?')).toHaveAccessibleDescription(
    /Set at least 1 ticket/,
  );

  await page.getByLabel('How many tickets?').fill('10');
  await page.getByLabel('Max per order').fill('15');
  await page.getByLabel('Ticket name').focus();
  await expect(page.getByLabel('Max per order')).toHaveAccessibleDescription(
    "Can't be more than 10, the number of tickets",
  );

  await page.getByLabel('Max per order').fill('5');
  await page.getByLabel('Sales start', { exact: true }).selectOption('at');
  await page.getByLabel('Sales start date').fill(eventDate);
  await page.getByLabel('Sales start time').fill('12:00');
  await page.getByLabel('Sales end', { exact: true }).selectOption('at');
  await page.getByLabel('Sales end date').fill(eventDate);
  await page.getByLabel('Sales end time').fill('11:00');
  await page.getByLabel('Ticket name').focus();
  await expect(page.getByLabel('Sales end', { exact: true })).toHaveAccessibleDescription(
    'Sales need to end after they start',
  );
  await expectAccessible(page);

  // Restore valid sales window and save.
  await page.getByLabel('Sales start', { exact: true }).selectOption('on_publish');
  await page.getByLabel('Sales end', { exact: true }).selectOption('event_start');
  await expect(status(page)).toHaveText('Draft saved');

  // Add a second ticket type; the first collapses to a summary row.
  await page.getByRole('button', { name: 'Add another ticket type' }).click();
  const list = page.getByRole('list', { name: 'Ticket types' });
  await expect(list).toContainText('General admission');
  await expect(list).toContainText('Free · 10 tickets · up to 5 per order');

  await page.getByLabel('Ticket name').fill('Members');
  await page.getByLabel('How many tickets?').fill('8');
  await page.getByLabel('Max per order').fill('2');
  await page.getByLabel('Ticket name').focus();
  await expect(status(page)).toHaveText('Draft saved');
  await expectAccessible(page);

  // Switch active editor to General admission and remove Members from the draft.
  await list.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Ticket name')).toHaveValue('General admission');
  await expect(list).toContainText('Free · 8 tickets · up to 2 per order');
  await page.getByRole('button', { name: 'Remove Members ticket' }).click();
  await expect(status(page)).toHaveText('Draft saved');
  await expect(page.getByRole('list', { name: 'Ticket types' })).toHaveCount(0);
});
