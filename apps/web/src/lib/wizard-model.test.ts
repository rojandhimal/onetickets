import { describe, expect, it } from 'vitest';
import { draftEvent, readyEvent } from '@/test/event-fixture';
import {
  isStepComplete,
  missingMessage,
  missingRequirements,
  nextStep,
  previousStep,
  publishChecklist,
  stepHref,
} from './wizard-model';

describe('wizard model', () => {
  it('lists what a new draft still needs, in checklist order', () => {
    expect(missingRequirements(draftEvent())).toEqual(['name', 'date_time', 'venue']);
    expect(missingRequirements(readyEvent())).toEqual([]);
    expect(missingRequirements(readyEvent({ ticketTypes: [] }))).toEqual(['ticket_type']);
    expect(missingRequirements(readyEvent({ name: '   ' }))).toEqual(['name']);
    expect(missingRequirements(readyEvent({ endsAt: null }))).toEqual(['date_time']);
    expect(missingRequirements(readyEvent({ endsAt: '2026-11-14T09:00:00+11:00' }))).toEqual([
      'date_time',
    ]);
  });

  it('words the publish error like the design', () => {
    expect(missingMessage(['venue'])).toBe('Add a venue to publish.');
    expect(missingMessage(['name', 'venue'])).toBe('Add an event name and a venue to publish.');
    expect(missingMessage(['name', 'date_time', 'venue'])).toBe(
      'Add an event name, a date with start and end times and a venue to publish.',
    );
  });

  it('builds the checklist rows', () => {
    const rows = publishChecklist(readyEvent({ venue: null }));
    expect(rows.map((r) => [r.label, r.value, r.done])).toEqual([
      ['Event name', 'Screen printing for beginners', true],
      ['Date and time', 'Sat 14 Nov, 10:00 am to 1:00 pm', true],
      ['Venue', 'Not added yet', false],
      ['At least one ticket type', 'General admission · Free · 40', true],
    ]);
    expect(
      publishChecklist(readyEvent({ venue: { kind: 'online', url: 'https://x.test' } }))[2],
    ).toMatchObject({ value: 'Online', done: true });
  });

  it('ticks steps by content, not by position', () => {
    expect(isStepComplete('basics', draftEvent())).toBe(false);
    expect(isStepComplete('basics', readyEvent())).toBe(true);
    expect(isStepComplete('tickets', draftEvent())).toBe(true);
    expect(isStepComplete('details', draftEvent())).toBe(false);
    expect(isStepComplete('details', draftEvent({ about: 'Bring an apron' }))).toBe(true);
  });

  it('moves between steps', () => {
    expect(previousStep('basics')).toBeNull();
    expect(previousStep('tickets')).toBe('basics');
    expect(nextStep('details')).toBe('review');
    expect(nextStep('review')).toBeNull();
    expect(stepHref('tickets', 'evt 1')).toBe('/organiser/events/new/tickets?draft=evt%201');
  });
});
