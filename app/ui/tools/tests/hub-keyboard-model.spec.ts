import { expect, test, type Page } from '@playwright/test';
import type { HubFixtureWindow } from './fixture-window.js';
// The workbench page this spec drives sets the fixture hooks; they are required here.
declare const window: HubFixtureWindow;

/**
 * One keyboard model across the Hub and its popouts: the shared list keys never
 * wrap, ↑ at the top of a list stays, and Escape and ⌘⌫ leave the innermost level
 * first (a disclosure, a prompt, a drawer, a typed query) before a page or a popout.
 */
const hubSearch = (page: Page) => page.locator('.hub-search input');
const openHub = async (page: Page, query = '') => {
  await page.goto(`/?hub${query}`);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(hubSearch(page)).toBeFocused();
};
const canvasKeys = (page: Page) => page.evaluate(() => window.gwFixtureCanvas.events.filter(event => event.type.startsWith('key')).length);

test('consecutive Escapes pop one level each and never close the Hub early (HUB-005)', async ({ page }) => {
  await openHub(page);
  const caption = page.locator('.hub-caption');
  await page.evaluate(() => {
    const cancels: boolean[] = [], homes: { query: string; focused: boolean }[] = [];
    Object.assign(window, { acceptanceCancels: cancels, acceptanceHomes: homes });
    document.querySelector('#hub')!.addEventListener('cancel', event => cancels.push(event.cancelable));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') queueMicrotask(() => {
        const dialog = document.querySelector<HTMLDialogElement>('#hub');
        const search = document.querySelector<HTMLInputElement>('.hub-search input');
        if (dialog?.open && dialog.querySelector('.hub-caption')?.textContent === 'Home' && search?.value === 'switch account') homes.push({ query: search.value, focused: document.activeElement === search });
      });
    }, true);
    window.gwFixtureCanvas.clear();
  });
  // No evaluate or locator read between the presses: those would grant user activation.
  for (let cycle = 0; cycle < 5; cycle++) {
    await hubSearch(page).fill('switch account');
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await expect(caption).toHaveText('Second');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(page.locator('#hub')).toBeHidden();
    await page.keyboard.press('Meta+r');
  }
  expect(await page.evaluate(() => (window as typeof window & { acceptanceHomes: { query: string; focused: boolean }[] }).acceptanceHomes)).toEqual([
    { query: 'switch account', focused: true }, { query: 'switch account', focused: true },
    { query: 'switch account', focused: true }, { query: 'switch account', focused: true },
    { query: 'switch account', focused: true },
  ]);
  expect(await page.evaluate(() => window.gwFixtureCanvas.events.filter(event => event.code === 'Escape'))).toEqual([]);
  // Three Build Library levels deep, then one Escape per level back to Home (KEY-09).
  await hubSearch(page).fill('build library');
  await page.keyboard.press('Enter');
  await page.locator('.hub-row[data-id="game-templates"]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.hub-breadcrumbs')).toHaveText('Home›Build Library›Guild Wars templates›Mesmer');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(page.locator('.hub-breadcrumbs')).toHaveText('Home');
  await expect(hubSearch(page)).toHaveValue('build library');
  await expect(page.locator('#hub')).toBeVisible();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(page.locator('#hub')).toBeHidden();
  await page.keyboard.press('Meta+r');
  // Commands examples, Heroes and a direct Library also unwind without intervening activation.
  for (const route of ['Commands example', 'Heroes', 'direct Library']) {
    if (route === 'Commands example') {
      await hubSearch(page).fill('commands'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await expect(caption).toHaveText('Home'); await expect(hubSearch(page)).toHaveValue('char ');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    } else if (route === 'Heroes') {
      await hubSearch(page).fill('build smiter'); await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      await expect(caption).toHaveText('Heroes');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    } else {
      await page.keyboard.press('Meta+b');
      await expect(caption).toHaveText('Build Library');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    }
    await expect(page.locator('#hub'), route).toBeHidden(); await page.keyboard.press('Meta+r');
  }
  await hubSearch(page).fill('team gom afk'); await page.keyboard.press('Meta+j');
  await page.getByRole('menuitem', { name: /Set search phrase/ }).click();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(page.locator('#hub')).toBeHidden();
  expect(await page.evaluate(() => (window as typeof window & { acceptanceCancels: boolean[] }).acceptanceCancels)).not.toContain(false);
});

test('list stages keep focus in search: ↓ moves one selection, Tab never lands on the list, ↓ steps from a hovered row (HUB-045, HUB-047)', async ({ page }) => {
  await openHub(page);
  const stages = [
    { name: 'Home', search: hubSearch(page), options: '#hub-results [role="option"]', enter: async () => {} },
    { name: 'Commands', search: hubSearch(page), options: '#hub-results [role="option"]', enter: async () => { await hubSearch(page).fill('commands'); await page.keyboard.press('Enter'); } },
    { name: 'Heroes', search: hubSearch(page), options: '#hub-results [role="option"]', enter: async () => { await page.keyboard.press('Meta+r'); await hubSearch(page).fill('build smiter'); await page.keyboard.press('Enter'); await hubSearch(page).fill('hero'); await page.keyboard.press('Enter'); } },
    { name: 'Smiter', search: hubSearch(page), options: '#hub-results [role="option"]', enter: async () => { await page.keyboard.press('Meta+r'); await hubSearch(page).fill('build smiter'); await page.keyboard.press('Enter'); } },
    { name: 'Travel', search: page.getByRole('combobox', { name: 'Destination, phrase, or friend' }), options: '#travel-panel [role="option"]:visible', enter: async () => { await page.keyboard.press('Meta+Backspace'); await page.keyboard.press('Meta+t'); } },
  ];
  const activeId = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  for (const stage of stages) {
    await stage.enter();
    await expect(page.locator('.hub-caption')).toHaveText(stage.name);
    const { search } = stage;
    const options = page.locator(stage.options);
    const selected = page.locator(`${stage.options.replace(':visible', '')}[aria-selected="true"]`);
    const expectOneSelection = async () => {
      await expect(search).toBeFocused();
      await expect(selected).toHaveCount(1);
      await expect(search).toHaveAttribute('aria-activedescendant', (await selected.getAttribute('id'))!);
    };
    await expect(search).toBeFocused();
    const enabled = () => options.evaluateAll(elements => elements.filter(element => !element.matches(':disabled,[aria-disabled="true"]')).map(element => element.id));
    for (let press = 0; press < 2; press++) {
      const ids = await enabled();
      const before = ids.indexOf((await search.getAttribute('aria-activedescendant')) ?? '');
      await page.keyboard.press('ArrowDown');
      // The ends hold: the two-row Smiter page stays on its last row.
      await expect(search).toHaveAttribute('aria-activedescendant', ids[Math.min(before + 1, ids.length - 1)]!);
      await expectOneSelection();
    }
    // A full Tab and Shift+Tab cycle returns to search without resting on the results scroller.
    for (const key of ['Tab', 'Shift+Tab']) {
      const visited: string[] = [];
      for (let press = 0; press < 30; press++) {
        await page.keyboard.press(key);
        const id = await activeId();
        if (id === await search.getAttribute('id') || await search.evaluate(element => element === document.activeElement)) break;
        visited.push(String(id));
      }
      await expect(search, `${stage.name} ${key} cycle`).toBeFocused();
      expect(visited, `${stage.name} ${key} cycle`).not.toContain('hub-results');
      expect(visited, `${stage.name} ${key} cycle`).not.toContain('BODY');
    }
    await expectOneSelection();
    // A real pointer move selects the row under it, and ↓ steps from there, not from the older selection
    // (where the page is long enough to tell them apart).
    const ids = await enabled();
    const current = await search.getAttribute('aria-activedescendant');
    const hovered = ids.find((id, index) => index < ids.length - 1 && id !== current && ids[index + 1] !== current)
      ?? ids.find((id, index) => index < ids.length - 1 && id !== current)!;
    await page.locator(`#${hovered}`).scrollIntoViewIfNeeded();
    const box = (await page.locator(`#${hovered}`).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(page.locator(`#${hovered}`)).toHaveAttribute('aria-selected', 'true');
    await expectOneSelection();
    await page.keyboard.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', ids[ids.indexOf(hovered) + 1]!);
    await expectOneSelection();
    // Park the pointer outside the Hub so the next stage opens without a resting hover.
    await page.mouse.move(2, 2);
  }
});

test('Travel keeps the active result in view after End (HUB-044)', async ({ page }) => {
  await openHub(page);
  await page.keyboard.press('Meta+t');
  const travel = page.getByRole('combobox', { name: 'Destination, phrase, or friend' });
  await expect(travel).toBeFocused();
  await travel.fill('a');
  await page.keyboard.press('End');
  await expect(page.locator(`#${await travel.getAttribute('aria-activedescendant')}`)).toBeInViewport();
  await expect(travel).toBeFocused();
});

test('Characters: a real Tab from the search reaches the selected card, not the first one (HUB-138)', async ({ page }) => {
  await openHub(page);
  await page.keyboard.press('Meta+e');
  const card = page.locator('#character-switch-list button[data-selected=true]');
  await expect(card).toBeFocused();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const chosen = await card.getAttribute('data-character-key');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#character-switch-query')).toBeFocused();
  // Tab from the search reaches the selected card, not the first one.
  for (let press = 0; press < 6 && !(await card.evaluate(element => element === document.activeElement)); press++) await page.keyboard.press('Tab');
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute('data-character-key', chosen!);
});

test('typing and ⌫ on a view\'s buttons and the header edit that view\'s search (HUB-046)', async ({ page }) => {
  await openHub(page);
  await hubSearch(page).fill('kam');
  const controls = ['.hub-primary', '.hub-actions', '.hub-back', '.hub-crumb', '.hub-lock', '.hub-close', '#hub-results'];
  // Back needs a child page; its search still accepts the same text.
  await page.keyboard.press('Meta+b');
  for (const selector of controls) {
    await hubSearch(page).fill('');
    const control = page.locator(selector).first();
    await control.focus();
    await page.keyboard.type('kam');
    await expect(hubSearch(page), selector).toHaveValue('kam');
    await expect(hubSearch(page), selector).toBeFocused();
  }
  await page.keyboard.press('Meta+r');
  for (const [shortcut, name] of [['Meta+e', 'Search characters'], ['Meta+t', 'Destination, phrase, or friend']] as const) {
    await page.keyboard.press(shortcut);
    const search = page.getByRole('combobox', { name });
    await search.fill('toe');
    for (const control of [page.locator('.hub-back'), page.locator('.hub-crumb').first(), page.locator('.hub-lock'), page.locator('#hub .hub-view button:not([data-row])').first()]) {
      await control.focus();
      await page.keyboard.type('mo'); await page.keyboard.press('Backspace');
      await expect(search).toBeFocused();
      await expect(search).toHaveValue('toem');
      await page.keyboard.press('Backspace');
    }
    await expect(page.locator('.hub-caption')).toHaveText(shortcut === 'Meta+e' ? 'Characters' : 'Travel');
    await page.keyboard.press('Meta+Backspace');
    await expect(page.locator('.hub-caption')).toHaveText('Home');
  }
});

test('arrow keys scroll Build details and never jump to Back (HUB-088)', async ({ page }) => {
  await openHub(page);
  await hubSearch(page).fill('build smiter'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show build details' }).click();
  const details = page.locator('.hub-build-details');
  await expect(details).toBeFocused();
  for (let press = 0; press < 3; press++) await page.keyboard.press('ArrowDown');
  await expect.poll(() => details.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  for (let press = 0; press < 3; press++) await page.keyboard.press('ArrowUp');
  await expect.poll(() => details.evaluate(element => element.scrollTop)).toBe(0);
  await expect(details).toBeFocused();
});

test('Whispers: Escape clears the picker text first, ↓ walks the people, ⌘⌫ keeps its native meaning in the message (HUB-079)', { tag: '@macos' }, async ({ page }) => {
  // One continued conversation (Romi) ahead of the online friends, so ↓ crosses from one group to the next.
  await openHub(page, '&party');
  await page.evaluate(() => window.dispatchEvent(new Event('hub-fixture-incoming')));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+d');
  const picker = page.locator('#whisper-person');
  await expect(picker).toBeFocused();
  await page.keyboard.type('ro');
  await page.evaluate(() => window.gwFixtureCanvas.clear());
  await page.keyboard.press('Escape');
  await expect(picker).toHaveValue('');
  await expect(page.locator('#whisper-window')).toBeVisible();
  await expect(picker).toBeFocused();
  // The empty picker's hint promises ↑ ↓: they walk the listed people and Enter opens one.
  await expect(page.locator('.whisper-hints')).toContainText('↑ ↓ choose');
  // The walk is announced: the combobox is expanded over a listbox of options, and the chosen one is selected.
  const people = page.locator('#whisper-people').getByRole('option');
  await expect(people).toHaveCount(6);
  await expect(page.getByRole('listbox', {name: 'People'})).toHaveAttribute('aria-owns', 'whisper-pick-0 whisper-pick-1 whisper-pick-2 whisper-pick-3 whisper-pick-4 whisper-pick-5');
  const peopleTree = await page.getByRole('listbox', {name: 'People'}).ariaSnapshot();
  expect(peopleTree.match(/- option /gu)).toHaveLength(6);
  expect(peopleTree).not.toMatch(/- (?:heading|button) /u);
  expect(await people.evaluateAll(options => options.every(option => option.getAttribute('tabindex') === '-1'))).toBe(true);
  await expect(picker).toHaveAttribute('aria-controls', 'whisper-people-options');
  await expect(picker).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#whisper-pick-0')).toContainText('Romi Ranger');
  await expect(page.locator('#whisper-pick-1')).toContainText('Zed Alpha');
  await expect(page.locator('#whisper-people [aria-selected="true"]')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(picker).toHaveAttribute('aria-activedescendant', 'whisper-pick-0');
  await expect(page.locator('#whisper-pick-0')).toHaveAttribute('data-highlighted', 'true');
  await expect(people.nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(picker).toHaveAttribute('aria-activedescendant', 'whisper-pick-1');
  await expect(page.locator('[data-highlighted="true"]')).toHaveCount(1);
  await expect(page.locator('#whisper-people [aria-selected="true"]')).toHaveCount(1);
  await expect(people.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(picker).toHaveAttribute('aria-activedescendant', 'whisper-pick-5');
  await page.keyboard.press('ArrowDown');
  await expect(picker).toHaveAttribute('aria-activedescendant', 'whisper-pick-5');
  await page.keyboard.press('ArrowUp');
  await expect(picker).toHaveAttribute('aria-activedescendant', 'whisper-pick-4');
  await expect(picker).toBeFocused();
  // Enter opens the highlighted person, a friend here, not the first conversation.
  await expect(page.locator('#whisper-pick-4')).toContainText('Zed Gamma');
  await page.keyboard.press('Enter');
  const draft = page.getByRole('textbox', { name: 'Message Zed Gamma', exact: true });
  await expect(draft).toBeFocused();
  await page.keyboard.type('hello there');
  await page.keyboard.press('Meta+Backspace');
  await expect(draft).toHaveValue('');
  await expect(draft).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#whisper-window')).toBeHidden();
  expect(await canvasKeys(page)).toBe(0);
});

test('typing on a focused Trade ledger row writes its first key into the search (HUB-121)', async ({ page }) => {
  await openHub(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+k');
  const trade = page.getByRole('dialog', { name: 'Trade Chat' });
  const search = trade.getByRole('searchbox', { name: 'Search offers or character names' });
  const rows = trade.getByRole('listbox', { name: 'Trade offers' }).getByRole('option');
  await expect(search).toBeFocused();
  await search.fill('');
  await rows.nth(3).focus();
  // Typing on a row writes into the search, first key included.
  await page.keyboard.type('choc');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('choc');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAccessibleName(/^Acolyte Mira: /u);
});
