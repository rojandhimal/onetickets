import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganisationNameForm } from './OrganisationNameForm';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));

beforeEach(() => {
  replace.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OrganisationNameForm', () => {
  it('prefills the Google name, creates the organisation and goes home', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<OrganisationNameForm suggestion="Priya Natarajan" />);

    const input = screen.getByLabelText('Organiser name');
    expect(input).toHaveValue('Priya Natarajan');
    await user.clear(input);
    await user.type(input, 'The Print Shed');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/organisations',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      name: 'The Print Shed',
    });
    expect(replace).toHaveBeenCalledWith('/organiser');
  });

  it('requires a name before calling the api', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<OrganisationNameForm suggestion="" />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const input = screen.getByLabelText('Organiser name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a failure without leaving the page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const user = userEvent.setup();
    render(<OrganisationNameForm suggestion="The Print Shed" />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save that");
    expect(replace).not.toHaveBeenCalled();
  });
});
