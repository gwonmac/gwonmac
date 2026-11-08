/**
 * Hub intent rules on the real Hub fixture: what Enter, a click or a typed scope does and does
 * not run, which row a page starts on, what a row says before Enter, and what a page restores
 * after Back or a temporary hide. Ported from tests/hub-intent.spec.ts; the Playwright spec keeps
 * only what needs a real browser (placement across reloads, pixel geometry, pointer hit-testing,
 * the wheel, native macOS editing).
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { byRole, click, fill, hold, keyDown, keyUp, loadFixture, mountFixture, narrow, press, settle, shown, type, unmountFixture } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const search = () => narrow(HTMLInputElement, $('.hub-search input'));
const selected = () => $('.hub-row[aria-selected="true"]');
const row = (id: string) => $(`.hub-row[data-id="${id}"]`);
const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const text = (selector: string) => norm($(selector)?.textContent);
const caption = () => text('.hub-caption');
const crumbs = () => text('.hub-breadcrumbs');
const detail = (element: Element | null) => norm(element?.querySelector('.hub-detail')?.textContent);
const primary = () => narrow(HTMLButtonElement, $('.hub-primary'));
const app = () => $('#app')!;
const action = () => app().dataset.action ?? null;
const invites = () => app().dataset.invites ?? null;
const hubOpen = () => shown($('#hub')!);
const button = (name: string, exact = true) => byRole('button', name, exact)[0]!;
const travelBox = () => narrow(HTMLInputElement, byRole('combobox', 'Destination, phrase, or friend', true)[0]);
const phraseBox = () => narrow(HTMLInputElement, byRole('textbox', 'Search phrase', true)[0]);
const actionsButton = () => narrow(HTMLButtonElement, byRole('button', 'Actions', true)[0]);
const lifecycle = () => narrow(HTMLSelectElement, byRole('combobox', 'Lifecycle state', true)[0]);
const choose = (select: HTMLSelectElement, value: string) => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
const setLifecycle = async (value: string) => { choose(lifecycle(), value); await flush(); };
/** A short wait: two animation frames, enough for the Hub to render what a key or click changed. */
const flush = () => vi.advanceTimersByTimeAsync(40);
/** Lets queued microtasks run without moving the clock, for tests that count elapsed time. */
const tick = () => vi.advanceTimersByTimeAsync(0);
const blur = () => window.dispatchEvent(new Event('blur'));
const openHub = async () => { click(button('Open Hub')); await flush(); };
const goTo = async (query: string) => { fill(search(), query); press('Enter'); await flush(); };
const openPhraseMenu = async () => { await flush(); click(actionsButton()); await flush(); click(byRole('menuitem', 'Set search phrase')[0]!); await flush(); };
const stored = () => JSON.parse(localStorage.getItem('hub-fixture-shortcuts') ?? 'null');
/** What the page finds in localStorage when it loads: the stored pins and phrases. */
const shortcuts = (value: unknown) => ({ 'hub-fixture-shortcuts': JSON.stringify(value) });
const moveDown = (times: number) => { for (let step = 0; step < times; step++) press('ArrowDown'); };

// ---- Accounts, characters and temporary hides ------------------------------------------------

test('character entry is card-first and Back restores the launching result', async () => {
  await mountFixture();
  await goTo('sw');
  const focused = () => narrow(HTMLElement, document.activeElement);
  expect(focused().matches('#character-switch-list button')).toBe(true);
  const first = focused().dataset.characterKey;
  press('ArrowRight'); await flush();
  expect(focused().dataset.characterKey).not.toBe(first);
  press('ArrowUp'); await flush();
  expect(focused().id).toBe('character-switch-query');
  // The search is the top of the view: ↑ there stays (HUB-137).
  press('ArrowUp'); await flush();
  expect(focused().id).toBe('character-switch-query');
  press('Meta+Backspace'); await flush();
  expect([search().value, row('character')?.getAttribute('aria-selected'), document.activeElement === search()]).toEqual(['sw', 'true', true]);
});

test('account actions restore each visited account and command row', async () => {
  await mountFixture();
  await goTo('switch account');
  expect(selected()?.textContent).toContain('Second');
  const identity = selected()!.dataset.id!;
  press('Enter'); await flush();
  // D-23: the page opens on keeping Main running, never on the replace.
  expect(selected()?.textContent).toContain('Open Second');
  press('Meta+Backspace'); await flush();
  expect(row(identity)?.getAttribute('aria-selected')).toBe('true');
  press('Meta+Backspace'); await flush();
  expect([row('accounts')?.getAttribute('aria-selected'), search().value, document.activeElement === search(), /Account/u.test(action() ?? '')])
    .toEqual(['true', 'switch account', true, false]);
});

test('→ on the current account opens no actions, as Enter opens none (HUB-175)', async () => {
  await mountFixture();
  await goTo('switch account');
  expect(selected()?.textContent).toContain('Second');
  press('ArrowUp'); await flush();
  expect(selected()?.textContent).toContain('Main');
  press('ArrowRight'); await flush();
  expect([crumbs(), selected()?.textContent?.includes('Main')]).toEqual(['Home›Accounts', true]);
});

test('accounts that finish loading take the selection, so Enter acts on them (HUB-232)', async () => {
  await mountFixture('&accounts-load-ms=2000');
  await goTo('switch account');
  await vi.advanceTimersByTimeAsync(2_100);
  expect([selected()?.textContent?.includes('Second'), primary().disabled]).toEqual([true, false]);
});

test('a changed account list returns to one refreshed Accounts page (HUB-174)', async () => {
  await mountFixture();
  await goTo('switch account');
  press('Enter'); await flush();
  expect(crumbs()).toBe('Home›Accounts›Second');
  window.gwFixtureAccounts!.renameSecond('Alt');
  press('Enter'); await flush();
  // The Accounts page it came from, not a second copy over the stale Second actions.
  expect([crumbs(), text('.hub-status'), selected()?.textContent?.includes('Alt')])
    .toEqual(['Home›Accounts', 'Accounts changed. Choose from the refreshed list.', true]);
  press('Meta+Backspace'); await flush();
  expect([crumbs(), /Account/u.test(action() ?? '')]).toEqual(['Home', false]);
});

test('temporary blur resumes the stage and focus while explicit close starts fresh', async () => {
  await mountFixture();
  await goTo('build monk');
  const id = selected()!.dataset.id!;
  blur(); await flush();
  expect(hubOpen()).toBe(false);
  await openHub();
  expect([text('.hub-summary').includes('Protection'), row(id)?.getAttribute('aria-selected'), document.activeElement === search()]).toEqual([true, 'true', true]);
  press('Meta+Backspace'); await flush();
  expect([search().value, selected()?.textContent?.includes('Protection')]).toEqual(['build monk', true]);
  click(button('Close Hub')); await flush();
  await openHub();
  expect([search().value, document.activeElement === search()]).toEqual(['', true]);
});

test('Travel and Settings restore their own state after a temporary hide', async () => {
  await mountFixture();
  await goTo('travel');
  fill(travelBox(), 'kam'); await flush();
  expect(travelBox().getAttribute('aria-activedescendant')).toMatch(/travel-/u);
  const active = travelBox().getAttribute('aria-activedescendant');
  blur(); await flush(); await openHub();
  expect([travelBox().value, document.activeElement === travelBox(), travelBox().getAttribute('aria-activedescendant')]).toEqual(['kam', true, active]);
  click(button('Home')); await flush();
  await goTo('settings'); await settle();
  click(button('Appearance')); await settle();
  const style = () => narrow(HTMLSelectElement, $('[data-setting="uiStyle"] select'));
  style().focus();
  blur(); await flush(); await openHub();
  expect(document.activeElement).toBe(style());
  press('Meta+r'); await flush();
  fill(search(), 'team gom afk'); press('Meta+j'); await flush();
  click(byRole('menuitem', 'Set search phrase')[0]!); await flush();
  fill(phraseBox(), 'smite now');
  blur(); press('Meta+r'); await flush();
  expect([phraseBox().value, document.activeElement === phraseBox()]).toEqual(['smite now', true]);
  press('Meta+r'); await flush();
  await goTo('rates');
  choose(narrow(HTMLSelectElement, byRole('combobox', 'Rate source', true)[0]), 'manual'); await flush();
  const rate = narrow(HTMLInputElement, byRole('textbox', 'Gold per ectoplasm', true)[0]);
  fill(rate, '7500');
  blur(); press('Meta+r'); await flush();
  expect([rate.value, document.activeElement === rate]).toEqual(['7500', true]);
});

// ---- Enter: held, modified, and on footer actions --------------------------------------------

test('held Enter cannot activate a newly entered target page', async () => {
  await mountFixture();
  fill(search(), 'build monk');
  keyDown('Enter'); keyDown('Enter', true); keyUp('Enter'); await flush();
  expect([selected()?.textContent?.includes('Apply to me'), /command|apply/u.test(action() ?? '')]).toEqual([true, false]);
});

test('a modified Enter never runs the primary; only a plain Enter does', async () => {
  await mountFixture();
  fill(search(), 'build smiter'); press('Enter'); await flush();
  expect(primary().textContent).toMatch(/^Apply Smiter to Fixture Monk/u);
  for (const chord of ['Meta+Enter', 'Control+Enter', 'Alt+Enter', 'Shift+Enter']) {
    press(chord); await flush();
    expect([chord, hubOpen(), /command|apply/u.test(action() ?? '')]).toEqual([chord, true, false]);
  }
  fill(search(), 'kamadan'); press('Meta+Enter'); await flush();
  expect([hubOpen(), /travel/iu.test(action() ?? '')]).toEqual([true, false]);
  // Travel's own search follows the same rule.
  press('Meta+t'); await flush();
  expect(document.activeElement).toBe(travelBox());
  for (const chord of ['Meta+Enter', 'Control+Enter', 'Alt+Enter', 'Shift+Enter']) press(chord);
  await flush();
  expect([hubOpen(), document.activeElement === travelBox(), /travel/iu.test(action() ?? '')]).toEqual([true, true, false]);
});

test('held Enter on footer actions and Backspace in ordinary fields keep their scope', async () => {
  await mountFixture();
  fill(search(), 'build monk'); press('Enter'); await flush();
  const apply = byRole('button', 'Apply')[0]!;
  expect(apply.textContent).toMatch(/^Apply .+ to Fixture Monk/u);
  apply.focus();
  const proceeded = apply.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
  expect([proceeded, /command|apply/u.test(action() ?? '')]).toEqual([false, false]);
  click(button('Home')); await flush();
  fill(search(), 'team gom afk');
  await openPhraseMenu();
  fill(phraseBox(), ''); press('Backspace'); await flush();
  expect([caption(), document.activeElement === phraseBox()]).toEqual(['Search phrase', true]);
  // Command-Backspace is Back from a form field too; the form keeps its draft for the session.
  fill(phraseBox(), 'keep me'); press('Meta+Backspace'); await flush();
  expect([caption(), byRole('textbox', 'Search phrase', true).length]).toEqual(['Home', 0]);
  await openPhraseMenu();
  expect([phraseBox().value, document.activeElement === phraseBox()]).toEqual(['keep me', true]);
  // A closed and reopened Hub still has it.
  click(button('Close Hub')); await flush();
  expect(hubOpen()).toBe(false);
  await openHub();
  fill(search(), 'team gom afk');
  await openPhraseMenu();
  expect(phraseBox().value).toBe('keep me');
});

// ---- Phrases ----------------------------------------------------------------------------------

test('a legacy phrase that is now a scope word keeps its pins and only stops matching', async () => {
  const legacy = [{ id: 'whispers', phrase: 'invite', pinned: true }, { id: 'travel', phrase: '', pinned: true }];
  await mountFixture('', shortcuts(legacy));
  expect(text('.hub-group')).toBe('Pinned');
  expect([0, 1].map(index => $$('.hub-row')[index]!.textContent?.match(/Whispers|Travel/u)?.[0])).toEqual(['Whispers', 'Travel']);
  fill(search(), 'invite '); await flush();
  expect([text('.hub-scope'), row('whispers')]).toEqual(['invite', null]);
  click(button('Close Hub')); await flush();
  expect(stored()).toEqual(legacy);
});

test('the phrase editor refuses a new phrase that starts with a scope word', async () => {
  await mountFixture();
  fill(search(), 'team gom afk');
  await openPhraseMenu();
  fill(phraseBox(), 'invite x'); press('Enter'); await flush();
  expect(text('[role="alert"]')).toBe('“invite x” starts with the command word “invite”. Choose another phrase.');
  fill(phraseBox(), 'gom night'); press('Enter'); await flush();
  // A saved phrase returns to the page that asked and says what it now finds (HUB-152).
  expect([caption(), text('#hub .hub-status')]).toEqual(['Home', '“gom night” now finds GOM AFK.']);
});

test('the phrase editor refuses a phrase that is already another result’s name, and saves nothing (HUB-062)', async () => {
  await mountFixture();
  fill(search(), 'open xunlai storage'); press('Meta+j'); await flush();
  click(byRole('menuitem', 'Set search phrase')[0]!); await flush();
  fill(phraseBox(), 'Maps'); press('Enter'); await flush();
  expect([text('[role="alert"]'), caption(), localStorage.getItem('hub-fixture-shortcuts')])
    .toEqual(['“maps” already finds Maps. Choose another phrase.', 'Search phrase', null]);
  // A friend's name is a real result too.
  fill(phraseBox(), 'romi'); press('Enter'); await flush();
  expect(text('[role="alert"]')).toBe('“romi” already finds Romi. Choose another phrase.');
  press('Meta+Backspace'); await flush();
  fill(search(), 'maps'); await flush();
  // The Maps tool is the one answer; its setting rows only follow it.
  expect([$$('#hub .hub-row:not([data-id^="setting"])').length, $('#hub .hub-row[aria-selected="true"]')?.dataset.id]).toEqual([1, 'maps']);
});

test('the phrase form names its error, submits with Command-Enter and keeps a draft through Esc (HUB-152)', async () => {
  await mountFixture();
  const openForm = async () => { fill(search(), 'team gom afk'); press('Meta+j'); await flush(); click(byRole('menuitem', 'Set search phrase')[0]!); await flush(); };
  await openForm();
  expect(document.activeElement).toBe(phraseBox());
  expect(descriptionOf(phraseBox())).toMatch(/Type this exact phrase in Hub to find GOM AFK/u);
  // Esc leaves the form; the draft is still there when the player comes back.
  fill(phraseBox(), 'keep me'); press('Escape'); await flush();
  expect(caption()).toBe('Home');
  await openForm();
  expect(phraseBox().value).toBe('keep me');
  fill(phraseBox(), 'invite x'); press('Meta+Enter'); await flush();
  expect([phraseBox().getAttribute('aria-invalid'), document.activeElement === phraseBox()]).toEqual(['true', true]);
  expect(descriptionOf(phraseBox())).toMatch(/^“invite x” starts with the command word “invite”\. Choose another phrase\./u);
  // Typing clears the error; Command-Enter saves from the field and returns.
  fill(phraseBox(), 'gom evening'); await flush();
  expect([phraseBox().getAttribute('aria-invalid'), $('[role="alert"]') === null || !shown($('[role="alert"]')!)]).toEqual([null, true]);
  press('Meta+Enter'); await flush();
  expect([caption(), text('#hub .hub-status')]).toEqual(['Home', '“gom evening” now finds GOM AFK.']);
  fill(search(), 'gom evening'); await flush();
  expect($('#hub .hub-row')?.dataset.id).toMatch(/^team:/u);
});
/** The element's accessible description: the text of the elements aria-describedby names. */
function descriptionOf(element: Element) {
  return norm((element.getAttribute('aria-describedby') ?? '').split(/\s+/u).map(id => document.getElementById(id)?.textContent ?? '').join(' '));
}

// ---- Explorable areas, map loading, Guild Halls -----------------------------------------------

test('a bare travel scope in an explorable area selects Browse travel, so Enter never leaves the area', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  type('travel '); await flush();
  expect(text('.hub-scope')).toBe('travel');
  // Recent places are listed first, yet none is a result the player asked for.
  expect(shown($('.hub-row[data-id^="place:"]')!)).toBe(true);
  expect([selected()?.dataset.id, primary().textContent]).toEqual(['travel', expect.stringMatching(/^Browse travel/u)]);
  press('Enter'); await flush();
  expect([caption(), lifecycle().value]).toEqual(['Travel', 'pve-explorable']);
});

test('a fresh Home in an explorable area starts on Travel, says why, and Enter never leaves the area', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  // D-13: recent places stay listed, but none is the default.
  expect(shown($('.hub-row[data-id^="place:"]')!)).toBe(true);
  expect([selected()?.dataset.id, primary().textContent]).toEqual(['travel', expect.stringMatching(/^Browse travel/u)]);
  // D-26: the header names the area and one quiet line names what it holds back.
  expect([text('.hub-context'), text('.hub-lifecycle')]).toEqual(['Fixture Monk · North Kryta Province · Explorable area', 'Explorable area — Travel leaves this area']);
  search().focus(); press('Enter'); await flush();
  expect([caption(), lifecycle().value, /TRAVEL/u.test(action() ?? '')]).toEqual(['Travel', 'pve-explorable', false]);
  // Entering the area with Hub open gives the same default; returning to an outpost restores Continue.
  await setLifecycle('outpost');
  expect(selected()?.dataset.id).toMatch(/^place:/u);
  expect(shown($('.hub-lifecycle')!)).toBe(false);
  await setLifecycle('pve-explorable');
  expect(selected()?.dataset.id).toBe('travel');
  await setLifecycle('map-loading');
  expect([text('.hub-context'), text('.hub-lifecycle')]).toEqual(['Map loading', 'Map loading — Travel returns when the map has loaded']);
});

// ---- Leave this area? before Travel (D-27, HUB-027) -------------------------------------------

const question = () => text('#leave-area-question');
const leaveStay = () => $('#leave-area-stay')!;

test('a trip from the Travel view asks first, Stay returns, and only an armed Leave travels', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  press('Meta+t'); await flush();
  expect(document.activeElement).toBe(travelBox());
  expect($('#travel-recent-449')?.dataset.active).toBe('true');
  press('Enter'); await flush();
  expect([question(), document.activeElement === leaveStay(), primary().textContent]).toEqual(['Leave this area and travel to Kamadan, Jewel of Istan?', true, expect.stringMatching(/^Stay here/u)]);
  // A second quick Enter stays: the safe choice has the keyboard.
  press('Enter'); await flush();
  expect([document.activeElement === travelBox(), $('#travel-recent-449')?.dataset.active]).toEqual([true, 'true']);
  press('Enter'); await flush();
  const leave = button('Leave and travel to Kamadan, Jewel of Istan');
  click(leave, 1); click(leave, 2); await settle();
  expect([/TRAVEL/u.test(action() ?? ''), leave.hasAttribute('data-armed')]).toEqual([false, true]);
  click(leave); await settle();
  expect([action(), hubOpen()]).toEqual(['TRAVEL Kamadan, Jewel of Istan', false]);
});

test('a Home place row and Travel and invite ask the same step, and staying sends nothing', async () => {
  await mountFixture('&party&lifecycle=pve-explorable');
  await goTo('kamadan');
  expect(question()).toBe('Leave this area and travel to Kamadan, Jewel of Istan?');
  press('Escape'); await flush();
  expect([search().value, selected()?.dataset.id, text('.hub-status')]).toEqual(['kamadan', 'place:449', '']);
  await goTo('zed beta');
  press('End'); await flush();
  expect(selected()?.dataset.id).toBe('person:travel-invite');
  press('Enter'); await flush();
  expect(question()).toBe('Leave this area and travel to Ascalon City?');
  click(leaveStay()); await flush();
  expect([crumbs(), selected()?.dataset.id, text('.hub-status'), /TRAVEL/u.test(action() ?? '')]).toEqual(['Home›Zed Beta', 'person:travel-invite', '', false]);
});

/** The Resign dialog is created when first opened, so each use looks it up again. */
const resignDialog = () => { const dialog = $('#resign-dialog'); return dialog ? narrow(HTMLDialogElement, dialog) : null; };
const resignOpen = () => resignDialog()?.open === true;
const resignButton = (name: string) => byRole('button', name, true).find(candidate => resignDialog()?.contains(candidate));
const resignConfirm = () => narrow(HTMLButtonElement, resignButton('Resign'));

// ---- Resign -----------------------------------------------------------------------------------

test('Resign says what it does before Enter, reads as destructive, and Cancel returns to the search (HUB-250, HUB-251)', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  fill(search(), 'resign'); await flush();
  const resign = row('resign')!;
  expect([resign.querySelector('.hub-icon')?.getAttribute('data-kind'), resign.querySelector('.hub-icon svg path')?.getAttribute('d'), resign.getAttribute('aria-selected'), detail(resign), primary().dataset.variant])
    .toEqual(['resign', 'M6 21V4M6 4h11l-2.5 4 2.5 4H6', 'true', 'Asks before sending /resign · PvE only', 'danger']);
  const confirm = () => resignConfirm();
  for (const cancel of ['Escape', 'Cancel']) {
    window.gwFixtureCanvas!.clear();
    press('Enter'); await flush();
    expect([cancel, resignOpen(), confirm().dataset.variant, resignDialog()?.textContent]).toEqual([cancel, true, 'danger', expect.stringContaining('When everyone has resigned, the party returns to the outpost')]);
    if (cancel === 'Escape') press('Escape'); else click(narrow(HTMLButtonElement, resignButton('Cancel')));
    await flush();
    expect([cancel, resignOpen(), document.activeElement === search(), search().value, row('resign')?.getAttribute('aria-selected'), window.gwFixtureCanvas!.events.filter(event => event.code === 'Escape').length])
      .toEqual([cancel, false, true, 'resign', 'true', 0]);
  }
  expect(action()).not.toBe('RESIGN');
});

test('Resign rejects early confirmation and trailing multi-clicks before sending once (HUB-245)', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  fill(search(), 'resign'); press('Enter'); await tick();
  const confirm = resignConfirm();
  const clickWith = (detail: number) => confirm.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
  for (const advance of [0, 100, 250]) {
    await vi.advanceTimersByTimeAsync(advance);
    for (const early of ['click', 'Enter']) {
      if (early === 'click') clickWith(1); else { confirm.focus(); press('Enter'); }
      await tick();
      expect([advance, early, action(), resignOpen(), confirm.hasAttribute('data-armed')]).toEqual([advance, early, null, true, false]);
    }
  }
  await vi.advanceTimersByTimeAsync(100);
  expect(confirm.hasAttribute('data-armed')).toBe(true);
  for (const detail of [2, 3]) clickWith(detail);
  await tick();
  expect([resignOpen(), action()]).toEqual([true, null]);
  clickWith(1); await tick();
  expect([action(), resignOpen()]).toEqual(['RESIGN', false]);
});

test('Resign sends once from its armed confirmation, and says before Enter why it cannot while a map loads', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  await goTo('resign');
  const confirm = resignConfirm();
  await vi.advanceTimersByTimeAsync(500);
  expect(confirm.hasAttribute('data-armed')).toBe(true);
  click(confirm); await settle();
  expect([action(), hubOpen()]).toEqual(['RESIGN', false]);
  // While a map loads, the reason shows on the row before Enter (HUB-135).
  await setLifecycle('map-loading');
  fill(search(), 'resign'); await flush();
  expect([row('resign')?.getAttribute('aria-disabled'), detail(row('resign'))]).toEqual(['true', 'Resign is available with Tools enabled in a PvE area.']);
});

// ---- Rows that say why before Enter -----------------------------------------------------------

test('a friend in your outpost offers no trip, and says so before Enter (HUB-068)', async () => {
  await mountFixture('&party');
  await goTo('zed delta');
  expect(crumbs()).toBe('Home›Zed Delta');
  for (const id of ['person:travel', 'person:travel-invite']) expect([id, row(id)?.getAttribute('aria-disabled'), detail(row(id))]).toEqual([id, 'true', 'You are already in this outpost']);
  for (let step = 0; step < 10 && selected()?.dataset.id !== 'person:travel'; step++) { press('ArrowDown'); await flush(); }
  expect([selected()?.dataset.id, primary().disabled]).toEqual(['person:travel', true]);
  press('Enter'); await flush();
  expect(/TRAVEL/u.test(action() ?? '')).toBe(false);
});

test('while a map loads, the Travel rows say why before Enter and a fresh Home never starts on them (HUB-135)', async () => {
  await mountFixture('&lifecycle=map-loading');
  expect([selected()?.getAttribute('aria-disabled') === 'true', selected()?.dataset.id === 'travel']).toEqual([false, false]);
  fill(search(), 'travel'); await flush();
  expect([row('travel')?.getAttribute('aria-disabled'), detail(row('travel'))]).toEqual(['true', 'Travel is unavailable while a map is loading']);
  fill(search(), 'travel kamadan'); await flush();
  expect([row('place:449')?.getAttribute('aria-disabled'), detail(row('place:449')), primary().disabled]).toEqual(['true', 'Travel is unavailable while a map is loading', true]);
  press('Enter'); await flush();
  expect([caption(), /TRAVEL/u.test(action() ?? ''), $('#hub')!.textContent?.includes('Unavailable in the current game state.')]).toEqual(['Home', false, false]);
});

test('a tool that withdraws keeps the Home query and selection, and closes only its own phrase editor (HUB-051, HUB-231)', async () => {
  await mountFixture();
  const toolSettings = async (detail: object) => { window.dispatchEvent(new CustomEvent('hub-fixture-settings', { detail })); await flush(); };
  fill(search(), 'team gom a'); await flush();
  expect(selected()?.textContent).toContain('GOM AFK');
  // Turning off Travel and Whispers withdraws the People source while Home shows a search.
  await toolSettings({ travelPalette: false, whispersEnabled: false });
  expect([search().value, selected()?.textContent?.includes('GOM AFK')]).toEqual(['team gom a', true]);
  press('End'); type('fk'); await flush();
  expect([search().value, selected()?.textContent?.includes('GOM AFK')]).toEqual(['team gom afk', true]);
  // A phrase editor opened for a place closes with Travel; Settings stays whatever tool changes.
  await toolSettings({ travelPalette: true });
  fill(search(), 'kamadan'); await flush();
  expect(selected()?.dataset.id).toBe('place:449');
  press('Meta+j'); await flush();
  click(byRole('menuitem', 'Set search phrase')[0]!); await flush();
  expect(caption()).toBe('Search phrase');
  await toolSettings({ buildLibrary: false });
  expect(caption()).toBe('Search phrase');
  await toolSettings({ travelPalette: false });
  expect(caption()).toBe('Home');
});

test('a Guild Hall is an outpost: no explorable label, no leaving line, and a fresh Home keeps Continue', async () => {
  // The fixture reads the instance type as the runtime does; a Guild Hall is no Travel destination.
  await mountFixture('&lifecycle=guild-hall');
  expect([text('.hub-context'), shown($('.hub-lifecycle')!), selected()?.dataset.id]).toEqual(['Fixture Monk · Guild Hall', false, expect.stringMatching(/^place:/u)]);
  fill(search(), 'kamadan'); await flush();
  expect(primary().textContent).toMatch(/^Travel to Kamadan/u);
});

test('bare whisper and trade scopes start on their first row; nothing consequential starts selected', async () => {
  await mountFixture('&party');
  window.dispatchEvent(new Event('hub-fixture-incoming')); await flush();
  type('whisper '); await flush();
  expect([selected()?.dataset.id, selected()?.textContent?.includes('Romi Ranger'), primary().textContent]).toEqual(['friend:romi', true, expect.stringMatching(/^Reply to Romi Ranger/u)]);
  press('Enter'); await settle();
  expect(shown(byRole('textbox', 'Message Romi Ranger', true)[0]!)).toBe(true);
  click(button('Hide Whispers')); await flush();
  press('Meta+r'); await flush();
  fill(search(), ''); type('trade '); await flush();
  expect([selected()?.dataset.id, primary().textContent, primary().disabled]).toEqual(['trade', expect.stringMatching(/^Open Trade Chat/u), false]);
  // `acc ` starts on a saved account, never on an account action.
  fill(search(), ''); type('acc '); await settle();
  expect([selected()?.dataset.id, primary().textContent]).toEqual([expect.stringMatching(/^account:[^:]+$/u), expect.stringMatching(/^Choose account action/u)]);
});

// ---- Party invite -----------------------------------------------------------------------------

const label = (element: Element | null | undefined) => norm(element?.textContent).replace(/\s*↵$/u, '');
const rowWith = (name: string) => $$('.hub-row').find(candidate => candidate.textContent?.includes(name));
const dblclick = (element: Element) => { click(element, 1); click(element, 2); };
/**
 * A double-click on the row at `index` when its first click changes the page: the second click
 * lands at the same place, on whatever row the new page shows there (Playwright's `dblclick`
 * clicks the same coordinates twice).
 */
const dblclickAt = async (index: number) => { click($$('.hub-row')[index]!, 1); await flush(); click($$('.hub-row')[index]!, 2); await settle(); };

test('the fixture wires PartyInvite, and the explorable reason shows before Enter', async () => {
  await mountFixture('&party');
  // Romi waits in the player's outpost: the shipped example is ready to send.
  fill(search(), 'invite Romi'); await flush();
  expect([selected()?.textContent?.includes('Romi'), selected()?.getAttribute('aria-disabled') === 'true', shown($('#hub .hub-empty')!), primary().textContent, primary().disabled])
    .toEqual([true, false, false, expect.stringMatching(/^Invite Romi Ranger/u), false]);
  fill(search(), 'invite Zed Delta'); await flush();
  expect([primary().textContent, primary().disabled]).toEqual([expect.stringMatching(/^Invite Zed Delta/u), false]);
  await setLifecycle('pve-explorable');
  for (const query of ['invite Zed Delta', 'invite Romi']) {
    fill(search(), query); await flush();
    expect([selected()?.textContent?.includes('Invite players from an outpost'), selected()?.getAttribute('aria-disabled'), primary().disabled]).toEqual([true, 'true', true]);
    press('Enter'); await flush();
    expect([invites(), /INVITE/u.test(action() ?? '')]).toEqual([null, false]);
  }
  // Back in the outpost the same Enter sends exactly one invite.
  await setLifecycle('outpost');
  fill(search(), 'invite Romi'); press('Enter'); await flush();
  expect([invites(), text('.hub-receipt')]).toEqual(['Romi Ranger', 'Sent /invite Romi Ranger. Guild Wars answers in chat.']);
});

test('the invite scope invites only an exact name and names it before Enter', async () => {
  await mountFixture('&party');
  fill(search(), 'invite Mo Kai'); await flush();
  expect([$$('.hub-row')[0]?.textContent?.includes('Mo Kai'), primary().textContent]).toEqual([true, expect.stringMatching(/^Invite Mo Kai/u)]);
  press('ArrowDown'); await flush();
  expect([document.activeElement === search(), selected()?.textContent?.includes('Mo Kaiser'), search().getAttribute('aria-activedescendant'), primary().textContent])
    .toEqual([true, true, 'hub-result-1', expect.stringMatching(/^View actions/u)]);
  press('Enter'); await flush();
  expect(caption()).toBe('Mo Kaiser');
  click(button('Home')); await flush();
  for (const partial of ['invite a', 'invite Mo']) {
    fill(search(), partial); await flush();
    expect($$('.hub-row').at(-1)?.textContent).toContain('Type the full character name');
    press('Enter'); await flush();
    expect([partial, invites(), hubOpen()]).toEqual([partial, null, true]);
    click(button('Home')); await flush();
  }
  fill(search(), 'invite Mo Kai'); press('Enter'); await flush();
  expect([invites(), text('.hub-receipt')]).toEqual(['Mo Kai', 'Sent /invite Mo Kai. Guild Wars answers in chat.']);
  // The receipt ends when the Hub opens again.
  press('Meta+r'); await flush();
  expect(shown($('.hub-receipt')!)).toBe(false);
  fill(search(), 'zed alpha'); press('Enter'); await flush();
  expect([caption(), $('#hub')!.textContent?.includes('Sent /invite'), shown($('.hub-receipt')!)]).toEqual(['Zed Alpha', false, false]);
});

test('a bare invite scope lists online friends, the ones invitable here first, and invites only a chosen one', async () => {
  await mountFixture('&party');
  type('invite '); await flush();
  expect(text('.hub-scope')).toBe('invite');
  expect(rowWith('Zed Alpha')?.textContent).toContain('Zed Alpha is in Kamadan, Jewel of Istan. Use Travel and invite.');
  expect(rowWith('Offline Friend')).toBeUndefined();
  const disabled = $$('.hub-row').map(candidate => candidate.getAttribute('aria-disabled') === 'true');
  expect(disabled).toEqual([...disabled].sort((a, b) => Number(a) - Number(b)));
  // No name was typed: nothing is preselected, and Enter sends nothing.
  expect([selected(), primary().disabled]).toEqual([null, true]);
  press('Enter'); await flush();
  expect([invites(), hubOpen()]).toEqual([null, true]);
  // A row the player chooses names its target before Enter.
  press('ArrowDown'); await flush();
  expect([primary().disabled, primary().textContent]).toEqual([false, expect.stringMatching(/^Invite \S+ \S+/u)]);
  const target = label(primary()).replace(/^Invite /u, '');
  press('Enter'); await flush();
  expect(invites()).toBe(target);
});

test('Invite to a friend in another map says why before Enter and sends nothing', async () => {
  await mountFixture('&party');
  await goTo('zed alpha');
  // D-2: the person page keeps focus in search and moves the active descendant.
  expect([caption(), document.activeElement === search()]).toEqual(['Zed Alpha', true]);
  // The footer keeps both slots and a key legend; a person page has no details to show.
  expect([shown(actionsButton()), actionsButton().disabled, text('.hub-legend')]).toEqual([true, true, '↑↓ Select⎋ Back⌘⌫ Back']);
  press('ArrowDown'); press('ArrowDown'); await flush();
  expect([document.activeElement === search(), search().getAttribute('aria-activedescendant')]).toEqual([true, 'hub-result-2']);
  expect(selected()?.textContent).toContain('Invite to party');
  expect(selected()?.textContent).toContain('Zed Alpha is in Kamadan, Jewel of Istan. Use Travel and invite.');
  expect([primary().disabled, primary().textContent]).toEqual([true, expect.stringMatching(/^Invite Zed Alpha/u)]);
  // A press on the disabled primary or blank panel space keeps the keyboard in search.
  click(primary()); await flush();
  expect(document.activeElement).toBe(search());
  expect(search().getAttribute('aria-activedescendant')).toBe('hub-result-2');
  press('Enter'); await flush();
  expect(invites()).toBeNull();
});

test('Travel and invite travels, then sends one invite on arrival', async () => {
  await mountFixture('&party');
  await goTo('zed alpha');
  expect(caption()).toBe('Zed Alpha');
  moveDown(3); await flush();
  expect(primary().textContent).toMatch(/^Travel and invite Zed Alpha/u);
  press('Enter'); await flush();
  expect(text('.hub-receipt')).toBe('Travelling to Kamadan, Jewel of Istan. Hub sends /invite Zed Alpha on arrival.');
  await vi.advanceTimersByTimeAsync(1_500);
  expect([invites(), text('.hub-receipt')]).toEqual(['Zed Alpha', 'Sent /invite Zed Alpha. Guild Wars answers in chat.']);
});

test('a PvP outpost and an explorable area refuse invites before Enter', async () => {
  await mountFixture('&party');
  await goTo('arena ace');
  expect(row('person:travel-invite')?.textContent).toContain('Invites from Hub need a PvE outpost');
  await setLifecycle('pve-explorable');
  fill(search(), 'invite romi'); await flush();
  expect([$$('.hub-row')[0]?.textContent?.includes('Invite players from an outpost'), primary().disabled]).toEqual([true, true]);
});

// HUB-242: a double-click never runs the action that its first click revealed.
test('double-clicking a friend opens the person page and runs nothing', async () => {
  await mountFixture('&party');
  for (const [index, name] of ['Zed Beta', 'Zed Delta', 'Zed Gamma'].entries()) {
    fill(search(), 'zed'); await flush();
    await dblclickAt(index + 1);
    expect([caption(), /TRAVEL|INVITE/u.test(action() ?? ''), document.activeElement === search()]).toEqual([name, false, true]);
    click(button('Home')); await flush();
  }
  // The Seen in chat prefix row in the invite scope: the second click lands on Invite to party.
  fill(search(), 'invite Mo Kai'); await flush();
  await dblclickAt($$('.hub-row').indexOf(rowWith('Seen in chat')!));
  expect([caption(), hubOpen(), invites()]).toEqual(['Mo Kaiser', true, null]);
});

// D-24: a row that changes the game only selects on a click.
test('a click only selects an invite; the footer or a double-click on it sends one', async () => {
  await mountFixture('&party');
  fill(search(), 'invite Mo Kai'); await flush();
  const typed = $$('.hub-row')[0]!;
  expect(typed.textContent).toContain('Character name');
  press('ArrowDown'); await flush();
  click(typed); await flush();
  expect([typed.getAttribute('aria-selected'), primary().textContent, document.activeElement === search()]).toEqual(['true', expect.stringMatching(/^Invite Mo Kai/u), true]);
  await settle();
  expect(invites()).toBeNull();
  dblclick(typed); await flush();
  expect(invites()).toBe('Mo Kai');
  await openHub();
  fill(search(), 'invite Mo Kai'); await flush();
  click($$('.hub-row')[0]!); await flush();
  click(primary()); await flush();
  expect(invites()).toBe('Mo Kai|Mo Kai');
});

// ---- Characters: typing never switches --------------------------------------------------------

const card = (key: string) => $(`button[data-character-key="${key}"]`);
const focusedCard = () => document.activeElement instanceof HTMLElement ? document.activeElement.dataset.characterKey : undefined;
const query = () => narrow(HTMLInputElement, $('#character-switch-query'));
const toCharacters = async () => { press('Escape'); await flush(); press('Meta+e'); await flush(); };

// D-5, HUB-002: a digit selects and reveals its card; only Enter switches, to the card the footer names.
test('digits select and reveal a card, held digits repeat nothing, and Enter switches once', async () => {
  await mountFixture();
  await toCharacters();
  expect(focusedCard()).toBe('monk');
  // Card 7 is not drawn on a fresh open; its digit reveals it.
  expect(card('warrior')).toBeNull();
  press('7'); await flush();
  expect([focusedCard(), card('warrior')?.getAttribute('aria-selected'), primary().textContent]).toEqual(['warrior', 'true', expect.stringMatching(/^Switch to Fixture Warrior/u)]);
  press('3'); await flush();
  expect(focusedCard()).toBe('mesmer');
  // A digit with no card types nothing and switches nothing.
  press('0'); await flush();
  expect([focusedCard(), query().value]).toEqual(['mesmer', '']);
  hold('2', 5); await flush();
  expect([focusedCard(), query().value, action(), primary().textContent]).toEqual(['ranger', '', null, expect.stringMatching(/^Switch to Fixture Ranger/u)]);
  press('Enter'); await flush();
  expect(action()).toBe('Character ranger');
});

test('a digit typed after a resume selects a card, and the rest searches', async () => {
  await mountFixture();
  await toCharacters();
  expect(focusedCard()).toBe('monk');
  blur(); await flush();
  expect(hubOpen()).toBe(false);
  press('Meta+r'); await flush();
  expect(caption()).toBe('Characters');
  press('ArrowRight'); press('ArrowRight'); await flush();
  expect(focusedCard()).toBe('mesmer');
  blur(); press('Meta+e'); await flush();
  expect(focusedCard()).toBe('mesmer');
  type('2p in g'); await flush();
  expect([query().value, action()]).toEqual(['p in g', null]);
});

// HUB-009: a closed search never picks the card on the next open.
test('reopening Characters focuses the current character after any close', async () => {
  await mountFixture();
  press('Escape'); await flush();
  const closes: [string, () => Promise<void>][] = [
    ['Escape', async () => { press('Escape'); press('Escape'); await flush(); }],
    ['the close button', async () => { click(button('Close Hub')); await flush(); }],
    ['expired backdrop suspension', async () => { click($('#hub')!); await flush(); await vi.advanceTimersByTimeAsync(90_001); }],
    ['expired blur suspension', async () => { blur(); await flush(); await vi.advanceTimersByTimeAsync(90_001); }],
  ];
  for (const [name, close] of closes) {
    press('Meta+e'); await flush();
    expect([name, focusedCard()]).toEqual([name, 'monk']);
    type('toe'); await flush();
    expect([name, shown(card('toefte')!)]).toEqual([name, true]);
    await close();
    expect([name, hubOpen()]).toEqual([name, false]);
    press('Meta+e'); await flush();
    expect([name, focusedCard(), card('monk')?.getAttribute('aria-current')]).toEqual([name, 'monk', 'true']);
    press('Escape'); await flush();
    expect([name, hubOpen()]).toEqual([name, false]);
  }
  expect(action()).toBeNull();
});

// HUB-033: a prefix that names several characters opens the cards on the top hit.
test('an ambiguous char prefix opens Characters on the top hit and switches nothing', async () => {
  await mountFixture();
  fill(search(), 'char fixture r'); await flush();
  expect(primary().textContent).toMatch(/^Show Fixture Ranger in Characters/u);
  press('Enter'); await flush();
  expect([caption(), focusedCard(), action()]).toEqual(['Characters', 'ranger', null]);
  press('Meta+Backspace'); await flush();
  expect(search().value).toBe('char fixture r');
  // An exact name or the sole match still switches directly.
  fill(search(), 'char toe'); await flush();
  expect(primary().textContent).toMatch(/^Switch to Toefte/u);
  press('Enter'); await flush();
  expect(action()).toBe('Character toefte');
});

// HUB-073: a state that refuses switching says so on open, in plain words, and Enter asks nothing.
test.each([
  ['map-loading', 'Wait until Guild Wars finishes loading, then try again.'],
  ['pvp-explorable', 'Character switching is unavailable during active PvP.'],
])('loading and PvP refusals show on Characters and char rows before Enter and switch nothing (%s, HUB-073)', async (lifecycleName, reason) => {
  await mountFixture(`&lifecycle=${lifecycleName}`);
  fill(search(), 'char toefte'); await flush();
  expect([row('character:toefte')?.getAttribute('aria-disabled'), detail(row('character:toefte'))]).toEqual(['true', reason]);
  press('Escape'); await flush(); press('Meta+e'); await flush();
  expect([text('.character-switch-status'), focusedCard()]).toEqual([reason, 'monk']);
  press('ArrowRight'); await flush();
  expect([card('ranger')?.getAttribute('aria-disabled'), primary().disabled]).toEqual(['true', true]);
  press('Enter'); await flush();
  expect([action(), app().dataset.characterRequests, $('#hub')!.textContent?.includes('(game-loading)'), shown($('.character-switch-details')!)]).toEqual([null, '0', false, false]);
});

// D-30, HUB-193: a running switch covers the game with one quiet line and answers a second request.
// Its veil absorbing a click at the game's pixels stays in the Playwright spec.
test('a running switch shows its veil and says a switch is running', async () => {
  await mountFixture('&switch-fail=selector-timeout&switch-ms=4000');
  await goTo('char toefte');
  const veil = $('.character-switch-veil')!;
  expect([norm(veil.textContent), veil.querySelectorAll('button, a, input, [tabindex]').length]).toEqual(['Switching to Toefte…', 0]);
  for (const route of ['shortcut', 'sw']) {
    if (route === 'shortcut') press('Meta+e');
    else { press('Meta+r'); await flush(); fill(search(), 'sw'); press('Enter'); }
    await flush();
    expect([route, text('.hub-receipt'), action(), app().dataset.characterRequests]).toEqual([route, 'A character switch is already running.', 'Character toefte', '1']);
  }
  click(button('Close Hub')); await flush();
  await vi.advanceTimersByTimeAsync(6_000);
  expect([shown(veil), text('.hub-receipt'), action()]).toEqual([false, 'Switch to Toefte stopped. Automatic switching stopped. Continue from the Guild Wars character selector.', 'Character toefte']);
});

// HUB-197, HUB-195, HUB-194: search keeps the chosen card; badges and profession pairs read true.
test('clearing, spacing or pasting in the search keeps the chosen card, and cards show their profession pair', async () => {
  await mountFixture('&characters-extra');
  await toCharacters();
  press('3'); await flush();
  expect(focusedCard()).toBe('mesmer');
  type('fix'); await flush();
  expect([query().value, card('mesmer')?.getAttribute('aria-selected')]).toEqual(['fix', 'true']);
  query().focus(); press(' '); await flush();
  expect(card('mesmer')?.getAttribute('aria-selected')).toBe('true');
  fill(query(), ''); await flush();
  expect(card('mesmer')?.getAttribute('aria-selected')).toBe('true');
  fill(query(), 'toe'); await flush();
  expect(card('toefte')?.getAttribute('aria-selected')).toBe('true');
  // A search hides the number badges instead of drawing empty squares.
  expect([card('toefte')!.querySelector('.character-switch-key')!.textContent, card('toefte')!.querySelector('.character-switch-meta')?.textContent]).toEqual(['', expect.stringContaining('Mo/Me')]);
  fill(query(), ''); await flush();
  card('mesmer')!.focus(); press('End'); await flush();
  const last = card('extra-5')!;
  expect([last.getAttribute('aria-selected'), last.querySelector('.character-switch-key')!.textContent, last.querySelector('.character-switch-meta')?.textContent]).toEqual(['true', '', expect.stringContaining('Mo/Me · PvP')]);
  for (const enabled of [false, true]) {
    click(button('Character Switch settings')); await flush();
    const toggle = narrow(HTMLInputElement, $('#character-switch-show-profession'));
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change', { bubbles: true }));
    click(button('Character Switch settings')); await flush();
    const meta = last.querySelector('.character-switch-meta')?.textContent ?? '';
    if (enabled) expect(meta).toContain('Mo/Me · PvP'); else expect(meta).not.toMatch(/Mo|Me|PvP/u);
  }
  expect(action()).toBeNull();
});

// HUB-198, HUB-199: one name, no unsaved search toggle. The card band's height stays in Playwright.
test('Characters shows one name and keeps no unsaved search setting', async () => {
  await mountFixture();
  await toCharacters();
  expect(caption()).toBe('Characters');
  expect($('#character-switch-title')?.classList.contains('ui-sr-only')).toBe(true);
  window.dispatchEvent(new Event('hub-fixture-character-refusal')); await flush();
  expect(text('.character-switch-status')).toBe('This character is already active.');
  card('monk')!.focus(); press('ArrowRight'); await flush();
  expect(text('.character-switch-status')).toBe('');
  click(button('Character Switch settings')); await flush();
  expect($('#hub')!.textContent).not.toContain('Show search bar');
});

// HUB-034, HUB-075: the confirmation names the character; Stay returns to the row that asked.
test('Leave this area names the character picked from the cards', async () => {
  await mountFixture('&lifecycle=pve-explorable');
  press('Meta+e'); await flush();
  expect(focusedCard()).toBe('monk');
  press('3'); await flush();
  expect(focusedCard()).toBe('mesmer');
  press('Enter'); await flush();
  expect([byRole('heading', 'Leave this area and switch to Fixture Mesmer?', true).length, byRole('button', 'Leave and switch to Fixture Mesmer', true).length]).toEqual([1, 1]);
});

test.each(['Stay here', 'Escape'])('Leave this area names the character, and %s returns to the search that asked', async cancel => {
  await mountFixture('&lifecycle=pve-explorable');
  {
    fill(search(), 'char toefte'); press('Enter'); await settle();
    expect([cancel, byRole('heading', 'Leave this area and switch to Toefte?', true).length]).toEqual([cancel, 1]);
    const leave = button('Leave and switch to Toefte');
    expect([cancel, leave.dataset.variant, document.activeElement?.id]).toEqual([cancel, 'danger', 'character-switch-stay']);
    press('ArrowRight'); await flush();
    expect(document.activeElement).toBe(leave);
    press('ArrowLeft'); await flush();
    if (cancel === 'Stay here') press('Enter'); else press('Escape');
    await flush();
    expect([cancel, caption(), search().value, document.activeElement === search(), action()]).toEqual([cancel, 'Home', 'char toefte', true, null]);
  }
});

// ---- Travel digits, held Enter, stored phrases --------------------------------------------------

test('a Travel number key selects its favourite, a held one repeats nothing, and only Enter travels', async () => {
  await mountFixture();
  press('Escape'); await flush(); press('Meta+t'); await flush();
  const travelSearch = narrow(HTMLInputElement, $('#travel-search-input'));
  expect(document.activeElement).toBe(travelSearch);
  hold('1', 5); await flush();
  expect([$('#travel-favorite-0')?.getAttribute('aria-selected'), primary().textContent, caption(), travelSearch.value, /TRAVEL/u.test(action() ?? '')])
    .toEqual(['true', expect.stringMatching(/^Travel to Ascalon City/u), 'Travel', '', false]);
  press('Enter'); await settle();
  expect([action(), hubOpen()]).toEqual(['TRAVEL Ascalon City', false]);
});

test('editing a phrase preserves pin order and a delayed save cannot navigate a later page', async () => {
  const kept = [{ id: 'maps', phrase: '', pinned: true }, { id: 'travel', phrase: '', pinned: true }];
  await mountFixture('&settings-ms=700', shortcuts(kept));
  fill(search(), 'maps'); press('Meta+j'); await flush();
  click(byRole('menuitem', 'Set search phrase')[0]!); await flush();
  fill(phraseBox(), 'my map'); press('Enter'); await tick();
  press('Meta+Backspace'); await tick();
  fill(search(), 'commands'); press('Enter'); await flush();
  expect(caption()).toBe('Commands');
  await vi.advanceTimersByTimeAsync(1_500);
  expect([stored(), caption(), document.activeElement === $('#hub input[role=combobox]')]).toEqual([[{ id: 'maps', phrase: 'my map', pinned: true }, kept[1]], 'Commands', true]);
});

test('pins keep each storage owner limit and preserve unresolved references while another owner changes (HUB-090)', async () => {
  const global = [{ id: 'maps', phrase: '', pinned: true }, ...Array.from({ length: 63 }, (_, index) => ({ id: `place:${10000 + index}`, phrase: '', pinned: true }))];
  await mountFixture('', shortcuts(global));
  fill(search(), 'team gom afk'); press('Meta+j'); await flush();
  click(byRole('menuitem', 'Pin to Hub', true)[0]!); await flush();
  expect([text('#hub .hub-status'), stored()]).toEqual(['Pinned GOM AFK.', global]);
  fill(search(), 'maps'); press('Meta+j'); await flush();
  click(byRole('menuitem', 'Set search phrase')[0]!); await flush();
  fill(phraseBox(), 'my map'); press('Enter'); await settle();
  expect([text('#hub .hub-status'), stored()]).toEqual(['“my map” now finds Maps.', [{ id: 'maps', phrase: 'my map', pinned: true }, ...global.slice(1)]]);
});

test('existing global and Travel phrases that name different places require a choice everywhere (HUB-061)', async () => {
  await mountFixture();
  press('Meta+t'); await flush();
  click(button('Customize Travel')); await flush();
  click(button('+ Add phrase')); await flush();
  fill(narrow(HTMLInputElement, $('#travel-new-phrase')), 'home');
  const picker = $('.travel-add-phrase details')!;
  click(picker.querySelector('summary')!); await flush();
  const pick = picker.querySelector<HTMLInputElement>('[role="combobox"], input')!;
  expect(document.activeElement).toBe(pick);
  fill(pick, 'kamadan'); await flush();
  click([...picker.querySelectorAll<HTMLElement>('[role="option"]')].find(option => /Kamadan, Jewel of Istan/u.test(option.textContent ?? ''))!); await flush();
  click(button('Save')); await flush();
  expect(narrow(HTMLInputElement, $('#travel-search-input')).value).toBe('home');
  const kept = [{ id: 'place:194', phrase: 'home', pinned: true }];
  // Simulate an older app's separate global store arriving, without editing either phrase.
  const arrived = window.gwNative.settings.set({ hubShortcuts: kept }); await flush(); await arrived;
  press('Meta+Backspace'); await flush();
  for (const text of ['home', 'travel home']) {
    fill(search(), text); await flush();
    expect([text, shown(row('place:194')!), shown(row('place:449')!), $$('.hub-row[aria-selected="true"]').length]).toEqual([text, true, true, 0]);
    press('Enter'); await flush();
    expect([text, caption(), action()]).toEqual([text, 'Home', null]);
  }
  press('Meta+t'); await flush();
  const destination = narrow(HTMLInputElement, $('#travel-search-input'));
  fill(destination, 'home'); await flush();
  expect(destination.getAttribute('aria-activedescendant')).toBeNull();
  press('Enter'); await flush();
  expect([action(), stored()]).toEqual([null, kept]);
});
