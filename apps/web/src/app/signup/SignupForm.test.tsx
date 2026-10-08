import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignupForm } from './SignupForm';

function mockFetch(status: number, body?: unknown) {
  const fn = vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function fillAndSubmit(email: string, name: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (name) await user.type(screen.getByLabelText('Organiser name'), name);
  await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignupForm', () => {
  it('asks only for email and organiser name, not ABN or bank details', () => {
    render(<SignupForm initialError={null} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.map((i) => i.getAttribute('name'))).toEqual(['email', 'organiserName']);
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start',
    );
  });

  it('shows inline errors and focuses the first bad field without calling the api', async () => {
    const fetch = mockFetch(202);
    render(<SignupForm initialError={null} />);
    await fillAndSubmit('', 'The Print Shed');

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter your email address');
    expect(email).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requests a magic link and shows the check-your-email state', async () => {
    const fetch = mockFetch(202);
    render(<SignupForm initialError={null} />);
    await fillAndSubmit('priya@printshed.com.au', 'The Print Shed');

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/magic-link',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ email: 'priya@printshed.com.au', organiserName: 'The Print Shed' });

    const heading = await screen.findByRole('heading', { name: 'Check your email' });
    expect(heading).toHaveFocus();
    expect(screen.getByText('priya@printshed.com.au')).toBeInTheDocument();
  });

  it('goes back to the form with values kept', async () => {
    mockFetch(202);
    render(<SignupForm initialError={null} />);
    const user = await fillAndSubmit('priya@printshed.com.au', 'The Print Shed');
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(screen.getByLabelText('Email')).toHaveValue('priya@printshed.com.au');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('shows an api field error on the field', async () => {
    mockFetch(422, { field: 'email', message: "We can't send email to that address" });
    render(<SignupForm initialError={null} />);
    await fillAndSubmit('priya@printshed.com.au', 'The Print Shed');

    expect(await screen.findByText("We can't send email to that address")).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains rate limiting', async () => {
    mockFetch(429);
    render(<SignupForm initialError={null} />);
    await fillAndSubmit('priya@printshed.com.au', 'The Print Shed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait a minute');
  });

  it('explains a failed Google sign-in', () => {
    render(<SignupForm initialError="google" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Google sign-in didn't finish");
  });
});
