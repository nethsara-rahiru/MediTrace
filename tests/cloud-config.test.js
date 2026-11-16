import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCatalogConfig } from '../src/cloud/config.js';
import { publicProject } from '../src/cloud/project.js';
test('a fresh app build uses the bundled public connection without an env file', () => {
  assert.deepEqual(resolveCatalogConfig(), publicProject);
  assert.deepEqual(resolveCatalogConfig('', ''), publicProject);
});
test('explicit build configuration can replace the complete project connection', () => {
  assert.deepEqual(resolveCatalogConfig(' https://testing.supabase.co ', ' sb_publishable_test '), {
    url: 'https://testing.supabase.co',
    key: 'sb_publishable_test',
  });
});
test('partial overrides never mix credentials from different projects', () => {
  assert.throws(() => resolveCatalogConfig('https://testing.supabase.co'), /Set both/);
  assert.throws(() => resolveCatalogConfig(undefined, 'sb_publishable_test'), /Set both/);
});
test('invalid hosts and secret keys cannot be used as client settings', () => {
  assert.throws(
    () => resolveCatalogConfig('http://testing.supabase.co', 'sb_publishable_test'),
    /Check/,
  );
  assert.throws(
    () => resolveCatalogConfig('https://testing.supabase.co', 'sb_secret_test'),
    /Check/,
  );
});
