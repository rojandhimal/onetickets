import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftEvent, readyEvent } from '@/test/event-fixture';
import { Wizard } from './Wizard';

let pathname = '/organiser/events/new/basics';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

function api(routes: Record<string, Handler>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const patches = (fetch: ReturnType<typeof api>) =>
  fetch.mock.calls
    .filter((c) => c[1]?.method === 'PATCH')
    .map((c) => JSON.parse(c[1]?.body as string));

beforeEach(() => {
  pathname = '/organiser/events/new/basics';
  push.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('create-event wizard', () => {
  it('autosaves the basics on blur and previews them', async () => {
    const fetch = api({
      'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("What's on?");
    expect(screen.getByText(/Using the Workshop template/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('1 Basics');

    await user.type(screen.getByLabelText('Event name'), 'Screen printing');
    await user.type(screen.getByLabelText('Date'), '2026-11-14');
    await user.type(screen.getByLabelText('Starts'), '10:00');
    await user.type(screen.getByLabelText('Ends'), '13:00');
    await user.tab();

    await waitFor(() => expect(patches(fetch).length).toBeGreaterThan(0));
    const sent = Object.assign({}, ...patches(fetch));
    expect(sent).toMatchObject({
      name: 'Screen printing',
      startsAt: '2026-11-14T10:00:00+11:00',
      endsAt: '2026-11-14T13:00:00+11:00',
    });
    expect(await screen.findByText('Draft saved')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Sat 14 Nov · 10:00 am')).toBeInTheDocument();
  });

  it('treats an end time before the start as the next day', async () => {
    const fetch = api({
      'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} />);
    await user.type(screen.getByLabelText('Date'), '2026-11-14');
    await user.type(screen.getByLabelText('Starts'), '21:00');
    await user.type(screen.getByLabelText('Ends'), '01:00');
    expect(screen.getByLabelText('Ends')).toHaveAccessibleDescription('Ends the next day');
    await user.tab();
    await waitFor(() =>
      expect(Object.assign({}, ...patches(fetch))).toMatchObject({
        endsAt: '2026-11-15T01:00:00+11:00',
      }),
    );
  });

  it('picks a venue from the address suggestions with the keyboard', async () => {
    const fetch = api({
      'GET /api/places/search': () =>
        json({
          items: [
            { placeId: 'pl_1', name: 'The Print Shed', address: '12 Sydenham Rd, Marrickville' },
            { placeId: 'pl_2', name: 'Sydenham Rd', address: 'Marrickville NSW 2204' },
          ],
        }),
      'GET /api/places/pl_2': () =>
        json({ ...readyEvent().venue, placeId: 'pl_2', name: 'Sydenham Rd' }),
      'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} />);

    const input = screen.getByRole('combobox', { name: 'Venue address' });
    await user.type(input, 'Sydenham');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);

    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(input).toHaveValue('Sydenham Rd, Marrickville'));
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() =>
      expect(patches(fetch).at(-1)).toMatchObject({ venue: { kind: 'place', placeId: 'pl_2' } }),
    );
  });

  it('asks for an https link for online events', async () => {
    api({ 'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })) });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Online' }));
    expect(screen.getByRole('button', { name: 'Online' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Link for attendees'), 'zoom.us/j/1');
    await user.tab();
    expect(screen.getByLabelText('Link for attendees')).toHaveAccessibleDescription(
      expect.stringContaining('Enter a link that starts with https://'),
    );
  });

  it('moves between steps without leaving the page', async () => {
    api({});
    const pushState = vi.spyOn(window.history, 'pushState');
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} />);
    await user.click(screen.getByRole('link', { name: /Next: tickets/ }));
    expect(pushState).toHaveBeenCalledWith(null, '', '/organiser/events/new/tickets?draft=evt_1');
    pushState.mockRestore();
  });

  it('closes from the first step and keeps the draft', async () => {
    api({});
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} />);
    await user.click(screen.getByRole('link', { name: 'Close and keep draft' }));
    expect(push).toHaveBeenCalledWith('/organiser');
  });

  describe('review and publish', () => {
    beforeEach(() => {
      pathname = '/organiser/events/new/review';
    });

    it('explains what is missing instead of publishing', async () => {
      const fetch = api({});
      const user = userEvent.setup();
      render(<Wizard initialEvent={readyEvent({ venue: null })} />);

      expect(screen.getByRole('link', { name: 'Back to details' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /3 Details/ })).not.toHaveTextContent('completed');
      expect(screen.getByRole('link', { name: '1 Basics' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Publish event' }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Add a venue to publish. Everything else is ready.',
      );
      expect(screen.getByRole('list', { name: 'Needed to publish' })).toHaveFocus();
      expect(screen.getByText('Not added yet')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Add venue' })).toHaveAttribute(
        'href',
        '/organiser/events/new/basics?draft=evt_1',
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('publishes and shows the live screen', async () => {
      api({
        'POST /api/organisations/org_1/events/evt_1/publish': () =>
          json(readyEvent({ status: 'published', slug: 'screen-printing' })),
      });
      const user = userEvent.setup();
      render(<Wizard initialEvent={readyEvent()} />);

      expect(screen.getByRole('link', { name: '1 Basics, completed' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Publish event' }));

      const heading = await screen.findByRole('heading', { name: 'Your event is live' });
      expect(heading).toHaveFocus();
      expect(screen.getByText(/\/e\/screen-printing$/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'See your event page' })).toHaveAttribute(
        'href',
        '/e/screen-printing',
      );
      // jsdom has no Web Share API, so the share button stays hidden.
      expect(screen.queryByRole('button', { name: /Share/ })).not.toBeInTheDocument();
    });

    it('shows what the api says is missing', async () => {
      api({
        'POST /api/organisations/org_1/events/evt_1/publish': () =>
          json({ statusCode: 422, code: 'not_ready', message: 'x', missing: ['ticket_type'] }, 422),
      });
      const user = userEvent.setup();
      render(<Wizard initialEvent={readyEvent()} />);
      await user.click(screen.getByRole('button', { name: 'Publish event' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Add a ticket type to publish. Everything else is ready.',
      );
    });
  });
});
