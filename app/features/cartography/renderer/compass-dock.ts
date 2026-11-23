/**
 * Owns the one Compass dock: a button beside the native Compass and the panel it opens, with a
 * section for each map Feature that is on. The dock owns placement, the drag that moves it, the
 * idle visibility, opening and closing, and saving; each section owns only its own controls.
 * It knows nothing about maps; the map engine (overlay.ts) decides which sections it shows.
 */
import type { RendererSettingsPatch } from "../../../shared/contracts.js";
import { NO_OVERLAY_OFFSET, type OverlayOffset } from "../../../shared/overlay-placement.js";
import type { AppSettings } from "../../../shared/settings/index.js";
import { installOverlayDrag } from "../../../renderer/overlay-drag.js";
import { isolateFromGame } from "../../../renderer/non-activating-surface.js";
import type { ScreenBox } from "./frame-placement.js";

export const COMPASS_DOCK_SIZE = 30;
export const COMPASS_DOCK_GAP = 5;
export const COMPASS_DOCK_PANEL_WIDTH = 228;
const VIEWPORT_MARGIN = 6;
const SAVED_MS = 1_200;

/** One Feature's part of the panel. `sync` draws the saved settings; the dock calls it only when they change. */
export type CompassDockSection = Readonly<{
  id: string;
  title: string;
  body: HTMLElement;
  sync(settings: AppSettings): void;
  /** Called when the panel closes, so a section can drop an unsaved preview. */
  close?(): void;
}>;

export type CompassDockFrame = Readonly<{
  /** The native Compass on screen. */
  compass: ScreenBox;
  settings: AppSettings;
  /** The border colour of the active map style, or null for the plain edge. */
  accent: string | null;
  /** In order; none hides the dock. */
  sections: readonly CompassDockSection[];
}>;

export type CompassDock = Readonly<{
  update(frame: CompassDockFrame): void;
  /** Saves a patch from a section: the panel shows "Saving…" and refuses input until it settles. */
  save(patch: RendererSettingsPatch): void;
  hide(): void;
  dispose(): void;
}>;

export type CompassDockPosition = Readonly<{ left: number; top: number; panelSide: "left" | "right" }>;

/**
 * Where the button sits: centred beside the Compass on the side with room for the panel (left
 * first), kept inside the viewport. Null for a box or viewport that cannot be measured.
 */
export function placeCompassDock(
  box: ScreenBox,
  viewport: Readonly<{ width: number; height: number }>,
  panelWidth = COMPASS_DOCK_PANEL_WIDTH,
): CompassDockPosition | null {
  if (
    ![box.left, box.top, box.width, box.height, viewport.width, viewport.height, panelWidth].every(Number.isFinite)
    || box.width <= 0 || box.height <= 0 || viewport.width <= 0 || viewport.height <= 0 || panelWidth <= 0
  ) return null;
  const reach = panelWidth + COMPASS_DOCK_SIZE + COMPASS_DOCK_GAP + VIEWPORT_MARGIN;
  const roomLeft = box.left >= reach;
  const roomRight = box.left + box.width + reach <= viewport.width;
  const panelSide = roomLeft || !roomRight ? "left" : "right";
  const left = panelSide === "left"
    ? Math.max(VIEWPORT_MARGIN, box.left - COMPASS_DOCK_SIZE - COMPASS_DOCK_GAP)
    : Math.min(viewport.width - COMPASS_DOCK_SIZE - VIEWPORT_MARGIN, box.left + box.width + COMPASS_DOCK_GAP);
  const top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(viewport.height - COMPASS_DOCK_SIZE - VIEWPORT_MARGIN, box.top + (box.height - COMPASS_DOCK_SIZE) / 2),
  );
  return Object.freeze({ left, top, panelSide });
}

function dockIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("compass-dock-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M8 2 14 5 8 8 2 5Zm-6 6 6 3 6-3M2 11l6 3 6-3");
  for (const [name, value] of [["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "1.5"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"]]) {
    path.setAttribute(name!, value!);
  }
  svg.append(path);
  return svg;
}

export function createCompassDock(options: Readonly<{
  parent: HTMLElement;
  persist(patch: RendererSettingsPatch): Promise<AppSettings>;
}>): CompassDock {
  const document = options.parent.ownerDocument;
  const view = document.defaultView;
  if (view === null) throw new Error("the Compass dock requires a live document");
  const root = document.createElement("div");
  root.id = "compass-dock";
  root.hidden = true;
  root.style.setProperty("--compass-dock-size", `${COMPASS_DOCK_SIZE}px`);
  root.style.setProperty("--compass-dock-gap", `${COMPASS_DOCK_GAP}px`);
  root.style.setProperty("--compass-dock-panel-width", `${COMPASS_DOCK_PANEL_WIDTH}px`);
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "compass-dock-trigger";
  trigger.setAttribute("aria-label", "Map controls");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "compass-dock-panel");
  trigger.title = "Map controls";
  trigger.append(dockIcon(document));
  const panel = document.createElement("div");
  panel.id = "compass-dock-panel";
  panel.className = "compass-dock-panel";
  panel.hidden = true;
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Map controls");
  // One fieldset: disabling it while a save runs disables every control in every section.
  const fields = document.createElement("fieldset");
  fields.className = "compass-dock-sections";
  const status = document.createElement("p");
  status.className = "compass-dock-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  panel.append(fields, status);
  root.append(trigger, panel);
  options.parent.append(root);
  const releaseIsolation = isolateFromGame(root);

  let frame: CompassDockFrame | null = null;
  let shown: readonly CompassDockSection[] = [];
  let synced: AppSettings | null = null;
  let open = false;
  let disposed = false;
  let statusTimer = 0;
  let panelHeight = 0;
  // A drag shows its offset before the saved setting catches up with it.
  let previewOffset: OverlayOffset | null = null;
  let placed = "";
  let accent: string | null = null;

  const offset = (): OverlayOffset => previewOffset ?? frame?.settings.compassButtonsOffset ?? NO_OVERLAY_OFFSET;
  const sync = (): void => {
    const settings = frame?.settings ?? null;
    if (settings === null || !open || synced === settings) return;
    synced = settings;
    for (const section of shown) section.sync(settings);
  };
  const positionPanel = (): void => {
    if (!open) return;
    const rootTop = Number.parseFloat(root.style.top) || VIEWPORT_MARGIN;
    const height = panelHeight || panel.getBoundingClientRect().height;
    const top = Math.max(VIEWPORT_MARGIN, Math.min(view.innerHeight - height - VIEWPORT_MARGIN, rootTop + (COMPASS_DOCK_SIZE - height) / 2));
    panel.style.top = `${Math.round(top - rootTop)}px`;
  };
  const position = (): void => {
    if (frame === null) return;
    const { x, y } = offset();
    const box = { ...frame.compass, left: frame.compass.left + x, top: frame.compass.top + y };
    const key = `${box.left},${box.top},${box.width},${box.height},${view.innerWidth},${view.innerHeight}`;
    if (key === placed) return;
    const at = placeCompassDock(box, { width: view.innerWidth, height: view.innerHeight });
    if (at === null) return;
    placed = key;
    root.style.left = `${at.left}px`;
    root.style.top = `${at.top}px`;
    panel.dataset.side = at.panelSide;
    positionPanel();
  };
  const setOpen = (next: boolean): void => {
    if (open === next) return;
    open = next;
    panel.hidden = !next;
    trigger.setAttribute("aria-expanded", String(next));
    if (next) {
      synced = null;
      sync();
      positionPanel();
    } else for (const section of shown) section.close?.();
  };
  const showSections = (sections: readonly CompassDockSection[]): void => {
    if (sections.length === shown.length && sections.every((section, index) => section === shown[index])) return;
    for (const section of shown) if (!sections.includes(section)) section.close?.();
    shown = sections;
    synced = null;
    fields.replaceChildren(...sections.map((section) => {
      const element = document.createElement("section");
      element.className = "compass-dock-section";
      element.dataset.section = section.id;
      const title = document.createElement("h3");
      title.textContent = section.title;
      element.append(title, section.body);
      return element;
    }));
  };
  const clearStatusTimer = (): void => {
    if (statusTimer !== 0) view.clearTimeout(statusTimer);
    statusTimer = 0;
  };
  const hide = (): void => {
    setOpen(false);
    root.hidden = true;
    frame = null;
    placed = "";
  };

  trigger.addEventListener("click", () => setOpen(!open));
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpen(false);
    trigger.focus();
  });
  const outsidePointerDown = (event: Event): void => {
    if (open && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
  };
  document.addEventListener("pointerdown", outsidePointerDown);
  const viewportResize = (): void => { placed = ""; position(); };
  view.addEventListener("resize", viewportResize);
  const resizeObserver = typeof view.ResizeObserver === "function"
    ? new view.ResizeObserver((entries) => {
      const entry = entries[0];
      const measured = entry?.borderBoxSize[0]?.blockSize ?? entry?.contentRect.height;
      if (measured !== undefined && measured > 0 && measured !== panelHeight) {
        panelHeight = measured;
        positionPanel();
      }
    })
    : null;
  resizeObserver?.observe(panel);
  // A press on the button that travels is a drag that moves the dock; one that does not is its click.
  let dragStart: Readonly<{ offset: OverlayOffset; left: number; top: number }> | null = null;
  const releaseDrag = installOverlayDrag(trigger, {
    origin() {
      const box = trigger.getBoundingClientRect();
      dragStart = { offset: offset(), left: box.left, top: box.top };
      return { left: box.left, top: box.top };
    },
    move(left, top) {
      if (dragStart === null) return;
      previewOffset = { x: Math.round(dragStart.offset.x + left - dragStart.left), y: Math.round(dragStart.offset.y + top - dragStart.top) };
      position();
    },
    commit() {
      const moved = previewOffset;
      dragStart = null;
      if (moved !== null) void options.persist({ compassButtonsOffset: moved }).catch(() => { previewOffset = null; placed = ""; position(); });
    },
    cancel() {
      dragStart = null;
      previewOffset = null;
      placed = "";
      position();
    },
  });

  return Object.freeze({
    update(next) {
      if (next.sections.length === 0) {
        if (!root.hidden) hide();
        return;
      }
      const saved = next.settings.compassButtonsOffset;
      if (previewOffset !== null && previewOffset.x === saved.x && previewOffset.y === saved.y) previewOffset = null;
      if (frame?.settings.cartographyControlIdleOpacity !== next.settings.cartographyControlIdleOpacity) {
        root.style.setProperty("--compass-dock-idle-opacity", String(next.settings.cartographyControlIdleOpacity / 100));
      }
      frame = next;
      showSections(next.sections);
      if (next.accent !== accent) {
        accent = next.accent;
        if (accent === null) root.style.removeProperty("--compass-dock-accent");
        else root.style.setProperty("--compass-dock-accent", accent);
      }
      root.hidden = false;
      position();
      sync();
    },
    save(patch) {
      if (fields.disabled || frame === null) return;
      clearStatusTimer();
      // Disabling the controls drops their focus; it returns to the same control once the save settles.
      const focused = fields.contains(document.activeElement) ? document.activeElement : null;
      fields.disabled = true;
      status.textContent = "Saving…";
      void options.persist(patch).then(() => {
        if (disposed) return;
        status.textContent = "Saved";
        statusTimer = view.setTimeout(() => { statusTimer = 0; status.textContent = ""; }, SAVED_MS);
      }, () => {
        if (!disposed) status.textContent = "Could not save";
      }).finally(() => {
        if (disposed) return;
        fields.disabled = false;
        if (open && focused instanceof view.HTMLElement && (document.activeElement === null || document.activeElement === document.body)) focused.focus();
        // The saved settings reach update() with the next frame; redraw from them then.
        synced = null;
      });
    },
    hide,
    dispose() {
      disposed = true;
      clearStatusTimer();
      resizeObserver?.disconnect();
      releaseDrag();
      releaseIsolation();
      document.removeEventListener("pointerdown", outsidePointerDown);
      view.removeEventListener("resize", viewportResize);
      root.remove();
    },
  });
}
