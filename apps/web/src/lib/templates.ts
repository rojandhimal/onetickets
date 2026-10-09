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

export function newEventHref(templateId?: EventTemplate['id']): string {
  return templateId ? `/organiser/events/new?template=${templateId}` : '/organiser/events/new';
}
