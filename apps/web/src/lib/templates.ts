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
 * The About field's placeholder for each template (copy sheet, S1-4). A prompt, never saved text,
 * so nothing the organiser didn't write is published as theirs.
 */
export const ABOUT_PROMPTS: Record<ReturnType<typeof apiTemplate>, string> = {
  workshop: 'What will people make or learn? Who is it for, and do they need to bring anything?',
  gig: "Who's playing, and what's the music like? When do doors open, and is it all ages?",
  school_night:
    "What's on, and what's it raising money for? Is it for families, adults or everyone?",
  meetup:
    'What will you talk about or do? Who should come, and how will they find you on the night?',
  blank: 'Say what people will do and what to bring.',
};
