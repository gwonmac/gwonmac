/**
 * Opens the Hub fixture page and returns once the Hub can take input. `page.goto` returns at the
 * page's load event, but the fixture imports the Hub after that, so a key pressed right away can
 * reach a page with no Hub yet. The fixture marks `#app[data-ready]` in the same task that opens
 * the Hub and focuses its search (src/hub-fixture.ts); the vitest harness waits for that same mark
 * (src/hub-fixture-harness.ts). ESLint keeps specs from opening or reloading the page any other way.
 */
import { expect, type Page } from '@playwright/test';

const ready = (page: Page) => expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');

/** Opens `/?hub<query>`, for example `openHub(page, '&party')`. */
export async function openHub(page: Page, query = '') {
  // eslint-disable-next-line no-restricted-syntax -- The one place a spec opens the Hub page.
  await page.goto(`/?hub${query}`);
  await ready(page);
}

/** Reloads the Hub page, keeping its query and localStorage, as a player restarting the game. */
export async function reloadHub(page: Page) {
  await page.reload();
  await ready(page);
}
