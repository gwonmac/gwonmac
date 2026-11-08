/**
 * A form's session drafts, held by app/renderer/hub-drafts.ts: what returns to a field when its
 * page mounts again. Each case names the draft a player would otherwise lose or see wrongly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHubDrafts } from '../../app/renderer/hub-drafts.js';

test('a typed field returns when its page mounts again, keyed by page path and focus key', () => {
  const drafts = createHubDrafts();
  drafts.restore('Home › Phrase', [['phrase', ''], ['note', 'old']]);
  drafts.keep(() => [['phrase', 'kama'], ['note', 'old']]);
  assert.deepEqual(drafts.restore('Home › Phrase', [['phrase', ''], ['note', 'old']]), [['phrase', 'kama']]);
  assert.deepEqual(drafts.restore('Home › Other', [['phrase', '']]), []);
});

test('a draft yields to a stored value that changed while its page was away', () => {
  const drafts = createHubDrafts();
  drafts.restore('Rates', [['ecto', '50']]);
  drafts.keep(() => [['ecto', '55']]);
  assert.deepEqual(drafts.restore('Rates', [['ecto', '60']]), []);
  drafts.keep(() => [['ecto', '60']]);
  assert.deepEqual(drafts.restore('Rates', [['ecto', '60']]), []);
});

test('a field typed back to where it started keeps no draft, and leaving no form keeps nothing', () => {
  const drafts = createHubDrafts();
  drafts.restore('Rates', [['ecto', '50']]);
  drafts.keep(() => [['ecto', '55']]);
  drafts.restore('Rates', [['ecto', '50']]);
  drafts.keep(() => [['ecto', '50']]);
  drafts.keep(() => { throw new Error('read without a form page'); });
  assert.deepEqual(drafts.restore('Rates', [['ecto', '50']]), []);
});
