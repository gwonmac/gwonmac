/** Search and shortcut refusal tests for the Core palette. */
import { currentTravelFriend, type TravelFriend, type TravelFriends } from '../../app/shared/friends.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHubCalculation, matchHubRows, parseHubQuery, rankHubRows, type HubRow } from '../../app/shared/hub.js';
import { resolveShortcuts, hubShortcutAvailable } from '../../app/shared/keyboard-shortcuts.js';
const row = (id: string, title: string, keywords = ''): HubRow => ({ id, title, keywords, group: 'Commands', detail: '', action: 'Open', run() {} });
test('search ranks exact names and prefixes before keywords without executing anything', () => {
  const rows = [row('alias', 'Travel', 'Romi'), row('prefix', 'Romi Ranger'), row('exact', 'Romi')];
  assert.deepEqual(matchHubRows(rows, 'romi').map(row => row.id), ['exact', 'prefix', 'alias']);
  assert.deepEqual(matchHubRows(rows, 'RANGER romi').map(row => row.id), ['prefix']);
  assert.equal(matchHubRows(rows, 'unknown').length, 0);
});
test('search ranks a name that starts with the query first; ordered search keeps source order within a tier', () => {
  const rows = [row('third', 'Zed Mesmer'), row('first', 'Ada Monk'), row('exact', 'Mo')];
  assert.deepEqual(matchHubRows(rows, 'm').map(row => row.id), ['exact', 'first', 'third']);
  assert.deepEqual(matchHubRows(rows, 'm', true).map(row => row.id), ['exact', 'third', 'first']);
  assert.deepEqual(matchHubRows(rows, 'mo', true).map(row => row.id), ['exact', 'first']);
});
test('Hub and Switch Character defaults preserve custom and cleared overrides', () => {
  assert.equal(hubShortcutAvailable({}), true);
  assert.equal(hubShortcutAvailable({ 'travel.open': { key: 'r', shift: false, option: false } }), false);
  const resolved = resolveShortcuts({ 'game.resign': { key: 'r', shift: true, option: false } });
  assert.equal(resolved['character.switch']?.key, 'e');
  assert.equal(resolved['game.resign']?.key, 'r');
  assert.equal(resolveShortcuts({ 'character.switch': null })['character.switch'], null);
  assert.equal(resolveShortcuts({})['game.resign'], null);
});

test('friend travel refuses stale generations, new characters, moved and offline friends', () => {
  const selected: TravelFriend = { key: 'friend', alias: 'Friend', character: 'Friend Ranger', mapId: 449, status: 'online' };
  const feed: TravelFriends = { status: 'ready', generation: 1, sequence: 1, friends: [selected] };
  assert.equal(currentTravelFriend(feed, selected, 1), selected);
  assert.equal(currentTravelFriend(feed, selected, 2), null);
  assert.equal(currentTravelFriend({ status: 'waiting', reason: 'unavailable' }, selected, 1), null);
  for (const changed of [{ ...selected, mapId: 55 }, { ...selected, character: 'Friend Monk' }, { ...selected, status: 'offline' as const }]) {
    assert.equal(currentTravelFriend({ ...feed, friends: [changed] }, selected, 1), null);
  }
});

test('Hub preserves diacritics, refuses typos and does not match inside words', () => {
  const rows = [row('one', 'Smiter'), row('two', 'Rómi')];
  assert.equal(matchHubRows(rows, 'smtier').length, 0);
  assert.equal(matchHubRows(rows, 'miter').length, 0);
  assert.equal(matchHubRows(rows, 'romi').length, 0);
  assert.equal(matchHubRows(rows, 'SMI').length, 1);
});

test('explicit scopes never reinterpret the remaining words as another action', () => {
  assert.deepEqual(parseHubQuery(' TEAM  gom AFK '), { scope: 'team', term: 'gom afk', text: 'gom AFK' });
  assert.deepEqual(parseHubQuery('build smiter'), { scope: 'build', term: 'smiter', text: 'smiter' });
  assert.deepEqual(parseHubQuery('team'), { scope: null, term: 'team', text: 'team' });
  assert.deepEqual(parseHubQuery(' team'), { scope: null, term: 'team', text: 'team' }, 'a lone word is still a search');
  assert.deepEqual(parseHubQuery('Invite '), { scope: 'invite', term: '', text: '' }, 'a scope word and a space enter the scope');
  assert.deepEqual(parseHubQuery('invites '), { scope: null, term: 'invites', text: 'invites' });
  assert.deepEqual(parseHubQuery('gmo afk'), { scope: null, term: 'gmo afk', text: 'gmo afk' });
  assert.deepEqual(parseHubQuery('Whisper  Mo Kai'), { scope: 'whisper', term: 'mo kai', text: 'Mo Kai' }, 'names keep their capitalisation');
});

test('saved phrases reject duplicates and private references in global settings', async () => {
  const { isHubShortcuts } = await import('../../app/shared/hub-preferences.ts');
  const { parseRendererSettingsPatch } = await import('../../app/main/core/settings.ts');
  assert.equal(isHubShortcuts([{ id: 'travel', phrase: 'home', pinned: false }, { id: 'trade', phrase: 'HOME', pinned: false }]), false);
  assert.throws(() => parseRendererSettingsPatch({ hubShortcuts: [{ id: 'build:private', phrase: 'my build', pinned: true }] }), /Invalid Hub/);
});

test('scope aliases preserve their canonical scope and typed argument (HUB-142)', () => {
  for (const [alias, scope] of [['tp', 'travel'], ['builds', 'build'], ['teams', 'team'], ['character', 'char'], ['account', 'acc']]) {
    assert.deepEqual(parseHubQuery(`${alias} Toefte`), { scope, term: 'toefte', text: 'Toefte' });
    assert.deepEqual(parseHubQuery(`${alias} `), { scope, term: '', text: '' });
  }
});

test('search folds typographic punctuation and matches parenthesised name words (HUB-143)', () => {
  const rows = [row('place', "Lion's Arch"), row('pre', 'Ascalon City (pre-Searing)')];
  for (const [query, expected] of [['lion’s arch', ['place']], ['pre–searing', ['pre']], ['pre-searing', ['pre']]] as const) {
    assert.deepEqual(matchHubRows(rows, query).map(row => row.id), expected);
  }
});

test('root search orders groups by their best answer, tools before places, and keeps a scoped page in source order (HUB-058, HUB-185)', () => {
  const grouped = (id: string, title: string, group: string): HubRow => ({ ...row(id, title), group });
  const maps = grouped('maps', 'Maps', 'Tools'), travel = grouped('travel', 'Travel', 'Tools'), place = grouped('place:1', 'Maguuma Stade', 'Places');
  const settings = grouped('settings', 'Settings', 'Commands'), commands = grouped('commands', 'Commands', 'Commands'), card = grouped('card', '1p in g', 'Calculator');
  const none = { phrases: new Set<string>(), answers: () => false };
  const cases: [string, readonly HubRow[], string, Parameters<typeof rankHubRows>[2], readonly string[]][] = [
    ['a typed tool answers before places', [place, maps], 'ma', { scoped: false, ...none }, ['maps', 'place:1']],
    ['a saved phrase is the best answer', [maps, place], 'ma', { scoped: false, phrases: new Set(['place:1']), answers: () => false }, ['place:1', 'maps']],
    ['a card answers its own grammar first', [settings, card], 'set', { scoped: false, phrases: new Set(), answers: candidate => candidate.id === 'card' }, ['card', 'settings']],
    ['Home orders groups, then everyday tools, with Commands first', [settings, maps, commands, place, travel], '', { scoped: false, ...none }, ['place:1', 'travel', 'maps', 'commands', 'settings']],
    ['a scoped page keeps its source order within a group', [maps, travel], '', { scoped: true, ...none }, ['maps', 'travel']],
  ];
  for (const [name, rows, query, options, expected] of cases) assert.deepEqual(rankHubRows(rows, query, options).map(entry => entry.id), expected, name);
});
test('a search that starts with a number is a calculation, so it draws currency art', () => {
  const cases: readonly [string, boolean][] = [['1p in g', true], [' .5e', true], ['3', true], ['set', false], ['p1', false], ['trade 1p', false], ['.e', false]];
  assert.deepEqual(cases.map(([query]) => [query, isHubCalculation(query)]), cases);
});
