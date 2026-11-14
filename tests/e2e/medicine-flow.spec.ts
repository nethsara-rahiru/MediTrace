import { test, expect } from '@playwright/test';
// Synthetic, isolated browser records. Never imported into the catalog.
test('register, scan, inventory, expiry and persistence work through SQLite', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('A healthier habit starts here.')).toBeVisible();
  await page.getByRole('button', { name: 'Add a product', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Brand / product name *', exact: true })
    .fill('Test Package Alpha');
  await page.getByRole('textbox', { name: 'Generic name', exact: true }).fill('Example ingredient');
  await page.getByRole('textbox', { name: 'Product strength', exact: true }).fill('1 test unit');
  await page
    .getByRole('textbox', { name: 'Product identifiers', exact: true })
    .fill('TEST-PACK-ALPHA');
  await page.getByRole('textbox', { name: 'Ingredient 1', exact: true }).fill('Example ingredient');
  await page
    .getByRole('textbox', { name: 'Amount / concentration', exact: true })
    .fill('1 test unit');
  await page
    .getByRole('textbox', { name: 'Information source *', exact: true })
    .fill('Synthetic browser test; not a medicine record');
  await page.getByRole('button', { name: 'Save product locally', exact: true }).click();
  await expect(
    page.getByText('User-entered · not independently verified', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add to my medicines', exact: true }).click();
  await page.getByRole('textbox', { name: 'Quantity *', exact: true }).fill('12');
  await page.getByRole('textbox', { name: 'Unit *', exact: true }).fill('test units');
  await page.getByRole('textbox', { name: 'Batch / lot number', exact: true }).fill('TEST-BATCH');
  await page.getByRole('textbox', { name: 'Expiry date', exact: true }).fill('2020-02');
  await page.getByRole('button', { name: 'Add medicine locally', exact: true }).click();
  await expect(page.getByText('Expired', { exact: true }).last()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Test Package Alpha', { exact: true })).toBeVisible();
  await expect(page.getByText('12 test units', { exact: false })).toBeVisible();
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Barcode or QR content', exact: true })
    .fill('TEST-PACK-ALPHA');
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Is this your medicine?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByText('Review medicine details', { exact: true })).toBeVisible();
  await expect(page.getByText('Test Package Alpha', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Scan another package', exact: true }).click();
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Barcode or QR content', exact: true })
    .fill('UNKNOWN-TEST-PACK');
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(
    page.getByText(
      'We could not identify this medicine automatically. Please enter the medicine name printed on the packaging.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto('/history');
  await expect(page.getByText('UNKNOWN-TEST-PACK', { exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search scan history', exact: true })
    .fill('TEST-PACK-ALPHA');
  await expect(page.getByText('Test Package Alpha', { exact: true })).toBeVisible();
  await expect(page.getByText('UNKNOWN-TEST-PACK', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('mobile navigation and manual scanning remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('A healthier habit starts here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByText('Build your medicine library', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Barcode or QR content', exact: true })
    .fill('https://example.com/unknown');
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(
    page.getByText(
      'We could not identify this medicine automatically. Please enter the medicine name printed on the packaging.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Register this product', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
