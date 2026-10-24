import { afterEach, describe, expect, it, vi } from 'vitest';
import { turnstileSiteKey } from './flags';

describe('turnstileSiteKey (SEC-10)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off by default, and off for anything but exactly true', () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    expect(turnstileSiteKey()).toBeNull();
    vi.stubEnv('TURNSTILE_ENABLED', '1');
    expect(turnstileSiteKey()).toBeNull();
  });

  it('gives the site key when on, and refuses to run on without one', () => {
    vi.stubEnv('TURNSTILE_ENABLED', 'true');
    vi.stubEnv('TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    expect(turnstileSiteKey()).toBe('1x00000000000000000000AA');
    vi.stubEnv('TURNSTILE_SITE_KEY', '');
    expect(() => turnstileSiteKey()).toThrow('TURNSTILE_SITE_KEY');
  });
});
