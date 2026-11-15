import { test, expect } from './fixtures';
const rpc = '**/rest/v1/rpc/publish_catalog_product';
async function addProduct(page: import('@playwright/test').Page, name: string) {
  await page.goto('/add-product');
  await page.getByRole('textbox', { name: 'Brand / product name *', exact: true }).fill(name);
  await page
    .getByRole('textbox', { name: 'Product identifiers', exact: true })
    .fill('TEST-COMMUNITY-ONLY');
  await page
    .getByRole('textbox', { name: 'Information source *', exact: true })
    .fill('Synthetic browser fixture only');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
}
test('saving and editing a product writes online with the same publication identity', async ({
  page,
}) => {
  const posts: any[] = [];
  await page.route(rpc, async (route) => {
    const body = route.request().postDataJSON();
    posts.push(body);
    await route.fulfill({ json: body.p_id });
  });
  await addProduct(page, 'Synthetic share product');
  await expect(
    page
      .getByText(
        'Saved on this device and in the shared online catalog. Shared information is labelled user-entered.',
        { exact: true },
      )
      .last(),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0].p_product.verification).toBe('user_entered');
  expect(posts[0].p_product).not.toHaveProperty('batch');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Brand / product name *', exact: true })
    .fill('Corrected synthetic share product');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page
      .getByText(
        'Saved on this device and in the shared online catalog. Shared information is labelled user-entered.',
        { exact: true },
      )
      .last(),
  ).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1].p_id).toBe(posts[0].p_id);
  expect(posts[1].p_write_token).toBe(posts[0].p_write_token);
  expect(posts[1].p_product.name).toBe('Corrected synthetic share product');
});
test('an offline save persists across reload and retries online without duplicating products', async ({
  page,
}) => {
  await page.route(rpc, (route) => route.abort('internetdisconnected'));
  await addProduct(page, 'Synthetic offline share product');
  await expect(page.getByText(/Saved on this device. Online save pending/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Saved on this device. Online save pending/)).toBeVisible();
  await page.unroute(rpc);
  await page.route(rpc, (route) => route.fulfill({ json: route.request().postDataJSON().p_id }));
  await page.getByRole('button', { name: 'Manage online saves', exact: true }).click();
  await page.getByRole('button', { name: 'Retry online saves', exact: true }).click();
  await expect(page.getByText('0 waiting to upload', { exact: true })).toBeVisible();
  await page.goto('/library');
  await expect(
    page.getByRole('button', { name: /^View Synthetic offline share product\s*$/, exact: true }),
  ).toHaveCount(1);
});

test('shared catalog exposes connection and recovery controls without requiring new products', async ({
  page,
}) => {
  await page.goto('/shared-catalog');
  await expect(page.getByRole('button', { name: 'Retry online saves', exact: true })).toBeEnabled();
  await expect(page.getByText(/Connected project:/)).toBeVisible();
  await page.getByRole('button', { name: 'Queue existing local products', exact: true }).click();
  await expect(
    page.getByText(
      '0 local products queued · 0 online saves completed. Any remaining saves stay queued.',
      { exact: true },
    ),
  ).toBeVisible();
});
