import { normalizeForm, normalizeName } from './text';
import type { Candidate, Extraction } from './types';
const normalizedStrength = (value: string | null) => value?.toLowerCase().replace(/\s/g, '') ?? '';
export function rankedSuggestions(extraction: Extraction): Candidate[] {
  return extraction.candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => b.candidate.score - a.candidate.score || a.index - b.index)
    .map((entry) => entry.candidate);
}
// Presentation chooses one proposal; it does not upgrade extraction confidence or
// assign a product in SQLite. The user must still compare and confirm it.
export function bestIdentitySuggestion(extraction: Extraction): Candidate | null {
  const ranked = rankedSuggestions(extraction);
  const identified =
    extraction.predictedProductId === null
      ? null
      : ranked.find((c) => c.productId === extraction.predictedProductId);
  if (identified) return identified;
  const name = extraction.fields.productName.value,
    strength = extraction.fields.strength.value,
    form = extraction.fields.dosageForm.value;
  if (name) {
    const compatible = ranked.find(
      (c) =>
        c.score >= 0.8 &&
        normalizeName(c.name) === normalizeName(name) &&
        (!strength || normalizedStrength(c.strength) === normalizedStrength(strength)) &&
        (!form || normalizeForm(c.dosageForm ?? '') === normalizeForm(form)),
    );
    if (compatible) return compatible;
    const literal = ranked.find(
      (c) =>
        c.productId === null &&
        normalizeName(c.name) === normalizeName(name) &&
        (!strength ||
          !c.strength ||
          normalizedStrength(c.strength) === normalizedStrength(strength)) &&
        (!form || !c.dosageForm || normalizeForm(c.dosageForm) === normalizeForm(form)),
    );
    return literal
      ? {
          ...literal,
          strength: strength ?? literal.strength,
          dosageForm: form ?? literal.dosageForm,
        }
      : {
          key: 'detected-identity',
          productId: null,
          name,
          strength,
          dosageForm: form,
          score: 0,
          reason: 'Identity extracted from packaging text',
        };
  }
  return ranked[0] ?? null;
}
export function otherIdentitySuggestions(
  extraction: Extraction,
  rejectedKeys: readonly string[],
): Candidate[] {
  const identityKey = (candidate: Candidate) =>
    `${normalizeName(candidate.name)}:${normalizedStrength(candidate.strength)}:${normalizeForm(candidate.dosageForm ?? '')}`;
  const rejectedNames = new Set(
    extraction.candidates
      .filter((c) => c.productId === null && rejectedKeys.includes(c.key))
      .map(identityKey),
  );
  const unique = new Set<string>();
  return rankedSuggestions(extraction).filter((candidate) => {
    if (
      rejectedKeys.includes(candidate.key) ||
      (candidate.productId === null && rejectedNames.has(identityKey(candidate)))
    )
      return false;
    const key =
      candidate.productId !== null
        ? `product:${candidate.productId}`
        : `text:${normalizeName(candidate.name)}:${normalizedStrength(candidate.strength)}:${normalizeForm(candidate.dosageForm ?? '')}`;
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  });
}
