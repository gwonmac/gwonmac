/**
 * The accessibility contract of Characters, the Hub page Character Switch owns: the cards as an
 * option list with names, position and the current character, the search combobox and its live
 * count, the display settings, the "Leave this area?" step, the veil while a switch runs, and the
 * stop message a screen reader hears after the Hub closed. Where the keyboard is after each step.
 * Classes and wrapper structure belong to the CSS and the e2e suites (hub-keyboard-model,
 * hub-intent, hub-navigation-window), not to these tests.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports
import type {} from '../../../../../renderer/gw-native';
// eslint-disable-next-line no-restricted-imports
import { installSurfaceController } from '../../../../../renderer/surface-controller';
// eslint-disable-next-line no-restricted-imports
import { createHub } from '../../../../../renderer/hub';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../../../shared/contracts';
// eslint-disable-next-line no-restricted-imports
import type { CharacterSwitchActionState, CharacterSwitchContext, CharacterSwitchSource } from '../../../../../features/character-switch/renderer/character-switch-model';
// eslint-disable-next-line no-restricted-imports
import { installCharacterSwitchHost } from '../../../../../features/character-switch/renderer/host';
import { mountHubView } from '../embedded';
import { narrow } from '../../hub-fixture-harness';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/gu, ' ').trim() ?? null;
const nameOf = (element: Element | null) => {
  const label = document.querySelector(`label[for="${element?.id}"]`);
  return element?.getAttribute('aria-label') ?? text(label?.querySelector('strong') ?? label) ?? text(element);
};
const focus = () => document.activeElement === document.body ? 'body' : document.activeElement?.id === 'canvas' ? 'canvas' : nameOf(document.activeElement);
const hidden = (selector: string) => field(selector).hasAttribute('hidden');
/** The cards as the option list a screen reader walks: name, position, selection, and whether it is the current character. */
const cards = () => [...document.querySelectorAll('#character-switch-list [role="option"]')].map(option => ({
  name: option.getAttribute('aria-label'), position: `${option.getAttribute('aria-posinset')}/${option.getAttribute('aria-setsize')}`,
  selected: option.getAttribute('aria-selected') === 'true', current: option.getAttribute('aria-current') === 'true',
}));
const selectedCard = () => cards().find(entry => entry.selected)?.name;
const query = () => field<HTMLInputElement>('#character-switch-query');
const count = () => text(field('.character-switch-count'));
const status = () => field('.character-switch-status');
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
  vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  localStorage.clear();
  document.body.replaceChildren();
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

/** The carousel draws five cards of the six; position and set size still count all six. */
const firstFiveCards = [
  { name: 'Fixture Monk, Monk, Level 20, Kamadan, Jewel of Istan, current character', current: true },
  { name: 'Switch to Fixture Ranger, Ranger / Mesmer, Level 15, Kamadan, Jewel of Istan, shortcut 2', current: false },
  { name: 'Switch to Fixture Mesmer, Mesmer, PvP character, Level 20, Lion\'s Arch, shortcut 3', current: false },
  { name: 'Switch to Toefte, Monk / Mesmer, Level 20, Kamadan, Jewel of Istan, shortcut 4', current: false },
  { name: 'Switch to Fixture Warrior, Warrior, Level 20, Lion\'s Arch, shortcut 5', current: false },
].map(({ name, current }, index) => ({ name, position: `${index + 1}/6`, selected: index === 0, current }));
const NAMES = {
  monk: 'Fixture Monk, Monk, Level 20, Kamadan, Jewel of Istan, current character',
  ranger: 'Switch to Fixture Ranger, Ranger / Mesmer, Level 15, Kamadan, Jewel of Istan, shortcut 2',
  toefte: 'Switch to Toefte, Monk / Mesmer, Level 20, Kamadan, Jewel of Istan, shortcut 4',
};

test('Characters is closed until asked for: the Hub stays shut and nothing is announced', async () => {
  await settle();
  expect({ open: field('#hub').hasAttribute('open'), caption: text(field('#hub-caption')), veil: hidden('.character-switch-veil'), focus: focus() })
    .toEqual({ open: false, caption: 'Home', veil: true, focus: 'body' });
});

test('Characters opens as a page named by its caption, with the cards as a named option list and the keyboard on the current one', async () => {
  await openCharacters();
  const shell = {
    dialog: field('#hub').getAttribute('aria-labelledby'), caption: text(field('#hub-caption')), context: text(field('.hub-context')),
    back: field('.hub-back').getAttribute('aria-label'),
    panelName: text(document.getElementById(field('#character-switch-root').getAttribute('aria-labelledby')!)),
    list: [field('#character-switch-list').getAttribute('role'), field('#character-switch-list').getAttribute('aria-label'), field('#character-switch-list').getAttribute('aria-orientation')],
    search: [query().getAttribute('role'), nameOf(query()), query().getAttribute('aria-activedescendant'), query().getAttribute('aria-expanded')],
    controls: [...document.querySelectorAll('.character-switch-head button, .character-switch-arrow')].map(button => [button.getAttribute('aria-label'), (narrow(HTMLButtonElement, button)).disabled]),
    count: [count(), field('.character-switch-count').getAttribute('aria-live')],
    settingsPressed: field('.character-switch-settings-toggle').getAttribute('aria-pressed'),
    closedParts: ['.character-switch-settings', '.character-switch-confirm', '.character-switch-details'].map(hidden),
    focus: focus(),
  };
  expect(shell).toEqual({
    dialog: 'hub-name hub-title-separator hub-caption', caption: 'Characters', context: 'Fixture Monk', back: 'Back', panelName: 'Switch Character',
    list: ['listbox', 'Characters', 'horizontal'], search: ['combobox', 'Search characters', 'character-switch-option-0', 'false'],
    controls: [['Character Switch settings', false], ['Close Switch Character', false], ['Previous character', true], ['Next character', false]],
    count: ['6 characters', 'polite'], settingsPressed: 'false', closedParts: [true, true, true], focus: NAMES.monk,
  });
  expect(cards()).toEqual(firstFiveCards);
});

test('Characters: each card shows its digit, name, a Current mark where it applies, and its profession, level and place', async () => {
  await openCharacters();
  const leaves = (option: Element) => [...option.querySelectorAll('span')].filter(span => !span.querySelector('span')).map(text).join(' | ');
  expect([...document.querySelectorAll('#character-switch-list [role="option"]')].map(leaves)).toEqual([
    '1 | Fixture Monk | Current | Mo · Lv 20 · Kamadan',
    '2 | Fixture Ranger | R/Me · Lv 15 · Kamadan',
    '3 | Fixture Mesmer | Me · PvP · Lv 20 · Lion\'s Arch',
    '4 | Toefte | Mo/Me · Lv 20 · Kamadan',
    '5 | Fixture Warrior | W · Lv 20 · Lion\'s Arch',
  ]);
});

test('Characters: → moves the selection and the keyboard to the next card, and the current mark stays on the active character', async () => {
  await openCharacters();
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  expect({ focus: focus(), selected: selectedCard(), active: query().getAttribute('aria-activedescendant'), current: cards().find(entry => entry.current)?.name })
    .toEqual({ focus: NAMES.ranger, selected: NAMES.ranger, active: 'character-switch-option-1', current: NAMES.monk });
});

test('Characters: a digit selects that card and takes the keyboard to it', async () => {
  await openCharacters();
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  key(card('ranger'), { key: '4' }); await settle();
  expect({ focus: focus(), selected: selectedCard(), active: query().getAttribute('aria-activedescendant') })
    .toEqual({ focus: NAMES.toefte, selected: NAMES.toefte, active: 'character-switch-option-3' });
});

async function searchFor(value: string) {
  await openCharacters();
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  key(card('ranger'), { key: '4' }); await settle();
  key(card('toefte'), { key: 'ArrowUp' }); await settle();
  query().value = value;
  query().dispatchEvent(new Event('input', { bubbles: true })); await settle();
}

test('Characters: a search narrows the option list, renumbers positions, announces "2 of 6" and keeps the keyboard in the field', async () => {
  await searchFor('fixture r');
  expect({ focus: focus(), value: query().value, count: count(), expanded: query().getAttribute('aria-expanded'), controls: query().getAttribute('aria-controls'), active: query().getAttribute('aria-activedescendant'), cards: cards() })
    .toEqual({
      focus: 'Search characters', value: 'fixture r', count: '2 of 6', expanded: 'true', controls: 'character-switch-list', active: 'character-switch-option-1',
      cards: [
        { name: 'Switch to Fixture Ranger, Ranger / Mesmer, Level 15, Kamadan, Jewel of Istan', position: '1/2', selected: true, current: false },
        { name: 'Switch to Fixture Ritualist, Ritualist, Level 20, Kamadan, Jewel of Istan', position: '2/2', selected: false, current: false },
      ],
    });
});

test('Characters: Escape in the search clears it, restores the whole list and keeps the page open', async () => {
  await searchFor('fixture r');
  key(query(), { key: 'Escape' }); await settle();
  expect({ focus: focus(), value: query().value, count: count(), cards: cards().length, caption: text(field('#hub-caption')), open: field('#hub').hasAttribute('open') })
    .toEqual({ focus: 'Search characters', value: '', count: '6 characters', cards: 5, caption: 'Characters', open: true });
});

const settingsPanel = () => ({
  open: !hidden('.character-switch-settings'), name: field('.character-switch-settings').getAttribute('aria-label'), pressed: field('.character-switch-settings-toggle').getAttribute('aria-pressed'),
  searchHidden: field('.character-switch-search').hasAttribute('hidden'), listHidden: hidden('#character-switch-list'),
  options: [...document.querySelectorAll<HTMLInputElement>('.character-switch-settings input')].map(box => [nameOf(box), text(document.querySelector(`label[for="${box.id}"] small`)), box.checked]),
  focus: focus(),
});
async function openDisplaySettings() {
  await openCharacters();
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  key(card('ranger'), { key: '4' }); await settle();
  field<HTMLButtonElement>('.character-switch-settings-toggle').click(); await settle();
}

test('Characters: the display settings replace the cards with three labelled checkboxes, all on, the keyboard on the first', async () => {
  await openDisplaySettings();
  expect(settingsPanel()).toEqual({
    open: true, name: 'Character Switch settings', pressed: 'true', searchHidden: true, listHidden: true, focus: 'Show profession',
    options: [
      ['Show profession', 'Icon, primary, and secondary profession', true],
      ['Show level', 'Character level', true],
      ['Show known location', 'Locations from the reviewed Travel catalogue', true],
    ],
  });
});

test('Characters: switching off "Show level" unchecks it, keeps the keyboard there, and drops the level from the card names once closed', async () => {
  await openDisplaySettings();
  const level = field<HTMLInputElement>('#character-switch-show-level');
  level.checked = false;
  level.dispatchEvent(new Event('change', { bubbles: true })); await settle();
  expect(settingsPanel()).toMatchObject({ focus: 'Show level', options: [['Show profession', expect.any(String), true], ['Show level', 'Character level', false], ['Show known location', expect.any(String), true]] });
  key(level, { key: 'Escape' }); await settle();
  expect({ settings: settingsPanel().open, focus: focus(), selected: selectedCard(), pressed: settingsPanel().pressed })
    .toEqual({ settings: false, focus: 'Switch to Toefte, Monk / Mesmer, Kamadan, Jewel of Istan, shortcut 4', selected: 'Switch to Toefte, Monk / Mesmer, Kamadan, Jewel of Istan, shortcut 4', pressed: 'false' });
});

const stop = 'Automatic switching stopped. Continue from the Guild Wars character selector.';

test('Characters: while the account list is on its way it says so in the status line and the keyboard waits in the search', async () => {
  characters = { status: 'waiting', reason: 'snapshot' };
  await openCharacters();
  expect({ focus: focus(), status: text(status()), role: status().getAttribute('role'), cards: cards().length, context: text(field('.hub-context')) })
    .toEqual({ focus: 'Search characters', status: 'Waiting for the account character list…', role: 'status', cards: 0, context: '' });
});

test('Characters: when the list arrives the waiting message goes and the keyboard lands on the current character', async () => {
  characters = { status: 'waiting', reason: 'snapshot' };
  await openCharacters();
  characters = ready;
  publish(); await settle();
  expect({ focus: focus(), status: text(status()), count: count(), cards: cards().length }).toEqual({ focus: NAMES.monk, status: '', count: '6 characters', cards: 5 });
});

test('Characters: an unexpected stop warns in the status line and offers its technical details to copy', async () => {
  await openCharacters();
  action = { status: 'failed', code: 'selector-timeout', retryable: true };
  publish(); await settle();
  field<HTMLDetailsElement>('.character-switch-details').open = true;
  field('.character-switch-details').dispatchEvent(new Event('toggle')); await settle();
  const details = field<HTMLDetailsElement>('.character-switch-details');
  expect({
    status: text(status()), level: status().getAttribute('data-level'), detailsShown: !details.hidden, detailsOpen: details.open,
    summary: text(details.querySelector('summary')), diagnostics: JSON.parse(details.querySelector('pre')!.textContent!), copy: text(details.querySelector('button')), focus: focus(),
  }).toEqual({
    status: stop, level: 'warning', detailsShown: true, detailsOpen: true, summary: 'Technical details',
    diagnostics: { version: 1, stage: 'unavailable', lastCode: 'play-path-unproved' }, copy: 'Copy diagnostics', focus: NAMES.monk,
  });
});

test('Characters: PvP refuses switching by name in the status line and hides the technical details', async () => {
  await openCharacters();
  action = { status: 'idle' };
  context = 'pvp-explorable';
  publish(); await settle();
  expect({ status: text(status()), level: status().getAttribute('data-level'), detailsHidden: hidden('.character-switch-details'), focus: focus() })
    .toEqual({ status: 'Character switching is unavailable during active PvP.', level: 'warning', detailsHidden: true, focus: NAMES.monk });
});

test('Characters: Escape closes the page and hands the keyboard back to the game', async () => {
  await openCharacters();
  key(card('monk'), { key: 'Escape' }); await settle();
  expect({ open: field('#hub').hasAttribute('open'), viewHidden: hidden('.hub-view'), focus: focus() }).toEqual({ open: false, viewHidden: true, focus: 'canvas' });
});

const confirmStep = () => {
  const root = field('#character-switch-root');
  return {
    detail: [root.getAttribute('aria-describedby'), text(document.getElementById('character-switch-confirm-copy'))],
    shown: !hidden('.character-switch-confirm'), buttons: [...document.querySelectorAll('.character-switch-confirm-actions button')].map(text),
    searchHidden: field('.character-switch-search').hasAttribute('hidden'), countHidden: hidden('.character-switch-count'),
    armed: field('#character-switch-leave').hasAttribute('data-armed'), focus: focus(),
  };
};
async function askToLeave() {
  context = 'pve-explorable';
  await openCharacters();
  key(card('monk'), { key: 'ArrowRight' }); await settle();
  key(card('ranger'), { key: 'Enter' });
  card('ranger').click(); await vi.advanceTimersByTimeAsync(0);
}
const question = ['character-switch-confirm-copy', 'Switching characters will leave this explorable area. You may lose progress in this instance.'];

test('Characters: in an explorable area a switch asks first, names the target on Leave, and puts the keyboard on Stay here', async () => {
  await askToLeave();
  expect(confirmStep()).toEqual({
    detail: question, shown: true, buttons: ['Stay here', 'Leave and switch to Fixture Ranger'], searchHidden: true, countHidden: true, armed: false, focus: 'Stay here',
  });
  expect([requests, action.status]).toEqual([['ranger'], 'confirming']);
});

test('Characters: a click on Leave before it is armed changes nothing; after → it is armed and the keyboard is on Leave', async () => {
  await askToLeave();
  const leave = field<HTMLButtonElement>('#character-switch-leave');
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await vi.advanceTimersByTimeAsync(0);
  expect(action.status).toBe('confirming');
  expect([requests, confirmStep().armed]).toEqual([['ranger'], false]);
  key(field('#character-switch-stay'), { key: 'ArrowRight' }); await settle();
  expect(confirmStep()).toMatchObject({ armed: true, focus: 'Leave and switch to Fixture Ranger' });
});

test('Characters: a switch withdraws the Hub behind a veil that says who is being switched to', async () => {
  await askToLeave();
  const leave = field<HTMLButtonElement>('#character-switch-leave');
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await vi.advanceTimersByTimeAsync(0);
  key(field('#character-switch-stay'), { key: 'ArrowRight' }); await settle();
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await settle();
  const veil = field('.character-switch-veil');
  expect({ requests, veil: [text(veil), veil.getAttribute('role'), veil.hasAttribute('hidden')], hubOpen: field('#hub').hasAttribute('open'), focus: focus() })
    .toEqual({ requests: ['ranger'], veil: ['Switching to Fixture Ranger…', 'status', false], hubOpen: false, focus: 'canvas' });
});

test('Characters: a stop after the Hub closed lifts the veil and is announced in a live region naming the switch', async () => {
  await askToLeave();
  const leave = field<HTMLButtonElement>('#character-switch-leave');
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await vi.advanceTimersByTimeAsync(0);
  key(field('#character-switch-stay'), { key: 'ArrowRight' }); await settle();
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await settle();
  action = { status: 'failed', code: 'selector-timeout', retryable: true };
  publish(); await settle();
  const receipt = field('.hub-receipt-announcement');
  expect({ veilHidden: hidden('.character-switch-veil'), hubOpen: field('#hub').hasAttribute('open'), focus: focus(), receipt: [text(receipt), receipt.getAttribute('role'), field('.hub-receipt').getAttribute('data-outcome')] })
    .toEqual({ veilHidden: true, hubOpen: false, focus: 'canvas', receipt: [`Switch to Fixture Ranger stopped. ${stop}`, 'status', 'failed'] });
});
