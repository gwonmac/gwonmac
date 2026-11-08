import { expect, test, type Page } from '@playwright/test';
import { openHub, reloadHub } from './hub-page.js';

test('the smallest Hub keeps room for three results (HUB-238)', async ({ page }) => {
  await openHub(page);
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
  const corner = (await page.getByRole('button', { name: 'Resize Hub', exact: true }).boundingBox())!;
  await page.mouse.move(corner.x + 10, corner.y + 10);
  await page.mouse.down(); await page.mouse.move(corner.x - 1000, corner.y - 1000, { steps: 4 }); await page.mouse.up();
  const box = (await page.locator('.hub-panel').boundingBox())!;
  expect({ width: Math.round(box.width), height: Math.round(box.height) }).toEqual({ width: 340, height: 380 });
});

test('Hub has a locked frame, invisible corner hit area and bounded movable geometry', async ({ page }, info) => {
  await openHub(page);
  const panel = page.locator('.hub-panel');
  const head = page.locator('.hub-heading');
  const grip = page.getByRole('button', { name: 'Resize Hub', exact: true });
  const initial = (await panel.boundingBox())!;
  await expect(panel).toHaveAttribute('data-locked', 'true');
  await expect(grip).toBeHidden();
  const heading = (await head.boundingBox())!;
  await page.mouse.move(heading.x + heading.width / 2, heading.y + 12);
  await page.mouse.down(); await page.mouse.move(heading.x + heading.width / 2 + 60, heading.y + 45); await page.mouse.up();
  expect(await panel.boundingBox()).toEqual(initial);
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
  await expect(grip).toBeVisible();
  await page.mouse.move(heading.x + heading.width / 2, heading.y + 12);
  await page.mouse.down(); await page.mouse.move(heading.x + heading.width / 2 - 60, heading.y + 36); await page.mouse.up();
  expect((await panel.boundingBox())!.x).toBeCloseTo(initial.x - 60);
  const corner = (await grip.boundingBox())!;
  expect(corner.width).toBeGreaterThanOrEqual(32);
  await page.mouse.move(corner.x + 10, corner.y + 10);
  await page.mouse.down(); await page.mouse.move(corner.x - 40, corner.y - 40); await page.mouse.up();
  expect((await panel.boundingBox())!.width).toBeLessThan(initial.width);
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
  const placement = await panel.boundingBox();
  await expect(grip).toBeHidden();
  const search = page.locator('.hub-search input');
  await search.fill('maps'); await search.press('Enter');
  expect(await panel.boundingBox()).toEqual(placement);
  await expect(page.getByRole('navigation', { name: 'Hub breadcrumb' })).toContainText('Home');
  await page.screenshot({ path: info.outputPath('hub-maps-breadcrumb.png') });
});

for (const material of ['Guild Wars', 'Modern']) test(`floating Whispers paints one complete ${material} frame and preserves a draft across hide/show`, async ({ page }, info) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('settings'); await search.press('Enter');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.locator('[data-setting="uiStyle"] select').selectOption({ label: material });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await search.fill('whisper Romi'); await search.press('Enter');
  const panel = page.locator('#whisper-window');
  await expect(page.locator('#hub')).toBeHidden();
  await expect(panel.locator('.ui-window-lock')).toHaveCount(0);
  const draft = page.getByRole('textbox', { name: 'Message Romi Ranger', exact: true });
  await draft.fill('Keep this draft');
  await page.getByRole('button', { name: 'Hide Whispers' }).click();
  await page.keyboard.press('Meta+d');
  await expect(draft).toHaveValue('Keep this draft');
  const geometry = await panel.evaluate(element => {
    const head = element.querySelector('.whisper-frame-head')!;
    const title = head.querySelector('h2')!;
    const header = head.getBoundingClientRect(), label = title.getBoundingClientRect();
    const paint = getComputedStyle(element, '::before');
    return { boxSizing: getComputedStyle(element).boxSizing, fill: paint.backgroundColor, mask: paint.maskImage, z: paint.zIndex, delta: Math.abs((header.top + header.bottom - label.top - label.bottom) / 2) };
  });
  expect(geometry.boxSizing).toBe('border-box'); expect(geometry.fill).not.toBe('rgba(0, 0, 0, 0)'); expect(geometry.delta).toBeLessThan(2);
  expect(geometry.mask).toBe('none'); expect(Number(geometry.z)).toBeLessThan(0);
  await page.screenshot({ path: info.outputPath('whisper-floating.png') });
});

test('End in the Hub results scrolls the last result into view while search keeps focus (HUB-044)', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  const rows = page.locator('.hub-row');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  await search.press('End');
  await expect(rows.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
  await expect(rows.nth(count - 1)).toBeInViewport();
  await expect(search).toBeFocused();
  await search.fill('build smiter'); await search.press('Enter');
  await search.fill('hero'); await search.press('Enter');
  await expect(page.locator('.hub-caption')).toHaveText('Heroes');
  await search.press('End');
  await expect(page.locator('.hub-row[aria-selected="true"]')).toBeInViewport();
});

test('list keys without results keep the caret and the text selection in search', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('qqqzzz');
  await expect(page.locator('.hub-empty')).toBeVisible();
  for (const key of ['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'Control+n']) {
    await search.evaluate(input => (input as HTMLInputElement).setSelectionRange(1, 3));
    await search.press(key);
    expect(await search.evaluate(input => [(input as HTMLInputElement).selectionStart, (input as HTMLInputElement).selectionEnd]), key).toEqual([1, 3]);
  }
  await page.keyboard.press('Delete');
  await expect(search).toHaveValue('qzzz');
});

test('Backspace on a focused footer button edits the search and returns focus to it', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('kam'); await page.keyboard.press('Tab');
  await expect(page.locator('.hub-primary')).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('ka');
  await expect(page.locator('.hub-caption')).toHaveText('Home');
});

const selectedRow = (page: Page) => page.locator('#hub .hub-row[aria-selected="true"]');

test('Backspace on a selected pinned build only edits the search and keeps the pin (BLD-25)', async ({ page }) => {
  await openHub(page);
  await page.evaluate(() => localStorage.removeItem('hub-fixture-library'));
  const search = page.locator('.hub-search input');
  await search.fill('build smiter');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Pin to Hub' }).click();
  await reloadHub(page);
  await expect(search).toHaveValue('');
  const pinned = page.locator('#hub .hub-group', { hasText: 'Pinned' });
  await expect(pinned).toBeVisible();
  const pin = page.locator('#hub .hub-row[data-id="build:hub-smiter"]').first();
  await expect(pin).toBeVisible();
  await search.press('Home');
  await expect(selectedRow(page)).toHaveAttribute('data-id', 'build:hub-smiter');
  await search.press('Backspace');
  await expect(search).toHaveValue('');
  await expect(page.locator('.hub-breadcrumbs')).toHaveText('Home');
  await search.fill('s'); await search.press('Backspace');
  await expect(search).toHaveValue('');
  await expect(pinned).toBeVisible();
  await expect(pin).toBeVisible();
  await reloadHub(page);
  await expect(page.locator('#hub .hub-group', { hasText: 'Pinned' })).toBeVisible();
  await expect(page.locator('#hub .hub-row[data-id="build:hub-smiter"]').first()).toBeVisible();
});

test('Hub and Whispers restore bottom-right placement after shrinking without storage writes (HUB-109)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHub(page);
  await page.evaluate(() => {
    localStorage.setItem('gwonmac.hub-window-placement', JSON.stringify({ formatVersion: 1, left: 1, top: 1, width: 500 / 1264, height: 450 / 784 }));
    localStorage.setItem('gwonmac.whispers-window-placement', JSON.stringify({ formatVersion: 1, left: 1, top: 1, width: 350 / 1264, height: 400 / 784 }));
  });
  await reloadHub(page);
  await page.locator('.hub-search input').fill('whisper Romi'); await page.keyboard.press('Enter');
  await expect(page.locator('#whisper-window')).toBeVisible();
  await page.keyboard.press('Meta+r');
  const windows = page.locator('.hub-panel, #whisper-window');
  const geometry = () => windows.evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
  const storage = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await expect(windows).toHaveCount(2);
  const before = await geometry(); const saved = await storage();
  expect(before).toEqual([{ x: 772, y: 342, width: 500, height: 450 }, { x: 922, y: 392, width: 350, height: 400 }]);
  await page.setViewportSize({ width: 900, height: 600 });
  await expect(page.locator('.hub-panel')).toBeInViewport(); await expect(page.locator('#whisper-window')).toBeInViewport();
  expect(await storage()).toEqual(saved);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(geometry).toEqual(before);
  expect(await storage()).toEqual(saved);
});
