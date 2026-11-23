/**
 * Owns the arrow keys of every list, grid, carousel, toolbar and tab strip in the launcher, the
 * Tools and Hub UI and the in-game presentation: which key is a move, where it lands, when it
 * wraps, and when it runs off an end so the caller can hand the keyboard to the next region.
 *
 * The keyboard contract (docs/hub-contract.md): ↑ ↓ ⌃P ⌃N step, PgUp PgDn page by the visible
 * rows, Home End jump; a carousel or toolbar also steps with ← →. Lists, grids, carousels and
 * toolbars never wrap; tab strips do. A grid moves ↑ ↓ to the nearest painted row, closest to the
 * current column. An item the caller marks unusable is passed over. It also owns the arrow
 * offset that nudges a window, an icon or a resize grip. No Node.js: the renderer imports it.
 */
import { focusable } from "./focusable.js";

/** The parts of a key press a move reads; a KeyboardEvent or the Hub engine's own press. */
export type NavKey = Readonly<{ key: string; altKey: boolean; metaKey: boolean; shiftKey: boolean; ctrlKey: boolean }>;
/** Where an item is painted: the top of its row and its left edge. */
export type PaintedBox = Readonly<{ top: number; left: number }>;

/** Which keys move a set of items. */
export type NavLayout = Readonly<{
  /** ↑ ↓ ⌃P ⌃N: step one item (the default), go to the nearest painted row (`row`, with boxes), or are no move (`none`). */
  vertical?: "step" | "row" | "none";
  /** ← → step one item: a carousel, a toolbar or a tab strip. */
  horizontal?: boolean;
  /** PgUp PgDn move this many items; without a page they are no move. */
  page?: number;
  /** Home End jump to the ends, unless false (a column whose text field keeps them). */
  ends?: boolean;
  /** An arrow past an end goes round to the other end: tab strips only. */
  wrap?: boolean;
}>;

/** The items a move runs over: the current one (-1 for none), how many, which may take it, and where each is painted. */
export type NavSet = Readonly<{ index: number; count: number; usable?: ((index: number) => boolean) | undefined; boxes?: readonly PaintedBox[] | undefined }>;

/**
 * Where a move lands. `leave` is -1 or 1 when an arrow or a page asked to go past the first or
 * last item and found nothing usable that way: the index holds, and the caller may hand the
 * keyboard to the region there. Home and End never leave.
 */
export type NavTarget = Readonly<{ index: number; leave: -1 | 0 | 1 }>;

type Arrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
const CONTROL_ARROWS: Readonly<Record<string, Arrow>> = { n: "ArrowDown", p: "ArrowUp" };

/** The arrow a plain press means, ⌃N and ⌃P included; null for a modified or other key. */
function arrowOf(event: NavKey): string | null {
  if (event.altKey || event.metaKey || event.shiftKey) return null;
  return event.ctrlKey ? CONTROL_ARROWS[event.key.toLowerCase()] ?? null : event.key;
}

function moveOf(event: NavKey, layout: NavLayout): { step: number } | { row: 1 | -1 } | null {
  const key = arrowOf(event);
  const vertical = layout.vertical ?? "step";
  if (event.ctrlKey && vertical === "none") return null;
  switch (key) {
    case "ArrowDown": case "ArrowUp": {
      const direction = key === "ArrowDown" ? 1 : -1;
      return vertical === "none" ? null : vertical === "row" ? { row: direction } : { step: direction };
    }
    case "ArrowRight": case "ArrowLeft": return layout.horizontal ? { step: key === "ArrowRight" ? 1 : -1 } : null;
    case "PageDown": case "PageUp": return layout.page ? { step: key === "PageDown" ? layout.page : -layout.page } : null;
    case "End": case "Home": return layout.ends === false ? null : { step: key === "End" ? Infinity : -Infinity };
    default: return null;
  }
}

/**
 * Where a step lands, held at both ends. From no selection, End lands on the last item and
 * every other move on the first. An unusable item is passed over; with no usable item that way
 * the selection stays. `usable` is only asked about indexes inside the list, and the selection
 * never moves against the step.
 */
function listIndexAfter(index: number, count: number, step: number, usable: (index: number) => boolean): number {
  const fresh = index < 0 || index >= count;
  const direction = fresh ? (step === Infinity ? -1 : 1) : Math.sign(step);
  const target = fresh ? (step === Infinity ? count - 1 : 0) : Math.max(0, Math.min(count - 1, index + step));
  for (let next = target; next >= 0 && next < count; next += direction) if (usable(next)) return next;
  if (!fresh) for (let next = target - direction; direction * (next - index) > 0; next -= direction) if (usable(next)) return next;
  return fresh ? -1 : index;
}

/** The nearest painted row that way with a usable item, and in it the item closest to the current column; null when none. */
function gridIndexAfter(boxes: readonly PaintedBox[], index: number, direction: 1 | -1, usable: (index: number) => boolean): number | null {
  const from = boxes[index];
  if (!from) return null;
  let best: number | null = null;
  for (const [candidate, box] of boxes.entries()) {
    if (direction * (box.top - from.top) <= 0 || !usable(candidate)) continue;
    const chosen = best === null ? null : boxes[best]!;
    if (!chosen || direction * (box.top - chosen.top) < 0
      || (box.top === chosen.top && Math.abs(box.left - from.left) < Math.abs(chosen.left - from.left))) best = candidate;
  }
  return best;
}

/** Boxes that tell items apart; all at one point, nothing is painted yet and a grid steps as a list. */
const painted = (boxes: readonly PaintedBox[] | undefined): boxes is readonly PaintedBox[] =>
  !!boxes && boxes.some(box => box.top !== boxes[0]!.top || box.left !== boxes[0]!.left);

/** Where `event` moves the selection in `set`, or null when the key is no move for this layout. */
export function navTarget(event: NavKey, set: NavSet, layout: NavLayout = {}): NavTarget | null {
  const move = moveOf(event, layout);
  if (!move) return null;
  const { index, count, usable = () => true } = set;
  const fresh = index < 0 || index >= count;
  if ("row" in move && !fresh && painted(set.boxes)) {
    const next = gridIndexAfter(set.boxes, index, move.row, usable);
    return next === null ? { index, leave: move.row } : { index: next, leave: 0 };
  }
  const step = "row" in move ? move.row : move.step;
  const next = listIndexAfter(index, count, step, usable);
  if (fresh || next !== index || !Number.isFinite(step)) return { index: next, leave: 0 };
  if (layout.wrap && Math.abs(step) === 1) return { index: listIndexAfter(-1, count, step > 0 ? 1 : Infinity, usable), leave: 0 };
  return { index, leave: step > 0 ? 1 : -1 };
}

/**
 * The direction a single stop, such as a search field above a list, hands the keyboard on:
 * 1 for ↓ ⌃N PgDn, -1 for ↑ ⌃P PgUp, null for every other key (Home and End stay in the text).
 */
export function stepOut(event: NavKey): -1 | 1 | null {
  const leave = navTarget(event, { index: 0, count: 1 }, { page: 1, ends: false })?.leave;
  return leave ? leave : null;
}

/** An element's painted box, rounded so items on one row share a top. */
export function paintedBox(element: Element): PaintedBox {
  const box = element.getBoundingClientRect();
  return { top: Math.round(box.top), left: Math.round(box.left) };
}

export type RoveOptions = NavLayout & Readonly<{
  /** Where an arrow that cannot move inside the set hands the keyboard: across its axis, or past its end. */
  exits?: Partial<Record<Arrow, () => HTMLElement | null>> | undefined;
}>;

/**
 * Roving focus: moves the keyboard from the focused item to the one the key asks for, from none
 * to the first (End: the last), or out through an exit. True when the key was taken; the event
 * is then consumed.
 */
export function rove(event: KeyboardEvent, items: readonly HTMLElement[], options: RoveOptions = {}): boolean {
  const index = items.indexOf(event.target as HTMLElement);
  const boxes = options.vertical === "row" ? items.map(paintedBox) : undefined;
  const target = navTarget(event, { index, count: items.length, boxes }, options);
  const arrow = arrowOf(event) as Arrow | null;
  const exit = arrow && (!target || target.leave) ? options.exits?.[arrow] : undefined;
  if (exit) {
    event.preventDefault();
    exit()?.focus();
    return true;
  }
  if (!target) return false;
  event.preventDefault();
  items[target.index]?.focus();
  return true;
}

/**
 * A tab strip (the launcher's Home and Feature tabs, the Tools workbench tabs): ← → step and
 * wrap, Home End jump. The strip keeps its own state; the move focuses the tab and clicks it.
 */
export function navigateTabs(event: KeyboardEvent): void {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')].filter(focusable);
  if (!tabs.includes(event.target as HTMLElement)) return;
  const move = navTarget(event, { index: tabs.indexOf(event.target as HTMLElement), count: tabs.length }, { vertical: "none", horizontal: true, wrap: true });
  if (!move) return;
  event.preventDefault();
  tabs[move.index]?.focus();
  tabs[move.index]?.click();
}

/** One page of a scrolled list: the rows that fit in its viewport, less one kept for context. */
export function listPage(viewport: Readonly<{ clientHeight: number }> | null | undefined, row: Readonly<{ offsetHeight: number }> | null | undefined): number {
  const height = row?.offsetHeight || 40;
  return Math.max(1, Math.floor((viewport?.clientHeight ?? 0) / height) - 1);
}

/** How far an arrow nudges a window, an icon or a resize grip: `step` pixels its way, or null for any other key. */
export function arrowOffset(key: string, step: number): Readonly<{ x: number; y: number }> | null {
  switch (key) {
    case "ArrowLeft": return { x: -step, y: 0 };
    case "ArrowRight": return { x: step, y: 0 };
    case "ArrowUp": return { x: 0, y: -step };
    case "ArrowDown": return { x: 0, y: step };
    default: return null;
  }
}
