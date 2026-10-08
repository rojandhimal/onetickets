/** An amount of money in whole Australian cents. Money is never stored as a float. */
export type Cents = number;

const audFormatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export function formatAud(amount: Cents): string {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`Expected whole cents, got ${amount}`);
  }
  return audFormatter.format(amount / 100);
}
