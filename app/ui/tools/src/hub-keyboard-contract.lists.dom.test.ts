/** The keyboard contract's DOM cells for these views (hub-keyboard-contract.ts); one file per group so they run in parallel. */
import { expect, test } from 'vitest';
import golden from '../tests/keyboard-contract.golden.json';
import { BROWSER_KEYS, DOM_KEYS, KEYBOARD_VIEWS } from '../tests/keyboard-contract-keys';
import { keyboardContract } from './hub-keyboard-contract';

keyboardContract(['closed', 'home', 'home-query', 'home-row', 'explorable-home']);

// A cell no layer runs would pass silently: the table holds exactly every key in every view.
test('the golden table holds every key of both layers in every view, and nothing else', () => {
  const keys = [...DOM_KEYS, ...BROWSER_KEYS].sort();
  expect(Object.fromEntries(Object.entries(golden).map(([view, cells]) => [view, Object.keys(cells).sort()])))
    .toEqual(Object.fromEntries(KEYBOARD_VIEWS.map(view => [view, keys])));
});
