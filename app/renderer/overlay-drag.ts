/**
 * Owns the one drag gesture that the movable game overlays share: Target Distance and the
 * Compass dock. An overlay is always draggable: a press that travels a few pixels moves
 * it live and commits once on release, and a press that does not travel stays an ordinary
 * click. Nothing here decides where an overlay may sit or how its position is stored; each
 * overlay owns that.
 */
export type OverlayDrag = Readonly<{
  /** The overlay's current top-left corner in client pixels. */
  origin(): Readonly<{ left: number; top: number }>;
  /** Shows the overlay at this top-left corner without saving. */
  move(left: number, top: number): void;
  /** Saves the place the overlay was last moved to. */
  commit(): void;
  /** Returns the overlay to where the drag started. */
  cancel(): void;
}>;

/** How far a press travels before it is a drag and no longer a click. */
export const OVERLAY_DRAG_THRESHOLD = 4;

export function installOverlayDrag(handle: HTMLElement, drag: OverlayDrag): () => void {
  const document = handle.ownerDocument;
  const view = document.defaultView;
  let press: { id: number; x: number; y: number; origin: { left: number; top: number } | null } | null = null;
  const swallowClick = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
  const release = () => {
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", cancel, true);
    document.removeEventListener("keydown", key, true);
    view?.removeEventListener("blur", cancel);
    press = null;
  };
  function cancel() {
    const dragging = press?.origin != null;
    release();
    if (dragging) drag.cancel();
  }
  function move(event: PointerEvent) {
    if (press?.id !== event.pointerId) return;
    const dx = event.clientX - press.x, dy = event.clientY - press.y;
    if (press.origin === null) {
      if (Math.hypot(dx, dy) < OVERLAY_DRAG_THRESHOLD) return;
      const origin = drag.origin();
      press.origin = { left: origin.left, top: origin.top };
    }
    drag.move(press.origin.left + dx, press.origin.top + dy);
  }
  function up(event: PointerEvent) {
    if (press?.id !== event.pointerId) return;
    const dragging = press.origin !== null;
    release();
    if (!dragging) return;
    drag.commit();
    // The release of a drag is not a click on the button that was dragged.
    document.addEventListener("click", swallowClick, { capture: true, once: true });
    view?.setTimeout(() => document.removeEventListener("click", swallowClick, true), 0);
  }
  function key(event: KeyboardEvent) {
    if (event.key !== "Escape" || press?.origin == null) return;
    event.preventDefault(); event.stopPropagation();
    cancel();
  }
  const down = (event: PointerEvent) => {
    if (press || !event.isPrimary || event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: null };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("keydown", key, true);
    view?.addEventListener("blur", cancel);
  };
  handle.addEventListener("pointerdown", down);
  return () => { cancel(); handle.removeEventListener("pointerdown", down); };
}
