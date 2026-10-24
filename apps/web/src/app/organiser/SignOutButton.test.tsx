import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

let finish: () => void = () => undefined;
const signOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
vi.mock('@/lib/auth-client', () => ({ signOut: () => signOut() }));

const { SignOutButton } = await import('./SignOutButton');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignOutButton', () => {
  it('signs out once, then loads the sign-in page', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<SignOutButton />);
    const button = screen.getByRole('button', { name: 'Sign out' });
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Signing out…' }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/signin'));
  });
});
