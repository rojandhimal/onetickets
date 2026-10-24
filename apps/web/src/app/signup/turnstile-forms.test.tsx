import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useImperativeHandle, type Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TurnstileHandle } from '@/components/Turnstile';

// The forms with Turnstile on (SEC-10). The widget is stood in for; it has its own tests.
const getToken = vi.fn<() => Promise<string | null>>();
vi.mock('@/components/Turnstile', () => ({
  Turnstile: ({ ref, action }: { ref?: Ref<TurnstileHandle>; action: string }) => {
    useImperativeHandle(ref, () => ({ getToken }));
    return <div data-testid={`turnstile-${action}`} />;
  },
}));

const { SignupForm } = await import('./SignupForm');
const { RESEND_AFTER_SECONDS, SentPanel } = await import('./SentPanel');

const SITE_KEY = '1x00000000000000000000AA';
const email = 'mei@example.test';

function mockFetch(status: number, body?: object) {
  const fn = vi.fn(async () => new Response(body ? JSON.stringify(body) : null, { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const sentBody = (fetch: ReturnType<typeof mockFetch>) =>
  JSON.parse(((fetch.mock.calls[0] as unknown[])[1] as RequestInit).body as string);

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  getToken.mockReset();
});

describe('sign-in form with Turnstile', () => {
  it('has no widget when Turnstile is off', () => {
    render(<SignupForm mode="signin" initialError={null} />);
    expect(screen.queryByTestId('turnstile-signin')).toBeNull();
  });

  it('sends the token with the email', async () => {
    getToken.mockResolvedValue('XXXX.DUMMY.TOKEN.XXXX');
    const fetch = mockFetch(202);
    render(<SignupForm mode="signin" initialError={null} turnstileSiteKey={SITE_KEY} />);
    expect(screen.getByTestId('turnstile-signin')).toBeInTheDocument();
    await submit();
    expect(sentBody(fetch)).toEqual({ email, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it("asks them to try again, without calling the api, when the check doesn't finish", async () => {
    getToken.mockResolvedValue(null);
    const fetch = mockFetch(202);
    render(<SignupForm initialError={null} turnstileSiteKey={SITE_KEY} />);
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't finish the security check. Try again.",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeEnabled();
  });

  it('says so when the api rejects the check', async () => {
    getToken.mockResolvedValue('forged');
    mockFetch(403, { statusCode: 403, code: 'challenge_failed', message: '' });
    render(<SignupForm initialError={null} turnstileSiteKey={SITE_KEY} />);
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't finish the security check. Try again.",
    );
  });

  it("asks them to wait when the api can't reach Cloudflare", async () => {
    getToken.mockResolvedValue('XXXX.DUMMY.TOKEN.XXXX');
    mockFetch(503, { statusCode: 503, code: 'challenge_unavailable', message: '' });
    render(<SignupForm initialError={null} turnstileSiteKey={SITE_KEY} />);
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We can't send sign-in links for a moment. Try again in a minute.",
    );
    expect(screen.queryByRole('heading', { name: 'Check your email' })).toBeNull();
  });
});

describe('resend with Turnstile', () => {
  async function waitAndResend() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <SentPanel email={email} onUseDifferentEmail={() => {}} turnstileSiteKey={SITE_KEY} />,
      );
      for (let i = 0; i < RESEND_AFTER_SECONDS; i++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: "Didn't get it? Send it again" }));
    } finally {
      vi.useRealTimers();
    }
  }

  it('gets a fresh token for the resend', async () => {
    getToken.mockResolvedValue('token-2');
    const fetch = mockFetch(202);
    await waitAndResend();
    expect(screen.getByTestId('turnstile-resend')).toBeInTheDocument();
    expect(sentBody(fetch)).toEqual({ email, turnstileToken: 'token-2' });
    expect(await screen.findByText(/Sent again/)).toBeInTheDocument();
  });

  it('lets them try again straight away when the check fails', async () => {
    getToken.mockResolvedValue(null);
    const fetch = mockFetch(202);
    await waitAndResend();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't finish the security check. Try again.",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: "Didn't get it? Send it again" })).toBeEnabled();
  });
});
