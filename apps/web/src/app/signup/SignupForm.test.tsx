import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseInitialError, SignupForm } from './SignupForm';

function mockFetch(status: number, body?: unknown) {
  const fn = vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function submit(email: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignupForm', () => {
  it('asks only for an email, not ABN, bank details or an organiser name', () => {
    render(<SignupForm initialError={null} />);
    expect(screen.getAllByRole('textbox').map((i) => i.getAttribute('name'))).toEqual(['email']);
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start',
    );
  });

  it('shows an inline error and focuses the field without calling the api', async () => {
    const fetch = mockFetch(202);
    render(<SignupForm initialError={null} />);
    await submit('');

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter your email address');
    expect(email).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requests a magic link with just the email and shows the check-your-email state', async () => {
    const fetch = mockFetch(202);
    render(<SignupForm initialError={null} />);
    await submit('priya@printshed.com.au');

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/magic-link',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ email: 'priya@printshed.com.au' });
    expect(init.headers).toEqual({ 'content-type': 'application/json' });

    const heading = await screen.findByRole('heading', { name: 'Check your email' });
    expect(heading).toHaveFocus();
    expect(screen.getByText('priya@printshed.com.au')).toBeInTheDocument();
  });

  it('marks the form busy while sending', async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((r) => (finish = r))));
    const { container } = render(<SignupForm initialError={null} />);
    await submit('priya@printshed.com.au');

    expect(screen.getByRole('button', { name: 'Sending link…' })).toBeDisabled();
    expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
    finish(new Response(null, { status: 202 }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('goes back to the form with the email kept', async () => {
    mockFetch(202);
    render(<SignupForm initialError={null} />);
    const user = await submit('priya@printshed.com.au');
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(screen.getByLabelText('Email')).toHaveValue('priya@printshed.com.au');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('shows an api validation error on the field', async () => {
    mockFetch(422, {
      statusCode: 422,
      code: 'invalid_request',
      field: 'email',
      message: "We can't send email to that address",
    });
    render(<SignupForm initialError={null} />);
    await submit('priya@printshed.com.au');

    expect(await screen.findByText("We can't send email to that address")).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains rate limiting', async () => {
    mockFetch(429, { statusCode: 429, code: 'rate_limited', message: 'Slow down' });
    render(<SignupForm initialError={null} />);
    await submit('priya@printshed.com.au');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait a minute');
  });

  it('explains a failed Google sign-in', () => {
    render(<SignupForm initialError="google" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Google sign-in didn't finish");
  });

  it('links sign-up and sign-in to each other', () => {
    const { unmount } = render(<SignupForm initialError={null} />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    unmount();
    render(<SignupForm mode="signin" initialError={null} />);
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });

  it('only accepts known error codes from the URL', () => {
    expect(parseInitialError('google_unavailable')).toBe('google_unavailable');
    expect(parseInitialError('<script>')).toBeNull();
    expect(parseInitialError(undefined)).toBeNull();
  });
});
