import { test, expect } from './fixtures.js';
const endpoint = '**/rest/v1/catalog_products?*';
const record = (manufacturer = 'Online manufacturer') => ({
  id: '11111111-1111-4111-8111-111111111111',
  status: 'community',
  updated_at: '2026-11-15T00:00:00Z',
  product: {
    name: 'Syntheticlookupmed',
    strength: '500mg',
    dosage_form: 'Tablet',
    manufacturer,
    ingredients: [{ name: 'Example compound', strength: '500mg' }],
    barcodes: ['ONLINE-LOOKUP-TEST'],
    source: 'Synthetic browser fixture only',
    verification: 'user_entered',
    verified_at: null,
  },
});
async function scan(page, raw) {
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Barcode or QR content', exact: true }).fill(raw);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Is this your medicine?', { exact: true })).toBeVisible();
}
test('local facts appear before a delayed background check and differences require explicit choice', async ({
  page,
}) => {
  await page.route(endpoint, (route) => route.fulfill({ json: [record('Local manufacturer')] }));
  await page.goto('/shared-catalog');
  await page.getByRole('button', { name: 'Download catalog updates', exact: true }).click();
  await expect(
    page.getByText('1 added · 0 refreshed · 0 withdrawn · 0 conflicts kept unchanged.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute(endpoint);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route(endpoint, async (route) => {
    calls++;
    await gate;
    await route.fulfill({ json: [record()] });
  });
  await scan(page, 'ONLINE-LOOKUP-TEST');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Local manufacturer',
  );
  await expect(page.getByText('Checking online in the background…', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Data source: Local database', { exact: true }).first(),
  ).toBeVisible();
  release();
  await expect(page.getByText('Online differences found', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Local manufacturer',
  );
  await page.getByRole('button', { name: 'Use online manufacturer', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Online manufacturer',
  );
  await expect(page.getByText('Data source: Online database', { exact: true })).toBeVisible();
  await expect(
    page.getByText('System checked · online catalog match', { exact: true }),
  ).toBeVisible();
});
test('online-only facts are labelled and cached for a future offline scan', async ({
  page,
  context,
}) => {
  await page.route(endpoint, (route) => route.fulfill({ json: [record()] }));
  await scan(page, 'Product: Syntheticlookupmed 500mg\nForm: Tablet');
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Online manufacturer',
  );
  await expect(
    page.getByText('Data source: Online database', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Status: User-entered — not independently verified/)).toBeVisible();
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Barcode or QR content', exact: true })
    .fill('ONLINE-LOOKUP-TEST');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Syntheticlookupmed 500mg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Online manufacturer',
  );
  await expect(
    page.getByText('Data source: Local database', { exact: true }).first(),
  ).toBeVisible();
});
test('unfinished field edits survive a background response', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await gate;
    await route.fulfill({ json: [record()] });
  });
  await scan(page, 'Product: Syntheticlookupmed 500mg\nForm: Tablet');
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Manufacturer', exact: true })
    .fill('Unfinished manual correction');
  release();
  await expect(
    page.getByText('System checked · online catalog match', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Unfinished manual correction',
  );
});
