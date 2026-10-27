import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { UnitOfWork } from '../../database/database.module.js';
import { Mailer } from '../notifications/index.js';
import { AttendeeAuthRepository } from './attendee-auth.repository.js';
import { AttendeeAuthService } from './attendee-auth.service.js';
import { RateLimiter } from './rate-limiter.js';
import { Turnstile, type TurnstileOutcome } from './turnstile.js';

function fixture(outcome?: TurnstileOutcome) {
  const repository = new AttendeeAuthRepository();
  const issue = vi.spyOn(repository, 'issue').mockResolvedValue('test-link-secret');
  const uow = new UnitOfWork({} as pg.Pool);
  vi.spyOn(uow, 'run').mockImplementation(async (_scope, work) => work({} as pg.PoolClient));
  const limiter = new RateLimiter(uow);
  const hit = vi.spyOn(limiter, 'hit').mockResolvedValue();
  const turnstile = new Turnstile(outcome ? 'test-secret' : null);
  const verify = vi.spyOn(turnstile, 'verify').mockResolvedValue(outcome ?? 'passed');
  const send = vi.fn<Mailer['send']>().mockResolvedValue();
  const service = new AttendeeAuthService(
    {
      webUrl: 'https://onetickets.example.test',
      secureCookies: true,
      mfaKey: Buffer.alloc(32),
      magicLinkHourlyCap: 300,
    },
    uow,
    repository,
    limiter,
    { send },
    turnstile,
  );
  return { service, issue, hit, verify, send };
}

describe('attendee link delivery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('defaults off and does not send or consume a rate budget', async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', undefined);
    const { service, issue, hit, send } = fixture();
    await expect(service.requestLink('buyer@example.test', '127.0.0.1')).rejects.toMatchObject({
      status: 404,
    });
    expect(issue).not.toHaveBeenCalled();
    expect(hit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['failed', 'unavailable'] as const)(
    'does not issue mail after a %s challenge',
    async (outcome) => {
      vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'true');
      const { service, issue, hit, verify, send } = fixture(outcome);
      await expect(
        service.requestLink('buyer@example.test', '127.0.0.1', 'challenge'),
      ).rejects.toMatchObject({ status: outcome === 'failed' ? 403 : 503 });
      expect(verify).toHaveBeenCalledWith('challenge');
      expect(hit).toHaveBeenCalledOnce();
      expect(hit.mock.calls[0]![0]!.key).toMatch(/^attendee:link:ip:/);
      expect(issue).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('sends confidential fragment links and shares the sign-in hourly cap', async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'true');
    const { service, hit, send } = fixture('passed');
    await service.requestLink('buyer@example.test', '127.0.0.1', 'challenge');
    expect(hit.mock.calls.map((call) => call[0]!.key)).toEqual([
      expect.stringMatching(/^attendee:link:ip:/),
      expect.stringMatching(/^attendee:link:email:/),
      'link:global',
    ]);
    expect(hit).toHaveBeenLastCalledWith(expect.objectContaining({ max: 300, rolling: true }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        confidential: true,
        to: 'buyer@example.test',
        text: expect.stringContaining('/my-tickets/verify#token=test-link-secret'),
      }),
    );
  });

  it('replaces mail errors containing recipient and bearer link with a fixed safe error', async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'true');
    const { service, send } = fixture();
    send.mockRejectedValue(
      new Error('buyer@example.test /my-tickets/verify#token=test-link-secret'),
    );
    const error = await service
      .requestLink('buyer@example.test', '127.0.0.1')
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({ status: 503, response: { code: 'attendee_mail_unavailable' } });
    expect(JSON.stringify(error)).not.toContain('buyer@example.test');
    expect(JSON.stringify(error)).not.toContain('test-link-secret');
    expect(error).toHaveProperty('cause', undefined);
  });
});
