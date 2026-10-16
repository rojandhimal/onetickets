/** An amount of money in whole Australian cents. Money is never stored as a float. */
export type Cents = number;

const audFormatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

/**
 * "A$53.35". en-AU writes plain "$" for AUD, but buyers may be visiting from elsewhere, so the
 * design always says A$. A negative amount (a refund) is "-A$5.00".
 */
export function formatAud(amount: Cents): string {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`Expected whole cents, got ${amount}`);
  }
  const text = `A${audFormatter.format(Math.abs(amount) / 100)}`;
  return amount < 0 ? `-${text}` : text;
}
