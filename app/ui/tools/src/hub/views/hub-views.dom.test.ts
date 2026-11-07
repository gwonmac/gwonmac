/**
 * The DOM contract of the Hub's own pages: Hub preferences, the search-phrase form and its
 * confirmations, the calculator's Conversion rates and Price details, the Accounts
 * confirmation and Leave this area. Element types, classes, ids, ARIA, text and where the keyboard is. The
 * snapshots were taken from the hand-built pages before they moved to Vue components, so
 * these tests hold the components to the structure the CSS and the e2e suites expect.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports
import type {} from '../../../../../renderer/gw-native';
// eslint-disable-next-line no-restricted-imports
import { installSurfaceController } from '../../../../../renderer/surface-controller';
// eslint-disable-next-line no-restricted-imports
import { createHub } from '../../../../../renderer/hub';
// eslint-disable-next-line no-restricted-imports
import { withHubBuiltins, type GameHub } from '../../../../../renderer/hub-builtins';
// eslint-disable-next-line no-restricted-imports
import { askLeaveArea, leaveAreaCopy } from '../../../../../renderer/leave-area';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../../../shared/contracts';
import type { HubRow, HubSource } from '../../../../../shared/hub';
import type { HubShortcut } from '../../../../../shared/hub-preferences';
import { estimateMarketRates } from '../../../../../shared/market-rates';
import { describeFocus, serializeDom } from '../dom-snapshot';
import { mountHubView } from '../embedded';

const views: string[] = [];
const capture = (name: string) => {
  views.push(`=== ${name} (focus: ${describeFocus(document)})\n${[...document.body.children].flatMap(child => serializeDom(child)).join('\n')}`);
};
const settle = () => vi.advanceTimersByTimeAsync(1_000);
const key = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
const field = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const input = () => field<HTMLInputElement>('.hub-search input');
async function type(text: string, target: HTMLInputElement | HTMLSelectElement = input()) {
  target.value = text;
  target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  await settle();
}
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent?.trim() === text)!;
const menuItem = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('.hub-menu-item')].find(element => element.textContent?.includes(text))!;
const primary = () => field<HTMLButtonElement>('.hub-primary');

let settings: AppSettings;
let hub: GameHub;
beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  // Price details print local dates; the snapshot must not depend on the machine's time zone or locale.
  vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (this: Date) { return this.toISOString(); });
  vi.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function (this: Date) { return this.toISOString().slice(11, 19); });
  // happy-dom has no popover methods; the receipt only needs them to exist.
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  // Nor pointer lock: the Hub releases it before it opens.
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  localStorage.clear();
  document.body.replaceChildren();
  views.length = 0;
  settings = { ...DEFAULT_SETTINGS, gwonmacTools: true, tradeChat: true, whispersEnabled: true, xunlaiStorage: true, cartographyEnabled: true, characterSwitchEnabled: true };
  const market = ['WTS armbraces 30e/ea', 'WTB armbraces 28e/ea', 'WTS 20 ectos for 100k', 'WTB 25 ectos for 100k']
    .flatMap((message, group) => Array.from({ length: 6 }, (_, index) => ({ source: 'kamadan' as const, message, sender: `Sample ${group} ${index}`, timestamp: Date.now() - index * 60_000 })));
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
      trade: { getMarketRates: async () => estimateMarketRates(market), getTraderQuotes: async () => ({ updatedAt: Date.now(), quotes: [] }) },
    },
  });
  hub = withHubBuiltins(createHub(document.body, { mountHubView }));
  window.gwHub = hub;
});
afterEach(() => { hub.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });

/** The account's build and team references, as the Build Library's source owns them. */
function library(entries: HubShortcut[]): HubSource {
  const rows: Record<string, HubRow> = {
    'build:1': { id: 'build:1', iconKind: 'builds', title: 'Healer', detail: 'Monk build', group: 'Builds', action: 'Apply build', run() {} },
    'team:1': { id: 'team:1', iconKind: 'team', title: 'Speed team', detail: 'Team', group: 'Teams', action: 'Apply team', run() {} },
  };
  return {
    search: () => [], lookup: id => rows[id], setVisible() {}, subscribe: () => () => {},
    shortcuts: { get: () => entries, save: async value => { entries = [...value]; } },
  };
}
async function openPreferences() {
  hub.show(); await settle();
  await type('hub preferences');
  key(input(), { key: 'Enter' }); await settle();
}

test('Hub preferences lists pins and phrases in two groups and moves the chosen one', async () => {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }, { id: 'commands', phrase: '', pinned: true }] };
  hub.attach(library([{ id: 'build:1', phrase: 'heal', pinned: false }, { id: 'team:1', phrase: '', pinned: true }]));
  await openPreferences();
  capture('preferences');
  const list = field<HTMLElement>('.hub-preference-list');
  key(list, { key: 'ArrowDown' }); await settle();
  capture('preferences, second entry chosen');
  key(list, { key: 'ArrowUp', altKey: true, metaKey: true }); await settle();
  capture('preferences, moved up');
  button('Reset Hub position').click(); await settle();
  capture('preferences, position reset');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/preferences.dom.txt');
});

test('Hub preferences without pins or phrases says how to add one', async () => {
  await openPreferences();
  capture('preferences, empty');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/preferences-empty.dom.txt');
});

test('the search-phrase form names a refused phrase beside its field and saves a valid one', async () => {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }] };
  await openPreferences();
  primary().click(); await settle();
  capture('phrase form');
  await type('travel kamadan', field<HTMLInputElement>('#hub-phrase'));
  primary().click(); await settle();
  capture('phrase form, refused');
  await type('vault', field<HTMLInputElement>('#hub-phrase'));
  primary().click(); await settle();
  capture('phrase saved, back on preferences');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/phrase-form.dom.txt');
});

test('removing an entry or every phrase asks on its own confirmation page', async () => {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }] };
  await openPreferences();
  key(document.activeElement!, { key: 'j', metaKey: true }); await settle();
  menuItem('Remove').click(); await settle();
  capture('remove confirmation');
  key(document.activeElement!, { key: 'Backspace', metaKey: true }); await settle();
  button('Remove all search phrases…').click(); await settle();
  capture('remove phrases confirmation');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/preferences-confirm.dom.txt');
});

test('Conversion rates refuses an invalid rate by name and saves valid rates', async () => {
  hub.show(); await settle();
  await type('rates');
  key(input(), { key: 'Enter' }); await settle();
  capture('rates form');
  await type('manual', field<HTMLSelectElement>('.hub-view select'));
  await type('abc', field<HTMLInputElement>('.hub-view input[aria-label="Gold per ectoplasm"]'));
  primary().click(); await settle();
  capture('rates form, refused');
  await type('5000', field<HTMLInputElement>('.hub-view input[aria-label="Gold per ectoplasm"]'));
  primary().click(); await settle();
  capture('rates form, saved');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/rates-form.dom.txt');
});

test('Price details lists the evidence behind a market estimate', async () => {
  hub.show(); await settle();
  await type('1 armbrace in g');
  await type('1 armbrace in g');
  key(input(), { key: 'j', metaKey: true }); await settle();
  menuItem('Show price details').click(); await settle();
  capture('price details');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/price-details.dom.txt');
});

test('replacing the running account asks on its own confirmation page', async () => {
  hub.show(); await settle();
  await type('acc second');
  key(input(), { key: 'ArrowDown' }); await settle();
  key(input(), { key: 'Enter' }); await settle();
  capture('replace confirmation');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/accounts-confirm.dom.txt');
});

test('leaving an explorable area asks on its own page: Stay here leads, and Leave takes one press once armed', async () => {
  hub.show(); await settle();
  const left = vi.fn(async () => {});
  const outcome = askLeaveArea(hub, leaveAreaCopy('travel', 'Kamadan'), left);
  await vi.advanceTimersByTimeAsync(0);
  capture('leave area, not yet armed');
  const leave = field<HTMLButtonElement>('#leave-area-leave');
  leave.click(); await vi.advanceTimersByTimeAsync(0);
  expect(left).not.toHaveBeenCalled();
  key(field('#leave-area-stay'), { key: 'ArrowRight' }); await vi.advanceTimersByTimeAsync(0);
  capture('leave area, → on Stay here');
  await settle();
  capture('leave area, armed');
  // The later click of a double-click never leaves (HUB-027).
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })); await vi.advanceTimersByTimeAsync(0);
  expect(left).not.toHaveBeenCalled();
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await settle();
  expect(left).toHaveBeenCalledTimes(1);
  await outcome;
  expect(hub.visible).toBe(false);
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/leave-area.dom.txt');
});

test('Stay here returns to the page that asked, and the question rejects so its action stops', async () => {
  hub.show(); await settle();
  await type('kam');
  const outcome = askLeaveArea(hub, leaveAreaCopy('switch', 'Ranger'), async () => {});
  const rejected = outcome.catch((error: unknown) => error);
  await settle();
  field<HTMLButtonElement>('#leave-area-stay').click(); await settle();
  expect(await rejected).toMatchObject({ name: 'AbortError' });
  expect(input().value).toBe('kam');
  expect(document.querySelector('#leave-area-question')).toBeNull();
});

