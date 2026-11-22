/**
 * Shared lifetime for independent Build Library and Trade windows.
 *
 * Builds & Teams and Trade Chat mount lazily into explicit hosts. They may be
 * open together; the last interacted host owns visual stacking, Escape and
 * Tab. There is intentionally no registry or general layout system.
 *
 * The Trade window opens before its window part has loaded, so this host
 * provides Trade Chat's link (`toggle`, `search`) while its Trade slot exists.
 *
 * The Build Library opens through its link `toggle` (its shortcut and game menu item), which
 * this host provides while it exists: the window part starts only when first opened, so it
 * cannot provide the link that opens it.
 */
import { createNonActivatingSurface, isolateFromGame } from "./non-activating-surface.js";
import { LIBRARY_UNAVAILABLE } from "../shared/hub-preferences.js";
import type { ToolboxObservation } from "../shared/builds/live-party.js";
import type { FeatureLinks, ToolIntent, ToolLink, WindowToolTarget } from "../features/links.js";
import type { RunningPart } from "../features/parts.js";
import type { FeatureId } from "../shared/feature-contracts.js";
import type { TradeChatLink } from "../features/trade-chat/shared/link.js";
import { provideLink } from "./feature-links.js";

type ToolboxState = ToolboxObservation;

const OVERLAY_CSS = `
#toolbox-foundation {
  /* No box and no stacking context: each tool host stacks at the root, beside Whispers (HUB-108). */
  display: contents;
  pointer-events: none;
  color: #e8e4d8;
  font: 12px/1.45 -apple-system, "SF Pro Text", "Segoe UI", sans-serif;
}
#toolbox-foundation > [data-role] {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
`;

/** A window part as this host runs it (the `window` kind, app/features/parts.ts). */
export interface MountedTool extends RunningPart {
  setVisible(visible: boolean): void;
  setActive?(active: boolean): void;
  requestClose(): void;
  /** Steps out of one inner level (a menu, drawer or sub-view); false when none is open. */
  stepBack?(): boolean;
  search?(query: string): void;
  update(state: ToolboxState): void;
}

/**
 * What a window part's `start` gets: its host element, how it reports that it closed
 * itself, how it asks to show on its own over the game (out of an open Hub), and the links
 * its manifest names with their change signal (feature-links.ts).
 */
export type WindowContext<Id extends FeatureId> = Readonly<{
  host: HTMLElement;
  onVisibilityChange(visible: boolean): void;
  show(): void;
  links: FeatureLinks<Id>;
  onLinksChange(listener: () => void): () => void;
}>;

type MountTool = (
  host: HTMLElement,
  onVisibilityChange: (visible: boolean) => void,
  show: () => void,
) => Promise<MountedTool | null>;

type FoundationOptions = {
  /** Existing Builds & Teams mount. The name stays compatible with fixtures. */
  mountTool: MountTool;
  /** The separate host-only Trade Chat mount. */
  mountTrade?: MountTool;
};

type Slot = {
  readonly name: "builds" | "trade";
  readonly host: HTMLElement;
  readonly mount: MountTool;
  readonly surface: GwonmacSurfaceHandle;
  tool: MountedTool | null;
  requested: boolean;
  visible: boolean;
  query?: string;
};

export type ToolboxAvailability = Readonly<{
  builds: boolean;
  trade: boolean;
}>;

export function createToolboxFoundation(
  parent: HTMLElement,
  options: FoundationOptions,
) {
  const document = parent.ownerDocument;
  const canvas = document.getElementById("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Tools game canvas is missing");
  }

  const style = document.createElement("style");
  style.id = "toolbox-foundation-style";
  style.textContent = OVERLAY_CSS;
  const root = document.createElement("section");
  root.id = "toolbox-foundation";
  root.setAttribute("aria-label", "Tools");
  const buildsHost = makeHost(document, "toolbox-builds", "builds");
  const tradeHost = makeHost(document, "toolbox-trade", "trade");
  root.append(buildsHost, tradeHost);
  parent.append(style, root);

  const nonActivating = createNonActivatingSurface(root, () => canvas);
  let state: ToolboxState = Object.freeze({ status: "waiting" });
  let disposed = false;
  let active: Slot | null = null;
  let focusFrame: number | undefined;
  let pendingFocus: Slot | null = null;
  const cancelPendingFocus = () => {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    focusFrame = undefined;
    pendingFocus = null;
  };
  window.addEventListener("keydown", cancelPendingFocus, true);
  window.addEventListener("pointerdown", cancelPendingFocus, true);
  let availability: ToolboxAvailability = { builds: true, trade: true };

  const requestClose = (slot: Slot): void => {
    if (!slot.visible) return;
    if (slot.tool) slot.tool.requestClose();
    else setOpen(slot, false);
  };
  const makeSlot = (
    name: Slot["name"],
    element: HTMLElement,
    mount: MountTool,
  ): Slot => {
    const slot: Slot = {
      name,
      host: element,
      mount,
      tool: null,
      requested: false,
      visible: false,
      surface: window.gwSurfaces.register({
        root: element,
        priority: 4,
        dismiss: () => requestClose(slot),
        // Escape leaves the tool's innermost level first, even while the game holds focus (HUB-120).
        escape: () => { if (!slot.tool?.stepBack?.()) requestClose(slot); },
      }),
    };
    return slot;
  };
  const builds = makeSlot("builds", buildsHost, options.mountTool);
  const trade = options.mountTrade
    ? makeSlot("trade", tradeHost, options.mountTrade)
    : null;
  const slots = (): Slot[] => trade ? [builds, trade] : [builds];

  const activate = (slot: Slot) => {
    cancelPendingFocus();
    active = slot;
    slot.surface.raise();
    for (const candidate of slots()) {
      candidate.tool?.setActive?.(candidate === slot);
    }
  };

  const ensure = (slot: Slot) => {
    if (slot.requested) return;
    slot.requested = true;
    void slot.mount(slot.host, (visible) => setOpen(slot, visible), () => openFloating(slot))
      .then((mounted) => {
        if (disposed) {
          mounted?.stop();
          return;
        }
        slot.tool = mounted;
        if (slot.query !== undefined) { mounted?.search?.(slot.query); delete slot.query; }
        mounted?.setVisible(slot.visible);
        mounted?.setActive?.(active === slot);
        if (slot.name === "builds") mounted?.update(state);
        if (pendingFocus === slot) {
          if (mounted) focusFloating(slot);
          else pendingFocus = null;
        }
      });
  };

  const setOpen = (slot: Slot, next: boolean) => {
    if (slot.visible === next) return;
    cancelPendingFocus();
    slot.visible = next;
    if (!next && slot.host.closest('#hub')) window.gwHub?.close();
    if (next) {
      ensure(slot);
      activate(slot);
    }
    slot.tool?.setVisible(next);
    slot.host.dataset.open = String(next);
    slot.surface.setOpen(next);
    root.dataset.open = String(slots().some((candidate) => candidate.visible));
    if (next && document.pointerLockElement !== null) document.exitPointerLock();
    if (!next && active === slot) {
      active = slots().filter((candidate) => candidate.visible)
        .sort((left, right) => Number(right.host.style.zIndex) - Number(left.host.style.zIndex))[0] ?? null;
      active?.surface.raise();
      for (const candidate of slots()) candidate.tool?.setActive?.(candidate === active);
    }
    nonActivating.releaseKeyboard();
  };

  const toggle = (slot: Slot) => slot.visible ? requestClose(slot) : setOpen(slot, true);
  for (const slot of slots()) {
    slot.host.addEventListener("pointerdown", () => {
      if (slot.visible) { activate(slot); }
    }, true);
  }

  const openFloating = (slot: Slot) => {
    window.gwHub?.suspend();
    setOpen(slot, true); activate(slot);
    // Keep the request through lazy mounting; a later press or surface change cancels it.
    pendingFocus = slot;
    focusFloating(slot);
  };
  function focusFloating(slot: Slot) {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = undefined;
      if (pendingFocus !== slot || disposed || !slot.visible || active !== slot) return;
      const input = [...slot.host.querySelectorAll<HTMLInputElement>('input')]
        .find(input => !input.disabled && input.getClientRects().length);
      if (input) {
        pendingFocus = null;
        input.focus();
      }
    });
  }
  /** The Build Library's link `toggle`: its shortcut and game menu item. */
  const openBuilds = (intent: ToolIntent): ReturnType<ToolLink["toggle"]> => {
    if (disposed || !availability.builds) return "unavailable";
    // An open Hub, or one suspended on the Build Library's pages, takes ⌘B as a direct shortcut.
    if (window.gwHub?.visible || window.gwHub?.suspendedOn('builds')) {
      window.gwHub.openRow('builds', 'builds', LIBRARY_UNAVAILABLE);
      return "shown";
    }
    if (intent === "show") openFloating(builds);
    else toggle(builds);
    return builds.visible ? "shown" : "hidden";
  };
  const openTrade = (intent: ToolIntent, query?: string): "shown" | "hidden" | "unavailable" => {
    if (!trade || !availability.trade) return "unavailable";
    if (query !== undefined) {
      if (trade.tool) trade.tool.search?.(query);
      else trade.query = query;
    }
    // ⌘K opens Trade with its search focused, from the game as from the Hub, and hides it only
    // when the Hub is not open (HUB-128, HUB-036).
    if (intent === "show" || window.gwHub?.visible || !trade.visible) {
      openFloating(trade);
      return "shown";
    }
    requestClose(trade);
    return "hidden";
  };
  const tradeLink: TradeChatLink = Object.freeze({
    toggle: (intent: ToolIntent) => openTrade(intent),
    search: (query: string) => openTrade("show", query) === "shown" ? "shown" : "unavailable",
  });
  const stopTradeLink = trade ? provideLink("tradeChat", tradeLink) : () => {};

  isolateFromGame(root);

  const mirrorCursor = () => { root.style.cursor = canvas.style.cursor; };
  const cursorMirror = new MutationObserver(mirrorCursor);
  cursorMirror.observe(canvas, { attributes: true, attributeFilter: ["style"] });
  mirrorCursor();
  const onHub = () => { if (availability.builds) ensure(builds); };
  window.addEventListener("gw:hub-visible", onHub);
  // The client may finish mounting Tools after Hub has already opened.
  if (window.gwHub?.visible) onHub();

  return {
    openBuilds,
    update(next: ToolboxState) {
      state = next;
      builds.tool?.update(next);
    },
    setAvailable(next: ToolboxAvailability) {
      availability = next;
      if (!next.builds) setOpen(builds, false);
      else if (window.gwHub?.visible) ensure(builds);
      if (trade && !next.trade) setOpen(trade, false);
    },
    get state() { return state; },
    dispose() {
      disposed = true;
      cancelPendingFocus();
      window.removeEventListener("keydown", cancelPendingFocus, true);
      window.removeEventListener("pointerdown", cancelPendingFocus, true);
      for (const slot of slots()) {
        slot.tool?.stop();
        slot.surface.dispose();
      }
      nonActivating.dispose();
      cursorMirror.disconnect();
      window.removeEventListener("gw:hub-visible", onHub);
      stopTradeLink();
      window.dispatchEvent(new CustomEvent("gw:input-reset"));
      if (root.contains(document.activeElement)) canvas.focus({ preventScroll: true });
      style.remove();
      root.remove();
    },
  };
}

export function createToolboxLifecycle(
  parent: HTMLElement,
  { buildsLink, ...options }: FoundationOptions & Readonly<{
    /** The Feature whose window the builds slot holds; this host provides its link `toggle`. */
    buildsLink: WindowToolTarget;
  }>,
) {
  let foundation: ReturnType<typeof createToolboxFoundation> | null = null;
  let state: ToolboxState = Object.freeze({ status: "waiting" });
  let availability: ToolboxAvailability = { builds: true, trade: true };
  let disposed = false;
  const stopLink = provideLink(buildsLink, { toggle: (intent) => foundation?.openBuilds(intent) ?? "unavailable" });
  return {
    setEnabled(enabled: boolean) {
      if (disposed) return;
      if (enabled) {
        if (foundation) return;
        foundation = createToolboxFoundation(parent, options);
        foundation.update(state);
        foundation.setAvailable(availability);
      } else {
        foundation?.dispose();
        foundation = null;
      }
    },
    update(next: ToolboxState) {
      state = next;
      foundation?.update(next);
    },
    setAvailable(next: ToolboxAvailability) {
      availability = next;
      foundation?.setAvailable(next);
    },
    get state() { return foundation?.state ?? null; },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopLink();
      foundation?.dispose();
      foundation = null;
    },
  };
}

function makeHost(document: Document, id: string, role: string): HTMLElement {
  const element = document.createElement("div");
  element.id = id;
  element.dataset.role = role;
  return element;
}
