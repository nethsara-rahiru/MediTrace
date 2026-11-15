import { test, expect } from './fixtures';
const endpoint = '**/rest/v1/catalog_products?*';
const record = {
  id: '11111111-1111-4111-8111-111111111111',
  updated_at: '2026-11-15T00:00:00Z',
  status: 'approved',
  product: {
    name: 'Syntheticcloudmed',
    strength: '1 test unit',
    source: 'Synthetic browser test fixture only',
    verified_at: '2026-11-15',
    verification: 'source_checked',
    ingredients: [{ name: 'Example ingredient', strength: '1 test unit' }],
    barcodes: ['CLOUD-TEST-ONLY'],
  },
};
test('shared catalog downloads persist in SQLite and scan without a network', async ({
  page,
  context,
}) => {
  await page.route(endpoint, (route) => route.fulfill({ json: [record] }));
  await page.goto('/library');
  await page.getByRole('button', { name: 'Shared catalog', exact: true }).click();
  await expect(
    page.getByText('Your offline library stays with you', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Download catalog updates', exact: true }).click();
  await expect(
    page.getByText('1 added · 0 refreshed · 0 withdrawn · 0 conflicts kept unchanged.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Last successful download:/)).not.toContainText('Not downloaded yet');
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Barcode or QR content', exact: true })
    .fill('CLOUD-TEST-ONLY');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Syntheticcloudmed 1 test unit', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Yes, correct medicine', exact: true }),
  ).toBeVisible();
});
test('missing cloud setup is explained and empty catalogs report success honestly', async ({
  page,
}) => {
  await page.route(endpoint, (route) => route.fulfill({ status: 404, json: { code: 'PGRST205' } }));
  await page.goto('/shared-catalog');
  await page.getByRole('button', { name: 'Download catalog updates', exact: true }).click();
  await expect(page.getByText(/The shared catalog needs setup/)).toBeVisible();
  await page.unroute(endpoint);
  await page.route(endpoint, (route) => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Download catalog updates', exact: true }).click();
  await expect(
    page.getByText('0 added · 0 refreshed · 0 withdrawn · 0 conflicts kept unchanged.', {
      exact: true,
    }),
  ).toBeVisible();
});
