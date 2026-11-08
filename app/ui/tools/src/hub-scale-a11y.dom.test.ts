/**
 * The Hub's scale and accessibility rules that need no real browser (the DOM half of
 * tests/hub-scale-a11y.spec.ts): result caps, how many searches and DOM changes a burst of
 * events costs, what the list, dialog and status owners announce, and what a page keeps across
 * a close, Back or resume. Each test mounts the Hub fixture page in happy-dom with the real
 * controller. Timing budgets, layout, scrolling and computed styles stay in Playwright.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import type { HubSource } from '../../../shared/hub';
import { byRole, click, fill, loadFixture, mountFixture, narrow, press, settle, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const caption = () => document.querySelector('.hub-caption')?.textContent;
const selected = () => document.querySelector('#hub [aria-selected="true"]');
const row = (id: string) => document.querySelector<HTMLElement>(`.hub-row[data-id="${id}"]`)!;
const rows = (selector: string) => document.querySelectorAll(selector).length;
const hub = () => window.gwHub!;
const frame = () => vi.advanceTimersByTimeAsync(20);
const action = () => document.getElementById('app')!.dataset.action;
const hubOpen = () => narrow(HTMLDialogElement, document.getElementById('hub')).open;
const exact = (role: string, name: string) => byRole(role, name, true)[0]!;
/** The number of attribute changes a callback causes under `root`, as the specs' MutationObserver count. */
function attributeChanges(root: Element, work: () => void, options: MutationObserverInit = { subtree: true, attributes: true }) {
  const observer = new MutationObserver(() => {});
  observer.observe(root, options);
  work();
  const count = observer.takeRecords().length;
  observer.disconnect();
  return count;
}

test('root caps matching builds at eight and carries the complete query to Build Library (HUB-110)', async () => {
  await mountFixture('&library=200');
  fill(search(), 'm'); await settle();
  expect(rows('.hub-row[data-id^="build:"]')).toBeLessThanOrEqual(8);
  const more = [...document.querySelectorAll<HTMLElement>('.hub-row')].find(candidate => /^\d+ more — open in Build Library/u.test(candidate.textContent ?? ''));
  expect(more).toBeTruthy();
  click(more!); await settle();
  expect(caption()).toBe('Build Library');
  expect(search().value).toBe('m');
  expect(rows('.hub-row[data-id^="build:"]')).toBeGreaterThan(8);
  click(exact('button', 'Home')); await settle();
  fill(search(), 'build m'); await settle();
  expect(rows('.hub-row[data-id^="build:"]')).toBeGreaterThan(8);
});

test('arrow selection mutates only the old and new rows, and a pointer move leaves the footer alone (HUB-112)', async () => {
  await mountFixture('&library=200');
  fill(search(), 'build m'); await settle();
  await until(() => rows('.hub-row[data-id^="build:"]') > 20);
  const list = document.getElementById('hub-results')!;
  expect(attributeChanges(list, () => press('ArrowDown'))).toBeLessThanOrEqual(4);
  expect(document.activeElement).toBe(search());
  expect(document.querySelectorAll('#hub [aria-selected="true"]')).toHaveLength(1);
  const footer = document.querySelector('.hub-footer')!;
  expect(attributeChanges(footer, () => selected()!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, movementX: 1 })), { childList: true, subtree: true })).toBe(0);
});

test('an explicit close empties the result DOM (HUB-171)', async () => {
  await mountFixture('&library=200');
  fill(search(), 'build m'); press('ArrowDown'); await settle();
  click(exact('button', 'Close Hub')); await settle();
  expect(hubOpen()).toBe(false);
  expect(document.getElementById('hub-results')!.childElementCount).toBe(0);
});

test('source bursts coalesce to one search a frame, typing searches once synchronously (HUB-111)', async () => {
  await mountFixture('&library=200&templates-ms=1000');
  let calls = 0;
  let notify = () => {};
  const detach = hub().attach({
    search() { calls++; return []; },
    subscribe(listener) { notify = listener; return () => {}; },
    setVisible(visible) { if (visible) { notify(); notify(); } },
  });
  await frame();
  calls = 0;
  for (let index = 0; index < 20; index++) notify();
  const beforeFrame = calls;
  await frame();
  const afterFrame = calls;
  calls = 0;
  fill(search(), 'mo');
  const typing = calls;
  detach();
  expect({ beforeFrame, afterFrame, typing }).toEqual({ beforeFrame: 0, afterFrame: 1, typing: 1 });
});

test('an owned list ignores unrelated observations and still follows its own source (HUB-111)', async () => {
  await mountFixture();
  let notifyOwner = () => {}, notifyOther = () => {};
  let title = 'Original', reads = 0, lifecycle = '';
  const owner: HubSource = { search: () => [], setVisible() {}, subscribe(listener) { notifyOwner = listener; return () => {}; } };
  const detachOwner = hub().attach(owner);
  const detachOther = hub().attach({ search: () => [], lifecycle: () => lifecycle, setVisible() {}, subscribe(listener) { notifyOther = listener; return () => {}; } });
  hub().showRows('Owned list', () => { reads++; return [{ id: 'owned', title, detail: '', group: 'Builds', action: 'Choose', run() {} }]; }, undefined, undefined, owner);
  await settle();
  expect(document.querySelector('.hub-announce')?.textContent).toBe('1 result');
  reads = 0;
  const changes: MutationRecord[] = [];
  const observer = new MutationObserver(records => changes.push(...records));
  observer.observe(document.querySelector('#hub')!, { subtree: true, childList: true, attributes: true });
  for (let update = 0; update < 20; update++) notifyOther();
  await frame();
  const unrelatedReads = reads;
  changes.push(...observer.takeRecords()); observer.disconnect();
  const unrelatedMutations = changes.length;
  lifecycle = 'Updating'; notifyOther();
  const updatedLifecycle = document.querySelector('.hub-lifecycle')?.textContent;
  title = 'Updated'; notifyOwner();
  await frame();
  const updated = document.querySelector('#hub .hub-title')?.textContent;
  const ownReads = reads - unrelatedReads;
  detachOther(); detachOwner();
  expect({ unrelatedReads, unrelatedMutations, updatedLifecycle, ownReads, updated, withdrawn: caption() })
    .toEqual({ unrelatedReads: 0, unrelatedMutations: 0, updatedLifecycle: 'Updating', ownReads: 1, updated: 'Updated', withdrawn: 'Home' });
});

test('the unopened Build workspace stays small and only a focused slot loads choices (HUB-254)', async () => {
  await mountFixture('&library=200');
  expect(document.querySelectorAll('#toolbox-foundation *').length).toBeLessThan(500);
  click(exact('button', 'Close Hub')); await settle();
  press('Meta+b'); await settle();
  const workspace = document.querySelector('.tools-window')!;
  const picker = workspace.querySelector<HTMLSelectElement>('#team-build-0')!;
  expect(picker.querySelectorAll('option')).toHaveLength(2);
  picker.focus(); picker.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); await settle();
  expect(picker.querySelectorAll('option').length).toBeGreaterThan(100);
  expect(workspace.querySelectorAll('#team-build-1 option')).toHaveLength(2);
  const name = workspace.querySelector<HTMLInputElement>('#team-name')!;
  fill(name, 'Unsaved team name');
  click(exact('button', 'Close Build Library')); await settle();
  press('Meta+b'); await settle();
  expect(document.querySelector<HTMLInputElement>('#team-name')!.value).toBe('Unsaved team name');
});

test('settled results announce once, and empty results do not remain expanded (HUB-113)', async () => {
  await mountFixture();
  const announcement = document.querySelector('.hub-announce')!;
  expect(announcement.getAttribute('role')).toBe('status');
  expect(announcement.hasAttribute('hidden')).toBe(false);
  fill(search(), 'kam'); await settle();
  expect(announcement.textContent).toBe('2 results');
  fill(search(), 'zzzq'); await settle();
  expect(announcement.textContent).toBe('No matches');
  expect(search().getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById('hub-results')!.childElementCount).toBe(0);
  expect(document.querySelector('#hub .hub-empty')).not.toBeNull();
});

test('root results are grouped by named sections without a Home count (HUB-160)', async () => {
  await mountFixture();
  expect(document.querySelector('.hub-count')!.textContent).toBe('');
  fill(search(), 'k'); await settle();
  const places = byRole('group', 'Places', true).filter(group => document.getElementById('hub-results')!.contains(group))[0];
  expect(places).toBeTruthy();
  expect(places!.querySelectorAll('[role=option]').length).toBeGreaterThan(0);
  press('Meta+t'); await settle();
  const travel = byRole('listbox', 'Travel', true)[0]!;
  expect(travel).toBeTruthy();
  const groups = [...travel.querySelectorAll('[role=group]')];
  expect(groups.length).toBeGreaterThan(0);
  expect(accessible(groups[0]!)).toMatch(/Destinations|Recent|Available destinations/u);
});
function accessible(element: Element) {
  const label = element.getAttribute('aria-label');
  if (label) return label;
  return (element.getAttribute('aria-labelledby') ?? '').split(/\s+/u).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
}

test('a build option has a concise name and describes its skills separately (HUB-161), and its cue says Right Arrow (HUB-167)', async () => {
  await mountFixture();
  fill(search(), 'build smiter'); await settle();
  const build = row('build:hub-smiter');
  expect(accessible(build) || byRole('option', 'Smiter', true).includes(build) && 'Smiter').toBe('Smiter');
  const described = (build.getAttribute('aria-describedby') ?? '').split(/\s+/u).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
  expect(`${described} ${build.getAttribute('aria-description') ?? ''}`).toMatch(/Word of Healing/u);
  expect(build.getAttribute('aria-description')).toMatch(/Right Arrow opens/u);
});

test('the Hub dialog is named after its visible title (HUB-166)', async () => {
  await mountFixture();
  const name = () => accessible(document.getElementById('hub')!);
  const heading = (text: string) => byRole('heading', text, true).some(element => document.getElementById('hub')!.contains(element));
  expect([name(), heading('Home')]).toEqual(['Hub — Home', true]);
  fill(search(), 'library'); press('Enter'); await settle();
  expect([name(), heading('Build Library')]).toEqual(['Hub — Build Library', true]);
  press('Meta+r'); await settle();
  fill(search(), 'settings'); press('Enter'); await until(() => document.querySelector('.hub-settings-host h1'));
  expect([name(), heading('Settings')]).toEqual(['Hub — Settings', true]);
});

test('only the selected whisper transcript announces appended messages (HUB-081)', async () => {
  await mountFixture();
  fill(search(), 'whisper Romi'); press('Enter'); await settle();
  const log = byRole('log', 'Messages with Romi Ranger', true)[0]!;
  expect(log).toBeTruthy();
  const before = log.querySelectorAll('article').length;
  window.dispatchEvent(new Event('hub-fixture-incoming')); await settle();
  expect(log.querySelectorAll('article')).toHaveLength(before + 1);
  expect(log.querySelectorAll('article')[before]!.textContent).toContain('Ready for another mission?');
  click(exact('button', 'Hide Whispers')); await settle();
  expect(document.querySelectorAll('[data-transcript][role="log"]')).toHaveLength(0);
});

test('End reaches the real last row before a large Library has painted it (HUB-112), and Back restores the opened row', async () => {
  await mountFixture('&library=200');
  hub().openRow('builds', 'builds', 'Build Library is unavailable.');
  const painted = rows('.hub-row');
  press('End');
  const option = document.getElementById(search().getAttribute('aria-activedescendant') ?? '');
  expect(painted).toBeLessThan(200);
  expect(option).toBe([...document.querySelectorAll('.hub-row')].at(-1));
  expect(option?.getAttribute('aria-selected')).toBe('true');
  // A row opened from the list returns selected after Back.
  press('Home');
  const id = selected()!.getAttribute('data-id')!;
  click(row(id)); await settle();
  expect(caption()).not.toBe('Build Library');
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Build Library');
  expect(selected()?.getAttribute('data-id')).toBe(id);
});

test('narrowing a large result list retains unchanged rows and their pointer action (HUB-170)', async () => {
  await mountFixture('&library=200');
  fill(search(), 'build healer'); await settle();
  const node = row('build:scale-8');
  fill(search(), 'build healer d'); await settle();
  expect(node.isConnected).toBe(true);
  click(node); await settle();
  expect(caption()).toBe('Deep Healer 0008');
  expect(action() ?? '').not.toMatch(/apply|command/u);
});

test('Settings describes its controls, and a shortcut label never starts a capture (HUB-115)', async () => {
  await mountFixture();
  fill(search(), 'settings'); press('Enter'); await until(() => document.querySelector('.hub-settings-host h1'));
  const resign = byRole('checkbox', 'Resign', true)[0]!;
  const description = (resign.getAttribute('aria-describedby') ?? '').split(/\s+/u).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim();
  expect(description).toBe('Ask before sending /resign in PvE. Enter confirms; Escape cancels.');
  const settingRow = document.querySelector<HTMLElement>('[data-setting="tool:character-switch"]')!;
  const change = exact('button', 'Change Switch Character shortcut');
  click(settingRow.querySelector('strong')!); await settle();
  expect(change.textContent).not.toContain('Press keys');
  click(settingRow.querySelector('strong')!); await settle();
  expect(narrow(HTMLButtonElement, change).disabled).toBe(false);
  click(change); press('a'); await settle();
  expect(settingRow.textContent).toContain('Press a key with Command, Control or Option');
  expect(document.activeElement).toBe(change);
  click(change); press('Meta+c'); await settle();
  expect(settingRow.textContent).toContain('That shortcut is reserved by macOS or the application.');
  expect(document.activeElement).toBe(change);
});

test('Trade counts and opacity values are passive, with slider value text (HUB-162)', async () => {
  await mountFixture();
  click(exact('button', 'Close Hub')); await settle();
  press('Meta+k'); await settle();
  expect(document.querySelector('.trade-summary')).not.toBeNull();
  expect(document.querySelector('.trade-summary')!.hasAttribute('aria-live')).toBe(false);
  expect(document.querySelector('.trade-status')!.getAttribute('role')).toBe('status');
  press('Meta+r'); await settle();
  fill(search(), 'settings'); press('Enter'); await until(() => document.querySelector('.hub-settings-host h1'));
  const appearance = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Settings sections"] button')].find(button => button.textContent?.trim() === 'Appearance')!;
  click(appearance); await settle();
  const opacity = narrow(HTMLInputElement, byRole('slider', 'Panel opacity', true)[0]);
  opacity.focus(); opacity.value = String(Number(opacity.value) - 1); opacity.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  expect(opacity.getAttribute('aria-valuetext')).toBe(`${opacity.value}%`);
  expect(document.querySelectorAll('.settings-fields output')).toHaveLength(0);
  click(exact('button', 'Home')); await settle();
  fill(search(), 'whisper Romi'); press('Enter'); await settle();
  click(document.querySelector<HTMLElement>('[aria-label="Chat options"]')!); await settle();
  const whisper = narrow(HTMLInputElement, byRole('slider', 'Background', true)[0]);
  whisper.value = String(Number(whisper.value) - 1); whisper.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  expect(whisper.getAttribute('aria-valuetext')).toBe(`${whisper.value}%`);
  expect(document.querySelectorAll('.whisper-opacity output')).toHaveLength(0);
});

test('Characters has one dialog and horizontal positions (HUB-163)', async () => {
  await mountFixture();
  press('Meta+e'); await settle();
  expect(document.querySelectorAll('#hub dialog')).toHaveLength(0);
  const characters = byRole('listbox', 'Characters', true)[0]!;
  expect(characters.getAttribute('aria-orientation')).toBe('horizontal');
  const first = characters.querySelector('[role=option]')!;
  expect([first.getAttribute('aria-posinset'), first.getAttribute('aria-setsize')]).toEqual(['1', '7']);
});

test('status owners are rendered before their first message, and Settings keeps its status through a section jump (HUB-114)', async () => {
  await mountFixture();
  const status = document.querySelector('.hub-status')!;
  expect(status.textContent).toBe('');
  expect(status.hasAttribute('hidden')).toBe(false);
  expect(document.querySelector('.hub-receipt-announcement')).not.toBeNull();
  expect(document.querySelector('.hub-receipt-announcement')!.hasAttribute('hidden')).toBe(false);
  fill(search(), 'settings'); press('Enter'); await until(() => document.querySelector('.hub-settings-host h1'));
  const settingsStatus = () => document.querySelector('.settings-status [role=status]');
  expect(settingsStatus()).not.toBeNull();
  click(exact('button', 'Home')); await settle();
  fill(search(), 'maps'); press('Enter'); await settle();
  hub().openSettings({ section: 'maps' }); await until(() => caption() === 'Settings');
  const maps = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Settings sections"] button')].find(button => button.textContent?.trim() === 'Maps')!;
  expect(maps.getAttribute('aria-current')).toBe('page');
  expect(settingsStatus()).not.toBeNull();
});

test('the placement toggle has one name and a move hint while unlocked (HUB-164)', async () => {
  await mountFixture();
  const lock = exact('button', 'Lock Hub position');
  expect(lock.getAttribute('aria-pressed')).toBe('true');
  click(lock); await settle();
  expect(lock.getAttribute('aria-pressed')).toBe('false');
  const hint = document.querySelector<HTMLElement>('.hub-move-hint')!;
  expect(hint.hasAttribute('hidden') || hint.style.display === 'none').toBe(false);
  click(lock); await settle();
  expect(lock.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector<HTMLElement>('.hub-move-hint')!.hasAttribute('hidden')).toBe(true);
});

test('Enter on the focused Home crumb returns Home (HUB-165)', async () => {
  await mountFixture();
  fill(search(), 'settings'); press('Enter'); await until(() => document.querySelector('.hub-settings-host h1'));
  const home = exact('button', 'Home');
  home.focus();
  press('Enter'); await settle();
  expect(caption()).toBe('Home');
});

test('repeated opens and resumes search once per transition and leave no rows behind (HUB-111, 171)', async () => {
  await mountFixture('&library=200&templates-ms=1000');
  let calls = 0;
  const detach = hub().attach({ search() { calls++; return []; }, setVisible() {}, subscribe() { return () => {}; } } satisfies HubSource);
  const passes: number[] = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    hub().close(); calls = 0;
    hub().show(); passes.push(calls); await frame();
    fill(search(), 'm');
    window.dispatchEvent(new Event('blur')); calls = 0;
    hub().show(); passes.push(calls); await frame();
  }
  hub().close();
  const remaining = rows('#hub-results .hub-row');
  detach();
  expect(passes).toEqual(Array(10).fill(1));
  expect(remaining).toBe(0);
});

test('incoming bursts keep a deep build selection and bounded arrow mutations (HUB-111, 112)', async () => {
  await mountFixture('&library=200');
  fill(search(), 'build library'); press('Enter'); await settle();
  await until(() => document.querySelector('.hub-row[data-id="build:scale-150"]'));
  row('build:scale-150').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, movementX: 1 }));
  expect(row('build:scale-150').getAttribute('aria-selected')).toBe('true');
  for (let message = 0; message < 12; message++) { window.dispatchEvent(new Event('hub-fixture-incoming')); await vi.advanceTimersByTimeAsync(125); }
  expect(selected()?.getAttribute('data-id')).toBe('build:scale-150');
  const list = document.getElementById('hub-results')!;
  const mutations: number[] = [];
  for (let arrow = 0; arrow < 10; arrow++) { mutations.push(attributeChanges(list, () => press('ArrowDown'))); await frame(); }
  expect(Math.max(...mutations)).toBeLessThanOrEqual(4);
});
