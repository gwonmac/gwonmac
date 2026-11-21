/**
 * The target distance and range readout: the first Enhancement feature, decided in
 * `PRODUCT.md`. It is the last stage of the read-only pipeline — manifest →
 * transform/kernel → snapshot → decoder → `game.target` → here — and it asks the
 * game for nothing. One target in, two values out.
 *
 * There is deliberately no widget registry, event bus or command framework
 * behind it. A second feature can add one when it exists and needs it.
 *
 * It also owns its place on screen: top centre by default, or the corner
 * distance a player dragged it to. It can be dragged whenever it shows.
 */
import { captureCornerPosition, restoreCornerPosition, type CornerPosition } from "../../../shared/corner-position.js";
import { installOverlayDrag } from "../../../renderer/overlay-drag.js";
import type { GameTarget } from "../../../renderer/game-blocks.js";
import { isolateFromGame } from "../../../renderer/non-activating-surface.js";

/*
 * Top centre: the two other fixed overlays own the top corners (`#capture-status`
 * left, `#diagnostics` right), and the game's own target bar is up there, so
 * the number sits where the eye already is. Below both in the stack. A host
 * that stores its place makes it draggable; a press on it then never reaches
 * the game, so it stays small. Without one it is never a pointer target.
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
 * What the readout says for the selected target, or `null` when it says
 * nothing. The distance is the game's own value rounded to a whole game unit:
 * no unit is invented and no band is recomputed. `game.target` gives a target
 * only for a state the decoder certified as ready, with a finite distance.
 */
export function targetReadout(target: GameTarget | null) {
  // A readout that would otherwise print `NaN` over someone's game shows nothing instead.
  if (target === null || !Number.isFinite(target.distance) || typeof target.range !== "string") return null;
  return Object.freeze({
    distance: String(Math.round(target.distance)),
    range: target.range,
  });
}

export type TargetReadoutPlacement = Readonly<{
  /** Saves the place the player dragged the readout to. */
  savePosition(position: CornerPosition): void;
}>;

/**
 * Mounts the readout and keeps it in step with the target. Owns its own
 * element, so nothing else in the page has to know it exists.
 */
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
  /** The saved or dragged place; null is the top centre. */
  let position: CornerPosition | null = null;
  const view = document.defaultView;
  const viewport = () => ({ width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0, margin: 0 });
  const place = () => {
    const point = position === null ? null : restoreCornerPosition(position, viewport(), root.getBoundingClientRect());
    if (point === null) {
      root.style.left = "50%"; root.style.top = "12px"; root.style.transform = "translateX(-50%)";
      return;
    }
    root.style.left = `${point.left}px`; root.style.top = `${point.top}px`; root.style.transform = "none";
  };
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
    const disposeIsolation = isolateFromGame(root);
    root.style.pointerEvents = "auto";
    root.style.cursor = "grab";
    view?.addEventListener("resize", place);
    return { dispose() { disposeDrag(); disposeIsolation(); view?.removeEventListener("resize", place); } };
  })();

  return {
    /**
     * Called whenever the target's distance changes, so it touches the DOM only
     * when the text it would write has actually changed.
     */
    update(target: GameTarget | null) {
      const next = targetReadout(target);
      const line = next === null ? "" : `${next.distance} ${next.range}`;
      if (line === rendered) return;
      rendered = line;
      if (next === null) {
        root.style.display = "none";
        return;
      }
      distance.textContent = next.distance;
      range.textContent = next.range;
      root.style.display = "flex";
      place();
    },
    /** The saved place; null is the top centre. */
    setPosition(next: CornerPosition | null) {
      position = next;
      if (rendered !== "") place();
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
