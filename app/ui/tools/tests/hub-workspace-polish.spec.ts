import { expect, test } from '@playwright/test';
import { openHub, reloadHub } from './hub-page.js';

// What stays here is geometry, scrolling, reload and the screenshots. Trade's and the team editor's
// state through actions and reopening is held in src/hub-polish.dom.test.ts.

test('Trade gives the ledger space and keeps the offer actions in view after reopening', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('trade'); await search.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Trade offers' })).toBeVisible();
  const fullyVisible = await page.locator('.trade-list').evaluate(list => {
    const box = list.getBoundingClientRect();
    return [...list.querySelectorAll('.trade-row')].filter(row => {
      const rect = row.getBoundingClientRect();
      return rect.top >= box.top && rect.bottom <= box.bottom;
    }).length;
  });
  expect(fullyVisible).toBeGreaterThanOrEqual(5);
  await page.getByRole('option', { name: /^Silver Wayfarer:/u }).click();
  await page.getByRole('button', { name: 'Close Trade Chat', exact: true }).click();
  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('button', { name: 'Whisper Silver Wayfarer', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('trade.png') });
});

test('team authoring prioritizes the roster and persists its edits across a reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHub(page);
  const search = page.locator('.hub-search input');
  await page.getByRole('button', { name: 'Close Hub', exact: true }).click(); await page.keyboard.press('Meta+b');
  await page.getByRole('button', { name: /Favourite GOM AFK/ }).click();
  const visibleSlots = await page.locator('.team-scroll').evaluate(list => {
    const box = list.getBoundingClientRect();
    return [...list.querySelectorAll('[data-team-slot]')].filter(row => {
      const rect = row.getBoundingClientRect();
      return rect.top >= box.top && rect.bottom <= box.bottom;
    }).length;
  });
  expect(visibleSlots).toBeGreaterThanOrEqual(3);
  await page.locator('.team-options > summary').click();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await page.locator('.team-options > summary').click();
  await page.getByRole('button', { name: 'Close Build Library', exact: true }).click();
  await page.keyboard.press('Meta+b');
  await page.screenshot({ path: info.outputPath('team-editor.png') });
  await reloadHub(page);
  await search.fill('team gom afk');
  await expect(page.locator('.hub-preview')).toContainText('Normal Mode');
});

for (const viewport of [{ width: 390, height: 650 }, { width: 640, height: 480 }]) {
  test(`team options remain reachable in a constrained Hub at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await openHub(page);
    await page.getByRole('button', { name: 'Close Hub', exact: true }).click(); await page.keyboard.press('Meta+b');
    await page.getByRole('button', { name: /Favourite GOM AFK/ }).click();
    await page.locator('.team-options > summary').click();
    await page.getByRole('button', { name: 'Normal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Apply team', exact: true })).toBeInViewport();
    const overflow = await page.locator('.hub-panel').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('team-options.png') });
  });
}
