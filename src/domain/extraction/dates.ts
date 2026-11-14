import { parseExpiry } from '../expiry';
export type DateReading = { value: string | null; issue: string | null };
export function readDate(raw: string): DateReading {
  const text = raw.trim();
  let canonical: string | null = null;
  if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(text)) canonical = text;
  const month = /^(\d{1,2})[/-](\d{4})$/.exec(text);
  if (month) canonical = `${month[2]}-${month[1].padStart(2, '0')}`;
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  if (slash) {
    const a = +slash[1],
      b = +slash[2];
    if (a <= 12 && b <= 12 && a !== b)
      return {
        value: null,
        issue: `Ambiguous date “${text}”: enter YYYY-MM-DD after checking the packaging.`,
      };
    if (a > 12 || a === b)
      canonical = `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
    else canonical = `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  if (!canonical)
    return { value: null, issue: `Unrecognised date “${text}”: enter YYYY-MM or YYYY-MM-DD.` };
  try {
    const parsed = parseExpiry(canonical);
    return {
      value: parsed.precision === 'month' ? parsed.expiry!.slice(0, 7) : parsed.expiry,
      issue: null,
    };
  } catch {
    return { value: null, issue: `Invalid calendar date “${text}”.` };
  }
}
export function dateBounds(value: string): [string, string] {
  const parsed = parseExpiry(value);
  if (!parsed.expiry) throw new Error('A date is required.');
  return [parsed.precision === 'month' ? `${value}-01` : parsed.expiry, parsed.expiry];
}
export function chronologyError(manufactured: string | null, expiry: string | null): string | null {
  if (!manufactured || !expiry) return null;
  try {
    return dateBounds(manufactured)[0] > dateBounds(expiry)[1]
      ? 'Manufacturing date must not be later than expiry. Check both dates.'
      : null;
  } catch {
    return 'Enter valid dates before saving.';
  }
}
