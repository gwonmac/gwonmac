/**
 * The Hub's Tools rows come from their manifests (app/shared/hub-tools.ts). Wrong behaviour this
 * catches: two tools claim one place, so their order on a root search depends on FEATURES order,
 * or a manifest change silently reorders the Tools rows players know.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES } from '../../app/features/index.ts';
import { HUB_TOOL_ORDER, HUB_TOOL_ROWS } from '../../app/shared/hub-tools.ts';

test('the Tools rows keep one place each, in the order players know', () => {
  const orders = FEATURES.flatMap(feature => 'tool' in feature && 'hub' in feature.tool ? [feature.tool.hub.order] : []);
  assert.equal(new Set(orders).size, orders.length);
  assert.deepEqual(HUB_TOOL_ORDER, ['travel', 'character', 'whispers', 'builds', 'trade', 'storage', 'maps', 'accounts']);
  // Travel and Build Library attach their own rows; Core draws the rest from the manifests.
  assert.deepEqual(HUB_TOOL_ROWS.map(row => row.id), ['character', 'whispers', 'trade', 'storage', 'maps']);
});
