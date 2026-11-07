/**
 * The Hub shell's DOM contract: element types, classes, ids, ARIA and text of every main view,
 * and where the keyboard is. The snapshot was taken from the hand-built Hub before it moved to
 * Vue, so this test holds the Vue Hub to the same structure the CSS and the e2e suites expect.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports
import type {} from '../../../../renderer/gw-native';
// eslint-disable-next-line no-restricted-imports
import { installSurfaceController } from '../../../../renderer/surface-controller';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../../shared/contracts';
import type { HubRow, HubViewMount } from '../../../../shared/hub';
// eslint-disable-next-line no-restricted-imports
import { createHub } from '../../../../renderer/hub';
import { describeFocus, serializeDom } from './dom-snapshot';
import { mountHubView } from './embedded';

const dom = () => [...document.body.children].flatMap(child => serializeDom(child)).join('\n');
const views: string[] = [];
const capture = (name: string) => { views.push(`=== ${name} (focus: ${describeFocus(document)})\n${dom()}`); };
const settle = () => vi.advanceTimersByTimeAsync(1_000);
const key = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

let settings: AppSettings;
beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
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
const sectionRows = (): readonly HubRow[] => [
  { id: 'build:1', title: 'Healer', detail: 'Monk build', group: 'Builds', action: 'Apply build', skills, attributes, professions, folder: 'PvE', consequential: true, run() {} },
  { id: 'build:2', title: 'Status build', detail: 'No attributes', group: 'Builds', action: 'Apply build', skills: skills.slice(0, 1), attributeStatus: 'Attributes unavailable', folder: '', run() {} },
  { id: 'quote:result', title: '1,000 gold', detail: 'From traders', group: 'Calculator', action: 'Copy 1,000 gold', conversion: { input: '1p', from: 'p', to: 'g' }, quoteBasis: { value: 'buy', options: [{ value: 'buy', label: 'Trader buys' }, { value: 'sell', label: 'Trader sells' }], choose() {} }, actionsLabel: 'Refresh quotes', actions() {}, run() {} },
  { id: 'place:1', title: 'Kamadan', detail: 'Outpost', group: 'Places', action: 'Travel', navigate() {}, leavesArea: true, run() {} },
  { id: 'person:1', title: 'Friend', detail: 'Online', group: 'People', action: 'Whisper', icon: 'friend.png', menuActions: () => [{ id: 'person:1:invite', title: 'Invite', detail: '', group: 'People', action: 'Invite to party', run() {} }], run() {} },
  { id: 'danger:1', title: 'Delete', detail: 'Remove it', group: 'Commands', action: 'Delete', destructive: true, readOnly: true, preview: 'Line one\nLine two', run() {} },
  { id: 'off:1', title: 'Unavailable', detail: 'Not now', group: 'Commands', action: 'Use', unavailable: 'Not in an outpost.', run() {} },
];
const summary = { label: 'Current build', title: 'Healer', detail: 'Your build', skills, attributes, professions, folder: 'PvE' };

test('the Hub keeps its DOM structure, classes, ARIA and focus in every main view', async () => {
  const hub = createHub(document.body, { mountHubView });
  window.gwHub = hub;
  await settle();
  capture('closed');

  hub.show(); await settle();
  capture('home');
  const input = document.querySelector<HTMLInputElement>('.hub-search input')!;

  input.value = 'set'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  capture('typed query');
  key(input, { key: 'ArrowDown' }); await settle();
  key(input, { key: 'j', metaKey: true }); await settle();
  capture('actions menu');
  key(document.activeElement!, { key: 'Escape' }); await settle();

  input.value = '1p in g'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  capture('calculator query');

  hub.showRows('Builds', sectionRows, summary, 'builds'); await settle();
  capture('section');
  key(input, { key: 'ArrowDown' }); key(input, { key: 'ArrowDown' }); await settle();
  capture('section, quote selected');
  key(input, { key: 'ArrowUp' }); key(input, { key: 'ArrowUp' }); await settle();
  key(input, { key: 'j', metaKey: true }); await settle();
  capture('section, build actions');
  [...document.querySelectorAll<HTMLButtonElement>('.hub-menu-item')].find(item => item.textContent?.includes('Show build details'))!.click(); await settle();
  capture('build details view');

  const form: HubViewMount<HTMLElement> = (target, _back, footer) => {
    const element = document.createElement('form'); element.innerHTML = '<label>Name <input aria-label="Name"></label>'; target.append(element);
    footer.primary({ label: 'Save', run() {} }); footer.secondary({ label: 'Reset', run() {}, destructive: true });
    return () => element.remove();
  };
  hub.showView('Form', form); await settle();
  capture('view with footer');
  key(document.activeElement!, { key: 'j', metaKey: true }); await settle();
  capture('view actions menu');
  key(document.activeElement!, { key: 'Escape' }); await settle();

  hub.openSettings(); await settle();
  await vi.waitFor(() => expect(document.querySelector('.hub-settings-host')?.textContent).toContain('Settings could not be loaded'));
  capture('settings page');

  key(document.activeElement!, { key: 'Backspace', metaKey: true }); await settle();
  capture('back to form');

  hub.close(); await settle();
  hub.show(); await settle();
  input.value = '?'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  key(input, { key: 'Enter' }); await settle();
  capture('commands page');

  hub.close(); hub.notify('Saved the build.'); await settle();
  capture('closed with receipt');

  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/hub-shell.dom.txt');
});
