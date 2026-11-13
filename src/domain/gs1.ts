import { validGTIN } from './identifiers';
import { gs1Expiry } from './expiry';
export type GS1Result = {
  gtin?: string;
  batch?: string;
  expiry?: string;
  expiryPrecision?: 'day' | 'month';
  serial?: string;
  notes: string[];
};
const fixed: Record<string, number> = { '01': 14, '17': 6 };
const variable: Record<string, number> = { '10': 20, '21': 20 };
export function parseGS1(raw: string): GS1Result {
  const out: GS1Result = { notes: [] };
  const fields: Record<string, string> = {};
  let value = raw.replace(/^\](d2|C1|Q3)/, '');
  if (value.startsWith('(')) {
    const expression = /\((\d{2,4})\)([^()]*)/g;
    let match: RegExpExecArray | null,
      consumed = '';
    while ((match = expression.exec(value))) {
      if (fields[match[1]] !== undefined) {
        out.notes.push('Repeated GS1 field; confirm this code.');
        return out;
      }
      fields[match[1]] = match[2];
      consumed += match[0];
    }
    if (consumed !== value) {
      out.notes.push('Malformed human-readable GS1 fields.');
      return out;
    }
  } else {
    while (value.length) {
      if (value[0] === '\x1d') {
        value = value.slice(1);
        continue;
      }
      const ai = value.slice(0, 2);
      value = value.slice(2);
      if (fields[ai] !== undefined) {
        out.notes.push('Repeated GS1 field; confirm this code.');
        break;
      }
      if (fixed[ai]) {
        if (value.length < fixed[ai]) {
          out.notes.push(`Incomplete GS1 field ${ai}.`);
          break;
        }
        fields[ai] = value.slice(0, fixed[ai]);
        value = value.slice(fixed[ai]);
      } else if (variable[ai]) {
        const end = value.indexOf('\x1d');
        const field = end === -1 ? value : value.slice(0, end);
        if (!field.length || field.length > variable[ai]) {
          out.notes.push(`Invalid GS1 field ${ai}; a separator may be missing.`);
          break;
        }
        fields[ai] = field;
        value = end === -1 ? '' : value.slice(end + 1);
      } else {
        out.notes.push(`Unsupported GS1 field ${ai}; remaining content was not interpreted.`);
        break;
      }
    }
  }
  for (const [ai, text] of Object.entries(fields)) {
    if (
      (fixed[ai] && text.length !== fixed[ai]) ||
      (variable[ai] && (!text.length || text.length > variable[ai]))
    ) {
      out.notes.push(`Invalid length for GS1 field ${ai}.`);
      continue;
    }
    if (ai === '01') {
      if (validGTIN(text)) out.gtin = text;
      else out.notes.push('GTIN check digit is invalid.');
    }
    if (ai === '10') out.batch = text;
    if (ai === '21') out.serial = text;
    if (ai === '17') {
      try {
        out.expiry = gs1Expiry(text);
        out.expiryPrecision = text.endsWith('00') ? 'month' : 'day';
      } catch {
        out.notes.push('Expiry field is not a valid date.');
      }
    }
  }
  return out;
}
export function parseDigitalLink(raw: string): GS1Result | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== '01' || !segments[1]) return null;
  const fields: Record<string, string> = {};
  for (let i = 0; i < segments.length; i += 2) {
    if (!segments[i + 1] || fields[segments[i]] !== undefined)
      return { notes: ['Malformed Digital Link path.'] };
    try {
      fields[segments[i]] = decodeURIComponent(segments[i + 1]);
    } catch {
      return { notes: ['Invalid URL encoding.'] };
    }
  }
  for (const ai of ['10', '17', '21']) {
    if (url.searchParams.getAll(ai).length > 1 || (fields[ai] && url.searchParams.has(ai)))
      return { notes: ['Repeated Digital Link field.'] };
    if (url.searchParams.has(ai)) fields[ai] = url.searchParams.get(ai)!;
  }
  // Parentheses inside a URL field must never be interpreted as extra AIs.
  if (Object.values(fields).some((v) => /[()\x1d]/.test(v)))
    return { notes: ['Unsupported characters in Digital Link field.'] };
  return parseGS1(
    Object.entries(fields)
      .map(([ai, v]) => `(${ai})${v}`)
      .join(''),
  );
}
