import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftEvent } from '@/test/event-fixture';
import { memoryDraftStore } from './draft-store';
import { useAutosave } from './use-autosave';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function bodies(fetch: ReturnType<typeof vi.fn>) {
  return fetch.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('saves queued changes with the current version and reports saved', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(draftEvent({ version: 2 })));
    vi.stubGlobal('fetch', fetch);
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', onSaved, store: memoryDraftStore() }),
    );

    act(() => result.current.change({ name: 'Screen printing' }));
    await act(() => result.current.flush());

    expect(fetch).toHaveBeenCalledWith(
      '/api/organisations/org_1/events/evt_1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(bodies(fetch)).toEqual([{ version: 1, name: 'Screen printing' }]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }));
    expect(result.current.saveState).toBe('saved');

    act(() => result.current.change({ name: 'Screen printing 101' }));
    await act(() => result.current.flush());
    expect(bodies(fetch)[1]).toEqual({ version: 2, name: 'Screen printing 101' });
  });

  it('does nothing when there is nothing to save', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore() }),
    );
    await act(() => result.current.flush());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('saves on its own every 10 seconds while dirty', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = vi.fn().mockResolvedValue(jsonResponse(draftEvent({ version: 2 })));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore() }),
    );
    act(() => result.current.change({ name: 'Gig night' }));
    await act(() => vi.advanceTimersByTimeAsync(9_000));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps changes on the device when offline and syncs them when back online', async () => {
    const store = memoryDraftStore();
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useAutosave({ event: draftEvent(), userId: 'u_1', store }));

    act(() => result.current.change({ name: 'Trivia night' }));
    await act(() => result.current.flush());
    expect(result.current.saveState).toBe('offline');
    expect(await store.get('evt_1')).toEqual({ name: 'Trivia night' });

    fetch.mockResolvedValue(jsonResponse(draftEvent({ version: 2 })));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.saveState).toBe('saved'));
    expect(bodies(fetch)[1]).toEqual({ version: 1, name: 'Trivia night' });
    expect(await store.get('evt_1')).toBeNull();
  });

  it('restores changes left on the device and syncs them', async () => {
    const store = memoryDraftStore();
    await store.put('evt_1', { name: 'From the bus' });
    const fetch = vi.fn().mockResolvedValue(jsonResponse(draftEvent({ version: 2 })));
    vi.stubGlobal('fetch', fetch);
    const onRestore = vi.fn();
    renderHook(() => useAutosave({ event: draftEvent(), userId: 'u_1', store, onRestore }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(onRestore).toHaveBeenCalledWith({ name: 'From the bus' });
    expect(bodies(fetch)[0]).toEqual({ version: 1, name: 'From the bus' });
  });

  it('resends on top of a newer version when another tab saved first', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 409,
            code: 'stale_draft',
            message: 'x',
            current: draftEvent({ version: 5 }),
          },
          409,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(draftEvent({ version: 6 })));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore() }),
    );
    act(() => result.current.change({ name: 'Mine' }));
    await act(() => result.current.flush());
    expect(bodies(fetch)).toEqual([
      { version: 1, name: 'Mine' },
      { version: 5, name: 'Mine' },
    ]);
    expect(result.current.saveState).toBe('saved');
  });

  it('drops a field the api refuses and reports it', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 422, code: 'invalid_request', message: 'Too long', field: 'name' },
          422,
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const onInvalid = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore(), onInvalid }),
    );
    act(() => result.current.change({ name: 'x' }));
    await act(() => result.current.flush());
    expect(onInvalid).toHaveBeenCalledWith('name', 'Too long', 'invalid_request');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.saveState).toBe('saved');
  });

  it("says it couldn't save when the api fails while online, then recovers", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ statusCode: 500 }, 500))
      .mockResolvedValueOnce(jsonResponse(draftEvent({ version: 2 })));
    vi.stubGlobal('fetch', fetch);
    const store = memoryDraftStore();
    const { result } = renderHook(() => useAutosave({ event: draftEvent(), userId: 'u_1', store }));
    act(() => result.current.change({ name: 'Screen printing' }));
    await act(() => result.current.flush());
    expect(result.current.saveState).toBe('failed');
    expect(await store.get('evt_1')).toEqual({ name: 'Screen printing' });

    await act(() => result.current.flush());
    expect(result.current.saveState).toBe('saved');
    expect(bodies(fetch)[1]).toEqual({ version: 1, name: 'Screen printing' });
  });

  it('takes the version from a change the api made outside autosave', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(draftEvent({ version: 4 })));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore() }),
    );
    act(() => result.current.accept(draftEvent({ version: 3 })));
    act(() => result.current.change({ name: 'After upload' }));
    await act(() => result.current.flush());
    expect(bodies(fetch)[0]).toEqual({ version: 3, name: 'After upload' });
  });

  it('keeps typing made during a save the api refuses without naming a field', async () => {
    let answer!: (r: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (answer = r)))
      .mockResolvedValueOnce(jsonResponse(draftEvent({ version: 2 })));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore() }),
    );
    act(() => result.current.change({ name: 'Bad' }));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.flush();
    });
    act(() => result.current.change({ about: 'Typed meanwhile' }));
    answer(jsonResponse({ statusCode: 422, code: 'invalid_request', message: 'No' }, 422));
    await act(() => saving);

    expect(bodies(fetch)[1]).toEqual({ version: 1, about: 'Typed meanwhile' });
    expect(result.current.saveState).toBe('failed');
  });

  it('sends typing that lands during a save straight after it', async () => {
    let answer!: (r: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (answer = r)))
      .mockResolvedValueOnce(jsonResponse(draftEvent({ version: 3 })));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() =>
      useAutosave({ event: draftEvent(), userId: 'u_1', store: memoryDraftStore() }),
    );
    act(() => result.current.change({ name: 'A' }));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.flush();
    });
    act(() => result.current.change({ name: 'AB' }));
    answer(jsonResponse(draftEvent({ version: 2 })));
    await act(() => saving);

    expect(bodies(fetch)).toEqual([
      { version: 1, name: 'A' },
      { version: 2, name: 'AB' },
    ]);
    expect(result.current.saveState).toBe('saved');
  });
});
