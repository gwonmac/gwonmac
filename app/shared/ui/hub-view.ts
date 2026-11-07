/**
 * The contract between the Hub's controller (app/renderer/hub.ts) and its Vue view
 * (app/ui/tools/src/hub, built as `tools/hub-app.js`). The controller owns state, search,
 * keyboard and focus; the view draws exactly these facts and hands back the elements the
 * controller measures, focuses and attaches its listeners to. Core loads the view module
 * alone, never the Tools application.
 */
import type { HubRow, HubSummary } from '../hub.js';
import type { resolveShortcuts } from '../keyboard-shortcuts.js';

export type HubShortcutBindings = ReturnType<typeof resolveShortcuts>;
/** A footer legend entry: its keycaps, then its word. */
export type HubLegendEntry = readonly [keys: readonly string[], label: string];
export type HubMenuItem = Readonly<{
  label: string; section: 'Primary' | 'Details' | 'Personalize'; keys?: readonly string[];
  destructive?: boolean; disabled?: boolean; reason?: string;
  click(event: MouseEvent): void;
}>;
/** The calculator's Price basis picker. It stands in the row it prices, else before the results. */
export type HubRateControls = Readonly<{
  /** The row that holds the picker; null while it waits before the results. */
  host: string | null;
  hidden: boolean;
  /** Absent until a priced row was first selected; the picker then stays built. */
  basis: Readonly<{ value: string; options: readonly Readonly<{ value: string; label: string }>[] }> | null;
  detailsLabel: string;
  change(value: string): void;
  keydown(event: KeyboardEvent): void;
  details(): void;
}>;
/** The calculation input's measuring layer: the typed text, with currency art after each unit. */
export type HubGlyphs = Readonly<{
  hidden: boolean;
  calculation: boolean;
  box: Readonly<{ left: number; top: number; width: number; height: number }> | null;
  segments: readonly Readonly<{ text: string; token?: Readonly<{ start: number; end: number; unit: string }> }>[];
  icons: readonly Readonly<{ url: string; unit: string; left: number }>[];
}>;
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
}>;
export type HubPrimary = Readonly<{ label: string; art?: string; keycap: boolean; disabled: boolean; variant: 'primary' | 'danger' }>;
export type HubReceipt = Readonly<{
  text: string; announcement: string; hidden: boolean;
  outcome?: string; tone?: string;
  place?: Readonly<{ left: string; bottom: string; maxWidth: string }>;
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
    activeDescendant?: string | undefined; description?: string | undefined; calculation: boolean;
  }>;
  glyphs: HubGlyphs;
  rates: HubRateControls;
  results: Readonly<{
    hidden: boolean; previewList: boolean;
    rows: readonly HubRow[]; painted: number; selected: string | null; compact: boolean;
    bindings: HubShortcutBindings;
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
  menu: Readonly<{ hidden: boolean; bottom?: string; items: readonly HubMenuItem[] }>;
  receipt: HubReceipt;
};

/** The stable elements the controller keeps; the view never replaces them. */
export type HubViewElements = Readonly<{
  root: HTMLDialogElement; panel: HTMLElement; heading: HTMLElement; lock: HTMLButtonElement; resize: HTMLElement;
  back: HTMLButtonElement; close: HTMLButtonElement; search: HTMLElement; input: HTMLInputElement; glyphs: HTMLElement;
  results: HTMLElement; view: HTMLElement; footer: HTMLElement; primary: HTMLButtonElement; actions: HTMLButtonElement;
  menu: HTMLElement; receipt: HTMLElement;
}>;
export type HubBuildDetails = readonly (HubSummary | HubRow)[];
export type HubViewHandle = Readonly<{
  elements: HubViewElements;
  /** Redraws the model now, so the controller can measure and focus right after. */
  paint(model: HubViewModel): void;
  /** Mounts Build details into a view host; returns its section and its disposal. */
  mountBuildDetails(target: HTMLElement, builds: HubBuildDetails): Readonly<{ element: HTMLElement; dispose(): void }>;
  dispose(): void;
}>;
/** The exports of the Hub view module (`app/ui/tools/src/hub/embedded.ts`, built to `tools/hub-app.js`). */
export type EmbeddedHubView = Readonly<{ mountHubView(parent: HTMLElement, model: HubViewModel): HubViewHandle }>;
