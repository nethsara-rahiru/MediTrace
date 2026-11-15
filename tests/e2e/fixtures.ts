import { test as base } from '@playwright/test';
// Never let browser fixtures publish synthetic medicine data to a real project.
// Individual tests can override this route with a local response explicitly.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://*.supabase.co/**', (route) => route.abort('blockedbyclient'));
    await use(page);
  },
});
export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
