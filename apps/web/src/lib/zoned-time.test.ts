import { describe, expect, it } from 'vitest';
import {
  eventEyebrow,
  eventWhen,
  isSkippedTime,
  isoToWallClock,
  nextDay,
  wallClockToIso,
} from './zoned-time';

const SYD = 'Australia/Sydney';

describe('zoned time', () => {
  it('uses the daylight saving offset in summer and standard time in winter', () => {
    expect(wallClockToIso({ date: '2026-11-14', time: '10:00' }, SYD)).toBe(
      '2026-11-14T10:00:00+11:00',
    );
    expect(wallClockToIso({ date: '2026-07-01', time: '19:30' }, SYD)).toBe(
      '2026-07-01T19:30:00+10:00',
    );
    expect(wallClockToIso({ date: '2026-11-14', time: '10:00' }, 'Australia/Perth')).toBe(
      '2026-11-14T10:00:00+08:00',
    );
  });

  it('moves a time skipped by the clocks going forward to just after the gap', () => {
    // Clocks jump from 2:00 to 3:00 on 4 Oct 2026 in Sydney.
    expect(wallClockToIso({ date: '2026-10-04', time: '02:30' }, SYD)).toBe(
      '2026-10-04T03:30:00+11:00',
    );
  });

  it('round-trips back to the wall clock', () => {
    expect(isoToWallClock('2026-11-14T10:00:00+11:00', SYD)).toEqual({
      date: '2026-11-14',
      time: '10:00',
    });
    expect(isoToWallClock('2026-11-13T23:00:00Z', SYD)).toEqual({
      date: '2026-11-14',
      time: '10:00',
    });
  });

  it('formats the eyebrow and the checklist line', () => {
    expect(eventEyebrow('2026-11-14T10:00:00+11:00', SYD)).toBe('Sat 14 Nov · 10:00 am');
    expect(eventWhen('2026-11-14T10:00:00+11:00', '2026-11-14T13:00:00+11:00', SYD)).toBe(
      'Sat 14 Nov, 10:00 am to 1:00 pm',
    );
  });

  it('rolls over months and years', () => {
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
});

describe('daylight saving gaps', () => {
  it('moves a skipped time forward, in zones either side of UTC', () => {
    expect(wallClockToIso({ date: '2027-10-03', time: '02:30' }, 'Australia/Sydney')).toBe(
      '2027-10-03T03:30:00+11:00',
    );
    expect(wallClockToIso({ date: '2027-03-14', time: '02:30' }, 'America/New_York')).toBe(
      '2027-03-14T03:30:00-04:00',
    );
    expect(isSkippedTime({ date: '2027-10-03', time: '02:30' }, 'Australia/Sydney')).toBe(true);
    expect(isSkippedTime({ date: '2027-10-03', time: '04:00' }, 'Australia/Sydney')).toBe(false);
  });

  it('takes the first of a repeated time', () => {
    expect(wallClockToIso({ date: '2027-04-04', time: '02:30' }, 'Australia/Sydney')).toBe(
      '2027-04-04T02:30:00+11:00',
    );
  });
});
