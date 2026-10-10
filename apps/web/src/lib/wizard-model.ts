import {
  type EventDraftDto,
  PUBLISH_REQUIREMENTS,
  WIZARD_STEPS,
  formatAud,
} from '@onetickets/shared';
import { eventWhen } from './zoned-time';

// Pure rules behind the create-event wizard (design 7 to 8c), kept apart from the UI for tests.

export type WizardStep = (typeof WIZARD_STEPS)[number];
export type Requirement = (typeof PUBLISH_REQUIREMENTS)[number];

export const STEP_LABELS: Record<WizardStep, string> = {
  basics: 'Basics',
  tickets: 'Tickets',
  details: 'Details',
  review: 'Review',
};

export function isWizardStep(value: string): value is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

export function stepHref(step: WizardStep, eventId: string): string {
  return `/organiser/events/new/${step}?draft=${encodeURIComponent(eventId)}`;
}

export function previousStep(step: WizardStep): WizardStep | null {
  const i = WIZARD_STEPS.indexOf(step);
  return i > 0 ? (WIZARD_STEPS[i - 1] ?? null) : null;
}

export function nextStep(step: WizardStep): WizardStep | null {
  return WIZARD_STEPS[WIZARD_STEPS.indexOf(step) + 1] ?? null;
}

/** What publishing still needs, in checklist order. Mirrors the api's `not_ready` check. */
export function missingRequirements(event: EventDraftDto): Requirement[] {
  const has: Record<Requirement, boolean> = {
    name: !!event.name?.trim(),
    date_time:
      !!event.startsAt && !!event.endsAt && Date.parse(event.endsAt) > Date.parse(event.startsAt),
    venue: !!event.venue,
    ticket_type: event.ticketTypes.length > 0,
  };
  return PUBLISH_REQUIREMENTS.filter((r) => !has[r]);
}

/** A step is ticked in the stepper once what it asks for is filled in. */
export function isStepComplete(step: WizardStep, event: EventDraftDto): boolean {
  const missing = missingRequirements(event);
  switch (step) {
    case 'basics':
      return !missing.some((r) => r === 'name' || r === 'date_time' || r === 'venue');
    case 'tickets':
      return !missing.includes('ticket_type');
    case 'details':
      return (
        !!event.about.trim() ||
        event.accessibility.features.length > 0 ||
        !!event.accessibility.notes.trim()
      );
    case 'review':
      return false;
  }
}

const REQUIREMENT_NOUN: Record<Requirement, string> = {
  name: 'an event name',
  date_time: 'a date with start and end times',
  venue: 'a venue',
  ticket_type: 'a ticket type',
};

/** "Add a venue to publish." or "Add an event name and a venue to publish." */
export function missingMessage(missing: Requirement[]): string {
  const nouns = missing.map((r) => REQUIREMENT_NOUN[r]);
  const list =
    nouns.length <= 1
      ? (nouns[0] ?? '')
      : `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
  return `Add ${list} to publish.`;
}

export type ChecklistRow = {
  requirement: Requirement;
  label: string;
  value: string;
  done: boolean;
  step: WizardStep;
};

export function publishChecklist(event: EventDraftDto): ChecklistRow[] {
  const missing = new Set(missingRequirements(event));
  const first = event.ticketTypes[0];
  const venue = event.venue;
  const rows: Omit<ChecklistRow, 'done'>[] = [
    { requirement: 'name', label: 'Event name', value: event.name ?? '', step: 'basics' },
    {
      requirement: 'date_time',
      label: 'Date and time',
      value: event.startsAt ? eventWhen(event.startsAt, event.endsAt, event.timeZone) : '',
      step: 'basics',
    },
    {
      requirement: 'venue',
      label: 'Venue',
      value: !venue ? '' : venue.kind === 'online' ? 'Online' : `${venue.name}, ${venue.suburb}`,
      step: 'basics',
    },
    {
      requirement: 'ticket_type',
      label: 'At least one ticket type',
      value: first
        ? [
            first.name,
            first.priceCents === 0 ? 'Free' : formatAud(first.priceCents),
            first.capacity,
          ]
            .join(' · ')
            .concat(event.ticketTypes.length > 1 ? ` and ${event.ticketTypes.length - 1} more` : '')
        : '',
      step: 'tickets',
    },
  ];
  return rows.map((row) => ({
    ...row,
    done: !missing.has(row.requirement),
    value: missing.has(row.requirement) ? 'Not added yet' : row.value,
  }));
}

export function niceToHave(event: EventDraftDto) {
  return [
    { label: 'Banner image', done: !!event.banner, step: 'basics' as const },
    { label: 'About this event', done: !!event.about.trim(), step: 'details' as const },
    {
      label: 'Accessibility details',
      done: event.accessibility.features.length > 0 || !!event.accessibility.notes.trim(),
      step: 'details' as const,
    },
  ];
}

/** "Marrickville · The Print Shed", "Online event", or nothing yet. */
export function placeLine(event: Pick<EventDraftDto, 'venue'>): string {
  const venue = event.venue;
  if (!venue) return '';
  return venue.kind === 'online' ? 'Online event' : `${venue.suburb} · ${venue.name}`;
}
