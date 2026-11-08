/**
 * What the Hub's pointer spec also held, with the real fixture, Hub controller and views in
 * happy-dom: the armed confirmation of a replaced account, right-click (HUB-248) on rows,
 * Travel destinations and character cards, Hub preferences (pins, moves, removals, phrases,
 * the Actions slot) and the footer every view keeps. The click runs are in hub-pointer.dom.test.ts.
 */
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, press, settle, shown, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const caption = () => document.querySelector('.hub-caption')!.textContent;
const primary = () => document.querySelector<HTMLElement>('.hub-primary')!;
const row = (text: string) => [...document.querySelectorAll<HTMLElement>('#hub .hub-row')].find(candidate => candidate.textContent!.includes(text))!;
const byId = (id: string) => document.querySelector<HTMLElement>(`#hub .hub-row[data-id="${id}"]`)!;
const card = (key: string) => document.querySelector<HTMLElement>(`button[data-character-key="${key}"]`)!;
const ledger = () => [...(window.gwFixtureActions ?? [])];
const canvas = () => (window.gwFixtureCanvas?.events ?? []).filter(event => event.type !== 'keyup' || event.code).map(event => `${event.type}:${event.code ?? event.detail}`);
async function enter(query: string) { fill(search(), query); await settle(); press('Enter'); await settle(); }

describe('accounts', () => {
  test('Open Second is the default; a replace needs one deliberate armed confirmation', async () => {
    await mountFixture();
    fill(search(), 'acc second'); await settle();
    const rows = [...document.querySelectorAll<HTMLElement>('.hub-row')];
    expect(rows[0]!.dataset.id).toMatch(/:open$/);
    expect(document.querySelector('.hub-row[aria-selected="true"]')!.textContent).toContain('Open Second');
    expect(primary().textContent).toMatch(/^Open Second/);
    expect(document.querySelector('.hub-row[data-destructive="true"]')!.textContent).toContain('Close Main and open Second');
    press('ArrowDown');
    expect(primary().textContent).toMatch(/^Close Main and open Second/);
    expect(primary().dataset.variant).toBe('danger');
    press('Enter');
    await vi.advanceTimersByTimeAsync(50);
    expect(caption()).toBe('Close Main?');
    // The confirmation keeps the Hub footer: the armed destructive primary names it, Keep Main is the secondary.
    const confirm = primary();
    expect(confirm.textContent).toMatch(/^Close Main and open Second/);
    expect(confirm.dataset.variant).toBe('danger');
    expect(document.querySelector('.hub-actions')!.textContent).toBe('Actions⌘J');
    expect(document.querySelector('.hub-legend')!.textContent).toContain('Back');
    expect(document.activeElement).toBe(document.querySelector('.hub-confirm'));
    // An Enter before it arms confirms nothing.
    press('Enter');
    expect(ledger()).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(confirm.hasAttribute('data-armed')).toBe(true);
    // A double-click on it, with no gap: the first press confirms, the second runs nothing more.
    for (const detail of [1, 2]) { const init = { bubbles: true, cancelable: true, detail, button: 0 }; confirm.dispatchEvent(new MouseEvent('mousedown', init)); confirm.dispatchEvent(new MouseEvent('click', init)); }
    await settle();
    expect(ledger()).toEqual(['Account Second replace']);
    // Back cancels it.
    byRole('button', 'Open Hub', true)[0]!.click(); await settle();
    fill(search(), 'acc second'); await settle(); press('ArrowDown');
    expect(primary().textContent).toMatch(/^Close Main and open Second/);
    press('Enter'); await settle();
    expect(caption()).toBe('Close Main?');
    expect(document.activeElement).toBe(document.querySelector('.hub-confirm'));
    press('Meta+j');
    expect(byRole('menuitem', 'Keep Main').length).toBe(1);
    press('Escape');
    press('Meta+Backspace'); await settle();
    expect(document.querySelector('.hub-row[aria-selected="true"]')!.textContent).toContain('Close Main and open Second');
    expect(ledger()).toEqual(['Account Second replace']);
  });
});

/** A right press as a person makes it; returns whether the native menu was suppressed. */
function rightClick(target: Element) {
  const init = { bubbles: true, cancelable: true, composed: true, button: 2, detail: 1 };
  target.dispatchEvent(new PointerEvent('pointerdown', init));
  if (target.dispatchEvent(new MouseEvent('mousedown', init))) {
    const focusable = target.closest<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]');
    if (focusable) focusable.focus(); else (document.activeElement as HTMLElement | null)?.blur();
  }
  target.dispatchEvent(new PointerEvent('pointerup', init));
  target.dispatchEvent(new MouseEvent('mouseup', init));
  return !target.dispatchEvent(new MouseEvent('contextmenu', init));
}
const tick = () => vi.advanceTimersByTimeAsync(20);
const menuItems = () => byRole('menuitem', '').map(item => item.textContent!.trim());

describe('right-click', () => {
  test('selects a row and opens its Actions', async () => {
    await mountFixture();
    const eye = row('Eye of the North');
    expect(rightClick(eye)).toBe(true);
    await settle();
    expect(menuItems()).toEqual([expect.stringMatching(/^Travel to Eye of the North/), 'Pin to Hub', 'Set search phrase…']);
    expect(byRole('menu', 'Actions').length).toBe(1);
    expect(caption()).toBe('Home');
    press('Escape');
    expect(byRole('menu', 'Actions').filter(shown)).toEqual([]);
    expect(document.activeElement).toBe(search());
    expect(row('Eye of the North').getAttribute('aria-selected')).toBe('true');
    expect(ledger()).toEqual([]);
  });

  test('selects a Travel destination or a character card and runs nothing', async () => {
    await mountFixture();
    press('Meta+t'); await settle();
    expect(document.getElementById('travel-recent-449')!.getAttribute('aria-selected')).toBe('true');
    for (const [target, named] of [['travel-favorite-0', /^Travel to Ascalon City/], ['travel-recent-194', /^Travel to Kaineng Center/]] as const) {
      expect(rightClick(document.getElementById(target)!), target).toBe(true);
      await tick();
      expect(document.getElementById(target)!.getAttribute('aria-selected')).toBe('true');
      expect(document.querySelector('#hub .hub-primary')!.textContent).toMatch(named);
      expect(document.activeElement?.id).toBe('travel-search-input');
    }
    // The outpost the player stands in is no trip, so a right-click cannot select it either.
    expect(rightClick(document.getElementById('travel-favorite-1')!)).toBe(true);
    await tick();
    expect(document.getElementById('travel-favorite-1')!.getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('travel-recent-194')!.getAttribute('aria-selected')).toBe('true');
    expect(caption()).toBe('Travel');
    press('Meta+e'); await settle();
    expect(rightClick(card('mesmer'))).toBe(true);
    await tick();
    expect(card('mesmer').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(card('mesmer'));
    expect(document.querySelector('#hub .hub-primary')!.textContent).toMatch(/^Switch to Fixture Mesmer/);
    await vi.advanceTimersByTimeAsync(600);
    expect(ledger()).toEqual([]);
    expect(canvas()).toEqual([]);
  });
});

describe('Hub preferences', () => {
  type Pin = { id: string; phrase: string; pinned: boolean };
  /** The main process holds the pins; the fixture writes them to localStorage as `settings.set` lands. */
  const withPins = async (pins: Pin[]) => { const set = window.gwNative.settings.set({ hubShortcuts: pins }); await vi.advanceTimersByTimeAsync(10); await set; await settle(); };
  const saved = () => JSON.parse(localStorage.getItem('hub-fixture-shortcuts') ?? '[]') as Pin[];
  const savedIds = () => saved().map(entry => entry.id);
  const pins = (...ids: string[]) => ids.map(id => ({ id, phrase: '', pinned: true }));
  const listbox = () => byRole('listbox', 'Pins and search phrases')[0]!;
  const options = (container: Element = listbox()) => [...container.querySelectorAll<HTMLElement>('[role=option]')];
  const texts = (items: Element[]) => items.map(item => item.textContent!.trim());
  const button = (name: string) => byRole('button', name, true)[0]!;
  const group = (name: string) => byRole('group', name, true)[0]!;
  const focusedUsable = () => { const active = document.activeElement as HTMLElement; return !!active?.closest('.hub-view') && !(active as HTMLButtonElement).disabled && shown(active); };
  const item = (name: string | RegExp) => byRole('menuitem', '').find(entry => (typeof name === 'string' ? entry.textContent!.trim() === name : name.test(entry.textContent!)))!;

  for (const count of [0, 1, 3]) {
    test(`Move up keeps focus on a usable element with ${count} pins (PTR-12)`, async () => {
      await mountFixture();
      await withPins(pins('place:449', 'place:194', 'place:642').slice(0, count));
      await enter('hub preferences');
      expect(focusedUsable()).toBe(true);
      (document.querySelector('.hub-back') as HTMLElement).focus(); press('ArrowDown');
      expect(focusedUsable()).toBe(true);
      if (count) {
        listbox().focus();
        press('Meta+j');
        click(item('Remove Kamadan, Jewel of Istan…'));
        await vi.advanceTimersByTimeAsync(500);
        expect(primary().hasAttribute('data-armed')).toBe(true);
        click(primary()); await settle();
        expect(caption()).toBe('Hub preferences');
        expect(focusedUsable()).toBe(true);
      }
    });
  }

  test('⌥⌘↓ from the list moves the selected pin, ↓ only selects, and a removal names its target and passes an armed confirmation', async () => {
    await mountFixture();
    await withPins(pins('place:642', 'place:449', 'place:194'));
    await enter('hub preferences');
    listbox().focus();
    press('Alt+Meta+ArrowDown'); await settle();
    expect(texts(options())).toEqual([expect.stringMatching(/^Kamadan/), expect.stringMatching(/^Eye of the North/), expect.stringMatching(/^Kaineng Center/)]);
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true');
    expect(savedIds()).toEqual(['place:449', 'place:642', 'place:194']);
    // Removal names its target and passes an armed confirmation.
    click(document.querySelector('.hub-actions')!);
    click(item('Remove Eye of the North…')); await settle();
    expect(caption()).toBe('Remove Eye of the North?');
    press('Enter');
    expect(saved()).toHaveLength(3);
    expect(primary().hasAttribute('data-armed')).toBe(true);
    press('Enter'); await settle();
    expect(caption()).toBe('Hub preferences');
    expect(texts(options())).toEqual([expect.stringMatching(/^Kamadan/), expect.stringMatching(/^Kaineng Center/)]);
    expect(savedIds()).toEqual(['place:449', 'place:194']);
    expect(ledger()).toEqual([]);
  });


  test('pins group where they are kept, so no enabled Move is a no-op and Home keeps the order (HUB-090)', async () => {
    await mountFixture();
    await withPins(pins('place:449', 'travel'));
    fill(search(), 'team gom afk'); await settle();
    press('Meta+j');
    click(item('Pin to Hub')); await settle();
    await enter('hub preferences');
    const places = () => options(group('Places and tools'));
    const builds = () => options(group('Builds and teams'));
    expect(texts(places())).toEqual([expect.stringMatching(/^Kamadan/), expect.stringMatching(/^Travel/)]);
    expect(texts(builds())).toEqual([expect.stringMatching(/^GOM AFK/)]);
    const up = button('Move up'), down = button('Move down');
    // The team cannot pass the places and tools, and says so by disabling both moves.
    click(builds()[0]!); await tick();
    expect(up.getAttribute('aria-disabled')).toBe('true');
    expect(down.getAttribute('aria-disabled')).toBe('true');
    click(places()[1]!); await tick();
    expect(down.getAttribute('aria-disabled')).toBe('true');
    expect(up.getAttribute('aria-disabled')).toBe('false');
    click(up); await settle();
    expect(texts(places())).toEqual([expect.stringMatching(/^Travel/), expect.stringMatching(/^Kamadan/)]);
    press('Meta+Backspace'); fill(search(), ''); await settle();
    expect([...document.querySelectorAll<HTMLElement>('#hub .hub-row')].slice(0, 3).map(entry => entry.dataset.id)).toEqual(['travel', 'place:449', 'team:hub-gom-afk']);
  });

  test('Remove all search phrases asks first, names the count and keeps the pins (HUB-092)', async () => {
    await mountFixture();
    const stored: Pin[] = [{ id: 'place:449', phrase: 'kama', pinned: true }, { id: 'travel', phrase: 'go', pinned: false }];
    await withPins(stored);
    await enter('hub preferences');
    const reset = button('Remove all search phrases…');
    click(reset); await settle();
    expect(caption()).toBe('Remove search phrases?');
    expect(byRole('heading', 'Remove 2 search phrases?').length).toBe(1);
    expect(primary().textContent).toMatch(/^Remove 2 search phrases/);
    expect(primary().dataset.variant).toBe('danger');
    // Keep leaves every phrase.
    click(document.querySelector('.hub-actions')!);
    click(item('Keep')); await settle();
    expect(caption()).toBe('Hub preferences');
    expect(saved()).toEqual(stored);
    click(reset); await settle();
    expect(caption()).toBe('Remove search phrases?');
    await vi.advanceTimersByTimeAsync(500);
    expect(primary().hasAttribute('data-armed')).toBe(true);
    press('Enter'); await settle();
    expect(caption()).toBe('Hub preferences');
    expect(document.querySelector('#hub .hub-status')!.textContent).toBe('Removed 2 search phrases.');
    expect(texts(options())).toEqual(['Kamadan, Jewel of Istan · Pinned']);
    expect(saved()).toEqual([{ id: 'place:449', phrase: '', pinned: true }]);
    expect(button('Remove all search phrases…').hasAttribute('disabled')).toBe(true);
  });

  test('keeps the Actions slot and opens its named actions with Command-J', async () => {
    await mountFixture();
    await withPins(pins('place:449', 'place:194'));
    fill(search(), 'kamadan'); await settle();
    expect(document.querySelector('.hub-actions')!.textContent).toBe('Actions⌘J');
    let entries: string[] | undefined;
    for (const origin of ['search', 'row']) {
      if (origin === 'search') search().focus(); else click(byId('place:449'));
      // Hub lists use virtual row focus: DOM focus stays in search (D-2).
      expect(document.activeElement).toBe(search());
      expect(search().getAttribute('aria-activedescendant')).toBe(byId('place:449').id);
      press('Meta+j');
      expect(byRole('menu', '').filter(shown).length).toBe(1);
      expect(item(/Travel to Kamadan/)).toBeTruthy();
      const current = menuItems();
      if (entries) expect(current).toEqual(entries); else entries = current;
      press('Escape');
    }
    press('Meta+r'); await settle(); await enter('hub preferences');
    expect(document.querySelector('.hub-actions')!.textContent).toBe('Actions⌘J');
    press('Meta+j');
    expect(item(/Set phrase for Kamadan/)).toBeTruthy();
    press('Escape');
    expect(rightClick(byRole('option', 'Kaineng Center · Pinned', true)[0]!)).toBe(true); await tick();
    expect(item(/Set phrase for Kaineng Center/)).toBeTruthy();
    expect(item(/Remove Kaineng Center/)).toBeTruthy();
    press('Escape');
    click(byRole('option', 'Kamadan, Jewel of Istan · Pinned', true)[0]!); await tick();
    press('Meta+j');
    click(item(/Remove Kamadan/)); await settle();
    expect(caption()).toContain('Remove Kamadan');
    expect(document.querySelector('.hub-actions')!.textContent).toBe('Actions⌘J');
    press('Meta+j');
    click(item('Keep')); await settle();
    expect(caption()).toBe('Hub preferences');
    expect(saved()).toEqual(pins('place:449', 'place:194'));
  });
});

test('every Hub view keeps the footer with a key legend and a named primary', async () => {
  await mountFixture();
  for (const [query, title, named] of [['settings', 'Settings', /^Done$/], ['hub preferences', 'Hub preferences', /^Done$/], ['team gom', 'GOM AFK', /^Apply team GOM AFK↵$/]] as const) {
    await enter(query);
    await until(() => caption() === title);
    expect(shown(document.querySelector('.hub-footer')!)).toBe(true);
    expect(document.querySelector('.hub-legend')!.textContent).toContain('Back');
    expect(primary().textContent).toMatch(named);
    press('Meta+Backspace'); await settle();
    expect(caption()).toBe('Home');
  }
  // Done steps back one level.
  await enter('settings');
  await until(() => caption() === 'Settings');
  click(primary()); await settle();
  expect(caption()).toBe('Home');
});

