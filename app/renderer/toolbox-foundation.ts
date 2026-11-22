/**
 * The Tools window: the shared lifetime of the Feature windows it hosts (the `window` part kind,
 * window-part.ts), one host element per part in app/features/window-parts.ts.
 *
 * Each part mounts lazily into its own host. They may be open together; the last interacted host
 * owns visual stacking, Escape and Tab. There is intentionally no layout system. This window
 * provides every part's link for its whole life, built from the part's declaration over this
 * window's control, so a link that opens a window works before that window has loaded. No line
 * here names a Feature.
 */
import { createNonActivatingSurface, isolateFromGame } from "./non-activating-surface.js";
import type { ToolboxObservation } from "../shared/builds/live-party.js";
import type { FeatureId } from "../shared/feature-contracts.js";
import { WINDOW_PARTS } from "../features/window-parts.js";
import { featureLinks, onLinksChange, provideLink } from "./feature-links.js";
import { featureOn } from "./feature-on.js";
import { safely } from "./contained.js";
import { windowAvailable, type ToolsWindowSlots, type WindowControl, type WindowPart, type WindowPartDeclaration, type WindowPartOwner, type WindowRunning } from "./window-part.js";

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

export type ToolboxOptions = Readonly<{
  /** The window parts this Tools window hosts; the registry by default. */
  parts?: readonly WindowPart[];
  /**
   * Whether resolve has a Feature on here: the companion answers with the live play region, the
   * host-only Tools window with main's facts alone (featureOn, the default).
   */
  on?: (id: FeatureId) => boolean;
}>;

type Slot = {
  readonly id: WindowPartOwner;
  readonly party: boolean;
  readonly startWithHub: boolean;
  readonly host: HTMLElement;
  readonly surface: GwonmacSurfaceHandle;
  /** Starts the part's view once; the first open, a Hub show or a pop-out calls it. */
  readonly start: () => void;
  readonly stopLink: () => void;
  tool: WindowRunning | null;
  visible: boolean;
};

/** Whether the companion observes the party for the window parts: one that draws it is on here. */
export function windowPartsObserveParty(on: (id: FeatureId) => boolean, parts: readonly WindowPart[] = WINDOW_PARTS): boolean {
  return parts.some((part) => part.party && on(part.id));
}

export function createToolboxFoundation(parent: HTMLElement, { parts = WINDOW_PARTS, on = featureOn }: ToolboxOptions = {}) {
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
  const available = (slot: Slot) => !disposed && windowAvailable(slot, on);

  const slots: Slot[] = [];
  const requestClose = (slot: Slot): void => {
    if (!slot.visible) return;
    if (slot.tool) slot.tool.requestClose();
    else setOpen(slot, false);
  };

  const activate = (slot: Slot) => {
    cancelPendingFocus();
    active = slot;
    slot.surface.raise();
    for (const candidate of slots) {
      candidate.tool?.setActive?.(candidate === slot);
    }
  };

  const setOpen = (slot: Slot, next: boolean) => {
    if (slot.visible === next) return;
    cancelPendingFocus();
    slot.visible = next;
    if (!next && slot.host.closest('#hub')) window.gwHub?.close();
    if (next) {
      slot.start();
      activate(slot);
    }
    slot.tool?.setVisible(next);
    slot.host.dataset.open = String(next);
    slot.surface.setOpen(next);
    root.dataset.open = String(slots.some((candidate) => candidate.visible));
    if (next && document.pointerLockElement !== null) document.exitPointerLock();
    if (!next && active === slot) {
      active = slots.filter((candidate) => candidate.visible)
        .sort((left, right) => Number(right.host.style.zIndex) - Number(left.host.style.zIndex))[0] ?? null;
      active?.surface.raise();
      for (const candidate of slots) candidate.tool?.setActive?.(candidate === active);
    }
    nonActivating.releaseKeyboard();
  };

  const toggle = (slot: Slot) => slot.visible ? requestClose(slot) : setOpen(slot, true);

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

  /** Adds one declared part: its host, its surface, its lazy start and its link over this window. */
  const window_: ToolsWindowSlots = {
    slot<Id extends WindowPartOwner, Running extends WindowRunning>(part: WindowPartDeclaration<Id, Running>) {
      const host = makeHost(document, `toolbox-${part.element}`, part.element);
      root.append(host);
      let running: Running | null = null;
      let requested = false;
      const waiting: ((running: Running) => void)[] = [];
      const start = () => {
        if (requested) return;
        requested = true;
        // A pop-out from the window's own page does nothing once its Feature is off.
        const show = () => { if (available(slot)) openFloating(slot); };
        // A view that throws or fails to load counts as one that could not load (null): its window
        // stays closed and the other windows are untouched. One line, no error text.
        const failed = () => { console.error(`[err] the ${part.id} window could not start`); return null; };
        let starting: Promise<Running | null>;
        try {
          starting = part.start({ host, onVisibilityChange: (visible) => setOpen(slot, visible), show, links: featureLinks(part.id), onLinksChange });
        } catch {
          starting = Promise.resolve(failed());
        }
        const arrived = (mounted: Running | null) => {
          if (disposed) {
            mounted?.stop();
            return;
          }
          running = mounted;
          slot.tool = mounted;
          if (mounted) for (const use of waiting.splice(0)) use(mounted);
          mounted?.setVisible(slot.visible);
          mounted?.setActive?.(active === slot);
          if (slot.party) mounted?.update?.(state);
          if (pendingFocus === slot) {
            if (mounted) focusFloating(slot);
            else pendingFocus = null;
          }
        };
        // One step after the view resolves, as before: a view that arrives after its window is
        // gone is stopped in the same microtask that delivers it.
        void starting.then(arrived, () => arrived(failed()));
      };
      const control: WindowControl<Running> = Object.freeze({
        get available() { return available(slot); },
        get visible() { return slot.visible; },
        show: () => openFloating(slot),
        toggle: () => toggle(slot),
        close: () => requestClose(slot),
        whenRunning: (use: (running: Running) => void) => { if (running) use(running); else waiting.push(use); },
      });
      const slot: Slot = {
        id: part.id,
        party: part.party === true,
        startWithHub: part.startWithHub === true,
        host,
        start,
        stopLink: provideLink(part.id, part.link(control)),
        tool: null,
        visible: false,
        surface: window.gwSurfaces.register({
          root: host,
          priority: 4,
          dismiss: () => requestClose(slot),
          // Escape leaves the tool's innermost level first, even while the game holds focus (HUB-120).
          escape: () => { if (!slot.tool?.stepBack?.()) requestClose(slot); },
        }),
      };
      host.addEventListener("pointerdown", () => {
        if (slot.visible) { activate(slot); }
      }, true);
      slots.push(slot);
    },
  };
  for (const part of parts) part.addTo(window_);

  isolateFromGame(root);

  const mirrorCursor = () => { root.style.cursor = canvas.style.cursor; };
  const cursorMirror = new MutationObserver(mirrorCursor);
  cursorMirror.observe(canvas, { attributes: true, attributeFilter: ["style"] });
  mirrorCursor();
  const onHub = () => { for (const slot of slots) if (slot.startWithHub && available(slot)) slot.start(); };
  window.addEventListener("gw:hub-visible", onHub);
  // The client may finish mounting Tools after Hub has already opened.
  if (window.gwHub?.visible) onHub();

  return {
    update(next: ToolboxState) {
      state = next;
      for (const slot of slots) if (slot.party) safely(`the ${slot.id} window update`, () => slot.tool?.update?.(next));
    },
    /** Closes each window whose Feature turned off, and starts the Hub's parts that turned on while it shows. */
    sync() {
      for (const slot of slots) if (!available(slot)) setOpen(slot, false);
      if (window.gwHub?.visible) onHub();
    },
    get state() { return state; },
    dispose() {
      disposed = true;
      cancelPendingFocus();
      window.removeEventListener("keydown", cancelPendingFocus, true);
      window.removeEventListener("pointerdown", cancelPendingFocus, true);
      // Each step on its own: a window whose stop throws still leaves its surface and the rest.
      for (const slot of slots) {
        safely(`the ${slot.id} link withdrawal`, slot.stopLink);
        safely(`the ${slot.id} window stop`, () => slot.tool?.stop());
        safely(`the ${slot.id} surface disposal`, () => slot.surface.dispose());
      }
      nonActivating.dispose();
      cursorMirror.disconnect();
      window.removeEventListener("gw:hub-visible", onHub);
      window.dispatchEvent(new CustomEvent("gw:input-reset"));
      if (root.contains(document.activeElement)) canvas.focus({ preventScroll: true });
      style.remove();
      root.remove();
    },
  };
}

/**
 * The Tools window while it should exist: while resolve has Tools on here, or any part's window
 * may open (saved Build Library authoring outside its area). `sync` re-reads that after every
 * change of settings, facts or area.
 */
export function createToolboxLifecycle(parent: HTMLElement, options: ToolboxOptions = {}) {
  const { parts = WINDOW_PARTS, on = featureOn } = options;
  let foundation: ReturnType<typeof createToolboxFoundation> | null = null;
  let state: ToolboxState = Object.freeze({ status: "waiting" });
  let disposed = false;
  const anyPartAvailable = () => parts.some((part) => windowAvailable(part, on));
  return {
    sync() {
      if (disposed) return;
      if (on("tools") || anyPartAvailable()) {
        if (!foundation) {
          foundation = createToolboxFoundation(parent, options);
          foundation.update(state);
        }
        foundation.sync();
      } else {
        foundation?.dispose();
        foundation = null;
      }
    },
    update(next: ToolboxState) {
      state = next;
      foundation?.update(next);
    },
    get state() { return foundation?.state ?? null; },
    dispose() {
      if (disposed) return;
      disposed = true;
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
