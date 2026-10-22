import type {
  CreateFreeOrderBody,
  HoldDto,
  OrderDto,
  PublicOrderDto,
  ReserveHoldBody,
} from '@onetickets/shared';

export interface CheckoutValidationErrors {
  name?: string;
  email?: string;
}

/**
 * Validates checkout inputs according to S0 and S2 design copy.
 * Returns empty object if valid.
 */
export function validateCheckoutForm(values: {
  name: string;
  email: string;
}): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};
  const trimmedName = values.name.trim();
  const trimmedEmail = values.email.trim();

  if (!trimmedName) {
    errors.name = 'Enter the name for the ticket';
  }

  if (!trimmedEmail) {
    errors.email = 'Enter your email address';
  } else if (!trimmedEmail.includes('@')) {
    errors.email = 'Add an @, like jordan@example.com';
  } else {
    const parts = trimmedEmail.split('@');
    const domain = parts[1] ?? '';
    if (!domain.includes('.') || domain.endsWith('.')) {
      errors.email = 'Add the part after the @, like gmail.com';
    }
  }

  return errors;
}

/**
 * Copy for the hold notice (role="status", indigo tint).
 */
export function holdNoticeText(ticketCount: number): string {
  const noun = ticketCount === 1 ? '1 ticket' : `${ticketCount} tickets`;
  return `We're holding ${noun} for you while you finish. Take your time.`;
}

/**
 * Primary CTA button label according to quantity and booking state.
 */
export function checkoutButtonLabel(quantity: number, isBooking: boolean): string {
  if (isBooking) {
    return quantity === 1 ? 'Booking your ticket…' : 'Booking your tickets…';
  }
  if (quantity === 0) {
    return 'Choose at least 1 ticket';
  }
  return quantity === 1 ? 'Get 1 free ticket' : `Get ${quantity} free tickets`;
}

/**
 * Client-side API call to reserve or adjust a hold on a ticket type.
 */
export async function reserveHold(
  body: ReserveHoldBody,
): Promise<
  { ok: true; hold: HoldDto } | { ok: false; status: number; code?: string; spotsLeft?: number }
> {
  try {
    const res = await fetch('/api/public/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, code: err.code, spotsLeft: err.spotsLeft };
    }
    const hold = (await res.json()) as HoldDto;
    return { ok: true, hold };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Renews an active hold while the user is active on the page.
 */
export async function renewHold(holdId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/public/holds/${encodeURIComponent(holdId)}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Releases a hold when navigating away or unselecting all tickets.
 */
export async function releaseHold(holdId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/public/holds/${encodeURIComponent(holdId)}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Submits the free order with the client idempotency key (INV-5).
 */
export async function submitFreeOrder(
  body: CreateFreeOrderBody,
): Promise<
  { ok: true; order: OrderDto } | { ok: false; status: number; code?: string; spotsLeft?: number }
> {
  try {
    const res = await fetch('/api/public/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, code: err.code, spotsLeft: err.spotsLeft };
    }
    const order = (await res.json()) as OrderDto;
    return { ok: true, order };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Looks up public order details for the confirmation screen.
 */
export async function getPublicOrder(orderRef: string): Promise<PublicOrderDto | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/public/orders/${encodeURIComponent(orderRef)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicOrderDto;
  } catch {
    return null;
  }
}
