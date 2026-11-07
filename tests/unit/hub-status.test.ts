/**
 * What the Hub's status line says between reports, progress and receipts, held by
 * app/renderer/hub-status.ts. Each case names the wrong line a player would otherwise see.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHubStatus } from '../../app/renderer/hub-status.js';

test('an empty report falls back to the progress of the action still running (KEY-19)', () => {
  const status = createHubStatus(), task = {};
  assert.deepEqual(status.progress(task, 'Applying build…', true), { text: 'Applying build…', busy: true });
  assert.deepEqual(status.report('Not in an outpost.'), { text: 'Not in an outpost.', busy: false });
  assert.deepEqual(status.report(''), { text: 'Applying build…', busy: true });
});

test('a left-behind action\'s progress never covers a newer message, and fills an empty line', () => {
  const status = createHubStatus(), task = {};
  status.report('Travel failed.');
  assert.equal(status.progress(task, 'Copying…', false), null);
  assert.equal(status.text, 'Travel failed.');
  status.report('');
  assert.deepEqual(status.report(''), { text: 'Copying…', busy: true });
});

test('an action that ends clears only its own progress', () => {
  const status = createHubStatus(), first = {}, second = {};
  status.progress(first, 'First…', true);
  status.progress(second, 'Second…', true);
  assert.equal(status.end(first), null);
  assert.equal(status.text, 'Second…');
  assert.deepEqual(status.end(second), { text: '', busy: false });
});

test('a receipt outlives the player moving on; any other line clears', () => {
  const status = createHubStatus();
  status.report('Saved the build.', true);
  assert.equal(status.moved(), null);
  assert.equal(status.text, 'Saved the build.');
  status.report('Choose a result.');
  assert.deepEqual(status.moved(), { text: '', busy: false });
});

test('an observer withdraws only the receipt that names its failure', () => {
  const status = createHubStatus();
  status.report('Whispers failed to connect.', true);
  assert.equal(status.withdraw('Trade failed to connect.'), null);
  assert.deepEqual(status.withdraw('Whispers failed to connect.'), { text: '', busy: false });
  status.report('Whispers failed to connect.');
  assert.equal(status.withdraw('Whispers failed to connect.'), null);
});
