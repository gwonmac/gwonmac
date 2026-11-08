/**
 * The Hub's appearance rules that need no real browser (the DOM half of
 * tests/hub-appearance.spec.ts): the Appearance settings keep the page, query and focus, and the
 * footer's primary names itself in its title. Each test mounts the Hub fixture page in happy-dom.
 * Painted colours, contrast, geometry and the art strip stay in Playwright. The rule that an
 * appearance change keeps the query, selected row and focus is held in
 * hub-visual-consistency.dom.test.ts.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, narrow, press, settle, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const caption = () => document.querySelector('.hub-caption')?.textContent;
const choose = (select: HTMLElement, value: string) => { narrow(HTMLSelectElement, select).value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
const setting = (name: string) => document.querySelector<HTMLSelectElement>(`[data-setting="${name}"] select`)!;
const openAppearance = async () => {
  fill(search(), 'settings'); press('Enter');
  await until(() => document.querySelector('.hub-settings-host h1'));
  const appearance = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Settings sections"] button')].find(button => button.textContent?.trim() === 'Appearance')!;
  click(appearance); await settle();
};

test('choosing a font and style in Appearance keeps the Settings page, and Back keeps the query', async () => {
  await mountFixture();
  await openAppearance();
  choose(setting('uiFont'), 'inter'); await settle();
  choose(setting('uiStyle'), 'obsidian'); await settle();
  expect(await window.gwNative.settings.get()).toMatchObject({ uiFont: 'inter', uiStyle: 'obsidian' });
  expect(caption()).toBe('Settings');
  click(byRole('button', 'Back', true)[0]!); await settle();
  expect(search().value).toBe('settings');
});

test('choosing the saved custom theme keeps the Settings page', async () => {
  await mountFixture();
  await openAppearance();
  const style = setting('uiStyle');
  style.focus(); choose(style, 'custom'); await settle();
  expect(style.value).toBe('custom');
  expect(caption()).toBe('Settings');
});

test.each(['k', 'build monk', '10 ecto in p'])('the primary button of "%s" carries its full label as its title (HUB-238)', async query => {
  await mountFixture();
  fill(search(), query); await settle();
  press('ArrowDown');
  const primary = document.querySelector('.hub-primary')!;
  const label = primary.querySelector('.hub-primary-label')!.textContent;
  expect(label).toBeTruthy();
  expect(primary.getAttribute('title')).toBe(label);
});
