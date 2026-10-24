import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clearDeviceDrafts = vi.fn(async () => undefined);
vi.mock('@/lib/draft-store', () => ({ clearDeviceDrafts: () => clearDeviceDrafts() }));

const { SignOutButton } = await import('./SignOutButton');

const assign = vi.fn();
beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockClear();
  clearDeviceDrafts.mockClear();
});

describe('SignOutButton', () => {
  it('signs out once, then loads the sign-in page', async () => {
    let answer: (r: Response) => void = () => undefined;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal('fetch', fetch);
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const busy = screen.getByRole('button', { name: 'Signing out…' });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(fetch).toHaveBeenCalledOnce();
    answer(new Response(null, { status: 204 }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/signin'));
    expect(clearDeviceDrafts).toHaveBeenCalledOnce();
  });

  it.each([
    ['offline', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500', async () => new Response(null, { status: 500 })],
  ])('stays put with an alert when %s, after clearing drafts', async (_, answer) => {
    vi.stubGlobal('fetch', vi.fn(answer));
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't sign you out. Check your connection and try again.",
    );
    expect(clearDeviceDrafts).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});
