/**
 * The contract between the Hub's controller (app/renderer/hub.ts with its engine,
 * hub-engine.ts) and its Vue view (app/ui/tools/src/hub, built as `tools/hub-app.js`). The
 * controller owns state, search and where the keyboard should be, as a focus target, and
 * paints once per entry point; the view draws exactly these facts, owns the focus zones that
 * put the keyboard there and every measurement (currency art, scroll, the menu's and the
 * receipt's place), and hands back the elements the controller attaches its listeners to. Core
 * loads the view module alone, never the Tools application.
 */
import type { HubRow, HubSummary } from '../hub.js';
import type { Currency } from '../hub-calculator.js';
import type { resolveShortcuts } from '../keyboard-shortcuts.js';
import type { HubPages } from './hub-pages.js';

export type HubShortcutBindings = ReturnType<typeof resolveShortcuts>;
/** A footer legend entry: its keycaps, then its word. */
export type HubLegendEntry = readonly [keys: readonly string[], label: string];
export type HubMenuItem = Readonly<{
  label: string; section: 'Primary' | 'Details' | 'Personalize'; keys?: readonly string[];
  destructive?: boolean; disabled?: boolean; reason?: string;
  click(event: MouseEvent): void;
}>;
/**
 * What the calculation input's measuring layer repeats: the typed text while the query is a
 * calculation, and each currency unit's art. The view places the art after each unit itself
 * (HubSearchBar); the art's address stays the renderer's, so the view bundles no images.
 */
export type HubGlyphs = Readonly<{ calculation: boolean; text: string; art(unit: Currency): string | undefined }>;
/**
 * The Hub's focus zones. `results` is the list stage: DOM focus stays in the Hub search and the
 * selection moves by aria-activedescendant (D-2). `search` is the page's search: the Hub
 * search, else a view's own search field.
 */
export type HubFocusZone = 'search' | 'heading' | 'results' | 'view' | 'footer' | 'menu';
/**
 * Where the keyboard should be. A key names one control (its `data-focus-key`); without a key,
 * the zone's first control. A key that is gone, or a zone that is not shown, falls back to the
 * search when it shows, else the view's first control, else Back. `range` is a text selection.
 */
export type HubFocusTarget = Readonly<{ zone: HubFocusZone; key?: string; range?: readonly [number, number] }>;
/** A focus target the view applies once after the paint that carries a new `seq`. */
export type HubFocusRequest = HubFocusTarget & Readonly<{
  seq: number;
  /** A restored page's key may mount late (a loading view): it still takes the keyboard until the player acts. */
  wait?: boolean;
  /** A resumed or re-shown Hub search is selected once it holds the keyboard, so typing starts a new search (D-11). */
  select?: boolean;
}>;
export type HubPrimary = Readonly<{ label: string; art?: string; keycap: boolean; disabled: boolean; variant: 'primary' | 'danger' }>;
export type HubReceipt = Readonly<{
  text: string; announcement: string; hidden: boolean;
  outcome?: string; tone?: string;
  /** Where the Hub frame last stood: a receipt after closing appears in its footprint, not as a window toast. */
  frame?: Readonly<{ left: number; bottom: number; width: number }>;
}>;

/**
 * Everything the Hub shows. A field that is undefined was never written by the controller, so its
 * attribute stays absent, as on a Hub that has not opened yet. Nested objects are replaced, never
 * mutated, so the view redraws only what changed.
 */
export type HubViewModel = {
  page: 'home' | 'section';
  /** `data-busy` on the panel and `aria-busy` on the results and the view, once first painted. */
  busy?: Readonly<{ panel: boolean; list: boolean; view: boolean }>;
  /** Back: hidden at Home; after the first navigation paint it names its key and destination. */
  back: Readonly<{ hidden: boolean; destination?: string | undefined }>;
  caption: Readonly<{ text: string; current: boolean }>;
  crumbs: readonly Readonly<{ title: string; open(): void }>[];
  context: string;
  summary: HubSummary | null;
  scope: Readonly<{ text: string; hidden: boolean }>;
  search: Readonly<{
    hidden: boolean; placeholder: string; label: string; expanded: boolean;
    activeDescendant?: string | undefined; description?: string | undefined;
  }>;
  glyphs: HubGlyphs;
  results: Readonly<{
    hidden: boolean; previewList: boolean;
    rows: readonly HubRow[]; painted: number; selected: string | null; compact: boolean;
    bindings: HubShortcutBindings;
    /** Bring this row into view, once per new `seq`: a keyboard move to it. */
    reveal?: Readonly<{ id: string; seq: number }>;
    /** Scroll back to this offset, once per new `seq`, painting rows down to it first: a restored page. */
    scroll?: Readonly<{ top: number; seq: number }>;
    /** Paints the next chunk of a long list now, for a scroll position the painted rows do not reach. */
    more(): void;
  }>;
  empty: Readonly<{ hidden: boolean }>;
  preview: Readonly<{ text: string; hidden: boolean }>;
  view: Readonly<{ hidden: boolean }>;
  status?: Readonly<{ text: string; busy: boolean }>;
  lifecycle: Readonly<{ text: string; title?: string | undefined; hidden: boolean }>;
  hint: Readonly<{ text: string; title?: string | undefined; hidden: boolean }>;
  announce: string;
  legend?: readonly HubLegendEntry[];
  count: string;
  primary?: HubPrimary;
  actions: Readonly<{ keys: boolean; disabled: boolean; expanded: boolean }>;
  menu: Readonly<{ hidden: boolean; items: readonly HubMenuItem[] }>;
  receipt: HubReceipt;
  focus?: HubFocusRequest;
};

/** The stable elements the controller attaches its listeners to; the view never replaces them. */
export type HubViewElements = Readonly<{
  root: HTMLDialogElement; panel: HTMLElement; heading: HTMLElement; lock: HTMLButtonElement; resize: HTMLElement;
  back: HTMLButtonElement; close: HTMLButtonElement; input: HTMLInputElement;
  results: HTMLElement; view: HTMLElement; primary: HTMLButtonElement; actions: HTMLButtonElement; menu: HTMLElement;
}>;
export type HubBuildDetails = readonly (HubSummary | HubRow)[];
/** Where the keyboard is, read from the view's focus zones. */
export type HubFocusReader = Readonly<{
  /** The keyboard's place as a target a later paint can restore. */
  capture(): HubFocusTarget;
  /** The zone that holds the keyboard now; null outside the Hub. */
  at(): HubFocusZone | null;
  /** Where typing goes: the Hub search on list stages, else a list view's own search (Travel, Characters). */
  searchField(): HTMLInputElement | null;
}>;
/** The geometry the controller records with a page or a close; the view measures it. */
export type HubLayoutReader = Readonly<{
  /** The panel's place on screen, for a receipt after the Hub closes. */
  frame(): Readonly<{ left: number; bottom: number; width: number }>;
  /** The results' scroll offset, which Back and a resume restore. */
  scrollTop(): number;
  /** How many rows PageUp and PageDown move: one page of the list, less one row. */
  pageRows(): number;
}>;
export type HubViewHandle = Readonly<{
  elements: HubViewElements;
  /** Redraws the model now and applies its focus request; the controller calls it once per entry point. */
  paint(model: HubViewModel): void;
  focus: HubFocusReader;
  layout: HubLayoutReader;
  /** Mounts Build details into a view host; returns its section and its disposal. */
  mountBuildDetails(target: HTMLElement, builds: HubBuildDetails): Readonly<{ element: HTMLElement; dispose(): void }>;
  /** The Hub's own pages, which the controller hands to every view it mounts. */
  pages: HubPages<HTMLElement>;
  dispose(): void;
}>;
/** The art the footer's primary shows for a row: a conversion's target currency. */
export const hubPrimaryArt = (row: HubRow | undefined): string | undefined => row?.conversion?.iconTo;
/** Whether a row draws as the one before it, so its mounted option stays; its actions still come from the new row. */
export const hubRowPaintsSame = (row: HubRow, previous: HubRow | undefined): boolean => !!previous && row.id === previous.id && row.title === previous.title
  && row.detail === previous.detail && row.group === previous.group && row.icon === previous.icon
  && row.action === previous.action && row.destructive === previous.destructive && row.unavailable === previous.unavailable
  && row.readOnly === previous.readOnly && !!row.navigate === !!previous.navigate && row.preview === previous.preview
  && row.folder === previous.folder && row.attributeStatus === previous.attributeStatus
  && JSON.stringify([row.skills, row.attributes, row.professions, row.conversion]) === JSON.stringify([previous.skills, previous.attributes, previous.professions, previous.conversion]);

/** The exports of the Hub view module (`app/ui/tools/src/hub/embedded.ts`, built to `tools/hub-app.js`). */
export type EmbeddedHubView = Readonly<{ mountHubView(parent: HTMLElement, model: HubViewModel): HubViewHandle }>;
