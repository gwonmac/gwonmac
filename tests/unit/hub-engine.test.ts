/**
 * The Hub's keyboard and navigation contract, held by its pure engine (app/renderer/hub-engine.ts).
 * Each case names the Playwright spec (app/ui/tools/tests) whose behaviour it ports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HubDestination } from '../../app/shared/hub.js';
import {
  HUB_RESUME_MS, hubInitialState, hubReduce, hubRunning, hubSuspendedOn,
  type HubEnv, type HubEvent, type HubKey, type HubKeyPlace, type HubPlace, type HubState, type HubStep,
} from '../../app/renderer/hub-engine.js';

type Scope = Readonly<{ title: string; destination?: HubDestination }>;
type View = Readonly<{ title: string; destination?: HubDestination }>;
type State = HubState<Scope, View>;
type Event = HubEvent<Scope, View>;

const travel: Scope = { title: 'Travel', destination: 'travel' };
const builds: Scope = { title: 'Builds', destination: 'builds' };
const settings: View = { title: 'Settings', destination: 'settings' };
const gone = new Set<string>();
const env = (now = 0): HubEnv<Scope, View> => ({ now, live: (place: HubPlace<Scope, View>) => ![place.scope, place.view].some(page => page && gone.has(page.title)) });

const reduce = (state: State, event: Event, now = 0): HubStep<Scope, View> => hubReduce(state, event, env(now));
/** Runs events from a closed Hub and returns the last step. */
function run(events: readonly Event[], from: State = hubInitialState(), now = 0): HubStep<Scope, View> {
  let result: HubStep<Scope, View> = { state: from, effects: [] };
  for (const event of events) result = reduce(result.state, event, now);
  return result;
}
const types = (result: HubStep<Scope, View>) => result.effects.map(effect => effect.type);
const title = (state: State) => state.place.view?.title ?? state.place.scope?.title ?? 'Home';
const key = (name: string, modifiers: Partial<Omit<HubKey, 'key'>> = {}): HubKey =>
  ({ key: name, meta: false, ctrl: false, alt: false, shift: false, repeat: false, composing: false, ...modifiers });
const press = (pressed: HubKey, where: HubKeyPlace): Event => ({ type: 'key', key: pressed, where });
const enter = (place: HubPlace<Scope, View>, query?: string): Event =>
  ({ type: 'enter', place, ...(query === undefined ? {} : { query }), remember: true, scroll: 40, focus: { zone: 'results', range: [0, 0] } });
const rows = (...ids: string[]) => ids.map(id => ({ id, navigate: id.startsWith('nav') }));
const search = (selectedRows = rows('a', 'b', 'c'), facts: Partial<Extract<HubKeyPlace, { at: 'search' }>> = {}): HubKeyPlace =>
  ({ at: 'search', rows: selectedRows, page: 1, caretAtEnd: true, ...facts });
const hub = (facts: Partial<Extract<HubKeyPlace, { at: 'hub' }>> = {}): HubKeyPlace => ({ at: 'hub', handled: false, disclosure: false, ...facts });
const view = (facts: Partial<Extract<HubKeyPlace, { at: 'view' }>> = {}): HubKeyPlace => ({ at: 'view', primary: true, form: false, activates: false, ...facts });
const opened = (...events: Event[]) => run([{ type: 'show' }, ...events]);

// hub-keyboard-model.spec.ts 'consecutive Escapes pop one level each and never close the Hub early (HUB-005)'
// hub.spec.ts 'Esc clears the query, then goes back, then closes onto the game, never <body>'
test('Escape closes the menu, then clears the query, then pops one page, then closes the Hub', () => {
  let result = opened(enter({ scope: travel, view: null }), { type: 'type', query: 'kamadan' }, { type: 'menu', row: 'a' });
  const steps: [string, Event, string[], string, string | null][] = [
    ['menu', press(key('Escape'), { at: 'menu' }), ['focus'], 'Travel', 'kamadan'],
    ['query', { type: 'escape' }, ['clear-query'], 'Travel', ''],
    ['page', { type: 'escape' }, ['restore', 'announce'], 'Home', ''],
    ['hub', { type: 'escape' }, ['close'], 'Home', ''],
  ];
  for (const [layer, event, effects, page, query] of steps) {
    result = reduce(result.state, event);
    assert.deepEqual(types(result), effects, layer);
    assert.equal(title(result.state), page, layer);
    assert.equal(result.state.query, query, layer);
  }
  assert.equal(result.state.menu, null);
});

// hub-keyboard-model.spec.ts 'Escape and Command-Backspace close an open disclosure before they leave its page'
// trade-popout.spec.ts 'Actions is a keyboard menu: ⌘J opens it on its first item and ⌘⌫ closes only the menu (HUB-131)'
test('Command-Backspace closes the menu, then a disclosure, then goes back; Escape in the menu stops there', () => {
  const back = key('Backspace', { meta: true });
  const page = opened(enter({ scope: travel, view: null }), enter({ scope: travel, view: settings }));
  const withMenu = reduce(page.state, { type: 'menu', row: null }).state;
  const cases: [string, State, HubKeyPlace, string[], string, HubStep<Scope, View>['claim']][] = [
    ['menu first', withMenu, hub({ disclosure: true }), ['focus'], 'Settings', { stop: true }],
    ['then the disclosure', page.state, hub({ disclosure: true }), ['close-disclosure'], 'Settings', { stop: true }],
    ['then one page', page.state, hub(), ['restore', 'announce'], 'Travel', { stop: true }],
    ['a view that handled it', page.state, hub({ handled: true }), [], 'Settings', { stop: true }],
    ['a held press', page.state, hub(), [], 'Settings', { stop: true }],
  ];
  for (const [name, state, where, effects, landed, claim] of cases) {
    const result = reduce(state, press(name === 'a held press' ? key('Backspace', { meta: true, repeat: true }) : back, where));
    assert.deepEqual(types(result), effects, name);
    assert.equal(title(result.state), landed, name);
    assert.deepEqual(result.claim, claim, name);
  }
  const escape = reduce(withMenu, press(key('Escape'), { at: 'menu' }));
  assert.deepEqual(escape.claim, { stop: true });
  assert.deepEqual(escape.effects.at(-1), { type: 'focus', target: { zone: 'view' } });
  const tab = reduce(withMenu, press(key('Tab'), { at: 'menu' }));
  assert.deepEqual([types(tab), tab.state.menu, tab.claim], [[], null, undefined]);
});

// hub-navigation-window.spec.ts 'Command-Backspace and breadcrumb ancestors restore history; Backspace only edits text'
// hub-keyboard-model.spec.ts 'Hub Back follows the named key and composition never navigates (KEY-24)'
test('only an unmodified Command-Backspace goes back, from any focus; plain Backspace edits text', () => {
  const page = opened(enter({ scope: travel, view: null })).state;
  const cases: [string, HubKey, boolean][] = [
    ['⌘⌫', key('Backspace', { meta: true }), true],
    ['⌫', key('Backspace'), false],
    ['⌥⌘⌫', key('Backspace', { meta: true, alt: true }), false],
    ['⇧⌘⌫', key('Backspace', { meta: true, shift: true }), false],
    ['⌃⌘⌫', key('Backspace', { meta: true, ctrl: true }), false],
    ['composing ⌘⌫', key('Backspace', { meta: true, composing: true }), false],
  ];
  for (const [name, pressed, back] of cases) {
    const result = reduce(page, press(pressed, hub()));
    assert.equal(title(result.state), back ? 'Home' : 'Travel', name);
    assert.equal(result.claim !== undefined, back, name);
  }
});

// hub-navigation-window.spec.ts 'a page opened directly returns to the real Home, and Home ignores Command-Backspace'
// hub-navigation-window.spec.ts 'the mouse back button at Home does nothing and never closes the Hub (PTR-34)'
test('Back at Home does nothing and never closes; a page opened on a closed Hub goes back to Home', () => {
  const home = opened();
  assert.deepEqual(types(reduce(home.state, { type: 'back' })), []);
  assert.equal(reduce(home.state, { type: 'back' }).state.open, true);
  const direct = run([{ type: 'show', fresh: true }, { type: 'enter', place: { scope: builds, view: null }, remember: false, scroll: 0, focus: { zone: 'results' } }]);
  const back = reduce(direct.state, { type: 'back' });
  assert.deepEqual(types(back), ['home', 'announce']);
  assert.deepEqual(back.effects[0], { type: 'home', focus: { zone: 'search' } });
});

// hub-intent.spec.ts 'a modified Enter never runs the primary; only a plain Enter does'
// hub-session.spec.ts 'a long team apply names counted progress, and a repeated Enter never starts another (BLD-02)'
test('Enter runs the named primary only unmodified and not on a repeat', () => {
  const state = opened().state;
  const cases: [string, HubKey, string[], boolean][] = [
    ['↵', key('Enter'), ['run'], true],
    ['held ↵', key('Enter', { repeat: true }), [], true],
    ['⌘↵', key('Enter', { meta: true }), [], false],
    ['⌃↵', key('Enter', { ctrl: true }), [], false],
    ['⌥↵', key('Enter', { alt: true }), [], false],
    ['⇧↵', key('Enter', { shift: true }), [], false],
    ['composing ↵', key('Enter', { composing: true }), [], false],
  ];
  for (const [name, pressed, effects, claimed] of cases) {
    const result = reduce(state, press(pressed, search()));
    assert.deepEqual(types(result), effects, name);
    assert.equal(result.claim !== undefined, claimed, name);
  }
});

// hub-calculator-polish.spec.ts 'rates accept trading shorthand, command-Enter saves once, and the choice survives reload'
test('Enter in a view runs its primary except on a control Enter activates; ⌘↵ submits a form', () => {
  const state = opened().state;
  const cases: [string, HubKey, HubKeyPlace, string[]][] = [
    ['↵ in a field', key('Enter'), view(), ['run-view']],
    ['↵ on a button', key('Enter'), view({ activates: true }), []],
    ['↵ without a primary', key('Enter'), view({ primary: false }), []],
    ['⌘↵ in a form', key('Enter', { meta: true }), view({ form: true, activates: true }), ['run-view']],
    ['held ⌘↵ in a form', key('Enter', { meta: true, repeat: true }), view({ form: true }), []],
    ['⌘↵ outside a form', key('Enter', { meta: true }), view(), []],
    ['⇧↵ in a field', key('Enter', { shift: true }), view(), []],
  ];
  for (const [name, pressed, where, effects] of cases) assert.deepEqual(types(reduce(state, press(pressed, where))), effects, name);
});

// hub-build-library.spec.ts 'Right Arrow compares current builds without applying, and Back restores the comparison'
// hub-scale-a11y.spec.ts 'a child cue describes the Right Arrow action (HUB-167)'
test('Right Arrow at the end of the query opens a result page, and nothing else', () => {
  const state = reduce(opened().state, { type: 'select', id: 'nav-build' }).state;
  const plainRow = reduce(state, { type: 'select', id: 'a' }).state;
  const cases: [string, State, HubKey, HubKeyPlace, string[]][] = [
    ['a result page', state, key('ArrowRight'), search(rows('a', 'nav-build')), ['navigate']],
    ['caret inside the query', state, key('ArrowRight'), search(rows('a', 'nav-build'), { caretAtEnd: false }), []],
    ['a held Right', state, key('ArrowRight', { repeat: true }), search(rows('a', 'nav-build')), []],
    ['a row without a page', plainRow, key('ArrowRight'), search(rows('a', 'nav-build')), []],
  ];
  for (const [name, from, pressed, where, effects] of cases) assert.deepEqual(types(reduce(from, press(pressed, where))), effects, name);
});

// hub-navigation-window.spec.ts 'one list move keeps focus in search: arrows, Control-N/P, pages and ends never wrap'
// hub-keyboard-model.spec.ts 'Travel moves one selection with the shared list keys and never wraps (HUB-044, HUB-137)'
test('list movement holds at both ends and never wraps', () => {
  const list = rows('a', 'b', 'c', 'd');
  const cases: [string, string | null, HubKey, number, string][] = [
    ['↓ from none', null, key('ArrowDown'), 1, 'a'],
    ['↑ from none', null, key('ArrowUp'), 1, 'a'],
    ['↓', 'b', key('ArrowDown'), 1, 'c'],
    ['↓ at the end', 'd', key('ArrowDown'), 1, 'd'],
    ['↑ at the start', 'a', key('ArrowUp'), 1, 'a'],
    ['⌃N', 'a', key('n', { ctrl: true }), 1, 'b'],
    ['⌃P at the start', 'a', key('p', { ctrl: true }), 1, 'a'],
    ['PageDown past the end', 'b', key('PageDown'), 3, 'd'],
    ['PageUp past the start', 'c', key('PageUp'), 3, 'a'],
    ['End', 'a', key('End'), 1, 'd'],
    ['Home', 'c', key('Home'), 1, 'a'],
  ];
  for (const [name, from, pressed, page, landed] of cases) {
    const result = reduce({ ...opened().state, selected: from }, press(pressed, search(list, { page })));
    assert.deepEqual(result.effects, [{ type: 'select', id: landed, scroll: true, hover: 'release' }], name);
    assert.deepEqual(result.claim, {}, name);
  }
  // The list owns its keys even with no rows or while a row runs, so the caret never moves.
  const running = reduce(opened().state, { type: 'start', label: 'Applying…', again: 'Apply is still running.' }).state;
  for (const [state, facts] of [[opened().state, { rows: [] }], [running, {}]] as const) {
    const result = reduce(state, press(key('ArrowDown'), search(list, facts)));
    assert.deepEqual([types(result), result.claim], [[], {}]);
  }
});

// hub-pointer.spec.ts 'Travel: a click selects a destination and the footer travels once'
// hub-pointer.spec.ts 'a person page\'s world actions only select on a click'
// hub-session.spec.ts 'a click never moves the selection off a running apply (BLD-03)'
test('a consequential row runs only on an explicit activation: a click selects, a double-click that began on it runs', () => {
  const state = opened().state;
  const click = (from: State, id: string, count: number, consequential = true) =>
    reduce(from, { type: 'press', id, count, consequential });
  const running = reduce(state, { type: 'start', label: 'Traveling…', again: 'Travel is still running.' }).state;
  const first = click(state, 'travel-kamadan', 1);
  assert.deepEqual(types(first), ['select', 'focus']);
  assert.equal(first.state.pressed, 'travel-kamadan');
  const selected = reduce(first.state, { type: 'select', id: 'travel-kamadan' }).state;
  const cases: [string, HubStep<Scope, View>, string[]][] = [
    ['a plain row runs on its click', click(state, 'open-trade', 1, false), ['select', 'focus', 'run']],
    ['its own double-click runs', click(selected, 'travel-kamadan', 2), ['run']],
    ['a double-click that began elsewhere', click({ ...selected, pressed: 'travel-lion' }, 'travel-kamadan', 2), []],
    ['a triple-click', click(selected, 'travel-kamadan', 3), []],
    ['a click while a row runs', click(running, 'travel-kamadan', 1), []],
    ['a plain row double-click', click(reduce(state, { type: 'select', id: 'open-trade' }).state, 'open-trade', 2, false), []],
  ];
  for (const [name, result, effects] of cases) assert.deepEqual(types(result), effects, name);
});

// hub-navigation-window.spec.ts 'the mouse back button goes back one level, restores the parent exactly and never runs a row (PTR-33, KEY-26)'
// hub-intent.spec.ts 'temporary blur resumes the stage and focus while explicit close starts fresh'
test('back restores the page with its query, selection, scroll and focus; close starts fresh at Home', () => {
  const left = opened(enter({ scope: travel, view: null }, 'lion'), { type: 'select', id: 'lions-arch' }, enter({ scope: builds, view: null }));
  const back = reduce(left.state, { type: 'back' });
  assert.deepEqual(back.effects[0], {
    type: 'restore', page: { scope: travel, view: null, query: 'lion', selected: 'lions-arch', scroll: 40, focus: { zone: 'results', range: [0, 0] } },
  });
  assert.equal(back.state.query, 'lion');
  const closed = reduce(back.state, { type: 'close' });
  assert.deepEqual([closed.state.open, closed.state.history, closed.state.query, closed.state.selected], [false, [], '', null]);
  assert.deepEqual(reduce(closed.state, { type: 'show' }).effects, [{ type: 'home', focus: { zone: 'search' } }]);
});

// hub-build-library.spec.ts 'a suspended build page cannot resume its withdrawn source or execute stale Apply'
test('Back passes over pages whose source went away, to Home when none is left', () => {
  const deep = opened(enter({ scope: travel, view: null }), enter({ scope: builds, view: null }), enter({ scope: builds, view: settings }));
  gone.add('Builds');
  try {
    const back = reduce(deep.state, { type: 'back' });
    assert.equal(title(back.state), 'Travel');
    gone.add('Travel');
    const home = reduce(deep.state, { type: 'back' });
    assert.deepEqual([types(home), title(home.state), home.state.history], [['restore', 'announce'], 'Home', []]);
    // A page that opened the Hub itself has no Home page below it.
    const direct = run([{ type: 'show', fresh: true }, { type: 'enter', place: { scope: travel, view: null }, remember: false, scroll: 0, focus: { zone: 'results' } }, enter({ scope: builds, view: null })]);
    assert.deepEqual(types(reduce(direct.state, { type: 'back' })), ['home', 'announce']);
  } finally { gone.clear(); }
});

// hub-intent.spec.ts 'temporary blur resumes the stage and focus while explicit close starts fresh'
// hub-keyboard-model.spec.ts 'a view's primary runs once per Enter' and HUB-083 for a view's footer action
test('a view action runs as the page\'s running action: Enter, ⌘↵ and the footer name it until it ends', () => {
  const page = opened(enter({ scope: travel, view: settings })).state;
  const where = { zone: 'view', key: 'settings-save' } as const;
  const started = reduce(page, { type: 'start', label: 'Save', again: 'Save is still running.', focus: where }).state;
  const again = [{ type: 'report', message: 'Save is still running.' }];
  const submit = press(key('Enter', { meta: true }), view({ form: true }));
  const cases: [string, State, Event, unknown[]][] = [
    ['Enter runs the named primary', page, press(key('Enter'), view()), [{ type: 'run-view' }]],
    ['⌘↵ submits the form', page, submit, [{ type: 'run-view' }]],
    ['the footer runs it', page, { type: 'activate', view: true }, [{ type: 'run-view' }]],
    ['Enter while it runs names it', started, press(key('Enter'), view()), again],
    ['⌘↵ while it runs names it', started, submit, again],
    ['the footer while it runs names it', started, { type: 'activate', view: true }, again],
    ['a row Actions entry while it runs names it', started, { type: 'activate' }, again],
    ['after its own end Enter runs again', reduce(started, { type: 'end', session: started.session }).state, press(key('Enter'), view()), [{ type: 'run-view' }]],
  ];
  for (const [name, state, event, effects] of cases) assert.deepEqual(reduce(state, event).effects, effects, name);
  // A page the action opens returns where the keyboard was when it started (HUB-019); a new page ends that.
  assert.deepEqual(hubRunning(started)?.focus, where);
  assert.equal(hubRunning(reduce(started, enter({ scope: builds, view: null })).state), null);
});

// hub-session.spec.ts 'a carried failure expires with the existing 90-second Hub resume window'
test('a suspended page resumes inside the 90-second window, and later the Hub opens fresh at Home', () => {
  const page = opened(enter({ scope: travel, view: null }, 'lion'), { type: 'select', id: 'lions-arch' });
  const suspended = run([{ type: 'suspend', scroll: 12, focus: { zone: 'results', range: [4, 4] } }], page.state, 1_000);
  assert.equal(suspended.state.open, false);
  const cases: [string, number, boolean | undefined, string[]][] = [
    ['inside the window', 1_000 + HUB_RESUME_MS, undefined, ['resume']],
    ['past the window', 1_001 + HUB_RESUME_MS, undefined, ['home']],
    ['a page opening the Hub itself', 1_000, true, ['home']],
  ];
  for (const [name, now, fresh, effects] of cases) {
    const result = reduce(suspended.state, { type: 'show', ...(fresh ? { fresh } : {}) }, now);
    assert.deepEqual(types(result), effects, name);
  }
  const resumed = reduce(suspended.state, { type: 'show' }, 1_000 + HUB_RESUME_MS);
  assert.deepEqual(resumed.effects[0], {
    type: 'resume', mounted: true, page: { scope: travel, view: null, query: 'lion', selected: 'lions-arch', scroll: 12, focus: { zone: 'results', range: [4, 4] } },
  });
  // A Home query expires with the window; ⌘T resumes the suspended Travel instead of opening a second one.
  assert.equal(reduce(suspended.state, { type: 'show' }, 1_001 + HUB_RESUME_MS).state.restoreQuery, '');
  assert.equal(hubSuspendedOn(suspended.state, 'travel', env(1_000)), true);
  assert.deepEqual(types(reduce(suspended.state, { type: 'direct', destination: 'travel' }, 1_000)), ['show']);
  assert.equal(hubSuspendedOn(suspended.state, 'travel', env(1_001 + HUB_RESUME_MS)), false);
});

// hub-session.spec.ts 'a late invite completion never closes or wipes the reopened Hub (PPL-16)'
// hub-session.spec.ts 'delayed Launcher and website completions cannot close a newer Hub session (HUB-004)'
// hub-session.spec.ts 'leaving the page of a running apply is never navigated back (BLD-06)'
// hub-intent.spec.ts 'editing a phrase preserves pin order and a delayed save cannot navigate a later page'
test('a late outcome cannot close or navigate a newer session; it notifies instead', () => {
  const started = opened(enter({ scope: travel, view: null }));
  const session = started.state.session;
  const newer: [string, Event[]][] = [
    ['typing', [{ type: 'type', query: 'k' }]],
    ['back', [{ type: 'back' }]],
    ['another page', [enter({ scope: builds, view: null })]],
    ['close and reopen', [{ type: 'close' }, { type: 'show' }]],
  ];
  for (const [name, events] of newer) {
    const later = run(events, started.state);
    assert.deepEqual(reduce(later.state, { type: 'done', session, receipt: 'Invited Romi' }).effects, [{ type: 'notify', message: 'Invited Romi' }], name);
    assert.deepEqual(reduce(later.state, { type: 'done', session }).effects, [], name);
    assert.deepEqual(reduce(later.state, { type: 'failed', session, message: 'Invite failed' }).effects, [{ type: 'notify', message: 'Invite failed', failed: true }], name);
  }
  assert.deepEqual(reduce(started.state, { type: 'done', session, receipt: 'Invited Romi' }).effects, [{ type: 'close', receipt: 'Invited Romi' }]);
  assert.deepEqual(reduce(started.state, { type: 'failed', session, message: 'Invite failed' }).effects, [{ type: 'report', message: 'Invite failed' }]);
  // A suspension ends the session, yet its own completion still closes the hidden Hub.
  const hidden = reduce(started.state, { type: 'suspend', scroll: 0, focus: { zone: 'results' } }).state;
  assert.deepEqual(types(reduce(hidden, { type: 'done', session })), ['close']);
});

// trade-popout.spec.ts 'Actions is a keyboard menu: ⌘J opens it on its first item and ⌘⌫ closes only the menu (HUB-131)'
test('Command-J toggles Actions from anywhere in the Hub and owns its repeats', () => {
  const state = opened().state;
  const cmdJ = key('j', { meta: true });
  assert.deepEqual(types(reduce(state, press(cmdJ, hub()))), ['open-menu']);
  const withMenu = reduce(state, { type: 'menu', row: 'a' }).state;
  const closed = reduce(withMenu, press(cmdJ, hub()));
  assert.deepEqual([types(closed), closed.state.menu, closed.claim], [['focus'], null, { stop: true }]);
  assert.deepEqual(types(reduce(state, press(key('j', { meta: true, repeat: true }), hub()))), []);
  assert.equal(reduce(state, press(key('j', { meta: true, shift: true }), hub())).claim, undefined);
});

// hub-session.spec.ts 'a long team apply names counted progress, and a repeated Enter never starts another (BLD-02)'
test('a repeated Enter names the running action; the action ends only its own run, and a new page frees Enter', () => {
  const enterKey = press(key('Enter'), search());
  const started = reduce(opened().state, { type: 'start', label: 'Applying GOM AFK…', again: 'GOM AFK is still applying.' });
  const session = started.state.session;
  assert.deepEqual(reduce(started.state, enterKey).effects, [{ type: 'report', message: 'GOM AFK is still applying.' }]);
  assert.deepEqual(types(reduce(started.state, { type: 'context', id: 'a' })), []);
  // Typing starts a new page session: the old action keeps running, but Enter runs the new selection.
  const typed = reduce(started.state, { type: 'type', query: 'kam' }).state;
  assert.deepEqual(types(reduce(typed, enterKey)), ['run']);
  const restarted = reduce(typed, { type: 'start', label: 'Traveling…', again: 'Travel is still running.' }).state;
  assert.equal(reduce(restarted, { type: 'end', session }).state.running?.label, 'Traveling…');
  assert.equal(reduce(started.state, { type: 'end', session }).state.running, null);
});

// hub-keyboard-model.spec.ts 'a view's primary runs once per Enter' and HUB-083 for a view's footer action
test('a view action runs as the page\'s running action: Enter, ⌘↵ and the footer name it until it ends', () => {
  const page = opened(enter({ scope: travel, view: settings })).state;
  const where = { zone: 'view', key: 'settings-save' } as const;
  const started = reduce(page, { type: 'start', label: 'Save', again: 'Save is still running.', focus: where }).state;
  const again = [{ type: 'report', message: 'Save is still running.' }];
  const submit = press(key('Enter', { meta: true }), view({ form: true }));
  const cases: [string, State, Event, unknown[]][] = [
    ['Enter runs the named primary', page, press(key('Enter'), view()), [{ type: 'run-view' }]],
    ['⌘↵ submits the form', page, submit, [{ type: 'run-view' }]],
    ['the footer runs it', page, { type: 'activate', view: true }, [{ type: 'run-view' }]],
    ['Enter while it runs names it', started, press(key('Enter'), view()), again],
    ['⌘↵ while it runs names it', started, submit, again],
    ['the footer while it runs names it', started, { type: 'activate', view: true }, again],
    ['a row Actions entry while it runs names it', started, { type: 'activate' }, again],
    ['after its own end Enter runs again', reduce(started, { type: 'end', session: started.session }).state, press(key('Enter'), view()), [{ type: 'run-view' }]],
  ];
  for (const [name, state, event, effects] of cases) assert.deepEqual(reduce(state, event).effects, effects, name);
  // A page the action opens returns where the keyboard was when it started (HUB-019); a new page ends that.
  assert.deepEqual(hubRunning(started)?.focus, where);
  assert.equal(hubRunning(reduce(started, enter({ scope: builds, view: null })).state), null);
});

// hub-session.spec.ts 'a carried failure expires with the existing 90-second Hub resume window'
test('a failure while the Hub is closed is named on the next opening, within the resume window only', () => {
  const closed = reduce(opened().state, { type: 'close' }).state;
  const carried = reduce(closed, { type: 'carry', message: 'Invite failed' }).state;
  const failure = { type: 'report', message: 'Invite failed', receipt: true };
  const cases: [string, State, number, boolean][] = [
    ['inside the window', carried, HUB_RESUME_MS, true],
    ['after the window', carried, HUB_RESUME_MS + 1, false],
    ['withdrawn by its observer', reduce(carried, { type: 'uncarry', message: 'Invite failed' }).state, 0, false],
    ['another outcome withdrawn', reduce(carried, { type: 'uncarry', message: 'Saved' }).state, 0, true],
  ];
  for (const [name, state, later, named] of cases) {
    const shown = reduce(state, { type: 'show' }, later);
    assert.equal(shown.effects.some(effect => JSON.stringify(effect) === JSON.stringify(failure)), named, name);
    assert.equal(shown.state.carried, null, name);
  }
});
