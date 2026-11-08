/**
 * The Hub's navigation rules with the real controller in happy-dom (what
 * hub-navigation-window.spec.ts drove in a browser): Back from the keyboard, the breadcrumb and
 * the mouse back button restores the parent exactly and never runs a row, held presses never go
 * further than one level, list keys never wrap and keep the keyboard in search, the Characters
 * carousel takes the same keys, a view's inner level answers ⌘⌫ before the view, and Actions
 * offers Pin to Hub in a template folder. Window size and geometry, the scroll position kept by
 * Back, the browser's own Tab order and reloads stay in Playwright.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, narrow, press, settle, shown, type, unmountFixture } from './hub-fixture-harness';
import type { HubFixtureWindow } from '../tests/fixture-window';

// The workbench page sets the fixture hooks; a renamed or removed hook fails to type-check here.
declare const window: HubFixtureWindow;

beforeAll(loadFixture);
afterEach(unmountFixture);

const hub = () => narrow(HTMLDialogElement, document.getElementById('hub'));
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
const caption = () => text('.hub-caption');
const crumbs = () => text('.hub-breadcrumbs');
const selectedRow = () => document.querySelector<HTMLElement>('#hub .hub-row[aria-selected="true"]');
const announced = () => document.querySelector('#hub .hub-announce')!;
const action = () => document.getElementById('app')!.dataset.action ?? '';
const hubOpen = () => hub().open && shown(hub());
const caret = () => [search().selectionStart, search().selectionEnd];
/** A key whose effect lands after a render tick. */
const tick = async (chord: string) => { press(chord); await vi.advanceTimersByTimeAsync(30); };
const keydown = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
/**
 * A held key: one key-down and then `repeats` repeating ones, then the key-up, with the browser's
 * default (delete one character) only when nothing prevented the key-down.
 */
function hold(key: string, repeats: number, modifiers: KeyboardEventInit = {}) {
  const field = narrow(HTMLInputElement, document.activeElement);
  for (let presses = 0; presses <= repeats; presses++) {
    const allowed = keydown(document.activeElement!, { key, code: key, repeat: presses > 0, ...modifiers });
    if (allowed && key === 'Backspace' && !modifiers.metaKey && field instanceof HTMLInputElement && field.value) {
      field.value = field.value.slice(0, -1); field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
  }
  document.activeElement!.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, ...modifiers }));
}
/** The mouse back button (button 3) released over the Hub, as macOS sends it. */
const mouseBack = (times = 1) => { for (let presses = 0; presses < times; presses++) (document.querySelector('#hub .hub-row') ?? hub()).dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true })); };
const rowIds = () => [...document.querySelectorAll<HTMLElement>('#hub .hub-row')].map(row => row.textContent);

test('Command-Backspace and breadcrumb ancestors restore history; Backspace only edits text', async () => {
  await mountFixture();
  const back = () => document.querySelector<HTMLElement>('.hub-back')!;
  expect(shown(back())).toBe(false);
  fill(search(), 'accounts'); press('Enter'); await settle();
  fill(search(), 'second'); press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Accounts›Second');
  expect(back().getAttribute('title')).toBe('Back (⌘⌫)');
  expect(back().getAttribute('aria-keyshortcuts')).toBe('Meta+Backspace');
  expect(back().getAttribute('aria-description')).toBe('Return to Accounts');
  expect(text('.hub-legend')).toContain('⌘⌫ Back');
  fill(search(), 'keep'); press('Backspace');
  expect(search().value).toBe('kee');
  expect(caption()).toBe('Second');
  // An empty query is a no-op for Backspace, held or not: it never leaves the page.
  fill(search(), ''); hold('Backspace', 3); await settle();
  expect(caption()).toBe('Second');
  // Command-Backspace goes back exactly one level, without clearing the child query first, and a held one never goes further.
  fill(search(), 'child');
  hold('Backspace', 3, { metaKey: true }); await settle();
  expect(search().value).toBe('second');
  expect(caption()).toBe('Accounts');
  // Focus stays in search, so its description names the page a screen reader has returned to.
  expect(search().getAttribute('aria-description')).toBe('Accounts: search actions');
  press('Meta+Backspace'); await settle();
  expect(search().getAttribute('aria-description')).toBe('Home: search tools or use a command example');
  press('Enter'); await settle();
  click([...document.querySelectorAll<HTMLElement>('.hub-breadcrumbs button')].find(button => button.textContent === 'Home')!); await settle();
  expect(search().value).toBe('accounts');
  expect(caption()).toBe('Home');
  expect(shown(back())).toBe(false);
});

test('arrows connect Hub results, character carousel, search and Back', async () => {
  await mountFixture();
  fill(search(), 'switch character'); await tick('ArrowDown');
  // D-2: arrows move the selection while focus stays in search; no wrap at the top.
  expect(selectedRow()!.textContent).toContain('Switch Character');
  await tick('ArrowUp');
  expect(document.activeElement).toBe(search());
  expect(selectedRow()!.textContent).toContain('Switch Character');
  press('Enter'); await settle();
  const selected = () => document.querySelector<HTMLElement>('.character-switch-row[data-selected=true]')!;
  expect(document.activeElement).toBe(selected());
  await tick('ArrowRight'); expect(selected().textContent).toContain('Fixture Ranger');
  await tick('ArrowLeft'); expect(selected().textContent).toContain('Fixture Monk');
  await tick('ArrowUp');
  const picker = document.querySelector<HTMLInputElement>('.character-switch-search input')!;
  expect(document.activeElement).toBe(picker);
  // The search is the top of the view: ↑ there stays (HUB-137).
  await tick('ArrowUp'); expect(document.activeElement).toBe(picker);
  await tick('ArrowDown'); expect(document.activeElement).toBe(selected());
  // Backspace never navigates; Command-Backspace returns from the card to Home.
  await tick('Backspace');
  expect(caption()).toBe('Characters');
  await tick('Meta+Backspace'); await settle();
  expect(search().value).toBe('switch character');
  expect(action()).not.toMatch(/Character/u);
});

test('one list move keeps focus in search: arrows, Control-N/P, pages and ends never wrap', async () => {
  await mountFixture();
  const rows = () => [...document.querySelectorAll<HTMLElement>('.hub-row')];
  const count = rows().length;
  expect(count).toBeGreaterThan(8);
  const at = (index: number) => expect(rows()[index]!.getAttribute('aria-selected')).toBe('true');
  at(0);
  await tick('ArrowUp'); at(0);
  await tick('Control+n'); at(1);
  await tick('Control+p'); at(0);
  await tick('PageDown');
  expect(selectedRow()!.id).not.toBe('hub-result-0');
  await tick('End'); at(count - 1);
  await tick('ArrowDown'); at(count - 1);
  await tick('Home'); at(0);
  expect(document.activeElement).toBe(search());
  expect(search().getAttribute('aria-activedescendant')).toBe('hub-result-0');
  // The results scroller is no Tab stop (HUB-045).
  expect(document.getElementById('hub-results')!.getAttribute('tabindex')).toBe('-1');
  fill(search(), 'build smiter'); press('Enter'); await settle();
  fill(search(), 'hero'); press('Enter'); await settle();
  expect(caption()).toBe('Heroes');
  await tick('End');
  expect(selectedRow()!.textContent).toContain('Zhed Shadowhoof');
  expect(document.activeElement).toBe(search());
  await tick('Home');
  expect(selectedRow()!.textContent).toContain('Livia');
  await tick('Control+n');
  expect(selectedRow()!.textContent).toContain('Master of Whispers');
  expect(document.activeElement).toBe(search());
  press('Meta+r'); fill(search(), ''); await settle();
  // A click on a navigational row opens it and leaves the keyboard in search.
  click(document.querySelector('.hub-row[data-id="commands"]')!); await settle();
  expect(caption()).toBe('Commands');
  expect(document.activeElement).toBe(search());
});

test.each([['End', 'last', true], ['Home', 'first', false], ['PageUp', 'first', false], ['ArrowUp', 'first', false], ['ArrowDown', 'first', false], ['Control+n', 'first', false], ['PageDown', 'first', false]] as const)(
  'one list move from no selection: %s selects the %s result, never a guess', async (key, _which, last) => {
    await mountFixture('&party');
    // A bare consequential scope preselects nothing, so Enter can never invite on a guess.
    fill(search(), 'invite '); await settle();
    const rows = () => [...document.querySelectorAll<HTMLElement>('#hub .hub-row')];
    expect(rows().length).toBeGreaterThan(2);
    expect(selectedRow()).toBeNull();
    const count = rows().length;
    await tick(key);
    expect(rows()[last ? count - 1 : 0]!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(search());
  });

test('the Characters carousel takes the same list move and never wraps', async () => {
  await mountFixture();
  press('Meta+e'); await settle();
  const cards = () => [...document.querySelectorAll<HTMLElement>('.character-switch-list button[data-row]')];
  const focusedRow = () => {
    const active = document.activeElement;
    return active instanceof HTMLElement ? Number(active.dataset.row ?? -1) : -1;
  };
  const state = window.gwCharacterSwitch?.characters;
  const count = state?.status === 'ready' ? state.characters.length : 0;
  expect(count).toBeGreaterThan(5);
  expect(document.activeElement).toBe(cards()[0]);
  const previous = narrow(HTMLButtonElement, byRole('button', 'Previous character')[0]);
  const next = narrow(HTMLButtonElement, byRole('button', 'Next character')[0]);
  expect(previous.disabled).toBe(true);
  // Up leaves the cards for the character search (plan §3), so it is no list step here.
  for (const key of ['ArrowLeft', 'Home', 'PageUp', 'Control+p']) { await tick(key); expect(focusedRow(), key).toBe(0); }
  await tick('Control+n'); expect(focusedRow()).toBe(1);
  await tick('ArrowRight'); expect(focusedRow()).toBe(2);
  await tick('End'); expect(focusedRow()).toBe(count - 1);
  expect(next.disabled).toBe(true);
  for (const key of ['ArrowRight', 'ArrowDown', 'End', 'PageDown', 'Control+n']) { await tick(key); expect(focusedRow(), key).toBe(count - 1); }
  await tick('PageUp'); expect(focusedRow()).toBeLessThan(count - 1);
  await tick('Home'); expect(focusedRow()).toBe(0);
  expect(document.activeElement).toBe(document.querySelector('.character-switch-list button[aria-selected="true"], .character-switch-list button[data-selected="true"]'));
  expect(action()).not.toMatch(/Character/u);
});

// The engine keeps the list's keys even with no rows; hub.ts must then stop the caret and the selection moving.
test('list keys without results are claimed, so the caret and the text selection stay in search', async () => {
  await mountFixture();
  fill(search(), 'qqqzzz'); await settle();
  expect(document.querySelector('.hub-empty')).not.toBeNull();
  for (const [key, init] of [['ArrowDown', {}], ['ArrowUp', {}], ['End', {}], ['Home', {}], ['PageDown', {}], ['n', { ctrlKey: true }]] as const) {
    expect(keydown(search(), { key, code: key, ...init }), key).toBe(false);
  }
  // Delete is the browser's: it removes the selection.
  expect(keydown(search(), { key: 'Delete', code: 'Delete' })).toBe(true);
});

test('a view whose first buttons are disabled still takes focus, and Command-Backspace leaves it', async () => {
  await mountFixture();
  fill(search(), 'hub preferences');
  keydown(search(), { key: 'Enter', code: 'Enter' }); await settle();
  expect(caption()).toBe('Hub preferences');
  // Nothing is pinned, so Remove all search phrases is disabled; focus goes to the first usable control.
  expect((narrow(HTMLButtonElement, byRole('button', 'Remove all search phrases…', true)[0])).disabled).toBe(true);
  expect(document.activeElement).toBe(byRole('button', 'Reset Hub position', true)[0]);
  document.activeElement!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  expect(document.activeElement).not.toBe(document.body);
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('hub preferences');
  expect(document.activeElement).toBe(search());
});

test('Command-Backspace goes back one Build Library level, restores the parent and speaks its title (BLD-24)', async () => {
  await mountFixture();
  expect(announced().getAttribute('aria-live')).toBe('polite');
  expect(announced().textContent).toBe('');
  fill(search(), 'build smi');
  // Playwright's two ←: the caret ends two characters before the end.
  search().setSelectionRange(7, 7); press('ArrowLeft'); press('ArrowLeft'); await settle();
  expect(selectedRow()!.textContent).toContain('Smiter');
  press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Smiter');
  press('ArrowDown'); press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Smiter›Heroes');
  type('liv');
  // One press: back to the target page without clearing the child query first, and the title is spoken.
  press('Meta+Backspace'); await settle();
  expect(crumbs()).toBe('Home›Smiter');
  expect(search().value).toBe('');
  expect(document.activeElement).toBe(search());
  expect(selectedRow()!.textContent).toContain('Apply to hero');
  expect(announced().textContent).toBe('Smiter');
  // A held press goes back one more level only, to the query with its caret and selection.
  hold('Backspace', 25, { metaKey: true }); await vi.advanceTimersByTimeAsync(30);
  expect(crumbs()).toBe('Home');
  expect(search().value).toBe('build smi');
  expect(caret()).toEqual([7, 7]);
  expect(selectedRow()!.textContent).toContain('Smiter');
  // A delayed result count must not replace the destination spoken for Back.
  await vi.advanceTimersByTimeAsync(550);
  expect(announced().textContent).toBe('Home');
  // The same destination twice still changes the region's text, so it is spoken again.
  // No time passes between the two presses, so the first announcement is still the region's text.
  press('Enter'); press('Meta+Backspace'); await vi.advanceTimersByTimeAsync(30);
  expect(announced().textContent).toBe('Home\u00a0');
  expect(window.gwFixtureCanvas.events.length).toBe(0);
});

test('a page opened directly returns to the real Home, and Home ignores Command-Backspace', async () => {
  await mountFixture();
  fill(search(), 'kam');
  press('Meta+Backspace'); await settle();
  expect(hubOpen()).toBe(true);
  expect(search().value).toBe('kam');
  expect(text('.hub-legend')).not.toContain('⌘⌫');
  press('Escape'); press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  // Command-E opens Characters with no parent page; Back from its focused card goes to Home.
  press('Meta+e'); await settle();
  expect(caption()).toBe('Characters');
  expect(document.activeElement).toBe(document.querySelector('.character-switch-row[data-selected=true]'));
  expect(shown(document.querySelector('.hub-back')!)).toBe(true);
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Home');
  expect(hubOpen()).toBe(true);
  expect(document.activeElement).toBe(search());
});

test('Command-Backspace steps out of a view\'s own inner level before it leaves the view', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  const title = () => text('#character-switch-title');
  const selectedCard = () => document.querySelector('.character-switch-row[data-selected=true]');
  // On a confirmation it acts as Cancel, like Esc and Stay here. One a Hub row asked for
  // returns to that row (HUB-075); one a card asked for returns to the cards.
  fill(search(), 'char toefte'); press('Enter'); await settle();
  expect(title()).toBe('Leave this area and switch to Toefte?');
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('char toefte');
  press('Meta+e'); await settle();
  expect(caption()).toBe('Characters');
  press('End'); press('Enter'); await settle();
  expect(title()).toBe('Leave this area and switch to Fixture Warrior?');
  press('Meta+Backspace'); await settle();
  expect(title()).toBe('Switch Character');
  expect(caption()).toBe('Characters');
  expect(document.activeElement).toBe(selectedCard());
  expect(action()).not.toMatch(/Character/u);
  // Characters settings return to the cards; the next press leaves Characters.
  click(byRole('button', 'Character Switch settings', true)[0]!); await settle();
  expect(shown(document.querySelector('.character-switch-settings')!)).toBe(true);
  press('Meta+Backspace'); await settle();
  expect(document.querySelector('.character-switch-settings') === null || !shown(document.querySelector('.character-switch-settings')!)).toBe(true);
  expect(caption()).toBe('Characters');
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('char toefte');
  // Travel Customize returns to the destination list; an open picker closes first.
  press('Meta+t'); await settle();
  click(byRole('button', 'Customize Travel', true)[0]!); await settle();
  const customize = document.getElementById('travel-customize-panel')!;
  expect(shown(customize)).toBe(true);
  click(byRole('button', 'shortcut 1').find(button => customize.contains(button))!); await settle();
  const picker = customize.querySelector<HTMLDetailsElement>('details.travel-destination-picker')!;
  click(picker.querySelector('summary')!); await settle();
  expect(picker.hasAttribute('open')).toBe(true);
  press('Meta+Backspace'); await settle();
  expect(picker.hasAttribute('open')).toBe(false);
  expect(shown(customize)).toBe(true);
  press('Meta+Backspace'); await settle();
  expect(shown(customize)).toBe(false);
  expect(caption()).toBe('Travel');
  expect(document.activeElement).toBe(document.getElementById('travel-search-input'));
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Home');
});

test('the mouse back button goes back one level, restores the parent exactly and never runs a row (PTR-33, KEY-26)', async () => {
  await mountFixture();
  // An account page: the parent's query, caret and selection come back, and the pointer's row is not taken.
  fill(search(), 'acc s'); await tick('ArrowDown');
  expect(selectedRow()!.textContent).toContain('Second');
  const second = selectedRow()!.dataset.id;
  press('Enter'); await settle();
  expect(caption()).toBe('Second');
  window.gwFixtureCanvas.clear();
  mouseBack(); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('acc s');
  expect(document.activeElement).toBe(search());
  expect(caret()).toEqual([5, 5]);
  expect(selectedRow()!.dataset.id).toBe(second);
  expect(document.querySelectorAll('#hub .hub-row[aria-selected="true"]').length).toBe(1);
  expect(announced().textContent).toBe('Home');
  // Settings, low on Home: Back restores its selection.
  fill(search(), ''); await settle();
  await tick('End');
  while (selectedRow()!.dataset.id !== 'settings') await tick('ArrowUp');
  press('Enter'); await settle();
  expect(caption()).toBe('Settings');
  mouseBack(); await settle();
  expect(caption()).toBe('Home');
  expect(selectedRow()!.dataset.id).toBe('settings');
  // The Smiter target page: the row under the pointer is never applied.
  fill(search(), 'build smiter'); press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Smiter');
  mouseBack(); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('build smiter');
  expect(selectedRow()!.textContent).toContain('Smiter');
  await vi.advanceTimersByTimeAsync(300);
  expect(hubOpen()).toBe(true);
  expect(window.gwFixtureActions).toEqual([]);
  expect(window.gwFixtureCanvas.events.filter(event => !event.type.startsWith('key'))).toEqual([]);
});

test('the mouse back button at Home does nothing and never closes the Hub (PTR-34)', async () => {
  await mountFixture();
  fill(search(), 'kam'); await settle();
  // Finish the query announcement before checking that mouse Back adds nothing.
  expect(announced().textContent).toBe('2 results');
  const selection = selectedRow()!.dataset.id;
  window.gwFixtureCanvas.clear();
  mouseBack(); mouseBack(3);
  await vi.advanceTimersByTimeAsync(300);
  expect(hubOpen()).toBe(true);
  expect(caption()).toBe('Home');
  expect(search().value).toBe('kam');
  expect(document.activeElement).toBe(search());
  expect(selectedRow()!.dataset.id).toBe(selection);
  expect(announced().textContent).toBe('2 results');
  expect(window.gwFixtureActions).toEqual([]);
  expect(window.gwFixtureCanvas.events.filter(event => !event.type.startsWith('key'))).toEqual([]);
});

test('a held Command-Backspace on a person page goes back one level to the people list (PPL-29)', async () => {
  await mountFixture('&party');
  fill(search(), 'mo'); await settle();
  while (selectedRow()!.dataset.id !== 'person:kai mo bearer') await tick('ArrowDown');
  press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Kai Mo Bearer');
  window.gwFixtureCanvas.clear();
  // About a second of auto-repeat: one keydown and 25 repeats.
  hold('Backspace', 25, { metaKey: true }); await settle();
  expect(crumbs()).toBe('Home');
  expect(hubOpen()).toBe(true);
  expect(search().value).toBe('mo');
  expect(document.activeElement).toBe(search());
  expect(caret()).toEqual([2, 2]);
  expect(selectedRow()!.dataset.id).toBe('person:kai mo bearer');
  expect(announced().textContent).toBe('Home');
  expect(window.gwFixtureCanvas.events.length).toBe(0);
});

test('a held Backspace on a person page or an empty Build Library folder never leaves it or removes anything (PPL-30, BLD-25)', async () => {
  await mountFixture('&party');
  fill(search(), 'romi'); press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Romi Ranger');
  const actions = rowIds();
  window.gwFixtureCanvas.clear();
  hold('Backspace', 25); await settle();
  expect(crumbs()).toBe('Home›Romi Ranger');
  expect(search().value).toBe('');
  expect(document.activeElement).toBe(search());
  expect(rowIds()).toEqual(actions);
  // Build Library › Guild Wars templates › Monk with an empty query: two seconds of repeats.
  press('Meta+Backspace'); await settle();
  fill(search(), 'build library'); press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Build Library');
  click(document.querySelector('.hub-row[data-id="game-templates"]')!); await settle();
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates');
  while (!selectedRow()!.textContent?.startsWith('Monk')) await tick('ArrowDown');
  press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates›Monk');
  const builds = rowIds();
  hold('Backspace', 50); await settle();
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates›Monk');
  expect(rowIds()).toEqual(builds);
  expect(window.gwFixtureCanvas.events.length).toBe(0);
  expect(window.gwFixtureActions).toEqual([]);
});

test('a build in a template folder offers Pin to Hub and a search phrase in Actions (HUB-091)', async () => {
  await mountFixture();
  fill(search(), 'build library'); press('Enter'); await settle();
  click(document.querySelector('.hub-row[data-id="game-templates"]')!); await settle();
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates');
  while (!selectedRow()!.textContent?.startsWith('Monk')) await tick('ArrowDown');
  press('Enter'); await settle();
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates›Monk');
  fill(search(), 'protection'); await settle();
  expect(selectedRow()!.dataset.id).toMatch(/^build:/u);
  const id = selectedRow()!.dataset.id!;
  press('Meta+j'); await settle();
  const menu = () => byRole('menu', 'Actions')[0]!;
  expect([...menu().querySelectorAll('[role=menuitem]')].map(item => item.textContent?.trim())).toEqual([expect.stringMatching(/^Choose target/u), 'Show build details', 'Pin to Hub', 'Set search phrase…']);
  click(byRole('menuitem', 'Pin to Hub')[0]!); await settle();
  expect(text('#hub .hub-status')).toBe('Pinned Protection.');
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates›Monk');
  press('Meta+j'); await settle();
  expect(byRole('menuitem', 'Unpin from Hub').length).toBe(1);
  press('Escape'); await settle();
  click([...document.querySelectorAll<HTMLElement>('.hub-breadcrumbs button')].find(button => button.textContent === 'Home')!); await settle();
  fill(search(), ''); await settle();
  expect(text('#hub .hub-group')).toBe('Pinned');
  expect(document.querySelector(`#hub .hub-row[data-id="${id}"]`)).not.toBeNull();
});

// HUB-048: a held Backspace only edits; it never leaves Travel or its picker, nor eats Home's query.
test('a held Backspace empties Travel\'s search and leaves Travel, its picker and Home\'s query alone', async () => {
  await mountFixture();
  fill(search(), 'trav'); await settle();
  expect(selectedRow()!.dataset.id).toBe('travel');
  press('Enter'); await settle();
  expect(caption()).toBe('Travel');
  const travelSearch = narrow(HTMLInputElement, document.getElementById('travel-search-input'));
  fill(travelSearch, 'kam'); await settle();
  hold('Backspace', 6); await settle();
  expect(caption()).toBe('Travel');
  expect(travelSearch.value).toBe('');
  expect(document.activeElement).toBe(travelSearch);
  click(byRole('button', 'Customize Travel', true)[0]!); await settle();
  const customize = document.getElementById('travel-customize-panel')!;
  click(byRole('button', 'shortcut 1').find(button => customize.contains(button))!); await settle();
  const picker = customize.querySelector<HTMLDetailsElement>('details.travel-destination-picker')!;
  click(picker.querySelector('summary')!); await settle();
  const pickerSearch = picker.querySelector('input')!;
  pickerSearch.focus();
  expect(pickerSearch.value).toBe('');
  hold('Backspace', 6); await settle();
  expect(shown(customize)).toBe(true);
  expect(caption()).toBe('Travel');
  press('Meta+Backspace'); press('Meta+Backspace'); press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('trav');
});
