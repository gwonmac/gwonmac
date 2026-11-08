import { expect, test } from '@playwright/test';
import type { HubFixtureWindow } from './fixture-window.js';
// The workbench page this spec drives sets the fixture hooks; they are required here.
declare const window: HubFixtureWindow;

const searchName = /^Search (?:people, places, builds|in .+)…$/u;

// Hub intent rules that a Node or vitest test can hold live in src/hub-intent.dom.test.ts and
// tests/unit/hub*.test.ts (coverage map: what Enter, a click or a typed scope runs, which row a
// page starts on, what a row says before Enter, what a page restores). This spec keeps what needs
// a real browser: placement across reloads, pixel geometry, CSS visibility, pointer hit-testing by
// coordinates, and native macOS editing.

test('native editing shortcuts from results return to the same search', { tag: '@macos' }, async ({ page }) => {
  await page.goto('/?hub');
  const search = page.locator('.hub-search input');
  await search.fill('build monk'); await search.press('ArrowDown');
  await page.keyboard.press('Meta+a'); await expect(search).toBeFocused();
  await page.keyboard.type('sw'); await expect(search).toHaveValue('sw');
  await search.press('ArrowDown'); await page.keyboard.type('itch');
  await expect(search).toHaveValue('switch');
});

test('Hub placement survives reload, stays locked, and resets durably', async ({ page }) => {
  await page.goto('/?hub');
  const panel = page.locator('.hub-panel');
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).press('Alt+ArrowRight');
  await page.getByRole('button', { name: 'Resize Hub', exact: true }).press('ArrowLeft');
  const placed = (await panel.boundingBox())!;
  await page.reload();
  const restored = (await panel.boundingBox())!;
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(restored[key] - placed[key])).toBeLessThanOrEqual(1);
  await expect(panel).toHaveAttribute('data-locked', 'true');
  await page.setViewportSize({ width: 360, height: 500 });
  await expect(page.getByRole('button', { name: 'Close Hub', exact: true })).toBeInViewport();
  const search = page.locator('.hub-search input');
  await search.fill('hub preferences'); await search.press('Enter');
  await page.getByRole('button', { name: 'Reset Hub position', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('gwonmac.hub-window-placement'))).toBeNull();
  await page.reload(); await expect(panel).not.toHaveAttribute('style', /transform: none/);
});

test('the phrase form stacks its label above its field', async ({ page }) => {
  await page.goto('/?hub');
  const search = page.locator('.hub-search input');
  await search.fill('team gom afk');
  await page.keyboard.press('Meta+j');
  await page.getByRole('menuitem', { name: /Set search phrase/ }).click();
  const phrase = page.getByRole('textbox', { name: 'Search phrase', exact: true });
  await expect(phrase).toBeFocused();
  const label = await page.locator('.hub-view label').boundingBox(); const field = await phrase.boundingBox();
  expect(label!.y + label!.height).toBeLessThanOrEqual(field!.y);
});

test('a task report takes the one status line from the lifecycle line while it shows', async ({ page }) => {
  await page.goto('/?hub&lifecycle=map-loading');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.hub-lifecycle')).toHaveText('Map loading — Travel returns when the map has loaded');
  const search = page.locator('.hub-search input');
  await search.fill('invite romi'); await search.press('Enter');
  await expect(page.locator('.hub-status')).toBeVisible();
  await expect(page.locator('.hub-lifecycle')).toBeHidden();
});

test('an invite receipt stands in the closed Hub\u2019s footprint, not over the window', async ({ page }) => {
  await page.goto('/?hub&party');
  const search = page.locator('.hub-search input');
  await search.fill('invite Mo Kai'); await search.press('Enter');
  await expect(page.locator('.hub-receipt')).toHaveText('Sent /invite Mo Kai. Guild Wars answers in chat.');
  const receipt = (await page.locator('.hub-receipt').boundingBox())!;
  await page.keyboard.press('Meta+r');
  const panel = (await page.locator('.hub-panel').boundingBox())!;
  expect(receipt.x).toBeGreaterThanOrEqual(panel.x);
  expect(receipt.x + receipt.width).toBeLessThanOrEqual(panel.x + panel.width);
  expect(receipt.y + receipt.height).toBeLessThanOrEqual(panel.y + panel.height);
});

test('a press on a disabled primary or blank panel space keeps the keyboard in search', async ({ page }) => {
  await page.goto('/?hub&party');
  const search = page.locator('.hub-search input');
  await search.fill('zed alpha'); await search.press('Enter');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'hub-result-2');
  await expect(page.locator('.hub-primary')).toBeDisabled();
  await page.locator('.hub-primary').click({ force: true });
  await expect(search).toBeFocused();
  await page.locator('.hub-count').click();
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-activedescendant', 'hub-result-2');
});

test.describe('Characters', () => {
  const card = (page: import('@playwright/test').Page, key: string) => page.locator(`button[data-character-key="${key}"]`);

  // HUB-009: the click that closes the Hub lands on the backdrop by its coordinates.
  test('a backdrop click closes Characters, and the next open focuses the current character', async ({ page }) => {
    await page.goto('/?hub');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+e');
    await expect(card(page, 'monk')).toBeFocused();
    await page.keyboard.type('toe');
    await expect(card(page, 'toefte')).toBeVisible();
    await page.mouse.click(20, 20); await page.clock.setFixedTime(new Date(await page.evaluate(() => Date.now()) + 90_001));
    await expect(page.locator('#hub')).toBeHidden();
    await page.keyboard.press('Meta+e');
    await expect(card(page, 'monk')).toBeFocused();
    await expect(card(page, 'monk')).toHaveAttribute('aria-current', 'true');
  });

  // D-30: the veil covers the game, so a click at the game's pixels never reaches it.
  test('a running switch keeps clicks from the game', async ({ page }) => {
    await page.goto('/?hub&switch-fail=selector-timeout&switch-ms=4000');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const search = page.locator('.hub-search input');
    await search.fill('char toefte'); await search.press('Enter');
    await expect(page.locator('.character-switch-veil')).toHaveText('Switching to Toefte…');
    await page.evaluate(() => window.gwFixtureCanvas.clear());
    await page.mouse.click(300, 300);
    expect(await page.evaluate(() => window.gwFixtureCanvas.events.filter(event => event.type !== 'keydown' && event.type !== 'keyup').length)).toBe(0);
  });

  // HUB-195, HUB-194: a search hides the number badges (an empty badge has no box) instead of drawing empty squares.
  test('a search hides the number badges instead of drawing empty squares', async ({ page }) => {
    await page.goto('/?hub&characters-extra');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+e');
    await page.keyboard.press('3');
    await expect(card(page, 'mesmer')).toBeFocused();
    const query = page.locator('#character-switch-query');
    await query.fill('toe');
    await expect(card(page, 'toefte').locator('.character-switch-key')).toBeHidden();
    await query.fill('');
    await card(page, 'mesmer').focus();
    await page.keyboard.press('End');
    const last = card(page, 'extra-5');
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await expect(last.locator('.character-switch-key')).toBeHidden();
    await expect(page.locator('.character-switch-key:empty:visible')).toHaveCount(0);
  });


  // HUB-076: a narrow Hub shows fewer, wider cards instead of five squeezed ones.
  test('a narrow Hub shows at most three cards, each at least 100 px wide', async ({ page }) => {
    for (const width of [340, 380, 420]) {
      await page.goto('/?hub');
      await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
      const grip = page.getByRole('button', { name: 'Resize Hub', exact: true });
      const corner = (await grip.boundingBox())!;
      const hub = (await page.locator('.hub-panel').boundingBox())!;
      await page.mouse.move(corner.x + 5, corner.y + 5);
      await page.mouse.down();
      await page.mouse.move(corner.x + 5 + width - hub.width, corner.y + 5 + 380 - hub.height, { steps: 4 });
      await page.mouse.up();
      await expect.poll(async () => (await page.locator('.hub-panel').boundingBox())?.width).toBe(width);
      await page.keyboard.press('Meta+e');
      await expect(card(page, 'monk')).toBeFocused();
      // The carousel may replace cards between evaluateAll's query and callback.
      const bounds = await page.evaluate(() => Array.from(document.querySelectorAll('#character-switch-list button[data-row]'), card => {
        const { left, right, top, bottom, width } = card.getBoundingClientRect();
        return { left, right, top, bottom, width };
      }));
      expect(bounds.length).toBeGreaterThan(0);
      expect(bounds.length).toBeLessThanOrEqual(3);
      for (const bound of bounds) expect(bound.width).toBeGreaterThanOrEqual(100);
      for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
        const a = bounds[i]!, b = bounds[j]!;
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
    }
  });

  // HUB-198: the cards sit within 48 px of the panel's bottom edge.
  test('Characters keeps its card band close to the panel bottom', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 396 });
    await page.goto('/?hub');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+e');
    await expect(page.locator('.hub-caption')).toHaveText('Characters');
    const band = await page.locator('.character-switch-panel').evaluate(panel => {
      const cards = panel.querySelector('.character-switch-carousel')!.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      return bounds.bottom - cards.bottom;
    });
    expect(band).toBeLessThanOrEqual(48);
  });
});

// D-5, HUB-003: a Travel digit selects its favourite; a held digit repeats nothing.
test('Travel keeps selection under a still pointer and changes it only on real movement (HUB-012)', async ({ page }) => {
  await page.goto('/?hub');
  await page.mouse.move(0, 0);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Meta+t');
  const search = page.locator('#travel-search-input');
  const eye = page.locator('#travel-favorite-4');
  await expect(search).toBeFocused();
  const box = await eye.boundingBox();
  if (!box) throw new Error('Expected a painted favourite');
  await page.mouse.move(box.x + 10, box.y + 10);
  await expect(search).toHaveAttribute('aria-activedescendant', 'travel-favorite-4');
  await search.press('Home');
  await expect(search).toHaveAttribute('aria-activedescendant', 'travel-recent-449');
  await page.mouse.wheel(0, 120);
  await page.mouse.move(box.x + 10, box.y + 10);
  await expect(search).toHaveAttribute('aria-activedescendant', 'travel-recent-449');
  await page.mouse.move(box.x + 11, box.y + 10);
  await expect(search).toHaveAttribute('aria-activedescendant', 'travel-favorite-4');
  await page.getByRole('button', { name: 'Close Hub', exact: true }).click();
  await page.mouse.move(box.x + 11, box.y + 10);
  await page.keyboard.press('Meta+t');
  await expect(search).toHaveAttribute('aria-activedescendant', 'travel-recent-449');
  await expect(page.locator('#app')).not.toHaveAttribute('data-action', /TRAVEL/);
  await search.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-action', 'TRAVEL Kamadan, Jewel of Istan');
  await expect(page.locator('#hub')).toBeHidden();
  for (const [query, deltaX, deltaY, selected, destination] of [
    ['', 250, 0, 'travel-recent-449', 'Kamadan, Jewel of Istan'],
    ['a', 0, 120, 'travel-map-109', 'The Amnoon Oasis'],
  ] as const) {
    await page.goto('/?hub');
    await page.mouse.move(0, 0);
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.press('Meta+t');
    await search.fill(query);
    const target = page.locator(query ? '.travel-result' : '.travel-recent').first();
    const bounds = (await target.boundingBox())!;
    await page.mouse.move(bounds.x + 10, bounds.y + 10);
    if (query) {
      const amnoon = await page.locator('.travel-result:not([disabled])').evaluateAll(rows => rows.findIndex(row => row.id === 'travel-map-109'));
      expect(amnoon).toBeGreaterThanOrEqual(0);
      await search.press('Home');
      for (let step = 0; step <= amnoon; step++) await search.press('ArrowDown');
    }
    await search.press(query ? 'ArrowUp' : 'ArrowLeft');
    await expect(search).toHaveAttribute('aria-activedescendant', selected);
    const scroller = page.locator(query ? '#travel-results-panel' : '.travel-history .travel-recent-grid');
    const before = await scroller.evaluate((element, horizontal) => horizontal ? element.scrollLeft : element.scrollTop, deltaX > 0);
    await page.mouse.wheel(deltaX, deltaY);
    await expect.poll(() => scroller.evaluate((element, horizontal) => horizontal ? element.scrollLeft : element.scrollTop, deltaX > 0)).toBeGreaterThan(before);
    await expect(search).toHaveAttribute('aria-activedescendant', selected);
    await expect(page.locator(`#${selected}`)).toHaveAttribute(query ? 'aria-selected' : 'data-active', 'true');
    await search.press('Enter');
    await expect(page.locator('#app')).toHaveAttribute('data-action', `TRAVEL ${destination}`);
    await expect(page.locator('#hub')).toBeHidden();
  }
});

test('Travel favourite arrows follow the painted columns and hold at the ends (HUB-069)', async ({ page }) => {
  await page.goto('/?hub');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Meta+t');
  const search = page.locator('#travel-search-input');
  await expect(search).toBeFocused();
  for (const [width, destination] of [[1280, 'travel-favorite-3'], [500, 'travel-favorite-2']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await search.press('1');
    await expect(search).toHaveAttribute('aria-activedescendant', 'travel-favorite-0');
    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', destination);
    await search.press('End');
    await expect(search).toHaveAttribute('aria-activedescendant', 'travel-favorite-5');
    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', 'travel-favorite-5');
    await search.press('Home');
    const first = await search.getAttribute('aria-activedescendant');
    await search.press('ArrowUp');
    await expect(search).toHaveAttribute('aria-activedescendant', first!);
    await expect(search).toBeFocused();
    await expect(page.locator('#app')).not.toHaveAttribute('data-action', /TRAVEL/);
  }
});

// HUB-130: a held Enter activates a surface control once; its repeats never toggle it back.
test('holding Enter on Trade\'s Save offer or Follow player toggles once', async ({ page }) => {
  await page.goto('/?hub');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+k');
  const trade = page.locator('#toolbox-trade .trade-window');
  await expect(trade).toBeVisible();
  await trade.locator('.trade-row', { hasText: 'Quiet Ember' }).locator('.offer-cell').click();
  const hold = async (name: string) => {
    await trade.locator('.offer-actions summary').click();
    await trade.getByRole('menuitemcheckbox', { name }).focus();
    for (let press = 0; press < 6; press++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await trade.locator('.offer-actions summary').click();
    await expect(trade.getByRole('menuitemcheckbox', { name })).toHaveAttribute('aria-checked', 'true');
    await trade.locator('.offer-actions summary').click();
  };
  await hold('Save offer');
  await expect(trade.locator('.saved-count')).toHaveText('1');
  await hold('Follow player');
  await expect(trade.locator('.saved-count')).toHaveText('2');
});

test('a stored place phrase resolves in Home, its travel scope and detailed Travel without moving its data (HUB-061)', async ({ page }) => {
  const stored = [{ id: 'place:194', phrase: 'home', pinned: true }];
  await page.addInitScript(value => localStorage.setItem('hub-fixture-shortcuts', JSON.stringify(value)), stored);
  await page.goto('/?hub');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const search = page.getByRole('combobox', { name: searchName });
  for (const query of ['home', 'travel home']) {
    await search.fill(query);
    await expect(page.locator('.hub-row[aria-selected="true"]')).toHaveAttribute('data-id', 'place:194');
    await expect(page.locator('.hub-primary')).toContainText('Travel to Kaineng Center');
  }
  await page.keyboard.press('Meta+t');
  const destination = page.getByRole('combobox', { name: 'Destination, phrase, or friend' });
  await destination.fill('home');
  await expect(destination).toHaveAttribute('aria-activedescendant', 'travel-map-194');
  await expect(page.locator('.hub-primary')).toContainText('Travel to Kaineng Center');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('hub-fixture-shortcuts')) ?? 'null')).toEqual(stored);
  await expect(page.locator('#app')).not.toHaveAttribute('data-action', /TRAVEL/);
});
