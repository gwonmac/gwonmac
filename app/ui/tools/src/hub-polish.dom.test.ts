/**
 * The Hub's polish rules that need no real browser, from the old hub-polish, hub-sweep,
 * hub-people-polish, hub-workspace-polish and hub-currency-icons specs: what the team preview
 * and Home show and teach, canonical tool names, what a friend page does when its game action is
 * unavailable, the Actions menu of a friend, Whispers' single hide control, Trade and team
 * authoring state through actions and reopening, and the calculation layer's art. Runs the real
 * Hub on the fixture page. Geometry, CSS, native caret, undo and reload stay in the specs.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, press, settle, shown, unmountFixture } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const search = () => q<HTMLInputElement>('.hub-search input')!;
const primary = () => q<HTMLButtonElement>('.hub-primary')!;
const caption = () => q('.hub-caption')?.textContent;
const action = () => document.getElementById('app')!.dataset.action;
const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const selected = () => q('.hub-row[aria-selected=true]');
async function ask(query: string) { fill(search(), query); await settle(); }
const settings = (detail: object) => window.dispatchEvent(new CustomEvent('hub-fixture-settings', { detail }));
const button = (name: string, exact = true) => byRole('button', name, exact)[0]!;
// The Actions button's name includes its (hidden) keycaps, so it is found by its start.

// hub-polish
test('the full team preview names its heroes and hides template paths, and runs nothing', async () => {
  await mountFixture();
  await ask('team gom afk');
  expect(text(q('.hub-preview'))).toContain('8. Vekk');
  expect(text(q('.hub-preview'))).not.toContain('Templates/');
  expect(action() ?? '').not.toMatch(/command|apply/u);
});

test('Home separates current context, teaches commands, and shows resolved shortcuts', async () => {
  await mountFixture();
  expect(text(q('.hub-context'))).toContain("Lion's Arch");
  await ask('trade');
  expect(text(q('.hub-hint'))).toContain('trade <item>');
  expect(all('.hub-row-type kbd').map(element => element.textContent)).toEqual(['⌘', 'K']);
  settings({ shortcutOverrides: { 'trade.toggle': null } }); await settle();
  expect(all('.hub-row-type kbd')).toHaveLength(0);
  await ask('team');
  expect(text(q('.hub-hint'))).toContain('team <name>');
  await ask('team gom afk');
  expect(q('.hub-scope')!.textContent).toBe('team');
  expect(text(q('.hub-legend'))).toContain('⎋ Clear');
  click(button('Actions', false)); await settle();
  expect(shown(byRole('menu', 'Actions')[0]!)).toBe(true);
  press('Escape'); await settle();
  expect(byRole('menu', 'Actions').filter(shown)).toHaveLength(0);
  expect(search().value).toBe('team gom afk');
  press('ArrowRight'); await settle();
  expect(text(q('.hub-legend'))).toContain('⎋ Back');
  expect([button('Back').getAttribute('title'), button('Back').getAttribute('aria-description')]).toEqual(['Back (⌘⌫)', 'Return to Home']);
  click(button('Back')); await settle();
  expect(search().value).toBe('team gom afk');
});

test('a scoped list names what its search searches, as placeholder and accessible name (HUB-096)', async () => {
  await mountFixture();
  expect(search().getAttribute('aria-label')).toBe('Search people, places, builds…');
  await ask('build smiter'); press('Enter'); await settle();
  await ask('hero'); press('Enter'); await settle();
  expect([search().getAttribute('placeholder'), search().getAttribute('aria-label')]).toEqual(['Search heroes…', 'Search heroes…']);
});

// hub-sweep
test.each([['travel', 'travel', 'Travel'], ['character', 'character', 'Switch Character'], ['storage', 'storage', 'Xunlai Storage'], ['build library', 'builds', 'Build Library'], ['trade', 'trade', 'Trade Chat'], ['whispers', 'whispers', 'Whispers']])(
  'a search for "%s" lists its tool by the canonical name (HUB-180)', async (query, id, name) => {
    await mountFixture();
    await ask(query);
    expect(text(q(`.hub-row[data-id="${id}"] .hub-title`))).toBe(name);
  });

// hub-people-polish
test.each([['off', 'Romi', 'Romi Ranger'], ['waiting', 'Zed Alpha', 'Zed Alpha']] as const)(
  'a friend page never guesses a game action when Whispers is %s (HUB-201)', async (unavailable, query, person) => {
    await mountFixture('&party');
    if (unavailable === 'off') settings({ whispersEnabled: false }); else window.dispatchEvent(new Event('hub-fixture-unavailable'));
    await settle();
    await ask(query); press('Enter'); await settle();
    expect(caption()).toBe(person);
    if (unavailable === 'off') expect(search().getAttribute('aria-activedescendant') ?? '').toBe('');
    else expect([selected()!.getAttribute('data-id'), selected()!.getAttribute('aria-disabled')]).toEqual(['person:whisper', 'true']);
    press('Enter'); await settle();
    expect(action() ?? '').not.toMatch(/TRAVEL|INVITE/u);
    expect(shown(document.getElementById('hub')!)).toBe(true);
    press('ArrowDown'); await settle();
    expect(primary().textContent).toContain('Travel');
  });

test('a friend root Actions menu exposes the same four explicit person actions', async () => {
  await mountFixture('&party');
  await ask('Romi');
  press('Meta+j'); await settle();
  const menu = byRole('menu', 'Actions', true)[0]!;
  expect(shown(menu)).toBe(true);
  const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
  expect(items.map(item => text(item))).toEqual([expect.stringContaining('View actions'), expect.stringContaining('Write whisper'), expect.stringContaining('Travel to'), expect.stringContaining('Invite Romi Ranger'), expect.stringContaining('Travel and invite Romi Ranger')]);
  expect(items.find(item => text(item).startsWith('Travel and invite Romi Ranger'))!.getAttribute('aria-description')).toBe('You are already in this outpost');
  expect(action() ?? '').not.toMatch(/TRAVEL|INVITE/u);
  press('Escape'); await settle();
  expect(document.activeElement).toBe(search());
  press('Enter'); await settle();
  expect(all('#hub [role=option]').map(option => text(option))).toEqual([expect.stringContaining('Whisper'), expect.stringContaining('Travel to outpost'), expect.stringContaining('Invite to party'), expect.stringContaining('Travel and invite')]);
});

test('Whispers has one hide control and its resize grip stays outside normal Tab order', async () => {
  await mountFixture();
  await ask('whisper Foo'); press('Enter'); await settle();
  const window = q('#whisper-window')!;
  expect(shown(window)).toBe(true);
  expect(byRole('button', 'Hide Whispers').concat(byRole('button', 'Collapse whispers')).filter(element => window.contains(element))).toHaveLength(1);
  expect(byRole('button', 'Resize whispers', true)[0]!.getAttribute('tabindex')).toBe('-1');
});

test('a withdrawn selected friend announces the loss and never substitutes a game action', async () => {
  await mountFixture('&party');
  await ask('Romi');
  expect(text(selected())).toContain('Romi Ranger');
  window.dispatchEvent(new Event('hub-fixture-withdraw')); await settle();
  expect(search().getAttribute('aria-activedescendant') ?? '').toBe('');
  expect(q('.hub-status')!.textContent).toBe('The previous selection is no longer available. Choose a result.');
  press('Enter'); await settle();
  expect(action() ?? '').not.toMatch(/TRAVEL|INVITE/u);
});

// hub-workspace-polish
test('Trade retains its offer through actions and reopening', async () => {
  await mountFixture();
  await ask('trade'); press('Enter'); await settle();
  expect(shown(byRole('listbox', 'Trade offers')[0]!)).toBe(true);
  click(byRole('option', 'Silver Wayfarer:')[0]!); await settle();
  const inspector = () => q('.trade-inspector[aria-label="Offer from Silver Wayfarer"]')!;
  expect(text(inspector())).toContain('105 consets');
  const summary = q('.offer-actions > summary')!;
  click(summary); await settle();
  expect(q('.offer-actions')!.hasAttribute('open')).toBe(true);
  expect(shown(byRole('menuitem', 'Copy offer', true)[0]!)).toBe(true);
  summary.focus(); press('Escape'); await settle();
  expect(q('.offer-actions')!.hasAttribute('open')).toBe(false);
  expect(shown(inspector())).toBe(true);
  expect(shown(document.getElementById('hub')!)).toBe(false);
  click(byRole('button', 'Close Trade Chat', true)[0]!); await settle();
  press('Meta+k'); await settle();
  expect(text(inspector())).toContain('105 consets');
  expect(shown(byRole('button', 'Whisper Silver Wayfarer')[0]!)).toBe(true);
});

async function openTeamEditor() {
  click(byRole('button', 'Close Hub', true)[0]!); press('Meta+b'); await settle();
  // The team's list row carries a "Favourite" mark, as the browser spec's accessible name.
  click(all('button').find(element => element.querySelector('[aria-label="Favourite"]') && element.textContent?.includes('GOM AFK'))!); await settle();
}
test('team authoring keeps its options and persisted edits through reopening', async () => {
  await mountFixture();
  await openTeamEditor();
  expect(q('.team-options')!.hasAttribute('open')).toBe(false);
  click(q('.team-options > summary')!); await settle();
  click(button('Normal')); await settle();
  expect(text(q('.team-options > summary'))).toContain('Normal Mode');
  click(q('.team-options > summary')!); await settle();
  expect(text(q('.team-actions'))).toContain('update 8 builds');
  click(byRole('button', 'Close Build Library', true)[0]!); press('Meta+b'); await settle();
  expect(document.querySelector<HTMLInputElement>('#team-name')?.value).toBe('GOM AFK');
  expect(text(q('.team-options > summary'))).toContain('Normal Mode');
  expect(action() ?? '').not.toMatch(/command|apply/u);
});

test('team options stay usable in a constrained Hub', async () => {
  await mountFixture();
  await openTeamEditor();
  click(q('.team-options > summary')!); await settle();
  click(button('Normal')); await settle();
  expect(text(q('.team-options > summary'))).toContain('Normal Mode');
});

// hub-currency-icons
const overlay = () => q('.hub-search-glyphs')!;
const art = (unit?: string) => all(`.hub-search-glyphs img${unit ? `[data-unit="${unit}"]` : ''}`);
test('a calculation draws its currency art over the typed text, and other searches draw none', async () => {
  await mountFixture();
  fill(search(), '10 ectos in p'); await settle();
  expect([art('ecto').length, art('platinum').length, overlay().getAttribute('aria-hidden'), document.activeElement === search()]).toEqual([1, 1, 'true', true]);
  fill(search(), '10 ectos in '); await settle();
  expect(art('platinum')).toHaveLength(0);
  fill(search(), 'travel 10 ectos in p'); await settle();
  expect(shown(overlay()) && art().length > 0).toBe(false);
  fill(search(), 'char 1a in e'); await settle();
  expect(shown(overlay()) && art().length > 0).toBe(false);
});

test('currency art holds still while an input method composes, and catches up when it ends', async () => {
  await mountFixture();
  fill(search(), '10 ectos in p'); await settle();
  expect(art()).toHaveLength(2);
  const before = overlay().innerHTML;
  search().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  fill(search(), '1a in e'); await settle();
  expect(overlay().innerHTML).toBe(before);
  search().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); await settle();
  expect([art('armbrace').length, search().value]).toEqual([1, '1a in e']);
  fill(search(), ''); await settle();
  expect([shown(overlay()), art().length]).toEqual([false, 0]);
  fill(search(), '1a in e'); await settle();
  expect(art()).toHaveLength(2);
});
