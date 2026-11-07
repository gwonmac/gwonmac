/**
 * Owns the Core command palette: the sources attached to it, search and its order, the rows'
 * actions, pins and phrases, receipts and transient modal lifetime. It names no source: the
 * built-in ones attach from hub-builtins.ts, the features' from their own owners, and each says
 * what it adds through its HubSource fields (app/shared/hub.ts). Navigation, keys and where the
 * keyboard goes belong to the engine (hub-engine.ts): this adapter turns DOM events into engine
 * events and applies its effects. Optional Tools contributes local results and views without
 * entering Core's imports. The Hub's Vue view (app/ui/tools/src/hub, built as `tools/hub-app.js`)
 * draws the model this adapter keeps (app/shared/ui/hub-view.ts), measures what it draws and puts
 * the keyboard on its focus target. Each entry point (a DOM event, a presenter call, a timer or
 * frame) steps the engine, writes the model and paints it once when it ends; the adapter never
 * paints a half-written model and never measures the DOM.
 */
import { resumeSearchInput } from './search-input.js';
import { installHubWindow } from './hub-window.js';
import { attachClassicFrame } from '../shared/ui/frame.js';
import { resolveShortcuts } from '../shared/keyboard-shortcuts.js';
import { isHubShortcuts, isLibraryHubShortcut, LIBRARY_UNAVAILABLE, type HubShortcut } from '../shared/hub-preferences.js';
import { currencyIcon } from '../shared/currency-assets.js';
import { armConfirmation, closeDisclosure } from './surface-controller.js';
import { composeHubResults, chooseHubSelection } from './hub-results.js';
import { HUB_FALLBACK, hubAtHome, hubInitialState, hubKey, hubReduce, hubRunning, hubSuspendedOn, hubTaskLive, type HubEffect, type HubEvent, type HubPage, type HubPlace, type HubStep } from './hub-engine.js';
import { createHoverSelection } from '../shared/ui/hover-selection.js';
import { FEATURES, featureActivationRequested } from '../shared/feature-contracts.js';
import { HUB_LOCATED_DESTINATIONS, hubMatch, parseHubQuery, normaliseHubQuery, type HubAction, type HubDestination, type HubRow, type HubSource, type HubSummary, type HubTask, type HubViewAction, type HubViewFooter, type HubViewMount } from '../shared/hub.js';
import { hubPrimaryArt, hubRowPaintsSame, type EmbeddedHubView, type HubFocusTarget, type HubLegendEntry, type HubMenuItem, type HubPrimary, type HubViewModel } from '../shared/ui/hub-view.js';

const NONE: readonly never[] = [];
/** Shallow equality: a region with the same fields is the same region and does not redraw. */
function same(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) || Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => Object.is(a[key], b[key]));
}
type Region = { [K in keyof HubViewModel]-?: undefined extends HubViewModel[K] ? never : HubViewModel[K] extends object ? K : never }[keyof HubViewModel];

export function createHub(parent: HTMLElement, embedded: EmbeddedHubView) {
  const document = parent.ownerDocument;
  const model: HubViewModel = {
    page: 'home', back: { hidden: true }, caption: { text: 'Home', current: false }, crumbs: NONE, context: '', summary: null,
    scope: { text: '', hidden: true },
    search: { hidden: false, placeholder: 'Search people, places, builds…', label: 'Search people, places, builds', expanded: true },
    glyphs: { calculation: false, text: '', art: currencyIcon },
    results: { hidden: false, previewList: false, rows: NONE, painted: 0, selected: null, compact: false, bindings: resolveShortcuts({}), more: () => { if (painting) paintThrough(painting.next + PAINT_CHUNK - 1); } },
    empty: { hidden: true }, preview: { text: '', hidden: true }, view: { hidden: true },
    lifecycle: { text: '', hidden: true }, hint: { text: '', hidden: true }, announce: '', count: '',
    actions: { keys: false, disabled: false, expanded: false },
    menu: { hidden: true, items: NONE },
    receipt: { text: '', announcement: '', hidden: true },
  };
  const ui = embedded.mountHubView(parent, model);
  const { root, panel, heading, lock, resize, back: backButton, close: closeButton, input, results: list, view: content, primary, actions: actionsButton, menu } = ui.elements;
  let dirty = false, drawing = false, queued = false, disposed = false, depth = 0;
  /** Draws the model's changes: once at the end of each entry point, and before the DOM goes to code outside the Hub. */
  function sync() {
    if (!dirty || drawing || disposed) return;
    drawing = true;
    try { while (dirty) { dirty = false; ui.paint(model); } } finally { drawing = false; }
  }
  /**
   * An entry point: a DOM event, a presenter call, a timer or a frame. It paints once when the
   * outermost one ends, so a source that notifies while the Hub composes its results never
   * draws half of them.
   */
  const entry = <A extends unknown[], R>(action: (...args: A) => R) => (...args: A): R => {
    depth++;
    try { return action(...args); } finally { if (--depth === 0) sync(); }
  };
  /**
   * Hands the DOM to code outside the Hub (a row's or a view's action, a page mounting): the
   * finished model is drawn first, and a presenter call that code makes paints when it returns.
   */
  function callOut<R>(action: () => R): R {
    sync();
    const outer = depth; depth = 0;
    try { return action(); } finally { depth = outer; }
  }
  function put<K extends keyof HubViewModel>(key: K, value: HubViewModel[K]) {
    if (same(model[key], value)) return;
    model[key] = value; dirty = true;
    // A change outside any entry point, after an action's await, paints at the end of its microtask.
    if (!queued && depth === 0) { queued = true; queueMicrotask(entry(() => { queued = false; })); }
  }
  const patch = <K extends Region>(key: K, fields: Partial<HubViewModel[K]>) => put(key, { ...model[key], ...fields });
  let focusSeq = 0;
  /** Puts the keyboard on a focus target: the view applies it after this entry's paint, so a control it just showed can take it. */
  function requestFocus(target: HubFocusTarget, options: Readonly<{ wait?: true; select?: true }> = {}) { put('focus', { ...target, seq: ++focusSeq, ...options }); }
  let revealSeq = 0, scrollSeq = 0;
  let receiptTimer: ReturnType<typeof setTimeout> | undefined;
  // Where the Hub frame last stood: a receipt after closing appears in its footprint, not as a window toast.
  let frame: ReturnType<typeof ui.layout.frame> | null = null;
  const disposeFrame = attachClassicFrame(panel);
  const hubWindow = installHubWindow(panel, heading, lock, resize);
  // A measuring layer adds artwork in native word gaps; the input remains the sole editor (HubSearchBar).
  function paintGlyphs() {
    const calculation = root.open && !state.place.view && !state.place.scope && !parseHubQuery(state.query).scope && /^\s*(?:\d|\.\d)/u.test(state.query);
    patch('glyphs', { calculation, text: calculation ? state.query : '' });
  }
  let announceTimer: ReturnType<typeof setTimeout> | undefined;
  let resultAnnouncement = '';
  let rows: readonly HubRow[] = [];
  let bindings = model.results.bindings;
  let shortcutRevision = '';
  let navigationRevision = '';
  /** The query found no results yet; results that arrive for it later, e.g. from a loading source, get its initial selection. */
  let awaitingResults = false;
  const sources = new Map<HubSource, () => void>();
  /** A source counts while its feature is turned on, by the feature's own activation rule (app/features). */
  const sourceEnabled = (source: HubSource) => {
    if (!source.feature) return true;
    const feature = FEATURES.find(candidate => candidate.activation.setting === source.feature);
    return !!feature && featureActivationRequested(feature.id, window.gwToolsSettings?.() ?? {});
  };
  const enabledSources = () => [...sources.keys()].filter(sourceEnabled);
  /** The cards of the sources turned on, and whether a row is one of theirs. */
  const cards = () => enabledSources().flatMap(source => source.card ? [source.card] : []);
  type RowScope = Readonly<{ title: string; rows: () => readonly HubRow[]; summary?: HubSummary; destination?: HubDestination; owner?: HubSource }>;
  type MountedView = { title: string; mount: HubViewMount<HTMLElement>; available?: () => boolean; destination?: HubDestination; owner?: HubSource };
  type Place = HubPlace<RowScope, MountedView>;
  type Page = HubPage<RowScope, MountedView>;
  /**
   * The page stack, query, selection, menu, session, running action, carried failure and
   * suspended page: the engine's, never copied here. After each step the search shows the
   * engine's query and a menu the engine closed is drawn closed.
   */
  let state = hubInitialState<RowScope, MountedView>();
  /** The mounted view's footer: its named primary and secondary. */
  type ViewFooter = { primary: HubViewAction | null; secondary: HubViewAction | null };
  let viewFooter: ViewFooter | null = null;
  let viewRunning = false;
  let viewArming: { label: string; arming: ReturnType<typeof armConfirmation> } | null = null;
  let disposeView: (() => void) | null = null;
  /** The search names what it searches, as placeholder and accessible name alike (HUB-096). */
  const nameSearch = (page: string | null) => {
    const content = page === null ? null : [...sources.keys()].map(source => source.searchNames?.[page]).find(Boolean);
    const name = content ? `Search ${content}…` : page ? `Search in ${page}…` : 'Search people, places, builds…';
    patch('search', { placeholder: name, label: name });
  };
  /** Where the keyboard was when the running view action started: a page it opens returns there (HUB-019). */
  let actionFocus: HubFocusTarget | null = null;
  /** Where the keyboard is, as the target a page returns to. */
  const focusTarget = () => actionFocus ?? ui.focus.capture();
  const pageTitle = (page: Place) => page.view?.title ?? page.scope?.title ?? 'Home';
  const sourceLive = (owner: HubSource) => sources.has(owner) && sourceEnabled(owner);
  const pageLive = (page: Place) =>
    (!page.scope?.owner || sourceLive(page.scope.owner))
    && (!page.view?.owner || sourceLive(page.view.owner))
    && (!page.view?.available || page.view.available());
  const env = () => ({ live: pageLive, now: Date.now() });
  /** Takes one engine step; the caller applies its effects once its own steps are done. */
  function step(event: HubEvent<RowScope, MountedView>): HubStep<RowScope, MountedView> {
    const next = hubReduce(state, event, env());
    state = next.state;
    if (input.value !== state.query) input.value = state.query;
    if (!state.menu && !model.menu.hidden) { patch('menu', { hidden: true, items: NONE }); patch('actions', { expanded: false }); }
    return next;
  }
  /** What an effect needs from the DOM event that caused it, and a direct destination's way to open. */
  type Cause = Readonly<{ event?: Event; open?: () => void }>;
  const send = (event: HubEvent<RowScope, MountedView>, cause: Cause = {}) => apply(step(event), cause);
  function apply(next: HubStep<RowScope, MountedView>, cause: Cause = {}) {
    if (next.claim && cause.event) { cause.event.preventDefault(); if (next.claim.stop) cause.event.stopPropagation(); }
    for (const effect of next.effects) perform(effect, cause);
  }
  function perform(effect: HubEffect<RowScope, MountedView>, cause: Cause) {
    switch (effect.type) {
      case 'home': drawHome(effect.focus); return;
      case 'restore': restorePage(effect.page); return;
      case 'resume': resumePage(effect.page, effect.mounted); return;
      case 'close': close(effect.receipt); return;
      case 'clear-query': report(''); refresh(true); requestFocus(effect.focus); return;
      case 'announce': announceDestination(); return;
      case 'select': if (effect.hover === 'hold') hover.hold(); else hover.release(); select(effect.id, !!effect.scroll); return;
      case 'focus': requestFocus(effect.target); return;
      case 'run': void run(); return;
      case 'navigate': { const row = rows.find(row => row.id === state.selected); if (row?.navigate) { const task = startTask(); callOut(() => row.navigate?.(task)); } return; }
      case 'run-view': void runViewAction(viewFooter?.primary ?? null, cause.event); return;
      case 'open-menu': openMenu(); return;
      case 'close-disclosure': closeDisclosure(cause.event?.target ?? null, root); return;
      case 'focus-page': focusPage(); return;
      case 'show': show(); return;
      case 'open': cause.open?.(); return;
      case 'refresh': refresh(); return;
      case 'report': report(effect.message, effect.receipt); return;
      case 'notify': notify(effect.message, effect.failed ? 'failed' : undefined); return;
    }
  }
  /** Withdraw only pages whose actual source is unavailable; other drafts and searches stay. */
  const withdrawPages = () => send({ type: 'withdraw' });
  /**
   * Form drafts last the session, keyed by page path and the field's focus key: leaving a form
   * keeps what was typed and returning restores it, unless the stored value the field started
   * from changed. The view reads and writes the fields (HubDraftFields).
   */
  const drafts = new Map<string, { initial: string; value: string }>();
  const draftInitials = new Map<string, string>();
  let draftPage: string | null = null;
  function restoreDrafts(path: string) {
    draftPage = path; draftInitials.clear();
    for (const [field, value] of ui.drafts.read()) {
      const key = `${path} › ${field}`, draft = drafts.get(key);
      draftInitials.set(key, value);
      if (draft && draft.initial !== value) drafts.delete(key);
      else if (draft) ui.drafts.write(field, draft.value);
    }
  }
  function keepDrafts() {
    if (draftPage === null) return;
    for (const [field, value] of ui.drafts.read()) {
      const key = `${draftPage} › ${field}`, initial = draftInitials.get(key) ?? value;
      if (value === initial) drafts.delete(key); else drafts.set(key, { initial, value });
    }
    draftPage = null;
  }
  /** Draws a page Back, a breadcrumb or a resume returns to; the engine already stands on it. */
  function restorePage(page: Page, resumed?: true) {
    resetView();
    if (page.view) mountView(page.view);
    else {
      patch('caption', { text: page.scope?.title ?? 'Home' }); put('page', page.scope ? 'section' : 'home');
      nameSearch(page.scope?.title ?? null); report(''); refresh(true);
      // A card that changed state while the page was away still stands for the row it showed.
      const card = cards().find(candidate => candidate.restores.includes(page.selected ?? ''));
      const restored = rows.find(row => row.id === page.selected) ?? (card ? rows.find(row => row.group === card.group) : undefined);
      select(restored?.id??null); patch('results', { scroll: { top: page.scroll, seq: ++scrollSeq } });
      if (page.selected && state.selected === null) report('The previous selection is no longer available. Choose a result.');
    }
    // A view that loads late (Settings) still gives the keyboard back to the control it held.
    requestFocus(page.focus, { wait: true, ...(resumed ? { select: resumed } : {}) });
  }
  /**
   * A view's own way out ("Done", Travel or Characters leaving): the parent page, or a close
   * where there is none. A page opened directly by its shortcut has no artificial Home step.
   */
  const restoreParent = () => send({ type: 'parent' });
  let previousFocus: HTMLElement | null = null;
  /** A row action runs on this page; the footer and status name it until it ends (HUB-083). */
  const busy = () => !!hubRunning(state);
  /** A late task's receipt outlives the typing that ended its session; any other report replaces it. */
  let receiptInStatus = false;
  /**
   * The latest progress of a running action, on its page or left behind by Back, typing or a
   * close (KEY-19). The status line falls back to it, busy, whenever it has nothing newer to say.
   */
  let progress: { owner: object; message: string } | null = null;
  let progressInStatus = false;
  const statusText = () => model.status?.text ?? '';
  function report(message: string, receipt = false) {
    const text = message || progress?.message || '';
    receiptInStatus = receipt && !!message; progressInStatus = !message && !!text;
    put('status', { text, busy: progressInStatus }); paintBusy();
  }
  /** The rows sources leave the Hub to match: they follow every result (HubSource `commands`). */
  const commandRows = (query = state.query) => enabledSources().flatMap(source => source.commands?.(query) ?? []);
  const shortcuts = () => [...(window.gwToolsSettings?.().hubShortcuts ?? []), ...enabledSources().flatMap(source => source.shortcuts?.get() ?? [])];
  const lookup = (id: string): HubRow | undefined => enabledSources().map(source => source.lookup?.(id)).find(Boolean)
    ?? commandRows().find(row => row.id === id);
  /**
   * The other result a root search for this phrase already finds by its exact name or alias. A
   * search phrase equal to it would hide it or make both ambiguous, so the editor refuses it (HUB-062).
   */
  function exactlyNamed(phrase: string, id: string): HubRow | undefined {
    const found = [...enabledSources().flatMap(source => source.search(phrase)), ...commandRows(phrase)];
    return found.find(row => row.id !== id && hubMatch(row.title, phrase, row.aliases) === 'exact');
  }
  const shortcutStore = { get: () => shortcuts(), lookup, save: saveShortcuts, exactlyNamed };
  async function saveShortcuts(value: readonly HubShortcut[]) {
    const privateEntries = value.filter(entry => isLibraryHubShortcut(entry.id));
    const globalEntries = value.filter(entry => !isLibraryHubShortcut(entry.id));
    if (!isHubShortcuts(privateEntries) || !isHubShortcuts(globalEntries)) throw new Error('Invalid Hub shortcuts');
    const owner = [...sources.keys()].find(source => sourceEnabled(source) && source.shortcuts);
    if (owner?.shortcuts && JSON.stringify(privateEntries) !== JSON.stringify(owner.shortcuts.get())) await owner.shortcuts.save(privateEntries);
    else if (privateEntries.length && !owner) throw new Error(LIBRARY_UNAVAILABLE);
    if (JSON.stringify(globalEntries) !== JSON.stringify(window.gwToolsSettings?.().hubShortcuts ?? [])) await window.gwNative.settings.set({ hubShortcuts: globalEntries });
    refresh();
  }
  function select(id: string | null, scroll = false) {
    const index = painting && id !== null ? painting.rows.findIndex(row => row.id === id) : -1;
    if (painting && index >= painting.next) paintThrough(index);
    step({ type: 'select', id });
    patch('results', { selected: id });
    const position = id === null ? -1 : rows.findIndex(row => row.id === id);
    const row = position >= 0 ? rows[position] : undefined;
    if (row) {
      patch('search', { activeDescendant: `hub-result-${position}` });
      if (scroll) patch('results', { reveal: { id: row.id, seq: ++revealSeq } });
    }

    if (!row) patch('search', { activeDescendant: undefined });
    patch('preview', { text: row?.preview ?? '', hidden: !row?.preview || !!state.place.view });
    // A row action that opened a view ends here: the view names the footer now.
    if (viewFooter) { paintViewFooter(); return; }
    // A running action keeps the footer: it names what runs, disabled, until it ends (HUB-083).
    const working = hubRunning(state);
    const art = !working ? hubPrimaryArt(row) : undefined;
    setPrimary({ label: working ? working.label : row ? row.action : 'Select a result', ...(art ? { art } : {}), keycap: !!row && !working,
      disabled: !row || !!row.unavailable || !!working, variant: row?.destructive ? 'danger' : 'primary' });
    // Footer slots never hide, so nothing slides under a resting pointer; they disable instead.
    // Actions opens only where it lists more than the primary (HUB-043).
    setActions(!row || !!working || menuEntries(row).length < 2);
    if (state.menu && state.menu.row !== row?.id) closeMenu(false);
    paintLegend(row);
    paintBusy();
  }
  /**
   * The primary names its action on one line; a long name ends in … and shows whole on hover (HUB-238).
   * A footer slot disables instead of hiding; under the keyboard, the footer's focus zone hands it
   * to search or the view, never to <body>.
   */
  const setPrimary = (next: HubPrimary) => put('primary', next);
  /** Actions names its key, ⌘J; it disables like the primary. */
  const setActions = (disabled: boolean) => patch('actions', { keys: true, disabled });
  /** `aria-busy` and the thin bar under the search while this page's action runs or the status line shows progress. */
  function paintBusy() {
    const working = busy() || ((viewRunning || viewFooter?.primary?.running) && !!viewFooter) || progressInStatus;
    put('busy', { panel: working, list: busy(), view: !!(viewRunning || viewFooter?.primary?.running) && !!viewFooter });
  }
  /** The footer's key legend names only keys that act here and now. */
  function paintLegend(row: HubRow | undefined) {
    const keys: HubLegendEntry[] = [];
    if (!viewFooter && rows.length > 1 && !busy()) keys.push([['↑', '↓'], 'Select']);
    if (!viewFooter && row?.navigate) keys.push([['→'], 'Open']);
    // A list stage types into the Hub search; a view mounted here, into its own search, if any.
    const typed = viewFooter ? !!disposeView && !!ui.focus.searchField()?.value : !!state.query;
    keys.push([['⎋'], typed ? 'Clear' : state.history.length ? 'Back' : 'Close']);
    if (!atHome()) keys.push([['⌘', '⌫'], 'Back']);
    if (model.legend && JSON.stringify(model.legend) === JSON.stringify(keys)) return;
    put('legend', keys);
  }
  /** "Done" steps back; it is the primary of a view that names none, so the footer never goes blank. */
  const done: HubViewAction = { label: 'Done', run: () => restoreParent() };
  function paintViewFooter() {
    if (!viewFooter) return;
    const action = viewFooter.primary ?? done;
    // Enter runs a named primary, so only that one carries the keycap, and not while it runs.
    setPrimary({ label: action.label, keycap: !!viewFooter.primary && !viewRunning && !action.running,
      disabled: !!action.disabled || viewRunning || !!action.running, variant: action.destructive ? 'danger' : 'primary' });
    if (!action.armed) { viewArming?.arming.disarm(); viewArming = null; }
    else if (viewArming?.label !== action.label) {
      viewArming?.arming.disarm(); viewArming = { label: action.label, arming: armConfirmation(primary) }; viewArming.arming.arm();
    }
    // A footer update invalidates menu snapshots before their actions can be activated.
    closeMenu(false);
    setActions(!viewFooter.secondary || viewRunning);
    put('count', '');
    paintLegend(undefined);
    paintBusy();
  }
  /** Runs a view's footer action once; an armed primary refuses anything before it arms and any multi-click. */
  async function runViewAction(action: HubViewAction | null, event?: Event) {
    const current = viewFooter;
    if (!current || !action || action.disabled || viewRunning) return;
    if (action.armed && !viewArming?.arming.accepts(event)) return;
    const task = startTask();
    // The footer slot disables while its action runs; a page the action opens still returns to it.
    actionFocus = focusTarget();
    viewRunning = true; report(''); paintViewFooter();
    try { await callOut(() => action.run(task)); }
    catch (error) { task.fail(error); }
    finally { task.end(); if (viewFooter === current) { actionFocus = null; viewRunning = false; paintViewFooter(); } }
  }
  const hover = createHoverSelection();
  const pointerRow = (event: Event) => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('.hub-row') : null;
    return node && list.contains(node) ? rows.find(row => row.id === node.dataset.id) : undefined;
  };
  /** A press or key on the Price basis picker belongs to the picker, not to its row. */
  const onRates = (event: Event) => event.target instanceof Element && !!event.target.closest('.hub-rate-controls');
  // Delegated events always resolve the current row, including after its DOM was retained.
  list.addEventListener('pointermove', entry((event: PointerEvent) => {
    const row = pointerRow(event); if (row && !busy() && hover.selects(event) && row.id !== state.selected) select(row.id);
  }));
  // A click selects; a game-changing row runs only from the footer or a double-click on itself (D-24).
  list.addEventListener('click', entry((event: MouseEvent) => {
    if (onRates(event)) return;
    const row = pointerRow(event); if (!row) return;
    send({ type: 'press', id: row.id, count: event.detail, consequential: !!row.consequential });
  }));
  list.addEventListener('contextmenu', entry((event: MouseEvent) => {
    if (onRates(event)) return;
    const row = pointerRow(event); if (!row) return;
    event.preventDefault();
    send({ type: 'context', id: row.id });
  }));
  // Enter on the picker copies the card it prices, as Enter on the search does (HUB-022).
  list.addEventListener('keydown', entry((event: KeyboardEvent) => {
    if (!onRates(event) || !(event.target instanceof HTMLSelectElement)) return;
    if (event.key === 'Enter' && !event.repeat && !event.isComposing && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) { event.preventDefault(); void run(); }
  }));
  // Source notifications change context and lifecycle facts, not the current page or search.
  function paintSourceFacts() {
    const view = state.place.view;
    const located = view ? !!view.destination && HUB_LOCATED_DESTINATIONS.includes(view.destination) : !state.place.scope && !state.query.trim();
    const context = located ? enabledSources().flatMap(source => source.context?.() ?? []) : [];
    put('context', context.join(' · '));
    const lifecycleText = state.place.view ? '' : enabledSources().map(source => source.lifecycle?.()).find(Boolean) ?? '';
    patch('lifecycle', { text: lifecycleText, hidden: !lifecycleText, ...((model.lifecycle.title ?? '') !== lifecycleText ? { title: lifecycleText } : {}) });
  }
  function paintNavigation() {
    const summary = state.place.view ? undefined : state.place.scope?.summary;
    put('summary', summary ?? null);
    const currentTitle = pageTitle(state.place);
    patch('caption', { text: currentTitle });
    paintSourceFacts();
    const trail = state.history.map((page, index) => ({ title: pageTitle(page), index }));
    const nextNavigation = JSON.stringify([trail, currentTitle]);
    if (navigationRevision !== nextNavigation) {
      navigationRevision = nextNavigation;
      put('crumbs', trail.map(page => ({ title: page.title, open: entry(() => send({ type: 'crumb', index: page.index })) })));
      patch('caption', { current: true });
    }
    const parent = state.history.at(-1);
    patch('back', { hidden: atHome(), destination: parent ? pageTitle(parent) : 'Home' });
    const query = parseHubQuery(state.query);
    put('scope', { text: query.scope ?? '', hidden: !!state.place.scope || !query.scope || !!state.place.view || commandRows().some(row => normaliseHubQuery(row.title) === normaliseHubQuery(state.query)) });
    // The page title leads, so a screen reader that lands in search after Back hears where it is.
    patch('search', { description: `${currentTitle}: ${state.place.scope ? 'search actions' : query.scope ? `search ${query.scope}` : 'search tools or use a command example'}` });
    const hint = !state.place.scope && !query.scope && state.query.trim() ? enabledSources().map(source => source.hint?.(state.query)).find(Boolean) ?? '' : '';
    put('hint', { text: hint, title: hint, hidden: !hint || !!state.place.view });
  }
  /**
   * A long list paints its first rows at once and the rest one chunk per frame, so a 1000-build
   * Library opens within one frame budget (HUB-112). Selection, End and a restored scroll position
   * paint through the rows they need first, so no row height is ever guessed.
   */
  // Ten rich build rows leave time for their style and layout work in the same frame.
  const PAINT_CHUNK = 10;
  type Painting = { rows: readonly HubRow[]; next: number; frame: number };
  let painting: Painting | null = null;
  function stopPainting() { if (painting) cancelAnimationFrame(painting.frame); painting = null; }
  function startPainting(next: readonly HubRow[]) {
    // A row already in the DOM that stays in the list paints now, so narrowing never unmounts it
    // for a frame: its node, and a pointer action aimed at it, survive (HUB-170).
    const mounted = new Set(model.results.rows.slice(0, model.results.painted).map(row => row.id));
    stopPainting(); patch('results', { rows: next, painted: 0 });
    painting = { rows: next, next: 0, frame: 0 };
    let through = PAINT_CHUNK - 1;
    next.forEach((row, index) => { if (mounted.has(row.id)) through = Math.max(through, index); });
    paintThrough(through);
  }
  /** Paints every row up to this index now and leaves the rest to the next frame. */
  function paintThrough(index: number) {
    const job = painting;
    if (!job) return;
    cancelAnimationFrame(job.frame);
    job.next = Math.max(job.next, Math.min(index + 1, job.rows.length));
    patch('results', { painted: job.next });
    if (job.next >= job.rows.length) painting = null;
    else job.frame = requestAnimationFrame(entry(() => paintThrough(job.next + PAINT_CHUNK - 1)));
  }
  let refreshFrame = 0;
  function scheduleRefresh() {
    if (!root.open || refreshFrame) return;
    refreshFrame = requestAnimationFrame(entry(() => { refreshFrame = 0; refresh(); }));
  }
  function refresh(reset = false) {
    // An immediate query or opening already consumes all facts queued by source notifications.
    cancelAnimationFrame(refreshFrame); refreshFrame = 0;
    paintGlyphs();
    if (!root.open) return;
    // A mounted view keeps its header facts current, e.g. where the player is.
    if (state.place.view) { paintNavigation(); return; }
    if (reset) hover.release();
    paintNavigation();
    const previousRows = rows;
    const scoped = !!state.place.scope;
    const found = state.place.scope ? state.place.scope.rows() : enabledSources().flatMap(source => source.search(state.query));
    const composed = composeHubResults({ scoped, query: state.query, found, shortcuts: shortcuts(), lookup, commands: commandRows(), cards: cards() });
    rows = composed.rows;
    const message = composed.count;
    put('count', message === 'No matches' ? '' : message);
    patch('empty', { hidden: rows.length > 0 }); patch('results', { hidden: !rows.length });
    patch('search', { expanded: rows.length > 0 });
    if (reset || message !== resultAnnouncement) {
      clearTimeout(announceTimer); resultAnnouncement = message;
      if (message) announceTimer = setTimeout(entry(() => {
        if (root.open && !state.place.view && model.announce !== message) put('announce', message);
      }), 500);
    }
    const nextBindings = resolveShortcuts(window.gwToolsSettings?.().shortcutOverrides ?? {});
    const nextShortcutRevision = JSON.stringify(nextBindings);
    const shortcutsChanged = shortcutRevision !== nextShortcutRevision;
    shortcutRevision = nextShortcutRevision;
    if (shortcutsChanged) bindings = nextBindings;
    // Keep mounted options steady when an observer only advances its sequence.
    // Actions still read the newly derived rows, so no stale closure can execute.
    if (!reset && !shortcutsChanged && rows.length === previousRows.length && rows.every((row, index) => hubRowPaintsSame(row, previousRows[index]))) {
      if (painting) painting.rows = rows;
      patch('results', { rows }); select(state.selected); return;
    }
    // The rebuilt list keeps the reader's place: the list paints the rows down to it (HubResultList).
    const compactBuilds = !scoped && !state.query.trim();
    // Reserve the preview from the complete result set, before deferred rows reach the DOM.
    patch('results', { previewList: !compactBuilds && rows.some(row => !!row.preview), compact: compactBuilds, bindings });
    startPainting(rows);
    const chosen = chooseHubSelection({ scoped, query: state.query, rows, phrases: composed.phrases, previous: previousRows, selected: state.selected,
      reset, awaiting: awaitingResults, cards: cards(), status: { text: statusText(), receipt: receiptInStatus } });
    awaitingResults = chosen.awaiting;
    // A settled loading refusal clears before the selection paints; a lost selection is named after it.
    if (chosen.report === '') report('');
    select(chosen.selected);
    if (chosen.report) report(chosen.report);
  }
  /**
   * Binds an action to the page session that starts it (HUB-004). While that page shows, the
   * action reports progress and failures in the status line and its success closes the Hub with
   * the receipt. After the player moved on, it never navigates: its progress stays in the status
   * line, and it ends with a receipt or a failure receipt (the engine's `done` and `failed`).
   * An action that focuses another window (Open an account, Show Launcher) suspends its own
   * page; its success still ends the task, so the next opening starts at Home.
   */
  function startTask(): HubTask & { fail(error: unknown): void; end(): void } {
    const started = state.session;
    const live = () => hubTaskLive(state, started);
    const token = {};
    return {
      live,
      // Progress repaints only over itself or an empty line (or on its own page): a newer
      // message, e.g. a refusal or another action's failure, stays until the next report('').
      progress: entry((message: string) => { progress = { owner: token, message }; if (live() || progressInStatus || !statusText()) report(''); }),
      done: entry((receipt?: string) => send({ type: 'done', session: started, ...(receipt ? { receipt } : {}) })),
      fail: entry((error: unknown) => {
        // A step the player declined, e.g. Stay here on "Leave this area?", is no failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        send({ type: 'failed', session: started, message: error instanceof Error ? error.message : 'The action could not complete. Try again.' });
      }),
      // An action that ended without a receipt, e.g. one whose view shows its own outcome, never leaves its progress behind.
      end: entry(() => { if (progress?.owner !== token) return; progress = null; if (progressInStatus) report(''); }),
    };
  }
  /** Runs the selected row's primary, or one of its Actions (HubRow `actions`), as a task of this page. */
  async function run(chosen?: HubAction) {
    const row = chosen ? undefined : rows.find(row => row.id === state.selected);
    const action = chosen ?? (row && { ...row, label: row.action });
    if (!action) return;
    // One action at a time per page: Enter names the running one instead of starting another.
    const working = hubRunning(state);
    if (working) { report(working.again); return; }
    if (action.unavailable) { report(action.unavailable); return; }
    const task = startTask(), started = state.session;
    step({ type: 'start', label: action.pending?.label ?? action.label, again: action.pending?.again ?? `${action.label} is still running.` });
    select(state.selected); report(''); if (action.pending) task.progress(action.pending.label);
    try {
      // A command example fills Home's search and selects its argument; nothing runs.
      if (row?.searchQuery !== undefined) {
        send({ type: 'home' }); step({ type: 'type', query: row.searchQuery }); refresh(true);
        const argument = parseHubQuery(state.query).scope ? state.query.indexOf(' ') + 1 : 0;
        requestFocus({ zone: 'search', range: [argument, state.query.length] });
      }
      else await callOut(() => action.run(task));
    }
    catch (error) { task.fail(error); }
    finally {
      task.end();
      // Only this action's own end frees the footer; one started later on a newer page keeps it.
      if (state.running?.session === started) { step({ type: 'end', session: started }); if (root.open) select(state.selected); }
    }
  }
  function resetView() {
    keepDrafts(); modal.pageChanged(); closeMenu(false);
    disposeView?.(); disposeView = null; content.replaceChildren(); patch('view', { hidden: true });
    viewFooter = null; viewRunning = false; actionFocus = null; viewArming?.arming.disarm(); viewArming = null;
    patch('search', { hidden: false }); patch('results', { hidden: false });
  }
  /** Draws Home with the query the engine brought back. */
  function drawHome(focus: HubFocusTarget) {
    resetView();
    put('page', 'home'); patch('caption', { text: 'Home' }); nameSearch(null); report(''); refresh(true); requestFocus(focus);
  }
  const atHome = () => hubAtHome(state.place);
  /**
   * ⌘⌫, the Back button and the mouse back button: exactly one level up, never a close.
   * A page opened directly (⌘T, ⌘E, ⌘B) has no parent and returns to the real Home.
   */
  const back = () => send({ type: 'back' });
  /**
   * Focus stays in search across Back, so nothing else tells a screen reader where it landed:
   * the destination's title is spoken once, as the answer to the player's own press. It is
   * never a feed update (D-15), and it stays mounted so its first message is heard (HUB-114).
   */
  function announceDestination() {
    if (!root.open) return;
    clearTimeout(announceTimer);
    const title = pageTitle(state.place);
    // The same destination twice in a row still changes the text, so it is spoken again.
    put('announce', model.announce === title ? `${title}\u00a0` : title);
  }
  /**
   * Esc once a view's own levels and an open disclosure had their say (the surface controller's
   * one Escape rule): clear a typed query, then go back one level, then close (D-4).
   */
  const dismiss = () => send({ type: 'escape' });
  function close(message?: string) {
    if (root.open) frame = ui.layout.frame();
    step({ type: 'close' });
    resetView(); modal.close(); for (const source of sources.keys()) source.setVisible(false);
    report(''); put('announce', '');
    cancelAnimationFrame(refreshFrame); refreshFrame = 0;
    clearTimeout(announceTimer); resultAnnouncement = '';
    rows = []; stopPainting(); patch('results', { rows: NONE, painted: 0, selected: null }); patch('empty', { hidden: true }); patch('search', { activeDescendant: undefined });
    if (typeof message === 'string' && message) notify(message);
  }
  /**
   * A named outcome. An open Hub reports it in its status line; after the Hub closed
   * it shows briefly where the frame's footer stood, and never outlives the next opening.
   * A failure also waits in the status line of that next opening, so it is never dropped.
   */
  function notify(message: string, outcome?: 'failed' | 'cleared') {
    // An observer withdraws only its own resolved failure, never another owner's outcome.
    if (outcome === 'cleared') {
      step({ type: 'uncarry', message });
      if (receiptInStatus && statusText() === message) report('');
      if (model.receipt.text === message) { clearTimeout(receiptTimer); patch('receipt', { hidden: true, announcement: '' }); }
      return;
    }
    if (root.open) { report(message, true); return; }
    if (outcome === 'failed') step({ type: 'carry', message });
    clearTimeout(receiptTimer);
    receiptTimer = setTimeout(entry(() => patch('receipt', { hidden: true, announcement: '' })), 8000);
    // A new object, so the view raises the receipt again above any popout opened since.
    put('receipt', { announcement: message, text: message, hidden: false, outcome: outcome ?? 'done', tone: outcome === 'failed' ? 'error' : 'success', ...(frame ? { frame } : {}) });
  }
  function suspend() {
    if (!root.open) return;
    frame = ui.layout.frame();
    step({ type: 'suspend', scroll: ui.layout.scrollTop(), focus: focusTarget() });
    modal.close();
    for (const source of sources.keys()) source.setVisible(false);
  }
  /**
   * Resumes a suspended page. Suspending hides the Hub without unmounting it, so a page still
   * mounted keeps its drafts, its confirmation and its view state; only its facts refresh
   * (HUB-050). A resumed Hub search is selected, so typing starts a new search (D-11).
   */
  function resumePage(page: Page, mounted: boolean) {
    if (!mounted) restorePage(page, true);
    else { if (!page.view) refresh(); requestFocus(page.focus, { wait: true, select: true }); }
  }
  /** The page on top takes the keyboard unless it already holds it: its search, else its first control. */
  function focusPage() {
    if (document.activeElement === input) { input.select(); return; }
    if (ui.focus.at() === 'view' && !model.view.hidden) return;
    requestFocus({ zone: 'search' });
  }
  /**
   * The one direct-shortcut contract (⌘E, ⌘T, ⌘B, the Settings menu item). The destination on
   * top takes focus; one lower on the open path is returned to, like its breadcrumb; a suspended
   * Hub whose path holds it resumes; otherwise it opens, over the open Hub's page or as the only
   * page of a fresh Hub, with no artificial parent. A repeated shortcut never stacks history and
   * never closes the Hub (HUB-049, HUB-172).
   */
  const direct = (destination: HubDestination, open: () => void) => send({ type: 'direct', destination }, { open });
  const modal = window.gwSurfaces.registerDialog({ root, priority: 6, transient: true,
    dismiss,
    // A backdrop click keeps the task for the next ⌘R, like a trip to another window (HUB-052).
    backdrop: suspend,
    // Focus never lands on <body>: without a visible opener it returns to the game.
    restoreFocus: () => previousFocus?.isConnected && previousFocus !== document.body && previousFocus.getClientRects().length > 0
      ? previousFocus : document.getElementById('canvas'),
  });
  /**
   * The Hub shortcut (⌘R). A closed Hub opens: a page suspended within the resume window
   * resumes, otherwise Home starts fresh (D-11). An open Hub goes Home, keeping a query typed
   * there selected, and never closes.
   */
  const show = () => openHub(false);
  /** Opens the Hub; `fresh` drops a suspended page, for a page that opens a closed Hub itself. */
  function openHub(fresh: boolean) {
    // Home's search takes the keyboard with the query kept there selected.
    if (root.open) { send({ type: 'show' }); requestFocus({ zone: 'search' }, { select: true }); return; }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearTimeout(receiptTimer); patch('receipt', { hidden: true, announcement: '' });
    window.dispatchEvent(new Event('gw:input-reset'));
    modal.show();
    const opened = step({ type: 'show', fresh });
    window.dispatchEvent(new Event('gw:hub-visible'));
    for (const source of sources.keys()) source.setVisible(sourceEnabled(source));
    apply(opened);
  }
  input.addEventListener('input', entry(() => { step({ type: 'type', query: input.value }); if (!receiptInStatus) report(''); refresh(true); }));
  // List stages keep DOM focus in search; the selection moves by aria-activedescendant (D-2).
  input.addEventListener('keydown', entry((event: KeyboardEvent) => {
    if (event.isComposing) return;
    // Only paging needs row geometry; ordinary typing and arrows must not force this layout.
    const page = event.key === 'PageUp' || event.key === 'PageDown' ? ui.layout.pageRows() : 1;
    const caretAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    send({ type: 'key', key: hubKey(event), where: { at: 'search', rows: rows.map(row => ({ id: row.id, navigate: !!row.navigate })), page, caretAtEnd } }, { event });
  }));
  // A press on a result keeps the keyboard in search.
  list.addEventListener('mousedown', event => {
    if (!onRates(event)) event.preventDefault();
  });
  list.addEventListener('pointerleave', entry(() => hover.release()));
  // ⌘⌫ is Back from any focus inside the Hub, text fields included, once a view stepped out of
  // its own inner level, the menu closed and a disclosure closed; ⌘J opens and closes Actions
  // from anywhere in the Hub (D-1). The Hub owns both presses either way.
  root.addEventListener('keydown', entry((event: KeyboardEvent) => {
    const disclosure = event.target instanceof Element ? event.target.closest('details[open]') : null;
    send({ type: 'key', key: hubKey(event), where: { at: 'hub', handled: event.defaultPrevented, disclosure: !!disclosure && root.contains(disclosure) } }, { event });
  }));
  root.addEventListener('mouseup', entry((event: MouseEvent) => { if (event.button === 3) { event.preventDefault(); back(); } }));
  root.addEventListener('keydown', entry((event: KeyboardEvent) => {
    // Typing on a button or blank space returns to the page's search, the header's included;
    // Space still presses the button. A form keeps its keys: a form view has no search, and
    // a form region a view marks with data-hub-form (Travel's Customize) stays form-first.
    const field = ui.focus.searchField();
    if (!event.defaultPrevented && field && event.target instanceof HTMLElement && event.target !== field && !event.target.isContentEditable
      && !event.target.matches('input,textarea,select') && !event.target.closest('[data-hub-form]')
      && !(event.key === ' ' && event.target.matches('button,summary')) && resumeSearchInput(event, field)) return;
    // Enter in a view runs its named primary, except on a control that Enter activates itself;
    // ⌘↵ runs it from any field of a form (HUB-152).
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (event.defaultPrevented || !target || !content.contains(target)) return;
    send({ type: 'key', key: hubKey(event), where: { at: 'view', primary: !!viewFooter?.primary, form: !!target.closest('form'),
      activates: target.matches('button,a[href],summary,select,textarea,input[type=checkbox],input[type=radio],input[type=range]') } }, { event });
  }));
  type MenuEntry = Readonly<{ label: string; section: 'Primary' | 'Details' | 'Personalize'; keys?: readonly string[]; destructive?: boolean; disabled?: boolean; reason?: string; run(): void | Promise<void> }>;
  /**
   * A row's Actions, verb first: its primary (↵), the row's own actions in its source's order
   * (build details, the rates, a person's actions), then pinning and a search phrase for rows
   * the Hub can keep (HUB-040, HUB-184).
   */
  function menuEntries(row: HubRow): MenuEntry[] {
    const entries: MenuEntry[] = [{ label: row.action, section: 'Primary', keys: ['↵'], ...(row.destructive ? { destructive: true } : {}), disabled: !!row.unavailable, ...(row.unavailable ? { reason: row.unavailable } : {}), run: () => run() }];
    for (const action of row.actions?.() ?? []) entries.push({
      label: action.label, section: 'Details', disabled: !!action.unavailable,
      ...(action.unavailable ? { reason: action.unavailable } : {}),
      ...(action.destructive ? { destructive: true } : {}),
      run: () => run(action),
    });
    if (isHubShortcuts([{ id: row.id, phrase: '', pinned: false }]) && lookup(row.id)) {
      const pinned = shortcuts().some(entry => entry.id === row.id && entry.pinned);
      entries.push({ label: pinned ? 'Unpin from Hub' : 'Pin to Hub', section: 'Personalize', run: async () => {
        const task = startTask();
        const entries = shortcuts(); const old = entries.find(entry => entry.id === row.id);
        const edited = { id: row.id, phrase: old?.phrase ?? '', pinned: !old?.pinned };
        try { await saveShortcuts(old ? entries.map(entry => entry.id === row.id ? edited : entry) : [...entries, edited]); const receipt = pinned ? `Unpinned ${row.title}.` : `Pinned ${row.title}.`; if (task.live()) report(receipt); else task.done(receipt); }
        catch { task.fail(new Error('Could not update the pin. Try again.')); }
      } });
      for (const source of enabledSources()) for (const entry of source.personalize?.(row) ?? []) entries.push({ label: entry.label, section: 'Personalize', run: entry.run });
    }
    return entries;
  }
  /** A view names its actions through the same menu; its live footer owns activation and confirmation. */
  function viewMenuEntries(current: ViewFooter): MenuEntry[] {
    const entry = (action: HubViewAction, section: MenuEntry['section'], primary: boolean): MenuEntry => ({
      label: action.label, section, disabled: !!action.disabled,
      ...(primary && current.primary ? { keys: ['↵'] } : {}),
      ...(action.destructive ? { destructive: true } : {}),
      run: () => { if (viewFooter === current) return runViewAction(action); },
    });
    return [entry(current.primary ?? done, 'Primary', true), ...(current.secondary ? [entry(current.secondary, 'Details', false)] : [])];
  }
  /** Opens the current page's Actions over the footer; the page, query and selection stay. */
  function openMenu() {
    const row = rows.find(row => row.id === state.selected);
    if (busy() || viewRunning || (!viewFooter && !row)) return;
    const entries = viewFooter ? viewMenuEntries(viewFooter) : menuEntries(row!);
    if (entries.length < 2) return;
    step({ type: 'menu', row: viewFooter ? null : row!.id });
    // The item runs on its first click only; the menu closes first, so its action owns the page.
    const items: HubMenuItem[] = entries.map(item => ({ ...item, click: entry((event: MouseEvent) => { if (event.detail > 1) return; closeMenu(); void callOut(item.run); }) }));
    patch('menu', { hidden: false, items }); patch('actions', { expanded: true });
    if (entries.some(item => !item.disabled)) requestFocus({ zone: 'menu' });
  }
  /** Closes the Actions menu; with `refocus` the keyboard goes to the Hub's fallback. Whether a menu was open. */
  function closeMenu(refocus = true) {
    if (!state.menu) return false;
    step({ type: 'menu-closed' });
    // A menu that closes under the keyboard hands it on in this entry's paint (its focus zone), before the next key.
    if (refocus) requestFocus(HUB_FALLBACK);
    return true;
  }
  // The menu's own keys: its focus zone takes the shared list move; Esc closes only the menu, Tab leaves it.
  menu.addEventListener('keydown', entry((event: KeyboardEvent) => send({ type: 'key', key: hubKey(event), where: { at: 'menu' } }, { event })));
  // A press anywhere else in the Hub closes the menu; the Actions button toggles it itself.
  root.addEventListener('pointerdown', entry((event: PointerEvent) => { if (state.menu && event.target instanceof Node && !menu.contains(event.target) && !actionsButton.contains(event.target)) closeMenu(false); }), true);
  // Every page uses the same Actions menu.
  // A double-click's second press never toggles the menu shut or runs anything (PTR-17).
  actionsButton.onclick = entry((event: MouseEvent) => { if (event.detail > 1) return; if (!closeMenu()) openMenu(); });
  closeButton.onclick = entry(() => close());
  // The primary acts once per click run, so a double-click on it runs its action once.
  backButton.onclick = entry(back);
  primary.onclick = entry((event: MouseEvent) => { if (event.detail > 1) return; if (viewFooter) void runViewAction(viewFooter.primary ?? done, event); else void run(); });
  root.addEventListener('close', entry(() => { if (!root.open && !state.suspended) close(); }));
  const onBlur = entry(() => suspend());
  const onSettings = entry(() => {
    for (const source of sources.keys()) source.setVisible(root.open && sourceEnabled(source));
    withdrawPages();
  });
  window.addEventListener('blur', onBlur); window.addEventListener('gw:tools-settings', onSettings);
  /** A new page starts over the open Hub's page, which Back returns to, or as the only page of a fresh Hub. */
  function enterPage(place: (current: Place) => Place, query?: string) {
    const fromOpenHub = root.open;
    if (!fromOpenHub) openHub(true);
    step({ type: 'enter', place: place(state.place), ...(query === undefined ? {} : { query }), remember: fromOpenHub,
      scroll: fromOpenHub ? ui.layout.scrollTop() : 0, focus: fromOpenHub ? focusTarget() : { zone: 'results' } });
  }
  /** Mounts a view page, a new one or one that Back restores, with its footer and drafts. */
  function mountView(view: MountedView) {
    resetView(); if (!receiptInStatus) report(''); clearTimeout(announceTimer); resultAnnouncement = ''; patch('empty', { hidden: true });
    put('page', 'section'); patch('caption', { text: view.title });
    patch('preview', { hidden: true }); patch('hint', { hidden: true });
    patch('search', { hidden: true }); patch('results', { hidden: true }); patch('view', { hidden: false });
    const current: ViewFooter = { primary: null, secondary: null };
    viewFooter = current;
    // A disposed view's late update never repaints the next page's footer.
    const shell: HubViewFooter = {
      primary: next => { current.primary = next; if (viewFooter === current) paintViewFooter(); },
      secondary: next => { current.secondary = next; if (viewFooter === current) paintViewFooter(); },
      openActions: () => { if (viewFooter === current) openMenu(); },
    };
    paintViewFooter();
    // The page mounts into a host that already shows, so it can measure and take focus.
    disposeView = callOut(() => view.mount(content, restoreParent, shell, ui.pages));
    restoreDrafts([...state.history.map(pageTitle), view.title].join(' › '));
    paintNavigation(); paintLegend(undefined);
    // A view that took the keyboard keeps it; else its first usable control, never <body>.
    if (ui.focus.at() !== 'view') requestFocus({ zone: 'view' });
  }
  // A presenter call is an entry point: it leaves the DOM drawn, so its caller can measure and focus right after.
  const presenter = {
    show: entry(show), close: entry(() => close()), suspend: entry(suspend), direct: entry(direct),
    suspendedOn: (destination: HubDestination) => hubSuspendedOn(state, destination, env()),
    /** A mounted view replaced its own page (a confirmation): a click run from before it is cancelled. */
    pageChanged: () => modal.pageChanged(),
    get visible() { return root.open; },
    /** Whether Esc on an empty query goes back to a parent page rather than closing the Hub. */
    get hasParent() { return state.history.length > 0; },
    attach: entry((next: HubSource) => {
      // A notification is drawn before it returns, like any presenter call (HUB-111).
      sources.set(next, next.subscribe(entry(() => {
        // A scoped list belongs to its source; peer observations only update navigation facts.
        const owner = state.place.scope?.owner;
        if (owner && owner !== next) { if (root.open) paintSourceFacts(); return; }
        scheduleRefresh();
      }))); next.setVisible(root.open && sourceEnabled(next)); refresh();
      return entry(() => {
        sources.get(next)?.(); sources.delete(next); next.setVisible(false);
        withdrawPages();
      });
    }),
    showRows: entry((title: string, getRows: () => readonly HubRow[], summary?: HubSummary, destination?: HubDestination, owner?: HubSource, query: string = '') => {
      const scope: RowScope = { title, rows: getRows, ...(summary ? { summary } : {}), ...(destination ? { destination } : {}), ...(owner ? { owner } : {}) };
      enterPage(() => ({ scope, view: null }), query);
      resetView(); put('page', 'section'); patch('caption', { text: title });
      nameSearch(title); if (!receiptInStatus) report(''); refresh(true); requestFocus({ zone: 'results' });
    }),
    showView: entry((title: string, mount: HubViewMount<HTMLElement>, available?: () => boolean, destination?: HubDestination, owner?: HubSource) => {
      const view: MountedView = { title, mount, ...(available ? { available } : {}), ...(destination ? { destination } : {}), ...(owner ? { owner } : {}) };
      enterPage(current => ({ scope: current.scope, view }));
      mountView(view);
    }),
    notify: entry(notify),
    /** A direct shortcut to a row's page (`direct`): it runs the row, or says why it cannot. */
    openRow: entry((destination: HubDestination, id: string, unavailable: string) => {
      direct(destination, () => { const row = lookup(id); if (row && !row.unavailable) { const task = startTask(); void callOut(() => row.run(task)); } else report(unavailable); });
    }),
    /** The pins and phrases, for the sources that edit them. */
    shortcuts: shortcutStore,
    resetPosition: hubWindow.reset,
    dispose() { close(); clearTimeout(receiptTimer); hubWindow.dispose(); disposeFrame(); for (const unsubscribe of sources.values()) unsubscribe(); sources.clear(); modal.dispose(); disposed = true; ui.dispose(); window.removeEventListener('blur', onBlur); window.removeEventListener('gw:tools-settings', onSettings); },
  };
  return presenter;
}
/** The Hub without its built-in sources (hub-builtins.ts adds them). */
export type Hub = ReturnType<typeof createHub>;
