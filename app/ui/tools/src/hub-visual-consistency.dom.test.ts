/**
 * The Hub's visual-consistency rules that need no real browser (the DOM half of
 * tests/hub-visual-consistency.spec.ts): which glyph, label and structure each row and view
 * draws, the command examples, Home pins and an appearance change that must not disturb the
 * player's place. Each test mounts the Hub fixture page in happy-dom. Sizes, computed styles
 * and alignment stay in Playwright; so does the caret after an appearance change.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/contracts';
// The test applies the real appearance projector, as the standalone fixture page does.
// eslint-disable-next-line no-restricted-imports
import { applyAppearance } from '../../../renderer/appearance';
import { byRole, click, fill, loadFixture, mountFixture, press, settle, unmountFixture } from './hub-fixture-harness';
import { narrow } from './hub-dom-narrow';

beforeAll(loadFixture);
afterEach(unmountFixture);

const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const crumbs = () => document.querySelector('.hub-breadcrumbs')?.textContent;
const selectedId = () => document.querySelector('.hub-row[aria-selected=true]')?.getAttribute('data-id');
const row = (id: string) => document.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
const rowWith = (text: string) => [...document.querySelectorAll<HTMLElement>('.hub-row')].find(candidate => candidate.textContent?.includes(text))!;
const attribute = (selector: string, name: string) => document.querySelector(selector)?.getAttribute(name);
const menuItem = (name: string) => byRole('menuitem', name)[0]!;
const hubOpen = () => narrow(HTMLDialogElement, document.getElementById('hub')).open;

test('template folders draw a loaded folder glyph, never an image URL (HUB-089)', async () => {
  await mountFixture();
  fill(search(), 'build library'); press('Enter'); await settle();
  click(row('game-templates')); await settle();
  expect(document.querySelectorAll('[data-id^="folder:"]').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('[data-id^="folder:"] .hub-icon img')).toHaveLength(0);
  expect(document.querySelectorAll('[data-id^="folder:"] .hub-icon[data-kind="folder"]').length).toBeGreaterThan(0);
});

test('the footer legend uses glyph keycaps only (HUB-146)', async () => {
  await mountFixture();
  expect(document.querySelector('.hub-legend')?.textContent).toContain('⎋');
  expect(document.querySelectorAll('.hub-footer kbd:not(.ui-kbd)')).toHaveLength(0);
});

test('Price basis has one label and its picker takes focus on a click (HUB-149)', async () => {
  await mountFixture();
  fill(search(), '5 zkeys in ecto'); await settle();
  expect(document.querySelectorAll('.hub-rate-controls label')).toHaveLength(1);
  expect(document.querySelector('.hub-rate-controls label')?.textContent).toContain('Price basis');
  const picker = byRole('combobox', 'Price basis', true)[0]!;
  click(picker);
  expect(document.activeElement).toBe(picker);
  expect(hubOpen()).toBe(true);
});

test('an appearance change keeps the query, selected row, focus and open Hub (HUB-116, D-16)', async () => {
  await mountFixture();
  fill(search(), 'k');
  for (let i = 0; i < 5; i++) press('ArrowDown');
  await settle();
  const before = { query: search().value, id: selectedId() };
  expect(before.id).toBeTruthy();
  for (const patch of [{ uiStyle: 'obsidian' as const }, { uiFont: 'inter' as const }, { uiPanelOpacity: 65 }, { uiTextSize: 200 }, { uiTextSize: 150 }]) {
    applyAppearance({ ...DEFAULT_SETTINGS, ...patch });
    window.dispatchEvent(new CustomEvent('hub-fixture-settings', { detail: patch }));
    await settle();
    expect({ query: search().value, id: selectedId() }).toEqual(before);
    expect(document.activeElement).toBe(search());
    expect(hubOpen()).toBe(true);
  }
  expect((await window.gwNative.settings.get()).uiTextSize).toBe(150);
});

test('a command example returns to real Home with only its argument left to type (HUB-153)', async () => {
  await mountFixture();
  fill(search(), 'commands'); press('Enter'); await settle();
  click(rowWith('travel <place>')); await settle();
  expect(search().value).toBe('travel ');
  expect(attribute('#hub', 'data-page')).toBe('home');
  expect(crumbs()).toBe('Home');
  expect([search().selectionStart, search().selectionEnd]).toEqual([7, 7]);
  press('x');
  expect(search().value).toBe('travel x');
  expect(document.getElementById('app')!.dataset.action ?? '').not.toMatch(/Travel/u);
  fill(search(), 'title'); await settle();
  click(row('title:help')); await settle();
  expect(attribute('#hub', 'data-page')).toBe('home');
  expect(crumbs()).toBe('Home');
  expect(search().value).toBe('titles');
});

test.each([
  ['team gom', 'Review GOM AFK', 'Home›GOM AFK', '.hub-build-review'],
  ['build smiter', 'Show build details', 'Home›Build details', '.hub-build-details'],
])('%s opens its page from Actions and Back restores the query (HUB-153)', async (query, menu, path, view) => {
  await mountFixture();
  fill(search(), query); await settle();
  press('Meta+j'); await settle();
  click(menuItem(menu)); await settle();
  expect(crumbs()).toBe(path);
  expect(document.querySelector(view)).not.toBeNull();
  press('Meta+Backspace'); await settle();
  expect(crumbs()).toBe('Home');
  expect(search().value).toBe(query);
});

test('Home pins and recent applications draw compact builds; explicit search keeps the full bar (HUB-187)', async () => {
  await mountFixture();
  fill(search(), 'build smiter'); await settle();
  press('Meta+j'); await settle();
  click(menuItem('Pin to Hub')); await settle();
  press('Meta+r'); fill(search(), ''); await settle();
  expect(document.querySelectorAll('.hub-build-compact')).toHaveLength(1);
  fill(search(), 'build smiter'); await settle();
  expect(document.querySelector('.hub-build-row .hub-skill-bar')).not.toBeNull();
  expect(document.querySelector('.hub-build-row')?.classList.contains('hub-build-compact')).toBe(false);
  press('Enter'); press('Enter'); await settle();
  expect(hubOpen()).toBe(false);
  click(byRole('button', 'Open Hub', true)[0]!); await settle();
  press('Meta+r'); fill(search(), ''); await settle();
  const recent = row('recent:hub-smiter:me');
  expect(recent.textContent).toContain('Recently applied to Fixture Monk');
  expect(recent.classList.contains('hub-build-compact')).toBe(true);
});

test('Home, Travel and Characters draw the same search glyph (HUB-145)', async () => {
  await mountFixture();
  const glyph = document.querySelector('.hub-search svg')!.innerHTML;
  for (const key of ['Meta+t', 'Meta+e']) {
    press(key); await settle();
    expect(document.querySelector('.hub-view .ui-hub-search svg')?.innerHTML).toBe(glyph);
    press('Meta+r'); await settle();
  }
});

test('currency display groups digits and names its copy target with the conversion art (HUB-157)', async () => {
  await mountFixture();
  fill(search(), '1p in g'); await settle();
  expect(document.querySelector('.hub-primary')?.textContent).toContain('Copy 1,000 gold');
  const art = attribute('.hub-primary-art', 'src');
  expect(art).toBeTruthy();
  expect(art).toBe(attribute('.hub-conversion-art-to', 'src'));
  fill(search(), '250e in stacks e'); await settle();
  expect(document.querySelector('.hub-conversion .hub-title')?.textContent).toBe('1 stack ecto');
});

test('command action glyphs differ from child cues and person actions (HUB-156)', async () => {
  await mountFixture();
  expect(attribute('[data-id="commands"] .hub-icon', 'data-kind')).toBe('command');
  expect(attribute('[data-id="commands"] .hub-icon path', 'd')).toBe('m9 5-6 7 6 7M13 19h8');
  expect(document.querySelector('[data-id="builds"] .hub-row-type > span')?.textContent).toBe('›');
  expect(document.querySelector('[data-id="commands"] .hub-icon')!.innerHTML).not.toBe(document.querySelector('[data-id="builds"] .hub-row-type > span')!.innerHTML);
  expect([...document.querySelectorAll<HTMLElement>('[data-id="character"] .hub-icon,[data-id="accounts"] .hub-icon')].map(icon => icon.dataset.kind)).toEqual(['character', 'accounts']);
  fill(search(), 'romi'); press('Enter'); await settle();
  expect(['whisper', 'travel', 'invite'].map(id => attribute(`[data-id="person:${id}"] .hub-icon`, 'data-kind'))).toEqual(['whispers', 'travel', 'invite']);
});

test('the game context is separate and Characters has one heading and its settings button (HUB-158)', async () => {
  await mountFixture();
  expect(document.querySelector('.hub-context')?.textContent).toContain("Lion's Arch");
  press('Meta+e'); await settle();
  expect(document.querySelector('.hub-caption')?.textContent).toBe('Characters');
  expect(document.querySelectorAll('.character-switch-head h2')).toHaveLength(1);
  expect(byRole('button', 'Character Switch settings', true)).toHaveLength(1);
});

test('a pinned preference draws an icon in its row (HUB-151)', async () => {
  await mountFixture();
  press('Meta+j'); await settle();
  click(menuItem('Pin to Hub')); await settle();
  fill(search(), 'hub preferences'); press('Enter'); await settle();
  expect(document.querySelectorAll('.hub-preference-option .hub-icon')).toHaveLength(1);
});
