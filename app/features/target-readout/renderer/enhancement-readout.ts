/**
 * The target distance and range readout: the first Enhancement feature, decided in
 * `PRODUCT.md`. It is the last stage of the read-only pipeline — manifest →
 * transform/kernel → snapshot → decoder → here — and it asks the game for
 * nothing. One decoded snapshot in, two values out.
 *
 * There is deliberately no widget registry, event bus or command framework
 * behind it. A second feature can add one when it exists and needs it.
 *
 * It also owns its own place on screen: top centre by default, or the corner
 * distance a player dragged it to. It can be dragged whenever it shows.
 */
import { captureCornerPosition, restoreCornerPosition, type CornerPosition } from "../../../shared/corner-position.js";
import { installOverlayDrag } from "../../../renderer/overlay-drag.js";

/*
 * Top centre: the two other fixed overlays own the top corners (`#capture-status`
 * left, `#diagnostics` right), and the game's own target bar is up there, so
 * the number sits where the eye already is. Below both in the stack. A host
 * that stores its place makes it draggable; that is its only pointer use.
 */
const ROOT_STYLE = [
  "position:fixed",
  "top:12px",
  "left:50%",
  "transform:translateX(-50%)",
  "z-index:2",
  "align-items:baseline",
  "gap:10px",
  "padding:4px 12px",
  "border:1px solid #444",
  "border-radius:2px",
  "color:#e8e8e8",
  "background:#080808d9",
  "font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
  "pointer-events:none",
  "user-select:none",
].join(";");
const LABEL_STYLE = "color:#9a9a9a;text-transform:uppercase";
const DISTANCE_STYLE = "font-size:15px;color:#ffb488";
const RANGE_STYLE = "color:#c9c9c9";

/**
 * The shape this reads out of a decoded snapshot. Everything is optional
 * because the decoder's waiting states carry none of it.
 */
type SnapshotState = {
  status?: string;
  targetValid?: boolean;
  distance?: number;
  rangeName?: string;
};

/**
 * What the readout says for a decoded snapshot, or `null` when it says
 * nothing. The distance is the snapshot's own value rounded to a whole game
 * unit: no unit is invented, no band is recomputed, and a state the decoder
 * did not certify as ready renders nothing at all.
 */
export function targetReadout(state: SnapshotState) {
  if (state?.status !== "ready" || state.targetValid !== true) return null;
  const { distance, rangeName } = state;
  // The decoder guarantees both for a ready target; a readout that would
  // otherwise print `NaN` over someone's game shows nothing instead.
  if (!Number.isFinite(distance) || typeof rangeName !== "string") return null;
  return Object.freeze({
    distance: String(Math.round(Number(distance))),
    range: rangeName,
  });
}

/**
 * Mounts the readout and keeps it in step with the snapshot. Owns its own
 * element, so nothing else in the page has to know it exists.
 */
export type TargetReadoutPlacement = Readonly<{
  /** Saves the place the player dragged the readout to. */
  savePosition(position: CornerPosition): void;
}>;

export function createTargetReadout(parent: HTMLElement, placement?: TargetReadoutPlacement) {
  const document = parent.ownerDocument;
  const root = document.createElement("div");
  root.id = "enhancement-target";
  // In the accessibility tree, but never announced: this changes every frame.
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "off");
  root.style.cssText = ROOT_STYLE;
  root.style.display = "none";

  const label = document.createElement("span");
  label.textContent = "Target";
  label.style.cssText = LABEL_STYLE;
  const distance = document.createElement("span");
  distance.style.cssText = DISTANCE_STYLE;
  const range = document.createElement("span");
  range.style.cssText = RANGE_STYLE;
  root.append(label, distance, range);
  parent.append(root);

  /** The rendered line, or the empty string while nothing is shown. */
  let rendered = "";
  let position: CornerPosition | null = null;
  const view = document.defaultView;
  const viewport = () => ({ width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0, margin: 0 });
  /** Puts the readout at its saved corner distance, or back at the top centre. */
  const place = () => {
    const point = position === null || root.style.display === "none"
      ? null : restoreCornerPosition(position, viewport(), root.getBoundingClientRect());
    if (point === null) {
      if (position === null) { root.style.left = "50%"; root.style.top = "12px"; root.style.transform = "translateX(-50%)"; }
      return;
    }
    root.style.left = `${point.left}px`; root.style.top = `${point.top}px`; root.style.transform = "none";
  };
  /**
   * The moving parts exist only for a host that stores a placement. Without one the readout
   * stays what it always was: text that is never a pointer target.
   */
  const movable = placement === undefined ? null : (() => {
    let beforeDrag: CornerPosition | null = null;
    const disposeDrag = installOverlayDrag(root, {
      origin: () => { beforeDrag = position; const box = root.getBoundingClientRect(); return { left: box.left, top: box.top }; },
      move(left, top) {
        const next = captureCornerPosition({ left, top }, viewport(), root.getBoundingClientRect());
        if (next) { position = next; place(); }
      },
      commit() { if (position) placement.savePosition(position); },
      cancel() { position = beforeDrag; place(); },
    });
    // A press on the readout never reaches the game under it, and never takes the keyboard from it.
    for (const name of ["pointerdown", "pointerup", "mousedown", "mouseup", "click"]) {
      root.addEventListener(name, event => { event.stopPropagation(); if (name === "mousedown") event.preventDefault(); });
    }
    root.style.pointerEvents = "auto";
    root.style.cursor = "grab";
    view?.addEventListener("resize", place);
    return { dispose() { disposeDrag(); view?.removeEventListener("resize", place); } };
  })();
  const paint = () => {
    root.style.display = rendered !== "" ? "flex" : "none";
    if (rendered !== "") place();
  };

  return {
    /**
     * Called once per animation frame, so it touches the DOM only when the
     * text it would write has actually changed.
     */
    update(state: SnapshotState) {
      const next = targetReadout(state);
      const line = next === null ? "" : `${next.distance} ${next.range}`;
      if (line === rendered) return;
      rendered = line;
      if (next !== null) {
        distance.textContent = next.distance;
        range.textContent = next.range;
      }
      paint();
    },
    /** The saved place; null is the top centre. */
    setPlacement(next: CornerPosition | null) {
      position = next;
      paint();
    },
    get state() {
      return Object.freeze({ visible: rendered !== "", line: rendered });
    },
    dispose() {
      movable?.dispose();
      root.remove();
    },
  };
}
