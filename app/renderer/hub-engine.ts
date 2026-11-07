/**
 * Owns the Hub's navigation as a pure state machine: the page stack, the query and the one a
 * page returns to, the selection, the open Actions menu, the page session late outcomes belong
 * to, the row action running on it, the suspended page and its resume window (D-11), a failure
 * carried across a close, and what each key means. `hubReduce` takes a
 * state and an event and returns the next state with the effects the adapter (hub.ts) applies:
 * drawing a page, running a row, announcing, and where the keyboard goes as a focus target.
 * Nothing here touches the DOM, so Node tests hold the keyboard contract (docs/hub-contract.md).
 */
import type { HubDestination } from '../shared/hub.js';
import { isHubBackKey } from '../shared/keyboard-shortcuts.js';
import type { HubFocusTarget } from '../shared/ui/hub-view.js';
import { listIndexAfter, listKeyStep } from '../shared/ui/list-keys.js';

/**
 * A suspended page resumes for this long (D-11): a quick trip to another window or a popout
 * returns to it with the query selected; later, the Hub starts fresh at Home. A failure carried
 * across a close expires with it too.
 */
export const HUB_RESUME_MS = 90_000;

/** A key press, as the engine reads it. */
export type HubKey = Readonly<{ key: string; meta: boolean; ctrl: boolean; alt: boolean; shift: boolean; repeat: boolean; composing: boolean }>;
export const hubKey = (event: Readonly<{ key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean; isComposing: boolean }>): HubKey =>
  ({ key: event.key, meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, repeat: event.repeat, composing: event.isComposing });
const plain = (key: HubKey) => !key.meta && !key.ctrl && !key.alt && !key.shift;

type Located = Readonly<{ destination?: HubDestination | undefined }>;
/** What a page shows: a scoped list, a view mounted over it, or neither at Home. */
export type HubPlace<S extends Located, V extends Located> = Readonly<{ scope: S | null; view: V | null }>;
/** A page as Back, a breadcrumb or a resume returns to it. */
export type HubPage<S extends Located, V extends Located> = HubPlace<S, V> & Readonly<{
  query: string; selected: string | null; scroll: number; focus: HubFocusTarget;
}>;
export type HubState<S extends Located, V extends Located> = Readonly<{
  open: boolean;
  place: HubPlace<S, V>;
  /** The pages Back returns to, the nearest last. */
  history: readonly HubPage<S, V>[];
  query: string;
  /** Home's query: a page opened from Home and the ⌘R that returns there bring it back. */
  restoreQuery: string;
  selected: string | null;
  /** The row the current click run selected; only its own double-click runs it (D-24). */
  pressed: string | null;
  /** The open Actions menu: the row it belongs to, or null for a view's footer actions. */
  menu: Readonly<{ row: string | null }> | null;
  /**
   * The page session a running action belongs to (HUB-004). Typing, any page change, closing
   * and suspending end it, so a late completion reports instead of closing or navigating.
   */
  session: number;
  /** The page a blur or another window left, when, and the session that suspension ended. */
  suspended: Readonly<{ page: HubPage<S, V>; at: number; session: number }> | null;
  /**
   * The row or view action that started on `session`: while that session lasts, the footer names
   * it and a repeated Enter answers `again` instead of starting another (HUB-083). A view action
   * keeps where the keyboard was, so a page it opens returns there (HUB-019).
   */
  running: Readonly<{ session: number; label: string; again: string; focus?: HubFocusTarget }> | null;
  /** A failure while the Hub was closed: the next opening within the resume window names it. */
  carried: Readonly<{ message: string; at: number }> | null;
}>;
export const hubInitialState = <S extends Located, V extends Located>(): HubState<S, V> => ({
  open: false, place: { scope: null, view: null }, history: [], query: '', restoreQuery: '',
  selected: null, pressed: null, menu: null, session: 0, suspended: null, running: null, carried: null,
});

/** The facts a key needs from where it was pressed. */
export type HubKeyPlace =
  /** In the Hub search on a list stage: its rows, the rows a page holds, the caret. */
  | Readonly<{ at: 'search'; rows: readonly Readonly<{ id: string; navigate: boolean }>[]; page: number; caretAtEnd: boolean }>
  | Readonly<{ at: 'menu' }>
  /** Anywhere in the Hub: whether a view already answered the press, and whether it sits in an open disclosure. */
  | Readonly<{ at: 'hub'; handled: boolean; disclosure: boolean }>
  /** In a view: whether it names a primary, the press is in a form, and the control activates on Enter itself. */
  | Readonly<{ at: 'view'; primary: boolean; form: boolean; activates: boolean }>;

export type HubEvent<S extends Located, V extends Located> =
  /** ⌘R or a page opening a closed Hub; `fresh` drops a suspended page instead of resuming it. */
  | Readonly<{ type: 'show'; fresh?: boolean }>
  | Readonly<{ type: 'close' }>
  | Readonly<{ type: 'suspend'; scroll: number; focus: HubFocusTarget }>
  | Readonly<{ type: 'home' }>
  /** The query changed: the player typed, or a command example filled it. */
  | Readonly<{ type: 'type'; query: string }>
  /** A new page over the open Hub's page (`remember`), or as the only page of a fresh Hub. */
  | Readonly<{ type: 'enter'; place: HubPlace<S, V>; query?: string; remember: boolean; scroll: number; focus: HubFocusTarget }>
  /** ⌘⌫, the Back button and the mouse back button: exactly one level up, never a close. */
  | Readonly<{ type: 'back' }>
  /** A view's own way out ("Done", leaving Travel): the parent page, or a close where there is none. */
  | Readonly<{ type: 'parent' }>
  /** Escape once the menu, a view's own levels and a disclosure had their say: query, page, then Hub (D-4). */
  | Readonly<{ type: 'escape' }>
  | Readonly<{ type: 'crumb'; index: number }>
  /** A direct shortcut (⌘E, ⌘T, ⌘B, Settings): focus it, return to it, resume it, or open it. */
  | Readonly<{ type: 'direct'; destination: HubDestination }>
  /** Sources changed: pages whose source went away leave the path. */
  | Readonly<{ type: 'withdraw' }>
  | Readonly<{ type: 'select'; id: string | null }>
  /** A click on a row; `count` is the click run's length (event.detail). */
  | Readonly<{ type: 'press'; id: string; count: number; consequential: boolean }>
  | Readonly<{ type: 'context'; id: string }>
  | Readonly<{ type: 'menu'; row: string | null }>
  | Readonly<{ type: 'menu-closed' }>
  | Readonly<{ type: 'key'; key: HubKey; where: HubKeyPlace }>
  /** An action of `session` succeeded; with a receipt it names what it did. */
  | Readonly<{ type: 'done'; session: number; receipt?: string }>
  | Readonly<{ type: 'failed'; session: number; message: string }>
  /**
   * The footer primary, a row's Actions entry or a view's primary asks to run: it runs unless an
   * action of this page still runs, which it names instead (HUB-083).
   */
  | Readonly<{ type: 'activate'; view?: boolean }>
  /** A row or view action starts on this page: `label` names it while it runs, `again` answers a repeated Enter. */
  | Readonly<{ type: 'start'; label: string; again: string; focus?: HubFocusTarget }>
  /** The action that started on `session` ended. */
  | Readonly<{ type: 'end'; session: number }>
  /** A failure while the Hub is closed waits for the next opening. */
  | Readonly<{ type: 'carry'; message: string }>
  /** The failure's own observer resolved it: a waiting failure with this message is withdrawn. */
  | Readonly<{ type: 'uncarry'; message: string }>;

export type HubEffect<S extends Located, V extends Located> =
  | Readonly<{ type: 'home'; focus: HubFocusTarget }>
  /** Draw this page again; its focus target may mount late, so the view waits for it. */
  | Readonly<{ type: 'restore'; page: HubPage<S, V> }>
  /** Resume a suspended page; a page still `mounted` keeps its view, drafts and confirmation (HUB-050). */
  | Readonly<{ type: 'resume'; page: HubPage<S, V>; mounted: boolean }>
  | Readonly<{ type: 'close'; receipt?: string }>
  | Readonly<{ type: 'clear-query'; focus: HubFocusTarget }>
  /** Speak the destination's title once, as the answer to the player's own press. */
  | Readonly<{ type: 'announce' }>
  | Readonly<{ type: 'select'; id: string; scroll?: true; hover: 'hold' | 'release' }>
  | Readonly<{ type: 'focus'; target: HubFocusTarget }>
  | Readonly<{ type: 'run' }>
  | Readonly<{ type: 'navigate' }>
  | Readonly<{ type: 'run-view' }>
  | Readonly<{ type: 'open-menu' }>
  | Readonly<{ type: 'close-disclosure' }>
  /** The direct destination already shows: its search, else its first control, takes the keyboard. */
  | Readonly<{ type: 'focus-page' }>
  /** Open the Hub to resume the suspended path that holds the direct destination. */
  | Readonly<{ type: 'show' }>
  /** Open the direct destination as a new page. */
  | Readonly<{ type: 'open' }>
  | Readonly<{ type: 'refresh' }>
  /** Say this in the status line; a `receipt` outlives the typing that follows it. */
  | Readonly<{ type: 'report'; message: string; receipt?: true }>
  | Readonly<{ type: 'notify'; message: string; failed?: true }>;

export type HubStep<S extends Located, V extends Located> = Readonly<{
  state: HubState<S, V>;
  effects: readonly HubEffect<S, V>[];
  /** The key belongs to the Hub: prevent its default, and with `stop` its propagation. */
  claim?: Readonly<{ stop?: true }>;
}>;
/** What the engine asks the adapter: whether a page's sources still exist, and the time. */
export type HubEnv<S extends Located, V extends Located> = Readonly<{ live(place: HubPlace<S, V>): boolean; now: number }>;

const SEARCH: HubFocusTarget = { zone: 'search' };
const RESULTS: HubFocusTarget = { zone: 'results' };
/** The Hub's fallback: a view's first control, and on a list stage, which shows no view, the search. */
export const HUB_FALLBACK: HubFocusTarget = { zone: 'view' };
export const hubAtHome = (place: HubPlace<Located, Located>) => !place.scope && !place.view;
export const hubDestination = (place: HubPlace<Located, Located>) => place.view ? place.view.destination : place.scope?.destination;
/** Whether an action of `session` still owns the open page and may close or navigate it. */
export const hubTaskLive = (state: HubState<Located, Located>, session: number) => state.open && state.session === session;
/** The row action running on this page, or null once the player moved on or it ended. */
export const hubRunning = (state: HubState<Located, Located>) => state.running && state.running.session === state.session ? state.running : null;
/** Whether the next opening resumes the suspended page: its sources still exist and it is inside the window. */
export const hubResumable = <S extends Located, V extends Located>(state: HubState<S, V>, env: HubEnv<S, V>) =>
  !state.open && !!state.suspended && env.live(state.suspended.page) && env.now - state.suspended.at <= HUB_RESUME_MS;
/** Whether the next opening resumes a suspended path that holds this destination. */
export const hubSuspendedOn = <S extends Located, V extends Located>(state: HubState<S, V>, destination: HubDestination, env: HubEnv<S, V>) =>
  hubResumable(state, env) && [...state.history, state.suspended!.page].some(page => hubDestination(page) === destination);

export function hubReduce<S extends Located, V extends Located>(state: HubState<S, V>, event: HubEvent<S, V>, env: HubEnv<S, V>): HubStep<S, V> {
  type State = HubState<S, V>; type Effect = HubEffect<S, V>;
  const step = (next: State, ...effects: Effect[]): HubStep<S, V> => ({ state: next, effects });
  const leave = (next: State): State => ({ ...next, session: next.session + 1, menu: null, pressed: null });
  const home = (from: State): HubStep<S, V> =>
    step(leave({ ...from, history: [], place: { scope: null, view: null }, query: from.restoreQuery }), { type: 'home', focus: SEARCH });
  /** The parent page: pages whose sources went away are passed over, to Home when none is left. */
  const parent = (from: State): HubStep<S, V> => {
    const history = [...from.history];
    let page = history.pop();
    if (!page) return step(from, { type: 'close' });
    while (!env.live(page)) {
      const next = history.pop();
      if (!next) return home({ ...from, history: [] });
      page = next;
    }
    return step(leave({ ...from, history, place: { scope: page.scope, view: page.view }, query: page.view ? from.query : page.query }), { type: 'restore', page });
  };
  const announced = (result: HubStep<S, V>): HubStep<S, V> =>
    result.state.open && !result.effects.some(effect => effect.type === 'close') ? { ...result, effects: [...result.effects, { type: 'announce' }] } : result;

  switch (event.type) {
    case 'show': {
      if (state.open) return home({ ...state, restoreQuery: hubAtHome(state.place) ? state.query : state.restoreQuery });
      const resume = !event.fresh && hubResumable(state, env) ? state.suspended!.page : null;
      // A task left longer than the resume window starts fresh at Home.
      const opened: State = { ...state, open: true, suspended: null, carried: null, restoreQuery: !event.fresh && state.suspended && !resume ? '' : state.restoreQuery };
      const mounted = !!resume && (resume.view ? resume.view === state.place.view : !state.place.view && resume.scope === state.place.scope);
      const result = !resume ? home(opened)
        : step(mounted ? opened : leave({ ...opened, place: { scope: resume.scope, view: resume.view }, query: resume.view ? state.query : resume.query }), { type: 'resume', page: resume, mounted });
      // A failure from the closed Hub is named on this opening, inside the resume window only.
      const carried = state.carried && env.now - state.carried.at <= HUB_RESUME_MS ? state.carried : null;
      return carried ? { ...result, effects: [...result.effects, { type: 'report', message: carried.message, receipt: true }] } : result;
    }
    case 'close':
      return step(leave({ ...state, open: false, suspended: null, history: [], place: { scope: null, view: null }, query: '', restoreQuery: '', selected: null }));
    case 'suspend':
      if (!state.open) return step(state);
      return step(leave({ ...state, open: false, suspended: { page: { ...state.place, query: state.query, selected: state.selected, scroll: event.scroll, focus: event.focus }, at: env.now, session: state.session } }));
    case 'home': return home(state);
    case 'type': return step({ ...state, query: event.query, session: state.session + 1 });
    case 'enter': {
      const restoreQuery = state.place.scope ? state.restoreQuery : state.query;
      const history = event.remember ? [...state.history, { ...state.place, query: state.query, selected: state.selected, scroll: event.scroll, focus: event.focus }] : state.history;
      return step(leave({ ...state, restoreQuery, history, place: event.place, query: event.query ?? state.query }));
    }
    case 'back':
      if (state.history.length) return announced(parent(state));
      return hubAtHome(state.place) ? step(state) : announced(home(state));
    case 'parent': return parent(state);
    case 'escape':
      if (!state.place.view && state.query) return step({ ...state, query: '', session: state.session + 1 }, { type: 'clear-query', focus: SEARCH });
      return announced(parent(state));
    case 'crumb': return parent({ ...state, history: state.history.slice(0, event.index + 1) });
    case 'direct': {
      if (hubSuspendedOn(state, event.destination, env)) return step(state, { type: 'show' });
      if (state.open) {
        if (hubDestination(state.place) === event.destination) return step(state, { type: 'focus-page' });
        const index = state.history.findIndex(page => hubDestination(page) === event.destination);
        if (index >= 0) return announced(parent({ ...state, history: state.history.slice(0, index + 1) }));
      }
      return step(state, { type: 'open' });
    }
    case 'withdraw': {
      const history = state.history.filter(page => env.live(page));
      let suspended = state.suspended;
      if (suspended && !env.live(suspended.page)) { const page = history.pop(); suspended = page ? { ...suspended, page } : null; }
      const next: State = { ...state, history, suspended };
      if (!next.open) return step(next);
      if (env.live(next.place)) return step(next, { type: 'refresh' });
      return history.length ? parent(next) : home(next);
    }
    case 'select': return step({ ...state, selected: event.id });
    case 'press': {
      if (hubRunning(state)) return step(state);
      // A game-changing row needs the footer or a double-click that began on this identity (D-24).
      if (event.count <= 1) return step({ ...state, pressed: event.id }, { type: 'select', id: event.id, hover: 'hold' }, { type: 'focus', target: RESULTS }, ...(event.consequential ? [] : [{ type: 'run' } as const]));
      return event.count === 2 && event.consequential && state.pressed === event.id && state.selected === event.id ? step(state, { type: 'run' }) : step(state);
    }
    case 'context':
      return hubRunning(state) ? step(state) : step(state, { type: 'select', id: event.id, hover: 'hold' }, { type: 'focus', target: RESULTS }, { type: 'open-menu' });
    case 'menu': return step({ ...state, menu: { row: event.row } });
    case 'menu-closed': return step({ ...state, menu: null });
    case 'key': return key(state, event.key, event.where);
    case 'done':
      if (hubTaskLive(state, event.session) || (!state.open && state.suspended?.session === event.session)) return step(state, { type: 'close', ...(event.receipt ? { receipt: event.receipt } : {}) });
      return event.receipt ? step(state, { type: 'notify', message: event.receipt }) : step(state);
    case 'failed':
      return hubTaskLive(state, event.session) ? step(state, { type: 'report', message: event.message }) : step(state, { type: 'notify', message: event.message, failed: true });
    case 'activate': return activate(state, !!event.view);
    case 'start': return step({ ...state, running: { session: state.session, label: event.label, again: event.again, ...(event.focus ? { focus: event.focus } : {}) } });
    case 'end': return step(state.running?.session === event.session ? { ...state, running: null } : state);
    case 'carry': return step({ ...state, carried: { message: event.message, at: env.now } });
    case 'uncarry': return step(state.carried?.message === event.message ? { ...state, carried: null } : state);
  }

  function activate(from: State, view: boolean): HubStep<S, V> {
    const running = hubRunning(from);
    return running ? step(from, { type: 'report', message: running.again }) : step(from, { type: view ? 'run-view' : 'run' });
  }

  function key(from: State, pressed: HubKey, where: HubKeyPlace): HubStep<S, V> {
    const none = step(from);
    const claimed = (result: HubStep<S, V>, stop = false): HubStep<S, V> => ({ ...result, claim: stop ? { stop: true } : {} });
    switch (where.at) {
      case 'search': {
        if (pressed.composing) return none;
        const listStep = listKeyStep({ key: pressed.key, altKey: pressed.alt, metaKey: pressed.meta, shiftKey: pressed.shift, ctrlKey: pressed.ctrl }, where.page);
        // The list owns these keys even without results, so they never move the caret or drop a text selection.
        if (listStep !== null) {
          if (!where.rows.length || hubRunning(from)) return claimed(none);
          const target = where.rows[listIndexAfter(where.rows.findIndex(row => row.id === from.selected), where.rows.length, listStep)]!;
          return claimed(step(from, { type: 'select', id: target.id, scroll: true, hover: 'release' }));
        }
        if (pressed.key === 'ArrowRight' && !pressed.repeat && where.caretAtEnd) {
          return where.rows.find(row => row.id === from.selected)?.navigate ? claimed(step(from, { type: 'navigate' })) : none;
        }
        // Only a plain Enter runs the named primary; a modified Enter is never a second route to it.
        // While a row action runs, Enter names it instead of starting another (HUB-083).
        if (pressed.key === 'Enter' && plain(pressed)) {
          return claimed(pressed.repeat ? none : activate(from, false));
        }
        return none;
      }
      case 'menu':
        if (pressed.key === 'Escape' && !pressed.composing) return claimed(step({ ...from, menu: null }, { type: 'focus', target: HUB_FALLBACK }), true);
        // Tab leaves the menu to the browser's next control.
        if (pressed.key === 'Tab') return step({ ...from, menu: null });
        return none;
      case 'hub': {
        // ⌘⌫ is Back from any focus inside the Hub, text fields included; ⌫ alone only edits text.
        // A view that stepped out of its own inner level already handled it; the Hub still owns the press.
        if (isHubBackKey({ key: pressed.key, metaKey: pressed.meta, ctrlKey: pressed.ctrl, altKey: pressed.alt, shiftKey: pressed.shift, isComposing: pressed.composing })) {
          if (where.handled) return { ...none, claim: { stop: true } };
          if (pressed.repeat) return claimed(none, true);
          if (from.menu) return claimed(step({ ...from, menu: null }, { type: 'focus', target: HUB_FALLBACK }), true);
          if (where.disclosure) return claimed(step(from, { type: 'close-disclosure' }), true);
          return claimed(hubReduce(from, { type: 'back' }, env), true);
        }
        // ⌘J opens and closes Actions from anywhere in the Hub (D-1).
        if (pressed.key.toLowerCase() === 'j' && pressed.meta && !pressed.ctrl && !pressed.alt && !pressed.shift && !pressed.composing) {
          if (pressed.repeat) return claimed(none, true);
          return claimed(from.menu ? step({ ...from, menu: null }, { type: 'focus', target: HUB_FALLBACK }) : step(from, { type: 'open-menu' }), true);
        }
        return none;
      }
      case 'view':
        // ⌘↵ submits a form from any of its fields: the view's named primary, as Enter in a text field (HUB-152).
        if (pressed.key === 'Enter' && pressed.meta && !pressed.ctrl && !pressed.alt && !pressed.shift && !pressed.composing && where.primary && where.form) {
          return claimed(pressed.repeat ? none : activate(from, true));
        }
        // Enter in a view runs its named primary, except on a control that Enter activates itself;
        // while it runs, Enter names it, as on a list (HUB-083).
        if (pressed.key === 'Enter' && plain(pressed) && !pressed.composing && where.primary && !where.activates) return claimed(activate(from, true));
        return none;
    }
  }
}
