/**
 * The Hub calculator's behaviour that needs no real browser (the DOM half of
 * tests/hub-calculator-polish.spec.ts): the price-basis picker, quote expiry, rate refusals and
 * saving, missing and stale quotes, copy payloads, default targets and a late save failure. Each
 * test mounts the Hub fixture page in happy-dom with the real controller. Layout, computed
 * styles and the reload round trip stay in Playwright.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, press, settle, unmountFixture, until } from './hub-fixture-harness';
import { narrow } from './hub-dom-narrow';

process.env.TZ = 'UTC';
beforeAll(loadFixture);
afterEach(unmountFixture);

const NOW = new Date('2026-09-30T12:00:00Z');
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const app = () => document.getElementById('app')!;
const conversion = () => document.querySelector('.hub-conversion');
const status = () => document.querySelector('.hub-status')!.textContent;
const viewStatus = () => document.querySelector('.hub-view [role=status]')?.textContent;
const selectedId = () => document.querySelector('.hub-row[aria-selected=true]')?.getAttribute('data-id');
const control = (role: string, name: string) => narrow(HTMLElement, byRole(role, name, true)[0]);
const input = (name: string) => narrow(HTMLInputElement, byRole('textbox', name, true)[0]);
const enabled = (name: string) => byRole('button', name).some(candidate => candidate instanceof HTMLButtonElement && !candidate.disabled);
const choose = (select: HTMLElement, value: string) => { narrow(HTMLSelectElement, select).value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
const lastAction = () => app().dataset.action;
const mount = async (query = '') => { await mountFixture(query); vi.setSystemTime(NOW); };
const trade = () => {
  const native = window.gwNative;
  if (!('trade' in native)) throw new Error('The Hub fixture runs with Tools.');
  return native.trade;
};

test('changing the price basis keeps the card, and Enter copies the re-priced card', async () => {
  await mount();
  fill(search(), '1zkey in a'); await settle();
  const picker = control('combobox', 'Price basis');
  picker.focus();
  const copied: string[] = [];
  for (const side of ['wtb', 'wts']) {
    choose(picker, side); await settle();
    expect(selectedId()).toBe('market:result');
    expect(enabled('Copy ~ ')).toBe(true);
    delete app().dataset.action;
    press('Enter');
    await until(() => lastAction()?.startsWith('Copied 1 zkey = ~ '));
    copied.push(lastAction()!);
  }
  // Each basis prices the card on its own side of the market.
  expect(copied[0]).not.toBe(copied[1]);
});

test('quote expiry withdraws the conversion and returns focus from the basis control to the search', async () => {
  await mount();
  fill(search(), '1zkey in a'); await settle();
  control('combobox', 'Price basis').focus();
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  await vi.advanceTimersByTimeAsync(60_001);
  expect(conversion()).toBeNull();
  expect(document.activeElement).toBe(search());
});

const openRates = async () => { fill(search(), 'rates'); press('Enter'); await settle(); };

test.each([
  ['Gold per ectoplasm', '0', 'Enter a rate greater than zero.'],
  ['Ectoplasm per armbrace', '5,00', 'Enter a positive number, such as 5,000 or 5k.'],
  ['Ectoplasm per Zaishen key', '1.0000001', 'Enter a positive number, such as 5,000 or 5k.'],
])('a refused %s rate (%s) names the field and keeps its value and focus', async (label, value, message) => {
  await mount();
  await openRates();
  choose(control('combobox', 'Rate source'), 'manual'); await settle();
  const field = input(label);
  fill(field, value);
  press('Meta+Enter'); await settle();
  expect(viewStatus()).toBe(`${label}: ${message}`);
  expect(document.activeElement).toBe(field);
  expect(field.value).toBe(value);
});

test('trading shorthand rates save once on a double command-Enter and price the next conversion', async () => {
  await mount('&settings-ms=1000');
  await openRates();
  choose(control('combobox', 'Rate source'), 'manual'); await settle();
  fill(input('Gold per ectoplasm'), '5k');
  fill(input('Ectoplasm per armbrace'), '30');
  const key = input('Ectoplasm per Zaishen key');
  fill(key, '.5');
  let saves = 0;
  const set = window.gwNative.settings.set;
  window.gwNative.settings.set = async patch => { saves++; return set(patch); };
  press('Meta+Enter'); press('Meta+Enter');
  await vi.advanceTimersByTimeAsync(1_500); await settle();
  expect(viewStatus()).toBe('Your rates saved. Go back to your conversion.');
  expect(saves).toBe(1);
  click(control('button', 'Back')); await settle();
  fill(search(), '10e in p'); await settle();
  expect(conversion()?.textContent).toContain('50 platinum');
  // A material the manual rates leave out offers the automatic prices, and choosing them says so.
  fill(search(), '1 iron in g'); await settle();
  expect(document.querySelector('.hub-row')?.textContent).toContain('Use automatic observed prices for Iron Ingot');
  press('Enter'); await settle();
  choose(control('combobox', 'Rate source'), 'trader');
  click(byRole('button', 'Use these rates')[0]!); await vi.advanceTimersByTimeAsync(1_500); await settle();
  expect(viewStatus()).toBe('Automatic observed prices selected. Go back to your conversion.');
});

test('a missing quote names its item and Enter retries the selected result once', async () => {
  await mount();
  let reads = 0;
  const get = trade().getTraderQuotes;
  trade().getTraderQuotes = async () => { reads++; return get(); };
  fill(search(), '1 iron in g'); await settle();
  const row = document.querySelector('.hub-row[aria-selected=true]');
  expect(row?.textContent).toContain('Iron Ingot');
  expect(enabled('Retry')).toBe(true);
  const before = reads;
  press('Enter'); await settle();
  expect(reads - before).toBe(1);
});

test('a loading refusal clears when the quotes arrive', async () => {
  await mount();
  const get = trade().getTraderQuotes;
  trade().getTraderQuotes = async () => { await new Promise(resolve => setTimeout(resolve, 200)); return get(); };
  fill(search(), '10e in p'); press('Enter');
  await until(() => status() === 'Loading trader quotes…');
  await until(() => conversion()?.textContent?.includes('60 platinum'));
  expect(status()).toBe('');
});

// Every output family keeps a literal question, answer and provenance.
test.each([
  ['10e in p', 'Copied 10 e = 60 platinum (sample) · Buy from trader · Current observation 9/30/2026, 12:00:00 PM · Kamadan · Estimate'],
  ['2+2', 'Copied 2+2 = 4 · Exact arithmetic'],
  ['250 cupcakes in sweet points', 'Copied 250 items Birthday Cupcake = 500 Sweet Tooth points · 250 items × 2 base points · Normal use restrictions apply; no bonus event assumed'],
  ['1a in e', 'Copied 1 a = ~ 30 ecto (sample) · Sample data — not live Kamadan prices · Median of simulated ads · Seller asking prices · 6 advertisers (Armbrace of Truth) · Ads since 9/30/2026, 11:55:00 AM'],
])('copying %s retains its question and provenance', async (query, payload) => {
  await mount();
  fill(search(), query); await settle();
  expect(document.querySelectorAll('.hub-conversion')).toHaveLength(1);
  if (query === '2+2') expect(document.querySelector('.hub-conversion .hub-title')?.textContent).toBe('4');
  expect(enabled('Copy')).toBe(true);
  press('Enter'); await settle();
  expect(lastAction()).toBe(payload);
  if (query === '10e in p') expect(status()).toBe('Copied “60 platinum (sample)”');
});

test('a stale observed quote offers Refresh, which re-reads once and re-prices; price details label the median evidence', async () => {
  await mount();
  let count = 0;
  const get = trade().getTraderQuotes;
  trade().getTraderQuotes = async () => {
    const result = await get(); count++;
    return { ...result, quotes: result.quotes.map(quote => ({ ...quote, price: count === 1 ? 6000 : 7000, timestamp: Date.now() - (count === 1 ? 3_600_000 : 0) })) };
  };
  fill(search(), '10e in p'); await settle();
  expect(conversion()?.textContent).toContain('Last observed');
  expect(count).toBe(1);
  click(control('button', 'Refresh quotes')); await settle();
  expect(count).toBe(2);
  expect(conversion()?.textContent).toContain('70 platinum');
  expect(conversion()?.textContent).toContain('Current observation');
  expect(conversion()?.textContent).not.toContain('Last observed');
  fill(search(), '1a in e'); await settle();
  click(control('button', 'Details')); await settle();
  const evidence = document.querySelector('.hub-view dl')?.textContent;
  expect(evidence).toContain('Median rate');
  expect(evidence).toContain('1 Armbrace of Truth = 30 ecto');
  expect(evidence).toContain('Newest ad');
});

test('a default target names the copy action and a per-item question reads as one sentence', async () => {
  await mount();
  fill(search(), '1k'); await settle();
  expect(conversion()?.textContent).toContain('Default target');
  expect(enabled('Copy 1,000 gold')).toBe(true);
  fill(search(), '14a per stack in e each'); await settle();
  expect(conversion()?.getAttribute('aria-label')).toMatch(/^14 a per stack each equals/u);
});

test('a rate save refused after Back reports its named failure over the new page', async () => {
  await mount();
  await openRates();
  window.gwNative.settings.set = async () => { await new Promise(resolve => setTimeout(resolve, 400)); throw new Error('Synthetic settings refusal'); };
  choose(control('combobox', 'Rate source'), 'manual'); await settle();
  fill(input('Gold per ectoplasm'), '5k');
  click(byRole('button', 'Use these rates')[0]!);
  click(control('button', 'Back')); fill(search(), '2+2');
  await vi.advanceTimersByTimeAsync(700); await settle();
  expect(status()).toBe('Could not save conversion rates. Try again.');
  expect(search().value).toBe('2+2');
  expect(conversion()?.textContent).toContain('4');
  expect(window.gwToolsSettings().calculatorRates?.mode).toBe('automatic');
});

test('switching the source with blank rates restores the named prompt on Back', async () => {
  await mount();
  fill(search(), '10e in p'); await settle();
  click(control('button', 'Details')); await settle();
  choose(control('combobox', 'Rate source'), 'manual'); await settle();
  click(byRole('button', 'Use these rates')[0]!); await settle();
  expect(viewStatus()).toContain('Your rates saved');
  click(control('button', 'Back')); await settle();
  expect(document.querySelector('.hub-row[aria-selected=true]')?.textContent).toContain('Set a rate for Glob of Ectoplasm');
  expect(enabled('Set rates')).toBe(true);
  expect(status()).not.toContain('previous selection');
});

test('a resumed or rates-saved quote keeps its selection and empty status, and Enter copies it, reading quotes once', async () => {
  await mount();
  let reads = 0;
  const get = trade().getTraderQuotes;
  trade().getTraderQuotes = async () => { reads++; return get(); };
  fill(search(), '10e in p'); await settle();
  expect(selectedId()).toBe('quote:result');
  window.dispatchEvent(new Event('blur')); await settle();
  expect(document.getElementById('hub')?.hasAttribute('open')).toBe(false);
  click(control('button', 'Open Hub')); await settle();
  const payload = 'Copied 10 e = 60 platinum (sample) · Buy from trader · Current observation 9/30/2026, 12:00:00 PM · Kamadan · Estimate';
  for (const sequence of ['resume', 'rates-save-back']) {
    if (sequence === 'rates-save-back') {
      click(control('button', 'Details')); await settle();
      click(byRole('button', 'Use these rates')[0]!); await settle();
      expect(viewStatus()).toBe('Automatic observed prices selected. Go back to your conversion.');
      click(control('button', 'Back')); await settle();
    }
    expect(selectedId()).toBe('quote:result');
    expect(status()).toBe('');
    delete app().dataset.action;
    search().focus(); press('Enter'); await settle();
    expect(lastAction()).toBe(payload);
    fill(search(), '10e in p'); await settle();
  }
  expect(reads).toBe(1);
});
