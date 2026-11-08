/**
 * Hub search answers with its best row: exact names and aliases first, then names that start
 * with the query, then words, then keywords; sections follow their best row (HUB-008, HUB-058).
 * The selected row is what Enter runs, so the footer primary is the answer under test. Runs the
 * real Hub on the fixture page; it also holds the Commands page, the scope chips and the
 * settings rows' targets that the old browser spec checked next to the ranking.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { click, fill, loadFixture, mountFixture, press, settle, shown, unmountFixture } from './hub-fixture-harness';

beforeAll(loadFixture);
// Storage's `clear` is an own, spied property after `mountWith`; later mounts must clear plainly again.
const clearStorage = localStorage.clear.bind(localStorage);
afterEach(() => { if (vi.isMockFunction(localStorage.clear)) vi.mocked(localStorage.clear).mockImplementation(clearStorage); unmountFixture(); });

const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const search = () => q<HTMLInputElement>('.hub-search input')!;
const primary = () => q<HTMLButtonElement>('#hub .hub-primary')!;
const caption = () => q('.hub-caption')?.textContent;
const selectedId = () => q('.hub-row[aria-selected=true]')?.getAttribute('data-id');
const action = () => document.getElementById('app')!.dataset.action;
const row = (id: string) => q(`.hub-row[data-id="${id}"]`);
const titles = () => all('.hub-title').map(element => element.textContent);
const back = () => click(q('.hub-back, button[aria-label="Back"]') ?? [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Back')!);
async function ask(query: string) { fill(search(), query); await settle(); }
/**
 * `localStorage.setItem` before the page loads, as the spec's `addInitScript`: the harness clears
 * storage at the start of a mount, so the seed goes in right after that clear.
 */
async function mountWith(query: string, seed: Record<string, unknown>) {
  vi.spyOn(localStorage, 'clear').mockImplementation(() => { clearStorage(); for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value)); });
  return mountFixture(query);
}
const shortcuts = (items: readonly { id: string; phrase: string; pinned: boolean }[]) => ({ 'hub-fixture-shortcuts': items });
const settings = (detail: object) => window.dispatchEvent(new CustomEvent('hub-fixture-settings', { detail }));

const answers: [query: string, primary: RegExp, finding: string][] = [
  ['trade chat', /^Open Trade Chat/u, 'HUB-008: a tool’s own name wins'],
  ['toa', /^Travel to Temple of the Ages/u, 'HUB-010: a catalogue alias is a name'],
  ['gtob', /^Travel to Great Temple of Balthazar/u, 'HUB-010: a catalogue alias is a name'],
  ['gh', /^Travel to Guild Hall/u, 'HUB-010: Guild Hall is a place'],
  ['Seeker’s Passage', /^Travel to Seeker's Passage/u, 'HUB-143: typographic apostrophes fold'],
  ['tp kamadan', /^Travel to Kamadan/u, 'HUB-142: scope aliases'],
  ['ma', /^Adjust maps/u, 'HUB-058: a tool named by the query leads places that start the same'],
  ['tra', /^Browse travel/u, 'HUB-058: a name that starts with the query beats a later word'],
  ['ascalon city', /^Travel to Ascalon City/u, 'HUB-056: the available exact place, not the disabled pre-Searing one'],
  ['char f', /^Show Fixture Ranger in Characters/u, 'HUB-056: the eligible character'],
  ['trader prices', /^Open Trade Chat/u, 'HUB-224: trader finds Trade Chat'],
  ['rate', /^Choose rates/u, 'HUB-063: the rates editor by its word'],
  ['title', /^Open calculator/u, 'HUB-063: the title calculator by its word'],
  ['updates', /^Open in Launcher/u, 'HUB-064: a launcher-only section by its name'],
  ['theme', /^Open Appearance settings/u, 'HUB-064: a Settings section by its words'],
  ['10 ecto', /^Copy 60 platinum/u, 'HUB-102: a conversion without its target uses the labelled default, runs nothing'],
];

test('a typed search selects its best answer', async () => {
  await mountFixture();
  for (const [query, expected, finding] of answers) {
    await ask(query);
    expect(primary().textContent, finding).toMatch(expected);
    expect(primary().disabled, finding).toBe(false);
  }
  // `travel` is also a Tools setting; the command is the answer, not the setting row below it.
  for (const [query, id, label] of [['ascalon city', 'place:81', 'Travel to Ascalon City↵'], ['char f', 'character:ranger', 'Show Fixture Ranger in Characters↵'], ['travel', 'travel', 'Browse travel↵']] as const) {
    await ask(query);
    expect([selectedId(), primary().textContent], query).toEqual([id, label]);
  }
  for (const [query, title] of [['title', 'Title calculator'], ['calc', 'Title calculator'], ['party', 'Title calculator'], ['rate', 'Conversion rates'], ['currency', 'Conversion rates']] as const) {
    await ask(query);
    expect(titles().filter(text => text === title), query).toHaveLength(1);
  }
  expect(action()).toBeUndefined();
});

test('a character ranks ahead of a build that matches the same way', async () => {
  await mountFixture();
  await ask('fixture ritua');
  expect(selectedId()).toBe('character:ritualist');
});

test('a setting row opens Hub Settings at its control; launcher settings, Keys rows and the Settings command each open their own page (HUB-064)', async () => {
  await mountFixture();
  // An in-Hub setting found by its words opens the Settings page at that control, focused.
  await ask('elite skill');
  expect(primary().textContent).toMatch(/^Open setting/u);
  press('Enter'); await settle();
  expect(caption()).toBe('Settings');
  const control = () => q('[data-setting="eliteSkillsEnabled"]')!;
  expect(control().classList.contains('setting-focus')).toBe(true);
  expect(document.activeElement).toBe(control().querySelector('input'));
  expect(action()).toBeUndefined();
  // The Settings command opens the same page without a target, not the launcher.
  back(); await settle();
  await ask('settings');
  click(row('settings')!); await settle();
  expect(caption()).toBe('Settings');
  expect(shown(q('nav[aria-label="Settings sections"]')!)).toBe(true);
  // A Keys row names the tool's shortcut control, which is in the Hub's Tools section.
  back(); await settle();
  await ask('commands'); press('Enter'); await settle();
  click(row('key:travel')!); await settle();
  expect(q('[data-setting="tool:quick-travel"]')!.classList.contains('setting-focus')).toBe(true);
  expect(action()).toBeUndefined();
  // A launcher setting calls the launcher with its target and opens no Hub page.
  back(); await settle(); back(); await settle();
  await ask('automatic updates');
  expect(primary().textContent).toMatch(/^Open in Launcher/u);
  press('Enter'); await settle();
  expect(action()).toBe('Settings updates › autoCheckUpdates');
  expect(shown(document.getElementById('hub')!)).toBe(false);
});

test('travel <friend> offers the trip to that friend\'s outpost after the places (HUB-142)', async () => {
  await mountFixture('&party');
  await ask('travel zed alpha');
  expect(row('person:travel:alpha')!.textContent).toContain('Zed Alpha');
  click(row('person:travel:alpha')!); await settle();
  expect(primary().textContent).toMatch(/^Travel to Kamadan, Jewel of Istan/u);
  expect(action()).toBeUndefined();
});

test('places rank before the cap, and the rest are one row away in Travel (HUB-057)', async () => {
  await mountFixture();
  await ask('k');
  const options = all('#hub-results [role=option]');
  expect(options.some(option => /Kamadan, Jewel of Istan/u.test(option.textContent ?? ''))).toBe(true);
  const more = options.find(option => /^All \d+ places/u.test(option.textContent?.trim() ?? ''))!;
  expect(more).toBeTruthy();
  click(more); await settle();
  expect(caption()).toBe('Travel');
  expect(q<HTMLInputElement>('input[aria-label="Destination, phrase, or friend"]')!.value).toBe('k');
});

const pins = ['travel', 'settings', 'commands', 'hub-preferences', 'maps'];
test.each([2, 5])('pins on an empty Home keep a selection (%i pins)', async count => {
  await mountWith('', shortcuts(pins.slice(0, count).map(id => ({ id, phrase: '', pinned: true }))));
  await settle();
  const pinned = all('[role=group][aria-label="Pinned"] .hub-row, [role=group] .hub-row').filter(element => pins.includes(element.getAttribute('data-id') ?? ''));
  expect(pinned.length).toBeGreaterThanOrEqual(count);
  expect([selectedId(), primary().textContent]).toEqual(['travel', 'Browse travel↵']);
});

test.each([true, false])('a saved phrase wins over a name (build library %s)', async buildLibrary => {
  await mountWith('', shortcuts([{ id: 'place:194', phrase: 'ranger', pinned: false }, { id: 'settings', phrase: 'kam', pinned: false }]));
  settings({ buildLibrary });
  for (const [query, id, label] of [['ranger', 'place:194', 'Travel to Kaineng Center↵'], ['kam', 'settings', 'Open Settings↵'], ['eye of the north', 'place:642', 'Travel to Eye of the North↵']] as const) {
    await ask(query);
    expect([selectedId(), primary().textContent]).toEqual([id, label]);
  }
});

test('the first screen stays on the game: Launcher and the website wait for a typed search (HUB-185)', async () => {
  await mountFixture();
  expect(all('#hub [role="option"]').filter(option => option.textContent?.includes('Show Launcher'))).toHaveLength(0);
  // Commands, the way into everything else, leads its group.
  const group = all('#hub [role="group"]').find(element => /^Commands$/u.test(element.querySelector('.hub-group')?.textContent ?? ''))!;
  expect(group.querySelector('.hub-row')!.getAttribute('data-id')).toBe('commands');
  await ask('show launcher');
  expect(primary().textContent).toMatch(/^Show Launcher/u);
});

test('a profession code is also the start of a word while typing (HUB-059, D-17)', async () => {
  await mountFixture('&library=20');
  const build = () => all('#hub-results [role=option]').filter(option => /Deep Healer 0008/u.test(option.textContent ?? ''));
  // `d` is the Dervish code; it no longer hides a Monk build with a word that starts with d.
  await ask('build healer d');
  expect(build()).toHaveLength(1);
  // A full profession name still filters by primary profession.
  await ask('build healer dervish');
  expect(build()).toHaveLength(0);
});

test('Commands is findable by ? and groups its fill-only examples by job (HUB-093, HUB-094)', async () => {
  await mountFixture();
  await ask('?');
  expect(primary().textContent).toMatch(/^Browse commands/u);
  press('Enter'); await settle();
  expect(caption()).toBe('Commands');
  expect(search().getAttribute('placeholder')).toBe('Search commands…');
  expect(search().getAttribute('aria-label') ?? search().labels?.[0]?.textContent).toBe('Search commands…');
  const groups = all('.hub-group').map(element => element.textContent);
  expect(groups.length).toBeGreaterThanOrEqual(6);
  expect(groups).toContain('Keys & shortcuts');
});

test('the Keys rows show their binding, or Not set once cleared', async () => {
  await mountFixture();
  for (const [name, id] of [['travel.open', 'travel'], ['character.switch', 'character'], ['tools.toggle', 'builds'], ['trade.toggle', 'trade'], ['whispers.toggle', 'whispers']]) {
    for (const binding of [{ key: 'y', shift: true, option: false }, null]) {
      settings({ shortcutOverrides: { [name!]: binding } });
      press('Meta+r'); await ask('?'); press('Enter'); await settle();
      const keys = row(`key:${id}`)!;
      expect(shown(keys), name).toBe(true);
      expect([...keys.querySelectorAll('kbd')].map(element => element.textContent), name).toEqual(binding ? ['⇧', '⌘', 'Y'] : []);
      if (!binding) expect(keys.querySelector('.hub-detail')!.textContent, name).toBe('Not set');
    }
  }
});

const examples = [
  ['travel <place>', 'travel ', [7, 7]], ['char <name>', 'char ', [5, 5]],
  ['build <name or profession>', 'build ', [6, 6]], ['team <name>', 'team ', [5, 5]],
  ['build folder:<folder> <name>', 'build folder:', [6, 13]], ['build Mo/Me', 'build Mo/Me', [6, 11]],
  ['whisper <name>', 'whisper ', [8, 8]], ['invite <name>', 'invite ', [7, 7]],
  ['trade <item>', 'trade ', [6, 6]], ['acc <name>', 'acc ', [4, 4]],
  ['1p in g', '1p in g', [0, 7]], ['10e in p', '10e in p', [0, 8]],
  ['2 * 250 + 75', '2 * 250 + 75', [0, 12]], ['titles', 'titles', [0, 6]],
] as const;
test('Commands lists exactly its fill-only examples, and each fills the search with its argument selected and runs nothing', async () => {
  await mountFixture();
  await ask('?'); press('Enter'); await settle();
  expect(all('.hub-row[data-id^="example:"] .hub-title').map(element => element.textContent).sort()).toEqual(examples.map(([title]) => title).sort());
  for (const [title, value, selection] of examples) {
    click(all('.hub-row').find(element => element.querySelector('.hub-title')?.textContent === title)!); await settle();
    expect([search().value, search().selectionStart, search().selectionEnd, action()], title).toEqual([value, selection[0], selection[1], undefined]);
    await ask('?'); press('Enter'); await settle();
  }
});

test('an exact tool title has no scope chip and scoped Trade names the query (HUB-008)', async () => {
  await mountFixture();
  await ask('trade chat');
  expect(q('.hub-scope') === null || !shown(q('.hub-scope')!)).toBe(true);
  expect(primary().textContent).toMatch(/^Open Trade Chat/u);
  await ask('trade ecto');
  expect(q('.hub-scope')!.textContent).toBe('trade');
  expect(primary().textContent).toMatch(/^Search Trade for ecto/u);
});

test('a Commands footer names the example it fills (HUB-094)', async () => {
  await mountFixture();
  await ask('commands'); press('Enter'); await settle();
  expect(primary().textContent).toMatch(/^Fill search with char <name>/u);
});

const collisions = { version: 3, tags: [], teams: [], hubShortcuts: [], builds: ['Toa', 'Eye of the North farmer', 'Toefte'].map((name, index) => ({ id: `collision-${index}`, name, professions: ['Mo', null], skills: [null, null, null, null, null, null, null, null], attributes: {}, tags: [], favourite: false, parent: null, notes: '', lastUsed: null, origin: null })) };
async function mountCollisions() {
  await mountWith('', { 'hub-fixture-library': collisions });
  const source = window.gwCharacterSwitch!;
  if (source.characters.status !== 'ready') throw new Error('Expected fixture characters');
  Object.assign(source.characters, { characters: [...source.characters.characters, { ...source.characters.characters[1]!, name: 'Eye Of The Northern Star', characterKey: 'eye-prefix' }] });
}
test.each([true, false])('an exact place name beats a build and a character that only start with it (build library %s)', async library => {
  await mountCollisions();
  settings({ buildLibrary: library });
  await ask('eye of the north');
  expect(all('#hub-results [role=option]').filter(option => /^Eye of the North farmer/u.test(option.textContent?.trim() ?? ''))).toHaveLength(library ? 1 : 0);
  expect(titles().filter(text => text === 'Eye Of The Northern Star')).toHaveLength(1);
  expect([selectedId(), primary().textContent]).toEqual(['place:642', 'Travel to Eye of the North↵']);
});
test.each(['toa', 'toefte'])('an exact catalogue alias and an exact build name (%s) require a choice', async query => {
  await mountCollisions();
  await ask(query);
  expect(all('.hub-row')).toHaveLength(2);
  expect([document.querySelectorAll('.hub-row[aria-selected=true]').length, primary().disabled]).toEqual([0, true]);
  press('Enter'); await settle();
  expect([caption(), action()]).toEqual(['Home', undefined]);
});

test.each([['team ', 'team', ['Balanced vanquish', 'Classic Discordway', 'GOM AFK', 'Story and missions']], ['invite ', 'invite', ['Romi']]] as const)(
  'a bare "%s" scope explains its list (HUB-141)', async (query, chip, expected) => {
    await mountFixture();
    await ask(query);
    expect(q('.hub-scope')!.textContent).toBe(chip);
    expect(all('#hub-results .hub-title').map(element => element.textContent)).toEqual(expected);
  });
