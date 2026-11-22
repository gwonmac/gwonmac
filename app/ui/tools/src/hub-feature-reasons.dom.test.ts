/**
 * A search that names an off Feature finds one row with the reason the launcher's Features tab
 * shows (app/shared/feature-status.ts), announced and reached like any other row, and at most
 * one action. An off Feature adds nothing else to the Hub. Runs the real Hub on the fixture page
 * with its `?features=` scenarios (fixture-facts.ts), one per reason a Feature can be off.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { BUILD_CHECK_FAILED } from '../../../shared/contracts';
import { fill, loadFixture, mountFixture, press, settle, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const search = () => q<HTMLInputElement>('.hub-search input')!;
const action = () => document.getElementById('app')!.dataset.action ?? null;
async function ask(query: string) { fill(search(), query); await settle(); }

/** What a player sees and hears of a row: its group, title, reason, whether it acts, and the footer primary. */
function rowOf(id: string) {
  const row = q(`.hub-row[data-id="${id}"]`);
  if (!row) return null;
  const group = row.closest('[role="group"]');
  return {
    role: row.getAttribute('role'),
    group: group ? document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent : null,
    title: row.querySelector('.hub-title')?.textContent,
    reason: row.querySelector('.hub-detail')?.textContent,
    disabled: row.getAttribute('aria-disabled'),
    selected: row.getAttribute('aria-selected') === 'true' && search().getAttribute('aria-activedescendant') === row.id,
    primary: q('#hub .hub-primary-label')?.textContent,
    primaryDisabled: q<HTMLButtonElement>('#hub .hub-primary')!.disabled,
  };
}

// One row per reason resolve gives; `wrong-area` reads as on where no character stands, so it has no row.
test.each([
  { reason: 'switched-off', scenario: '', query: 'alcohol timer', id: 'alcoholTimer', title: 'Alcohol Timer', text: 'Off', primary: 'Turn on Alcohol Timer', opens: 'Settings' },
  { reason: 'needs', scenario: 'needs', query: 'progress', id: 'progress', title: 'Progress', text: 'Needs Travel. Turn it on first.', primary: 'Turn on Travel', opens: 'Settings' },
  { reason: 'needs-update', scenario: 'patch-day', query: 'quick item', id: 'quickItemMove', title: 'Quick Item Move', text: 'Needs a GWonMac update for this Guild Wars build.', primary: 'Check for updates', opens: 'Settings updates' },
  { reason: 'not-proven', scenario: 'patch-day', query: 'chat filters', id: 'chatFilters', title: 'Chat Filters', text: BUILD_CHECK_FAILED, primary: 'Chat Filters is off', opens: null },
  { reason: 'checking', scenario: 'checking', query: 'whispers', id: 'whispers', title: 'Whispers', text: 'Checking this Guild Wars build…', primary: 'Whispers is off', opens: null },
  { reason: 'needs-restart', scenario: 'restart', query: 'whispers', id: 'whispers', title: 'Whispers', text: 'Starts the next time you open Guild Wars.', primary: 'Whispers is off', opens: null },
  { reason: 'plain-game', scenario: 'plain-game', query: 'whispers', id: 'whispers', title: 'Whispers', text: 'Off while you play the plain game.', primary: 'Whispers is off', opens: null },
] as const)('$reason: “$query” finds $title with its reason', async ({ scenario, query, id, title, text, primary, opens }) => {
  await mountFixture(scenario ? `&features=${scenario}` : '');
  await ask(query);
  // A row that acts is the query's answer; one that only explains is chosen for the player only
  // when nothing else answers (HUB-056), but the arrows reach it like any other row.
  if (opens) expect(rowOf(`feature:${id}`)?.selected).toBe(true);
  for (let presses = 0; presses < 5 && !rowOf(`feature:${id}`)?.selected; presses += 1) press('ArrowUp');
  expect(rowOf(`feature:${id}`)).toEqual({
    role: 'option', group: 'Features', title, reason: text, disabled: opens ? 'false' : 'true', selected: true, primary, primaryDisabled: !opens,
  });
  press('Enter');
  await settle();
  if (opens === 'Settings') {
    // Turn on opens the switch in the Hub's Settings page.
    await until(() => q('.hub-settings-host h1'));
    expect(q('.hub-caption')?.textContent).toBe('Settings');
    // ⌘R still opens Home from there.
    press('Meta+r');
    await settle();
    expect(q('.hub-caption')?.textContent).toBe('Home');
  } else {
    // Check for updates hands over to the launcher's Settings › Updates; a reason with no action runs nothing.
    expect(action()).toBe(opens);
  }
});

test('the scope word of an off Feature finds its row, and the Feature adds nothing else', async () => {
  await mountFixture('&features=plain-game');
  await ask('whisper romi');
  expect(q('.hub-row[data-id="feature:whispers"] .hub-detail')?.textContent).toBe('Off while you play the plain game.');
  // Whispers' own Tools row, and every person row it would add, stay away.
  expect([...document.querySelectorAll<HTMLElement>('.hub-row')].map(row => row.dataset.id)).toEqual(['feature:whispers']);
  // Enter on a reason with no action runs nothing; Home's empty search lists no off Feature.
  press('Enter');
  await settle();
  expect(action()).toBeNull();
  await ask('');
  expect(q('.hub-row[data-id^="feature:"]')).toBeNull();
});

test('a Feature that is on has no reason row', async () => {
  await mountFixture();
  await ask('whispers');
  expect(q('.hub-row[data-id="feature:whispers"]')).toBeNull();
  expect(q('.hub-row[data-id="whispers"]')).not.toBeNull();
});
