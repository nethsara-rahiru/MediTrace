import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validGTIN, normalizeIdentifier, expandUPCE } from '../src/domain/identifiers';
import { parseGS1, parseDigitalLink } from '../src/domain/gs1';
import { decodeScan } from '../src/domain/scan';
// Standards examples only. These identifiers are not assigned to medicine records.
test('GTIN check digits and leading-zero equivalents', () => {
  assert.ok(validGTIN('4006381333931'));
  assert.ok(!validGTIN('4006381333932'));
  assert.equal(normalizeIdentifier('4006381333931'), '04006381333931');
  assert.equal(normalizeIdentifier('036000291452'), normalizeIdentifier('0036000291452'));
  assert.throws(() => normalizeIdentifier('123', 'ean13'));
});
test('UPC-E expands without losing number system or check digit', () => {
  assert.equal(expandUPCE('04210007'), '042000001007');
  assert.equal(normalizeIdentifier('04210007', 'upc_e'), '00042000001007');
  assert.equal(expandUPCE('04210008'), null);
});
test('GS1 parses variable fields separated by ASCII GS', () => {
  const r = parseGS1(']d201040063813339311727113010LOT42\x1d21SERIAL7');
  assert.equal(r.gtin, '04006381333931');
  assert.equal(r.batch, 'LOT42');
  assert.equal(r.expiry, '2027-11-30');
  assert.equal(r.serial, 'SERIAL7');
  assert.deepEqual(r.notes, []);
});
test('GS1 stops at unsupported or malformed fields', () => {
  assert.ok(parseGS1('(01)04006381333932').notes.length);
  assert.ok(parseGS1(']d2010400638133393110ABCDEFGHIJKLMNOPQRSTUV').notes.length);
  assert.ok(parseGS1('(01)04006381333931(01)04006381333931').notes.length);
});
test('Digital Link extraction never opens a URL', () => {
  const r = parseDigitalLink('https://id.example/01/04006381333931/10/LOT1?17=271100&21=S1');
  assert.equal(r?.expiry, '2027-11-30');
  assert.equal(r?.expiryPrecision, 'month');
  assert.equal(r?.batch, 'LOT1');
  assert.equal(decodeScan('https://example.com', 'qr').identifier, null);
  assert.equal(parseDigitalLink('https://id.example/01/04006381333931?10=A&10=B')?.gtin, undefined);
});
test('ordinary DataMatrix and Code 128 are not assumed to be GS1', () => {
  assert.equal(decodeScan('010400638133393117271130', 'datamatrix').kind, 'product');
  assert.equal(decodeScan('PRIVATE-PACK-1', 'code128').identifier, 'PRIVATE-PACK-1');
});
