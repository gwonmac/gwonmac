/**
 * Async actions belong to the Hub page that started them (HUB-004, HUB-016, HUB-083, HUB-035).
 * While that page shows, the footer and the status line name the running action and nothing
 * starts a second one. Typing, a page change or closing ends the page session: a late
 * completion then reports a receipt and never closes, navigates or wipes the newer page; a
 * late failure is a named failure receipt that also waits for the next opening. The fixture's
 * `?slow-apply` lands each command after half a second on the production confirmation clock.
 * Runs the real Hub on the fixture page under fake timers; the real-browser part of these
 * specs (CSS, the 100 ms budget) stays in hub-session.spec.ts.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { click, fill, loadFixture, mountFixture, press, settle, shown, type, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const search = () => q<HTMLInputElement>('.hub-search input')!;
const hubOpen = () => shown(document.getElementById('hub')!);
const status = () => q('.hub-status')!;
const receipt = () => q('.hub-receipt')!;
const primary = () => q<HTMLButtonElement>('.hub-primary')!;
const caption = () => q('.hub-caption')?.textContent;
const actions = () => (window.gwFixtureActions ?? []).filter(action => !action.startsWith('command:'));
const keydowns = () => (window.gwFixtureCanvas?.events ?? []).filter(event => event.type === 'keydown').length;
const applying = /^Applying GOM AFK… \d+\/16$/u;
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const text = (element: Element | null) => element?.textContent?.replace(/\s+/gu, ' ').trim();
/** Fills the query and presses Enter, then lets only microtasks and the first timers run. */
async function enter(query: string) { fill(search(), query); press('Enter'); await tick(); }
const tick = () => advance(10);
const row = (id: string) => q(`#hub .hub-row[data-id="${id}"]`);
const selected = () => [...document.querySelectorAll('#hub .hub-row[aria-selected="true"]')];
const scenario = (detail: string) => window.dispatchEvent(new CustomEvent('hub-fixture-scenario', { detail }));
/** Closes the Hub with two Escapes (clear, then close), as the specs do. */
async function closeHub() { press('Escape'); press('Escape'); await tick(); }

// PPL-16
test('a late invite completion never closes or wipes the reopened Hub', async () => {
  await mountFixture('&party&invite-ms=1500');
  await enter('invite Zed Delta');
  expect([primary().textContent, primary().disabled]).toEqual(['Inviting Zed Delta…', true]);
  await closeHub();
  expect(hubOpen()).toBe(false);
  press('Meta+r'); await settle();
  expect(hubOpen()).toBe(true);
  window.gwFixtureCanvas?.clear();
  type('travel kam');
  // The reopened page is usable at once: the late invite no longer holds its primary.
  expect(primary().disabled).toBe(false);
  await advance(1600);
  expect(status().textContent).toBe('Sent /invite Zed Delta. Guild Wars answers in chat.');
  expect([hubOpen(), search().value, document.activeElement === search(), primary().disabled]).toEqual([true, 'travel kam', true, false]);
  expect([keydowns(), actions()]).toEqual([0, ['PARTY.INVITE Zed Delta']]);
});

// BLD-01
test('a team apply that completes while the player types keeps the Hub, the query and the focus', async () => {
  await mountFixture('&slow-apply');
  press('Escape'); await tick();
  expect(hubOpen()).toBe(false);
  q('#canvas')!.focus();
  press('Meta+r'); await tick();
  expect(document.activeElement).toBe(search());
  window.gwFixtureCanvas?.clear();
  type('team gom afk'); press('Enter'); await tick();
  expect(status().textContent).toMatch(applying);
  fill(search(), '');
  // Type slowly through the apply's completion, then the rest of the query past it.
  const query = 'travel kamadan 12345678';
  let landed = -1;
  for (const [index, character] of [...query].entries()) {
    press(character);
    if (landed < 0 && status().textContent === 'GOM AFK applied.') landed = index;
    if (landed < 0) await advance(900);
  }
  // The receipt landed while the player was still typing, and the keys after it kept it.
  expect(landed).toBeGreaterThan(0);
  expect(landed).toBeLessThan(query.length - 1);
  expect([status().textContent, hubOpen(), caption(), search().value, document.activeElement === search()])
    .toEqual(['GOM AFK applied.', true, 'Home', 'travel kamadan 12345678', true]);
  expect([keydowns(), actions()]).toEqual([0, ['apply-team']]);
});

// KEY-19
test.each(['review', 'home'] as const)('a running apply keeps its progress in the status line after Back and through typing, and never navigates (from %s)', async from => {
  await mountFixture('&slow-apply');
  type('team gom afk'); await tick();
  if (from === 'review') { press('ArrowRight'); await tick(); expect(caption()).toBe('GOM AFK'); }
  press('Enter'); await tick();
  expect(status().textContent).toMatch(applying);
  press('Meta+Backspace'); await tick();
  expect([caption(), search().value]).toEqual(['Home', 'team gom afk']);
  // Back and every typed key leave the running apply's progress, busy, in the status line.
  const busy = () => q('.hub-status[aria-busy="true"]')?.textContent;
  expect(busy()).toMatch(applying);
  expect(q('.hub-panel')!.getAttribute('data-busy')).toBe('true');
  press('ArrowRight'); await tick();
  expect([caption(), primary().textContent, primary().querySelectorAll('kbd').length, q('.hub-view')!.getAttribute('aria-busy')])
    .toEqual(['GOM AFK', 'Applying GOM AFK…', 0, 'true']);
  expect(busy()).toMatch(applying);
  press('Meta+Backspace'); fill(search(), '');
  const seen = new Set<string>();
  for (const character of 'travel kamadan') {
    press(character);
    const now = status().textContent;
    if (now === 'GOM AFK applied.') break;
    expect(busy()).toMatch(applying);
    seen.add(now ?? '');
    await advance(250);
  }
  expect(seen.size).toBeGreaterThan(1);
  await advance(20_000);
  expect(status().textContent).toBe('GOM AFK applied.');
  expect([status().getAttribute('aria-busy'), q('.hub-panel')!.getAttribute('data-busy'), hubOpen(), caption(), q('.hub-breadcrumbs')!.textContent, document.activeElement === search()])
    .toEqual(['false', 'false', true, 'Home', 'Home', true]);
  expect([keydowns(), actions()]).toEqual([0, ['apply-team']]);
});

// KEY-19
test('a running apply left behind by typing never paints over a newer failure in the status line', async () => {
  await mountFixture('&party&slow-apply&invite-fail=Guild Wars chat is not ready');
  await enter('team gom afk');
  expect(status().textContent).toMatch(applying);
  await enter('invite Zed Delta');
  const failure = '/invite Zed Delta was not sent. Guild Wars chat is not ready.';
  expect(status().textContent).toBe(failure);
  // Several apply steps land meanwhile; the newer failure keeps the line.
  const progressed = window.gwFixtureActions!.length;
  await until(() => { void advance(500); return window.gwFixtureActions!.length > progressed + 1; });
  expect([status().textContent, status().getAttribute('aria-busy')]).toEqual([failure, 'false']);
  // The next repaint shows the running apply again.
  type('x'); await tick();
  expect([status().textContent, status().getAttribute('aria-busy')]).toEqual([expect.stringMatching(applying), 'true']);
});

// HUB-083
test('a team apply that fails on its review leaves the outcome there and no progress in the status line', async () => {
  await mountFixture('&slow-apply');
  scenario('partial');
  const review = () => q('.hub-build-review [role=status]')!;
  await enter('team gom af');
  expect(caption()).toBe('GOM AFK');
  click(primary()); await tick();
  // One owner for progress: the Hub status line; the review never repeats it.
  expect(status().textContent).toMatch(applying);
  expect(primary().textContent).toBe('Applying GOM AFK…');
  expect(shown(review())).toBe(false);
  await until(() => review().textContent?.startsWith('Team partly applied. Synthetic interruption'));
  expect([status().textContent, q('.hub-panel')!.getAttribute('data-busy'), primary().textContent]).toEqual(['', 'false', 'Apply team GOM AFK↵']);
  await advance(600);
  expect(status().textContent).toBe('');
  expect(actions()).toEqual(['apply-team']);
});

// HUB-004
test.each(['type', 'close'] as const)('a template folder that loads late never opens over a newer page or a closed Hub (%s)', async moveOn => {
  await mountFixture('&templates-ms=1200');
  await enter('build library');
  expect(caption()).toBe('Build Library');
  // Each key moves the selection asynchronously; read it only after it moved.
  const key = async (name: string) => { const before = selected()[0]?.getAttribute('data-id'); press(name); await until(() => selected()[0]?.getAttribute('data-id') !== before); };
  await key('End');
  for (let step = 0; step < 20 && row('game-templates')?.getAttribute('aria-selected') !== 'true'; step++) await key('ArrowUp');
  expect(row('game-templates')?.getAttribute('aria-selected')).toBe('true');
  press('ArrowRight');
  if (moveOn === 'type') type('sm'); else click(q('.hub-close')!);
  await advance(1600);
  if (moveOn === 'type') expect([caption(), search().value, document.activeElement === search()]).toEqual(['Build Library', 'sm', true]);
  else expect([hubOpen(), document.activeElement === q('#canvas')]).toEqual([false, true]);
});

// HUB-003
test('results that arrive after the query found none get its selection, so Enter acts on them', async () => {
  await mountFixture('&travel-load-ms=800');
  fill(search(), 'travel kam'); await tick();
  expect(primary().textContent).toBe('Select a result');
  await until(() => row('place:449')?.getAttribute('aria-selected') === 'true');
  expect(primary().textContent).toBe('Travel to Kamadan, Jewel of Istan↵');
  press('Enter'); await settle();
  expect([hubOpen(), actions()]).toEqual([false, ['TRAVEL Kamadan, Jewel of Istan']]);
});

// BLD-02
test('a long team apply names counted progress, and a repeated Enter never starts another', async () => {
  await mountFixture('&slow-apply');
  await enter('team gom afk');
  expect([primary().textContent, primary().disabled, q('#hub-results')!.getAttribute('aria-busy')]).toEqual(['Applying GOM AFK…', true, 'true']);
  expect(status().textContent).toMatch(applying);
  press('Enter'); await tick();
  expect(status().textContent).toBe('GOM AFK is still being applied.');
  await advance(600);
  expect(status().textContent).toMatch(applying);
  expect(actions()).toEqual(['apply-team']);
});

// BLD-03
test('a click never moves the selection off a running apply', async () => {
  await mountFixture('&slow-apply');
  await enter('build smiter');
  press('Enter'); await tick();
  expect(primary().textContent).toBe('Applying Smiter…');
  const option = (name: RegExp) => [...document.querySelectorAll<HTMLElement>('#hub [role=option]')].find(element => name.test(text(element) ?? ''))!;
  click(option(/Apply to hero/u)); await tick();
  expect(option(/Apply to me/u).getAttribute('aria-selected')).toBe('true');
  press('Enter'); await tick();
  expect(status().textContent).toBe('Smiter is still being applied.');
  // The page that started it still shows, so the success closes the Hub with its receipt.
  await advance(5000);
  expect(text(receipt())).toBe('Smiter applied to Fixture Monk.');
  expect([hubOpen(), actions()]).toEqual([false, ['apply-build']]);
});

// BLD-04
test('a team apply that fails after the Hub closed is still reported, and the reopened row says so', async () => {
  await mountFixture('&slow-apply');
  scenario('partial');
  await enter('team gom afk');
  await closeHub();
  expect(hubOpen()).toBe(false);
  await advance(5000);
  expect(text(receipt())).toBe('GOM AFK partly applied. Open Hub to review.');
  expect([receipt().getAttribute('data-outcome'), hubOpen(), document.activeElement === q('#canvas')]).toEqual(['failed', false, true]);
  press('Meta+r'); await tick();
  expect(status().textContent).toBe('GOM AFK partly applied. Open Hub to review.');
  fill(search(), 'team gom afk'); await tick();
  expect(text([...document.querySelectorAll('#hub .hub-row')].find(element => element.textContent?.includes('GOM AFK')) ?? null)).toContain('Partly applied · Review');
});

// BLD-06
test('leaving the page of a running apply is never navigated back', async () => {
  await mountFixture('&slow-apply');
  await enter('build smiter');
  press('Enter'); await tick();
  expect(primary().textContent).toBe('Applying Smiter…');
  press('Meta+Backspace'); await tick();
  expect(caption()).toBe('Home');
  // Home is usable while the apply runs elsewhere.
  expect([search().value, primary().textContent]).toEqual(['build smiter', 'Choose target↵']);
  // The restored query lists only Smiter; the full Home lists Travel below the preferred place.
  press('Escape'); await tick();
  expect(search().value).toBe('');
  expect(row('travel')?.getAttribute('aria-selected')).toBe('false');
  while (row('travel')?.getAttribute('aria-selected') !== 'true') press('ArrowDown');
  await tick();
  expect(primary().textContent).toBe('Browse travel↵');
  // The selection was made before the apply finished, so its completion is what is checked.
  await advance(5000);
  expect(status().textContent).toBe('Smiter applied to Fixture Monk.');
  await advance(300);
  expect([hubOpen(), caption(), search().value, document.activeElement === search(), row('travel')?.getAttribute('aria-selected'), selected().length, primary().textContent, actions()])
    .toEqual([true, 'Home', '', true, 'true', 1, 'Browse travel↵', ['apply-build']]);
});

// PTR-35
test('clicks during a running account action never start or retarget a second one', async () => {
  await mountFixture('&accounts-ms=1500');
  await enter('acc s');
  click(primary()); await settle();
  expect([status().textContent, primary().textContent, primary().disabled, document.activeElement === search(), q('#hub-results')!.getAttribute('aria-busy')])
    .toEqual(['Opening Second…', 'Opening Second…', true, true, 'true']);
  const target = [...document.querySelectorAll('#hub .hub-row')].find(element => element.textContent?.includes('Close Main and open Second'))!;
  click(target, 1); click(target, 2); await tick();
  expect(q('#hub .hub-row[data-id$=":open"]')!.getAttribute('aria-selected')).toBe('true');
  await advance(1600);
  expect(hubOpen()).toBe(false);
  expect(actions()).toEqual(['Account Second open']);
});

// HUB-004. The 100 ms reopening budget stays in hub-session.spec.ts.
test('an account open that focuses another window still ends the task, so the next opening starts at Home', async () => {
  await mountFixture('&accounts-ms=1500');
  await enter('acc s');
  expect([caption(), primary().textContent]).toEqual(['Second', 'Open Second↵']);
  click(primary()); await settle();
  expect(status().textContent).toBe('Opening Second…');
  // The opening account takes the focus while the action runs, which suspends this very page.
  window.dispatchEvent(new Event('blur')); await settle();
  expect(hubOpen()).toBe(false);
  await advance(1600);
  expect(actions()).toEqual(['Account Second open']);
  press('Meta+r'); await settle();
  expect([hubOpen(), caption(), search().value, document.activeElement === search(), /Second/u.test(primary().textContent ?? ''), status().textContent])
    .toEqual([true, 'Home', '', true, false, '']);
  expect(actions()).toEqual(['Account Second open']);
  // Control the external account completion: reopening must beat it, not merely wait for it.
  const original = window.gwNative.accounts.open;
  window.gwNative.accounts.open = async request => {
    await new Promise<void>(resolve => { window.addEventListener('finish-account', () => resolve(), { once: true }); });
    return original(request);
  };
  window.gwFixtureCanvas?.clear();
  await enter('acc s'); click(primary()); await settle();
  expect(status().textContent).toBe('Opening Second…');
  press('Escape'); press('Escape'); press('Escape'); await settle();
  expect(hubOpen()).toBe(false);
  press('Meta+r'); await settle();
  fill(search(), 'travel'); await settle();
  press('Enter'); await settle();
  expect(caption()).toBe('Travel');
  const combobox = () => document.querySelector<HTMLInputElement>('[role=combobox][aria-label="Destination, phrase, or friend"], input[aria-label="Destination, phrase, or friend"]')!;
  fill(combobox(), 'kam');
  window.dispatchEvent(new Event('finish-account')); await advance(1600);
  expect(actions()).toEqual(['Account Second open', 'Account Second open']);
  expect([caption(), combobox().value, document.activeElement === combobox()]).toEqual(['Travel', 'kam', true]);
  // The fixture has renderer commands, while main owns the physical Command modifier in Electron.
  expect(window.gwFixtureCanvas?.events).toEqual([{ type: 'keydown', code: 'MetaLeft', repeat: false }]);
});

// PPL-17
test('an invite that fails after the Hub closed names the command, now and on the next opening', async () => {
  await mountFixture('&party&invite-ms=800&invite-fail=Guild Wars chat is not ready');
  await enter('invite Zed Delta');
  await closeHub();
  await advance(1000);
  expect(text(receipt())).toBe('/invite Zed Delta was not sent. Guild Wars chat is not ready.');
  expect(hubOpen()).toBe(false);
  press('Meta+r'); await settle();
  expect(status().textContent).toBe('/invite Zed Delta was not sent. Guild Wars chat is not ready.');
});

// HUB-035
test('a character switch that fails after the Hub closed is reported and reopens on the attempted card', async () => {
  await mountFixture('&switch-fail=logout-refused');
  await enter('char toefte');
  expect(hubOpen()).toBe(false);
  await advance(1200);
  expect(text(receipt())).toBe('Switch to Toefte stopped. Guild Wars did not return to the character selector. Try again.');
  expect(hubOpen()).toBe(false);
  press('Meta+e'); await settle();
  expect(document.activeElement).toBe(q('button[data-character-key="toefte"]'));
  expect(status().textContent).toContain('Switch to Toefte stopped.');
  expect(q('.character-switch-status')?.textContent ?? '').not.toContain('did not return');
});

// HUB-004
test.each([['launcher', 'showLauncher'], ['project website', 'openExternal']] as const)('a delayed %s completion cannot close a newer Hub session', async (query, method) => {
  await mountFixture('');
  Object.defineProperty(window.gwNative.app, method, { configurable: true, value: () => new Promise<void>(resolve => {
    window.addEventListener('integration-app-complete', () => resolve(), { once: true });
  }) });
  await enter(query);
  expect(primary().disabled).toBe(true);
  await closeHub();
  expect(hubOpen()).toBe(false);
  press('Meta+r'); await settle();
  fill(search(), 'travel kam'); await settle();
  window.dispatchEvent(new Event('integration-app-complete')); await advance(50);
  expect([hubOpen(), search().value, document.activeElement === search()]).toEqual([true, 'travel kam', true]);
});

test('a carried failure expires with the existing 90-second Hub resume window', async () => {
  await mountFixture('&party&invite-ms=100&invite-fail=Guild Wars chat is not ready');
  await enter('invite Zed Delta');
  await closeHub();
  await advance(1000);
  expect(text(receipt())).toContain('/invite Zed Delta was not sent.');
  await advance(90_001);
  press('Meta+r'); await settle();
  expect(status().textContent).not.toContain('/invite Zed Delta was not sent.');
});

// HUB-072
test('resolving a Travel failure preserves another owner’s newer receipt', async () => {
  await mountFixture('');
  press('Escape'); await settle();
  window.gwHub!.notify('Travel did not start.', 'failed');
  window.gwHub!.notify('Invite Zed Delta stopped. Try again.', 'failed');
  window.gwHub!.notify('Travel did not start.', 'cleared');
  expect([shown(receipt()), text(receipt())]).toEqual([true, 'Invite Zed Delta stopped. Try again.']);
  press('Meta+r'); await settle();
  expect(status().textContent).toBe('Invite Zed Delta stopped. Try again.');
  window.gwHub!.notify('Invite Zed Delta stopped. Try again.', 'cleared'); await settle();
  expect(status().textContent).toBe('');
});
