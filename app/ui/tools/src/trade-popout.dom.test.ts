/**
 * The Hub's side of the Trade popout (the DOM half of tests/trade-popout.spec.ts): `trade <query>`
 * typed in the Hub hands the query to Trade and opens it, and command-R with Trade open puts the keyboard in the Hub search (the late-mount and game-key
 * destinations stay in Playwright: happy-dom's focus differs there). Each test
 * mounts the Hub fixture page in happy-dom. Trade's own ledger and keyboard rules, and the real
 * Tab traversal, stay in Playwright.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { fill, loadFixture, mountFixture, press, settle, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const hubSearch = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const tradeSearch = () => document.querySelector<HTMLInputElement>('input[placeholder="Search offers or character names"]')!;
const trade = () => document.querySelector('[role="dialog"][aria-label="Trade Chat"]');
const text = () => trade()?.textContent ?? '';

test.each(['wts', 'consets'])('trade %s typed in the Hub opens Trade with those results', async query => {
  await mountFixture();
  fill(hubSearch(), `trade ${query}`); press('Enter');
  await until(() => text().includes(`Results for “${query}”`));
  expect(tradeSearch().value).toBe(query);
  expect(document.querySelectorAll('[role="dialog"][aria-label="Trade Chat"] [role="option"]').length).toBeGreaterThan(0);
});

test('command-R with Trade open puts the keyboard in the Hub search while Trade stays shown', async () => {
  await mountFixture();
  press('Escape'); press('Meta+k'); await settle();
  expect(document.activeElement).toBe(tradeSearch());
  press('Meta+r'); await settle();
  expect(document.activeElement).toBe(hubSearch());
  expect(trade()).not.toBeNull();
});
