import { expect, test, type Page } from '@playwright/test';
import { timeBudget } from './performance-budget.js';
import type { HubFixtureWindow } from './fixture-window.js';
// The workbench page this spec drives sets the fixture hooks; they are required here.
declare const window: HubFixtureWindow;

/**
 * What stays in a real browser of the Hub's page-session rules (HUB-004, HUB-016, HUB-083,
 * HUB-035): the running apply's progress bar painted by CSS, and the 100 ms reopening budget
 * while an account action is still running. The rules themselves (the footer and the status
 * line name the running action, late completions never close, navigate or wipe a newer page,
 * late failures become receipts) run in Node and vitest: tests/unit/hub-engine.test.ts,
 * hub-status.test.ts, hub-results.test.ts and src/hub-session.dom.test.ts.
 * `?slow-apply` lands each fixture command after half a second on the real confirmation clock.
 */
const search = (page: Page) => page.locator('.hub-search input');
const hub = (page: Page) => page.getByRole('dialog', { name: /^Hub(?: — .+)?$/u });
const status = (page: Page) => page.locator('.hub-status');
const primary = (page: Page) => page.locator('.hub-primary');

async function open(page: Page, query: string) {
  await page.goto(`/?hub${query}`);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => { localStorage.removeItem('hub-fixture-library'); window.gwFixtureCanvas.clear(); });
}
async function enter(page: Page, query: string) { await search(page).fill(query); await search(page).press('Enter'); }

test('a long team apply paints its progress bar (BLD-02)', async ({ page }) => {
  await open(page, '&slow-apply');
  await enter(page, 'team gom afk');
  await expect(page.locator('.hub-progress')).toHaveCSS('opacity', '1');
});

test('reopening the Hub while an account action still runs meets the 100 ms budget (HUB-004)', { tag: '@macos' }, async ({ page }) => {
  await open(page, '&accounts-ms=1500');
  // Control the external account completion: reopening must beat it, not merely wait for it.
  await page.evaluate(() => {
    const original = window.gwNative.accounts.open;
    window.gwNative.accounts.open = async request => {
      await new Promise<void>(resolve => { window.addEventListener('finish-account', () => resolve(), { once: true }); });
      return original(request);
    };
  });
  await enter(page, 'acc s'); await primary(page).click();
  await expect(status(page)).toHaveText('Opening Second…');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(hub(page)).toBeHidden();
  await page.keyboard.press('Meta+r');
  await search(page).fill('travel');
  // Measure in the renderer; Playwright transport/locator polling is outside the 100 ms contract.
  const elapsed = await search(page).evaluate(async input => {
    const start = performance.now();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    while (document.querySelector('.hub-caption')?.textContent !== 'Travel') await new Promise(requestAnimationFrame);
    return performance.now() - start;
  });
  expect(elapsed).toBeLessThanOrEqual(timeBudget(100));
});
