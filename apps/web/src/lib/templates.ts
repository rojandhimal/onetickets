export type EventTemplate = {
  id: 'workshop' | 'gig' | 'school-night' | 'meetup';
  name: string;
  description: string;
  icon: 'workshop' | 'gig' | 'school-night' | 'meetup';
};

// Order and copy from design screen 0b. Each opens the S1-1 create wizard pre-filled.
export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Classes and courses, 10 to 100 people',
    icon: 'workshop',
  },
  { id: 'gig', name: 'Gig', description: 'Live music and club nights', icon: 'gig' },
  {
    id: 'school-night',
    name: 'School night',
    description: 'Trivia, fundraisers, concerts',
    icon: 'school-night',
  },
  { id: 'meetup', name: 'Meetup', description: 'Clubs and community groups', icon: 'meetup' },
];

/** The api spells template ids with underscores; a bare /new starts from a blank event. */
export function apiTemplate(
  webId: string | undefined,
): 'workshop' | 'gig' | 'school_night' | 'meetup' | 'blank' {
  const found = EVENT_TEMPLATES.find((t) => t.id === webId);
  return found ? (found.id === 'school-night' ? 'school_night' : found.id) : 'blank';
}

export function newEventHref(templateId?: EventTemplate['id']): string {
  return templateId ? `/organiser/events/new?template=${templateId}` : '/organiser/events/new';
}

/**
 * The About paragraph each template starts with (handoff S1-1, carried to S1-4). The organiser
 * edits or clears it on step 3; a blank event starts empty.
 */
export const STARTER_ABOUT: Record<ReturnType<typeof apiTemplate>, string> = {
  workshop:
    "A hands-on session for beginners. We'll supply the materials; bring yourself and something to take notes.",
  gig: 'Live music from start to finish. Doors open 30 minutes before the first act.',
  school_night: 'A night out for our school community. All welcome, and every ticket helps.',
  meetup: 'A friendly get-together. New faces are always welcome, so come and say hello.',
  blank: '',
};
