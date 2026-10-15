import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);

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
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
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
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);

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
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    await user.click(screen.getByRole('button', { name: 'Online' }));
    expect(screen.getByRole('button', { name: 'Online' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Link for attendees'), 'zoom.us/j/1');
    await user.tab();
    expect(screen.getByLabelText('Link for attendees')).toHaveAccessibleDescription(
      expect.stringContaining('Add the full link, starting with https://'),
    );
  });

  it('asks for an address from the list and a date from today on', async () => {
    api({
      'GET /api/places/search': () => json({ items: [] }),
      'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    await user.type(screen.getByRole('combobox', { name: 'Venue address' }), 'Somewhere');
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Venue address' })).toHaveAccessibleDescription(
      expect.stringContaining('Pick an address from the list so people can find it'),
    );
    await user.type(screen.getByLabelText('Date'), '2020-01-01');
    await user.tab();
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription('Pick a date from today on');
  });

  it('moves between steps without leaving the page', async () => {
    api({});
    const pushState = vi.spyOn(window.history, 'pushState');
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    await user.click(screen.getByRole('link', { name: /Next: tickets/ }));
    expect(pushState).toHaveBeenCalledWith(null, '', '/organiser/events/new/tickets?draft=evt_1');
    pushState.mockRestore();
  });

  it('closes from the first step and keeps the draft', async () => {
    api({});
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
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
      render(<Wizard initialEvent={readyEvent({ venue: null })} userId="u_1" />);

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
      render(<Wizard initialEvent={readyEvent()} userId="u_1" />);

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
      render(<Wizard initialEvent={readyEvent()} userId="u_1" />);
      await user.click(screen.getByRole('button', { name: 'Publish event' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Add a ticket type to publish. Everything else is ready.',
      );
    });
  });

  it('shows an end time equal to the start as an error, not a 24-hour event', async () => {
    const fetch = api({
      'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    await user.type(screen.getByLabelText('Date'), '2026-11-14');
    await user.type(screen.getByLabelText('Starts'), '10:00');
    await user.type(screen.getByLabelText('Ends'), '10:00');
    await user.tab();

    expect(screen.getByLabelText('Ends')).toHaveAccessibleDescription(
      'End time needs to be after the start',
    );
    await waitFor(() => expect(patches(fetch).length).toBeGreaterThan(0));
    expect(Object.assign({}, ...patches(fetch)).endsAt).toBeNull();
  });

  it('keeps a value the api refuses on screen with its message', async () => {
    api({
      'PATCH /api/organisations/org_1/events/evt_1': () =>
        json(
          {
            statusCode: 422,
            code: 'invalid_request',
            message: 'Use letters as well as symbols',
            field: 'name',
          },
          422,
        ),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    await user.type(screen.getByLabelText('Event name'), '***');
    await user.tab();

    const name = screen.getByLabelText('Event name');
    await waitFor(() => expect(name).toHaveAccessibleDescription('Use letters as well as symbols'));
    expect(name).toHaveValue('***');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Not saved: check the highlighted field')).toHaveAttribute(
      'role',
      'status',
    );

    // Typing again clears the message until the next save says otherwise.
    await user.type(name, 'x');
    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it("says it couldn't save when the api fails while online", async () => {
    api({
      'PATCH /api/organisations/org_1/events/evt_1': () => json({ statusCode: 500 }, 500),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    await user.type(screen.getByLabelText('Event name'), 'Screen printing');
    await user.tab();
    expect(await screen.findByText("Couldn't save. We'll keep trying.")).toHaveAttribute(
      'role',
      'status',
    );
  });

  describe('banner', () => {
    const withBanner = () =>
      draftEvent({
        version: 2,
        banner: {
          url: '/api/public/banners/b1.webp',
          ogUrl: '/api/public/banners/b1-og.jpg',
          width: 2160,
          height: 1080,
          focus: { x: 0.5, y: 0.5 },
        },
      });

    it('uploads a photo and offers Replace, Adjust crop and Remove', async () => {
      const fetch = api({
        'PUT /api/organisations/org_1/events/evt_1/banner': () => json(withBanner()),
        'PATCH /api/organisations/org_1/events/evt_1': () => json(withBanner()),
      });
      const user = userEvent.setup();
      render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
      const photo = new File(['jpeg'], 'gig.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/Add a banner image/), photo);

      expect(await screen.findByLabelText('Replace')).toBeInTheDocument();
      const put = fetch.mock.calls.find((c) => c[1]?.method === 'PUT');
      expect(put?.[1]?.body).toBe(photo);
      expect(new Headers(put?.[1]?.headers).get('content-type')).toBe('image/jpeg');

      await user.click(screen.getByRole('button', { name: 'Adjust crop' }));
      const slider = screen.getByLabelText('Crop position, top to bottom');
      // jsdom doesn't move range inputs with the keyboard.
      fireEvent.change(slider, { target: { value: '55' } });
      await waitFor(() =>
        expect(Object.assign({}, ...patches(fetch)).bannerFocus).toEqual({ x: 0.5, y: 0.55 }),
      );
      // The upload's version is used, so the crop doesn't come back as stale.
      expect(patches(fetch)[0].version).toBe(2);
    });

    it('refuses files over 10 MB and the wrong type before uploading', async () => {
      const fetch = api({});
      const user = userEvent.setup({ applyAccept: false });
      render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
      const input = screen.getByLabelText(/Add a banner image/);

      const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
      await user.upload(input, big);
      expect(input).toHaveAccessibleDescription(
        expect.stringContaining('That file is over 10 MB. Try a smaller photo.'),
      );

      await user.upload(input, new File(['%PDF'], 'flyer.pdf', { type: 'application/pdf' }));
      expect(input).toHaveAccessibleDescription(
        expect.stringContaining('Use a JPG, PNG or HEIC image.'),
      );
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
