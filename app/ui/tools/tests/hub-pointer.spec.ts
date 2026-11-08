import { expect, test, type Locator, type Page } from '@playwright/test';
import type { HubFixtureWindow } from './fixture-window.js';
// The workbench page this spec drives sets the fixture hooks; they are required here.
declare const window: HubFixtureWindow;

/**
 * The pointer contract (HUB-242, HUB-244, HUB-248, D-24). Every double-click is
 * a human one: two presses at one point, click count 1 then 2, with a gap. A
 * row that changes the game or the account selects on a click and runs on the
 * footer primary or its own double-click; a navigational row opens at once and
 * the rest of the click run dies with the page it started on. Trailing clicks
 * of a run that closed the Hub never reach the game canvas.
 */
const GAPS = [0, 120, 450] as const;

async function open(page: Page, query = '') {
  await page.goto(`/?hub${query}`);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  // Every game action in order, including repeats of the same action.
  await page.evaluate(() => {
    const app = document.getElementById('app')!;
    const ledger: string[] = [];
    Object.assign(window, { ledger });
    new MutationObserver(records => {
      records.forEach((record, index) => {
        const value = index + 1 < records.length ? records[index + 1]!.oldValue : app.dataset.action;
        if (value) ledger.push(value);
      });
    }).observe(app, { attributes: true, attributeFilter: ['data-action'], attributeOldValue: true });
    window.gwFixtureCanvas.clear();
  });
}
const ledger = (page: Page) => page.evaluate(() => (window as unknown as { ledger: string[] }).ledger);
const canvas = (page: Page) => page.evaluate(() => window.gwFixtureCanvas.events.filter(event => event.type !== 'keyup' || event.code).map(event => `${event.type}:${event.code ?? event.detail}`));
const search = (page: Page) => page.locator('.hub-search input');
const row = (page: Page, text: string | RegExp) => page.locator('#hub .hub-row', { hasText: text }).first();
const primary = (page: Page) => page.locator('.hub-primary');
const caption = (page: Page) => page.locator('.hub-caption');
async function enter(page: Page, query: string) { await search(page).fill(query); await search(page).press('Enter'); }

/** Presses one point `count` times with the click counts macOS reports, like a person. */
async function clicks(page: Page, target: Locator, count: number, gap = 120, at?: { x: number; y: number }) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + (at?.x ?? box.width / 2), box.y + (at?.y ?? box.height / 2));
  for (let clickCount = 1; clickCount <= count; clickCount++) {
    await page.mouse.down({ clickCount }); await page.mouse.up({ clickCount });
    if (clickCount < count && gap) await page.waitForTimeout(gap);
  }
  await page.waitForTimeout(600);
}

test.describe('a click run that needs the real browser', () => {
  test('a triple-click on a Travel recent travels once and runs no Home row after it', async ({ page }) => {
    await open(page);
    await search(page).press('ArrowDown');
    await row(page, /^Travel/).and(page.locator('[data-id="travel"]')).waitFor();
    while (await page.locator('.hub-row[aria-selected="true"]').getAttribute('data-id') !== 'travel') await search(page).press('ArrowDown');
    await search(page).press('Enter');
    await expect(caption(page)).toHaveText('Travel');
    await clicks(page, page.locator('.travel-recent').first(), 3);
    await expect.poll(() => ledger(page)).toEqual(['TRAVEL Kamadan, Jewel of Istan']);
    await expect(caption(page)).not.toHaveText(/Characters|Trade/);
    expect((await canvas(page)).filter(event => !/:(0|1)$/u.test(event))).toEqual([]);
  });

  test('pressing on one row and releasing on another activates neither', async ({ page }) => {
    await open(page);
    for (const [from, to] of [['Kamadan', 'Kaineng Center'], ['Settings', 'Show Launcher']] as const) {
      // Launcher is available through typed search, rather than empty Home (HUB-185).
      await search(page).fill(from === 'Settings' ? 's' : '');
      const start = row(page, from); await start.scrollIntoViewIfNeeded();
      const a = (await start.boundingBox())!;
      const b = (await row(page, to).boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      expect(await ledger(page)).toEqual([]);
      await expect(caption(page)).toHaveText('Home');
      await expect(search(page)).toBeFocused();
    }
  });
});

test.describe('a navigational row', () => {
  test('a double-click that opens Settings never toggles a setting', async ({ page }) => {
    await open(page);
    const settings = () => page.evaluate(() => JSON.stringify(window.gwToolsSettings?.()));
    const before = await settings();
    const target = page.locator('.hub-row[data-id="settings"]');
    for (const fraction of [0.25, 0.5, 0.9]) {
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox())!;
      await clicks(page, target, 2, 120, { x: box.width * fraction, y: box.height / 2 });
      await expect(caption(page)).toHaveText('Settings');
      expect(await settings()).toBe(before);
      await page.getByRole('button', { name: 'Home', exact: true }).click();
    }
    await search(page).fill('settings');
    await clicks(page, page.locator('.hub-row').first(), 2);
    await expect(caption(page)).toHaveText('Settings');
    expect(await settings()).toBe(before);
    // A deliberate single click still toggles exactly once.
    await page.getByText('Whispers', { exact: true }).first().click();
    await expect.poll(settings).not.toBe(before);
  });


  // The click-run gate, the footer names and the focus are in hub-pointer.dom.test.ts; the page's
  // position and scroll need a real layout.
  test('a double-click on the footer primary opens a review at its top, with its status in view', async ({ page }) => {
    await open(page);
    await search(page).fill('team gom');
    await expect(primary(page)).toHaveText(/^Review GOM AFK/);
    await clicks(page, primary(page), 2);
    await expect(page.getByRole('heading', { name: 'GOM AFK', exact: true, level: 2 })).toBeInViewport();
    expect(await page.locator('.hub-view').evaluate(view => view.scrollTop)).toBe(0);
    await page.getByLabel('Lifecycle state', { exact: true }).selectOption('pve-explorable');
    await page.keyboard.press('Meta+r'); await search(page).fill('team gom afk'); await search(page).press('ArrowRight');
    await expect(page.locator('.hub-build-review [role=status]')).toBeInViewport();
  });
});

test.describe('trailing clicks never reach the game', () => {
  // The press lands on the real ::backdrop of the dialog at a page point; the other closing sources
  // are in hub-pointer.dom.test.ts.
  test('backdrop: a closing double-click leaves the canvas untouched', async ({ page }) => {
    await open(page);
    await page.mouse.move(20, 20);
    await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
    await page.waitForTimeout(120);
    await page.mouse.down({ clickCount: 2 }); await page.mouse.up({ clickCount: 2 });
    await page.waitForTimeout(600);
    await expect(page.locator('#hub')).toBeHidden();
    expect(await canvas(page)).toEqual([]);
    // A fresh click a moment later reaches the game as one press.
    await page.waitForTimeout(400);
    await page.mouse.move(30, 300);
    await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
    await expect.poll(() => canvas(page)).toEqual(['pointerdown:0', 'mousedown:1', 'mouseup:1', 'click:1']);
  });


  // TRV-09 in the fixture: the Travel view is its own surface page, and its closing trip
  // keeps the whole run out of the game. The Electron playable client has no travel host.
  for (const gap of [120, 450]) {
    test(`Travel: a double-clicked recent (${gap} ms) travels once and leaves the game untouched`, async ({ page }) => {
      const kamadan = (view: Page) => view.locator('.travel-recent', { hasText: 'Kamadan' }).first();
      // Where a keyboard trip leaves focus is where the double-click must leave it too.
      await open(page);
      await page.keyboard.press('Meta+t');
      await expect(kamadan(page)).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');
      await expect(page.locator('#hub')).toBeHidden();
      const keyboardFocus = await page.evaluate(() => document.activeElement?.id);
      await open(page);
      await page.keyboard.press('Meta+t');
      await expect(caption(page)).toHaveText('Travel');
      await page.evaluate(() => window.gwFixtureCanvas.clear());
      await clicks(page, kamadan(page), 2, gap);
      await expect(page.locator('#hub')).toBeHidden();
      expect(await ledger(page)).toEqual(['TRAVEL Kamadan, Jewel of Istan']);
      expect(await canvas(page)).toEqual([]);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe(keyboardFocus);
      // A fresh click a second later reaches the game as one ordinary press.
      await page.waitForTimeout(1000);
      await page.mouse.move(30, 300);
      await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
      await expect.poll(() => canvas(page)).toEqual(['pointerdown:0', 'mousedown:1', 'mouseup:1', 'click:1']);
      expect(await ledger(page)).toEqual(['TRAVEL Kamadan, Jewel of Istan']);
    });
  }
});

/** Moves the pointer in small steps like a hand, and returns the other options it crossed. */
async function glide(page: Page, from: Locator, to: Locator) {
  await page.evaluate(() => {
    const crossed = new Set<string>();
    Object.assign(window, { crossed });
    document.addEventListener('pointermove', event => {
      const option = (event.target as Element).closest('[role="option"]');
      if (option?.id) crossed.add(option.id);
    }, true);
  });
  const start = (await from.boundingBox())!;
  const end = (await to.boundingBox())!;
  const origin = await from.getAttribute('id');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 24 });
  return (await page.evaluate(() => [...(window as unknown as { crossed: Set<string> }).crossed])).filter(id => id !== origin);
}

test.describe('a clicked row keeps the footer while the pointer crosses other rows to it (D-24)', () => {
  const subjects: Record<string, { open(page: Page): Promise<Locator>; footer: string; named: RegExp; ran: string[] }> = {
    'Home: Continue Eye of the North': { open: async page => row(page, 'Eye of the North'), footer: '.hub-primary', named: /^Travel to Eye of the North/, ran: ['TRAVEL Eye of the North'] },
    'Travel: Kaineng Center (TRV-07)': { open: async page => { await page.keyboard.press('Meta+t'); return page.locator('.travel-recent', { hasText: 'Kaineng Center' }); }, footer: '#hub .hub-primary', named: /^Travel to Kaineng Center · Any district/, ran: ['TRAVEL Kaineng Center'] },
    'build target: Apply to me (BLD-09)': { open: async page => { await enter(page, 'build smiter'); return page.getByRole('option', { name: /Apply to me/ }); }, footer: '.hub-primary', named: /^Apply Smiter to Fixture Monk/, ran: ['apply-build', 'command:1', 'command:2'] },
  };
  for (const [name, subject] of Object.entries(subjects)) {
    test(name, async ({ page }) => {
      await open(page);
      const target = await subject.open(page);
      await page.waitForTimeout(400);
      await clicks(page, target, 1);
      await expect(page.locator(subject.footer)).toHaveText(subject.named);
      const via = name.startsWith('build target') ? page.locator('#hub .hub-row[data-id="choose-hero"]') : null;
      if (via && await via.count()) await via.scrollIntoViewIfNeeded();
      const crossed = await glide(page, target, via && await via.count() ? via : page.locator(subject.footer));
      if (via && await via.count()) await glide(page, via, page.locator(subject.footer));
      // The path really crossed other rows, as a hand's path to the footer does.
      expect(crossed.length).toBeGreaterThan(0);
      await expect(target).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator(subject.footer)).toHaveText(subject.named);
      await page.mouse.down(); await page.mouse.up();
      await expect.poll(() => ledger(page)).toEqual(subject.ran);
    });
  }

  test('hover selects again once the pointer leaves the list or a key moves the selection', async ({ page }) => {
    await open(page);
    const eye = row(page, 'Eye of the North');
    await clicks(page, eye, 1);
    await glide(page, eye, primary(page));
    await expect(eye).toHaveAttribute('aria-selected', 'true');
    // Back in the list after leaving it, a real move selects the row under the pointer.
    const kaineng = row(page, 'Kaineng Center');
    const box = (await kaineng.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await expect(kaineng).toHaveAttribute('aria-selected', 'true');
    // A key moves the selection past a click's hold too.
    await clicks(page, kaineng, 1);
    await search(page).press('ArrowDown');
    await expect(kaineng).toHaveAttribute('aria-selected', 'false');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 2);
    await expect(kaineng).toHaveAttribute('aria-selected', 'true');
    expect(await ledger(page)).toEqual([]);
  });
});

test('Travel: a view that opens under a resting pointer keeps its selection (HUB-012)', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Meta+t');
  const favourite = page.locator('#travel-favorite-0');
  const box = (await favourite.boundingBox())!;
  await page.keyboard.press('Meta+Backspace');
  await expect(caption(page)).toHaveText('Home');
  // The pointer rests where the favourite will appear; Travel opens under it by keyboard and by a click.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Meta+t');
  await page.waitForTimeout(400);
  await expect(page.locator('#travel-recent-449')).toHaveAttribute('aria-selected', 'true');
  await expect(favourite).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#hub .hub-primary')).toHaveText(/^Travel to Kamadan/);
  // A wheel under the still pointer leaves it too; only a real move selects.
  await page.mouse.wheel(0, 30);
  await page.waitForTimeout(200);
  await expect(page.locator('#travel-recent-449')).toHaveAttribute('aria-selected', 'true');
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2);
  await expect(favourite).toHaveAttribute('aria-selected', 'true');
  // The outpost the player stands in (Lion's Arch) is no trip: hover, its digit and Enter pass it by.
  const current = page.locator('#travel-favorite-1');
  await expect(current).toBeDisabled();
  const here = (await current.boundingBox())!;
  await page.mouse.move(here.x + here.width / 2, here.y + here.height / 2, { steps: 3 });
  await expect(current).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('2');
  await expect(page.locator('#hub .travel-palette')).toContainText('You are already in Lion\'s Arch.');
  expect(await ledger(page)).toEqual([]);
});

test('Characters: a double-click that raises Leave this area? never confirms it', async ({ page }) => {
  for (const count of [2, 3]) {
    await open(page, '&lifecycle=pve-explorable');
    await page.keyboard.press('Meta+e');
    await page.keyboard.press('End');
    await clicks(page, page.locator('button[data-character-key="toefte"]'), count, 120, { x: 60, y: 12 });
    await expect(page.locator('#character-switch-title')).toHaveText('Leave this area and switch to Toefte?');
    const leave = page.getByRole('button', { name: 'Leave and switch to Toefte', exact: true });
    await expect(leave).toBeVisible();
    expect(await ledger(page)).toEqual([]);
    await expect(leave).toHaveAttribute('data-armed', '');
    await leave.click();
    await expect.poll(() => ledger(page)).toEqual(['Character toefte']);
  }
});

test('Accounts: a double-click on an account opens its page on Open Second and runs nothing (PPL-35)', async ({ page }) => {
  for (const gap of GAPS) {
    await open(page);
    await enter(page, 'switch account');
    await expect(caption(page)).toHaveText('Accounts');
    await clicks(page, row(page, /^Second/), 2, gap);
    await expect(caption(page)).toHaveText('Second');
    await expect(page.locator('.hub-row[aria-selected="true"]')).toHaveAttribute('data-id', /:open$/);
    await expect(primary(page)).toHaveText(/^Open Second/);
    expect(await ledger(page)).toEqual([]);
    expect(await canvas(page)).toEqual([]);
  }
});

test('Hub preferences: Move up and Remove keep focus on a visible, enabled element (PTR-12)', async ({ page }) => {
  for (const pins of [[], ['place:449'], ['place:449', 'place:194', 'place:642']]) {
    await page.goto('/?hub');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.evaluate(pins => localStorage.setItem('hub-fixture-shortcuts', JSON.stringify(pins.map(id => ({ id, phrase: '', pinned: true })))), pins);
    await open(page); await enter(page, 'hub preferences');
    const active = page.locator('.hub-view :focus');
    await expect(active).toBeEnabled(); await expect(active).toBeVisible();
    await page.locator('.hub-back').focus(); await page.keyboard.press('ArrowDown');
    await expect(active).toBeEnabled(); await expect(active).toBeVisible();
    if (pins.length) {
      const list = page.getByRole('listbox', { name: 'Pins and search phrases' });
      await list.focus();
      await page.keyboard.press('Meta+j');
      await page.getByRole('menuitem', { name: 'Remove Kamadan, Jewel of Istan…', exact: true }).click();
      await expect(primary(page)).toHaveAttribute('data-armed', '');
      await primary(page).click();
      await expect(caption(page)).toHaveText('Hub preferences');
      await expect(active).toBeEnabled(); await expect(active).toBeVisible();
    }
  }
});

test('the footer slots keep their place from page to page', async ({ page }) => {
  await open(page);
  const slot = async () => {
    const actions = page.locator('.hub-actions');
    await expect(actions).toBeVisible();
    const box = (await actions.boundingBox())!;
    return [Math.round(box.y), Math.round(box.x), Math.round(box.width), Math.round((await primary(page).boundingBox())!.x + (await primary(page).boundingBox())!.width)];
  };
  const home = await slot();
  for (const query of ['commands', 'hub preferences', 'switch account', 'build library', 'build smiter', 'team gom', 'romi', 'settings', 'maps', 'conversion rates']) {
    await page.keyboard.press('Meta+r');
    await enter(page, query);
    expect(await slot(), query).toEqual(home);
  }
  await page.keyboard.press('Meta+r'); await enter(page, 'switch account');
  await page.locator('.hub-row').filter({ has: page.locator('.hub-title', { hasText: /^Second$/ }) }).click();
  expect(await slot()).toEqual(home);
  await page.keyboard.press('Meta+r'); await enter(page, 'build library');
  await page.locator('.hub-row[data-id="game-templates"]').click();
  expect(await slot()).toEqual(home);
  await page.keyboard.press('Meta+r'); await enter(page, 'build smiter');
  await page.locator('.hub-row[data-id="choose-hero"]').click();
  expect(await slot()).toEqual(home);
  await page.locator('.hub-row').first().focus(); await page.keyboard.press('ArrowRight');
  await expect(caption(page)).not.toHaveText('Heroes');
  expect(await slot()).toEqual(home);
  await page.keyboard.press('Meta+t');
  await page.locator('#travel-search-input').fill('kamadan');
  await expect(primary(page)).toHaveText('Travel to Kamadan, Jewel of Istan · Any district↵');
  expect(await slot()).toEqual(home);
  await page.keyboard.press('Meta+e');
  await expect(primary(page)).toHaveText('Current character↵');
  expect(await slot()).toEqual(home);
  await page.locator('button[data-character-key="ranger"]').click();
  await expect(primary(page)).toHaveText('Switch to Fixture Ranger↵');
  expect(await slot()).toEqual(home);
});

test('a click on blank space keeps the keyboard where it was (HUB-246)', async ({ page }) => {
  await open(page);
  const typedInto = async (click: () => Promise<void>) => {
    await click();
    expect(['DIALOG', 'BODY']).not.toContain(await page.evaluate(() => document.activeElement?.tagName));
    await page.keyboard.type('mo');
    return page.evaluate(() => {
      const active = document.activeElement as HTMLInputElement | null;
      return `${active?.tagName}:${active?.value ?? ''}`;
    });
  };
  await search(page).fill('acc second');
  expect(await typedInto(() => page.locator('.hub-results').click({ position: { x: 300, y: 250 } }))).toBe('INPUT:acc secondmo');
  for (const [selector, query] of [['.hub-group', ''], ['.hub-count', 'acc second'], ['.hub-caption', ''], ['.hub-search svg', '']] as const) {
    await search(page).fill(query);
    expect(await typedInto(() => page.locator(selector).first().click()), selector).toBe(`INPUT:${query}mo`);
  }
  await page.keyboard.press('Meta+r'); await enter(page, 'build smiter');
  await search(page).fill(''); await search(page).focus();
  expect(await typedInto(() => page.locator('.hub-summary').click({ position: { x: 4, y: 4 } }))).toBe('INPUT:mo');
  await page.keyboard.press('Meta+t');
  for (const click of [() => page.locator('#travel-panel').click({ position: { x: 300, y: 10 } }), () => page.locator('#travel-favorites-title').click()]) {
    await page.locator('#travel-search-input').fill('');
    expect(await typedInto(click)).toBe('INPUT:mo');
  }
  await page.getByRole('button', { name: 'Lock Hub position', exact: true }).click();
  const before = (await page.locator('.hub-panel').boundingBox())!;
  const heading = (await page.locator('.hub-heading').boundingBox())!;
  await page.mouse.move(heading.x + 40, heading.y + 10); await page.mouse.down();
  await page.mouse.move(heading.x + 70, heading.y + 40); await page.mouse.up();
  const after = (await page.locator('.hub-panel').boundingBox())!;
  expect([Math.round(after.x - before.x), Math.round(after.y - before.y)]).toEqual([30, 30]);
  await page.keyboard.press('Meta+e');
  await expect(page.locator('button[data-character-key="monk"]')).toBeFocused();
  // Characters is card-first: typing from the card it returns to moves to its search.
  expect(await typedInto(() => page.locator('.character-switch-panel').click({ position: { x: 2, y: 2 } }))).toBe('INPUT:mo');
  await expect(page.locator('#character-switch-query')).toBeFocused();
});

test('a double-click on a recently applied build opens its target page and applies nothing', async ({ page }) => {
  await open(page);
  await enter(page, 'build smiter');
  await page.keyboard.press('Enter');
  await expect.poll(() => ledger(page)).toContain('apply-build');
  await page.getByRole('button', { name: 'Open Hub', exact: true }).click();
  const before = (await ledger(page)).length;
  await clicks(page, row(page, 'Recently applied'), 2);
  await expect(caption(page)).not.toHaveText('Home');
  await expect(page.locator('#hub')).toBeVisible();
  expect((await ledger(page)).length).toBe(before);
});


test('dragging out preserves the Hub query, and a backdrop click resumes the same task', async ({ page }) => {
  await open(page); await page.keyboard.press('Meta+b'); await search(page).fill('smiter');
  const inside = (await search(page).boundingBox())!;
  await page.mouse.move(inside.x + 10, inside.y + 10); await page.mouse.down();
  await page.mouse.move(20, 20, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(search(page)).toHaveValue('smiter');
  await page.mouse.click(20, 20);
  await expect(page.locator('#hub')).toBeHidden();
  await page.keyboard.press('Meta+r');
  await expect(caption(page)).toHaveText('Build Library');
  await expect(search(page)).toHaveValue('smiter'); await expect(search(page)).toBeFocused();
});
