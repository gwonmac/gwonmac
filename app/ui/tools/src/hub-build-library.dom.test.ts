/**
 * The Hub's Build Library flows that need no real browser (the DOM half of
 * tests/hub-build-library.spec.ts): template folders, self and hero application, build and team
 * comparison pages, details, the review of a team, an interrupted apply, and what a suspended
 * page does when its source goes away. Each test mounts the Hub fixture page in happy-dom with
 * the real controller. Sizes, scrolling, computed styles and the receipt's top-layer paint stay in
 * Playwright.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, narrow, press, settle, shown, unmountFixture } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const app = () => document.getElementById('app')!;
const crumbs = () => document.querySelector('.hub-breadcrumbs')?.textContent;
const caption = () => document.querySelector('.hub-caption')?.textContent;
const action = () => app().dataset.action;
const field = (name: string) => narrow(HTMLInputElement, byRole('textbox', name, true)[0]);
const hubOpen = () => narrow(HTMLDialogElement, document.getElementById('hub')).open;
const options = () => [...document.querySelectorAll<HTMLElement>('#hub [role=option]')];
const text = (selector: string) => document.querySelector(selector)?.textContent ?? '';
const button = (name: string, exact = false) => narrow(HTMLButtonElement, byRole('button', name, exact)[0]);
const rows = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const submit = async (query: string) => { fill(search(), query); press('Enter'); await settle(); };
/** The fixture's scenario picker: the Hub closes first so the Library reloads when it opens again, as the spec does. */
const scenario = async (name: string) => {
  click(button('Close Hub', true)!); await settle();
  const picker = document.querySelector<HTMLSelectElement>('select[aria-label="Fixture scenario"]')!;
  picker.value = name; picker.dispatchEvent(new Event('change', { bubbles: true })); await settle();
};
const shownTools = () => [...document.querySelectorAll('.tools-window')].some(shown);
const noApply = () => expect(action() ?? '').not.toMatch(/command|apply/u);
const incoming = () => document.querySelector<HTMLElement>('.hub-summary:not([hidden])');
const menuItem = (name: string, exact = false) => byRole('menuitem', name, exact)[0]!;
const openActions = async () => { press('Meta+j'); await settle(); };

test('template folders and explicit self application stay inside Hub', async () => {
  await mountFixture();
  await submit('build library'); await submit('Guild Wars templates');
  expect(options().filter(option => option.textContent?.startsWith('Monk') && option.textContent.includes('Template folder'))).toHaveLength(1);
  await submit('Monk');
  expect(crumbs()).toBe('Home›Build Library›Guild Wars templates›Monk');
  expect(options()[0]!.textContent).toContain('Protection');
  press('Enter'); await settle();
  expect(byRole('option', 'Apply to me')).toHaveLength(1);
  expect(shownTools()).toBe(false);
  noApply();
  press('Enter'); await settle();
  expect(hubOpen()).toBe(false);
  expect(action()).toMatch(/command:/u);
});

test('hero search includes unlocked heroes and applies only to an existing party member', async () => {
  await mountFixture();
  await submit('build monk'); await submit('hero');
  fill(search(), 'Dunkoro'); await settle();
  expect(options()[0]!.textContent).toContain('Add Dunkoro to your party first.');
  expect(button('Review availability')!.disabled).toBe(false);
  press('Enter'); await settle();
  noApply();
  expect(byRole('button', 'to Dunkoro').find(candidate => /^Apply .+ to Dunkoro/u.test(candidate.textContent ?? ''))!.hasAttribute('disabled')).toBe(true);
  click(button('Back', true)!); await settle();
  fill(search(), 'Tahlkora'); await settle();
  expect(options()[0]!.getAttribute('aria-disabled')).toBe('false');
  press('Enter'); await settle();
  expect(hubOpen()).toBe(false);
  expect(action()).toMatch(/command:/u);
  expect(text('.hub-receipt')).toContain('applied to Tahlkora');
});

test('Right Arrow compares the current build without applying, and Back restores the comparison', async () => {
  await mountFixture();
  fill(search(), 'build monk'); await settle(); press('ArrowRight'); await settle();
  expect(incoming()?.textContent).toContain('Protection');
  const self = byRole('option', 'Apply to me')[0]!;
  expect(self.textContent).toContain('Current build');
  expect(self.querySelector('[aria-label="Healing Prayers 12"]') ?? self.querySelector('img[alt="Healing Prayers 12"]')).not.toBeNull();
  expect(incoming()!.querySelector('.hub-skill')?.getAttribute('aria-label')).toBe('1. Protective Spirit');
  expect(self.querySelector('.hub-skill')?.getAttribute('aria-label')).toBe('1. Word of Healing');
  fill(search(), 'hero'); await settle(); press('ArrowRight'); await settle();
  expect(incoming()?.textContent).toContain('Protection');
  fill(search(), 'Tahlkora'); await settle(); press('ArrowRight'); await settle();
  expect(caption()).toBe('Tahlkora');
  expect(options()[0]!.textContent).toContain('Current build');
  expect(options()[0]!.querySelectorAll('.hub-skill')).toHaveLength(8);
  expect(incoming()!.querySelectorAll('.hub-skill')).toHaveLength(8);
  press('ArrowDown'); press('ArrowRight'); await settle();
  noApply();
  window.dispatchEvent(new CustomEvent('hub-fixture-scenario', { detail: 'unobserved-builds' })); await settle();
  expect(options()[0]!.querySelectorAll('.hub-skill')).toHaveLength(0);
  expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(search());
  expect(incoming()!.querySelectorAll('.hub-skill')).toHaveLength(8);
  press('Meta+Backspace'); await settle();
  expect(caption()).toBe('Heroes');
  expect(search().value).toBe('Tahlkora');
  expect(incoming()?.textContent).toContain('Protection');
  click(button('Home', true)!); await settle();
  expect(incoming()).toBeNull();
});

test('a build search shows inline metadata without file names (HUB-089)', async () => {
  await mountFixture();
  fill(search(), 'build monk'); await settle();
  const build = rows('.hub-build-row');
  expect(build).toHaveLength(4);
  const first = build[0]!;
  expect(first.textContent).not.toContain('.txt');
  expect(first.querySelector('.hub-title')?.textContent).toBe('Protection Mo/Me Monk');
  expect(first.querySelector('.hub-attribute')?.textContent).toBe('HP12');
  expect(first.querySelector('[aria-label="Healing Prayers 12"], img[alt="Healing Prayers 12"]')).not.toBeNull();
  expect(first.querySelectorAll('.hub-professions img')).toHaveLength(2);
  expect(first.querySelectorAll('.hub-attribute-group > img')).toHaveLength(1);
  expect(first.querySelectorAll('.hub-attribute-group .hub-attribute')).toHaveLength(3);
});

test('comparison details are reachable from the keyboard without applying a build', async () => {
  await mountFixture();
  await submit('build monk');
  expect(document.querySelector('.hub-row [data-changed=true]')).not.toBeNull();
  await openActions();
  expect(document.activeElement).toBe(byRole('menuitem', 'Apply ').find(item => /^Apply /u.test(item.textContent ?? '')));
  press('ArrowDown'); press('Enter'); await settle();
  expect(text('.hub-build-details')).toContain('Protective Spirit');
  expect(text('.hub-build-details')).toContain('Healing Prayers');
  noApply();
  press('Escape'); await settle();
  expect(document.activeElement).toBe(search());
});

test('recent build targets and the editor handoff retain their place', async () => {
  await mountFixture();
  await submit('build monk'); await submit('hero'); await submit('Tahlkora');
  expect(hubOpen()).toBe(false);
  click(button('Open Hub', true)!); await settle();
  click(rows('.hub-row[data-id^="recent:"]')[0]!); await settle();
  expect(caption()).toBe('Tahlkora');
  expect(text('.hub-row[aria-selected="true"]')).toContain('Already equipped');
  click(button('Home', true)!); await settle();
  await submit('build Word of Healing');
  expect(incoming()?.textContent).toContain('Word of Healing');
  click(button('Actions')!); await settle();
  click(menuItem('Show build details')); await settle();
  click(button('Open in Build Library', true)!); await settle();
  expect(hubOpen()).toBe(false);
  expect(shownTools()).toBe(true);
  expect(field('Build name').value).toBe('Word of Healing');
  expect(document.querySelector('.tools-window')!.contains(document.activeElement)).toBe(true);
  click(button('Close Build Library', true)!); await settle();
  click(button('Open Hub', true)!); await settle();
  expect(document.querySelector('.hub-build-details')).not.toBeNull();
});


test('self application has one comparison page, and Right Arrow on it adds none', async () => {
  await mountFixture();
  fill(search(), 'build monk'); await settle(); press('ArrowRight'); await settle();
  press('ArrowRight'); await settle();
  expect(crumbs()).toBe('Home›Protection');
  noApply();
});

test('details from Choose hero show the incoming build without an empty second card', async () => {
  await mountFixture();
  await submit('build monk');
  fill(search(), 'hero'); await settle(); await openActions();
  click(menuItem('Show build details', true)); await settle();
  expect(document.querySelectorAll('.hub-build-details h2')).toHaveLength(1);
  expect(text('.hub-build-details')).toContain('Protective Spirit');
  noApply();
});

test.each(['library', 'lib', 'bu', 'team', 'teams', 'skills'])('"%s" opens the loaded Build Library', async query => {
  await mountFixture();
  fill(search(), query); await settle();
  const entry = document.querySelector<HTMLElement>('.hub-row[data-id="builds"]')!;
  expect(entry.textContent).toContain('Browse saved builds and teams');
  expect(entry.getAttribute('aria-disabled')).toBe('false');
  expect(document.querySelector<HTMLButtonElement>('.hub-primary')!.disabled).toBe(false);
  click(entry); await settle();
  expect(crumbs()).toBe('Home›Build Library');
  expect(text('#hub')).not.toContain('Build Library is loading.');
});

test('the Library lists every saved team, and a team typed alone stays review-only', async () => {
  await mountFixture();
  fill(search(), 'teams'); await settle();
  expect(rows('#hub .hub-row[data-id^="team:"]')).toHaveLength(4);
  await submit('library');
  expect(crumbs()).toBe('Home›Build Library');
  const names = rows('.hub-row[data-id^="team:"]').map(row => row.textContent ?? '');
  expect(names).toHaveLength(4);
  for (const name of ['GOM AFK', 'Balanced vanquish', 'Classic Discordway', 'Story and missions']) expect(names.some(candidate => candidate.includes(name)), name).toBe(true);
  click(button('Home', true)!); await settle();
  for (const query of ['teams ', 'team gom']) {
    fill(search(), query); await settle();
    expect(text('.hub-primary')).toMatch(/^Review /u);
    press('Enter'); await settle();
    expect(document.querySelector('.hub-build-review')).not.toBeNull();
    noApply();
    press('Meta+Backspace'); await settle();
    expect(search().value).toBe(query);
  }
  fill(search(), 'team gom afk'); await settle();
  expect(text('.hub-primary')).toContain('Apply team GOM AFK');
});

test('a team review names its changes, and a repeat Apply says the party already matches (⌘R hides the receipt)', async () => {
  await mountFixture();
  fill(search(), 'team gom afk'); await settle(); press('ArrowRight'); await settle();
  expect(text('.hub-build-review')).toContain('Switches to Hard Mode');
  click(button('Apply team GOM AFK')!); await settle();
  expect(hubOpen()).toBe(false);
  click(button('Open Hub', true)!); await settle();
  fill(search(), 'team gom afk'); await settle();
  expect(text('.hub-preview')).toContain('Already matches');
  press('Enter'); await settle();
  const receipt = document.querySelector<HTMLElement>('.hub-receipt')!;
  expect(receipt.textContent).toBe('GOM AFK already matches.');
  expect(receipt.classList.contains('ui-toast')).toBe(true);
  expect(receipt.getAttribute('data-tone')).toBe('success');
  expect(shown(receipt)).toBe(true);
  press('Meta+r'); await settle();
  expect(shown(receipt)).toBe(false);
});

test('an interrupted team Apply reopens a review with completed and remaining changes and an editor action', async () => {
  await mountFixture();
  await scenario('partial');
  await submit('team gom afk');
  expect(text('.hub-row')).toContain('Partly applied · Review');
  press('ArrowDown'); await settle();
  expect(button('Review GOM AFK')!.disabled).toBe(false);
  press('Enter'); await settle();
  const review = document.querySelector<HTMLElement>('.hub-build-review')!;
  expect(review.querySelector('[role=status]')?.textContent).toContain('Team partly applied. Synthetic interruption');
  expect(text('.hub-status')).toBe('');
  for (const line of ['Completed', 'Enabling Hard Mode confirmed.', 'Remaining', 'Update your build']) expect(review.textContent, line).toContain(line);
  await openActions();
  const actions = document.querySelector<HTMLElement>('[role=menu][aria-label="Actions"]')!;
  expect(shown(actions)).toBe(true);
  expect([...actions.querySelectorAll('[role=menuitem]')].map(item => item.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Apply team GOM AFK'), expect.stringContaining('Open in Build Library')]));
  press('Escape'); await settle();
  expect(shown(actions)).toBe(false);
  expect(review.contains(document.activeElement)).toBe(true);
  click(button('Actions')!); await settle();
  click(menuItem('Open in Build Library', true)); await settle();
  expect(hubOpen()).toBe(false);
  expect(field('Team name').value).toBe('GOM AFK');
  click(button('Close Build Library', true)!); await settle();
  click(button('Open Hub', true)!); await settle();
  press('Meta+r'); fill(search(), 'team balanced vanquish'); await settle(); press('ArrowRight'); await settle();
  await openActions();
  click(menuItem('Open in Build Library', true)); await settle();
  expect(field('Team name').value).toBe('Balanced vanquish');
});

test('an unrelated source update keeps the build target page, query and selection', async () => {
  await mountFixture();
  await submit('build monk'); await submit('hero'); fill(search(), 'Tahlkora'); await settle();
  for (const [name, detail] of [['hub-fixture-settings', { travelPalette: false }], ['hub-fixture-lifecycle', 'map-loading']] as const) {
    window.dispatchEvent(new CustomEvent(name, { detail })); await settle();
    expect(caption()).toBe('Heroes');
    expect(search().value).toBe('Tahlkora');
    expect(text('.hub-row[aria-selected=true]')).toContain('Tahlkora');
  }
});

test('turning a Tool off in Settings keeps the Settings page and section', async () => {
  await mountFixture();
  await submit('accounts');
  expect(caption()).toBe('Accounts');
  window.gwHub!.openSettings({ section: 'tools' }); await settle();
  const tools = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Settings sections"] button')].find(item => item.textContent?.trim() === 'Tools')!;
  click(tools); await settle();
  const travel = narrow(HTMLInputElement, byRole('checkbox', 'Travel', true)[0]);
  click(travel); await settle();
  expect(caption()).toBe('Settings');
  expect(tools.getAttribute('aria-current')).toBe('page');
  expect(narrow(HTMLInputElement, byRole('checkbox', 'Travel', true)[0]).checked).toBe(false);
});

test('folder-qualified builds show their path in every spelling and keep it through review and Back', async () => {
  await mountFixture();
  await scenario('folders');
  for (const query of ['build team builds farming monk', 'build "Team Builds/Farming" monk', 'build folder:"Team Builds/Farming" mo']) {
    fill(search(), query); await settle();
    const found = rows('.hub-build-row');
    expect(found, query).toHaveLength(1);
    expect(found[0]!.querySelector('.hub-title')?.textContent).toBe('Protection Mo/Me Team Builds/Farming');
    expect(found[0]!.querySelector('.hub-folder-label svg')).not.toBeNull();
  }
  press('ArrowRight'); await settle();
  expect(text('.hub-summary .hub-folder-label')).toBe('Team Builds/Farming');
  noApply();
  click(button('Back', true)); await settle();
  expect(search().value).toBe('build folder:"Team Builds/Farming" mo');
});

test('mixed hero professions default to the eligible hero and keep a blocked hero inspectable', async () => {
  await mountFixture();
  await scenario('mixed-professions');
  await submit('build monk'); await submit('hero');
  expect(text('.hub-row[aria-selected="true"]')).toContain('Tahlkora');
  const blocked = rows('.hub-row').find(row => row.textContent?.includes("Gwen's assigned build is for Monk, but the observed primary is Mesmer."))!;
  expect(blocked.getAttribute('aria-description')).toBe("Slot 5 · Gwen's assigned build is for Monk, but the observed primary is Mesmer.. Mesmer / Monk. Skills: Patient Spirit, Guardian, Resurrection Chant, Protective Spirit, Word of Healing, Aegis, Dismiss Condition, Spirit Bond. Right Arrow opens the child page.");
  click(blocked); await settle();
  expect(narrow(HTMLButtonElement, document.querySelector('.hub-primary')).disabled).toBe(true);
  expect(text('.hub-summary')).toContain('Protection');
  noApply();
  fill(search(), 'library'); await settle();
  expect(rows('.hub-row')).toHaveLength(0);
  expect(text('#hub')).not.toContain('Build Library is loading');
});

test.each([
  ['a suspended build page', async () => { await submit('build monk'); }],
  ['a suspended phrase editor', async () => {
    fill(search(), 'build Word of Healing'); await settle(); await openActions();
    click(menuItem('Set search phrase…', true)); await settle();
    fill(narrow(HTMLInputElement, byRole('textbox', 'Search phrase', true)[0]), 'unfinished healing phrase');
  }],
])('%s cannot resume once its Library source is withdrawn', async (_name, arrange) => {
  await mountFixture();
  await arrange();
  window.dispatchEvent(new Event('blur')); await settle();
  window.dispatchEvent(new Event('hub-fixture-withdraw-library')); await settle();
  click(button('Open Hub', true)); await settle();
  expect(caption()).toBe('Home');
  expect(byRole('textbox', 'Search phrase', true)).toHaveLength(0);
  expect(rows('.hub-row').map(row => row.textContent).join(' ')).not.toMatch(/Apply to (me|hero)/u);
  noApply();
  fill(search(), 'library'); await settle();
  // Only the Build Library setting row remains: the withdrawn source offers no page or action.
  expect(rows('.hub-row:not([data-id^="setting"])')).toHaveLength(0);
  expect(text('#hub')).not.toContain('Build Library is loading');
});

test('a new details view clears the previous page pin receipt', async () => {
  await mountFixture();
  fill(search(), 'build Word of Healing'); await settle(); await openActions();
  click(menuItem('Pin to Hub', true)); await settle();
  expect(text('.hub-status')).toBe('Pinned Word of Healing.');
  await openActions();
  click(menuItem('Show build details', true)); await settle();
  expect(document.querySelector('.hub-build-details')).not.toBeNull();
  expect(text('.hub-status')).toBe('');
  press('Meta+Backspace'); await settle();
  expect(search().value).toBe('build Word of Healing');
  expect(caption()).toBe('Home');
  expect(text('.hub-status')).toBe('');
});
