/**
 * The Hub's Tools rows come from their manifests (app/shared/hub-tools.ts). Wrong behaviour this
 * catches: two tools claim one place, so their order on a root search depends on FEATURES order,
 * a manifest change silently reorders the Tools rows players know, or a word players searched
 * a tool by stops finding its row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES } from '../../app/features/index.ts';
import { FEATURE_SELECTION_POLICIES } from '../../app/shared/feature-contracts.ts';
import { createHubCommands } from '../../app/renderer/hub-commands.ts';
import { HUB_TOOL_ORDER, HUB_TOOL_ROWS } from '../../app/shared/hub-tools.ts';
import { matchHubRows } from '../../app/shared/hub.ts';

test('the Tools rows keep one place each, in the order players know', () => {
  const orders = FEATURES.flatMap(feature => 'tool' in feature && 'hub' in feature.tool ? [feature.tool.hub.order] : []);
  assert.equal(new Set(orders).size, orders.length);
  assert.deepEqual(HUB_TOOL_ORDER, ['travel', 'character', 'whispers', 'builds', 'trade', 'storage', 'maps', 'accounts']);
  // Travel and Build Library attach their own rows; Core draws the rest from the manifests.
  assert.deepEqual(HUB_TOOL_ROWS.map(row => row.id), ['character', 'whispers', 'trade', 'storage', 'maps']);
});

/** Every word the hand-written Hub rows matched before the manifests owned them. */
const OLD_HUB_WORDS = [
  ['trade', 'kamadan prices trading market trader'],
  ['whispers', 'friends people message chat'],
  ['character', 'relog profession characters alts'],
  ['storage', 'chest bank'],
  ['maps', 'grid terrain compass opacity'],
] as const;

/** Settings with every feature selected, so the Hub's commands list every Tools row. */
const everyFeature = Object.fromEntries(Object.values(FEATURE_SELECTION_POLICIES).flatMap(({ activation }) =>
  [[activation.setting, true], ...('master' in activation ? [[activation.master, true]] : [])]));

test('every word a Tools row answered still finds it', () => {
  // The Tools rows as the Hub's built-in commands draw them (hub-commands.ts).
  Object.assign(globalThis, { window: { gwToolsSettings: () => everyFeature } });
  const hub = { close() {}, show() {}, showRows() {}, suspend() {}, shortcuts: { lookup: () => undefined } };
  const { commands } = createHubCommands(hub, () => async () => {});
  assert.ok(commands);
  const rows = commands('').filter(row => row.group === 'Tools');
  assert.deepEqual(rows.map(row => row.id), HUB_TOOL_ROWS.map(tool => tool.id));
  for (const [id, words] of OLD_HUB_WORDS) for (const word of words.split(' ')) {
    assert.ok(matchHubRows(rows, word).some(row => row.id === id), `${word} finds ${id}`);
  }
});
