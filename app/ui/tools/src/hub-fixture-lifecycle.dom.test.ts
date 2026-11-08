/**
 * The fixture page's game lifecycle, shortcut routing and Quit-or-Reload sheet, with the real
 * Hub controller in happy-dom (what hub-fixture-lifecycle.spec.ts drove in a browser). The
 * fixture must match production (HUB-239): the lifecycle names the place and gates character
 * switching, a Travel arrival moves it, a direct shortcut finds a page already open, ⌘R
 * toggles once, and the confirmation sheet opens once per gesture and only after a held
 * Enter is released. Nothing here needs layout or the browser's own focus movement.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, narrow, press, settle, shown, unmountFixture, until } from './hub-fixture-harness';
import type { HubFixtureWindow } from '../tests/fixture-window';

// The workbench page sets the fixture hooks; a renamed or removed hook fails to type-check here.
declare const window: HubFixtureWindow;

beforeAll(loadFixture);
afterEach(unmountFixture);

const app = () => document.getElementById('app')!;
const hub = () => narrow(HTMLDialogElement, document.getElementById('hub'));
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
const action = () => app().dataset.action;
const lifecycle = () => document.querySelector<HTMLSelectElement>('select[aria-label="Lifecycle state"]')!;
const choose = (phase: string) => { lifecycle().value = phase; lifecycle().dispatchEvent(new Event('change', { bubbles: true })); };
const canvasEvents = () => window.gwFixtureCanvas.events.map(event => `${event.type}:${event.code ?? event.detail}`);
const sheet = () => document.querySelector<HTMLDialogElement>('.hub-fixture-sheet')!;
/**
 * Escape on the open sheet. happy-dom does not match `:modal`, so the harness cannot give the
 * browser's default (the cancel event, then close) to a dialog opened with showModal.
 */
const escapeSheet = async () => {
  press('Escape');
  const dialog = sheet();
  if (dialog.open && dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
  await settle();
};
const hubOpen = () => hub().open && shown(hub());

test('one lifecycle state names the place and gates character switching', async () => {
  await mountFixture('&lifecycle=pvp-outpost');
  expect(lifecycle().value).toBe('pvp-outpost');
  expect(text('.hub-context')).toBe('Fixture Monk · Random Arenas · PvP');
  choose('map-loading');
  fill(search(), 'char toefte'); press('Enter'); await settle();
  expect(hub().textContent).toContain('Wait until Guild Wars finishes loading');
  expect(action() ?? '').not.toMatch(/Character/u);
  choose('pve-explorable');
  fill(search(), 'char toefte'); press('Enter'); await settle();
  expect(text('#character-switch-title')).toBe('Leave this area and switch to Toefte?');
  expect(action() ?? '').not.toMatch(/Character/u);
  // The confirmation arms after a moment, so the press that raised it cannot pass it.
  const leave = byRole('button', 'Leave and switch to Toefte', true)[0]!;
  await until(() => leave.hasAttribute('data-armed'));
  click(leave); await settle();
  expect(action()).toBe('Character toefte');
});

test('a Travel arrival moves the lifecycle to the destination outpost', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  fill(search(), 'kamadan'); await settle();
  expect(text('.hub-primary')).toMatch(/^Travel to Kamadan/u);
  press('Enter'); await settle();
  // Leaving the explorable area asks first (D-27); the armed Leave starts the trip.
  const leave = byRole('button', 'Leave and travel to Kamadan, Jewel of Istan', true)[0]!;
  await until(() => leave.hasAttribute('data-armed'));
  click(leave); await settle();
  expect(action()).toBe('TRAVEL Kamadan, Jewel of Istan');
  expect(lifecycle().value).toBe('outpost');
  click(byRole('button', 'Open Hub', true)[0]!); await settle();
  expect(text('.hub-context')).toBe('Fixture Monk · Kamadan, Jewel of Istan');
});

test('Characters list arrival focuses the current card instead of its prior display setting (HUB-074)', async () => {
  await mountFixture('&characters-ms=1500');
  press('Meta+e');
  await until(() => byRole('button', 'Character Switch settings', true)[0]);
  click(byRole('button', 'Character Switch settings', true)[0]!);
  await until(() => byRole('checkbox', 'Show profession')[0]);
  const profession = narrow(HTMLInputElement, byRole('checkbox', 'Show profession')[0]);
  profession.focus();
  expect(document.activeElement).toBe(profession);
  const before = profession.checked;
  // The list is still on its way: the current card takes the keyboard when it arrives.
  await vi.advanceTimersByTimeAsync(1_600);
  const current = document.querySelector<HTMLElement>('#character-switch-list button[aria-current=true]')!;
  await until(() => document.activeElement === current);
  press('Enter'); await settle();
  expect((await window.gwNative.settings.get()).characterSwitchProfession).toBe(before);
  expect(document.activeElement).toBe(current);
  expect(action() ?? '').not.toMatch(/Character/u);
});

// HUB-172: a direct shortcut for the page on top focuses it; it never stacks history or closes the Hub.
test('Command-T on Travel keeps Travel and its search; Command-B three times keeps one Build Library page', async () => {
  await mountFixture();
  press('Meta+t'); await settle();
  expect(text('.hub-caption')).toBe('Travel');
  byRole('button', 'Back', true)[0]!.focus();
  press('Meta+t'); await settle();
  expect(hubOpen()).toBe(true);
  expect(text('.hub-breadcrumbs')).toBe('Home›Travel');
  expect(document.activeElement).toBe(byRole('combobox', 'Destination, phrase, or friend')[0]);
  press('Meta+r'); press('Meta+b'); await settle();
  fill(search(), 'smiter');
  for (let presses = 0; presses < 3; presses++) press('Meta+b');
  await settle();
  expect(text('.hub-breadcrumbs')).toBe('Home›Build Library');
  expect(search().value).toBe('smiter');
  expect(document.activeElement).toBe(search());
  press('Meta+Backspace'); await settle();
  expect(text('.hub-caption')).toBe('Home');
});

test('Command-T finds a Travel page opened from Home, and a closed Hub starts Travel fresh', async () => {
  await mountFixture();
  fill(search(), 'travel'); await settle();
  expect(text('.hub-primary')).toMatch(/^Browse travel/u);
  press('Enter'); await settle();
  const travelSearch = narrow(HTMLInputElement, byRole('combobox', 'Destination, phrase, or friend')[0]);
  fill(travelSearch, 'kamadan'); await settle();
  press('Meta+t'); await settle();
  expect(text('.hub-breadcrumbs')).toBe('Home›Travel');
  expect(travelSearch.value).toBe('kamadan');
  click(byRole('button', 'Close Hub', true)[0]!); await settle();
  press('Meta+t'); await settle();
  const fresh = narrow(HTMLInputElement, byRole('combobox', 'Destination, phrase, or friend')[0]);
  expect(document.activeElement).toBe(fresh);
  expect(fresh.value).toBe('');
});

test('a held Command-R toggles once and its repeats never reach the page', async () => {
  await mountFixture();
  press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  window.gwFixtureCanvas.clear();
  // Playwright's `down('Meta')` then four `down('r')`: key-downs only, the later ones repeating.
  const down = (key: string, repeat: boolean) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, metaKey: true, repeat, bubbles: true, cancelable: true }));
  for (let presses = 0; presses < 4; presses++) down('r', presses > 0);
  document.activeElement!.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', code: 'KeyR', metaKey: true, bubbles: true, cancelable: true }));
  await settle();
  expect(hubOpen()).toBe(true);
  expect(search().value).toBe('');
  expect(canvasEvents().filter(event => event.endsWith('KeyR'))).toEqual([]);
});

test('Command-Q opens the Quit-or-Reload sheet with Reload focused, and Escape cancels it', async () => {
  await mountFixture();
  press('Meta+q'); await settle();
  expect(sheet().open).toBe(true);
  expect(document.activeElement).toBe(byRole('button', 'Reload Guild Wars')[0]);
  await escapeSheet();
  expect(sheet().open).toBe(false);
  expect(action()).toBe('Quit or reload cancelled');
  press('Meta+q'); await settle();
  click(byRole('button', 'Quit Game')[0]!); await settle();
  expect(action()).toBe('Game quit');
  expect(document.querySelector('.hub-fixture-quit')).not.toBeNull();
});

// HUB-001: the row promises the confirmation sheet, so it opens it and quits nothing.
// HUB-250: Cancel hands the task back with its search, as Resign's confirmation does.
test.each(['reload', 'quit', 'restart'])('the Quit or Reload row for "%s" opens the sheet, and Cancel returns to the search', async word => {
  await mountFixture();
  fill(search(), word); await settle();
  expect(text('#hub .hub-primary')).toContain('Review options');
  press('Enter'); await settle();
  expect(sheet().open).toBe(true);
  expect(hubOpen()).toBe(false);
  await escapeSheet();
  expect(sheet().open).toBe(false);
  expect(action()).toBe('Quit or reload cancelled');
  expect(hubOpen()).toBe(true);
  expect(search().value).toBe(word);
  expect(document.activeElement).toBe(search());
});

// PTR-28: a double-click on the row or the footer primary, or a single click on
// the row, asks for the sheet exactly once; its later click never reaches the game.
test.each([
  ['double-click on the row', 2, () => [...document.querySelectorAll('#hub .hub-row')].find(row => row.textContent?.includes('Quit or Reload Game'))!],
  ['single click on the row', 1, () => [...document.querySelectorAll('#hub .hub-row')].find(row => row.textContent?.includes('Quit or Reload Game'))!],
  ['double-click on the footer primary', 2, () => document.querySelector('#hub .hub-primary')!],
] as const)('a %s opens the Quit or Reload sheet once and quits nothing', async (_gesture, clicks, locate) => {
  await mountFixture();
  fill(search(), 'reload'); await settle();
  expect(text('#hub .hub-primary')).toContain('Review options');
  window.gwFixtureCanvas.clear();
  const target = locate();
  for (let run = 1; run <= clicks; run++) click(target, run);
  await settle(); // past the double-click interval, so a second request would have arrived
  expect(sheet().open).toBe(true);
  expect(sheet().dataset.requests).toBe('1');
  expect(canvasEvents()).toEqual([]);
  expect(document.querySelector('.hub-fixture-quit')).toBeNull();
  await escapeSheet();
  expect(action()).toBe('Quit or reload cancelled');
  expect(window.gwFixtureActions.filter(entry => /^(Game|Quit)/u.test(entry))).toEqual(['Quit or reload cancelled']);
});

// A native sheet cannot be armed, so it opens only after the press that asked for it:
// a held Enter never answers "Reload Guild Wars" with its auto-repeat.
test('a held Enter on the Quit or Reload row opens the sheet only after release', async () => {
  await mountFixture();
  fill(search(), 'reload'); await settle();
  const enter = (type: 'keydown' | 'keyup', repeat = false) => document.activeElement!.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', repeat, bubbles: true, cancelable: true }));
  for (let presses = 0; presses < 6; presses++) { enter('keydown', presses > 0); await vi.advanceTimersByTimeAsync(60); }
  expect(hubOpen()).toBe(false);
  expect(document.querySelector('.hub-fixture-sheet')?.hasAttribute('open') ?? false).toBe(false);
  enter('keyup'); await settle();
  expect(sheet().open).toBe(true);
  expect(document.activeElement).toBe(byRole('button', 'Reload Guild Wars')[0]);
  expect(action() ?? '').not.toMatch(/Game (reload|quit)/u);
  await escapeSheet();
  expect(action()).toBe('Quit or reload cancelled');
});

test('the canvas ledger records only input that reaches the game', async () => {
  await mountFixture();
  fill(search(), 'kam');
  expect(canvasEvents()).toEqual([]);
  fill(search(), ''); press('Escape'); await settle();
  expect(document.activeElement).toBe(document.getElementById('canvas'));
  window.gwFixtureCanvas.clear();
  press('w');
  expect(canvasEvents()).toEqual(['keydown:KeyW', 'keyup:KeyW']);
  expect(text('.hub-fixture-canvas-count')).toBe('Canvas input: 2');
});

test('the library switch loads 1000 builds without replacing saved fixture data', async () => {
  await mountFixture('&library=1000');
  expect(text('.hub-fixture-controls')).toContain('1000 builds');
  fill(search(), 'build swift healer 0001'); await settle();
  expect(document.querySelector('.hub-row')!.textContent).toContain('Swift Healer 0001');
  expect(localStorage.getItem('hub-fixture-library')).toBeNull();
});

test('sample trader quotes carry the sample marker', async () => {
  await mountFixture();
  fill(search(), '10 ecto in p'); await settle();
  expect([...document.querySelectorAll('#hub [role="option"]')].some(option => /60 platinum \(sample\).*Buy from trader/u.test(option.textContent ?? ''))).toBe(true);
});
