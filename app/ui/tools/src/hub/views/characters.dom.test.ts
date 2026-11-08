/**
 * The DOM contract of Characters, the Hub page Character Switch owns: element types, classes,
 * ids, ARIA, text and where the keyboard is, through the cards, a search, the display settings,
 * the "Leave this area?" step, a switch and an unexpected stop. The snapshot was taken from the
 * hand-built palette before it moved to the Vue kit, so the page keeps the structure the CSS and
 * the e2e suites (hub-keyboard-model, hub-intent, hub-navigation-window) expect.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports
import type {} from '../../../../../renderer/gw-native';
// eslint-disable-next-line no-restricted-imports
import { installSurfaceController } from '../../../../../renderer/surface-controller';
// eslint-disable-next-line no-restricted-imports
import { createHub } from '../../../../../renderer/hub';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../../../shared/settings/index';
// eslint-disable-next-line no-restricted-imports
import type { CharacterSwitchActionState, CharacterSwitchContext, CharacterSwitchSource } from '../../../../../features/character-switch/renderer/character-switch-model';
// eslint-disable-next-line no-restricted-imports
import { installCharacterSwitchHost } from '../../../../../features/character-switch/renderer/host';
import { describeFocus, serializeDom } from '../dom-snapshot';
import { mountHubView } from '../embedded';

const views: string[] = [];
const capture = (name: string) => {
  views.push(`=== ${name} (focus: ${describeFocus(document)})\n${[...document.body.children].flatMap(child => serializeDom(child)).join('\n')}`);
};
const settle = () => vi.advanceTimersByTimeAsync(1_000);
const key = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
const field = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const card = (key: string) => field<HTMLButtonElement>(`button[data-character-key="${key}"]`);
const openCharacters = async () => { window.dispatchEvent(new CustomEvent('gw:character-toggle', { cancelable: true })); await settle(); };

const ready = {
  status: 'ready', sequence: 1, selectedIndex: 0, characters: [
    { name: 'Fixture Monk', characterKey: 'monk', primaryProfession: 3, secondaryProfession: 0, characterType: 'roleplaying', campaign: 1, level: 20, mapId: 449 },
    { name: 'Fixture Ranger', characterKey: 'ranger', primaryProfession: 2, secondaryProfession: 5, characterType: 'roleplaying', campaign: 1, level: 15, mapId: 449 },
    { name: 'Fixture Mesmer', characterKey: 'mesmer', primaryProfession: 5, secondaryProfession: 0, characterType: 'pvp', campaign: 1, level: 20, mapId: 55 },
    { name: 'Toefte', characterKey: 'toefte', primaryProfession: 3, secondaryProfession: 5, characterType: 'roleplaying', campaign: 1, level: 20, mapId: 449 },
    { name: 'Fixture Warrior', characterKey: 'warrior', primaryProfession: 1, secondaryProfession: 0, characterType: 'roleplaying', campaign: 1, level: 20, mapId: 55 },
    { name: 'Fixture Ritualist', characterKey: 'ritualist', primaryProfession: 8, secondaryProfession: 0, characterType: 'roleplaying', campaign: 1, level: 20, mapId: 449 },
  ],
} as const satisfies CharacterSwitchSource['characters'];

let settings: AppSettings;
let characters: CharacterSwitchSource['characters'];
let action: CharacterSwitchActionState;
let context: CharacterSwitchContext;
const listeners = new Set<() => void>();
const publish = () => { for (const listener of [...listeners]) listener(); };
const requests: string[] = [];
const source: CharacterSwitchSource = {
  get characters() { return characters; },
  get action() { return action; },
  get context() { return context; },
  request(characterKey) {
    requests.push(characterKey);
    action = context === 'pve-explorable' ? { status: 'confirming' } : { status: 'switching', stage: 'logout' };
    publish();
  },
  confirm() { if (action.status === 'confirming') { action = { status: 'switching', stage: 'logout' }; publish(); } },
  cancelConfirmation() { if (action.status === 'confirming') { action = { status: 'idle' }; publish(); } },
  reset() { action = { status: 'idle' }; publish(); },
  diagnostics: () => ({ version: 1, stage: 'unavailable', lastCode: 'play-path-unproved' }),
  subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

let host: ReturnType<typeof installCharacterSwitchHost>;
beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  localStorage.clear();
  document.body.replaceChildren();
  views.length = 0;
  requests.length = 0;
  characters = ready;
  action = { status: 'idle' };
  context = 'outpost';
  settings = { ...DEFAULT_SETTINGS, gwonmacTools: true, characterSwitchEnabled: true };
  const canvas = document.createElement('canvas');
  canvas.id = 'canvas';
  document.body.append(canvas);
  Object.assign(window, {
    gwSurfaces: installSurfaceController(document, { doubleClickMs: 400 }),
    gwToolsSettings: () => settings,
    gwNative: {
      init: { development: false },
      settings: {
        get: async () => settings,
        onChange: () => () => {},
        set: async (patch: Partial<AppSettings>) => { settings = { ...settings, ...patch }; return settings; },
      },
      clipboard: { writeText: async () => {} },
      client: { session: async () => ({ extendedMemory: null }) },
    },
  });
  // Characters never opens Settings; the stub only completes the host's shape.
  window.gwHub = Object.assign(createHub(document.body, { mountHubView }), { openSettings: () => {} });
  host = installCharacterSwitchHost(document.body);
  host.attach(source);
});
afterEach(() => { host.dispose(); window.gwHub?.dispose(); vi.useRealTimers(); });

test('Characters: the cards, a card move, a digit, a search and the display settings', async () => {
  await settle();
  capture('closed');
  await openCharacters();
  capture('cards');
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  capture('→ on the first card');
  key(card('ranger'), { key: '4' }); await settle();
  capture('digit 4');
  const query = field<HTMLInputElement>('#character-switch-query');
  key(card('toefte'), { key: 'ArrowUp' }); await settle();
  query.value = 'fixture r';
  query.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  capture('search');
  key(query, { key: 'Escape' }); await settle();
  capture('search cleared');
  field<HTMLButtonElement>('.character-switch-settings-toggle').click(); await settle();
  capture('settings');
  const level = field<HTMLInputElement>('#character-switch-show-level');
  level.checked = false;
  level.dispatchEvent(new Event('change', { bubbles: true })); await settle();
  capture('settings, level hidden');
  key(level, { key: 'Escape' }); await settle();
  capture('settings closed');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/characters.dom.txt');
});

test('Characters: leaving an explorable area asks first, and a switch withdraws behind the veil', async () => {
  context = 'pve-explorable';
  await openCharacters();
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  key(card('ranger'), { key: 'Enter' });
  card('ranger').click(); await vi.advanceTimersByTimeAsync(0);
  capture('leave this area, not yet armed');
  const leave = field<HTMLButtonElement>('#character-switch-leave');
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await vi.advanceTimersByTimeAsync(0);
  expect(action.status).toBe('confirming');
  key(field('#character-switch-stay'), { key: 'ArrowRight' }); await settle();
  capture('leave this area, armed');
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await settle();
  expect(requests).toEqual(['ranger']);
  capture('switching');
  action = { status: 'failed', code: 'selector-timeout', retryable: true };
  publish(); await settle();
  capture('stopped after the Hub closed');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/characters-switch.dom.txt');
});

test('Characters: the list on its way, its arrival, an unexpected stop and a refusal', async () => {
  characters = { status: 'waiting', reason: 'snapshot' };
  await openCharacters();
  capture('waiting for the list');
  characters = ready;
  publish(); await settle();
  capture('list arrived');
  action = { status: 'failed', code: 'selector-timeout', retryable: true };
  publish(); await settle();
  field<HTMLDetailsElement>('.character-switch-details').open = true;
  field('.character-switch-details').dispatchEvent(new Event('toggle')); await settle();
  capture('unexpected stop, technical details');
  action = { status: 'idle' };
  context = 'pvp-explorable';
  publish(); await settle();
  capture('refused in PvP');
  key(card('monk'), { key: 'Escape' }); await settle();
  capture('escape');
  await expect(views.join('\n\n')).toMatchFileSnapshot('./__snapshots__/characters-states.dom.txt');
});
