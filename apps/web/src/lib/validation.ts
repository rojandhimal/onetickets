import type { FieldError, MagicLinkRequest } from './contract';

export const ORGANISER_NAME_MAX = 80;

// Deliberately loose: the api is the source of truth. This only catches typos early.
export function validateSignup(input: MagicLinkRequest): FieldError[] {
  const errors: FieldError[] = [];
  const email = input.email.trim();
  if (!email) {
    errors.push({ field: 'email', message: 'Enter your email address' });
  } else if (!email.includes('@')) {
    errors.push({ field: 'email', message: 'Add an @, like priya@example.com' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Add the part after the @, like gmail.com' });
  }
  const name = input.organiserName.trim();
  if (!name) {
    errors.push({
      field: 'organiserName',
      message: 'Enter an organiser name. Your own name is fine',
    });
  } else if (name.length > ORGANISER_NAME_MAX) {
    errors.push({
      field: 'organiserName',
      message: `Keep it to ${ORGANISER_NAME_MAX} characters or fewer`,
    });
  }
  return errors;
}
