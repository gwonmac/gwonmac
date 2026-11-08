/**
 * The Hub's search, row and view rules with the real controller and the fixture's game, people,
 * whispers, Trade and Travel hosts in happy-dom (what hub.spec.ts drove in a browser): rows and
 * footers per query, Escape order, friend actions, whisper drafts, team and build review versus
 * apply, calculator and title text, Travel entry routes, account choices, settings inside the
 * Hub, and the floating tools a row opens. Layout, computed styles, decoded images, reloads
 * and the browser's own text editing stay in Playwright.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, press, settle, shown, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const hub = () => document.getElementById('hub') as HTMLDialogElement;
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const hubOpen = () => hub().open && shown(hub());
const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
const caption = () => text('.hub-caption');
const action = () => document.getElementById('app')!.dataset.action ?? '';
const options = () => [...document.querySelectorAll<HTMLElement>('#hub [role="option"]')];
const option = (pattern: RegExp) => options().find(row => pattern.test(row.textContent ?? ''));
const selectedRow = () => document.querySelector<HTMLElement>('#hub .hub-row[aria-selected="true"]');
const primary = () => text('.hub-primary') ?? '';
const button = (name: string, exact = true) => byRole('button', name, exact)[0]!;
const send = (name: string, detail?: unknown) => window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
const choose = (field: Element, value: string) => { (field as HTMLSelectElement).value = value; field.dispatchEvent(new Event('change', { bubbles: true })); };
/** A key whose effect lands after a render tick. */
const tick = async (chord: string) => { press(chord); await vi.advanceTimersByTimeAsync(30); };
const go = async (query: string) => { fill(search(), query); press('Enter'); await settle(); };
const actionsButton = () => document.querySelector<HTMLButtonElement>('.hub-actions')!;
const primaryButton = () => document.querySelector<HTMLButtonElement>('.hub-primary')!;
/** A tool switched off through the fixture's settings event stays off for the next mount in this file, so each such test puts them back. */
const restoreTools = () => send('hub-fixture-settings', { buildLibrary: true, tradeChat: true, whispersEnabled: true });
const draft = (name: string) => byRole('textbox', `Message ${name}`, true)[0] as HTMLTextAreaElement | undefined;

test('calculator retains labelled values when optional currency artwork fails', async () => {
  await mountFixture();
  fill(search(), '1250 gold in p'); await settle();
  const arts = [...document.querySelectorAll('#hub .hub-conversion-art')];
  for (const art of arts) art.dispatchEvent(new Event('error'));
  await settle();
  expect(option(/1\.25 platinum/u)).toBeDefined();
  expect(document.querySelectorAll('#hub .hub-conversion-art').length).toBe(0);
  expect((byRole('button', 'Copy 1.25 platinum')[0] as HTMLButtonElement).disabled).toBe(false);
});

test('Hub searches, restores the query after actions, and hands off explicitly', async () => {
  await mountFixture();
  expect(document.activeElement).toBe(search());
  fill(search(), 'settings'); await settle();
  // The command, then the launcher setting whose name holds the word.
  expect(options().length).toBe(2);
  expect(selectedRow()!.dataset.id).toBe('settings');
  // A pinnable search result exposes its extra actions in the shared menu.
  expect(actionsButton().disabled).toBe(false);
  press('Meta+j'); await settle();
  expect(byRole('menuitem', 'Pin to Hub').length).toBe(1);
  press('Escape'); await settle();
  press('Enter'); await settle();
  expect(hubOpen()).toBe(true);
  expect(document.querySelector('nav[aria-label="Settings sections"]')).not.toBeNull();
  // A mounted Settings page has only Done; the Actions slot stays disabled (HUB-043).
  expect(actionsButton().disabled).toBe(true);
  expect(action()).not.toBe('Settings');
});

test('no results, editing shortcuts and dismissal', async () => {
  await mountFixture();
  fill(search(), 'no such tool'); await settle();
  expect(hub().textContent).toContain('No matches');
  fill(search(), 'build'); await settle();
  // The tool, then its Tools setting of the same name.
  expect(options()[0]!.textContent).toContain('Build Library');
  // D-4: the first Esc clears the typed query, the next one closes.
  press('Escape'); await settle();
  expect(search().value).toBe('');
  expect(document.activeElement).toBe(search());
  press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  click(button('Open Hub')); await settle();
  expect(search().value).toBe('');
  expect(document.activeElement).toBe(search());
});

test('Esc clears the query, then goes back, then closes onto the game, never <body>', async () => {
  await mountFixture();
  for (const query of ['invite mo', 'travel kam', 'kamadan', 'invite ']) {
    fill(search(), query); press('Escape'); await settle();
    expect(hubOpen(), query).toBe(true); expect(search().value, query).toBe(''); expect(document.activeElement, query).toBe(search());
  }
  await go('switch account');
  expect(caption()).toBe('Accounts');
  fill(search(), 'pin'); press('Escape'); await settle();
  expect(search().value).toBe(''); expect(caption()).toBe('Accounts');
  press('Escape'); await settle();
  expect(caption()).toBe('Home'); expect(search().value).toBe('switch account');
  press('Escape'); press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  // The fixture opens Hub on load, so no opener was focused: focus returns to the game canvas.
  expect(document.activeElement).toBe(document.getElementById('canvas'));
});

test('outpost travel closes Hub quietly after acceptance', async () => {
  await mountFixture();
  fill(search(), 'embark'); await settle();
  expect(options().length).toBe(1);
  expect(options()[0]!.textContent).toContain('Embark Beach');
  press('Enter'); await settle();
  expect(hubOpen()).toBe(false);
});

test('a friend opens explicit actions and an offline location cannot travel', async () => {
  await mountFixture();
  await go('romi');
  expect(options().map(row => row.querySelector('.hub-title')?.textContent)).toEqual(['Whisper', 'Travel to outpost', 'Invite to party', 'Travel and invite']);
  expect(option(/Travel to outpost/u)!.textContent).toContain('You are already in this outpost');
  expect(option(/Travel to outpost/u)!.getAttribute('aria-disabled')).toBe('true');
  click(button('Back')); await settle();
  expect(search().value).toBe('romi');
  await go('offline');
  expect(option(/Travel to outpost/u)!.getAttribute('aria-disabled')).toBe('true');
  expect(option(/Travel to outpost/u)!.textContent).toContain('offline');
});

test('one floating whisper view keeps drafts through dismissal and failures', async () => {
  await mountFixture();
  fill(search(), 'romi'); press('Enter'); await settle(); press('Enter'); await settle();
  expect(document.activeElement).toBe(draft('Romi Ranger'));
  fill(draft('Romi Ranger')!, 'Meet in Kamadan?');
  click(button('Hide Whispers')); await settle();
  click(button('Open Hub')); await settle();
  expect(caption()).toBe('Romi Ranger');
  click(button('Back')); await settle();
  await go('whispers');
  expect(document.activeElement).toBe(draft('Romi Ranger'));
  expect(draft('Romi Ranger')!.value).toBe('Meet in Kamadan?');
  send('hub-fixture-failure');
  press('Enter'); await settle();
  expect(byRole('alert', '').some(alert => alert.textContent?.includes('Your draft is kept'))).toBe(true);
  expect(draft('Romi Ranger')!.value).toBe('Meet in Kamadan?');
  click(document.querySelector('.whisper-options summary')!); await settle();
  click(button('Close conversation with Romi Ranger')); await settle();
  expect(byRole('alert', '').some(alert => alert.textContent?.includes('Discard') && shown(alert))).toBe(true);
  click(button('Keep chatting')); await settle();
  expect(draft('Romi Ranger')!.value).toBe('Meet in Kamadan?');
});

test('sending uses observed messages, and session reset clears the shared view', async () => {
  await mountFixture();
  await go('whisper Romi Ranger');
  fill(draft('Romi Ranger')!, 'Hello'); press('Enter'); await settle();
  expect(document.getElementById('app')!.dataset.sends).toBe('1');
  expect(draft('Romi Ranger')!.value).toBe('');
  expect([...document.querySelectorAll('.whisper-transcript')].filter(shown).map(node => node.textContent).join()).toContain('Hello');
  send('hub-fixture-reset'); await settle();
  expect(draft('Romi Ranger')).toBeUndefined();
  expect(document.querySelectorAll('.whisper-message').length).toBe(0);
  expect(shown(document.getElementById('whisper-window')!)).toBe(false);
});

test('a withdrawn friend cannot act through an already open action view', async () => {
  await mountFixture();
  await go('romi');
  send('hub-fixture-withdraw'); await settle();
  expect(option(/Travel to outpost/u)!.getAttribute('aria-disabled')).toBe('true');
  expect(option(/Whisper/u)!.getAttribute('aria-disabled')).toBe('true');
  press('Enter'); await settle();
  expect(document.getElementById('hub-draft')).toBeNull();
});

test('exact build has a visible target and does not apply while typing', async () => {
  await mountFixture();
  fill(search(), 'build smiter'); await settle();
  expect(primary()).toContain('Choose target');
  expect((document.querySelector('.hub-primary') as HTMLButtonElement).disabled).toBe(false);
  expect(document.querySelector('.hub-preview') === null || !shown(document.querySelector('.hub-preview')!)).toBe(true);
  expect(document.querySelector('.hub-build-row')!.textContent).not.toContain('Templates/Skills');
  expect(document.querySelector('.hub-build-row [alt="Healing Prayers 12"], .hub-build-row [aria-label="Healing Prayers 12"]')).not.toBeNull();
  expect(action()).not.toMatch(/command|apply/u);
  press('Enter'); await settle();
  expect(hubOpen()).toBe(true);
  expect(action()).not.toMatch(/command|apply/u);
  // The footer names the build and the character before Enter (BLD-09).
  expect(primary()).toBe('Apply Smiter to Fixture Monk↵');
  click(primaryButton()); await settle();
  expect(hubOpen()).toBe(false);
});

test('team preflight is inline and an interruption is not reported as success', async () => {
  await mountFixture();
  send('hub-fixture-lifecycle', 'pve-explorable');
  fill(search(), 'team gom afk'); await settle();
  expect(primary()).toContain('Apply team GOM AFK');
  expect(primaryButton().disabled).toBe(true);
  expect(options()[0]!.textContent).toContain('outpost');
  send('hub-fixture-lifecycle', 'outpost');
  send('hub-fixture-scenario', 'partial'); await settle();
  expect(document.querySelector('.hub-row')!.getAttribute('aria-disabled')).toBe('false');
  await tick('ArrowDown');
  expect(primary()).toContain('Apply team GOM AFK');
  expect(primaryButton().disabled).toBe(false);
  press('Enter'); await settle();
  expect(text('.hub-status')).toContain('1 change was confirmed');
  expect(document.querySelector('.hub-status')!.getAttribute('role')).toBe('status');
  expect(hubOpen()).toBe(true);
});

test('calculator shows both observed trader rates and fixed conversions', async () => {
  await mountFixture();
  fill(search(), '10 ecto in p'); await settle();
  expect(option(/60 platinum.*Buy from trader/u)).toBeDefined();
  choose(byRole('combobox', 'Price basis')[0]!, 'sell'); await settle();
  expect(option(/50 platinum.*Sell to trader/u)).toBeDefined();
  fill(search(), '1250 gold in p'); await settle();
  expect(options().length).toBe(1);
  expect(options()[0]!.textContent).toContain('1.25 platinum');
  press('Enter'); await settle();
  expect(action()).toBe('Copied 1250 gold = 1.25 platinum · Fixed conversion · 1 platinum = 1,000 gold');
  // The copy names what it copied in the Hub status line (D-8).
  expect(text('#hub .hub-status')).toBe('Copied “1.25 platinum”');
  fill(search(), '1p in g'); press('Enter'); await settle();
  expect(text('#hub .hub-status')).toBe('Copied “1,000 gold”');
  expect(action()).toBe('Copied 1 p = 1,000 gold · Fixed conversion · 1 platinum = 1,000 gold');
  expect(hubOpen()).toBe(true);
});

test('Build shortcut browses inside Hub and opens the authoring window outside Hub', async () => {
  await mountFixture();
  expect(document.activeElement).toBe(search());
  press('Meta+b'); await settle();
  expect(caption()).toBe('Build Library');
  expect(shown(document.querySelector('#toolbox-builds .tools-window')!)).toBe(false);
  click(button('Close Hub')); await settle();
  press('Meta+b'); await settle();
  expect(shown(document.querySelector('#toolbox-builds .tools-window')!)).toBe(true);
  press('Meta+k'); await settle();
  expect(shown(document.querySelector('#toolbox-trade .trade-window')!)).toBe(true);
  expect(document.querySelectorAll('#hub #toolbox-builds').length).toBe(0);
});

test('duplicate exact names require a deliberate selection', async () => {
  await mountFixture();
  click(button('Close Hub', false)); await settle();
  choose(byRole('combobox', 'Fixture scenario')[0]!, 'duplicate');
  if (!hubOpen()) press('Meta+r');
  await settle();
  fill(search(), 'build smiter'); await settle();
  expect(options().length).toBe(2);
  expect(primary()).toBe('Select a result');
  expect(primaryButton().disabled).toBe(true);
  press('Enter'); await settle();
  expect(action()).not.toMatch(/command|apply/u);
  press('ArrowDown'); press('Enter'); await settle();
  expect(option(/Apply to hero/u)).toBeDefined();
});

test('disabled capabilities disappear including friend child actions', async () => {
  await mountFixture();
  send('hub-fixture-settings', { buildLibrary: false, tradeChat: false, whispersEnabled: false }); await settle();
  try {
    fill(search(), 'build smiter'); await settle(); expect(options().length).toBe(0);
    fill(search(), 'trade ecto'); await settle(); expect(options().length).toBe(0);
    await go('romi');
    expect(option(/Whisper/u)).toBeUndefined();
    expect(option(/Travel to outpost/u)).toBeDefined();
  } finally { restoreTools(); }
});

test('storage refusal stays silent', async () => {
  await mountFixture();
  await go('storage');
  expect(hubOpen()).toBe(false);
  expect(byRole('alert', '').length).toBe(0);
});

test('character search switches the explicitly selected observed character', async () => {
  await mountFixture();
  fill(search(), 'char Toefte'); await settle();
  expect(options()[0]!.textContent).toContain('Toefte');
  expect(primary()).toBe('Switch to Toefte↵');
  expect(action()).not.toMatch(/Character/u);
  press('Enter'); await settle();
  expect(action()).toBe('Character toefte');
  expect(hubOpen()).toBe(false);
});

test('trade query opens the same floating searchable tool with the words as typed (HUB-124)', async () => {
  await mountFixture();
  fill(search(), 'trade Polar Bear'); await settle();
  expect(selectedRow()!.textContent).toContain('Search Trade for Polar Bear');
  expect(selectedRow()!.textContent).not.toContain('Kamadan');
  expect(selectedRow()!.querySelector('.hub-icon')!.getAttribute('data-kind')).toBe('trade');
  press('Enter'); await settle();
  expect(document.querySelector<HTMLInputElement>('#toolbox-trade .trade-search input')!.value).toBe('Polar Bear');
  expect(hubOpen()).toBe(false);
  expect(document.querySelector<HTMLInputElement>('#toolbox-foundation .trade-search input')!.value).toBe('Polar Bear');
});

test('Maps controls save inline without navigating away', async () => {
  await mountFixture();
  send('hub-fixture-settings', { cartographyEnabled: true }); await settle();
  await go('maps');
  expect(caption()).toBe('Settings');
  click(byRole('checkbox', 'Exploration grid')[0]!); await settle();
  const slider = () => byRole('slider', 'Grid opacity')[0] as HTMLInputElement;
  expect(slider()).toBeDefined();
  fill(slider(), '45'); slider().dispatchEvent(new Event('change', { bubbles: true })); await settle();
  expect(slider().value).toBe('45');
  expect(text('.hub-view')).toContain('Saved: Grid opacity.');
});

test('market conversions show inferred medians, sides, provenance', async () => {
  await mountFixture();
  fill(search(), '1p in a'); await settle();
  const card = () => document.querySelector('#hub .hub-row')!.textContent!;
  expect(card()).toContain('~ 0.006667 armbrace');
  expect(card()).toContain('Sample prices');
  expect(card()).toContain('(sample)');
  expect(card()).not.toContain('recent Kamadan trade ads');
  click(button('Details')); await settle();
  expect(text('.hub-view')).toContain('6 advertisers');
  expect(text('.hub-view')).toContain('Ads since');
  click(button('Back')); await settle();
  choose(byRole('combobox', 'Price basis')[0]!, 'wtb'); await settle();
  expect(card()).toContain('~ 0.008929 armbrace');
  expect(card()).toContain('Buyer offers');
  fill(search(), '1 stack zkeys in e'); await settle();
  expect(card()).toContain('~ 350 ecto');
  choose(byRole('combobox', 'Price basis')[0]!, 'wts'); await settle();
  expect(card()).toContain('~ 375 ecto');
});

test('compact armbrace conversions use explicit manual rates', async () => {
  await mountFixture();
  fill(search(), '1p in a'); await settle();
  const card = () => document.querySelector('#hub .hub-row')!.textContent!;
  expect(card()).toContain('~ 0.006667 armbrace');
  click(actionsButton()); await settle();
  click(byRole('menuitem', 'Show price details')[0]!); await settle();
  click(button('Edit rates')); await settle();
  choose(byRole('combobox', 'Rate source')[0]!, 'manual'); await settle();
  fill(byRole('textbox', 'Gold per ectoplasm')[0] as HTMLInputElement, '5000');
  fill(byRole('textbox', 'Ectoplasm per armbrace')[0] as HTMLInputElement, '30');
  fill(byRole('textbox', 'Ectoplasm per Zaishen key')[0] as HTMLInputElement, '0.5');
  click(button('Use these rates', false)); await settle();
  click(button('Back')); await settle(); click(button('Back')); await settle();
  expect(card()).toContain('0.006667 armbrace');
  expect(card()).toContain('Your rates');
  fill(search(), '100k + 10e in a'); await settle(); expect(card()).toContain('1 armbrace');
  fill(search(), '1 stack zkeys in e'); await settle(); expect(card()).toContain('125 ecto');
  fill(search(), '14a/stk in e each'); await settle(); expect(card()).toContain('1.68 ecto');
});

test('insufficient market evidence stays inline without a setup prompt', async () => {
  await mountFixture('&market-empty');
  fill(search(), '1p in a'); await settle();
  expect(text('#hub .hub-row')).toContain('Not enough recent prices');
  expect(!document.querySelector('.hub-view') || !shown(document.querySelector('.hub-view')!)).toBe(true);
  expect(hub().textContent).not.toContain('Set Armbrace');
});

test('title progress leads into editable shopping quantities without changing game state', async () => {
  await mountFixture();
  fill(search(), 'sweet tooth from 7350'); await settle();
  expect(text('.hub-conversion')).toContain('2,650 points remaining');
  expect(text('.hub-conversion')).toContain('entered points');
  press('Enter'); await settle();
  expect(search().value).toBe('2650 sweet points');
  expect(text('#hub .hub-row')).toContain('1,325 × Birthday Cupcake');
  fill(search(), '2651 sweet points'); await settle();
  expect(text('#hub .hub-row')).toContain('1 excess point');
  fill(search(), '250 sweet points for 3e'); await settle();
  expect(text('.hub-conversion')).toContain('0.012 ecto / point');
  expect(text('.hub-conversion')).toContain('Not a market quote');
});

test('title examples are editable, exact, and reject the wrong point track', async () => {
  await mountFixture();
  await go('titles');
  expect(search().value).toBe('sweet tooth from 7350');
  fill(search(), '1 stack grog in drunk points'); await settle();
  expect(text('.hub-conversion')).toContain('750 Drunkard points');
  fill(search(), 'zaishen rank 3 from 500'); await settle();
  expect(hub().textContent).toContain('100 × Zaishen Key');
  fill(search(), '250 cupcakes in party points'); await settle();
  expect(hub().textContent).toContain('Birthday Cupcake gives Sweet Tooth points');
  expect(!document.querySelector('.hub-view') || !shown(document.querySelector('.hub-view')!)).toBe(true);
});

test.each([
  ['search', 'Kamadan, Jewel of Istan'], ['recent', 'Kaineng Center'],
  ['favourite', 'Ascalon City'], ['digit', 'Kamadan, Jewel of Istan'],
  ['guild hall', 'Guild Hall'], ['shortcut', 'Kamadan, Jewel of Istan'],
])('Travel ends the Hub task from the %s route (HUB-017)', async (route, destination) => {
  await mountFixture();
  if (route === 'shortcut') press('Meta+t'); else await go('travel');
  await settle();
  const travel = () => document.getElementById('travel-search-input') as HTMLInputElement;
  expect(document.activeElement).toBe(travel());
  if (route === 'search') fill(travel(), 'kamadan');
  if (route === 'recent') press('ArrowDown');
  if (route === 'favourite') click(document.getElementById('travel-favorite-0')!);
  if (route === 'digit') press('3');
  if (route === 'guild hall') fill(travel(), 'gh');
  await settle();
  press('Enter'); await settle();
  expect(action()).toBe(`TRAVEL ${destination}`);
  expect(hubOpen()).toBe(false);
});

test('Travel: Escape on an empty search returns to its parent with the root query and focus (HUB-017)', async () => {
  await mountFixture();
  await go('travel');
  press('Escape'); await settle();
  expect(caption()).toBe('Home');
  expect(search().value).toBe('travel');
  expect(document.activeElement).toBe(search());
});

test('exact team applies through the observed runner, prefixes only review', async () => {
  await mountFixture();
  fill(search(), 'team gom af'); await settle();
  expect(primary()).toBe('Review GOM AFK↵');
  expect(primaryButton().disabled).toBe(false);
  press('Enter'); await settle();
  expect(text('#hub h2')).toBe('GOM AFK');
  expect(action()).not.toMatch(/command|apply/u);
  click(button('Back')); await settle();
  fill(search(), 'team gom afk'); await settle();
  expect(primary()).toBe('Apply team GOM AFK↵');
  expect(primaryButton().disabled).toBe(false);
  press('Enter'); await settle();
  expect(hubOpen()).toBe(false);
  expect(action()).toMatch(/command:/u);
});

test('Travel empty-query arrows, favorites and settings by keyboard (Hub typography stays in the browser)', async () => {
  await mountFixture();
  await go('travel');
  const travel = () => byRole('combobox', 'Destination, phrase, or friend')[0] as HTMLInputElement;
  expect(document.activeElement).toBe(travel());
  const selectedId = () => document.querySelector('.travel-history [aria-selected=true]')?.id;
  expect(document.getElementById('travel-recent-449')!.getAttribute('aria-selected')).toBe('true');
  await tick('ArrowDown');
  expect(text('.travel-history [aria-selected=true]')).toContain('Kaineng Center');
  // No list wraps, and ↑ at the top stays in search (HUB-137).
  await tick('ArrowUp'); await tick('ArrowUp');
  expect(selectedId()).toBe('travel-recent-449');
  expect(document.activeElement).toBe(travel());
  click(byRole('button', 'Customize Travel')[0]!); await settle();
  expect(byRole('region', 'Travel settings').length).toBe(1);
  press('Escape'); await settle();
  expect(document.activeElement).toBe(travel());
  fill(travel(), 'kama'); press('Escape'); await settle(); expect(travel().value).toBe('');
  press('Escape'); await settle(); expect(shown(search())).toBe(true);
});

test('Travel names where you are and shows the destination the keys chose (HUB-190, HUB-070)', async () => {
  await mountFixture();
  press('Meta+t'); await settle();
  const travel = () => byRole('combobox', 'Destination, phrase, or friend')[0] as HTMLInputElement;
  expect(document.activeElement).toBe(travel());
  expect(text('.hub-context')).toBe("Fixture Monk · Lion's Arch");
  for (const [query, key, destination] of [['', 'Home', 'Kamadan, Jewel of Istan'], ['rata', '', 'Rata Sum'], ['', '3', 'Kamadan, Jewel of Istan']] as const) {
    fill(travel(), query);
    if (key) await tick(key);
    await settle();
    expect(text('.hub-context')).toBe("Fixture Monk · Lion's Arch");
    expect(primary()).toBe(`Travel to ${destination} · Any district↵`);
  }
});

test('Travel carousel arrows browse without executing and preserve query caret editing', async () => {
  await mountFixture();
  await go('travel');
  const travel = () => byRole('combobox', 'Destination, phrase, or friend')[0] as HTMLInputElement;
  expect(document.activeElement).toBe(travel());
  fill(travel(), 'kamadan');
  // With a query the arrows are the text caret's: the carousel never claims them.
  const native = (key: string) => travel().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  travel().setSelectionRange(3, 3);
  expect(native('ArrowLeft')).toBe(true); expect(travel().value).toBe('kamadan');
  travel().setSelectionRange(0, 0);
  press('ArrowLeft'); expect(travel().value).toBe('kamadan');
  travel().setSelectionRange(7, 7);
  expect(native('ArrowRight')).toBe(true);
  press('End'); press('ArrowRight'); await settle();
  expect(travel().value).toBe('kamadan');
  expect(shown(document.querySelector('#hub .hub-view')!)).toBe(true);
  press('Escape'); await settle(); expect(travel().value).toBe('');
  press('Escape'); await settle(); expect(shown(search())).toBe(true);
  await go('travel');
  await tick('ArrowRight');
  expect(text('.travel-history [aria-selected=true]')).toContain('Kaineng Center');
  expect(shown(document.querySelector('#hub .hub-view')!)).toBe(true);
  press('Enter'); await settle();
  expect(document.querySelector('#hub .hub-view') === null || !shown(document.querySelector('#hub .hub-view')!)).toBe(true);
});

test('profession build search previews eight skills and reviews without applying', async () => {
  await mountFixture();
  const builds = () => document.querySelectorAll('.hub-build-row').length;
  fill(search(), 'build monk'); await settle();
  expect(builds()).toBe(4);
  expect(document.querySelectorAll('.hub-skill').length).toBe(32);
  expect(primary()).toContain('Choose target');
  press('ArrowDown'); press('Enter'); await settle();
  expect(option(/Apply to hero/u)).toBeDefined();
  expect(action()).not.toMatch(/command|apply/u);
  click(button('Back')); await settle();
  fill(search(), 'build mo'); await settle(); expect(builds()).toBe(4);
  fill(search(), 'build monk smit'); await settle(); expect(builds()).toBe(1);
  expect(text('.hub-build-row')).toContain('Smiter');
  fill(search(), 'build monkk'); await settle(); expect(builds()).toBe(0);
  fill(search(), 'build mesmer'); await settle(); expect(builds()).toBe(2);
  expect(text('.hub-build-row')).toContain('Domination shutdown');
});

test('account search offers explicit keep-open and replacement choices', async () => {
  await mountFixture();
  fill(search(), 'acc second'); await settle();
  expect(options().length).toBe(2);
  // Keeping the running game open is row 0 and the default (D-23).
  expect(options()[0]!.textContent).toContain('Open Second');
  expect(options()[1]!.textContent).toContain('Close Main and open Second');
  expect(options()[1]!.querySelector('.hub-detail')!.textContent).toBe('Closes Main');
  expect(options()[1]!.getAttribute('data-destructive')).toBe('true');
  expect(primary()).toBe('Open Second↵');
  await tick('ArrowDown');
  expect(primary()).toBe('Close Main and open Second↵');
  expect(document.querySelector('.hub-primary')!.getAttribute('data-variant')).toBe('danger');
  await tick('ArrowUp');
  expect(action()).not.toMatch(/Account/u);
  press('Enter'); await settle();
  expect(action()).toBe('Account Second open');
  click(button('Open Hub')); await settle();
  // Replacing closes the running game: Enter opens an armed confirmation, and only its Enter replaces.
  fill(search(), 'acc second'); await settle(); await tick('ArrowDown'); press('Enter'); await settle();
  const replace = byRole('button', 'Close Main and open Second').find(candidate => candidate.hasAttribute('data-armed') || candidate.closest('.hub-confirm') || true)!;
  expect(document.activeElement).toBe(document.querySelector('.hub-confirm'));
  expect(action()).toBe('Account Second open');
  await until(() => replace.hasAttribute('data-armed'));
  press('Enter'); await settle();
  expect(action()).toBe('Account Second replace');
  click(button('Open Hub')); await settle();
  await go('accounts');
  expect(option(/Main/u)!.getAttribute('aria-disabled')).toBe('true');
});

test('in-game settings stay in Hub and Show Launcher remains explicit', async () => {
  await mountFixture();
  await go('settings');
  // The Settings page keeps the section last opened (Maps, in the test before) across fixture mounts; a page load starts on Tools.
  const section = (name: string) => [...document.querySelectorAll<HTMLElement>('nav[aria-label="Settings sections"] button')].find(candidate => candidate.textContent?.trim() === name)!;
  click(section('Tools')); await settle();
  const whispers = () => byRole('checkbox', 'Whispers', true)[0] as HTMLInputElement;
  click(whispers()); await settle();
  expect(document.querySelector('nav[aria-label="Settings sections"]')).not.toBeNull();
  expect(whispers().checked).toBe(false);
  click(button('Back')); await settle();
  // The Whispers tool leaves the Hub; its Tools setting stays findable so it can be turned back on.
  fill(search(), 'whispers'); await settle();
  expect(document.querySelectorAll('.hub-row[data-id="whispers"]').length).toBe(0);
  expect(document.querySelectorAll('.hub-row[data-id="setting:tool:whispers"]').length).toBe(1);
  await go('settings');
  click(section('Tools')); await settle();
  click(whispers()); await settle();
  expect(whispers().checked).toBe(true);
  click(button('Appearance')); await settle();
  const style = () => byRole('combobox', 'Panel style')[0] as HTMLSelectElement;
  choose(style(), 'obsidian'); await settle();
  expect(style().value).toBe('obsidian');
  click(button('Back')); await settle();
  await go('show launcher');
  expect(action()).toBe('Launcher');
});

test('floating chat keeps its draft and appearance when reopened', async () => {
  await mountFixture();
  await go('whisper Foo');
  expect(document.activeElement).toBe(draft('Foo'));
  fill(draft('Foo')!, 'Keep my draft');
  press('Home'); press('ArrowLeft'); await settle();
  expect(shown(draft('Foo')!)).toBe(true); expect(draft('Foo')!.value).toBe('Keep my draft');
  expect(hubOpen()).toBe(false);
  expect(document.querySelectorAll('.whisper-popout-host').length).toBe(1);
  click(byRole('button', 'Chat options', true)[0]!); await settle();
  fill(byRole('slider', 'Background')[0] as HTMLInputElement, '60'); await settle();
  click(button('Hide Whispers')); await settle();
  press('Meta+d'); await settle();
  expect(hubOpen()).toBe(false);
  expect(draft('Foo')!.value).toBe('Keep my draft');
  expect(action()).not.toBe('Whisper');
});

test('floating icon and shortcut toggle the same chat window', async () => {
  await mountFixture();
  await go('whisper Romi');
  expect(hubOpen()).toBe(false);
  const icon = () => [...document.querySelectorAll<HTMLElement>('button')].find(candidate => /^Whispers, \d+ unread/u.test(candidate.getAttribute('aria-label') ?? ''))!;
  const panel = () => document.getElementById('whisper-window')!;
  expect(shown(panel())).toBe(true);
  click(icon()); await settle(); expect(shown(panel())).toBe(false);
  click(icon()); await settle(); expect(shown(panel())).toBe(true);
  expect(hubOpen()).toBe(false);
  click(button('Hide Whispers')); await settle();
  press('Meta+d'); await settle();
  expect(hubOpen()).toBe(false);
  click(icon()); await settle(); expect(shown(panel())).toBe(false);
  click(icon()); await settle(); expect(shown(panel())).toBe(true);
});

test('switch search prioritizes characters and Back restores the selected account', async () => {
  await mountFixture();
  fill(search(), 'switch'); await settle();
  expect(text('.hub-row')).toContain('Switch Character');
  await go('switch account');
  await go('Second');
  click(button('Back')); await settle();
  expect(caption()).toBe('Accounts');
  expect(search().value).toBe('Second');
  expect(selectedRow()!.textContent).toContain('Second');
  click(button('Back')); await settle();
  expect(search().value).toBe('switch account');
});

test('price updates preserve focus on the price basis', async () => {
  await mountFixture();
  fill(search(), '1zkey in a'); await settle();
  byRole('combobox', 'Price basis')[0]!.focus();
  send('hub-fixture-incoming'); await settle();
  expect(document.activeElement).toBe(byRole('combobox', 'Price basis')[0]);
});

test('command examples respect tool availability', async () => {
  await mountFixture();
  send('hub-fixture-settings', { whispersEnabled: false }); await settle();
  try {
    await go('commands');
    expect(text('.hub-results')).toContain('build <name or profession>');
    expect(text('.hub-results')).not.toContain('whisper <name>');
    await go('1p in g');
    expect(search().value).toBe('1p in g');
  } finally { restoreTools(); }
});

test('Trade opens a floating addressed composer and retains its offer and filter', async () => {
  await mountFixture();
  await go('trade arms');
  const contact = () => byRole('button', 'Whisper Tyria')[0]!;
  expect(contact()).toBeDefined();
  const first = contact();
  click(first); await settle();
  expect(document.activeElement).toBe(draft('Tyria Cartographer'));
  expect(action()).not.toBe('Whisper');
  click(button('Hide Whispers')); await settle();
  expect(hubOpen()).toBe(false);
  expect(document.querySelector<HTMLInputElement>('.trade-search input[type=search]')!.value).toBe('arms');
  expect(first.isConnected).toBe(true);
});

test('character hint follows custom and cleared bindings', async () => {
  await mountFixture();
  send('hub-fixture-settings', { shortcutOverrides: { 'character.switch': { key: 'j', shift: false, option: false } } });
  fill(search(), 'switch character'); await settle();
  expect(text('.hub-row')).toContain('⌘J');
  send('hub-fixture-settings', { shortcutOverrides: { 'character.switch': null } }); await settle();
  expect(text('.hub-row')).not.toContain('⌘');
});

test('Hub text arrows cannot execute an action or clear a query', async () => {
  await mountFixture();
  fill(search(), 'kamadan'); await settle();
  press('ArrowRight'); await settle();
  expect(hubOpen()).toBe(true);
  expect(action()).not.toMatch(/travel/iu);
  press('Home'); press('ArrowLeft');
  expect(search().value).toBe('kamadan');
});
