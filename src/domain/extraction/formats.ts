import type { Token } from './types';
import { tokenKind } from './text';
export type Tokenized = {
  kind: 'json' | 'labelled' | 'text' | 'url' | 'unsupported';
  tokens: Token[];
  signature: string | null;
  issues: string[];
};
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
function assertUniqueJsonKeys(text: string) {
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') stack.push(new Set());
    else if (c === '[') stack.push(null);
    else if (c === '}' || c === ']') stack.pop();
    else if (c === '"') {
      let end = i + 1;
      while (end < text.length) {
        if (text[end] === '\\') {
          end += 2;
          continue;
        }
        if (text[end] === '"') break;
        end++;
      }
      let next = end + 1;
      while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      if (text[next] === ':') {
        const key = JSON.parse(text.slice(i, end + 1)) as string,
          seen = stack.at(-1);
        if (seen?.has(key)) throw new Error('Duplicate JSON fields need manual review.');
        seen?.add(key);
      }
      i = end;
    }
  }
}
export function tokenize(raw: string): Tokenized {
  const out: Tokenized = { kind: 'text', tokens: [], signature: null, issues: [] };
  const value = raw.trim();
  if (!value || value.length > 4096) {
    out.kind = 'unsupported';
    out.issues.push(
      'Empty or oversized content. Scan again or enter the medicine identity manually.',
    );
    return out;
  }
  let signaturePrefix = 'text';
  function add(locator: string, label: string, text: string, kind?: string) {
    if (out.tokens.length >= 40) throw new Error('Too many fields in scanned content.');
    if (text.length > 2048) throw new Error('An individual scanned field is too long.');
    out.tokens.push({ locator, label, raw: text, kind: kind ?? tokenKind(text) });
  }
  try {
    if (value.startsWith('{') || value.startsWith('[')) {
      out.kind = 'json';
      signaturePrefix = 'json';
      const parsed: unknown = JSON.parse(value);
      assertUniqueJsonKeys(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Use a JSON object containing product fields.');
      function walk(node: Record<string, unknown>, prefix: string, depth: number) {
        if (depth > 4) throw new Error('JSON nesting is too deep.');
        for (const [key, item] of Object.entries(node)) {
          if (forbidden.has(key)) throw new Error('Unsafe JSON key was rejected.');
          const path = prefix ? `${prefix}.${key}` : key;
          if (key.length > 80) throw new Error('JSON field name is too long.');
          if (typeof item === 'string' || typeof item === 'number')
            add(`json:${path}`, path, String(item));
          else if (Array.isArray(item)) {
            if (item.length > 30 || JSON.stringify(item).length > 2048)
              throw new Error('JSON array is too large.');
            if (
              JSON.stringify(item).includes('"__proto__"') ||
              JSON.stringify(item).includes('"constructor"') ||
              JSON.stringify(item).includes('"prototype"')
            )
              throw new Error('Unsafe JSON key was rejected.');
            add(`json:${path}`, path, JSON.stringify(item), 'array');
          } else if (item && typeof item === 'object')
            walk(item as Record<string, unknown>, path, depth + 1);
          else if (typeof item === 'boolean') add(`json:${path}`, path, String(item), 'boolean');
          else if (item !== null && item !== undefined) throw new Error('Unsupported JSON value.');
        }
      }
      walk(parsed as Record<string, unknown>, '', 0);
    } else if (/^[a-z][a-z0-9+.-]*:\/\/|^(?:javascript|data|file|mailto|tel):/i.test(value)) {
      const url = new URL(value);
      out.kind = 'url';
      signaturePrefix = `url:${url.protocol}//${url.host}${url.pathname}`;
      if (!['http:', 'https:'].includes(url.protocol)) {
        out.issues.push('Unsupported URL scheme. No scanned content was executed.');
        return out;
      }
      out.issues.push(
        'The website was not opened. Only explicitly encoded fields can be read offline.',
      );
      for (const [key, text] of url.searchParams) add(`query:${key}`, key, text);
    } else {
      const lines = value
        .split(/[\n\r;|]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const labelled = lines.map(
        (line) =>
          /^([\p{L}][\p{L}\p{N} _./()-]{0,60})\s*[:=]\s*(.+)$/u.exec(line) ??
          /^(Product(?: Name)?|Medicine(?: Name)?|Brand(?: Name)?|Active Ingredients?|Ingredients?|Batch(?: No\.?| Number)?|Lot(?: No\.?| Number)?|MFG(?: Date)?|EXP(?: Date)?|Expiry(?: Date)?|Manufacturing Date|Manufacturer Address|Manufacturer|Manufactured By|Strength|Dosage Form|GTIN|Serial(?: Number| No\.?)?)\s+(.+)$/i.exec(
            line,
          ),
      );
      out.kind = labelled.some(Boolean) ? 'labelled' : 'text';
      signaturePrefix = out.kind;
      for (let i = 0; i < lines.length; i++) {
        const match = labelled[i];
        if (match)
          add(
            `label:${match[1].trim().toLowerCase().replace(/\s+/g, ' ')}`,
            match[1].trim(),
            match[2].trim(),
          );
        else add(`line:${i}`, 'Unlabelled text', lines[i]);
      }
    }
    const locators = out.tokens.map((t) => t.locator);
    if (new Set(locators).size !== locators.length) {
      out.issues.push('Repeated field labels need review.');
      return out;
    }
    // Line numbers are never learned: only a unique pattern category can be reused.
    for (const token of out.tokens.filter((t) => t.locator.startsWith('line:'))) {
      const same = out.tokens.filter((t) => t.locator.startsWith('line:') && t.kind === token.kind);
      token.locator = same.length === 1 ? `pattern:${token.kind}` : `unmapped:${token.locator}`;
    }
    if (out.tokens.length)
      out.signature = `v1:${signaturePrefix}|${out.tokens
        .map((t) => `${t.locator}:${t.kind}`)
        .sort()
        .join('|')}`;
  } catch (e) {
    out.kind = 'unsupported';
    out.tokens = [];
    out.signature = null;
    out.issues.push((e as Error).message);
  }
  return out;
}
