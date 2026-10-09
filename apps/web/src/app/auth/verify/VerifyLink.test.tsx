import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readToken, VerifyLink } from './VerifyLink';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  replace.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('readToken', () => {
  it('reads the token from the fragment', () => {
    expect(readToken('#token=abc123')).toBe('abc123');
    expect(readToken('')).toBeNull();
    expect(readToken('#token=')).toBeNull();
  });
});

describe('VerifyLink', () => {
  it('exchanges the token once and goes to the organiser home', async () => {
    window.history.replaceState(null, '', '/auth/verify#token=abc123');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ user: {}, organisation: {} }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetch);

    render(<VerifyLink />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/organiser'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      token: 'abc123',
    });
    expect(window.location.hash).toBe('');
  });

  it('offers a new link when the token has expired', async () => {
    window.history.replaceState(null, '', '/auth/verify#token=old');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 410 })));

    render(<VerifyLink />);
    expect(
      await screen.findByRole('heading', { name: 'This link has expired' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute(
      'href',
      '/signin',
    );
  });
});
