import { expect, test } from '@playwright/test';
import type { HubFixtureWindow } from './fixture-window.js';
// The workbench page this spec drives sets the fixture hooks; they are required here.
declare const window: HubFixtureWindow;

test('only Hub locks, reset restores its default frame, and popouts have visible plain X controls', async ({ page }) => {
  await page.goto('/?hub');
  const panel = page.locator('.hub-panel');
  const initial = await panel.boundingBox();
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).press('Alt+ArrowLeft');
  await page.getByRole('button', { name: 'Resize Hub', exact: true }).press('ArrowLeft');
  expect(await panel.boundingBox()).not.toEqual(initial);
  const search = page.locator('.hub-search input');
  await search.fill('hub preferences'); await search.press('Enter');
  await page.getByRole('button', { name: 'Reset Hub position', exact: true }).click();
  expect(await panel.boundingBox()).toEqual(initial);
  await expect(panel).toHaveAttribute('data-locked', 'true');
  await page.getByRole('button', { name: 'Close Hub', exact: true }).click();
  for (const [shortcut, selector, close] of [['Meta+b', '.tools-window', 'Close Build Library'], ['Meta+k', '.trade-window', 'Close Trade Chat'], ['Meta+d', '#whisper-window', 'Hide Whispers']]) {
    await page.keyboard.press(shortcut!);
    const popup = page.locator(selector!);
    await expect(popup).toBeVisible();
    await expect(popup.locator('.ui-window-lock')).toHaveCount(0);
    const x = popup.getByRole('button', { name: close!, exact: true });
    await expect(x).toHaveText('×');
    expect(await x.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20);
    await expect(x).toBeInViewport();
    const before = (await popup.boundingBox())!;
    const head = (await popup.locator('.ui-window-head').boundingBox())!;
    await page.mouse.move(head.x + 30, head.y + head.height / 2);
    await page.mouse.down(); await page.mouse.move(head.x + 60, head.y + head.height / 2 + 20); await page.mouse.up();
    expect((await popup.boundingBox())!.x).toBeCloseTo(before.x + 30);
    await x.click(); await expect(popup).toBeHidden();
  }
});

for (const viewport of [{ width: 320, height: 800 }, { width: 640, height: 500 }]) {
  test(`build comparison remains usable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto('/?hub');
    const search = page.locator('.hub-search input');
    await search.fill('build monk'); await search.press('ArrowRight');
    const summary = page.locator('.hub-summary');
    await expect(summary.getByRole('img').last()).toBeInViewport();
    const current = page.locator('#hub').getByRole('option', { name: /Apply to me/ });
    await current.getByRole('img').last().scrollIntoViewIfNeeded();
    await expect(current.getByRole('img').last()).toBeInViewport();
    await expect(page.getByRole('button', { name: /^Apply .+ to Fixture Monk ↵$/ })).toBeInViewport();
    expect(await page.locator('.hub-results').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('hub-comparison-compact.png') });
  });
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 800 }]) {
  test(`compact build results keep their last skill in view without overflow at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto('/?hub');
    const search = page.locator('.hub-search input');
    await search.fill('build monk');
    const rows = page.locator('.hub-build-row');
    await expect(rows).toHaveCount(4);
    await expect.poll(() => rows.first().locator('.hub-professions img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 48))).toBe(true);
    await expect(rows.first().locator('.hub-skill').last()).toBeInViewport();
    expect(await page.locator('.hub-results').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('hub-compact-builds.png') });
  });
}

test('a folder-qualified build keeps its path label inside its row at 320px', async ({ page }, info) => {
  await page.goto('/?hub');
  await page.getByRole('button', { name: 'Close Hub', exact: true }).click();
  await page.getByLabel('Fixture scenario', { exact: true }).selectOption('folders');
  const search = page.locator('.hub-search input');
  await search.fill('build folder:"Team Builds/Farming" mo');
  await expect(page.locator('.hub-build-row')).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.locator('.hub-results').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const folder = (await page.locator('.hub-build-row .hub-folder-label').boundingBox())!;
  const row = (await page.locator('.hub-build-row').boundingBox())!;
  expect(folder.x + folder.width).toBeLessThanOrEqual(row.x + row.width);
  expect(folder.y + folder.height).toBeLessThanOrEqual(row.y + row.height);
  await page.screenshot({ path: info.outputPath('hub-folder-search.png') });
});

test('a blocked hero row inks its title like its detail', async ({ page }) => {
  await page.goto('/?hub');
  await page.getByRole('button', { name: 'Close Hub', exact: true }).click();
  await page.getByLabel('Fixture scenario', { exact: true }).selectOption('mixed-professions');
  const search = page.locator('.hub-search input');
  await search.fill('build monk'); await search.press('Enter');
  await search.fill('hero'); await search.press('Enter');
  const blocked = page.locator('.hub-row').filter({ hasText: "Gwen's assigned build is for Monk, but the observed primary is Mesmer." });
  const ink = await blocked.evaluate(row => ({ title: getComputedStyle(row.querySelector('.hub-title')!).color, detail: getComputedStyle(row.querySelector('.hub-detail')!).color }));
  expect(ink.title).toBe(ink.detail);
});

test('self application has one comparison page and Right never adds another', async ({ page }) => {
  await page.goto('/?hub');
  const search = page.locator('.hub-search input');
  await search.fill('build monk'); await search.press('ArrowRight');
  const crumbs = page.locator('.hub-breadcrumbs');
  await search.press('ArrowRight');
  await expect(crumbs).toHaveText('Home›Protection');
  await expect(page.locator('#app')).not.toHaveAttribute('data-action', /command|apply/u);
});

test('the team-apply receipt is a top-layer popover that reads and lets clicks through', async ({ page }) => {
  await page.setViewportSize({ width: 940, height: 500 });
  await page.goto('/?hub');
  const search = page.locator('.hub-search input');
  await search.fill('team gom afk'); await search.press('ArrowRight');
  await expect(page.locator('.hub-review-roster .hub-skill-bar').first()).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Apply team GOM AFK ↵', exact: true }).click();
  await expect(page.locator('#hub')).toBeHidden();
  await page.getByRole('button', { name: 'Open Hub', exact: true }).click();
  await search.fill('team gom afk');
  await search.press('Enter');
  const receipt = page.locator('.hub-receipt');
  await expect(receipt).toBeVisible();
  expect(await receipt.evaluate(el => getComputedStyle(el).fontFamily)).toBe(await search.evaluate(el => getComputedStyle(el).fontFamily));
  expect(await receipt.evaluate(el => el.matches(':popover-open'))).toBe(true);
  for (const style of ['guild-wars', 'obsidian'] as const) {
    for (const font of ['guild-wars', 'inter', 'system', 'avenir', 'georgia', 'palatino'] as const) {
      await page.evaluate(({ style, font }) => window.gwApplyFixtureAppearance({ uiStyle: style, uiFont: font, uiPanelOpacity: 65 }), { style, font });
      expect(await receipt.evaluate(el => getComputedStyle(el).fontFamily)).toBe(await search.evaluate(el => getComputedStyle(el).fontFamily));
      const ratio = await receipt.evaluate(el => {
        const context = document.createElement('canvas').getContext('2d')!;
        const rgba = (color: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
        const css = getComputedStyle(el), ink = rgba(css.color), fill = rgba(css.backgroundColor);
        const background = fill.slice(0, 3).map(channel => channel * fill[3]! / 255 + 255 - fill[3]!);
        const foreground = ink.slice(0, 3).map((channel, index) => channel * ink[3]! / 255 + background[index]! * (1 - ink[3]! / 255));
        const luminance = (rgb: number[]) => { const linear = rgb.map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }); return .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!; };
        const back = luminance(background), text = luminance(foreground);
        return (Math.max(back, text) + .05) / (Math.min(back, text) + .05);
      });
      expect(ratio, `${style}/${font} receipt over white`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.evaluate(() => window.gwFixtureCanvas.clear());
  const receiptBox = (await receipt.boundingBox())!;
  expect(await receipt.evaluate((el, box) => el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)), receiptBox)).toBe(false);
  expect(await page.evaluate(() => document.elementFromPoint(24, 300)?.id)).toBe('canvas');
  await page.mouse.click(24, 300);
  expect(await page.evaluate(() => window.gwFixtureCanvas.events.map(event => event.type))).toEqual(['pointerdown', 'mousedown', 'mouseup', 'click']);
  await page.keyboard.press('Meta+b');
  await expect(page.locator('.tools-window')).toBeVisible();
  expect(await receipt.evaluate(el => el.matches(':popover-open'))).toBe(true);
  expect(await receipt.evaluate(el => el.contains(document.activeElement))).toBe(false);
  await page.keyboard.press('Meta+r');
  expect(await receipt.evaluate(el => el.matches(':popover-open'))).toBe(false);
});

test('a new details view clears the previous page pin receipt', async ({ page }) => {
  await page.goto('/?hub');
  await page.locator('.hub-search input').fill('build Word of Healing');
  await page.keyboard.press('Meta+j');
  await page.getByRole('menuitem', { name: 'Pin to Hub', exact: true }).click();
  await expect(page.locator('.hub-status')).toHaveText('Pinned Word of Healing.');
  await page.keyboard.press('Meta+j');
  await page.getByRole('menuitem', { name: 'Show build details', exact: true }).click();
  await expect(page.locator('.hub-build-details')).toBeVisible();
  await expect(page.locator('.hub-status')).toBeEmpty();
  await page.keyboard.press('Meta+Backspace');
  await expect(page.locator('.hub-search input')).toHaveValue('build Word of Healing');
  await expect(page.locator('.hub-caption')).toHaveText('Home');
  await expect(page.locator('.hub-status')).toBeEmpty();
});
