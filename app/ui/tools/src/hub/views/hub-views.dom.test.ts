/**
 * The accessibility contract of the Hub's own pages: Hub preferences, the search-phrase form and
 * its confirmations, the calculator's Conversion rates and Price details, the Accounts
 * confirmation and Leave this area. Per page: the caption a screen reader hears, the names of
 * controls and fields, the refusal or confirmation text that carries meaning, aria-invalid and
 * aria-describedby on a refused field, list order and selection, and where the keyboard is.
 * Classes and wrapper structure are not asserted here; the e2e suites and the CSS own them.
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
import { mountHubView } from '../embedded';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/gu, ' ').trim() ?? null;
/** The name a screen reader announces for a control: aria-label, its label element, or its text. */
const nameOf = (element: Element | null) => element?.getAttribute('aria-label') ?? text(document.querySelector(`label[for="${element?.id}"]`)) ?? text(element);
const focus = () => nameOf(document.activeElement);
const caption = () => text(document.getElementById('hub-caption'));
const primaryLabel = () => text(document.querySelector('.hub-primary-label'));
const byId = (element: Element | null, attribute: string) => text(document.getElementById(element?.getAttribute(attribute) ?? ''));
const status = () => text(document.querySelector('.hub-view [role="status"]'));
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
/** The preference list as it is read: the active option, the named groups with their options, and the move buttons. */
function preferences() {
  const list = field<HTMLElement>('.hub-preference-list');
  const disabled = (key: string) => document.querySelector(`[data-focus-key="${key}"]`)?.getAttribute('aria-disabled');
  return {
    active: text(document.getElementById(list.getAttribute('aria-activedescendant') ?? '')),
    selected: [...list.querySelectorAll('[aria-selected="true"]')].map(text),
    groups: [...list.querySelectorAll('[role="group"]')].map(group => [byId(group, 'aria-labelledby'), [...group.querySelectorAll('[role="option"]')].map(text)]),
    moveUpDisabled: disabled('preferences-move-up'),
    moveDownDisabled: disabled('preferences-move-down'),
  };
}
async function openPreferences() {
  hub.show(); await settle();
  await type('hub preferences');
  key(input(), { key: 'Enter' }); await settle();
}

async function openPopulatedPreferences() {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }, { id: 'commands', phrase: '', pinned: true }] };
  hub.attach(library([{ id: 'build:1', phrase: 'heal', pinned: false }, { id: 'team:1', phrase: '', pinned: true }]));
  await openPreferences();
}
const populatedGroups = [['Places and tools', ['Xunlai Storage · chest · Pinned', 'Commands · Pinned']], ['Builds and teams', ['Healer · heal', 'Speed team · Pinned']]];

test('Hub preferences lists pins and phrases in two named groups, the first entry chosen, with the keyboard on the list', async () => {
  await openPopulatedPreferences();
  expect({ caption: caption(), focus: focus(), primary: primaryLabel(), ...preferences() }).toEqual({
    caption: 'Hub preferences', focus: 'Pins and search phrases', primary: 'Set phrase for Xunlai Storage',
    active: 'Xunlai Storage · chest · Pinned', selected: ['Xunlai Storage · chest · Pinned'], groups: populatedGroups,
    moveUpDisabled: 'true', moveDownDisabled: 'false',
  });
});

test('Hub preferences: ArrowDown moves the active entry, retargets the primary action and frees Move up', async () => {
  await openPopulatedPreferences();
  key(field('.hub-preference-list'), { key: 'ArrowDown' }); await settle();
  expect({ focus: focus(), primary: primaryLabel(), ...preferences() }).toEqual({
    focus: 'Pins and search phrases', primary: 'Set phrase for Commands',
    active: 'Commands · Pinned', selected: ['Commands · Pinned'], groups: populatedGroups,
    moveUpDisabled: 'false', moveDownDisabled: 'true',
  });
});

test('Hub preferences: ⌥⌘↑ reorders the entry and its selection follows it', async () => {
  await openPopulatedPreferences();
  const list = field<HTMLElement>('.hub-preference-list');
  key(list, { key: 'ArrowDown' }); await settle();
  key(list, { key: 'ArrowUp', altKey: true, metaKey: true }); await settle();
  expect({ focus: focus(), primary: primaryLabel(), ...preferences() }).toEqual({
    focus: 'Pins and search phrases', primary: 'Set phrase for Commands',
    active: 'Commands · Pinned', selected: ['Commands · Pinned'],
    groups: [['Places and tools', ['Commands · Pinned', 'Xunlai Storage · chest · Pinned']], populatedGroups[1]],
    moveUpDisabled: 'true', moveDownDisabled: 'false',
  });
});

test('Hub preferences: Reset Hub position says so in the status line and leaves the keyboard on the list', async () => {
  await openPopulatedPreferences();
  expect(status()).toBe('');
  button('Reset Hub position').click(); await settle();
  expect({ status: status(), focus: focus() }).toEqual({ status: 'Hub position and size reset. Window locked.', focus: 'Pins and search phrases' });
});

test('Hub preferences without pins or phrases says how to add one and offers nothing to act on', async () => {
  await openPreferences();
  const hidden = (selector: string) => field(selector).hasAttribute('hidden');
  expect({
    caption: caption(), primary: primaryLabel(), focus: focus(),
    hint: text(document.querySelector('.hub-view p:not([role="status"])')), hintHidden: field('.hub-view p:not([role="status"])').hasAttribute('hidden'),
    listHidden: hidden('.hub-preference-list'), toolsHidden: hidden('.hub-preference-tools'),
    removePhrasesDisabled: button('Remove all search phrases…').disabled, resetDisabled: button('Reset Hub position').disabled,
    actionsDisabled: field<HTMLButtonElement>('.hub-actions').disabled,
  }).toEqual({
    caption: 'Hub preferences', primary: 'Done', focus: 'Reset Hub position',
    hint: 'Choose a result, then Actions to pin it or give it a search phrase.', hintHidden: false,
    listHidden: true, toolsHidden: true, removePhrasesDisabled: true, resetDisabled: false, actionsDisabled: true,
  });
});

async function openPhraseForm() {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }] };
  await openPreferences();
  primary().click(); await settle();
}
const phraseField = () => field<HTMLInputElement>('#hub-phrase');
const phraseError = () => field('#hub-phrase-error');
const phraseHint = 'Type this exact phrase in Hub to find Xunlai Storage. Its name stays the same. Leave the field empty to remove the phrase.';

test('the search-phrase form is a labelled field with its current phrase and a hint, and no error yet', async () => {
  await openPhraseForm();
  expect({
    caption: caption(), heading: text(field('.hub-view h2')), focus: focus(), value: phraseField().value, primary: primaryLabel(),
    describedBy: phraseField().getAttribute('aria-describedby'), invalid: phraseField().getAttribute('aria-invalid'),
    hint: byId(phraseField(), 'aria-describedby'), errorHidden: phraseError().hasAttribute('hidden'), errorRole: phraseError().getAttribute('role'),
  }).toEqual({
    caption: 'Search phrase', heading: 'Xunlai Storage', focus: 'Search phrase', value: 'chest', primary: 'Save phrase',
    describedBy: 'hub-phrase-hint', invalid: null, hint: phraseHint, errorHidden: true, errorRole: 'alert',
  });
});

test('the search-phrase form names a refused phrase in an alert tied to its field, which keeps the keyboard', async () => {
  await openPhraseForm();
  await type('travel kamadan', phraseField());
  primary().click(); await settle();
  expect({
    caption: caption(), focus: focus(), invalid: phraseField().getAttribute('aria-invalid'), describedBy: phraseField().getAttribute('aria-describedby'),
    error: text(phraseError()), errorHidden: phraseError().hasAttribute('hidden'), errorRole: phraseError().getAttribute('role'),
    hintStillThere: text(field('#hub-phrase-hint')),
  }).toEqual({
    caption: 'Search phrase', focus: 'Search phrase', invalid: 'true', describedBy: 'hub-phrase-error hub-phrase-hint',
    error: '“travel kamadan” starts with the command word “travel”. Choose another phrase.', errorHidden: false, errorRole: 'alert',
    hintStillThere: phraseHint,
  });
});

test('a valid search phrase returns to preferences with the entry updated and the keyboard on the list', async () => {
  await openPhraseForm();
  await type('travel kamadan', phraseField());
  primary().click(); await settle();
  await type('vault', phraseField());
  primary().click(); await settle();
  expect({ caption: caption(), focus: focus(), primary: primaryLabel(), ...preferences() }).toEqual({
    caption: 'Hub preferences', focus: 'Pins and search phrases', primary: 'Set phrase for Xunlai Storage',
    active: 'Xunlai Storage · vault · Pinned', selected: ['Xunlai Storage · vault · Pinned'],
    groups: [['Places and tools', ['Xunlai Storage · vault · Pinned']]], moveUpDisabled: 'true', moveDownDisabled: 'true',
  });
});

/** A confirmation page: its caption, the question it is named by, its explanation, and the armed destructive action. */
const confirmation = () => {
  const section = field('.hub-confirm');
  return {
    caption: caption(), name: section.getAttribute('aria-label'), heading: text(section.querySelector('h2')), explanation: text(section.querySelector('p')),
    focus: focus(), primary: primaryLabel(), armed: primary().hasAttribute('data-armed'),
  };
};

test('removing an entry asks "Remove Xunlai Storage from Hub?" with the keyboard on the question', async () => {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }] };
  await openPreferences();
  key(document.activeElement!, { key: 'j', metaKey: true }); await settle();
  menuItem('Remove').click(); await settle();
  expect(confirmation()).toEqual({
    caption: 'Remove Xunlai Storage?', name: 'Remove Xunlai Storage from Hub?', heading: 'Remove Xunlai Storage from Hub?',
    explanation: 'Its pin and search phrase go. The place, tool or build itself stays.',
    focus: 'Remove Xunlai Storage from Hub?', primary: 'Remove Xunlai Storage', armed: true,
  });
});

test('removing every phrase asks how many go and says pins stay, after Back returned from the first question', async () => {
  settings = { ...settings, hubShortcuts: [{ id: 'storage', phrase: 'chest', pinned: true }] };
  await openPreferences();
  key(document.activeElement!, { key: 'j', metaKey: true }); await settle();
  menuItem('Remove').click(); await settle();
  key(document.activeElement!, { key: 'Backspace', metaKey: true }); await settle();
  expect([caption(), focus()]).toEqual(['Hub preferences', 'Pins and search phrases']);
  button('Remove all search phrases…').click(); await settle();
  expect(confirmation()).toEqual({
    caption: 'Remove search phrases?', name: 'Remove 1 search phrase?', heading: 'Remove 1 search phrase?',
    explanation: 'Pins stay pinned. Every result is found by its own name again.',
    focus: 'Remove 1 search phrase?', primary: 'Remove 1 search phrase', armed: true,
  });
});

const rateInput = () => field<HTMLInputElement>('.hub-view input[aria-label="Gold per ectoplasm"]');
const rates = () => ({
  caption: caption(), heading: text(field('.hub-view h2')), focus: focus(), primary: primaryLabel(), status: status(),
  source: field<HTMLSelectElement>('.hub-view select').value,
  inputs: [...document.querySelectorAll<HTMLInputElement>('.hub-view input')].map(element => [element.getAttribute('aria-label'), text(element.closest('label')), element.value]),
});
async function openRates() {
  hub.show(); await settle();
  await type('rates');
  key(input(), { key: 'Enter' }); await settle();
}
const rateLabels = [['Gold per ectoplasm', 'Gold per ectoplasm'], ['Ectoplasm per armbrace', 'Ectoplasm per armbrace'], ['Ectoplasm per Zaishen key', 'Ectoplasm per Zaishen key']];

test('Conversion rates opens on the rate source with three labelled, empty rate fields', async () => {
  await openRates();
  const select = field<HTMLSelectElement>('.hub-view select');
  expect({ ...rates(), sourceName: select.getAttribute('aria-label'), sourceOptions: [...select.options].map(option => [option.value, option.text]), intro: text(field('.hub-view p')) }).toEqual({
    caption: 'Conversion rates', heading: 'Choose your rates', focus: 'Rate source', primary: 'Use these rates', status: '', source: 'trader',
    inputs: rateLabels.map(([name, label]) => [name, label, '']),
    sourceName: 'Rate source', sourceOptions: [['trader', 'Automatic observed prices'], ['manual', 'Your rates']],
    intro: 'Your rates are saved in gwonmac. They are estimates, not live market quotes. Leave unknown rates blank.',
  });
});

test('Conversion rates refuses an invalid rate by field name and keeps the keyboard on that field', async () => {
  await openRates();
  await type('manual', field<HTMLSelectElement>('.hub-view select'));
  await type('abc', rateInput());
  primary().click(); await settle();
  expect(rates()).toMatchObject({
    focus: 'Gold per ectoplasm', source: 'manual', status: 'Gold per ectoplasm: Enter a positive number, such as 5,000 or 5k.',
    inputs: [['Gold per ectoplasm', 'Gold per ectoplasm', 'abc'], ['Ectoplasm per armbrace', 'Ectoplasm per armbrace', ''], ['Ectoplasm per Zaishen key', 'Ectoplasm per Zaishen key', '']],
  });
});

test('Conversion rates saves a valid rate, says so, and keeps the keyboard on the field', async () => {
  await openRates();
  await type('manual', field<HTMLSelectElement>('.hub-view select'));
  await type('abc', rateInput());
  primary().click(); await settle();
  await type('5000', rateInput());
  primary().click(); await settle();
  expect(rates()).toMatchObject({
    caption: 'Conversion rates', focus: 'Gold per ectoplasm', source: 'manual', status: 'Your rates saved. Go back to your conversion.',
    inputs: [['Gold per ectoplasm', 'Gold per ectoplasm', '5000'], ['Ectoplasm per armbrace', 'Ectoplasm per armbrace', ''], ['Ectoplasm per Zaishen key', 'Ectoplasm per Zaishen key', '']],
  });
});

test('Price details lists the evidence behind a market estimate as labelled pairs', async () => {
  hub.show(); await settle();
  await type('1 armbrace in g');
  await type('1 armbrace in g');
  key(input(), { key: 'j', metaKey: true }); await settle();
  menuItem('Show price details').click(); await settle();
  const pairs = [...document.querySelectorAll('.hub-view dt')].map(term => [text(term), text(term.nextElementSibling)]);
  expect({ caption: caption(), focus: focus(), primary: primaryLabel(), editRates: text(field('[data-focus-key="price-edit-rates"]')) }).toEqual({
    caption: 'Price details', focus: 'Edit rates', primary: 'Done', editRates: 'Edit rates',
  });
  expect(pairs).toEqual([
    ['Source', 'Recent Kamadan trade ads'],
    ['Price basis', 'Seller asking prices'],
    ['Median rate', '1 Armbrace of Truth = 30 ecto'],
    ['Advertisers', '6 advertisers (Armbrace of Truth)'],
    ['Median rate', '1 Glob of Ectoplasm = 5000 gold'],
    ['Advertisers', '6 advertisers (Glob of Ectoplasm)'],
    ['Ads since', '2026-11-07T11:55:00.000Z'],
    ['Newest ad', '2026-11-07T12:00:00.000Z'],
    ['Last fetched', '2026-11-07T12:00:01.000Z'],
  ]);
});

test('replacing the running account asks on its own confirmation page', async () => {
  hub.show(); await settle();
  await type('acc second');
  key(input(), { key: 'ArrowDown' }); await settle();
  key(input(), { key: 'Enter' }); await settle();
  expect(confirmation()).toEqual({
    caption: 'Close Main?', name: 'Close Main and open Second?', heading: 'Close Main and open Second?',
    explanation: 'Second opens first. Then Main saves and closes.',
    focus: 'Close Main and open Second?', primary: 'Close Main and open Second', armed: true,
  });
});

/** The Leave this area page: the question and detail that name it, its two buttons, the lead action, and whether Leave is armed. */
const leaveArea = () => {
  const section = field('.hub-leave-area');
  return {
    caption: caption(), question: byId(section, 'aria-labelledby'), detail: byId(section, 'aria-describedby'),
    buttons: [...section.querySelectorAll('button')].map(text), focus: focus(), primary: primaryLabel(),
    armed: field('#leave-area-leave').hasAttribute('data-armed'),
  };
};

test('leaving an explorable area asks on its own page: Stay here leads, and Leave takes one press once armed', async () => {
  hub.show(); await settle();
  const left = vi.fn(async () => {});
  const outcome = askLeaveArea(hub, leaveAreaCopy('travel', 'Kamadan'), left);
  await vi.advanceTimersByTimeAsync(0);
  const asked = {
    caption: 'Leave this area?', question: 'Leave this area and travel to Kamadan?',
    detail: 'Travelling leaves this explorable area. You may lose progress in this instance.',
    buttons: ['Stay here', 'Leave and travel to Kamadan'], primary: 'Stay here',
  };
  expect(leaveArea()).toEqual({ ...asked, focus: 'Stay here', armed: false });
  const leave = field<HTMLButtonElement>('#leave-area-leave');
  leave.click(); await vi.advanceTimersByTimeAsync(0);
  expect(left).not.toHaveBeenCalled();
  key(field('#leave-area-stay'), { key: 'ArrowRight' }); await vi.advanceTimersByTimeAsync(0);
  expect(leaveArea()).toEqual({ ...asked, focus: 'Leave and travel to Kamadan', armed: false });
  await settle();
  expect(leaveArea()).toEqual({ ...asked, focus: 'Leave and travel to Kamadan', armed: true });
  // The later click of a double-click never leaves (HUB-027).
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })); await vi.advanceTimersByTimeAsync(0);
  expect(left).not.toHaveBeenCalled();
  leave.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); await settle();
  expect(left).toHaveBeenCalledTimes(1);
  await outcome;
  expect(hub.visible).toBe(false);
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
