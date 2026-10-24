import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Turnstile, type TurnstileApi, type TurnstileHandle } from './Turnstile';

type Options = Parameters<TurnstileApi['render']>[1];

/** Stands in for Cloudflare's script: records the widget's options and the calls made on it. */
function fakeTurnstile() {
  let options: Options | undefined;
  const api = {
    render: vi.fn((_container: HTMLElement, opts: Options) => {
      options = opts;
      return 'widget-1';
    }),
    execute: vi.fn(),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  return { api, options: () => options! };
}

async function mount(siteKey = '1x00000000000000000000AA') {
  const ref = createRef<TurnstileHandle>();
  const view = render(<Turnstile ref={ref} siteKey={siteKey} action="signin" />);
  await act(async () => {});
  return { ref, ...view };
}

afterEach(() => {
  delete window.turnstile;
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('Turnstile (SEC-10)', () => {
  let fake: ReturnType<typeof fakeTurnstile>;

  beforeEach(() => {
    fake = fakeTurnstile();
    window.turnstile = fake.api;
  });

  it('renders an invisible-until-needed widget that runs only when asked', async () => {
    await mount();
    expect(fake.api.render).toHaveBeenCalledOnce();
    expect(fake.options()).toMatchObject({
      sitekey: '1x00000000000000000000AA',
      action: 'signin',
      execution: 'execute',
      appearance: 'interaction-only',
      retry: 'never',
    });
    expect(fake.api.execute).not.toHaveBeenCalled();
  });

  it('hands back the token Cloudflare gives, and starts over for the next one', async () => {
    const { ref } = await mount();
    const first = ref.current!.getToken();
    await act(async () => {});
    expect(fake.api.execute).toHaveBeenCalledWith('widget-1');
    fake.options().callback('token-1');
    await expect(first).resolves.toBe('token-1');

    const second = ref.current!.getToken();
    await act(async () => {});
    expect(fake.api.reset).toHaveBeenCalledWith('widget-1');
    fake.options().callback('token-2');
    await expect(second).resolves.toBe('token-2');
  });

  it.each(['error-callback', 'expired-callback', 'timeout-callback'] as const)(
    'gives null on %s',
    async (event) => {
      const { ref } = await mount();
      const token = ref.current!.getToken();
      await act(async () => {});
      fake.options()[event]();
      await expect(token).resolves.toBeNull();
    },
  );

  it('removes the widget when it unmounts', async () => {
    const { unmount } = await mount();
    unmount();
    expect(fake.api.remove).toHaveBeenCalledWith('widget-1');
  });
});

describe("Turnstile when Cloudflare's script can't load", () => {
  const script = () => document.head.querySelector('script')!;

  it('gives null, and tries the script again on the next ask', async () => {
    const { ref } = await mount();
    expect(script().src).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    );
    await act(async () => {
      script().dispatchEvent(new Event('error'));
    });
    expect(document.head.querySelector('script')).toBeNull();

    const token = ref.current!.getToken();
    await act(async () => {});
    // A fresh attempt, which fails too.
    await act(async () => {
      script().dispatchEvent(new Event('error'));
    });
    await expect(token).resolves.toBeNull();
  });

  it('gives null if the script never arrives', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = await mount();
      const token = ref.current!.getToken();
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
      await expect(token).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
