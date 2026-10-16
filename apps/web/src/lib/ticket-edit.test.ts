import { describe, expect, it } from 'vitest';
import { withTicketLock } from './ticket-edit';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('withTicketLock', () => {
  it('runs saves for one event one at a time, in order', async () => {
    const log: string[] = [];
    let release: () => void = () => undefined;
    const first = withTicketLock('evt_1', async () => {
      log.push('first starts');
      await new Promise<void>((resolve) => (release = resolve));
      log.push('first ends');
    });
    const second = withTicketLock('evt_1', async () => {
      log.push('second');
    });
    await tick();
    expect(log).toEqual(['first starts']);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['first starts', 'first ends', 'second']);
  });

  it('carries on after a save that throws', async () => {
    const failed = withTicketLock('evt_1', async () => {
      throw new Error('boom');
    });
    await expect(failed).rejects.toThrow('boom');
    await expect(withTicketLock('evt_1', async () => 'next')).resolves.toBe('next');
  });

  it('lets other events save at the same time', async () => {
    let release: () => void = () => undefined;
    const held = withTicketLock('evt_1', () => new Promise<void>((resolve) => (release = resolve)));
    await expect(withTicketLock('evt_2', async () => 'other')).resolves.toBe('other');
    release();
    await held;
  });
});
