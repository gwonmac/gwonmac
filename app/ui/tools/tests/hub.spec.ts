import { expect, test } from '@playwright/test';
import { openHub, reloadHub } from './hub-page.js';

test('the Hub stays inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await openHub(page);
  await page.locator('.hub-search input').fill('build');
  await expect(page.locator('#hub').getByRole('option').first()).toContainText('Build Library');
  const panel = await page.locator('.hub-panel').boundingBox();
  expect(panel).not.toBeNull();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
});

test('preview pane is reserved only when a row can fill it', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  const preview = page.locator('.hub-preview');
  const previewHeight = () => preview.evaluate(element => Math.round(element.getBoundingClientRect().height));
  await search.fill('team');
  const mixed: number[] = [];
  for (let row = 0; row < 5; row += 1) {
    mixed.push(await previewHeight());
    if (row === 0) await expect(preview).toBeHidden();
    await search.press('ArrowDown');
  }
  expect(mixed).toEqual([144, 144, 144, 144, 144]);
  await search.fill('build mo');
  await expect(preview).toBeHidden();
  expect(await previewHeight()).toBe(0);
});

test('a saved search phrase and pin survive reload and resolve the original item', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('team gom afk');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Pin to Hub' }).click();
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: /Set search phrase/ }).click();
  await page.getByRole('textbox', { name: 'Search phrase' }).fill('evening team');
  await page.getByRole('button', { name: 'Save phrase' }).click();
  await expect(page.locator('#hub .hub-status')).toHaveText('“evening team” now finds GOM AFK.');
  await reloadHub(page);
  await expect(page.locator('#hub').getByRole('option', { name: /GOM AFK/ })).toBeVisible();
  await search.fill('evening team');
  await expect(page.locator('#hub').getByRole('option')).toContainText('GOM AFK');
  // A phrase finds the team in its own group, not a false "Pinned" one (HUB-062, HUB-177).
  await expect(page.locator('#hub .hub-group')).toHaveText(['Teams']);
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'GOM AFK', level: 2 })).toBeVisible();
  // In the team scope the phrase names the team as exactly as its name: Enter applies it (HUB-062).
  await page.keyboard.press('Meta+Backspace');
  await search.fill('team evening team');
  await expect(page.locator('#hub .hub-primary')).toHaveText(/^Apply team GOM AFK/);
  expect(await page.locator('#app').getAttribute('data-action')).toBeNull();
});

test('a pinned Travel or team row is the row search shows, and → opens it (HUB-177)', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  const row = (id: string) => page.locator(`#hub .hub-row[data-id="${id}"]`).first();
  const found: Record<string, string | null> = {};
  for (const [query, id] of [['travel', 'travel'], ['team gom afk', 'team:hub-gom-afk'], ['commands', 'commands'], ['settings', 'settings'], ['switch account', 'accounts']] as const) {
    await search.fill(query);
    await expect(row(id)).toBeVisible();
    found[id] = await row(id).textContent();
    await page.keyboard.press('Meta+j');
    await page.getByRole('menuitem', { name: 'Pin to Hub' }).click();
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hub-fixture-shortcuts') ?? '[]').map((entry: { id: string }) => entry.id))).toEqual(['travel', 'commands', 'settings', 'accounts']);
  await reloadHub(page);
  await search.fill('');
  await expect(page.locator('#hub .hub-group').first()).toHaveText('Pinned');
  for (const [index, [id, caption]] of ([['travel', 'Travel'], ['commands', 'Commands'], ['settings', 'Settings'], ['accounts', 'Accounts'], ['team:hub-gom-afk', 'GOM AFK']] as const).entries()) {
    // Same detail and the same › cue as its search row.
    expect(await row(id).textContent()).toBe(found[id]);
    if (id === 'commands' || id === 'settings') await expect(row(id).locator('.hub-child-cue')).toHaveCount(0);
    else await expect(row(id).locator('.hub-child-cue')).toHaveText('›');
    await search.press('Home');
    for (let step = 0; step < index; step++) await search.press('ArrowDown');
    await expect(row(id)).toHaveAttribute('aria-selected', 'true');
    await search.press(id === 'commands' || id === 'settings' ? 'Enter' : 'ArrowRight');
    await expect(page.locator('.hub-caption')).toHaveText(caption);
    await page.keyboard.press('Meta+Backspace');
    await expect(page.locator('.hub-caption')).toHaveText('Home');
  }
});


test('conversion currency art decodes', async ({ page }) => {
  await openHub(page);
  await page.locator('.hub-search input').fill('1p in a');
  await expect(page.locator('.hub-conversion-art')).toHaveCount(2);
  await expect.poll(() => page.locator('.hub-conversion-art').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
});

test('Travel uses the Hub typography and Tab from its search reaches Customize',async({page})=>{
  await openHub(page);
  const hubSearch=page.locator('.hub-search input');
  const font=await hubSearch.evaluate(element=>getComputedStyle(element).fontFamily);
  await hubSearch.fill('travel');await hubSearch.press('Enter');
  const search=page.getByRole('combobox',{name:'Destination, phrase, or friend'});
  await expect(search).toBeFocused();
  expect(await search.evaluate(element=>getComputedStyle(element).fontFamily)).toBe(font);
  await search.press('Tab');
  await expect(page.getByRole('button',{name:'Customize Travel'})).toBeFocused();
});

test('Tab from Travel leaves its search for Customize, then the first shortcut number, not the Hub footer (HUB-070)',async({page})=>{
  await openHub(page);
  await page.keyboard.press('Meta+t');
  const search=page.getByRole('combobox',{name:'Destination, phrase, or friend'});
  await expect(search).toBeFocused();
  await search.press('Tab');
  await expect(page.getByRole('button',{name:'Customize Travel'})).toBeFocused();
  await page.keyboard.press('Enter');
  // The next Tab reaches the first number, not the Hub footer.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:/^Change shortcut 1,/})).toBeFocused();
  await page.getByRole('button',{name:'Assign shortcut 7'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('summary[aria-label="Destination for shortcut 7"]')).toBeFocused();
});

test('build previews decode their skill icons', async ({ page }) => {
  await openHub(page);
  await page.locator('.hub-search input').fill('build monk');
  await expect(page.locator('.hub-skill')).toHaveCount(32);
  await expect.poll(() => page.locator('.hub-skill img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
});


test('Hub keeps its geometry across results and compact carousels', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  const panel = page.locator('.hub-panel');
  const size = await panel.boundingBox();
  for (const query of ['10 ecto in p', 'build monk', 'travel', 'switch character']) {
    await search.fill(query);
    if (['travel', 'switch character'].includes(query)) await search.press('Enter');
    await expect.poll(() => panel.boundingBox()).toEqual(size);
    if (query === 'switch character') {
      const selected = page.locator('.character-switch-row[data-selected=true]');
      await expect(selected).toContainText('Fixture Monk');
      expect((await selected.boundingBox())!.height).toBeLessThan(165);
      await page.keyboard.press('ArrowRight');
      await expect(selected).toContainText('Fixture Ranger');
      await expect(page.locator('#app')).not.toHaveAttribute('data-action', /Character/);
      await page.getByRole('button', { name: 'Character Switch settings', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: /Show profession/ })).toBeFocused();
      await page.keyboard.press('Escape');
    }
    if (['travel', 'switch character'].includes(query)) await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(search).toBeVisible();
  }
});


test('character cards start at the left edge without leading empty slots', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('switch character'); await search.press('Enter');
  await expect(page.locator('.character-switch-list > li').first().locator('button')).toContainText('Fixture Monk');
  const icon = page.locator('.character-switch-row img').first();
  expect(await icon.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
  expect((await icon.boundingBox())!.width).toBeGreaterThanOrEqual(40);
  await expect(page.locator('.character-switch-meta').first()).toHaveText('Mo · Lv 20 · Kamadan');
});


test('the Appearance settings stay usable in a narrow viewport', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('settings'); await search.press('Enter');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(page.getByRole('combobox', { name: 'Panel style' })).toBeVisible();
});


test('typing after result navigation resumes the search at its caret without running a command', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.press('ArrowDown');
  await expect(page.locator('.hub-row[aria-selected="true"]')).toHaveCount(1);
  await expect(search).toBeFocused();
  await page.keyboard.type('build monk');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('build monk');
  await expect(page.locator('.hub-build-row')).toHaveCount(4);
  await search.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'hub-result-2');
  await page.keyboard.type(' Protection');
  await expect(search).toHaveValue('build monk Protection');
  await expect(page.locator('.hub-build-row')).toHaveCount(1);
  await expect(page.locator('#app')).not.toHaveAttribute('data-action', /command|apply/);
  // A selection in the existing query is replaced, rather than appending twice.
  await search.press('ControlOrMeta+a'); await search.press('ArrowDown');
  await page.keyboard.type('build smiter');
  await expect(search).toHaveValue('build smiter');
  await search.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.locator('.hub-summary')).toContainText('Smiter');
  await search.press('ArrowDown'); await page.keyboard.type('hero');
  await expect(search).toHaveValue('hero');
  await expect(page.locator('.hub-row')).toContainText('Apply to hero');
  // Focus never left search, so Backspace edits the query instead of leaving the page.
  await search.press('ArrowDown'); await page.keyboard.press('Backspace');
  await expect(search).toHaveValue('her');
  await expect(page.locator('.hub-summary')).toContainText('Smiter');
});
