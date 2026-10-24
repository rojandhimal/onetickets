'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

// Cloudflare Turnstile (SEC-10). The widget only runs when it's asked for a token, and only shows
// itself when Cloudflare wants the person to do something.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 15_000;

type RenderOptions = {
  sitekey: string;
  action: string;
  execution: 'execute';
  appearance: 'interaction-only';
  size: 'flexible';
  retry: 'never';
  callback: (token: string) => void;
  'error-callback': () => boolean;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'before-interactive-callback': () => void;
  'after-interactive-callback': () => void;
};

export type TurnstileApi = {
  render(container: HTMLElement, options: RenderOptions): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/**
 * Loads Cloudflare's script once per page. The nonce CSP allows it because our own (trusted) code
 * inserts it ('strict-dynamic').
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    // A script that never arrives mustn't leave the form waiting for ever.
    const timer = setTimeout(() => reject(new Error('Turnstile timed out')), LOAD_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile missing'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Let the next attempt try again, say after the connection comes back.
    loading = null;
    throw error;
  });
  return loading;
}

export type TurnstileHandle = {
  /** A fresh single-use token, or null if the check failed, timed out or couldn't load. */
  getToken(): Promise<string | null>;
};

type Widget = { api: TurnstileApi; id: string; used: boolean };

type Props = {
  siteKey: string;
  /** Shown in Cloudflare's analytics, e.g. `signin`. */
  action: string;
  ref?: Ref<TurnstileHandle>;
};

export function Turnstile({ siteKey, action, ref }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const rendered = useRef<Widget | null>(null);
  const mounting = useRef<Promise<Widget | null> | null>(null);
  const pending = useRef<((token: string | null) => void) | null>(null);
  // Hidden until Cloudflare wants an interaction. Turnstile puts a hidden input and frame in the
  // container even when there's nothing to see, so it would otherwise take a gap in the form.
  const [interactive, setInteractive] = useState(false);

  const settle = (token: string | null) => {
    pending.current?.(token);
    pending.current = null;
  };

  /** Renders the widget once its script is in. Null if it can't load; the next call tries again. */
  const mount = useCallback((): Promise<Widget | null> => {
    if (rendered.current) return Promise.resolve(rendered.current);
    mounting.current ??= loadTurnstile()
      .then((api) => {
        // Unmounted while the script loaded.
        if (!container.current) return null;
        const id = api.render(container.current, {
          sitekey: siteKey,
          action,
          execution: 'execute',
          appearance: 'interaction-only',
          // Fills the form's width when it does show.
          size: 'flexible',
          // We ask again on the next submit instead of letting it loop.
          retry: 'never',
          callback: (token) => settle(token),
          'error-callback': () => {
            settle(null);
            return true;
          },
          'expired-callback': () => settle(null),
          'timeout-callback': () => settle(null),
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
        });
        rendered.current = { api, id, used: false };
        return rendered.current;
      })
      .catch(() => null)
      .finally(() => {
        mounting.current = null;
      });
    return mounting.current;
  }, [siteKey, action]);

  useEffect(() => {
    void mount();
    return () => {
      if (rendered.current) rendered.current.api.remove(rendered.current.id);
      rendered.current = null;
      settle(null);
    };
  }, [mount]);

  useImperativeHandle(ref, () => ({
    async getToken() {
      const current = await mount();
      if (!current) return null;
      settle(null);
      return new Promise<string | null>((resolve) => {
        pending.current = resolve;
        // Each token works once, so a used widget starts over.
        if (current.used) current.api.reset(current.id);
        current.used = true;
        current.api.execute(current.id);
      });
    },
  }));

  return <div ref={container} hidden={!interactive} />;
}
