export function validGTIN(value: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3)
    sum += Number(value[i]) * weight;
  return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}
export function expandUPCE(value: string): string | null {
  if (!/^[01]\d{7}$/.test(value)) return null;
  const [n, a, b, c, d, e, f, check] = value.split('');
  let body: string;
  if ('012'.includes(f)) body = `${n}${a}${b}${f}0000${c}${d}${e}`;
  else if (f === '3') body = `${n}${a}${b}${c}00000${d}${e}`;
  else if (f === '4') body = `${n}${a}${b}${c}${d}00000${e}`;
  else body = `${n}${a}${b}${c}${d}${e}0000${f}`;
  const expanded = body + check;
  return validGTIN(expanded) ? expanded : null;
}
export function normalizeIdentifier(raw: string, format = 'manual'): string {
  const value = raw.trim();
  if (format === 'upc_e') {
    const expanded = expandUPCE(value);
    if (!expanded) throw new Error('The UPC-E identifier has an invalid structure or check digit.');
    return expanded.padStart(14, '0');
  }
  if (['ean13', 'ean8', 'upc_a'].includes(format) && !validGTIN(value))
    throw new Error('The barcode has an invalid length or check digit. Try scanning again.');
  if (validGTIN(value)) return value.padStart(14, '0');
  return value;
}
