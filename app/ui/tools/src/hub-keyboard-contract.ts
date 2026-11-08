/**
 * The keyboard contract's DOM cells (tests/keyboard-contract-keys.ts): every DOM key in every
 * view, each cell on a fresh Hub fixture in happy-dom, compared with the golden table that the
 * Playwright cells share. One cell reads the surface (Hub caption, popout or `closed`), focus,
 * selected row, search query (the Hub's, or the Whispers picker's), an open disclosure, the last
 * recorded game action, the game lifecycle afterwards, and the key-downs, key-ups and pointer
 * events that reached the game canvas during the press. A branch that changes keyboard behaviour
 * regenerates the table and commits the diff:
 *
 *   KEYBOARD_GOLDEN=update pnpm --filter @gwonmac/tools-ui exec vitest run --no-file-parallelism hub-keyboard-contract
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import goldenTable from '../tests/keyboard-contract.golden.json';
import { browserCell, DOM_KEYS, type KeyboardView } from '../tests/keyboard-contract-keys';
import { byRole, click, fill, loadFixture, mountFixture, press, settle, shown, type, unmountFixture, until } from './hub-fixture-harness';

const GOLDEN = resolve(__dirname, '../tests/keyboard-contract.golden.json');
const golden: Record<string, Record<string, string>> = goldenTable;
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const enterHub = (query: string) => { fill(search(), query); press('Enter'); };
const openSettings = async () => { enterHub('settings'); await until(() => document.querySelector('.hub-settings-host h1')); };

/** Each view as the Playwright cells open it (hub-keyboard-contract.spec.ts). */
const VIEWS: Record<KeyboardView, { query?: string; open(): Promise<void> | void }> = {
  'closed': { open: () => press('Escape') },
  'home': { open: () => {} },
  'home-query': { open: () => fill(search(), 'kam') },
  'home-row': { open: async () => { fill(search(), 'sw'); await settle(); press('ArrowDown'); } },
  'explorable-home': { query: '&lifecycle=pve-explorable', open: () => {} },
  'travel': { open: () => press('Meta+t') },
  'characters': { open: () => press('Meta+e') },
  'build-library': { open: () => press('Meta+b') },
  'build-page': { open: () => enterHub('build smiter') },
  'person': { open: () => enterHub('romi') },
  'accounts': { open: async () => { fill(search(), 'switch account'); await settle(); press('ArrowDown'); press('Enter'); } },
  'settings': { open: openSettings },
  'calculator': { open: () => fill(search(), '10 ecto in p') },
  'trade': { open: async () => { press('Escape'); await settle(); press('Meta+k'); } },
  'whispers': { open: () => press('Meta+d') },
  // The innermost levels answer first: a text in the Whispers picker, an open disclosure, a Settings section body.
  'whispers-query': { open: async () => { press('Meta+d'); await settle(); type('ro'); } },
  'review-details': { open: async () => {
    fill(search(), 'team gom afk'); await settle(); press('ArrowRight'); await settle();
    click(document.querySelector('#hub details summary')!);
  } },
  'settings-body': { open: async () => { await openSettings(); byRole('checkbox', 'Enable Tools')[0]!.focus(); } },
};

const visible = (selector: string) => [...document.querySelectorAll(selector)].some(shown);
/** One cell, in the words of the Playwright observer. */
function observe() {
  const hub = document.getElementById('hub');
  const open = hub instanceof HTMLDialogElement && hub.open;
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
  const disclosure = [...document.querySelectorAll('#hub details[open]')].some(shown) ? ' | disclosure open' : '';
  const action = document.getElementById('app')?.dataset.action ?? '-';
  const events = window.gwFixtureCanvas?.events ?? [];
  const reached = (types: readonly string[]) => events.filter(event => types.includes(event.type)).length;
  const canvas = `down ${reached(['keydown'])} up ${reached(['keyup'])} pointer ${reached(['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'])}`;
  const life = document.querySelector<HTMLSelectElement>('select[aria-label="Lifecycle state"]')?.value ?? '-';
  // The quote's time and account profile ids stay out of the repository (forbidden-artifacts policy).
  return `${surface} | focus ${focus} | sel ${selected} | q "${query}"${disclosure} | action ${action} | life ${life} | canvas ${canvas}`
    .replace(/Current observation [^·|]+(?= ·)/gu, 'Current observation <time>')
    .replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/giu, '<profile>');
}

/** Defines one test per DOM cell of these views. */
export function keyboardContract(views: readonly KeyboardView[]) {
  const updating = process.env.KEYBOARD_GOLDEN === 'update';
  const observed: Record<string, Record<string, string>> = {};
  beforeAll(loadFixture);
  afterEach(() => unmountFixture());
  if (updating) {
    afterAll(() => {
      // Read again: the Playwright cells and the other vitest files write the same table.
      const table: Record<string, Record<string, string>> = JSON.parse(readFileSync(GOLDEN, 'utf8'));
      for (const [view, keys] of Object.entries(observed)) table[view] = { ...table[view], ...keys };
      writeFileSync(GOLDEN, `${JSON.stringify(table, null, 2)}\n`);
    });
  }
  for (const view of views) {
    for (const key of DOM_KEYS) {
      if (browserCell(view, key)) continue;
      test(`${view} × ${key}`, async () => {
        const setup = VIEWS[view];
        await mountFixture(setup.query ?? '');
        await setup.open();
        await settle();
        window.gwFixtureCanvas?.clear();
        press(key);
        await settle();
        const cell = observe();
        if (updating) { (observed[view] ??= {})[key] = cell; return; }
        expect(cell, `Regenerate keyboard-contract.golden.json with KEYBOARD_GOLDEN=update when ${view} × ${key} changes on purpose`).toBe(golden[view]?.[key]);
      });
    }
  }
}
