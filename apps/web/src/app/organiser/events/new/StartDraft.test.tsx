import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftEvent } from '@/test/event-fixture';
import { STARTER_ABOUT } from '@/lib/templates';
import { StartDraft } from './StartDraft';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe('StartDraft', () => {
  it('creates one draft from the template and opens the first step', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(draftEvent()), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    render(<StartDraft organisationId="org_1" template="school_night" />);

    expect(screen.getByRole('status')).toHaveTextContent('Starting your event');
    await vi.waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/organiser/events/new/basics?draft=evt_1'),
    );
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/organisations/org_1/events');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ template: 'school_night' });
    // Then the template's starter About, on the new draft's version.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1].method).toBe('PATCH');
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({
      version: draftEvent().version,
      about: STARTER_ABOUT.school_night,
    });
  });

  it('starts a blank event with no About', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(draftEvent()), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    render(<StartDraft organisationId="org_1" template="blank" />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the draft could not be created', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify(draftEvent()), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<StartDraft organisationId="org_1" template="blank" />);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't start your event");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
  });
});
