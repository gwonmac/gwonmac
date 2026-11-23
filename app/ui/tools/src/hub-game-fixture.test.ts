/** The browser party fixture must satisfy the real planner before it can prove UI flows. */
import { flushPromises } from '@vue/test-utils';
import { createApp, h, nextTick } from 'vue';
import { expect, test } from 'vitest';
import { createHubGameFixture } from './hub-game-fixture';
import { createHubLibrary } from '../../../features/build-library/ui/hub-library';
import { useLibrary, type LibraryController } from './use-library';
import { HUB_PAGES } from './hub/views';
import { buildId, mapTeamSlots, teamId, type Build, type Team } from '../../../shared/builds/library';
import { encodeSkillTemplate } from '../../../shared/builds/skill-template';
import { resolveTeamApplyPlan } from '../../../shared/builds/team-apply';
import { validateBuildFor } from '../../../shared/builds/validate';
import type { HubRow, HubSource, HubSummary, HubTask, HubViewAction, HubViewMount } from '../../../shared/hub';

/** A task on a page that still shows. */
const task: HubTask = { live: () => true, progress() {}, done() {} };
const receiptTask = (receipts: string[]): HubTask => ({ live: () => true, progress() {}, done: receipt => { if (receipt) receipts.push(receipt); } });

type LibraryHost = Parameters<typeof useLibrary>[0];
type Mounted = {
  source: HubSource;
  controller: LibraryController;
  /** The rows and summary of the page the Hub last showed. */
  rows: () => readonly HubRow[];
  summary?: HubSummary | undefined;
  /** The mount of the last review view, and the titles of every view shown. */
  review: HubViewMount<HTMLElement>;
  views: string[];
  unmount(): void;
};

/**
 * Mounts the Build Library as the Hub does: a controller on `controllerHost` feeding `createHubLibrary`
 * over `hub` (the same host unless a test replaces one side). `ticks` is how many ticks the load gets;
 * a test that holds the library back passes 1.
 */
async function mountLibrary(controllerHost: LibraryHost, { hub = controllerHost, select, ticks = 2, visible = false }: {
  hub?: Parameters<typeof createHubLibrary>[1]; select?: (item: Build | Team) => void; ticks?: number; visible?: boolean;
} = {}) {
  const mounted = { views: [] } as unknown as Mounted;
  let dispose = () => {};
  const app = createApp({ setup() {
    mounted.controller = useLibrary(controllerHost);
    dispose = createHubLibrary(mounted.controller, hub, {
      attach(next) { mounted.source = next; return () => {}; }, close() {}, notify() {},
      showRows(_title, rows, summary) { mounted.rows = rows; mounted.summary = summary; },
      showView(title, mount) { mounted.views.push(title); mounted.review = mount; },
    }, select).dispose;
    return () => h('div');
  } });
  app.mount(document.createElement('div'));
  for (let tick = 0; tick < ticks; tick++) await nextTick();
  if (visible) { mounted.source.setVisible(true); await nextTick(); await nextTick(); }
  mounted.unmount = () => { dispose(); app.unmount(); };
  return mounted;
}

test('Hub rereads a native template before applying and refuses a replaced file', async () => {
  const { host } = createHubGameFixture(() => {});
  const { library } = await host.loadLibrary();
  const monk = library.builds.find(build => build.professions[0] === 'Mo')!;
  let contents = encodeSkillTemplate(monk)!;
  let calls = 0;
  const view = await mountLibrary(host, { visible: true, hub: { ...host,
    async loadTemplates() { return [{ path: 'Skills/Monk/Native.txt', contents }]; },
    async applyBuild() { calls++; return { commandId: 1, completedChanges: 1, skippedSkills: [] }; },
  } });
  await view.source.search('build native')[0]!.run(task);
  const apply = view.rows().find(row => row.title === 'Apply to me')!;
  contents = encodeSkillTemplate({ ...monk, attributes: {} })!;
  await expect(apply.run(task)).rejects.toThrow('saved configuration changed');
  expect(calls).toBe(0);
  view.unmount();
});

test('the flagship team passes canonical validation, also through the mounted controller', async () => {
  const { host } = createHubGameFixture(() => {});
  const { library } = await host.loadLibrary();
  const result = resolveTeamApplyPlan(library.teams[0]!, library, (build, context) => {
    const checked = validateBuildFor(build, id => id !== null && host.skills.has(id) ? host.skills.get(id) : null, context);
    expect(checked).toEqual({ valid: true });
    return checked;
  });
  expect(result.valid).toBe(true);
  const { controller, unmount } = await mountLibrary(host);
  const mounted = controller.library.value!;
  expect(resolveTeamApplyPlan(mounted.teams[0]!, mounted, controller.validate)).toMatchObject({ valid: true });
  unmount();
});

test('Hub exposes a ready exact team from the shared controller', async () => {
  const { host } = createHubGameFixture(() => {});
  const { source, unmount } = await mountLibrary(host);
  expect(source.search('team gom afk')[0]?.unavailable).toBeUndefined();
  for (const query of ['build', 'builds', 'library', 'lib', 'bu', 'skills', 'build library']) {
    const rows = source.search(query);
    expect(rows.filter(row => row.id === 'builds'), query).toHaveLength(1);
    expect(rows.find(row => row.id === 'builds')?.detail).toBe('Browse saved builds and teams');
    expect(rows.find(row => row.id === 'builds')?.unavailable).toBeUndefined();
  }
  unmount();
});

test('profession search includes every saved primary-profession build without a result cap', async () => {
  const { host } = createHubGameFixture(() => {});
  const { library } = await host.loadLibrary();
  const monk = library.builds.find(build => build.professions[0] === 'Mo')!;
  const builds = Array.from({ length: 15 }, (_, index) => ({ ...monk, id: buildId(`monk-${index}`), name: `Support ${index}` }));
  const { source, unmount } = await mountLibrary({ ...host, async loadLibrary() { return { library: { ...library, builds }, recovered: false }; } });
  expect(source.search('build monk')).toHaveLength(15);
  expect(source.search('build mo')).toHaveLength(15);
  expect(source.search('build mesmer')).toHaveLength(0);
  expect(source.search('build monk support')).toHaveLength(15);
  expect(source.search('build monk')[0]).toMatchObject({ action: 'Choose target', skills: expect.arrayContaining([expect.objectContaining({ name: 'Word of Healing' })]) });
  unmount();
});

test('Hub current-build comparison follows observations and never substitutes the incoming bar', async () => {
  const { host } = createHubGameFixture(() => {});
  const view = await mountLibrary(host);
  await view.source.search('build smiter')[0]!.run(task);
  const incoming = view.summary!.skills;
  expect(view.rows()[0]!.skills).not.toEqual(incoming);
  host.party.value = { ...host.party.value, player: { ...host.party.value.player!, skills: null, attributes: null } };
  expect(view.rows()[0]!.skills).toBeUndefined();
  expect(view.rows()[0]!.detail).toContain('Current build not available');
  expect(view.summary!.skills).toEqual(incoming);
  host.party.value = { ...host.party.value, status: 'unavailable' };
  expect(view.rows()[0]!.skills).toBeUndefined();
  view.unmount();
});

test('build folder search handles paths, words, quotes, prefixes and ambiguous names without applying', async () => {
  const { host } = createHubGameFixture(() => { throw new Error('Search must not apply'); });
  const { library } = await host.loadLibrary();
  const monk = library.builds.find(build => build.professions[0] === 'Mo')!;
  const mesmer = library.builds.find(build => build.professions[0] === 'Me')!;
  const entries = [
    ['Skills/Team Builds/Farming/Protection.txt', monk],
    ['Skills/Team Builds/Dungeons/Protection.txt', monk],
    ['Skills/Other/Farming/Protection.txt', monk],
    ['Skills/Monk/Panic.txt', mesmer],
    ['Skills/Root.txt', monk],
    ['Skills/Mo/Me/Panic.txt', mesmer],
    ['Skills/Moon pressure.txt', mesmer],
    ['Skills/Prefixes/Air Protection Moon.txt', monk],
    ['Skills/Prefixes/Deep Healer.txt', monk],
  ] as const;
  const { source, unmount } = await mountLibrary({ ...host, async loadTemplates() { return entries.map(([path, build]) => ({ path, contents: encodeSkillTemplate(build)! })); } }, { visible: true });
  const folders = (query: string) => source.search(query).map(row => row.folder);
  for (const query of ['build team builds farming monk', 'build "Team Builds" farming mo', 'build "Team Builds/Farming" monk', 'build folder:"team builds/farm" protection', 'build "TEAM BUILDS/Farming/" Mo/Me', 'build "Team Builds\\Farming" monk', 'build folder:"team builds/farming']) {
    expect(folders(query), query).toEqual(['Team Builds/Farming']);
  }
  expect(folders('build folder:"team builds" monk')).toEqual(['Team Builds/Dungeons', 'Team Builds/Farming']);
  expect(folders('build farming monk')).toEqual(['Other/Farming', 'Team Builds/Farming']);
  for (const query of ['build other/farming monk', 'build other farming monk', 'build monk farming other', 'build folder:/other/farm monk']) expect(folders(query), query).toEqual(['Other/Farming']);
  expect(folders('build "Monk" panic')).toEqual(['Monk']);
  expect(folders('build folder:monk')).toEqual(['Monk']);
  expect(folders('build folder:monk mesmer')).toEqual(['Monk']);
  expect(folders('build folder:monk monk')).toEqual([]);
  expect(folders('build Mo/Me')).not.toContain('Mo/Me');
  expect(folders('build folder:Mo/Me')).toEqual(['Mo/Me']);
  expect(folders('build Mo/Me mesmer')).toEqual([]);
  expect(folders('build folder:/ monk')).toEqual(['']);
  for (const query of ['build missing monk', 'build farming/team monk', 'build folder:protection', 'build folder:template-code', 'build folder:', 'build travel monk']) expect(folders(query), query).toEqual([]);
  expect(source.search('build folder:"Team Builds/Farming" monk')[0]).toMatchObject({ title: 'Protection', folder: 'Team Builds/Farming', action: 'Choose target' });
  // HUB-059: short codes remain additive, with actual profession matches before name prefixes.
  for (const name of ['Air Protection Moon', 'Deep Healer', 'Moon pressure']) {
    for (const word of name.split(' ')) for (let length = 1; length <= word.length; length++) {
      const query = `build ${word.slice(0, length).toLowerCase()}`;
      expect(source.search(query).map(row => row.title), query).toContain(name);
    }
  }
  const professionRows = source.search('build mo');
  expect(professionRows.map(row => row.professions?.[0]?.code)).toEqual(['Mo', 'Mo', 'Mo', 'Mo', 'Mo', 'Mo', 'Mo', 'Mo', 'Mo', 'Me', 'Me', 'Me']);
  expect(professionRows.slice(-3).map(row => row.title)).toEqual(['Moon pressure', 'Panic', 'Panic']);
  expect(professionRows.map(row => row.title)).toContain('Moon pressure');
  unmount();
});

test('template source failures preserve valid results and retry distinguishes malformed files', async () => {
  const { host } = createHubGameFixture(() => {});
  const { library } = await host.loadLibrary();
  const template = encodeSkillTemplate(library.builds[0]!)!;
  let fail = false;
  const { source, unmount } = await mountLibrary({ ...host, async loadTemplates() {
    if (fail) throw new Error('Unavailable');
    return [{ path: 'Skills/Native.txt', contents: template }, { path: 'Skills/Broken.txt', contents: 'invalid' }];
  } }, { visible: true });
  expect(source.search('build native').some(row => row.title === 'Native')).toBe(true);
  expect(source.search('build native').some(row => row.title === '1 unreadable template')).toBe(true);
  fail = true; source.setVisible(false); source.setVisible(true); await nextTick(); await nextTick();
  const rows = source.search('build native');
  expect(rows.some(row => row.title === 'Native')).toBe(true);
  expect(rows.some(row => row.id === 'templates-retry')).toBe(true);
  fail = false; await rows.find(row => row.id === 'templates-retry')!.run(task);
  expect(source.search('build native').some(row => row.id === 'templates-retry')).toBe(false);
  unmount();
});

test('recent-use bookkeeping preserves the next meaningful Undo and bounds target references', async () => {
  const { host } = createHubGameFixture(() => {});
  const { controller, unmount } = await mountLibrary(host);
  const build = controller.library.value!.builds[0]!;
  expect(controller.canUndo.value).toBe(false);
  await controller.recordBuildUse(build.id, null);
  expect(controller.canUndo.value).toBe(false);
  const heroes = host.party.value.heroes.slice(0, 3).map(member => member.hero);
  for (const hero of heroes) await controller.recordBuildUse(build.id, hero);
  expect(controller.recentBuilds.value).toEqual([...heroes].reverse().map(hero => ({ id: build.id, hero })));
  expect(controller.recentBuilds.value).toHaveLength(3);
  await controller.renameBuild(build.id, 'Renamed for test');
  await controller.recordBuildUse(build.id, null);
  await controller.undo();
  expect(controller.library.value!.builds.find(item => item.id === build.id)?.name).toBe(build.name);
  unmount();
});

test('a scale library grows to the requested size and never overwrites saved fixture data', async () => {
  localStorage.removeItem('hub-fixture-library');
  const { host, librarySize } = createHubGameFixture(() => {}, { librarySize: 1000 });
  const { library } = await host.loadLibrary();
  expect(librarySize).toBe(1000);
  expect(library.builds).toHaveLength(1000);
  expect(new Set(library.builds.map(build => build.id)).size).toBe(1000);
  expect(new Set(library.builds.map(build => build.name)).size).toBe(1000);
  expect(library.teams.length).toBeGreaterThanOrEqual(50);
  await host.saveLibrary(library);
  expect(localStorage.getItem('hub-fixture-library')).toBeNull();
});

test('the party is observed only in a loaded map, and an explorable area is no outpost', () => {
  const { host, setPlayRegion } = createHubGameFixture(() => {});
  const ready = { status: 'ready', sequence: 2, mapId: 58, instanceType: 1, playRegion: 'pve', travelContext: 'world',
    characterKey: null, unlockedMapWords: null, guildHall: false, hasGuildHall: false } as const;
  setPlayRegion(ready);
  expect([host.party.value.status, host.party.value.inOutpost, host.party.value.playRegion]).toEqual(['ready', false, 'pve']);
  setPlayRegion({ ...ready, mapId: 188, instanceType: 0, playRegion: 'pvp' });
  expect([host.party.value.status, host.party.value.inOutpost, host.party.value.playRegion]).toEqual(['ready', true, 'pvp']);
  setPlayRegion({ status: 'waiting', reason: 'loading' });
  expect([host.party.value.status, host.party.value.inOutpost, host.party.value.playRegion]).toEqual(['unavailable', null, 'unknown']);
});

test('a team apply names counted progress and closes only the page that started it (HUB-004, HUB-083)', async () => {
  localStorage.removeItem('hub-fixture-library');
  const commands: string[] = [];
  const { host } = createHubGameFixture(command => commands.push(command));
  const { source, unmount } = await mountLibrary(host);
  const row = source.search('team gom afk')[0]!;
  expect(row.pending).toEqual({ label: 'Applying GOM AFK…', again: 'GOM AFK is still being applied.' });
  const progress: string[] = [];
  const receipts: string[] = [];
  await row.run({ ...receiptTask(receipts), progress: message => progress.push(message) });
  expect(progress[0]).toBe('Applying GOM AFK…');
  expect(progress).toContain('Applying GOM AFK… 1/16');
  expect(progress.at(-1)).toBe('Applying GOM AFK… 16/16');
  expect(receipts).toEqual(['GOM AFK applied.']);
  expect(source.search('team gom afk')[0]!.preview).toContain('Already matches');
  const sent = commands.length;
  await source.search('team gom afk')[0]!.run(receiptTask(receipts));
  expect(commands).toHaveLength(sent);
  expect(receipts).toEqual(['GOM AFK applied.', 'GOM AFK already matches.']);
  unmount();
});

test('a team apply that fails after the player moved on names the team and keeps the outcome (HUB-016)', async () => {
  localStorage.removeItem('hub-fixture-library');
  const commands: string[] = [];
  const fixture = createHubGameFixture(command => commands.push(command));
  fixture.setScenario('partial');
  let refuse = false;
  const fixtureHost = { ...fixture.host, async applyTeam(...args: Parameters<typeof fixture.host.applyTeam>) {
    if (refuse) fixture.host.party.value = { ...fixture.host.party.value, inOutpost: false };
    return fixture.host.applyTeam(...args);
  } };
  const view = await mountLibrary(fixtureHost);
  const { source } = view;
  const done: string[] = [];
  await expect(source.search('team gom afk')[0]!.run({ ...receiptTask(done), live: () => false }))
    .rejects.toThrow('GOM AFK partly applied. Open Hub to review.');
  expect(done).toEqual([]);
  // The reopened Hub shows the outcome, and opening the review keeps it.
  expect(source.search('team gom afk')[0]!.detail).toBe('Partly applied · Review');
  expect(source.search('team gom afk')[0]!.action).toBe('Review GOM AFK');
  source.search('team gom afk')[0]!.run(task);
  const target = document.createElement('div');
  let primary: HubViewAction | null = null;
  view.review(target, () => {}, { primary(next) { primary = next; }, secondary() {}, openActions() {} }, HUB_PAGES);
  expect(target.querySelector('[role=status]')?.textContent).toMatch(/^Team partly applied\. Synthetic interruption/);
  expect(target.textContent).toContain('Completed');
  expect(target.textContent).toContain('Enabling Hard Mode confirmed.');
  expect(target.textContent).toContain('Remaining');
  expect(target.textContent).toContain('Update your build');
  expect(source.search('team gom afk')[0]!.detail).toBe('Partly applied · Review');
  // The player can finish the same configuration outside Hub before retrying.
  fixture.setScenario('standard');
  const loaded = await fixture.host.loadLibrary();
  const resolved = resolveTeamApplyPlan(loaded.library.teams[0]!, loaded.library, view.controller.validate);
  if (!resolved.valid) throw new Error('Expected valid saved fixture team');
  await fixture.host.applyTeam(resolved.plan);
  const sent = commands.length;
  await primary!.run(receiptTask(done));
  expect(done).toEqual(['GOM AFK already matches.']);
  expect(commands).toHaveLength(sent);
  expect(source.search('team gom afk')[0]!.detail).toBe('Saved team · Hard Mode · 7 heroes');
  fixture.host.party.value = { ...fixture.host.party.value, hardMode: false };
  const beforeRefusal = JSON.parse(JSON.stringify({ player: fixture.host.party.value.player, heroes: fixture.host.party.value.heroes, hardMode: fixture.host.party.value.hardMode }));
  const beforeCommands = commands.filter(command => command.startsWith('command:')).length;
  refuse = true;
  await expect(source.search('team gom afk')[0]!.run(task)).rejects.toThrow('team apply preflight refused');
  expect(commands.filter(command => command.startsWith('command:'))).toHaveLength(beforeCommands);
  expect({ player: fixture.host.party.value.player, heroes: fixture.host.party.value.heroes, hardMode: fixture.host.party.value.hardMode }).toEqual(beforeRefusal);
  expect(source.search('team gom afk')[0]!.detail).toBe('Not applied · Review');
  source.search('team gom')[0]!.navigate!(task);
  const refused = document.createElement('div');
  view.review(refused, () => {}, { primary() {}, secondary() {}, openActions() {} }, HUB_PAGES);
  expect(refused.textContent).not.toContain('partly');
  expect(refused.textContent).not.toContain('Completed');
  view.unmount();
});

test('Library browse includes saved teams and only an exact scoped team can apply', async () => {
  const { host } = createHubGameFixture(() => {});
  const view = await mountLibrary(host);
  const { source } = view;
  for (const query of ['library', 'lib', 'bu', 'team', 'teams', 'skills']) {
    const results = source.search(query);
    expect(results.some(row => row.unavailable === 'Build Library is loading.'), query).toBe(false);
    const row = results.find(row => row.id === 'builds')!;
    expect(row.detail, query).toBe('Browse saved builds and teams');
    expect(row.unavailable, query).toBeUndefined();
    await row.run(task);
    expect(view.rows().map(row => row.title), query).toContain('GOM AFK');
    expect(view.rows().some(row => row.unavailable === 'Build Library is loading.'), query).toBe(false);
  }
  source.lookup!('builds')!.run(task);
  expect(view.rows().filter(row => row.group === 'Teams').map(row => row.title)).toEqual(['GOM AFK', 'Balanced vanquish', 'Classic Discordway', 'Story and missions']);
  for (const query of ['team ', 'teams ', 'team gom']) {
    const rows = source.search(query);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.action.startsWith('Review ') && !row.consequential), query).toBe(true);
  }
  expect(source.search('team gom afk')[0]?.action).toBe('Apply team GOM AFK');
  view.unmount();
});

test('scoped teams show Loading until the library settles and publish their ready replacement', async () => {
  const { host } = createHubGameFixture(() => {});
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { source, unmount } = await mountLibrary({ ...host, loadLibrary: async () => { await gate; return host.loadLibrary(); } }, { hub: host, ticks: 1 });
  expect(source.search('team gom').map(row => [row.title, row.unavailable])).toEqual([['Loading teams…', 'Build Library is loading.']]);
  let latest: readonly HubRow[] = [];
  const stop = source.subscribe(() => { latest = source.search('team gom'); });
  release(); await flushPromises();
  expect(latest.map(row => row.title)).toEqual(['GOM AFK']);
  expect(latest[0]?.unavailable).toBeUndefined();
  stop(); unmount();
});

test('hero targets preserve observed party slots, name secondary changes and keep refusals inspectable', async () => {
  const { host } = createHubGameFixture(() => {});
  const view = await mountLibrary(host);
  view.source.search('build monk')[0]!.run(task);
  view.rows().find(row => row.id === 'choose-hero')!.run(task);
  const party = view.rows().filter(row => row.group === 'In your party');
  expect(party.map(row => row.title)).toEqual(['Livia', 'Master of Whispers', 'Norgu', 'Gwen', 'Tahlkora', 'Razah', 'Vekk']);
  expect(party.map(row => row.detail.split(' · ')[0])).toEqual(['Slot 2', 'Slot 3', 'Slot 4', 'Slot 5', 'Slot 6', 'Slot 7', 'Slot 8']);
  expect(party[0]?.detail).toContain('Secondary profession: None → Mesmer');
  const dunkoro = view.rows().find(row => row.title === 'Dunkoro')!;
  expect(dunkoro.detail).toBe('Add Dunkoro to your party first.');
  expect(dunkoro.readOnly).toBe(true);
  expect(dunkoro.action).toBe('Review availability');
  view.unmount();
});

test('single-build refusals name the build operation, locked skills and primary professions', async () => {
  const fixture = createHubGameFixture(() => {});
  const view = await mountLibrary(fixture.host);
  fixture.setPlayRegion({ status: 'ready', sequence: 1, mapId: 55, instanceType: 1, playRegion: 'pve', travelContext: 'world', characterKey: 'a', unlockedMapWords: null, guildHall: false, hasGuildHall: false });
  view.source.search('build smiter')[0]!.run(task);
  expect(view.rows()[0]?.unavailable).toBe('Enter an outpost to apply this build.');
  fixture.host.party.value = { ...fixture.host.party.value, inOutpost: true, characterSkills: { knownThrough: 1_000, unlocked: new Set() } };
  expect(view.rows()[0]?.unavailable).toContain('Word of Healing');
  expect(view.rows()[0]?.unavailable).not.toMatch(/skill 20[0-9]/u);
  const player = fixture.host.party.value.player;
  if (!player) throw new Error('Fixture player is missing');
  fixture.host.party.value = { ...fixture.host.party.value, characterSkills: null, player: { ...player, professions: ['Me', null] } };
  expect(view.rows()[0]?.unavailable).toBe('Your assigned build is for Monk, but the observed primary is Mesmer.');
  view.unmount();
});

test('team previews name removals, a roster rebuild and the mode change before Apply', async () => {
  const { host } = createHubGameFixture(() => {});
  const loaded = await host.loadLibrary();
  const original = loaded.library.teams[0]!;
  const trio = { ...original, id: teamId('trio'), name: 'GOM trio', slots: mapTeamSlots(original.slots, (slot, index) => index < 4 ? slot : { build: null, hero: null, behaviour: 'guard' }) };
  const keep = { ...trio, id: teamId('keep'), name: original.name, mode: 'none' as const };
  const duplicate = { ...trio, id: teamId('duplicate'), name: original.name, mode: 'normal' as const };
  const reordered = { ...original, id: teamId('reordered'), name: 'GOM reordered', slots: mapTeamSlots(original.slots, (slot, index) => index === 1 ? original.slots[2] : index === 2 ? original.slots[1] : slot) };
  const { source, unmount } = await mountLibrary({ ...host, loadLibrary: async () => ({ ...loaded, library: { ...loaded.library, teams: [trio, reordered, original, duplicate, keep] } }) }, { hub: host });
  expect(source.search('team gom trio')[0]?.preview).toContain('Remove Gwen, Tahlkora, Razah, Vekk');
  expect(source.search('team gom reordered')[0]?.preview).toContain('Rebuild hero order');
  expect(source.search('team gom reordered')[0]?.preview).toContain('Switch to Hard Mode');
  expect(source.search('team gom afk').map(row => row.detail).sort()).toEqual(['Saved team · Hard Mode · 7 heroes', 'Saved team · Keep difficulty · 3 heroes', 'Saved team · Normal Mode · 3 heroes']);
  unmount();
});

test('invalid team reviews name the failing slot and open the same saved team in its editor', async () => {
  const { host } = createHubGameFixture(() => {});
  const loaded = await host.loadLibrary();
  const original = loaded.library.teams.find(team => team.name === 'Balanced vanquish')!;
  const invalid = { ...original, slots: mapTeamSlots(original.slots, (slot, index) => index === 1 ? { ...slot, behaviour: null } : slot) };
  let selected: Build | Team | undefined;
  const view = await mountLibrary({ ...host, loadLibrary: async () => ({ ...loaded, library: { ...loaded.library, teams: [invalid] } }) }, { hub: host, select: item => { selected = item; } });
  const row = view.source.search('team balanced vanquish')[0]!;
  expect(row.unavailable).toBe('Choose a behavior for slot 2.\nSlot 8 has an invalid build.');
  row.navigate!(task);
  const target = document.createElement('div');
  let edit: HubViewAction | null = null;
  view.review(target, () => {}, { primary(action) { expect(action?.disabled).toBe(true); }, secondary(action) { edit = action; }, openActions() {} }, HUB_PAGES);
  expect(target.querySelector('[role=status]')?.textContent).toBe('Choose a behavior for slot 2.\nSlot 8 has an invalid build.');
  const members = target.querySelectorAll('.hub-review-roster > section');
  expect(members[1]?.textContent).toContain('Choose a behavior for slot 2.');
  expect(members[7]?.textContent).toContain('Slot 8 has an invalid build.');
  expect(edit).toMatchObject({ label: 'Open in Build Library' });
  if (!edit) throw new Error('Editor action missing');
  const action: HubViewAction = edit;
  await action.run(task);
  expect(selected).toEqual(invalid);
  view.unmount();
});

test('single-build receipts distinguish changes from reapplication and use the sentence target (HUB-183)', async () => {
  localStorage.removeItem('hub-fixture-library');
  const commands: string[] = [];
  const { host } = createHubGameFixture(command => commands.push(command));
  let failSave = false;
  const view = await mountLibrary({ ...host, async saveLibrary(value: Parameters<typeof host.saveLibrary>[0]) {
    if (failSave) throw new Error('Synthetic save refusal');
    return host.saveLibrary(value);
  } });
  const receipts: string[] = [];
  const apply = async () => {
    await view.source.search('build smiter')[0]!.run(task);
    expect(view.rows()[0]!.action).toBe('Apply Smiter to your character');
    await view.rows()[0]!.run(receiptTask(receipts));
  };
  try {
    await apply();
    expect(receipts).toEqual(['Smiter applied to your character.']);
    const changed = host.party.value.player;
    const sent = commands.length;
    await apply();
    expect(receipts).toEqual(['Smiter applied to your character.', 'Smiter already matches.']);
    expect(commands.slice(sent)).toEqual(['apply-build']);
    failSave = true;
    await apply();
    expect(receipts.at(-1)).toBe('Smiter already matches. Recent use could not be saved.');
    host.party.value = { ...host.party.value, player: { ...changed!, attributes: {} } };
    await apply();
    expect(receipts.at(-1)).toBe('Smiter applied to your character. Recent use could not be saved.');
  } finally { view.unmount(); }
});

test('bare team queries list every saved team for review and preserve loading rows (HUB-087)', async () => {
  const commands: string[] = [];
  const { host } = createHubGameFixture(command => commands.push(command));
  // More than eight teams catches accidental use of the unscoped result cap.
  const { library } = await host.loadLibrary();
  const teams = Array.from({ length: 10 }, (_, index) => ({ ...library.teams[0]!, id: teamId(`team-${index}`), name: `Saved team ${index}` }));
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const view = await mountLibrary({ ...host, loadLibrary: async () => { await gate; return { library: { ...library, teams }, recovered: false }; } }, { hub: host, ticks: 1 });
  const { source } = view;
  try {
    for (const query of ['team', 'teams']) {
      expect(source.search(query).map(row => [row.title, row.unavailable])).toEqual([['Loading teams…', 'Build Library is loading.']]);
    }
    release(); await flushPromises();
    for (const query of ['team', 'teams']) {
      const rows = source.search(query).filter(row => row.group === 'Teams');
      expect(source.search(query).find(row => row.id === 'builds')?.action).toBe('Browse builds');
      expect(rows.map(row => row.title)).toEqual(['Saved team 0', 'Saved team 1', 'Saved team 2', 'Saved team 3', 'Saved team 4', 'Saved team 5', 'Saved team 6', 'Saved team 7', 'Saved team 8', 'Saved team 9']);
      expect(rows.map(row => [row.id, row.action, row.consequential])).toEqual(source.search('team ').map(row => [row.id, row.action, row.consequential]));
      expect(rows.map(row => row.action)).toEqual(['Review Saved team 0', 'Review Saved team 1', 'Review Saved team 2', 'Review Saved team 3', 'Review Saved team 4', 'Review Saved team 5', 'Review Saved team 6', 'Review Saved team 7', 'Review Saved team 8', 'Review Saved team 9']);
      expect(rows.every(row => row.group === 'Teams' && !row.consequential)).toBe(true);
      for (const row of rows) await row.run(task);
    }
    expect(view.views).toHaveLength(20);
    expect(commands).toEqual([]);
  } finally { release(); view.unmount(); }
});
