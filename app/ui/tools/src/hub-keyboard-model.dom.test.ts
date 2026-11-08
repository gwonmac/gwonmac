/**
 * The Hub keyboard model's DOM rules with the real controller in happy-dom (what
 * hub-keyboard-model.spec.ts drove in a browser): Escape on a page a shortcut opened, ↑ and ↓
 * on the Travel list, the Characters cards' roving Tab stop and search order, a Travel form
 * that keeps its own keys, an Escape during composition, and a shortcut recording that gives
 * the keys back to the game when the Hub closes. The browser's own Tab order, native text
 * insertion and scrolling stay in Playwright.
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
const hubOpen = () => hub().open && shown(hub());
const canvasKeys = () => window.gwFixtureCanvas.events.filter(event => event.type.startsWith('key')).length;
const travelSearch = () => narrow(HTMLInputElement, byRole('combobox', 'Destination, phrase, or friend')[0]);
const keydown = (target: Element, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

// HUB-005 and D-4: a page its shortcut opened has no Home step; Escape clears, then closes.
test('Escape on a page its shortcut opened clears the query, then closes without a Home step (D-4)', async () => {
  await mountFixture();
  press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  press('Meta+t'); await settle();
  expect(document.activeElement).toBe(travelSearch());
  // The hint names what Esc does here, and ⌘⌫ still has the real Home to return to.
  expect(text('.hub-legend')).toContain('⎋ Close');
  fill(travelSearch(), 'kam'); await settle();
  // A held Escape clears the query and stops there: one step per physical press.
  window.gwFixtureCanvas.clear();
  for (let presses = 0; presses < 4; presses++) keydown(document.activeElement!, { key: 'Escape', code: 'Escape', repeat: presses > 0 });
  document.activeElement!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
  await settle();
  expect(travelSearch().value).toBe('');
  expect(text('.hub-caption')).toBe('Travel');
  press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  expect(canvasKeys()).toBe(0);
  // ⌘⌫ there returns to the real Home instead, and the Characters hint names each Esc step.
  press('Meta+e'); await settle();
  expect(text('.hub-legend')).toContain('⎋ Close⌘⌫ Back');
  press('Meta+Backspace'); await settle();
  expect(text('.hub-caption')).toBe('Home');
  fill(search(), 'switch character'); press('Enter'); await settle();
  expect(text('.hub-legend')).toContain('⎋ Back');
});

test('Travel moves one selection with the shared list keys and never wraps (HUB-044, HUB-137)', async () => {
  await mountFixture();
  press('Meta+t'); await settle();
  const active = () => travelSearch().getAttribute('aria-activedescendant');
  // The palette moves its selection after a render tick, so each key waits one.
  const move = async (key: string) => { press(key); await vi.advanceTimersByTimeAsync(50); return active(); };
  expect(document.activeElement).toBe(travelSearch());
  const first = active();
  expect(await move('ArrowUp')).toBe(first);
  const last = await move('End');
  expect(last).not.toBe(first);
  expect(await move('ArrowDown')).toBe(last);
  expect(await move('Home')).toBe(first);
  expect(await move('Control+n')).not.toBe(first);
  expect(await move('Control+p')).toBe(first);
  expect(await move('PageDown')).not.toBe(first);
  expect(document.activeElement).toBe(travelSearch());
});

test('Characters: the cards are one roving Tab stop on the selected card, search leads the DOM, and ↑ in search stays (HUB-137, HUB-138)', async () => {
  await mountFixture();
  press('Meta+e'); await settle();
  const card = () => document.querySelector<HTMLElement>('#character-switch-list button[data-selected=true]')!;
  expect(document.activeElement).toBe(card());
  press('ArrowRight'); press('ArrowRight');
  const chosen = card().dataset.characterKey;
  const stops = [...document.querySelectorAll<HTMLElement>('#character-switch-list button[tabindex="0"]')];
  expect(stops.map(stop => stop.dataset.characterKey)).toEqual([chosen]);
  const query = document.getElementById('character-switch-query')!;
  const heading = document.getElementById('character-switch-title')!;
  expect(Boolean(query.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  press('ArrowUp'); expect(document.activeElement).toBe(query);
  // In the search ↑ is claimed, so the browser does not also throw the caret to the start.
  expect(query.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))).toBe(false);
  press('ArrowUp'); expect(document.activeElement).toBe(query);
});

test('Travel Customize stays form-first: typing on its controls never jumps to the Travel search (HUB-046)', async () => {
  await mountFixture();
  press('Meta+t'); await settle();
  click(byRole('button', 'Customize Travel')[0]!); await settle();
  const panel = document.getElementById('travel-customize-panel')!;
  expect(shown(panel)).toBe(true);
  for (const control of [byRole('button', '+ Add phrase')[0]!, document.querySelector<HTMLElement>('.travel-customize-shortcuts button')!]) {
    control.focus();
    press('d'); press('Backspace');
    expect(document.activeElement).toBe(control);
    expect(shown(panel)).toBe(true);
    expect(travelSearch().value).toBe('');
  }
});

test('Characters: Escape during composition keeps the query (HUB-140)', async () => {
  await mountFixture();
  press('Meta+e'); await settle();
  type('toe');
  const query = narrow(HTMLInputElement, document.getElementById('character-switch-query'));
  expect(query.value).toBe('toe');
  expect(text('.hub-legend')).toContain('⎋ Clear');
  keydown(query, { key: 'Escape', isComposing: true });
  await settle();
  expect(query.value).toBe('toe');
  expect(text('.hub-caption')).toBe('Characters');
  press('Escape'); await settle();
  expect(query.value).toBe('');
  expect(text('.hub-caption')).toBe('Characters');
});

test('closing the Hub with the mouse while a shortcut records gives the next keys back to the game (HUB-038)', async () => {
  await mountFixture();
  fill(search(), 'settings'); press('Enter'); await settle();
  const record = byRole('button', 'Change Travel shortcut', true)[0]!;
  click(record); await settle();
  expect(record.textContent).toContain('Press keys…');
  click(byRole('button', 'Close Hub', true)[0]!); await settle();
  expect(hubOpen()).toBe(false);
  window.gwFixtureCanvas.clear();
  press('w');
  expect(canvasKeys()).toBe(2);
  press('Meta+r'); await settle();
  expect(document.activeElement).toBe(search());
});

// KEY-24: Back follows the named key, and composition never navigates.
test('Hub Back follows the named key and composition never navigates (KEY-24)', async () => {
  await mountFixture();
  fill(search(), 'commands');
  for (const input of [{ key: 'Enter', code: 'Enter' }, { key: 'Backspace', code: 'Backspace' }, { key: 'Backspace', code: 'Delete', metaKey: true }]) {
    keydown(search(), { ...input, isComposing: true });
    await settle();
    expect(text('.hub-caption')).toBe('Home');
    expect(search().value).toBe('commands');
  }
  press('Enter'); await settle();
  expect(text('.hub-caption')).toBe('Commands');
  keydown(search(), { key: 'Backspace', code: 'Delete', metaKey: true });
  await settle();
  expect(text('.hub-caption')).toBe('Home');
  expect(search().value).toBe('commands');
});

/** A key whose effect lands after a render tick. */
const tick = async (chord: string) => { press(chord); await vi.advanceTimersByTimeAsync(30); };
const openTrade = async () => {
  press('Escape'); await settle(); press('Meta+k'); await settle();
  return byRole('dialog', 'Trade Chat')[0]!;
};
const tradeSearch = (trade: Element) => trade.querySelector<HTMLInputElement>('input[type=search][placeholder^="Search offers"]')!;
const saved = (trade: Element) => trade.querySelector('[aria-label="Saved trade items"]');

test('Trade: Escape and ⌘⌫ leave the Saved drawer, the Actions menu and Trader prices, and Escape a typed search, before Trade hides (HUB-120)', async () => {
  await mountFixture();
  const trade = await openTrade();
  expect(shown(trade)).toBe(true);
  click([...trade.querySelectorAll('button')].find(button => /Saved/u.test(button.textContent ?? ''))!); await settle();
  expect(saved(trade)).not.toBeNull();
  press('Escape'); await settle();
  expect(saved(trade)).toBeNull();
  expect(shown(trade)).toBe(true);
  // Opening Actions by mouse enters the same keyboard menu as ⌘J; Escape returns to its trigger without closing Trade.
  const canvas = document.getElementById('canvas')!;
  const menu = trade.querySelector<HTMLDetailsElement>('.offer-actions')!;
  canvas.focus();
  click(menu.querySelector('summary')!); await settle();
  expect(menu.hasAttribute('open')).toBe(true);
  expect(document.activeElement).toBe(menu.querySelector('[role=menuitem]'));
  press('Escape'); await settle();
  expect(menu.hasAttribute('open')).toBe(false);
  expect(shown(trade)).toBe(true);
  expect(document.activeElement).toBe(menu.querySelector('summary'));
  // The drawer takes focus when it opens; once the player clicks back into the game, Escape leaves it there.
  click([...trade.querySelectorAll('button')].find(button => /Saved/u.test(button.textContent ?? ''))!); await settle();
  expect(saved(trade)).not.toBeNull();
  canvas.focus();
  press('Escape'); await settle();
  expect(saved(trade)).toBeNull();
  expect(document.activeElement).toBe(canvas);
  window.gwFixtureCanvas.clear();
  press('w');
  expect(canvasKeys()).toBe(2);
  click([...trade.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Trader prices')!); await settle();
  const items = [...trade.querySelectorAll<HTMLElement>('[data-trader-id]')];
  items[0]!.focus();
  await tick('End');
  expect(document.activeElement).toBe(items.at(-1));
  await tick('Home');
  expect(document.activeElement).toBe(items[0]);
  press('Meta+Backspace'); await settle();
  expect(trade.getAttribute('data-view')).toBe('listings');
  expect(shown(trade)).toBe(true);
  // At the listings ⌘⌫ does nothing, not even to a typed search; Escape clears the search, then hides Trade (D-4).
  fill(tradeSearch(trade), 'ecto');
  press('Meta+Backspace'); await settle();
  expect(shown(trade)).toBe(true);
  expect(tradeSearch(trade).value).toBe('ecto');
  press('Escape'); await settle();
  expect(tradeSearch(trade).value).toBe('');
  expect(shown(trade)).toBe(true);
  press('Escape'); await settle();
  expect(shown(trade)).toBe(false);
  // A submitted search clears the same way, back to the live feed.
  press('Meta+k'); await settle();
  fill(tradeSearch(trade), 'ecto'); press('Enter'); await settle();
  const live = () => [...trade.querySelectorAll('button')].filter(button => button.textContent?.trim() === 'Live feed');
  expect(live().length).toBe(1);
  press('Escape'); await settle();
  expect(tradeSearch(trade).value).toBe('');
  expect(live().length).toBe(0);
  expect(shown(trade)).toBe(true);
});

test('the Trade ledger moves with the shared list keys (HUB-044), from search and back (HUB-024, HUB-121)', async () => {
  await mountFixture();
  const trade = await openTrade();
  const rows = () => [...trade.querySelectorAll<HTMLElement>('[role=listbox][aria-label="Trade offers"] [role=option]')];
  expect(document.activeElement).toBe(tradeSearch(trade));
  fill(tradeSearch(trade), 'arms'); await settle();
  // ↓ from search enters the ledger at the selected row; the query stays.
  press('ArrowDown');
  expect(document.activeElement).toBe(rows()[0]);
  expect(rows()[0]!.getAttribute('aria-selected')).toBe('true');
  expect(tradeSearch(trade).value).toBe('arms');
  // ↑ on the first row returns to search.
  press('ArrowUp');
  expect(document.activeElement).toBe(tradeSearch(trade));
  fill(tradeSearch(trade), ''); await settle();
  press('Control+n');
  expect(document.activeElement).toBe(rows()[0]);
  press('End');
  expect(document.activeElement).toBe(rows().at(-1));
  press('ArrowDown');
  expect(document.activeElement).toBe(rows().at(-1));
  press('Home');
  expect(document.activeElement).toBe(rows()[0]);
  press('Control+n');
  expect(document.activeElement).toBe(rows()[1]);
  // The move steps from the focused row, not from an older selection.
  rows()[3]!.focus();
  await tick('ArrowDown');
  expect(document.activeElement).toBe(rows()[4]);
  expect(rows()[4]!.getAttribute('aria-selected')).toBe('true');
});
