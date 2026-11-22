/**
 * Owns the `window` part kind (app/features/parts.ts): a Feature window the Tools window hosts
 * beside the others, such as the Build Library and Trade Chat. A Feature declares one with
 * `windowPart` in its renderer/window.ts and lists it in app/features/window-parts.ts; the Tools
 * window (toolbox-foundation.ts) gives every declared part a host element, its Escape and focus
 * rules, and the typed link its declaration builds, with no branch per Feature.
 *
 * The part's view loads lazily, the first time the window opens, so the declaration builds its
 * link from the Tools window's control (`WindowControl`) instead of from the running view: the
 * link that opens the window exists before the window has loaded.
 */
import type { ToolboxObservation } from "../shared/builds/live-party.js";
import type { FeatureLinkApis, FeatureLinks, ToolLink, ToolLinkTarget } from "../features/links.js";
import type { PartOwner, RunningPart } from "../features/parts.js";
import { featureOn } from "./feature-on.js";

/** A Feature that declares a window part: it lists "window" in `parts` and offers `toggle`. */
export type WindowPartOwner = PartOwner<"window"> & ToolLinkTarget;

/**
 * What a window part's `start` gets: its host element, how it reports that it closed itself, how
 * it asks to show on its own over the game (out of an open Hub), and the links its manifest names
 * with their change signal (feature-links.ts).
 */
export type WindowContext<Id extends WindowPartOwner> = Readonly<{
  host: HTMLElement;
  onVisibilityChange(visible: boolean): void;
  show(): void;
  links: FeatureLinks<Id>;
  onLinksChange(listener: () => void): () => void;
}>;

/** A running window part, as the Tools window drives it. */
export type WindowRunning = RunningPart & Readonly<{
  setVisible(visible: boolean): void;
  setActive?(active: boolean): void;
  /** Closes the window its own way (it may ask first); it reports through `onVisibilityChange`. */
  requestClose(): void;
  /** Steps out of one inner level (a menu, drawer or sub-view); false when none is open. */
  stepBack?(): boolean;
  /** The companion's party feed, for a part that declares `party`. */
  update?(observation: ToolboxObservation): void;
}>;

/** The Tools window's hold on one part's window, which the part's link opens and closes it through. */
export type WindowControl<Running extends WindowRunning> = Readonly<{
  /** Whether the window may open now: the Tools window exists and the Feature is available. */
  readonly available: boolean;
  readonly visible: boolean;
  /**
   * Opens the window over the game: an open Hub steps aside, and the keyboard moves into the
   * window's first field a frame later unless the player presses a key first.
   */
  show(): void;
  /** Closes an open window (its own `requestClose`) or opens a closed one, leaving the keyboard with the game. */
  toggle(): void;
  /** Asks an open window to close. */
  close(): void;
  /** Calls `use` with the running view now, or as soon as it has started (in call order). */
  whenRunning(use: (running: Running) => void): void;
}>;

export type WindowPartDeclaration<Id extends WindowPartOwner, Running extends WindowRunning> = Readonly<{
  id: Id;
  /** Its host element is `toolbox-<element>`: page styles and tests find the window by it. */
  element: string;
  /** Its link, built once per Tools window from that window's control (`plainToggle` for a link that is only `toggle`). */
  link(window: WindowControl<Running>): FeatureLinkApis[Id];
  /** It draws the party feed: the Tools window observes the party while the Feature is on and hands it to `update`. */
  party?: true;
  /** It starts as soon as the Hub shows, because its view adds Hub pages (the Build Library). */
  startWithHub?: true;
  /**
   * It may open in every game area its switch allows, not only where its region does: saved
   * Build Library authoring works anywhere, while live observation and Apply keep their own gates.
   */
  anyArea?: true;
  /** Loads and starts its view in `context.host`; null when it could not load (it says so in its host). */
  start(context: WindowContext<Id>): Promise<Running | null>;
}>;

/**
 * The Tools window as a part adds itself to it. Its `slot` is generic, so each part keeps its
 * own link and running types inside the Tools window without a cast.
 */
export type ToolsWindowSlots = Readonly<{
  slot<Id extends WindowPartOwner, Running extends WindowRunning>(part: WindowPartDeclaration<Id, Running>): void;
}>;

/** A declared window part as the registry lists it: its declaration, and how it adds itself to a Tools window. */
export type WindowPart = Readonly<{
  id: WindowPartOwner;
  party?: true;
  anyArea?: true;
  addTo(window: ToolsWindowSlots): void;
}>;

/**
 * Whether a part's window may open now: everywhere its switch allows (`anyArea`, featureOn reads
 * main's facts alone) or where `on` has its Feature on here.
 */
export function windowAvailable(part: Pick<WindowPart, "id" | "anyArea">, on: (id: WindowPartOwner) => boolean): boolean {
  return part.anyArea === true ? featureOn(part.id) : on(part.id);
}

/** Declares a Feature's window part (the `window` kind). */
export function windowPart<Id extends WindowPartOwner, Running extends WindowRunning>(
  declaration: WindowPartDeclaration<Id, Running>,
): WindowPartDeclaration<Id, Running> & WindowPart {
  return Object.freeze({ ...declaration, addTo: (window: ToolsWindowSlots) => window.slot(declaration) });
}

/** The link of a window that is only shown or toggled: `show` opens it, `toggle` closes an open one. */
export function plainToggle(window: WindowControl<WindowRunning>): ToolLink {
  return Object.freeze({
    toggle(intent) {
      if (!window.available) return "unavailable";
      if (intent === "show") window.show();
      else window.toggle();
      return window.visible ? "shown" : "hidden";
    },
  });
}
