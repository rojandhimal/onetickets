import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicEventDto } from '@onetickets/shared';
import { publicEvent } from '@/test/event-fixture';
import { Checkout } from './Checkout';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('Checkout component (S2-2)', () => {
  let event: PublicEventDto;

  beforeEach(() => {
    vi.clearAllMocks();
    event = publicEvent({
      name: 'Pottery Workshop',
      slug: 'pottery-workshop',
      organiser: { name: 'Clay Studio' },
      ticketTypes: [
        {
          id: 'tt_1',
          name: 'General Admission',
          allInPriceCents: 0,
          spotsLeft: 5,
          onSale: true,
          maxPerOrder: 4,
          soldOut: false,
        },
        {
          id: 'tt_2',
          name: 'Early Bird',
          allInPriceCents: 0,
          spotsLeft: 0,
          onSale: true,
          maxPerOrder: 2,
          soldOut: true,
        },
      ],
    });

    // Mock fetch for API calls
    global.fetch = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/public/holds')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'hold_123',
              ticketTypeId: 'tt_1',
              eventId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
              quantity: 1,
              token: 'test-token',
              expiresAt: new Date(Date.now() + 600000).toISOString(),
              createdAt: new Date().toISOString(),
            }),
        } as Response);
      }
      if (url.includes('/api/public/orders')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orderId: 'ord_123',
              ticketKey: 'k_abc123',
              email: 'alex@example.test',
              event: {
                slug: event.slug,
                name: event.name,
                startsAt: event.startsAt,
                endsAt: event.endsAt,
                timeZone: event.timeZone,
                venue: event.venue,
                organiser: event.organiser,
              },
              tickets: [],
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders heading, hold notice, ticket steppers, details inputs, and CTA (Row 2.1)', () => {
    render(<Checkout event={event} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Get your tickets' })).toBeInTheDocument();
    expect(screen.getByText('← Pottery Workshop')).toHaveAttribute('href', '/e/pottery-workshop');

    // Hold notice
    const holdNotice = screen.getByRole('status');
    expect(holdNotice).toHaveTextContent(
      "We're holding 1 ticket for you while you finish. Take your time.",
    );

    // Ticket rows
    expect(screen.getByText('General Admission')).toBeInTheDocument();
    expect(screen.getByText('Free · up to 4 per order')).toBeInTheDocument();

    // Sold out row
    expect(screen.getByText('Early Bird')).toBeInTheDocument();
    expect(screen.getByText('Free · all taken')).toBeInTheDocument();
    expect(screen.getByText('Sold out')).toBeInTheDocument();

    // Details inputs
    expect(
      screen.getByRole('heading', { level: 2, name: "Who's the ticket for?" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Both fields are required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(
      screen.getByText("We'll email your tickets here. No account or password needed."),
    ).toBeInTheDocument();

    // Opt-in
    const optIn = screen.getByRole('checkbox', {
      name: 'Send me news about future events from Clay Studio (optional)',
    });
    expect(optIn).toBeInTheDocument();
    expect(optIn).not.toBeChecked();

    // Primary CTA
    expect(screen.getByRole('button', { name: 'Get 1 free ticket' })).toBeInTheDocument();
  });

  it('preselects 1 for first available ticket type and updates stepper count on click (Row 2.2)', async () => {
    const user = userEvent.setup();
    render(<Checkout event={event} />);

    // Count is initially 1
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get 1 free ticket' })).toBeInTheDocument();

    // Increment to 2
    const plusBtn = screen.getByRole('button', { name: 'Increase quantity for General Admission' });
    await user.click(plusBtn);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get 2 free tickets' })).toBeInTheDocument();

    // Decrement twice to 0
    const minusBtn = screen.getByRole('button', {
      name: 'Decrease quantity for General Admission',
    });
    await user.click(minusBtn);
    await user.click(minusBtn);

    expect(screen.getByText('0')).toBeInTheDocument();
    const zeroBtn = screen.getByRole('button', { name: 'Choose at least 1 ticket' });
    expect(zeroBtn).toBeDisabled();
  });

  it('validates required fields with inline errors and focuses first invalid field (Row 2.7)', async () => {
    const user = userEvent.setup();
    render(<Checkout event={event} />);

    const submitBtn = screen.getByRole('button', { name: 'Get 1 free ticket' });
    await user.click(submitBtn);

    // Name empty error
    expect(screen.getByText('Enter the name for the ticket')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();

    // Type name
    await user.type(screen.getByLabelText('Name'), 'Morgan Lee');
    await user.click(submitBtn);

    // Email empty error
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveFocus();

    // Type email without @
    await user.type(screen.getByLabelText('Email address'), 'morganexample.com');
    await user.click(submitBtn);
    expect(screen.getByText('Add an @, like jordan@example.com')).toBeInTheDocument();

    // Type email with @ but missing domain dot
    await user.clear(screen.getByLabelText('Email address'));
    await user.type(screen.getByLabelText('Email address'), 'morgan@example');
    await user.click(submitBtn);
    expect(screen.getByText('Add the part after the @, like gmail.com')).toBeInTheDocument();
  });

  it('submits order and redirects to /tickets/:orderRef (Row 2.8)', async () => {
    const user = userEvent.setup();
    render(<Checkout event={event} />);

    await user.type(screen.getByLabelText('Name'), 'Alex Example');
    await user.type(screen.getByLabelText('Email address'), 'alex@example.test');

    const submitBtn = screen.getByRole('button', { name: 'Get 1 free ticket' });
    await user.click(submitBtn);

    expect(mockPush).toHaveBeenCalledWith('/tickets/ord_123#key=k_abc123');
  });

  it('handles ran-out at submit: displays error alert and updates steppers (Row 2.5)', async () => {
    const user = userEvent.setup();

    // Mock API returning 409 insufficient_spots
    vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/public/holds')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'h_1', ticketTypeId: 'tt_1', token: 'tok_1' }),
        } as Response);
      }
      if (urlStr.includes('/api/public/orders')) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({
              code: 'insufficient_spots',
              spotsLeft: 1,
            }),
        } as Response);
      }
      return Promise.reject(new Error(urlStr));
    });

    render(<Checkout event={event} />);

    // Select 2 tickets
    await user.click(
      screen.getByRole('button', { name: 'Increase quantity for General Admission' }),
    );
    expect(screen.getByRole('button', { name: 'Get 2 free tickets' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Alex Example');
    await user.type(screen.getByLabelText('Email address'), 'alex@example.test');

    await user.click(screen.getByRole('button', { name: 'Get 2 free tickets' }));

    // Alert should appear
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Only 1 General Admission ticket was left.');
    expect(alert).toHaveTextContent("We've changed your order to 1. Check it and try again.");
  });
});
