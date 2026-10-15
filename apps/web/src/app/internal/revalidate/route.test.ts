import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('server-only', () => ({}));

const { POST } = await import('./route');

function post(body: unknown, auth?: string) {
  return POST(
    new Request('http://web:3000/internal/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('POST /internal/revalidate', () => {
  beforeEach(() => vi.stubEnv('REVALIDATE_SECRET', 's3cret'));
  afterEach(() => {
    vi.unstubAllEnvs();
    revalidateTag.mockReset();
  });

  it('clears the event and browse tags', async () => {
    const res = await post({ slugs: ['screen-printing-a1b2'] }, 'Bearer s3cret');
    expect(res.status).toBe(204);
    expect(revalidateTag).toHaveBeenCalledWith('event:screen-printing-a1b2', { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith('browse', { expire: 0 });
  });

  it('refuses a wrong or missing secret', async () => {
    expect((await post({ slugs: ['a'] }, 'Bearer nope')).status).toBe(401);
    expect((await post({ slugs: ['a'] })).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses bodies that are not a short list of slugs', async () => {
    for (const body of ['not json', {}, { slugs: [] }, { slugs: ['../x'] }, { slugs: [1] }]) {
      expect((await post(body, 'Bearer s3cret')).status).toBe(400);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('is off when no secret is configured', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await post({ slugs: ['a'] }, 'Bearer ')).status).toBe(404);
  });
});
