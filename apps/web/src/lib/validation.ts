// Deliberately loose: the api is the source of truth. These only catch typos early.

export const ORGANISER_NAME_MAX = 120;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Enter your email address';
  if (!email.includes('@')) return 'Add an @, like priya@example.com';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Add the part after the @, like gmail.com';
  return null;
}

export function validateOrganiserName(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Enter an organiser name. Your own name is fine';
  if (name.length > ORGANISER_NAME_MAX)
    return `Keep it to ${ORGANISER_NAME_MAX} characters or fewer`;
  return null;
}
