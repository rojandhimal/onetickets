// Organisers pick a wall-clock date and time where the event happens; the api stores instants.
// These convert between the two for an IANA zone without a date library.

export const DEFAULT_TIME_ZONE = 'Australia/Sydney';

export type WallClock = { date: string; time: string };

function parts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Minutes the zone is ahead of UTC at that instant (e.g. +660 for Sydney in summer). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const { date, time } = parts(instant, timeZone);
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  return Math.round((asUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * ISO 8601 with the zone's offset, e.g. 2026-11-14T10:00:00+11:00. A time skipped by a daylight
 * saving jump resolves to the instant just after the gap.
 */
export function wallClockToIso({ date, time }: WallClock, timeZone: string): string {
  const naiveUtc = Date.parse(`${date}T${time}:00Z`);
  // The offsets half a day either side cover any daylight saving change near this time.
  const before = offsetMinutes(new Date(naiveUtc - 12 * 3_600_000), timeZone);
  const after = offsetMinutes(new Date(naiveUtc + 12 * 3_600_000), timeZone);
  const candidates = [naiveUtc - before * 60_000, naiveUtc - after * 60_000];
  // A time that happens twice (clocks going back) takes the first; one that never happens (clocks
  // going forward) uses the offset from before the jump, which lands just after the gap.
  const exact = candidates
    .filter((t) => {
      const p = parts(new Date(t), timeZone);
      return p.date === date && p.time === time;
    })
    .sort((a, b) => a - b)[0];
  const instant = new Date(exact ?? candidates[0]!);
  const local = parts(instant, timeZone);
  return `${local.date}T${local.time}:00${formatOffset(offsetMinutes(instant, timeZone))}`;
}

/** True when that date and time never happens in the zone (skipped by a daylight saving jump). */
export function isSkippedTime(wall: WallClock, timeZone: string): boolean {
  return isoToWallClock(wallClockToIso(wall, timeZone), timeZone).time !== wall.time;
}

export function isoToWallClock(iso: string, timeZone: string): WallClock {
  return parts(new Date(iso), timeZone);
}

/** Next calendar day of a YYYY-MM-DD date. */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "Sat 14 Nov · 10:00 am", as on the canvas eyebrows. */
export function eventEyebrow(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
  return `${day.replace(',', '')} · ${timeOfDay(d, timeZone)}`;
}

/** "Sat 14 Nov, 10:00 am to 1:00 pm" for the publish checklist. */
export function eventWhen(startsAt: string, endsAt: string | null, timeZone: string): string {
  const start = new Date(startsAt);
  const day = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(start)
    .replace(',', '');
  const from = timeOfDay(start, timeZone);
  return endsAt ? `${day}, ${from} to ${timeOfDay(new Date(endsAt), timeZone)}` : `${day}, ${from}`;
}

/** "Sat 14 Nov · 10:00 am to 1:00 pm", the event page eyebrow. */
export function eventEyebrowRange(startsAt: string, endsAt: string, timeZone: string): string {
  return eventWhen(startsAt, endsAt, timeZone).replace(', ', ' · ');
}

function timeOfDay(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(/\s/g, ' ')
    .toLowerCase();
}
