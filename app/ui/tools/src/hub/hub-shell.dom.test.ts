/**
 * The Hub shell's accessibility contract with the real controller and view: the dialog and its
 * name, the search combobox and the listbox it owns, options and their groups,
 * aria-activedescendant, the Actions menu, Back, live regions, and where each page puts the
 * keyboard. The real controller and view also hold what only their DOM shows, such as session
 * drafts. The keyboard contract per key and view is hub-keyboard-contract.ts.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports
import type {} from '../../../../renderer/gw-native';
// eslint-disable-next-line no-restricted-imports
import { installSurfaceController } from '../../../../renderer/surface-controller';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../../shared/settings/index';
import type { HubRow, HubViewMount } from '../../../../shared/hub';
// eslint-disable-next-line no-restricted-imports
import { createHub } from '../../../../renderer/hub';
// eslint-disable-next-line no-restricted-imports
import { withHubBuiltins } from '../../../../renderer/hub-builtins';
import { mountHubView } from './embedded';
import { withBuildDetails } from '../hub-library';

const settle = () => vi.advanceTimersByTimeAsync(1_000);
const key = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

let settings: AppSettings;
beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  // happy-dom has no popover methods; the receipt only needs them to exist.
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  // Nor pointer lock: the Hub releases it before it opens.
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  localStorage.clear();
  document.body.replaceChildren();
  settings = { ...DEFAULT_SETTINGS, gwonmacTools: true, tradeChat: true, whispersEnabled: true, xunlaiStorage: true, cartographyEnabled: true, characterSwitchEnabled: true };
  Object.assign(window, {
    gwSurfaces: installSurfaceController(document, { doubleClickMs: 400 }),
    gwToolsSettings: () => settings,
    gwNative: {
      init: { development: false },
      accounts: { get: async () => ({ current: 'a', profiles: [{ id: 'a', name: 'Main', state: 'running' }, { id: 'b', name: 'Second', state: 'ready' }] }), open: async () => {} },
      app: { showLauncher: async () => {}, openSettings: async () => {}, openExternal: async () => {}, showQuitOrReload: async () => 'stayed' },
      settings: { set: async (patch: Partial<AppSettings>) => { settings = { ...settings, ...patch }; return settings; } },
      clipboard: { writeText: async () => {} },
      client: { session: async () => ({ extendedMemory: null }) },
    },
  });
});
afterEach(() => { window.gwHub?.dispose(); vi.useRealTimers(); });

const skills = Array.from({ length: 3 }, (_, index) => ({ name: `Skill ${index + 1}`, iconUrl: `skill-${index + 1}.png`, elite: index === 0, ...(index === 2 ? { changed: true, description: 'Hits hard.' } : {}) }));
const attributes = [{ name: 'Healing Prayers', icon: 'monk.png', attributes: [{ name: 'Healing Prayers', label: 'HP', rank: 12, nextRank: 11 }, { name: 'Divine Favor', label: 'DF', rank: 9 }] }];
const professions = [{ code: 'Mo', name: 'Monk', icon: 'mo.png' }, { code: 'Me', name: 'Mesmer', icon: 'me.png' }];
const sectionBase: readonly HubRow[] = [
  { id: 'build:1', iconKind: 'builds', title: 'Healer', detail: 'Monk build', group: 'Builds', action: 'Apply build', skills, attributes, professions, folder: 'PvE', consequential: true, run() {} },
  { id: 'build:2', iconKind: 'builds', title: 'Status build', detail: 'No attributes', group: 'Builds', action: 'Apply build', skills: skills.slice(0, 1), attributeStatus: 'Attributes unavailable', folder: '', run() {} },
  { id: 'quote:result', title: '1,000 gold', detail: 'From traders', group: 'Calculator', action: 'Copy 1,000 gold', conversion: { input: '1p', from: 'p', to: 'g' }, quoteBasis: { value: 'buy', options: [{ value: 'buy', label: 'Trader buys' }, { value: 'sell', label: 'Trader sells' }], choose() {}, details: { label: 'Refresh quotes', run() {} } }, run() {} },
  { id: 'place:1', iconKind: 'travel', title: 'Kamadan', detail: 'Outpost', group: 'Places', action: 'Travel', navigate() {}, leavesArea: true, run() {} },
  { id: 'person:1', iconKind: 'person', title: 'Friend', detail: 'Online', group: 'People', action: 'Whisper', icon: 'friend.png', actions: () => [{ label: 'Invite to party', run() {} }], run() {} },
  { id: 'danger:1', title: 'Delete', detail: 'Remove it', group: 'Commands', action: 'Delete', destructive: true, readOnly: true, preview: 'Line one\nLine two', run() {} },
  { id: 'off:1', title: 'Unavailable', detail: 'Not now', group: 'Commands', action: 'Use', unavailable: 'Not in an outpost.', run() {} },
];
const summary = { label: 'Current build', title: 'Healer', detail: 'Your build', skills, attributes, professions, folder: 'PvE' };

const hub = () => { const opened = withHubBuiltins(createHub(document.body, { mountHubView })); window.gwHub = opened; return opened; };
const search = () => document.querySelector<HTMLInputElement>('#hub [role="combobox"]')!;
const aria = (element: Element | null, names: readonly string[]) => Object.fromEntries(names.map(name => [name, element?.getAttribute(name) ?? null]));
const type = async (value: string) => { search().value = value; search().dispatchEvent(new Event('input', { bubbles: true })); await settle(); };

// A screen reader names the Hub by its caption and reads the search as a combobox that owns the results.
test('the Hub is a dialog named by its page, with a combobox search that owns the results listbox', async () => {
  const opened = hub();
  opened.show(); await settle();
  const home = {
    dialog: aria(document.getElementById('hub'), ['aria-labelledby', 'open']),
    caption: aria(document.getElementById('hub-caption'), ['role', 'aria-level', 'aria-current']),
    search: aria(search(), ['role', 'aria-label', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-describedby']),
    results: aria(document.getElementById('hub-results'), ['role', 'aria-label']),
    focus: document.activeElement === search(),
  };
  expect(home).toEqual({
    dialog: { 'aria-labelledby': 'hub-name hub-title-separator hub-caption', open: '' },
    caption: { role: 'heading', 'aria-level': '1', 'aria-current': 'page' },
    search: { role: 'combobox', 'aria-label': 'Search people, places, builds…', 'aria-autocomplete': 'list', 'aria-controls': 'hub-results', 'aria-expanded': 'true', 'aria-describedby': 'hub-hint' },
    results: { role: 'listbox', 'aria-label': 'Results' },
    focus: true,
  });
  opened.showRows('Builds', () => sectionBase); await settle();
  expect([document.getElementById('hub-caption')?.textContent?.trim(), search().getAttribute('aria-label'), search().getAttribute('aria-description')])
    .toEqual(['Builds', 'Search in Builds…', 'Builds: search actions']);
});

// Every option sits in a group named by its visible heading, with its own state and name.
test('each result is an option in a named group, with its state and accessible name', async () => {
  hub().showRows('Builds', () => sectionBase); await settle();
  const options = [...document.querySelectorAll('#hub-results [role="option"]')].map(option => {
    const group = option.closest('[role="group"]');
    return [option.getAttribute('data-id'), option.id, document.getElementById(group?.getAttribute('aria-labelledby') ?? '')?.textContent?.trim(),
      option.getAttribute('aria-label'), option.getAttribute('aria-description'), option.getAttribute('aria-disabled'), option.getAttribute('aria-selected')];
  });
  expect(options).toEqual([
    ['quote:result', 'hub-result-0', 'Calculator', '1p equals 1,000 gold. From traders', null, 'false', 'true'],
    ['build:1', 'hub-result-1', 'Builds', 'Healer', 'Monk build. Monk / Mesmer. Skills: Skill 1, Skill 2, Skill 3', 'false', 'false'],
    ['build:2', 'hub-result-2', 'Builds', 'Status build', 'No attributes. Skills: Skill 1', 'false', 'false'],
    ['person:1', 'hub-result-3', 'People', null, null, 'false', 'false'],
    ['place:1', 'hub-result-4', 'Places', null, 'Right Arrow opens the child page.', 'false', 'false'],
    ['danger:1', 'hub-result-5', 'Commands', null, null, 'false', 'false'],
    ['off:1', 'hub-result-6', 'Commands', null, null, 'true', 'false'],
  ]);
});

// The list keeps DOM focus in the search; aria-activedescendant names the selected option (settled rule).
test('aria-activedescendant names the one selected option while focus stays in the search', async () => {
  hub().showRows('Builds', () => sectionBase); await settle();
  const steps: [string, string][] = [['ArrowDown', 'hub-result-1'], ['ArrowDown', 'hub-result-2'], ['End', 'hub-result-6'], ['Home', 'hub-result-0']];
  const seen = [];
  for (const [pressed] of steps) {
    key(search(), { key: pressed }); await settle();
    const selected = [...document.querySelectorAll('#hub-results [aria-selected="true"]')].map(option => option.id);
    seen.push([pressed, search().getAttribute('aria-activedescendant'), selected.join(','), document.activeElement === search()]);
  }
  expect(seen).toEqual(steps.map(([pressed, id]) => [pressed, id, id, true]));
});

// ⌘J opens a real menu on its first item and Escape gives the keyboard back to the search.
test('Actions is a menu button: ⌘J opens the menu on its first item, Escape closes it back to the search', async () => {
  hub().showRows('Builds', () => withBuildDetails(window.gwHub!, summary, sectionBase), summary, 'builds'); await settle();
  const button = document.querySelector('#hub [aria-haspopup="menu"]');
  const menu = document.querySelector('#hub [role="menu"]')!;
  const state = () => [button?.getAttribute('aria-expanded'), menu.hasAttribute('hidden'), document.activeElement === search() ? 'search' : document.activeElement?.getAttribute('role')];
  expect([aria(button, ['aria-keyshortcuts']), aria(menu, ['aria-label']), state()])
    .toEqual([{ 'aria-keyshortcuts': 'Meta+J' }, { 'aria-label': 'Actions' }, ['false', true, 'search']]);
  key(search(), { key: 'j', metaKey: true }); await settle();
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map(item => item.textContent?.replace(/\s+/gu, ' ').trim());
  expect([state(), document.activeElement === menu.querySelector('[role="menuitem"]'), items.length > 1]).toEqual([['true', false, 'menuitem'], true, true]);
  key(document.activeElement!, { key: 'Escape' }); await settle();
  expect(state()).toEqual(['false', true, 'search']);
});

// Back names where it returns and the key that does it.
test('Back names its key and the page it returns to', async () => {
  hub().showRows('Builds', () => sectionBase); await settle();
  expect(aria(document.querySelector('.hub-back'), ['aria-label', 'aria-keyshortcuts', 'aria-description']))
    .toEqual({ 'aria-label': 'Back', 'aria-keyshortcuts': 'Meta+Backspace', 'aria-description': 'Return to Home' });
});

// The window controls: the lock is a toggle that names its state and, unlocked, the move keys.
test('the lock is a named toggle that describes the move keys once unlocked, and Close names the Hub', async () => {
  hub().show(); await settle();
  const lock = document.querySelector<HTMLButtonElement>('#hub .hub-lock')!;
  const names = ['aria-label', 'aria-pressed', 'aria-describedby'];
  expect(aria(lock, names)).toEqual({ 'aria-label': 'Lock Hub position', 'aria-pressed': 'true', 'aria-describedby': null });
  lock.click();
  expect([aria(lock, names), document.getElementById('hub-move-hint')?.hidden]).toEqual([{ 'aria-label': 'Lock Hub position', 'aria-pressed': 'false', 'aria-describedby': 'hub-move-hint' }, false]);
  expect(document.querySelector('#hub .hub-close')?.getAttribute('aria-label')).toBe('Close Hub');
});

// Status, announcements and a receipt after the Hub closed are live regions, so they are read without focus.
test('the status line, the announcer and a receipt after closing are live regions', async () => {
  const opened = hub();
  opened.show(); await settle();
  const live = () => ({
    status: aria(document.querySelector('#hub .hub-status'), ['role']),
    announcer: aria(document.querySelector('#hub .hub-announce'), ['role', 'aria-live', 'aria-atomic']),
  });
  expect(live()).toEqual({ status: { role: 'status' }, announcer: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } });
  opened.close(); opened.notify('Saved the build.'); await settle();
  const receipt = document.querySelector('.hub-receipt-announcement');
  expect([aria(receipt, ['role', 'aria-atomic']), receipt?.textContent?.trim(), document.getElementById('hub')?.contains(receipt ?? null)])
    .toEqual([{ role: 'status', 'aria-atomic': 'true' }, 'Saved the build.', false]);
});

// Each page puts the keyboard where its work starts.
test('each page takes the keyboard where its work starts', async () => {
  const opened = hub();
  const form: HubViewMount<HTMLElement> = (target, _back, footer) => {
    const element = document.createElement('form'); element.innerHTML = '<label>Name <input aria-label="Name" data-focus-key="name"></label>'; target.append(element);
    footer.primary({ label: 'Save', run() {} });
    return () => element.remove();
  };
  const focus = () => document.activeElement === search() ? `search: ${search().getAttribute('aria-label')}` : document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.className;
  const seen: [string, unknown][] = [];
  opened.show(); await settle(); seen.push(['Home', focus()]);
  opened.showRows('Builds', () => withBuildDetails(opened, summary, sectionBase), summary, 'builds'); await settle(); seen.push(['a list page', focus()]);
  key(search(), { key: 'ArrowDown' }); key(search(), { key: 'j', metaKey: true }); await settle();
  [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(item => item.textContent?.includes('Show build details'))!.click(); await settle();
  seen.push(['build details', focus()]);
  opened.showView('Form', form); await settle(); seen.push(['a form', focus()]);
  opened.close(); await settle(); opened.show(); await settle();
  await type('?'); key(search(), { key: 'Enter' }); await settle(); seen.push(['Commands', focus()]);
  expect(seen).toEqual([
    ['Home', 'search: Search people, places, builds…'],
    ['a list page', 'search: Search in Builds…'],
    ['build details', 'hub-build-details ui-scroll'],
    ['a form', 'Name'],
    ['Commands', 'search: Search commands…'],
  ]);
});

test('a form keeps its session draft when a field\'s label changes, since drafts follow the focus key', async () => {
  const hub = withHubBuiltins(createHub(document.body, { mountHubView }));
  window.gwHub = hub;
  const form = (label: string): HubViewMount<HTMLElement> => target => {
    const element = document.createElement('form');
    element.innerHTML = `<label>${label} <input aria-label="${label}" data-focus-key="name"></label>`;
    target.append(element);
    return () => element.remove();
  };
  const field = () => document.querySelector<HTMLInputElement>('.hub-view input')!;
  hub.show(); await settle();
  hub.showView('Form', form('Name')); await settle();
  field().value = 'keep me'; field().dispatchEvent(new Event('input', { bubbles: true }));
  key(field(), { key: 'Backspace', metaKey: true }); await settle();
  expect(document.querySelector('.hub-view input')).toBeNull();
  hub.showView('Form', form('Full name')); await settle();
  expect(field().value).toBe('keep me');
});

test('the Price basis picker keeps its presses, and Enter on it runs the row it prices once (HUB-022)', async () => {
  const hub = withHubBuiltins(createHub(document.body, { mountHubView }));
  window.gwHub = hub;
  const runs: string[] = [];
  const quote = sectionBase.find(row => row.id === 'quote:result')!;
  hub.show(); await settle();
  hub.showRows('Prices', () => [{ ...quote, run: () => { runs.push('copy'); } }]); await settle();
  const basis = document.querySelector<HTMLSelectElement>('.hub-rate-controls select')!;
  basis.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  basis.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await settle();
  expect([runs, document.querySelector('.hub-menu')?.hasAttribute('hidden') ?? true]).toEqual([[], true]);
  key(basis, { key: 'Enter' }); await settle();
  key(basis, { key: 'Enter', repeat: true }); await settle();
  expect(runs).toEqual(['copy']);
});

test('a view page mounts under its own Back and breadcrumbs, so it measures and takes focus there', async () => {
  const hub = withHubBuiltins(createHub(document.body, { mountHubView }));
  window.gwHub = hub;
  hub.show(); await settle();
  hub.showRows('Builds', () => sectionBase); await settle();
  let seen: unknown = null;
  hub.showView('Form', () => {
    seen = [document.querySelector('.hub-back')?.getAttribute('aria-description'), [...document.querySelectorAll('.hub-crumb')].map(crumb => crumb.textContent?.trim())];
    return () => {};
  }); await settle();
  expect(seen).toEqual(['Return to Builds', ['Home', 'Builds']]);
});

test('a view action still running after a blur and resume is named, never started again (HUB-083)', async () => {
  const hub = withHubBuiltins(createHub(document.body, { mountHubView }));
  window.gwHub = hub;
  let runs = 0;
  const form: HubViewMount<HTMLElement> = (target, _back, footer) => {
    const element = document.createElement('form'); element.innerHTML = '<input aria-label="Name" data-focus-key="name">'; target.append(element);
    footer.primary({ label: 'Save', run: () => { runs++; return new Promise<void>(() => {}); } });
    return () => element.remove();
  };
  hub.show(); await settle();
  hub.showView('Form', form); await settle();
  const field = () => document.querySelector<HTMLInputElement>('.hub-view input')!;
  key(field(), { key: 'Enter' }); await settle();
  window.dispatchEvent(new Event('blur')); await settle();
  hub.show(); await settle();
  key(field(), { key: 'Enter' }); await settle();
  expect([runs, document.querySelector<HTMLButtonElement>('.hub-primary')?.disabled, document.querySelector('.hub-status')?.textContent?.trim()])
    .toEqual([1, true, 'Save is still running.']);
});
