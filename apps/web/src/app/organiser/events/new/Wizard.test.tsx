import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STARTER_ABOUT } from '@/lib/templates';
import { draftEvent, readyEvent } from '@/test/event-fixture';
import { CONTACT_EMAIL_ERROR } from './DetailsStep';
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
      // Only the step change is saved; nothing tries to publish.
      expect(fetch.mock.calls.filter((c) => String(c[0]).endsWith('/publish'))).toEqual([]);
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
    expect(
      screen.getByText("Couldn't save one field. Check the message under it."),
    ).toHaveAttribute('role', 'status');

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
      expect(input).toHaveAccessibleDescription(expect.stringContaining('Use a JPG or PNG image.'));
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('free ticket types (S1-2)', () => {
    beforeEach(() => {
      pathname = '/organiser/events/new/tickets';
    });

    it('steps capacity by ±5, edits sales windows, and saves with the updated version', async () => {
      const updated = (capacity: number, salesEnd: unknown = { kind: 'event_start' }) =>
        draftEvent({
          lastStep: 'tickets',
          version: 2,
          ticketTypes: [
            {
              id: 'tt_1',
              name: 'General admission',
              capacity,
              maxPerOrder: 10,
              priceCents: 0,
              salesStart: { kind: 'on_publish' },
              salesEnd: salesEnd as never,
              sold: 0,
            },
          ],
        });
      const fetch = api({
        'PATCH /api/organisations/org_1/events/evt_1/ticket-types/tt_1': (init) => {
          const body = JSON.parse(init?.body as string);
          return json(updated(body.capacity, body.salesEnd));
        },
      });
      const user = userEvent.setup();
      render(<Wizard initialEvent={draftEvent({ lastStep: 'tickets' })} userId="u_1" />);

      expect(screen.getByText('Free ticket. No fees for you or your guests.')).toBeInTheDocument();
      expect(screen.getByLabelText('Ticket name')).toHaveValue('General admission');
      expect(screen.getByLabelText('How many tickets?')).toHaveValue(40);
      expect(screen.getByLabelText('Max per order')).toHaveValue(10);

      await user.click(screen.getByRole('button', { name: '5 more tickets' }));
      expect(screen.getByLabelText('How many tickets?')).toHaveValue(45);
      await waitFor(() =>
        expect(patches(fetch).at(-1)).toMatchObject({
          name: 'General admission',
          capacity: 45,
          maxPerOrder: 10,
          priceCents: 0,
        }),
      );

      await user.click(screen.getByRole('button', { name: '5 fewer tickets' }));
      expect(screen.getByLabelText('How many tickets?')).toHaveValue(40);

      // Picking "Pick a date and time" reveals date and time inputs under that select.
      await user.selectOptions(screen.getByLabelText('Sales end'), 'at');
      await user.type(screen.getByLabelText('Sales end date'), '2026-11-14');
      await user.clear(screen.getByLabelText('Sales end time'));
      await user.type(screen.getByLabelText('Sales end time'), '09:30');
      await user.tab();

      await waitFor(() =>
        expect(patches(fetch).at(-1)).toMatchObject({
          salesEnd: { kind: 'at', at: '2026-11-14T09:30:00+11:00' },
        }),
      );
    });

    it('adds a second ticket type, collapses others to summary rows, switches and removes from a draft', async () => {
      const twoTypes = draftEvent({
        lastStep: 'tickets',
        version: 2,
        ticketTypes: [
          {
            id: 'tt_1',
            name: 'General admission',
            capacity: 40,
            maxPerOrder: 10,
            priceCents: 0,
            salesStart: { kind: 'on_publish' },
            salesEnd: { kind: 'event_start' },
            sold: 0,
          },
          {
            id: 'tt_2',
            name: 'Members',
            capacity: 10,
            maxPerOrder: 2,
            priceCents: 0,
            salesStart: { kind: 'on_publish' },
            salesEnd: { kind: 'event_start' },
            sold: 0,
          },
        ],
      });
      const fetch = api({
        'POST /api/organisations/org_1/events/evt_1/ticket-types': () => json(twoTypes, 201),
        'DELETE /api/organisations/org_1/events/evt_1/ticket-types/tt_2': () =>
          json(draftEvent({ lastStep: 'tickets', version: 3 })),
      });
      const user = userEvent.setup();
      render(<Wizard initialEvent={draftEvent({ lastStep: 'tickets' })} userId="u_1" />);

      await user.click(screen.getByRole('button', { name: 'Add another ticket type' }));
      // General admission collapses into a summary row.
      const list = screen.getByRole('list', { name: 'Ticket types' });
      expect(list).toHaveTextContent('General admission');
      expect(list).toHaveTextContent('Free · 40 tickets · up to 10 per order');

      await user.type(screen.getByLabelText('Ticket name'), 'Members');
      await user.clear(screen.getByLabelText('How many tickets?'));
      await user.type(screen.getByLabelText('How many tickets?'), '10');
      await user.clear(screen.getByLabelText('Max per order'));
      await user.type(screen.getByLabelText('Max per order'), '2');
      await user.tab();

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          '/api/organisations/org_1/events/evt_1/ticket-types',
          expect.objectContaining({ method: 'POST' }),
        ),
      );

      // Edit General admission: Members collapses to a summary row with its summary and remove button.
      await user.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Ticket name')).toHaveValue('General admission');
      expect(screen.getByRole('list', { name: 'Ticket types' })).toHaveTextContent(
        'Free · 10 tickets · up to 2 per order',
      );

      await user.click(screen.getByRole('button', { name: 'Remove Members ticket' }));
      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          '/api/organisations/org_1/events/evt_1/ticket-types/tt_2',
          expect.objectContaining({ method: 'DELETE' }),
        ),
      );
      expect(screen.queryByRole('list', { name: 'Ticket types' })).not.toBeInTheDocument();
    });

    it('validates capacity, max per order, and sales end after sales start inline', async () => {
      const fetch = api({
        'PATCH /api/organisations/org_1/events/evt_1/ticket-types/tt_1': () =>
          json(readyEvent({ lastStep: 'tickets', version: 2 })),
      });
      const user = userEvent.setup();
      render(
        <Wizard
          initialEvent={readyEvent({
            lastStep: 'tickets',
            startsAt: '2026-11-14T10:00:00+11:00',
            endsAt: '2026-11-14T13:00:00+11:00',
          })}
          userId="u_1"
        />,
      );

      const capInput = screen.getByLabelText('How many tickets?');
      await user.clear(capInput);
      await user.type(capInput, '0');
      await user.tab();
      expect(capInput).toHaveAttribute('aria-invalid', 'true');
      expect(capInput).toHaveAccessibleDescription(
        expect.stringContaining('Set at least 1 ticket'),
      );
      expect(fetch).not.toHaveBeenCalled();

      await user.clear(capInput);
      await user.type(capInput, '10');
      const maxInput = screen.getByLabelText('Max per order');
      await user.clear(maxInput);
      fetch.mockClear();
      await user.type(maxInput, '15');
      await user.tab();
      expect(maxInput).toHaveAttribute('aria-invalid', 'true');
      expect(maxInput).toHaveAccessibleDescription("Can't be more than 10, the number of tickets");
      expect(fetch).not.toHaveBeenCalled();

      await user.clear(maxInput);
      await user.type(maxInput, '5');
      await user.selectOptions(screen.getByLabelText('Sales start'), 'at');
      await user.type(screen.getByLabelText('Sales start date'), '2026-11-14');
      await user.clear(screen.getByLabelText('Sales start time'));
      await user.type(screen.getByLabelText('Sales start time'), '12:00');
      await user.selectOptions(screen.getByLabelText('Sales end'), 'at');
      await user.type(screen.getByLabelText('Sales end date'), '2026-11-14');
      await user.clear(screen.getByLabelText('Sales end time'));
      fetch.mockClear();
      await user.type(screen.getByLabelText('Sales end time'), '11:00');
      await user.tab();

      expect(screen.getByLabelText('Sales end')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Sales end')).toHaveAccessibleDescription(
        'Sales need to end after they start',
      );
      expect(
        screen.getByText("Couldn't save one field. Check the message under it."),
      ).toHaveAttribute('role', 'status');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('surfaces 422 sales_end_before_start and 409 tickets_sold_or_held from the API', async () => {
      const baseTicket = draftEvent().ticketTypes[0]!;
      const second = { ...baseTicket, id: 'tt_2', name: 'VIP' };
      api({
        'PATCH /api/organisations/org_1/events/evt_1/ticket-types/tt_1': () =>
          json(
            {
              code: 'sales_end_before_start',
              message: 'Sales need to end after they start',
            },
            422,
          ),
        'DELETE /api/organisations/org_1/events/evt_1/ticket-types/tt_2': () =>
          json(
            {
              code: 'tickets_sold_or_held',
              message: 'Tickets have already been claimed for this type.',
            },
            409,
          ),
      });
      const user = userEvent.setup();
      render(
        <Wizard
          initialEvent={readyEvent({
            lastStep: 'tickets',
            ticketTypes: [baseTicket, second],
          })}
          userId="u_1"
        />,
      );

      await user.click(screen.getByRole('button', { name: '5 more tickets' }));
      await waitFor(() =>
        expect(screen.getByLabelText('Sales end')).toHaveAccessibleDescription(
          'Sales need to end after they start',
        ),
      );

      await user.click(screen.getByRole('button', { name: 'Remove VIP ticket' }));
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Tickets have already been claimed for this type.',
        ),
      );
    });
  });
});

describe('details step', () => {
  beforeEach(() => {
    pathname = '/organiser/events/new/details';
  });

  const saved = () =>
    api({ 'PATCH /api/organisations/org_1/events/evt_1': () => json(draftEvent({ version: 2 })) });

  it('starts a template draft from its About text and counts characters', async () => {
    saved();
    const user = userEvent.setup();
    const about = STARTER_ABOUT.workshop;
    render(<Wizard initialEvent={draftEvent({ about })} userId="u_1" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tell people more');
    const field = screen.getByLabelText('About this event');
    expect(field).toHaveValue(about);
    expect(field).toHaveAccessibleDescription(
      `The Workshop template starts you off. Say what people will do and what to bring. ${about.length} / 2,000`,
    );

    await user.clear(field);
    await user.type(field, 'Bring an old shirt.');
    expect(field).toHaveAccessibleDescription(
      'Say what people will do and what to bring. 19 / 2,000',
    );
    expect(field).toHaveAttribute('maxlength', '2000');
  });

  it('saves accessibility features in list order with the notes', async () => {
    const fetch = saved();
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);

    const group = screen.getByRole('group', { name: 'Accessibility' });
    expect(group).toHaveAccessibleDescription(
      "Shown near the top of your event page. Tick what's true for your venue.",
    );
    await user.click(screen.getByRole('checkbox', { name: 'Quiet space' }));
    await user.click(screen.getByRole('checkbox', { name: 'Step-free access' }));
    await user.type(screen.getByLabelText('Anything else people should know?'), 'Ramp at side');
    await user.tab();

    await waitFor(() =>
      expect(patches(fetch).at(-1)).toMatchObject({
        accessibility: { features: ['step_free_access', 'quiet_space'], notes: 'Ramp at side' },
      }),
    );
    expect(screen.getByLabelText('Anything else people should know?')).toHaveAttribute(
      'maxlength',
      '500',
    );
  });

  it('saves the cancellation choice', async () => {
    const fetch = saved();
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);

    const anyTime = screen.getByRole('radio', { name: 'Any time before it starts' });
    expect(anyTime).toBeChecked();
    expect(anyTime).toHaveAccessibleDescription(
      'Recommended for free events. Released tickets go back on sale.',
    );
    await user.click(screen.getByRole('radio', { name: 'Up to 24 hours before' }));
    await waitFor(() =>
      expect(patches(fetch).at(-1)).toMatchObject({ cancellationPolicy: 'up_to_24h' }),
    );
  });

  it('saves a contact email and explains a mistyped one', async () => {
    const fetch = saved();
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);

    const email = screen.getByLabelText('Contact email for attendees');
    expect(email).toHaveAccessibleDescription('Only shown to people with a ticket.');
    await user.type(email, 'jo@example');
    await user.tab();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(
      `${CONTACT_EMAIL_ERROR} Only shown to people with a ticket.`,
    );

    await user.type(email, '.test');
    expect(email).not.toHaveAttribute('aria-invalid');
    await user.tab();
    await waitFor(() =>
      expect(patches(fetch).at(-1)).toMatchObject({ contactEmail: 'jo@example.test' }),
    );
  });

  it('shows the api message under a refused contact email', async () => {
    api({
      'PATCH /api/organisations/org_1/events/evt_1': () =>
        json(
          {
            statusCode: 422,
            code: 'invalid_request',
            message: 'Use an email address you can receive mail at',
            field: 'contactEmail',
          },
          422,
        ),
    });
    const user = userEvent.setup();
    render(<Wizard initialEvent={draftEvent()} userId="u_1" />);
    const email = screen.getByLabelText('Contact email for attendees');
    await user.type(email, 'jo@example.test');
    await user.tab();
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        'Use an email address you can receive mail at Only shown to people with a ticket.',
      ),
    );
    expect(email).toHaveValue('jo@example.test');
  });
});
