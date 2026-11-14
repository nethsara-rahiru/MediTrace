import { test, expect, type Page } from '@playwright/test';
const packageCheck = 'I checked the package details against the physical packaging.';
async function scan(page: Page, raw: string) {
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Barcode or QR content', exact: true }).fill(raw);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Is this your medicine?', { exact: true })).toBeVisible();
}
test('identity gate, corrections, package verification, persistence and repeated offline scans', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const raw =
    'Product: Examplemed 500mg\nIngredients: Example ingredient 500mg\nForm: Tablet\nManufacturer: Example Pharma Ltd\nAddress: Example Road\nBatch: SECRET-BATCH\nMFG: 01/2020\nEXP: 01/2021\nSerial: SERIAL-ONE';
  await scan(page, raw);
  await expect(page.getByRole('textbox', { name: 'Batch / lot number', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('SECRET-BATCH', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Expiry date', exact: true })).toHaveValue(
    '2021-01',
  );
  await expect(page.getByText('Expired · confirmed recorded date', { exact: true })).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Batch / lot number', exact: true })
    .fill('CORRECTED-BATCH');
  await expect(
    page.getByRole('button', { name: 'Save checked package locally', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Apply batch / lot number correction', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm manufacturer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Pack quantity', exact: true }).fill('2');
  await page.getByRole('checkbox', { name: packageCheck, exact: true }).click();
  await expect(page.getByText('Expired · confirmed recorded date', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save checked package locally', exact: true }).click();
  await expect(page.getByText('Saved medicine identification', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('CORRECTED-BATCH', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show original scan', exact: true }).click();
  await expect(page.getByText(raw, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Scan another package', exact: true }).click();
  await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Barcode or QR content', exact: true }).fill(raw);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Identify product', exact: true }).click();
  await expect(page.getByText('Is this your medicine?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await page.getByRole('button', { name: 'Use existing package details', exact: true }).click();
  await expect(
    page.getByText(
      'This serial is already recorded. Saving will link this scan to the existing entry without increasing its quantity.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: packageCheck, exact: true }).click();
  await page.getByRole('button', { name: 'Save checked package locally', exact: true }).click();
  await expect(page.getByText('Saved medicine identification', { exact: true })).toBeVisible();
  const savedReviewUrl = page.url();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'View saved medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Quantity *', exact: true })).toHaveValue('2');
  await expect(page.getByRole('textbox', { name: 'Serial number', exact: true })).toHaveValue(
    'SERIAL-ONE',
  );
  await page.getByRole('button', { name: 'Remove from my medicines', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(page.getByText('Your medicine cabinet starts here', { exact: true })).toBeVisible();
  await page.goto(savedReviewUrl);
  await expect(
    page.getByText(
      'The inventory entry was removed. This scan and its verification evidence are still available in history.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'View saved medicine', exact: true })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});
test('rejection clears the old product and manual corrections resolve ambiguous dates', async ({
  page,
}) => {
  await scan(
    page,
    'Product: Wrongmed 500mg\nIngredients: Rejected ingredient\nManufacturer: Rejected company\nBatch: AB1\nEXP: 01/02/2028',
  );
  await page.getByRole('button', { name: 'No, incorrect medicine', exact: true }).click();
  await page.getByRole('button', { name: 'Enter medicine identity manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Medicine name', exact: true }).fill('Correctedmed');
  await page.getByRole('textbox', { name: 'Medicine strength', exact: true }).fill('250mg');
  await page.getByRole('textbox', { name: 'Dosage form', exact: true }).fill('Capsule');
  await page.getByRole('button', { name: 'Confirm entered medicine', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Active ingredients', exact: true })).toHaveValue(
    '',
  );
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Expiry date', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Expiry date', exact: true }).fill('2028-02');
  await page.getByRole('button', { name: 'Apply expiry date correction', exact: true }).click();
  await page.getByRole('textbox', { name: 'Manufacturing date', exact: true }).fill('2029-03');
  await page
    .getByRole('button', { name: 'Apply manufacturing date correction', exact: true })
    .click();
  await page.getByRole('checkbox', { name: packageCheck, exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save checked package locally', exact: true }),
  ).toBeDisabled();
  await page.getByRole('textbox', { name: 'Manufacturing date', exact: true }).fill('2026-01');
  await page
    .getByRole('button', { name: 'Apply manufacturing date correction', exact: true })
    .click();
  await page.getByRole('checkbox', { name: packageCheck, exact: true }).click();
  await page.getByRole('button', { name: 'Save checked package locally', exact: true }).click();
  await expect(page.getByText('Saved medicine identification', { exact: true })).toBeVisible();
  await expect(page.getByText('Correctedmed 250mg', { exact: true })).toBeVisible();
});
test('missing-name sessions cannot bypass confirmation and support explicit field mapping on phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await scan(page, 'Batch: ONLY-BATCH\nMakerData: Example Company\nEXP: 2028-01');
  const identityUrl = page.url();
  const reviewUrl = identityUrl.replace('/identify/', '/review/');
  await page.goto(reviewUrl);
  await expect(page.getByText('Confirm medicine identity first', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Batch / lot number', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Confirm medicine identity', exact: true }).click();
  await page.getByRole('button', { name: 'Enter medicine identity manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Medicine name', exact: true }).fill('Manualmed');
  await page.getByRole('button', { name: 'Confirm entered medicine', exact: true }).click();
  await page
    .getByRole('button', { name: 'Choose scanned value for manufacturer', exact: true })
    .click();
  await page.getByRole('button', { name: 'MakerData Example Company', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Example Company',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Manufacturer', exact: true })).toHaveValue(
    'Example Company',
  );
});

test('unlabelled strength, address and code clues choose a name without exposing details early', async ({
  page,
}) => {
  const address = 'No. 22, Eastern Gardens, Central District, 20400';
  await scan(page, `AB12 CD34 EF56\n${address}\nExamplemed500mg`);
  await expect(page.getByText('Examplemed 500mg', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Manufacturer address', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Manufacturer address', exact: true }),
  ).toHaveValue(address);
  await expect(page.getByRole('textbox', { name: 'Batch / lot number', exact: true })).toHaveValue(
    'AB12 CD34 EF56',
  );
});

test('only the best name appears first and alternatives appear after rejection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await scan(page, 'Alphamed500mg\nBetamed250mg');
  await expect(
    page.getByText(
      'Is this the largest medicine name printed on the box? Check its spelling and strength against the packaging.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText('Alphamed 500mg', { exact: true })).toBeVisible();
  await expect(page.getByText(/Betamed/)).toBeHidden();
  await expect(page.getByText('Find the correct identity', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Search local medicines', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'No, incorrect medicine', exact: true }).click();
  await expect(page.getByText('Find the correct identity', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Betamed · 250mg Possible text identity', exact: true })
    .click();
  await expect(page.getByText('Betamed 250mg', { exact: true })).toBeVisible();
  await expect(page.getByText('Find the correct identity', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes, correct medicine', exact: true }).click();
  await expect(page.getByText('Review medicine details', { exact: true })).toBeVisible();
  await expect(page.getByText('Betamed 250mg', { exact: true })).toBeVisible();
});
