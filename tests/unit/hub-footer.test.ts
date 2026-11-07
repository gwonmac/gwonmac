/**
 * What the Hub's footer names, held by app/renderer/hub-footer.ts. Each case names the footer a
 * player would otherwise misread: a key that does nothing, or a primary that runs twice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HubRow } from '../../app/shared/hub.js';
import { hubLegend, hubRowPrimary, hubViewPrimary, type HubLegendInput } from '../../app/renderer/hub-footer.js';

const row = (extra: Partial<HubRow> = {}): HubRow => ({ id: 'place:1', title: 'Kamadan', detail: '', group: 'Places', action: 'Travel', run: () => {}, ...extra });

test('a list primary names the selected row, and the running action while it runs (HUB-083)', () => {
  const cases: readonly [string, ReturnType<typeof hubRowPrimary>, ReturnType<typeof hubRowPrimary>][] = [
    ['no selection', hubRowPrimary(undefined, null), { label: 'Select a result', keycap: false, disabled: true, variant: 'primary' }],
    ['a row', hubRowPrimary(row(), null), { label: 'Travel', keycap: true, disabled: false, variant: 'primary' }],
    ['an unavailable row', hubRowPrimary(row({ unavailable: 'Not now.' }), null), { label: 'Travel', keycap: true, disabled: true, variant: 'primary' }],
    ['a destructive row', hubRowPrimary(row({ destructive: true }), null), { label: 'Travel', keycap: true, disabled: false, variant: 'danger' }],
    ['a conversion shows its target art', hubRowPrimary(row({ conversion: { input: '1p', from: 'p', to: 'g', iconTo: 'gold.png' } }), null), { label: 'Travel', art: 'gold.png', keycap: true, disabled: false, variant: 'primary' }],
    ['while an action runs', hubRowPrimary(row({ conversion: { input: '1p', from: 'p', to: 'g', iconTo: 'gold.png' } }), { label: 'Traveling…' }), { label: 'Traveling…', keycap: false, disabled: true, variant: 'primary' }],
  ];
  for (const [name, actual, expected] of cases) assert.deepEqual(actual, expected, name);
});

test('only a named view primary carries the keycap, and never while it runs', () => {
  const save = { label: 'Save', run() {} };
  assert.deepEqual(hubViewPrimary(save, true, false), { label: 'Save', keycap: true, disabled: false, variant: 'primary' });
  assert.deepEqual(hubViewPrimary({ label: 'Done', run() {} }, false, false), { label: 'Done', keycap: false, disabled: false, variant: 'primary' });
  assert.deepEqual(hubViewPrimary(save, true, true), { label: 'Save', keycap: false, disabled: true, variant: 'primary' });
  assert.deepEqual(hubViewPrimary({ ...save, running: true }, true, false), { label: 'Save', keycap: false, disabled: true, variant: 'primary' });
  assert.deepEqual(hubViewPrimary({ ...save, disabled: true, destructive: true }, true, false), { label: 'Save', keycap: true, disabled: true, variant: 'danger' });
});

test('the legend names only the keys that act here and now', () => {
  const home: HubLegendInput = { view: false, rows: 3, opens: false, running: false, typed: false, parent: false, home: true };
  const cases: readonly [string, HubLegendInput, ReturnType<typeof hubLegend>][] = [
    ['Home with results', home, [[['↑', '↓'], 'Select'], [['⎋'], 'Close']]],
    ['one row has nothing to select between', { ...home, rows: 1 }, [[['⎋'], 'Close']]],
    ['a running action holds the selection', { ...home, running: true }, [[['⎋'], 'Close']]],
    ['a typed query clears first', { ...home, typed: true }, [[['↑', '↓'], 'Select'], [['⎋'], 'Clear']]],
    ['a row that opens a page', { ...home, opens: true }, [[['↑', '↓'], 'Select'], [['→'], 'Open'], [['⎋'], 'Close']]],
    ['a page above another', { ...home, parent: true, home: false }, [[['↑', '↓'], 'Select'], [['⎋'], 'Back'], [['⌘', '⌫'], 'Back']]],
    ['a page opened directly closes on Esc', { ...home, home: false }, [[['↑', '↓'], 'Select'], [['⎋'], 'Close'], [['⌘', '⌫'], 'Back']]],
    ['a view owns its arrows', { ...home, view: true, opens: true, home: false, parent: true }, [[['⎋'], 'Back'], [['⌘', '⌫'], 'Back']]],
  ];
  for (const [name, input, expected] of cases) assert.deepEqual(hubLegend(input), expected, name);
});
