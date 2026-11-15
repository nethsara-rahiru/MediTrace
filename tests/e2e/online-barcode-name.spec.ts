import { test, expect, type Page } from './fixtures';
const endpoint = '**/rest/v1/catalog_products?*';
const code = '4006381333931';
const record = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'community',
  updated_at: '2026-11-15T00:00:00Z',
  product: {
    name: 'Syntheticbarcode',
    strength: '500mg',
    dosage_form: 'Tablet',
    pack_size: '10 tablets',
    manufacturer: 'Details hidden until confirmation',
    ingredients: [],
    barcodes: [code],
    source: 'Synthetic browser fixture only',
    verification: 'user_entered',
    verified_at: null,
  },
};
async function scan(page: Page) {
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Barcode or QR content', exact: true }).fill(code);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Is this your medicine?', { exact: true })).toBeVisible();
}
test('an online-only barcode supplies the identity first and reveals facts only after Yes', async ({
  page,
  context,
}) => {
  let calls = 0;
  await page.route(endpoint, (route) => {
    calls++;
    expect(decodeURIComponent(route.request().url())).toContain(code);
    return route.fulfill({ json: [record] });
  });
  await scan(page);
  await expect(page.getByText('Syntheticbarcode 500mg', { exact: true })).toBeVisible();
  await expect(page.getByText('Identity source: Online database', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveCount(0);
  await expect(page.getByText('Details hidden until confirmation', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    record.product.manufacturer,
  );
  await expect(
    page.getByText('Data source: Online database', { exact: true }).first(),
  ).toBeVisible();
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Barcode or QR content', exact: true }).fill(code);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Syntheticbarcode 500mg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    record.product.manufacturer,
  );
  await expect(
    page.getByText('Data source: Local database', { exact: true }).first(),
  ).toBeVisible();
});
test('rejecting an online barcode name keeps its details out of the manually corrected identity', async ({
  page,
}) => {
  await page.route(endpoint, (route) => route.fulfill({ json: [record] }));
  await scan(page);
  await expect(page.getByText('Syntheticbarcode 500mg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'No, incorrect medicine', exact: true }).click();
  await page.getByRole('button', { name: 'Enter medicine identity manually', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Medicine name', exact: true })
    .fill('Different packaging name');
  await page.getByRole('button', { name: 'Confirm entered medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue('');
  await expect(page.getByText('Online identity needs review', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue('');
});
