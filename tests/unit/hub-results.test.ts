/**
 * What a Hub list shows and which row it selects, held by the pure functions in
 * app/renderer/hub-results.ts. Each case names the rule (and the Playwright spec in
 * app/ui/tools/tests) whose behaviour it ports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HubRow } from '../../app/shared/hub.js';
import type { HubShortcut } from '../../app/shared/hub-preferences.js';
import { chooseHubSelection, composeHubResults, type HubResultsInput, type HubSelectionInput } from '../../app/renderer/hub-results.js';

const row = (id: string, title: string, extra: Partial<HubRow> = {}): HubRow => ({ id, title, detail: '', group: 'Places', action: `Open ${title}`, run: () => {}, ...extra });
const accountsCard = { group: 'Accounts', restores: [], settles: ['accounts:loading'], is: (candidate: HubRow) => candidate.id.startsWith('account:') };

type Case = Readonly<{
  name: string;
  query: string;
  found?: readonly HubRow[];
  shortcuts?: readonly HubShortcut[];
  stored?: readonly HubRow[];
  commands?: readonly HubRow[];
  ids: readonly string[];
  selected: string | null;
  count: string;
}>;

const cases: readonly Case[] = [
  { name: 'HUB-008: a saved phrase wins over a name and answers with its stored row (hub-search.spec)', query: 'ranger',
    found: [row('character:ranger', 'Ranger', { group: 'Characters' })], shortcuts: [{ id: 'place:194', phrase: 'ranger', pinned: false }],
    stored: [row('place:194', 'Kaineng Center')], ids: ['place:194', 'character:ranger'], selected: 'place:194', count: '2 results' },
  { name: 'HUB-008: two rows with the typed name are a tie, so nothing is chosen', query: 'kamadan',
    found: [row('place:449', 'Kamadan'), row('build:kamadan', 'Kamadan', { group: 'Builds' })], ids: ['build:kamadan', 'place:449'], selected: null, count: '2 results' },
  { name: 'HUB-008: a setting named like a command yields to the command row', query: 'resign',
    found: [row('setting:resign', 'Resign', { group: 'Settings' })], commands: [row('resign', 'Resign…', { group: 'Commands' })],
    ids: ['resign'], selected: 'resign', count: '1 result' },
  { name: 'HUB-008: a scoped query that is a command’s whole name answers with it', query: 'trade chat',
    commands: [row('trade-chat', 'Trade Chat', { group: 'Tools' }), row('trade-quote', 'Trade quote', { group: 'Tools' })],
    ids: ['trade-chat'], selected: 'trade-chat', count: '1 result' },
  { name: 'HUB-056: a typed query starts on the first available answer, not a disabled one', query: 'char f',
    found: [row('character:mesmer', 'Char Fixture Mesmer', { unavailable: 'Not on this account.' }), row('character:ranger', 'Char Fixture Ranger')],
    ids: ['character:mesmer', 'character:ranger'], selected: 'character:ranger', count: '2 results' },
  { name: 'HUB-060: pins on an empty Home are no tie and keep a selection', query: '',
    shortcuts: ['travel', 'settings', 'maps'].map(id => ({ id, phrase: '', pinned: true })),
    stored: [row('travel', 'Travel', { group: 'Tools' }), row('settings', 'Settings', { group: 'Tools' }), row('maps', 'Maps', { group: 'Tools' })],
    ids: ['travel', 'settings', 'maps'], selected: 'travel', count: '' },
  { name: 'D-13: a fresh Home never starts on a row that leaves the explorable area', query: '',
    found: [row('place:1', 'Ascalon City', { leavesArea: true }), row('commands', 'Commands', { group: 'Tools' })],
    ids: ['place:1', 'commands'], selected: 'commands', count: '' },
  { name: 'a bare scope lists without a term, so Enter never acts on a consequential guess', query: 'travel ',
    found: [row('place:1', 'Ascalon City', { consequential: true }), row('place:all', 'All places', { group: 'Travel' })],
    ids: ['place:1', 'place:all'], selected: 'place:all', count: '2 results' },
  { name: 'a query that finds nothing says so', query: 'zzz', ids: [], selected: null, count: 'No matches' },
];

const results = (entry: Case, extra: Partial<HubResultsInput> = {}) => composeHubResults({
  scoped: false, query: entry.query, found: entry.found ?? [], shortcuts: entry.shortcuts ?? [], commands: entry.commands ?? [], cards: [],
  lookup: id => entry.stored?.find(candidate => candidate.id === id), ...extra,
});
const choose = (input: Partial<HubSelectionInput> & Pick<HubSelectionInput, 'rows'>) => chooseHubSelection({
  scoped: false, query: '', phrases: new Set(), previous: [], selected: null, reset: false, awaiting: false, cards: [], status: { text: '', receipt: false }, ...input,
});

for (const entry of cases) {
  test(entry.name, () => {
    const composed = results(entry);
    assert.deepEqual(composed.rows.map(candidate => candidate.id), entry.ids);
    assert.equal(composed.count, entry.count);
    const chosen = choose({ query: entry.query, rows: composed.rows, phrases: composed.phrases, reset: true });
    assert.deepEqual({ selected: chosen.selected, report: chosen.report }, { selected: entry.selected, report: null });
  });
}

test('HUB-003: results that arrive after the query found none get its selection (hub-session.spec)', () => {
  const empty = choose({ query: 'kam', rows: [], reset: true });
  assert.deepEqual(empty, { selected: null, awaiting: true, report: null });
  const arrived = choose({ query: 'kam', rows: [row('place:449', 'Kamadan')], awaiting: empty.awaiting });
  assert.deepEqual(arrived, { selected: 'place:449', awaiting: false, report: null });
  // Once settled, a later rebuild that lost the selection never picks for the player.
  const later = choose({ query: 'kam', rows: [row('place:449', 'Kamadan')], previous: [row('place:1', 'Ascalon City')], selected: null, awaiting: arrived.awaiting });
  assert.equal(later.selected, null);
});

test('HUB-232: a loading row that goes away hands its selection on and clears only its own refusal (hub-intent.spec)', () => {
  const loading = row('accounts:loading', 'Loading accounts', { group: 'Accounts', unavailable: 'Accounts are still loading.' });
  const account = row('account:1', 'Main account', { group: 'Accounts' });
  for (const [status, report] of [['Accounts are still loading.', ''], ['Travel failed.', null]] as const) {
    const chosen = choose({ query: 'acc', rows: [account], previous: [loading], selected: loading.id, cards: [accountsCard], status: { text: status, receipt: false } });
    assert.deepEqual({ selected: chosen.selected, report: chosen.report }, { selected: account.id, report });
  }
});

test('a setting that yields to its tool’s row arriving later hands the selection to it', () => {
  const setting = row('setting:build-library', 'Build Library', { group: 'Settings' });
  const tool = row('build-library', 'Build Library', { group: 'Tools' });
  assert.equal(choose({ query: 'build library', rows: [tool], previous: [setting], selected: setting.id }).selected, tool.id);
});

test('a selection that went away is named in the status line, unless a late receipt shows there', () => {
  const previous = [row('place:1', 'Ascalon City'), row('place:2', 'Lion’s Arch')];
  const rebuilt = [row('place:2', 'Lion’s Arch')];
  assert.deepEqual(choose({ query: 'a', rows: rebuilt, previous, selected: 'place:1' }),
    { selected: null, awaiting: false, report: 'The previous selection is no longer available. Choose a result.' });
  assert.equal(choose({ query: 'a', rows: rebuilt, previous, selected: 'place:1', status: { text: 'Traveled.', receipt: true } }).report, null);
  // A row whose preview changed is a different answer: the selection is dropped, not kept.
  const revised = [row('place:1', 'Ascalon City', { preview: 'Now closed' })];
  assert.equal(choose({ query: 'a', rows: revised, previous, selected: 'place:1' }).selected, null);
});
