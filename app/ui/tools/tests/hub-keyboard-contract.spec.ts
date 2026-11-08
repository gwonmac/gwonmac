import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { HubFixtureWindow } from './fixture-window.js';
import { browserCell, BROWSER_KEYS, DOM_KEYS, type KeyboardView } from './keyboard-contract-keys.js';
import { openHub } from './hub-page.js';
// The workbench page this spec drives sets the fixture hooks; they are required here.
declare const window: HubFixtureWindow;

/**
 * The keyboard contract as a golden matrix: every key in every view, each cell
 * in a fresh page. The golden table records what the Hub does today, so any
 * behaviour change shows up as a reviewed table diff. vitest holds the cells a
 * DOM answers (src/hub-keyboard-contract.ts); this spec holds the cells only a
 * real browser answers (keyboard-contract-keys.ts): Tab traversal, PageDown's
 * page from the layout, and Settings' arrows past controls the stylesheet hides.
 * A branch that changes keyboard behaviour regenerates the table, both halves,
 * and commits the diff. CI does both: run ci.yml by hand with
 * update-keyboard-golden (docs/hub-contract.md#tests) and commit its artifact.
 *
 * One cell reads: surface (Hub caption, popout or `closed`), focus, selected
 * row, search query (the Hub's, or the Whispers picker's), an open disclosure,
 * the last recorded game action (trips record `TRAVEL <place>`),
 * the game lifecycle afterwards, and the key-downs, key-ups and pointer events
 * that reached the game canvas during the press. A key-up that leaks after the
 * Hub closes (the owned-press rule, HUB-003) therefore changes the table.
 */
const GOLDEN = new URL('./keyboard-contract.golden.json', import.meta.url);
const updating = process.env.KEYBOARD_GOLDEN === 'update';
const golden: Record<string, Record<string, string>> = JSON.parse(readFileSync(GOLDEN, 'utf8'));
const observed: Record<string, Record<string, string>> = {};

const enterHub = async (page: Page, query: string) => {
  const search = page.locator('.hub-search input');
  await search.fill(query); await search.press('Enter');
};
const VIEWS: Record<KeyboardView, { query?: string; open(page: Page): Promise<void> }> = {
  'closed': { open: page => page.keyboard.press('Escape') },
  'home': { open: async () => {} },
  'home-query': { open: page => page.locator('.hub-search input').fill('kam') },
  'home-row': { open: async page => { await page.locator('.hub-search input').fill('sw'); await page.keyboard.press('ArrowDown'); } },
  'explorable-home': { query: '&lifecycle=pve-explorable', open: async () => {} },
  'travel': { open: page => page.keyboard.press('Meta+t') },
  'characters': { open: page => page.keyboard.press('Meta+e') },
  'build-library': { open: page => page.keyboard.press('Meta+b') },
  'build-page': { open: page => enterHub(page, 'build smiter') },
  'person': { open: page => enterHub(page, 'romi') },
  'accounts': { open: async page => { await page.locator('.hub-search input').fill('switch account'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); } },
  'settings': { open: page => enterHub(page, 'settings') },
  'calculator': { open: page => page.locator('.hub-search input').fill('10 ecto in p') },
  'trade': { open: async page => { await page.keyboard.press('Escape'); await page.keyboard.press('Meta+k'); } },
  'whispers': { open: page => page.keyboard.press('Meta+d') },
  // The innermost levels answer first: a text in the Whispers picker, an open disclosure, a Settings section body.
  // Wait for the search to take focus, or a slow runner drops the typed letters.
  'whispers-query': { open: async page => { await page.keyboard.press('Meta+d'); await expect(page.locator('input#whisper-person')).toBeFocused(); await page.keyboard.type('ro'); } },
  'review-details': { open: async page => {
    await page.locator('.hub-search input').fill('team gom afk'); await page.keyboard.press('ArrowRight');
    await page.locator('#hub details summary').first().click();
  } },
  'settings-body': { open: async page => { await enterHub(page, 'settings'); await page.getByRole('checkbox', { name: 'Enable Tools' }).focus(); } },
};

/** Two animation frames and the demo hosts' 600 ms travel or apply delays. */
const settle = (page: Page) => page.waitForTimeout(700);

const observe = (page: Page) => page.evaluate(() => {
  const hub = document.getElementById('hub');
  const open = hub instanceof HTMLDialogElement && hub.open;
  const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].some(element => element.getClientRects().length > 0);
  const surface = open ? document.querySelector('.hub-caption')?.textContent ?? 'Hub'
    : visible('#toolbox-trade .trade-window') ? 'trade' : visible('#whisper-window') ? 'whispers'
      : document.querySelector('.hub-fixture-quit') ? 'quit' : 'closed';
  const active = document.activeElement;
  const focus = !active || active === document.body ? 'body'
    : active.id === 'canvas' ? 'canvas'
      : active.closest('.hub-row') ? `row:${active.closest<HTMLElement>('.hub-row')!.dataset.id}`
        : active.getAttribute('role') === 'combobox' && hub?.contains(active) ? 'search'
          : active instanceof HTMLElement && active.dataset.characterKey ? `card:${active.dataset.characterKey}`
            : `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''}${(() => {
              // A Settings control is named by its row's visible label (aria-labelledby), not aria-label.
              const name = active.getAttribute('aria-label') ?? (active as HTMLElement).dataset.settingLabel;
              return name ? `[${name}]` : active.classList[0] ? `.${active.classList[0]}` : '';
            })()}`;
  const selected = open ? document.querySelector<HTMLElement>('#hub .hub-row[aria-selected="true"]')?.dataset.id ?? '-' : '-';
  const query = open ? document.querySelector<HTMLInputElement>('#hub [role="combobox"]')?.value ?? ''
    : surface === 'whispers' ? document.querySelector<HTMLInputElement>('#whisper-person')?.value ?? '' : '';
  // An open disclosure is the innermost level Escape and ⌘⌫ close first.
  const disclosure = [...document.querySelectorAll('#hub details[open]')].some(element => element.getClientRects().length > 0) ? ' | disclosure open' : '';
  const action = document.getElementById('app')?.dataset.action ?? '-';
  const events = window.gwFixtureCanvas.events;
  const reached = (types: readonly string[]) => events.filter(event => types.includes(event.type)).length;
  const canvas = `down ${reached(['keydown'])} up ${reached(['keyup'])} pointer ${reached(['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'])}`;
  const life = document.querySelector<HTMLSelectElement>('select[aria-label="Lifecycle state"]')?.value ?? '-';
  // Account profile ids stay out of the repository (forbidden-artifacts policy).
  return `${surface} | focus ${focus} | sel ${selected} | q "${query}"${disclosure} | action ${action} | life ${life} | canvas ${canvas}`
    .replace(/Current observation [^·|]+(?= ·)/gu, 'Current observation <time>')
    .replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/giu, '<profile>');
});

test.describe('keyboard contract', () => {
  if (updating) {
    // One worker merges the whole table once.
    test.describe.configure({ mode: 'serial' });
    test.afterAll(() => {
      for (const [view, keys] of Object.entries(observed)) golden[view] = { ...golden[view], ...keys };
      writeFileSync(GOLDEN, `${JSON.stringify(golden, null, 2)}\n`);
    });
  }
  for (const [view, setup] of Object.entries(VIEWS) as [KeyboardView, typeof VIEWS[KeyboardView]][]) {
    for (const key of [...BROWSER_KEYS, ...DOM_KEYS].filter(key => browserCell(view, key))) {
      test(`${view} × ${key}`, async ({ page }) => {
        await openHub(page, setup.query);
        await setup.open(page);
        await settle(page);
        await page.evaluate(() => window.gwFixtureCanvas.clear());
        await page.keyboard.press(key);
        await settle(page);
        const cell = await observe(page);
        if (updating) { (observed[view] ??= {})[key] = cell; return; }
        expect(cell, `Regenerate keyboard-contract.golden.json with KEYBOARD_GOLDEN=update when ${view} × ${key} changes on purpose`).toBe(golden[view]?.[key]);
      });
    }
  }
});
