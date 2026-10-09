import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESEND_AFTER_SECONDS, SentPanel } from './SentPanel';

const email = 'priya@printshed.com.au';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe('SentPanel', () => {
  it('focuses the heading and names the address', () => {
    render(<SentPanel email={email} onUseDifferentEmail={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Check your email' })).toHaveFocus();
    expect(screen.getByText(email)).toBeInTheDocument();
  });

  it('counts down before allowing a resend, then resends', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SentPanel email={email} onUseDifferentEmail={() => {}} />);

    const resend = screen.getByRole('button', {
      name: `You can resend in ${RESEND_AFTER_SECONDS}s`,
    });
    expect(resend).toBeDisabled();
    tick(5);
    expect(resend).toHaveTextContent(`You can resend in ${RESEND_AFTER_SECONDS - 5}s`);
    tick(RESEND_AFTER_SECONDS - 5);
    expect(resend).toBeEnabled();
    expect(resend).toHaveTextContent("Didn't get it? Send it again");

    await user.click(resend);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({ email });
    expect(
      await screen.findByText("Sent again. Check your spam folder if it's not there."),
    ).toBeInTheDocument();
    expect(resend).toBeDisabled();
  });

  it('explains a failed resend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SentPanel email={email} onUseDifferentEmail={() => {}} />);
    tick(RESEND_AFTER_SECONDS);
    await user.click(screen.getByRole('button', { name: "Didn't get it? Send it again" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait a minute');
  });
});
