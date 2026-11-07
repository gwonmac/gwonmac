/**
 * Owns the Core command palette: its sources, search and ranking, the rows' actions, receipts and
 * transient modal lifetime. Navigation, keys and where the keyboard goes belong to the engine
 * (hub-engine.ts): this adapter turns DOM events into engine events and applies its effects.
 * Optional Tools contributes local results and views without entering Core's imports.
 * The Hub's Vue view (app/ui/tools/src/hub, built as `tools/hub-app.js`) draws the model this
 * adapter keeps (app/shared/ui/hub-view.ts) and puts the keyboard on its focus target.
 */
import { HUB_TOOL_KEYS, TOOL_PRESENTATION } from '../shared/tool-presentation.js';
import { resumeSearchInput } from './search-input.js';
import { installHubWindow } from './hub-window.js';
import { attachClassicFrame } from '../shared/ui/frame.js';
import { resolveShortcuts, shortcutKeycaps, type ShortcutAction } from '../shared/keyboard-shortcuts.js';
import { HUB_SECTIONS, SETTINGS, SETTINGS_SECTIONS, type SettingEntry, type SettingsTarget } from "../shared/settings-catalogue.js";
import { focusHubSettings, LAUNCHER_UNAVAILABLE, showHubSettings } from "./hub-settings-page.js";
import { createHubAccounts } from './hub-accounts.js';
import { editHubShortcut, manageHubShortcuts } from './hub-preferences.js';
import { hubPhraseReserved, isHubShortcuts, isLibraryHubShortcut, type HubShortcut } from '../shared/hub-preferences.js';
import { createHubCalculator } from './hub-calculator.js';
import { recogniseCurrencyTokens } from '../shared/hub-currency-tokens.js';
import { DEFAULT_CALCULATOR_RATES } from '../shared/hub-calculator.js';
import { currencyIcon } from '../shared/currency-assets.js';
import { armConfirmation, closeDisclosure } from './surface-controller.js';
import { HUB_FALLBACK, HUB_RESUME_MS, hubAtHome, hubInitialState, hubKey, hubReduce, hubSuspendedOn, hubTaskLive, type HubEffect, type HubEvent, type HubPage, type HubPlace, type HubStep } from './hub-engine.js';
import { createHoverSelection } from '../shared/ui/hover-selection.js';
import { hubMatch, matchHubRows, parseHubQuery, normaliseHubQuery, hubTier, type HubDestination, type HubRow, type HubSource, type HubSummary, type HubTask, type HubViewAction, type HubViewFooter, type HubViewMount } from '../shared/hub.js';
import type { EmbeddedHubView, HubFocusTarget, HubLegendEntry, HubMenuItem, HubPrimary, HubViewModel } from '../shared/ui/hub-view.js';

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
    search: { hidden: false, placeholder: 'Search people, places, builds…', label: 'Search people, places, builds', expanded: true, calculation: false },
    glyphs: { hidden: true, calculation: false, box: null, segments: NONE, icons: NONE },
    rates: { host: null, hidden: true, basis: null, detailsLabel: 'Details',
      change: value => rateBasis?.choose(value), keydown: rateKeydown, details: () => rows.find(item => item.id === state.selected)?.actions?.() },
    results: { hidden: false, previewList: false, rows: NONE, painted: 0, selected: null, compact: false, bindings: resolveShortcuts({}) },
    empty: { hidden: true }, preview: { text: '', hidden: true }, view: { hidden: true },
    lifecycle: { text: '', hidden: true }, hint: { text: '', hidden: true }, announce: '', count: '',
    actions: { keys: false, disabled: false, expanded: false },
    menu: { hidden: true, items: NONE },
    receipt: { text: '', announcement: '', hidden: true },
  };
  const ui = embedded.mountHubView(parent, model);
  const { root, panel, heading, lock, resize, back: backButton, close: closeButton, search, input, glyphs, results: list, view: content, footer, primary, actions: actionsButton, menu, receipt } = ui.elements;
  let dirty = false, drawing = false, queued = false, disposed = false;
  /**
   * Draws pending model changes now. The controller calls it before it measures, focuses or hands
   * the DOM to a page; a microtask draws anything left, so the DOM is current before every frame.
   */
  function sync() {
    if (!dirty || drawing || disposed) return;
    drawing = true;
    try { while (dirty) { dirty = false; ui.paint(model); } } finally { drawing = false; }
  }
  function put<K extends keyof HubViewModel>(key: K, value: HubViewModel[K]) {
    if (same(model[key], value)) return;
    model[key] = value; dirty = true;
    if (!queued) { queued = true; queueMicrotask(() => { queued = false; sync(); }); }
  }
  const patch = <K extends Region>(key: K, fields: Partial<HubViewModel[K]>) => put(key, { ...model[key], ...fields });
  let focusSeq = 0;
  /** Puts the keyboard on a focus target: the view applies it in this paint, so a control it just showed can take it. */
  function requestFocus(target: HubFocusTarget, wait = false) { put('focus', { ...target, seq: ++focusSeq, ...(wait ? { wait } : {}) }); sync(); }
  let receiptTimer: ReturnType<typeof setTimeout> | undefined;
  // Where the Hub frame last stood: a receipt after closing appears in its footprint, not as a window toast.
  let frame: DOMRect | null = null;
  const disposeFrame = attachClassicFrame(panel);
  const hubWindow = installHubWindow(panel, heading, lock, resize);
  // A measuring layer adds artwork in native word gaps; the input remains the sole editor.
  let composing = false, glyphFrame = 0;
  const syncGlyphScroll = () => { glyphs.scrollLeft = input.scrollLeft; };
  function paintGlyphs() {
    if (composing) return;
    const mode = root.open && !disposeView && !state.place.scope && !parseHubQuery(input.value).scope && /^\s*(?:\d|\.\d)/u.test(input.value);
    patch('search', { calculation: mode });
    patch('glyphs', { calculation: mode, hidden: !mode });
    if (!mode) { patch('glyphs', { segments: NONE, icons: NONE }); return; }
    sync();
    const box = input.getBoundingClientRect(), parentBox = search.getBoundingClientRect();
    const text = input.value, tokens = recogniseCurrencyTokens(text), segments: { text: string; token?: { start: number; end: number; unit: string } }[] = [];
    let position = 0;
    for (const token of tokens) {
      segments.push({ text: text.slice(position, token.start) }, { text: text.slice(token.start, token.end), token: { start: token.start, end: token.end, unit: token.unit } });
      position = token.end;
    }
    segments.push({ text: text.slice(position) });
    patch('glyphs', { box: { left: box.left - parentBox.left, top: box.top - parentBox.top, width: input.clientWidth, height: input.clientHeight }, segments, icons: NONE });
    sync();
    const glyphBox = glyphs.getBoundingClientRect(), fontSize = Number.parseFloat(getComputedStyle(input).fontSize);
    const spans = [...glyphs.querySelectorAll<HTMLElement>('span[data-unit]')];
    patch('glyphs', { icons: tokens.flatMap((token, index) => {
      const url = currencyIcon(token.unit), span = spans[index]; if (!url || !span) return [];
      const end = span.getBoundingClientRect().right - glyphBox.left + glyphs.scrollLeft;
      return [{ url, unit: token.unit, left: end + fontSize * 0.625 }];
    }) });
    sync();
    syncGlyphScroll();
    cancelAnimationFrame(glyphFrame); glyphFrame = requestAnimationFrame(syncGlyphScroll);
  }
  input.addEventListener('scroll', syncGlyphScroll); input.addEventListener('select', syncGlyphScroll);
  input.addEventListener('keyup', syncGlyphScroll);
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; paintGlyphs(); });
  const glyphResize = new ResizeObserver(paintGlyphs); glyphResize.observe(input);
  /** The Price basis picker, wherever it stands now. */
  const ratesElement = () => { sync(); return root.querySelector<HTMLElement>('.hub-rate-controls'); };
  /** The priced row's basis the picker changes. */
  let rateBasis: HubRow['quoteBasis'] | null = null;
  // Enter on the picker copies the card it prices, as Enter on the search does (HUB-022).
  function rateKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.repeat && !event.isComposing && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) { event.preventDefault(); void run(); }
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
  const sourceEnabled = (source: HubSource) => !source.feature || ((source.feature === 'characterSwitchEnabled' || !!window.gwToolsSettings?.().gwonmacTools) && !!window.gwToolsSettings?.()[source.feature]);
  type RowScope = Readonly<{ title: string; rows: () => readonly HubRow[]; summary?: HubSummary; destination?: HubDestination; owner?: HubSource }>;
  type MountedView = { title: string; mount: HubViewMount<HTMLElement>; available?: () => boolean; destination?: HubDestination; owner?: HubSource };
  type Place = HubPlace<RowScope, MountedView>;
  type Page = HubPage<RowScope, MountedView>;
  /** The page stack, query, selection, menu, session and suspended page: the engine's, never copied here. */
  let state = hubInitialState<RowScope, MountedView>();
  /** The mounted view's footer: its named primary and secondary. */
  type ViewFooter = { primary: HubViewAction | null; secondary: HubViewAction | null };
  let viewFooter: ViewFooter | null = null;
  let viewRunning = false;
  let viewArming: { label: string; arming: ReturnType<typeof armConfirmation> } | null = null;
  let disposeView: (() => void) | null = null;
  /** The search names what it searches, as placeholder and accessible name alike (HUB-096). */
  const nameSearch = (page: string | null) => {
    const content = page === 'Build Library' ? 'builds' : ['Heroes', 'Accounts', 'Commands'].includes(page ?? '') ? page?.toLowerCase() : null;
    const name = content ? `Search ${content}…` : page ? `Search in ${page}…` : 'Search people, places, builds…';
    patch('search', { placeholder: name, label: name });
  };
  /** Where typing goes: the Hub search on list stages, else a list view's own search (Travel, Characters). */
  const searchField = () => { sync(); return ui.focus.searchField(); };
  /** Where the keyboard was when the running view action started: a page it opens returns there (HUB-019). */
  let actionFocus: HubFocusTarget | null = null;
  const scrollTop = () => { sync(); return list.scrollTop; };
  /** Where the keyboard is, as the target a page returns to. */
  const focusTarget = () => actionFocus ?? (sync(), ui.focus.capture());
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
      case 'clear-query': input.value = ''; report(''); refresh(true); requestFocus(effect.focus); return;
      case 'announce': announceDestination(); return;
      case 'select': if (effect.hover === 'hold') hover.hold(); else hover.release(); select(effect.id, !!effect.scroll); return;
      case 'focus': requestFocus(effect.target); return;
      case 'run': void run(); return;
      case 'navigate': { const row = rows.find(row => row.id === state.selected); if (row?.navigate) { sync(); row.navigate(startTask()); } return; }
      case 'run-view': void runViewAction(viewFooter?.primary ?? null, cause.event); return;
      case 'open-menu': openMenu(); return;
      case 'close-menu': closeMenu(false); return;
      case 'close-disclosure': closeDisclosure(cause.event?.target ?? null, root); return;
      case 'focus-page': focusPage(); return;
      case 'show': show(); return;
      case 'open': cause.open?.(); return;
      case 'refresh': refresh(); return;
      case 'report': report(effect.message); return;
      case 'notify': notify(effect.message, effect.failed ? 'failed' : undefined); return;
    }
  }
  /** Withdraw only pages whose actual source is unavailable; other drafts and searches stay. */
  const withdrawPages = () => send({ type: 'withdraw' });
  /**
   * Form drafts last the session, keyed by page path and field name: leaving a form keeps what
   * was typed and returning restores it, unless the stored value the field started from changed.
   */
  const drafts = new Map<string, { initial: string; value: string }>();
  const draftInitials = new Map<string, string>();
  let draftPage: string | null = null;
  const draftFields = () => [...content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'form input:not([type]), form input[type=text], form input[type=search], form textarea, form select')]
    .flatMap(field => { const name = field.getAttribute('aria-label') || field.name || field.id; return name ? [[`${draftPage} › ${name}`, field] as const] : []; });
  function restoreDrafts(path: string) {
    draftPage = path; draftInitials.clear();
    for (const [key, field] of draftFields()) {
      draftInitials.set(key, field.value);
      const draft = drafts.get(key);
      if (draft && draft.initial !== field.value) drafts.delete(key);
      else if (draft) { field.value = draft.value; field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); }
    }
  }
  function keepDrafts() {
    if (draftPage === null) return;
    for (const [key, field] of draftFields()) {
      const initial = draftInitials.get(key) ?? field.value;
      if (field.value === initial) drafts.delete(key); else drafts.set(key, { initial, value: field.value });
    }
    draftPage = null;
  }
  /** Draws a page Back, a breadcrumb or a resume returns to; the engine already stands on it. */
  function restorePage(page: Page) {
    resetView();
    if (page.view) mountView(page.view);
    else {
      input.value = page.query; patch('caption', { text: page.scope?.title ?? 'Home' }); put('page', page.scope ? 'section' : 'home');
      nameSearch(page.scope?.title ?? null); report(''); refresh(true);
      const restored=rows.find(row=>row.id===page.selected)??(['quote:result','market:result','manual-conversion','conversion'].includes(page.selected??'')?rows.find(row=>row.group==='Calculator'):undefined);
      select(restored?.id??null); paintToScroll(page.scroll); sync(); list.scrollTop = page.scroll;
      if (page.selected && state.selected === null) report('The previous selection is no longer available. Choose a result.');
    }
    // A view that loads late (Settings) still gives the keyboard back to the control it held.
    requestFocus(page.focus, true);
  }
  /**
   * A view's own way out ("Done", Travel or Characters leaving): the parent page, or a close
   * where there is none. A page opened directly by its shortcut has no artificial Home step.
   */
  const restoreParent = () => send({ type: 'parent' });
  let previousFocus: HTMLElement | null = null;
  /** The row action running on this page; the footer and status name it until it ends (HUB-083). */
  let running: { session: number; label: string; again: string } | null = null;
  const busy = () => running !== null && running.session === state.session;
  /** A closed-Hub failure names its action on the next opening within the resume window. */
  let carriedFailure: {message: string; at: number} | null = null;
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
  const dispatch = (name: string, detail?: unknown) => {
    if (window.dispatchEvent(new CustomEvent(name, { cancelable: true, detail }))) {
      throw new Error('Unavailable in the current game state.');
    }
  };
  /** The command rows; `every` includes those an empty Home leaves out, so pins and phrases still resolve. */
  const commands = (every = false, query = input.value): HubRow[] => {
    const settings = window.gwToolsSettings?.();
    const tool = (id: string, title: string, detail: string, keywords: string, enabled: boolean | undefined, event: string): HubRow[] => enabled ? [{
      id, title, keywords, detail, ...(id === 'storage' ? { aliases: ['Open Xunlai Storage'] } : {}), group: 'Tools', action: id === 'storage' ? 'Open Xunlai Storage' : `Open ${title}`,
      run: () => { if (id === 'storage') { close(); window.dispatchEvent(new CustomEvent(event, { cancelable: true })); } else dispatch(event, 'show'); },
    }] : [];
    return [
      // Travel's row comes from its owner, attached for its whole life with the command's refusal (HUB-135).
      ...tool('trade', TOOL_PRESENTATION['trade-chat'].label, 'Find offers and contact sellers', 'kamadan prices trading market trader', settings?.gwonmacTools && settings.tradeChat, 'gw:trade-toggle'),
      ...tool('whispers', TOOL_PRESENTATION['whispers'].label, 'Conversations, friends and drafts', 'friends people message chat', settings?.gwonmacTools && settings.whispersEnabled, 'gw:whispers-toggle'),
      ...(settings?.characterSwitchEnabled ? [{ id: 'character', title: TOOL_PRESENTATION['character-switch'].label, detail: 'Choose another character', keywords: 'relog profession characters alts', group: 'Tools', action: 'Choose character', navigate: () => dispatch('gw:character-toggle'), run: () => dispatch('gw:character-toggle') }] : []),
      ...tool('storage', TOOL_PRESENTATION['xunlai-storage'].label, 'Open your storage chest', 'chest bank', settings?.gwonmacTools && settings.xunlaiStorage, 'gw:storage-open'),
      ...(settings?.gwonmacTools && settings.cartographyEnabled ? [{ id: 'maps', title: TOOL_PRESENTATION['maps'].label, detail: 'Exploration grid, walkable terrain and compass ranges', keywords: 'grid terrain compass opacity', group: 'Tools', action: 'Adjust maps', run: openSettings({ section: 'maps' }) }] : []),
      { id: 'commands', title: 'Commands', detail: 'Search words, calculator examples and keys', aliases: ['?'], keywords: 'help guide examples cheatsheet shortcuts keys', group: 'Commands', action: 'Browse commands', run: () => presenter.showRows('Commands', commandExamples) },
      { id: 'hub-preferences', title: 'Hub preferences', detail: 'Pins and exact search phrases', keywords: 'aliases vocabulary', group: 'Commands', action: 'Adjust Hub', run: () => manageHubShortcuts(presenter, shortcutStore, hubWindow.reset) },
      { id: 'settings', title: 'Settings', detail: 'Tools, maps, appearance and game · ⌘,', keywords: 'preferences graphics appearance hotkeys shortcuts', group: 'Commands', action: 'Open Settings', run: openSettings() },
      // Launcher and the website are for a typed search; the first screen stays on the game (HUB-185).
      ...(!every && !query.trim() ? [] : [
        { id: 'launcher', title: 'Show Launcher', detail: 'Accounts, updates and game files', keywords: 'launcher administration', group: 'Commands', action: 'Show Launcher', run: async (task: HubTask) => { await window.gwNative.app.showLauncher(); task.done(); } },
        { id: 'help', title: 'Project website', detail: 'Documentation and latest changes', keywords: 'help documentation', group: 'Commands', action: 'Open website', run: async (task: HubTask) => { await window.gwNative.app.openExternal('github'); task.done(); } },
      ]),
      ...(!every && !query.trim() ? [] : [
        // Call Target stays on its own shortcut: it acts only while the game has focus (HUB-133).
        // Resign's row comes from its owner, with its refusal before Enter (resign.ts).
        // Quit or Reload opens the account's confirmation sheet, never a direct quit (HUB-001).
        // The sheet waits for the press that asked for it, so its repeat or trailing click never answers it.
        // Cancel hands the task back with its search, as Resign's confirmation does (HUB-250).
        { id: 'reload', title: 'Quit or Reload Game…', detail: 'Opens confirmation for this account', keywords: 'restart reconnect', group: 'Commands', action: 'Review options', run: async () => { suspend(); await window.gwSurfaces.afterPress(); if (await window.gwNative.app.showQuitOrReload() === 'stayed') show(); else close(); } },
        // Settings are found by their own words (HUB-063). They follow the commands, so a command's own word keeps its row first.
        ...(normaliseHubQuery(query).length < 3 ? [] : SETTINGS_SECTIONS).map(({ id, label, keywords }) => ({ id: `settings:${id}`, title: label, detail: HUB_SECTIONS.has(id) ? 'Settings section' : 'Settings section in the launcher', keywords, group: 'Settings', action: HUB_SECTIONS.has(id) ? `Open ${label} settings` : 'Open in Launcher', run: openSettings({ section: id }) })),
        ...(normaliseHubQuery(query).length < 3 ? [] : SETTINGS).map(settingRow),
      ]),
    ];
  };
  const shortcuts = () => [...(window.gwToolsSettings?.().hubShortcuts ?? []), ...[...sources.keys()].filter(sourceEnabled).flatMap(source => source.shortcuts?.get() ?? [])];
  const lookup = (id: string): HubRow | undefined => [...sources.keys()].filter(sourceEnabled).map(source => source.lookup?.(id)).find(Boolean)
    ?? commands(true).find(row => row.id === id);
  /**
   * The other result a root search for this phrase already finds by its exact name or alias. A
   * search phrase equal to it would hide it or make both ambiguous, so the editor refuses it (HUB-062).
   */
  function exactlyNamed(phrase: string, id: string): HubRow | undefined {
    const found = [...[...sources.keys()].filter(sourceEnabled).flatMap(source => source.search(phrase)), ...commands(true, phrase)];
    return found.find(row => row.id !== id && hubMatch(row.title, phrase, row.aliases) === 'exact');
  }
  const shortcutStore = { get: () => shortcuts(), lookup, save: saveShortcuts, exactlyNamed };
  async function saveShortcuts(value: readonly HubShortcut[]) {
    const privateEntries = value.filter(entry => isLibraryHubShortcut(entry.id));
    const globalEntries = value.filter(entry => !isLibraryHubShortcut(entry.id));
    if (!isHubShortcuts(privateEntries) || !isHubShortcuts(globalEntries)) throw new Error('Invalid Hub shortcuts');
    const owner = [...sources.keys()].find(source => sourceEnabled(source) && source.shortcuts);
    if (owner?.shortcuts && JSON.stringify(privateEntries) !== JSON.stringify(owner.shortcuts.get())) await owner.shortcuts.save(privateEntries);
    else if (privateEntries.length && !owner) throw new Error('Build Library is unavailable.');
    if (JSON.stringify(globalEntries) !== JSON.stringify(window.gwToolsSettings?.().hubShortcuts ?? [])) await window.gwNative.settings.set({ hubShortcuts: globalEntries });
    refresh();
  }
  /**
   * The Commands page is the Hub's cheatsheet: search words with a place to type, calculator
   * examples, and the keys (HUB-093, HUB-094). An example only fills the search; nothing runs.
   */
  function commandExamples(): HubRow[] {
    const enabled = new Set(commands(true).map(row => row.id));
    for (const owned of ['builds', 'travel']) if (lookup(owned)) enabled.add(owned);
    const example = (group: string, tool: string, title: string, fill: string, detail: string) => ({ group, tool, title, fill, detail });
    const examples = [
      example('Places', 'travel', 'travel <place>', 'travel ', 'Find an outpost by name or alias'),
      example('Characters', 'character', 'char <name>', 'char ', 'Find one of your characters'),
      example('Builds', 'builds', 'build <name or profession>', 'build ', 'Browse saved builds; build mo lists Monk builds'),
      example('Builds', 'builds', 'team <name>', 'team ', 'Find a saved team'),
      example('Builds', 'builds', 'build folder:<folder> <name>', 'build folder:', 'Builds in a folder and its subfolders; quotes keep spaces'),
      example('Builds', 'builds', 'build Mo/Me', 'build Mo/Me', 'An exact profession pair'),
      example('People', 'whispers', 'whisper <name>', 'whisper ', 'Write to a person; nothing is sent until you send it'),
      example('People', 'whispers', 'invite <name>', 'invite ', 'Invite a person to your party from an outpost'),
      example('Trade', 'trade', 'trade <item>', 'trade ', 'Find offers or a seller in Trade Chat'),
      example('Accounts', '', 'acc <name>', 'acc ', 'Choose how to open a saved account'),
      example('Calculate', '', '1p in g', '1p in g', 'Platinum to gold'),
      example('Calculate', 'trade', '10e in p', '10e in p', 'Ectos at recent Kamadan prices'),
      example('Calculate', '', '2 * 250 + 75', '2 * 250 + 75', 'Plain arithmetic'),
      example('Calculate', '', 'titles', 'titles', 'Plan title points'),
    ];
    const rows: HubRow[] = examples.filter(entry => !entry.tool || enabled.has(entry.tool)).map((entry, index) => ({ id: `example:${index}`, title: entry.title, detail: entry.detail, group: entry.group, action: `Fill search with ${entry.title}`, searchQuery: entry.fill, run() {} }));
    // Keys: a tool's shortcut can change in Settings; the Hub's own keys are fixed.
    const bindings = resolveShortcuts(window.gwToolsSettings?.().shortcutOverrides ?? {});
    const keys = (action: ShortcutAction) => shortcutKeycaps(bindings[action]).map(cap => cap.label).join('') || 'Not set';
    rows.push(...HUB_TOOL_KEYS.filter(({ command }) => enabled.has(command)).map(({ command, tool, action, label }) => ({ id: `key:${command}`, title: label, detail: keys(action), group: 'Keys & shortcuts', action: 'Change shortcut', run: openSettings({ section: 'tools', control: `tool:${tool}` }) })));
    for (const [id, name, detail] of [['actions', 'Actions for the selected row', '⌘J'], ['back', 'Back', '⌘⌫'], ['escape', 'Clear, back, then close', '⎋'], ['open', 'Open a row with a page', '→']] as const)
      rows.push({ id: `key:${id}`, title: name, detail, group: 'Keys & shortcuts', action: 'Fixed key', unavailable: 'The Hub’s own keys do not change.', run() {} });
    return rows;
  }
  /** A setting row opens Settings at its control: in the Hub, or in the launcher for the launcher's sections. */
  function settingRow(entry: SettingEntry): HubRow {
    const section = SETTINGS_SECTIONS.find(candidate => candidate.id === entry.section)!.label;
    const inHub = HUB_SECTIONS.has(entry.section);
    return { id: `setting:${entry.id}`, title: entry.label, keywords: `setting ${entry.keywords ?? ''}`, group: 'Settings',
      detail: inHub ? `Settings › ${section}` : `Settings › ${section} in the launcher`, action: inHub ? 'Open setting' : 'Open in Launcher',
      run: openSettings({ section: entry.section, control: entry.id }) };
  }
  /** A row action that shows Settings, at a section or control when given (docs/settings.md). */
  function openSettings(target?: SettingsTarget) {
    return async (task: HubTask) => {
      if (target && !HUB_SECTIONS.has(target.section)) {
        await window.gwNative.app.openSettings(target).catch(() => { throw new Error(LAUNCHER_UNAVAILABLE); });
        task.done(); return;
      }
      showSettings(target);
    };
  }
  /** Settings as a Hub page; a Settings page that was already open, suspended or lower in the path moves to the target. */
  function showSettings(target?: SettingsTarget) {
    direct('settings', () => showHubSettings(presenter, target ?? null));
    if (target) focusHubSettings(target);
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
      if (scroll) { sync(); list.querySelector<HTMLElement>(`[data-id="${CSS.escape(row.id)}"]`)?.scrollIntoView({ block: 'nearest' }); }
    }
    // A card that vanishes under a focused Price basis hands the keyboard back to search (HUB-223, the rates' focus zone).
    patch('rates', { hidden: !row?.quoteBasis || !!disposeView });
    if (row?.quoteBasis) {
      const { value, options } = rateBasis = row.quoteBasis;
      const basis = model.rates.basis?.value === value && model.rates.basis.options === options ? model.rates.basis : { value, options };
      patch('rates', { host: row.id, basis, detailsLabel: row.actionsLabel === 'Refresh quotes' ? 'Refresh quotes' : 'Details' });
    }

    if (!row) patch('search', { activeDescendant: undefined });
    patch('preview', { text: row?.preview ?? '', hidden: !row?.preview || !!disposeView });
    // A row action that opened a view ends here: the view names the footer now.
    if (viewFooter) { paintViewFooter(); return; }
    // A running action keeps the footer: it names what runs, disabled, until it ends (HUB-083).
    const working = busy() ? running : null;
    const art = !working ? row?.conversion?.iconTo : undefined;
    setPrimary({ label: working ? working.label : row ? row.action : 'Select a result', ...(art ? { art } : {}), keycap: !!row && !working,
      disabled: !row || !!row.unavailable || !!working, variant: row?.destructive ? 'danger' : 'primary' });
    // Footer slots never hide, so nothing slides under a resting pointer; they disable instead.
    // Actions opens only where it lists more than the primary (HUB-043).
    setActions(!row || !!working || menuEntries(row).length < 2);
    if (!model.menu.hidden && state.menu?.row !== row?.id) closeMenu(false);
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
    keys.push([['⎋'], searchField()?.value ? 'Clear' : state.history.length ? 'Back' : 'Close']);
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
    sync();
    try { await action.run(task); }
    catch (error) { task.fail(error); }
    finally { task.end(); if (viewFooter === current) { actionFocus = null; viewRunning = false; paintViewFooter(); } }
  }
  const hover = createHoverSelection();
  const pointerRow = (event: Event) => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('.hub-row') : null;
    return node && list.contains(node) ? rows.find(row => row.id === node.dataset.id) : undefined;
  };
  const onRates = (event: Event) => event.target instanceof Node && !!ratesElement()?.contains(event.target);
  // Delegated events always resolve the current row, including after its DOM was retained.
  list.addEventListener('pointermove', event => {
    const row = pointerRow(event); if (row && !busy() && hover.selects(event) && row.id !== state.selected) select(row.id);
  });
  // A click selects; a game-changing row runs only from the footer or a double-click on itself (D-24).
  list.addEventListener('click', event => {
    if (onRates(event)) return;
    const row = pointerRow(event); if (!row) return;
    send({ type: 'press', id: row.id, count: event.detail, consequential: !!row.consequential, busy: busy() });
  });
  list.addEventListener('contextmenu', event => {
    if (onRates(event)) return;
    const row = pointerRow(event); if (!row) return;
    event.preventDefault();
    send({ type: 'context', id: row.id, busy: busy() });
  });
  // Source notifications change context and lifecycle facts, not the current page or search.
  function paintSourceFacts() {
    const view = state.place.view;
    const located = view ? view.destination === 'travel' || view.destination === 'characters' : !state.place.scope && !input.value.trim();
    const context = located ? [...sources.keys()].filter(sourceEnabled).flatMap(source => source.context?.() ?? []) : [];
    put('context', context.join(' · '));
    const lifecycleText = disposeView ? '' : [...sources.keys()].filter(sourceEnabled).map(source => source.lifecycle?.()).find(Boolean) ?? '';
    patch('lifecycle', { text: lifecycleText, hidden: !lifecycleText, ...((model.lifecycle.title ?? '') !== lifecycleText ? { title: lifecycleText } : {}) });
  }
  function paintNavigation() {
    const summary = disposeView ? undefined : state.place.scope?.summary;
    put('summary', summary ?? null);
    const currentTitle = pageTitle(state.place);
    patch('caption', { text: currentTitle });
    paintSourceFacts();
    const trail = state.history.map((page, index) => ({ title: pageTitle(page), index }));
    const nextNavigation = JSON.stringify([trail, currentTitle]);
    if (navigationRevision !== nextNavigation) {
      navigationRevision = nextNavigation;
      put('crumbs', trail.map(page => ({ title: page.title, open: () => send({ type: 'crumb', index: page.index }) })));
      patch('caption', { current: true });
    }
    const parent = state.history.at(-1);
    patch('back', { hidden: atHome(), destination: parent ? pageTitle(parent) : 'Home' });
    const query = parseHubQuery(input.value);
    put('scope', { text: query.scope ?? '', hidden: !!state.place.scope || !query.scope || !!disposeView || commands(true).some(row => normaliseHubQuery(row.title) === normaliseHubQuery(input.value)) });
    // The page title leads, so a screen reader that lands in search after Back hears where it is.
    patch('search', { description: `${currentTitle}: ${state.place.scope ? 'search actions' : query.scope ? `search ${query.scope}` : 'search tools or use a command example'}` });
    const example = commandExamples().find(row => normaliseHubQuery(row.title).startsWith(`${normaliseHubQuery(input.value)} `));
    const hint = !state.place.scope && !query.scope && input.value.trim() && example ? `Try “${example.title}” · ${example.detail}` : '';
    put('hint', { text: hint, title: hint, hidden: !hint || !!disposeView });
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
    stopPainting(); patch('results', { rows: next, painted: 0 });
    painting = { rows: next, next: 0, frame: 0 };
    paintThrough(PAINT_CHUNK - 1);
  }
  /** Paints every row up to this index now and leaves the rest to the next frame. */
  function paintThrough(index: number) {
    const job = painting;
    if (!job) return;
    cancelAnimationFrame(job.frame);
    job.next = Math.max(job.next, Math.min(index + 1, job.rows.length));
    patch('results', { painted: job.next });
    if (job.next >= job.rows.length) painting = null;
    else job.frame = requestAnimationFrame(() => paintThrough(job.next + PAINT_CHUNK - 1));
  }
  /** A scroll position needs the rows above and in view: paint whole chunks until the list reaches it. */
  function paintToScroll(top: number) {
    while (painting && (sync(), list.scrollHeight < top + list.clientHeight)) paintThrough(painting.next + PAINT_CHUNK - 1);
  }
  let refreshFrame = 0;
  function scheduleRefresh() {
    if (!root.open || refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; refresh(); });
  }
  function refresh(reset = false) {
    // An immediate query or opening already consumes all facts queued by source notifications.
    cancelAnimationFrame(refreshFrame); refreshFrame = 0;
    paintGlyphs();
    if (!root.open) return;
    // A mounted view keeps its header facts current, e.g. where the player is.
    if (disposeView) { paintNavigation(); return; }
    if (reset) hover.release();
    paintNavigation();
    const previousRows = rows;
    const tradeQuery = parseHubQuery(input.value);
    const tradeRows: HubRow[] = tradeQuery.scope === "trade" && tradeQuery.term && window.gwToolsSettings?.().gwonmacTools && window.gwToolsSettings?.().tradeChat
      // The player's own words, in the market Trade has open; `trade:` gives the row Trade's icon (HUB-124).
      ? [{ id: "trade:query", title: `Search Trade for ${tradeQuery.text}`, detail: "Offers and character names", group: "Tools", action: `Search Trade for ${tradeQuery.text}`, run: () => dispatch("gw:trade-toggle", { query: tradeQuery.text }) }] : [];
    const extra = state.place.scope ? state.place.scope.rows() : [...sources.keys()].filter(sourceEnabled).flatMap(source => source.search(input.value)).concat(tradeRows);
    const parsed = parseHubQuery(input.value);
    // A phrase saved before its words joined the grammar stays stored but no longer matches.
    const saved = shortcuts().filter(entry => !parsed.term ? entry.pinned : entry.phrase === parsed.term && !hubPhraseReserved(entry.phrase))
      .filter(entry => !parsed.scope || entry.id.startsWith(`${parsed.scope === 'travel' ? 'place' : parsed.scope}:`));
    // A phrase answers with the row its owner gives this query (a scoped team applies), else the stored row.
    const savedRows = saved.flatMap(entry => { const row = extra.find(candidate => candidate.id === entry.id) ?? lookup(entry.id); return row ? [{ ...row, group: parsed.term ? row.group : 'Pinned' }] : []; });
    const ids = new Set([...extra, ...savedRows].map(row => row.id));
    rows = state.place.scope ? matchHubRows(extra, input.value) : [...savedRows, ...extra.filter(row => !savedRows.some(saved => saved.id === row.id)), ...(parsed.term && parsed.scope ? commands().filter(row => !ids.has(row.id) && normaliseHubQuery(row.title) === normaliseHubQuery(input.value)) : matchHubRows(commands().filter(row => !ids.has(row.id)), input.value))];
    // A tool or command row stands for its own setting (`Resign…`, Build Library); the setting row
    // stays findable while the tool is off.
    const actionName = (row: HubRow) => normaliseHubQuery(row.title.replace(/…$/, ''));
    const actions = new Set(rows.filter(row => row.group !== 'Settings').map(actionName));
    rows = rows.filter(row => row.group !== 'Settings' || !actions.has(actionName(row)));
    // A typed root search orders sections by their best answer, then by the usual group order,
    // and rows by the same tier (HUB-008, HUB-058). A saved phrase is the best answer of all;
    // the calculator's card answers its own grammar. Scoped lists keep their source's order.
    const phraseIds = new Set(parsed.term ? [...savedRows, ...extra.filter(row => row.exactPhrase)].map(row => row.id) : []);
    const ranked = !state.place.scope && !parsed.scope && !!parsed.term;
    const tierOf = (row: HubRow) => phraseIds.has(row.id) ? -1 : row.conversion || row.group === 'Calculator' ? 0 : hubTier(row, parsed.term) ?? 3;
    const best = new Map<string, number>();
    if (ranked) for (const row of rows) best.set(row.group, Math.min(best.get(row.group) ?? Infinity, tierOf(row)));
    const groups = ["Pinned", "Calculator", "Teams", "Folders", "Characters", "Builds", "Targets", "Current build", "Accounts", "In your party", "Unlocked heroes", "Heroes", "People", "Places", "Friends", "Continue", "Tools", "Commands", "Settings", "Sources", "Trade", "Calculate", "Keys & shortcuts"];
    // A typed query that names a tool or command as well as places answers with the tool: the Hub
    // has a few of those and hundreds of places (`ma` is Maps before Maguuma Stade, HUB-058).
    const typedFirst = ranked ? ['Tools', 'Commands'] : [];
    const groupIndex = (group: string) => { const first = typedFirst.indexOf(group); if (first >= 0) return first - typedFirst.length; const index = groups.indexOf(group); return index < 0 ? groups.length : index; };
    // Keep everyday game actions ahead of account management, independent of provider order,
    // and Commands, the way into everything else, first among the commands (HUB-185).
    const tools = ['travel', 'character', 'whispers', 'builds', 'trade', 'storage', 'maps', 'accounts'];
    const priority = (row: HubRow) => { if (state.place.scope) return 0; if (row.group === 'Commands') return row.id === 'commands' ? -1 : 0; if (row.group !== 'Tools') return 0; const index = tools.indexOf(row.id); return index < 0 ? tools.length : index; };
    rows = [...rows].sort((a, b) => (ranked ? best.get(a.group)! - best.get(b.group)! : 0) || groupIndex(a.group) - groupIndex(b.group)
      || (ranked ? tierOf(a) - tierOf(b) : 0) || priority(a) - priority(b));
    const resultCount = `${rows.length} result${rows.length === 1 ? '' : 's'}`;
    const message = !state.place.scope && !input.value.trim() ? '' : rows.length ? resultCount : 'No matches';
    put('count', message === 'No matches' ? '' : message);
    patch('empty', { hidden: rows.length > 0 }); patch('results', { hidden: !rows.length });
    patch('search', { expanded: rows.length > 0 });
    if (reset || message !== resultAnnouncement) {
      clearTimeout(announceTimer); resultAnnouncement = message;
      if (message) announceTimer = setTimeout(() => {
        if (root.open && !disposeView && model.announce !== message) put('announce', message);
      }, 500);
    }
    const nextBindings = resolveShortcuts(window.gwToolsSettings?.().shortcutOverrides ?? {});
    const nextShortcutRevision = JSON.stringify(nextBindings);
    const shortcutsChanged = shortcutRevision !== nextShortcutRevision;
    shortcutRevision = nextShortcutRevision;
    if (shortcutsChanged) bindings = nextBindings;
    // Keep mounted options steady when an observer only advances its sequence.
    // Actions still read the newly derived rows, so no stale closure can execute.
    const samePaint = (row: HubRow, previous: HubRow | undefined) => previous && row.id === previous.id && row.title === previous.title
      && row.detail === previous.detail && row.group === previous.group && row.icon === previous.icon
      && row.action === previous.action && row.destructive === previous.destructive && row.unavailable === previous.unavailable
      && row.readOnly === previous.readOnly && !!row.navigate === !!previous.navigate && row.preview === previous.preview
      && row.folder === previous.folder && row.attributeStatus === previous.attributeStatus
      && JSON.stringify([row.skills, row.attributes, row.professions, row.conversion]) === JSON.stringify([previous.skills, previous.attributes, previous.professions, previous.conversion]);
    if (!reset && !shortcutsChanged && rows.length === previousRows.length && rows.every((row, index) => samePaint(row, previousRows[index]))) {
      if (painting) painting.rows = rows;
      patch('results', { rows }); select(state.selected); return;
    }
    // The rebuilt list keeps the reader's place, so the rows down to it paint at once.
    const top = scrollTop();
    patch('rates', { host: null });
    const compactBuilds = !state.place.scope && !input.value.trim();
    // Reserve the preview from the complete result set, before deferred rows reach the DOM.
    patch('results', { previewList: !compactBuilds && rows.some(row => !!row.preview), compact: compactBuilds, bindings });
    startPainting(rows);
    // At the top, the first batch is already present; only a restored offset needs layout now.
    if (top > 0) paintToScroll(top);
    // Two rows with the typed name are a tie, so nothing is chosen for the player; a saved phrase
    // names one row only when its existing stores agree. Pins on an empty Home are no tie (HUB-060).
    // A query that is a row's whole name, `trade chat` included, answers with that row (HUB-008).
    const phraseMatches = rows.filter(row => phraseIds.has(row.id));
    const phraseHit = (phraseMatches.length === 1 ? phraseMatches[0] : undefined) ?? (parsed.scope ? rows.find(row => normaliseHubQuery(row.title) === normaliseHubQuery(input.value)) : undefined);
    // A setting named like a command or tool (`travel`) yields to it: Settings rows tie only with each other.
    const exact = parsed.term ? rows.filter(row => hubTier(row, parsed.term) === 0) : [];
    const exactActions = exact.filter(row => row.group !== 'Settings');
    const exactCount = (exactActions.length ? exactActions : exact).length;
    const prior = previousRows.find(row => row.id === state.selected);
    const revised = prior && rows.find(row => row.id === state.selected)?.preview !== prior.preview;
    // A bare scope (`travel `) lists without a term, so nothing in it is an explicit result:
    // Enter never travels, invites, applies, switches or opens an account on a guess.
    // A fresh Home in an explorable area never starts on a row that leaves it (D-13).
    const initial = !input.value.trim() ? rows.find(row => row.preferred && !row.unavailable) ?? rows.find(row => row.preferred !== false && !row.unavailable && !row.leavesArea) ?? rows.find(row => row.preferred !== false && !row.leavesArea)
      : !state.place.scope && parsed.scope && !parsed.term ? rows.find(row => !row.consequential && !row.unavailable)
      // A typed query starts on its best available answer, never on a disabled one (HUB-056).
      : phraseHit ?? rows.find(row => !row.unavailable) ?? rows[0];
    const settling = reset || (awaitingResults && state.selected === null && rows.length > 0);
    if (settling) awaitingResults = !rows.length;
    // A placeholder row that goes away (a loading or state row) hands its selection to what
    // replaced it, as a fresh query would, so Enter acts without another key (HUB-232). So does a
    // setting that yields to its tool's row arriving later (`build library` before Builds load).
    const yielded = prior?.group === 'Settings' && actions.has(actionName(prior));
    const replacedPlaceholder = (!!prior?.unavailable || yielded) && !rows.some(row => row.id === prior.id);
    // Clear only this loading refusal when its answer settles; unrelated failures stay.
    if (prior?.unavailable && statusText() === prior.unavailable && rows.some(row => row.conversion && !row.unavailable)) report('');
    select((prior?.id === 'quote-state' || prior?.id === 'market-state') && !!rows[0]?.conversion ? rows[0].id : settling || replacedPlaceholder ? phraseMatches.length > 1 || (exactCount > 1 && !phraseHit) ? null : initial?.id ?? null : !revised && rows.some(row => row.id === state.selected) ? state.selected : null);
    if (!settling && prior && !replacedPlaceholder && !rows.some(row => row.id === prior.id) && !receiptInStatus) report('The previous selection is no longer available. Choose a result.');

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
      progress: message => { progress = { owner: token, message }; if (live() || progressInStatus || !statusText()) report(''); },
      done: receipt => send({ type: 'done', session: started, ...(receipt ? { receipt } : {}) }),
      fail: error => {
        // A step the player declined, e.g. Stay here on "Leave this area?", is no failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        send({ type: 'failed', session: started, message: error instanceof Error ? error.message : 'The action could not complete. Try again.' });
      },
      // An action that ended without a receipt, e.g. one whose view shows its own outcome, never leaves its progress behind.
      end: () => { if (progress?.owner !== token) return; progress = null; if (progressInStatus) report(''); },
    };
  }
  async function run(action?: HubRow) {
    const row = action ?? rows.find(row => row.id === state.selected);
    if (!row) return;
    // One action at a time per page: Enter names the running one instead of starting another.
    if (busy()) { report(running!.again); return; }
    if (row.unavailable) { report(row.unavailable); return; }
    const task = startTask();
    const mine = { session: state.session, label: row.pending?.label ?? row.action, again: row.pending?.again ?? `${row.action} is still running.` };
    running = mine; select(state.selected); report(''); if (row.pending) task.progress(row.pending.label);
    try {
      // A command example fills Home's search and selects its argument; nothing runs.
      if (row.searchQuery !== undefined) {
        send({ type: 'home' }); input.value = row.searchQuery; step({ type: 'type', query: row.searchQuery }); refresh(true);
        const argument = parseHubQuery(input.value).scope ? input.value.indexOf(' ') + 1 : 0;
        requestFocus({ zone: 'search', range: [argument, input.value.length] });
      }
      else { sync(); await row.run(task); }
    }
    catch (error) { task.fail(error); }
    finally { task.end(); if (running === mine) { running = null; if (root.open) select(state.selected); } }
  }
  function resetView() {
    keepDrafts(); modal.pageChanged(); closeMenu(false);
    disposeView?.(); disposeView = null; content.replaceChildren(); patch('view', { hidden: true });
    viewFooter = null; viewRunning = false; actionFocus = null; viewArming?.arming.disarm(); viewArming = null;
    patch('search', { hidden: false }); patch('results', { hidden: false });
  }
  /** Draws Home with the query the engine brought back. */
  function drawHome(focus: HubFocusTarget) {
    resetView(); input.value = state.query;
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
    if (root.open) { sync(); frame = panel.getBoundingClientRect(); }
    step({ type: 'close' });
    resetView(); sync(); modal.close(); for (const source of sources.keys()) source.setVisible(false);
    input.value = ''; report(''); put('announce', '');
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
      if (carriedFailure?.message === message) carriedFailure = null;
      if (receiptInStatus && statusText() === message) report('');
      if (model.receipt.text === message) {
        clearTimeout(receiptTimer); receipt.hidePopover(); patch('receipt', { hidden: true, announcement: '' });
      }
      return;
    }
    if (root.open) { report(message, true); return; }
    if (outcome === 'failed') carriedFailure = {message, at: Date.now()};
    clearTimeout(receiptTimer);
    receiptTimer = setTimeout(() => { receipt.hidePopover(); patch('receipt', { hidden: true, announcement: '' }); }, 8000);
    patch('receipt', { announcement: message, text: message, hidden: false, outcome: outcome ?? 'done', tone: outcome === 'failed' ? 'error' : 'success',
      ...(frame?.width ? { place: { left: `${frame.left + frame.width / 2}px`, bottom: `${Math.max(8, window.innerHeight - frame.bottom + 12)}px`, maxWidth: `${Math.max(0, frame.width - 24)}px` } } : {}) });
    // A passive top-layer receipt stays above popouts without taking focus or intercepting game input.
    sync(); receipt.showPopover();
  }
  function suspend() {
    if (!root.open) return;
    sync(); frame = panel.getBoundingClientRect();
    step({ type: 'suspend', scroll: scrollTop(), focus: focusTarget() });
    modal.close();
    for (const source of sources.keys()) source.setVisible(false);
  }
  /**
   * Resumes a suspended page. Suspending hides the Hub without unmounting it, so a page still
   * mounted keeps its drafts, its confirmation and its view state; only its facts refresh
   * (HUB-050). A resumed Hub search is selected, so typing starts a new search (D-11).
   */
  function resumePage(page: Page, mounted: boolean) {
    if (!mounted) restorePage(page);
    else { if (!page.view) refresh(); requestFocus(page.focus, true); }
    if (document.activeElement === input) input.select();
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
    if (root.open) { send({ type: 'show' }); input.select(); return; }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearTimeout(receiptTimer); receipt.hidePopover(); patch('receipt', { hidden: true, announcement: '' });
    window.dispatchEvent(new Event('gw:input-reset'));
    sync(); modal.show();
    const opened = step({ type: 'show', fresh });
    window.dispatchEvent(new Event('gw:hub-visible'));
    for (const source of sources.keys()) source.setVisible(sourceEnabled(source));
    apply(opened);
    if (carriedFailure && Date.now() - carriedFailure.at <= HUB_RESUME_MS) report(carriedFailure.message, true);
    carriedFailure = null;
  }
  input.addEventListener('input', () => { step({ type: 'type', query: input.value }); if (!receiptInStatus) report(''); refresh(true); });
  // List stages keep DOM focus in search; the selection moves by aria-activedescendant (D-2).
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    // Only paging needs row geometry; ordinary typing and arrows must not force this layout.
    const page = event.key === 'PageUp' || event.key === 'PageDown'
      ? (sync(), Math.max(1, Math.floor(list.clientHeight / (list.querySelector<HTMLElement>('.hub-row')?.offsetHeight || 40)) - 1)) : 1;
    const caretAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    send({ type: 'key', key: hubKey(event), where: { at: 'search', rows: rows.map(row => ({ id: row.id, navigate: !!row.navigate })), busy: busy(), page, caretAtEnd } }, { event });
  });
  // A press on a result keeps the keyboard in search.
  list.addEventListener('mousedown', event => {
    if (!onRates(event)) event.preventDefault();
  });
  list.addEventListener('pointerleave', () => hover.release());
  // ⌘⌫ is Back from any focus inside the Hub, text fields included, once a view stepped out of
  // its own inner level, the menu closed and a disclosure closed; ⌘J opens and closes Actions
  // from anywhere in the Hub (D-1). The Hub owns both presses either way.
  root.addEventListener('keydown', event => {
    const disclosure = event.target instanceof Element ? event.target.closest('details[open]') : null;
    send({ type: 'key', key: hubKey(event), where: { at: 'hub', handled: event.defaultPrevented, disclosure: !!disclosure && root.contains(disclosure) } }, { event });
  });
  root.addEventListener('mouseup', event => { if (event.button === 3) { event.preventDefault(); back(); } });
  root.addEventListener('keydown', event => {
    // Typing on a button or blank space returns to the page's search, the header's included;
    // Space still presses the button. A form keeps its keys: a form view has no search, and
    // a form region a view marks with data-hub-form (Travel's Customize) stays form-first.
    const field = searchField();
    if (!event.defaultPrevented && field && event.target instanceof HTMLElement && event.target !== field && !event.target.isContentEditable
      && !event.target.matches('input,textarea,select') && !event.target.closest('[data-hub-form]')
      && !(event.key === ' ' && event.target.matches('button,summary')) && resumeSearchInput(event, field)) return;
    // Enter in a view runs its named primary, except on a control that Enter activates itself;
    // ⌘↵ runs it from any field of a form (HUB-152).
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (event.defaultPrevented || !target || !content.contains(target)) return;
    send({ type: 'key', key: hubKey(event), where: { at: 'view', primary: !!viewFooter?.primary, form: !!target.closest('form'),
      activates: target.matches('button,a[href],summary,select,textarea,input[type=checkbox],input[type=radio],input[type=range]') } }, { event });
  });
  function showBuildDetails(row: HubRow) {
    const incoming = state.place.scope?.summary;
    presenter.showView('Build details', target => {
      const details = ui.mountBuildDetails(target, [...(incoming ? [incoming] : []), row]);
      details.element.focus();
      return details.dispose;
    });
  }
  type MenuEntry = Readonly<{ label: string; section: 'Primary' | 'Details' | 'Personalize'; keys?: readonly string[]; destructive?: boolean; disabled?: boolean; reason?: string; run(): void | Promise<void> }>;
  /**
   * A row's Actions, verb first: its primary (↵), a second way into it (build details, rates),
   * then pinning and a search phrase for rows the Hub can keep (HUB-040, HUB-184).
   */
  function menuEntries(row: HubRow): MenuEntry[] {
    const entries: MenuEntry[] = [{ label: row.action, section: 'Primary', keys: ['↵'], ...(row.destructive ? { destructive: true } : {}), disabled: !!row.unavailable, ...(row.unavailable ? { reason: row.unavailable } : {}), run: () => run() }];
    for (const action of row.menuActions?.() ?? []) entries.push({
      label: action.action, section: 'Details', disabled: !!action.unavailable,
      ...(action.unavailable ? { reason: action.unavailable } : {}),
      ...(action.destructive ? { destructive: true } : {}),
      run: () => {
        if (state.selected !== row.id || !rows.some(current => current.id === row.id)) { report('This person is no longer selected. Choose a result.'); return; }
        return run(action);
      },
    });
    if (row.skills || state.place.scope?.summary?.skills) entries.push({ label: 'Show build details', section: 'Details', run: () => showBuildDetails(row) });
    else if (!row.menuActions && row.actions && row.actionsLabel) entries.push({ label: row.actionsLabel, section: 'Details', run: () => row.actions?.() });
    if (row.workspace) entries.push({ label: 'Open in Build Library', section: 'Details', run: row.workspace });
    if (isHubShortcuts([{ id: row.id, phrase: '', pinned: false }]) && lookup(row.id)) {
      const pinned = shortcuts().some(entry => entry.id === row.id && entry.pinned);
      entries.push({ label: pinned ? 'Unpin from Hub' : 'Pin to Hub', section: 'Personalize', run: async () => {
        const task = startTask();
        const entries = shortcuts(); const old = entries.find(entry => entry.id === row.id);
        const edited = { id: row.id, phrase: old?.phrase ?? '', pinned: !old?.pinned };
        try { await saveShortcuts(old ? entries.map(entry => entry.id === row.id ? edited : entry) : [...entries, edited]); const receipt = pinned ? `Unpinned ${row.title}.` : `Pinned ${row.title}.`; if (task.live()) report(receipt); else task.done(receipt); }
        catch { task.fail(new Error('Could not update the pin. Try again.')); }
      } });
      entries.push({ label: 'Set search phrase…', section: 'Personalize', run: () => editHubShortcut(presenter, row, shortcutStore, () => !!lookup(row.id)) });
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
    const items: HubMenuItem[] = entries.map(entry => ({ ...entry, click: event => { if (event.detail > 1) return; closeMenu(); void entry.run(); } }));
    // The menu stands on the footer, however tall the footer is.
    sync();
    patch('menu', { hidden: false, items, bottom: `${footer.offsetHeight + 8}px` }); patch('actions', { expanded: true });
    if (entries.some(entry => !entry.disabled)) requestFocus({ zone: 'menu' }); else sync();
  }
  /** Closes the Actions menu; with `refocus` the keyboard goes to the Hub's fallback. Whether a menu was open. */
  function closeMenu(refocus = true) {
    if (model.menu.hidden) return false;
    patch('menu', { hidden: true, items: NONE }); patch('actions', { expanded: false });
    if (state.menu) step({ type: 'menu-closed' });
    // A menu that closes under the keyboard hands it on in this paint (its focus zone), before the next key.
    if (refocus) requestFocus(HUB_FALLBACK); else if (ui.focus.at() === 'menu') sync();
    return true;
  }
  // The menu's own keys: its focus zone takes the shared list move; Esc closes only the menu, Tab leaves it.
  menu.addEventListener('keydown', event => send({ type: 'key', key: hubKey(event), where: { at: 'menu' } }, { event }));
  // A press anywhere else in the Hub closes the menu; the Actions button toggles it itself.
  root.addEventListener('pointerdown', event => { if (!model.menu.hidden && event.target instanceof Node && !menu.contains(event.target) && !actionsButton.contains(event.target)) closeMenu(false); }, true);
  // Every page uses the same Actions menu.
  // A double-click's second press never toggles the menu shut or runs anything (PTR-17).
  actionsButton.onclick = event => { if (event.detail > 1) return; if (!closeMenu()) openMenu(); };
  closeButton.onclick = () => close();
  // The primary acts once per click run, so a double-click on it runs its action once.
  backButton.onclick = back;
  primary.onclick = event => { if (event.detail > 1) return; if (viewFooter) void runViewAction(viewFooter.primary ?? done, event); else void run(); };
  root.addEventListener('close', () => { if (!root.open && !state.suspended) close(); });
  const onBlur = () => suspend();
  const onSettings = () => {
    for (const source of sources.keys()) source.setVisible(root.open && sourceEnabled(source));
    withdrawPages();
  };
  window.addEventListener('blur', onBlur); window.addEventListener('gw:tools-settings', onSettings);
  /** A new page starts over the open Hub's page, which Back returns to, or as the only page of a fresh Hub. */
  function enterPage(place: (current: Place) => Place, query?: string) {
    const fromOpenHub = root.open;
    if (!fromOpenHub) openHub(true);
    step({ type: 'enter', place: place(state.place), ...(query === undefined ? {} : { query }), remember: fromOpenHub,
      scroll: fromOpenHub ? scrollTop() : 0, focus: fromOpenHub ? focusTarget() : { zone: 'results' } });
  }
  /** Mounts a view page, a new one or one that Back restores, with its footer and drafts. */
  function mountView(view: MountedView) {
    resetView(); if (!receiptInStatus) report(''); clearTimeout(announceTimer); resultAnnouncement = ''; patch('empty', { hidden: true });
    put('page', 'section'); patch('caption', { text: view.title });
    patch('preview', { hidden: true }); patch('rates', { hidden: true }); patch('hint', { hidden: true });
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
    sync();
    disposeView = view.mount(content, restoreParent, shell);
    restoreDrafts([...state.history.map(pageTitle), view.title].join(' › '));
    paintNavigation();
    // A view that took the keyboard keeps it; else its first usable control, never <body>.
    if (ui.focus.at() !== 'view') requestFocus({ zone: 'view' });
  }
  /** A presenter call leaves the DOM drawn, so its caller can measure and focus right after. */
  const synced = <A extends unknown[], R>(action: (...args: A) => R) => (...args: A): R => { try { return action(...args); } finally { sync(); } };
  const presenter = {
    show: synced(show), close: synced(() => close()), suspend: synced(suspend), openSettings: synced(showSettings), direct: synced(direct),
    suspendedOn: (destination: HubDestination) => hubSuspendedOn(state, destination, env()),
    /** A mounted view replaced its own page (a confirmation): a click run from before it is cancelled. */
    pageChanged: () => modal.pageChanged(),
    get visible() { return root.open; },
    /** Whether Esc on an empty query goes back to a parent page rather than closing the Hub. */
    get hasParent() { return state.history.length > 0; },
    attach: synced((next: HubSource) => {
      sources.set(next, next.subscribe(() => {
        // A scoped list belongs to its source; peer observations only update navigation facts.
        const owner = state.place.scope?.owner;
        if (owner && owner !== next) { if (root.open) paintSourceFacts(); return; }
        scheduleRefresh();
      })); next.setVisible(root.open && sourceEnabled(next)); refresh();
      return () => {
        sources.get(next)?.(); sources.delete(next); next.setVisible(false);
        withdrawPages();
      };
    }),
    showRows: synced((title: string, getRows: () => readonly HubRow[], summary?: HubSummary, destination?: HubDestination, owner?: HubSource, query: string = '') => {
      const scope: RowScope = { title, rows: getRows, ...(summary ? { summary } : {}), ...(destination ? { destination } : {}), ...(owner ? { owner } : {}) };
      enterPage(() => ({ scope, view: null }), query);
      resetView(); put('page', 'section'); patch('caption', { text: title });
      nameSearch(title); input.value = query; if (!receiptInStatus) report(''); refresh(true); requestFocus({ zone: 'results' });
    }),
    showView: synced((title: string, mount: HubViewMount<HTMLElement>, available?: () => boolean, destination?: HubDestination, owner?: HubSource) => {
      const view: MountedView = { title, mount, ...(available ? { available } : {}), ...(destination ? { destination } : {}), ...(owner ? { owner } : {}) };
      enterPage(current => ({ scope: current.scope, view }));
      mountView(view);
    }),
    notify: synced(notify),
    browseBuilds: synced(() => { direct('builds', () => { const row = lookup('builds'); if (row && !row.unavailable) void row.run(startTask()); else report('Build Library is unavailable.'); }); }),
    resetPosition: hubWindow.reset,
    dispose() { close(); glyphResize.disconnect(); cancelAnimationFrame(glyphFrame); clearTimeout(receiptTimer); receipt.hidePopover(); hubWindow.dispose(); disposeFrame(); for (const unsubscribe of sources.values()) unsubscribe(); sources.clear(); modal.dispose(); disposed = true; ui.dispose(); window.removeEventListener('blur', onBlur); window.removeEventListener('gw:tools-settings', onSettings); },
  };
  presenter.attach(createHubAccounts(presenter, { get: () => window.gwNative.accounts.get(), open: request => window.gwNative.accounts.open(request), manage: () => window.gwNative.app.showLauncher() }));
  presenter.attach(createHubCalculator({
    hub: presenter,
    settings: () => window.gwToolsSettings?.().calculatorRates ?? DEFAULT_CALCULATOR_RATES,
    saveRates: async calculatorRates => { await window.gwNative.settings.set({ calculatorRates }); },
    // A copy names what it put on the clipboard in the status line (D-8); it is never silent.
    copy: async (value,label=value) => { await window.gwNative.clipboard.writeText(value); notify(`Copied “${label}”`); },
    marketEnabled: () => !!window.gwToolsSettings?.().gwonmacTools && !!window.gwToolsSettings?.().tradeChat,
    market: () => 'trade' in window.gwNative ? window.gwNative.trade.getMarketRates() : Promise.reject(new Error('Rate unavailable')),
    quotes: () => 'trade' in window.gwNative ? window.gwNative.trade.getTraderQuotes() : Promise.reject(new Error('Rate unavailable')),
  }));
  return presenter;
}
export type Hub = ReturnType<typeof createHub>;

/**
 * Loads the Hub's Vue view and creates the Hub. The view module is a build artifact beside the
 * Tools bundle, `tools/hub-app.js`, but holds no Tools code, so every launch loads it, Core included.
 */
export async function loadHub(parent: HTMLElement): Promise<Hub> {
  // A build artifact: the specifier goes through a variable so the compiler does not resolve it.
  const specifier = './tools/hub-app.js';
  return createHub(parent, await import(specifier) as EmbeddedHubView);
}
