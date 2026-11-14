import { tokenValue } from './engine';
import { fieldKeys, type Extraction, type FieldKey, type TemplateRule } from './types';
export function validateRules(input: unknown): TemplateRule[] {
  if (!Array.isArray(input) || !input.length || input.length > fieldKeys.length)
    throw new Error('Invalid format rules.');
  const fields = new Set<string>();
  return input.map((rule) => {
    if (
      !rule ||
      typeof rule !== 'object' ||
      Object.keys(rule).some((k) => !['field', 'locator'].includes(k))
    )
      throw new Error('Invalid format rule.');
    const r = rule as Record<string, unknown>;
    if (
      typeof r.field !== 'string' ||
      !fieldKeys.includes(r.field as FieldKey) ||
      fields.has(r.field) ||
      typeof r.locator !== 'string' ||
      r.locator.length > 512 ||
      !/^(?:json|label|query|pattern):/.test(r.locator)
    )
      throw new Error('Unsafe format mapping.');
    fields.add(r.field);
    return { field: r.field as FieldKey, locator: r.locator };
  });
}
export function learnedRules(reviewed: Extraction): TemplateRule[] {
  if (!reviewed.signature) return [];
  const rules: TemplateRule[] = [];
  for (const key of fieldKeys) {
    const field = reviewed.fields[key];
    if (field.value === null || field.verification !== 'user_confirmed') continue;
    const candidates = reviewed.tokens.filter(
      (t) =>
        !/^(?:unmapped|line):/.test(t.locator) &&
        JSON.stringify(tokenValue(key, t.raw)) === JSON.stringify(field.value),
    );
    const explicit = field.locator
      ? candidates.filter((t) => t.locator === field.locator)
      : candidates;
    if (explicit.length === 1) rules.push({ field: key, locator: explicit[0].locator });
  }
  return rules.sort((a, b) => a.field.localeCompare(b.field));
}
