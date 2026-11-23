import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrowOffset, listPage, navTarget, stepOut, type NavLayout, type PaintedBox } from "../../app/shared/ui/keyboard-nav.js";

const key = (value: string, modifiers: Partial<Pick<KeyboardEvent, "ctrlKey" | "altKey" | "metaKey" | "shiftKey">> = {}) =>
  ({ key: value, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...modifiers });
/** Where a key moves the selection, or null when it is no move. */
const to = (name: string, index: number, count: number, layout: NavLayout = { page: 4 }, usable?: (index: number) => boolean, boxes?: readonly PaintedBox[]) =>
  navTarget(key(name), { index, count, usable, boxes }, layout)?.index ?? null;

describe("the one keyboard move", () => {
  it("steps, pages and jumps a list with the shared keys, and ⌃N ⌃P step", () => {
    assert.deepEqual(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"].map(name => to(name, 5, 12)), [6, 4, 9, 1, 11, 0]);
    assert.equal(navTarget(key("n", { ctrlKey: true }), { index: 5, count: 12 })?.index, 6);
    assert.equal(navTarget(key("p", { ctrlKey: true }), { index: 5, count: 12 })?.index, 4);
  });
  it("leaves modified keys, other keys and a list's ← → alone; a carousel steps with ← →", () => {
    for (const event of [key("ArrowDown", { altKey: true }), key("ArrowDown", { metaKey: true }), key("ArrowDown", { shiftKey: true }), key("ArrowDown", { ctrlKey: true }), key("a"), key("ArrowLeft")]) {
      assert.equal(navTarget(event, { index: 2, count: 7 }, { page: 4 }), null);
    }
    assert.equal(to("ArrowLeft", 2, 7, { horizontal: true }), 1);
    assert.equal(to("ArrowRight", 2, 7, { horizontal: true }), 3);
    // Without a page, PgUp and PgDn stay with the page; without ends, Home and End stay in the text.
    assert.equal(to("PageDown", 2, 7, {}), null);
    assert.equal(to("End", 2, 7, { ends: false }), null);
  });
  it("never wraps a list, and starts from no selection at the first or, for End, the last item", () => {
    assert.equal(to("ArrowUp", 0, 7), 0);
    assert.equal(to("ArrowDown", 6, 7), 6);
    assert.equal(to("PageDown", 2, 7), 6);
    assert.equal(to("Home", 5, 7), 0);
    assert.equal(to("ArrowDown", -1, 7), 0);
    assert.equal(to("ArrowUp", -1, 7), 0);
    assert.equal(to("End", -1, 7), 6);
  });
  it("wraps a tab strip's ← →, which ignores ↑ ↓ ⌃N and modified arrows", () => {
    const tabs: NavLayout = { vertical: "none", horizontal: true, wrap: true };
    assert.equal(to("ArrowLeft", 0, 3, tabs), 2);
    assert.equal(to("ArrowRight", 2, 3, tabs), 0);
    assert.equal(to("End", 0, 3, tabs), 2);
    for (const event of [key("ArrowDown"), key("n", { ctrlKey: true }), key("ArrowLeft", { metaKey: true }), key("PageDown")]) {
      assert.equal(navTarget(event, { index: 1, count: 3 }, tabs), null);
    }
  });
  it("tells the caller when an arrow or page runs off an end, so it can hand the keyboard on; Home and End never do", () => {
    const leave = (name: string, index: number) => navTarget(key(name), { index, count: 3 }, { page: 2 })?.leave;
    assert.deepEqual([leave("ArrowUp", 0), leave("PageUp", 0), leave("ArrowDown", 2), leave("PageDown", 2)], [-1, -1, 1, 1]);
    assert.deepEqual([leave("ArrowUp", 1), leave("Home", 0), leave("End", 2), leave("ArrowDown", -1)], [0, 0, 0, 0]);
    // A search above a list: ↓ ⌃N PgDn hand on, ↑ ⌃P PgUp hand back, and the text keeps the rest.
    assert.deepEqual(["ArrowDown", "PageDown", "ArrowUp", "PageUp", "End", "Home", "ArrowLeft", "a"].map(name => stepOut(key(name))), [1, 1, -1, -1, null, null, null, null]);
    assert.equal(stepOut(key("n", { ctrlKey: true })), 1);
    assert.equal(stepOut(key("ArrowDown", { shiftKey: true })), null);
  });
  it("passes over items it may not select and holds when none is left that way", () => {
    const usable = (index: number) => index !== 0 && index !== 3 && index !== 6;
    assert.equal(to("ArrowDown", 2, 7, {}, usable), 4);
    assert.equal(to("ArrowUp", 4, 7, {}, usable), 2);
    assert.equal(to("ArrowDown", 5, 7, {}, usable), 5);
    assert.equal(navTarget(key("ArrowDown"), { index: 5, count: 7, usable })?.leave, 1);
    assert.equal(to("ArrowUp", 1, 7, {}, usable), 1);
    assert.equal(to("End", 1, 7, {}, usable), 5);
    assert.equal(to("Home", 5, 7, {}, usable), 1);
    assert.equal(to("PageDown", 1, 7, { page: 5 }, usable), 5);
    assert.equal(to("ArrowDown", -1, 7, {}, usable), 1);
    assert.equal(to("End", -1, 7, {}, usable), 5);
    assert.equal(to("ArrowDown", -1, 3, {}, () => false), -1);
    assert.equal(to("ArrowDown", -1, 0), -1);
    assert.equal(to("ArrowRight", 0, 3, { horizontal: true, wrap: true }, index => index !== 1), 2);
    assert.equal(to("ArrowRight", 2, 3, { horizontal: true, wrap: true }, index => index !== 0), 1);
  });
  it("holds on an unusable current item at either end, never moving against the step or asking outside the list", () => {
    const asked: number[] = [];
    const none = (index: number) => (asked.push(index), false);
    assert.equal(to("ArrowDown", 4, 5, {}, none), 4);
    assert.equal(to("ArrowUp", 0, 5, {}, none), 0);
    assert.equal(to("End", 4, 5, {}, none), 4);
    assert.equal(to("Home", 0, 5, {}, none), 0);
    assert.equal(to("ArrowDown", 0, 1, {}, none), 0);
    assert.ok(asked.every(index => index >= 0 && index < 5), `asked outside the list: ${asked.join(", ")}`);
    const allButFirst = (index: number) => index !== 0;
    assert.equal(to("ArrowUp", 0, 5, {}, allButFirst), 0);
    assert.equal(to("Home", 0, 5, {}, allButFirst), 0);
    assert.equal(to("ArrowDown", 0, 5, {}, allButFirst), 1);
    const allButLast = (index: number) => index !== 4;
    assert.equal(to("ArrowDown", 4, 5, {}, allButLast), 4);
    assert.equal(to("ArrowUp", 4, 5, {}, allButLast), 3);
  });
  it("moves ↑ ↓ through a painted grid by row, keeping the column and passing over what it may not select", () => {
    // Two rows of three; slot 1 cannot be chosen (the place the player stands in).
    const grid = [0, 100, 200, 0, 100, 200].map((left, index) => ({ top: index < 3 ? 0 : 50, left }));
    const usable = (index: number) => index !== 1;
    const rows: NavLayout = { vertical: "row", horizontal: true };
    assert.equal(to("ArrowDown", 0, 6, rows, usable, grid), 3);
    assert.equal(to("ArrowUp", 5, 6, rows, usable, grid), 2);
    assert.equal(to("ArrowUp", 4, 6, rows, usable, grid), 0);
    assert.equal(navTarget(key("n", { ctrlKey: true }), { index: 0, count: 6, usable, boxes: grid }, rows)?.index, 3);
    assert.equal(to("ArrowRight", 2, 6, rows, usable, grid), 3);
    // No row that way: the index holds and the move says so, so the caller may hand the keyboard on.
    assert.deepEqual(navTarget(key("ArrowUp"), { index: 0, count: 6, usable, boxes: grid }, rows), { index: 0, leave: -1 });
    assert.deepEqual(navTarget(key("ArrowDown"), { index: 4, count: 6, usable, boxes: grid }, rows), { index: 4, leave: 1 });
    assert.equal(to("ArrowDown", -1, 6, rows, usable, grid), 0);
    // A grid not painted yet (every box at one point) steps as a list.
    assert.equal(to("ArrowDown", 0, 6, rows, usable, grid.map(() => ({ top: 0, left: 0 }))), 2);
  });
  it("crosses from Travel's Recent carousel into its Favourites and back by column, not along the carousel", () => {
    // Four recents on one scrolled row (the first scrolled out to the left), then two rows of three favourites.
    const recents = [-150, 50, 250, 450].map(left => ({ top: 100, left }));
    const favourites = [50, 250, 450, 50, 250, 450].map((left, index) => ({ top: index < 3 ? 250 : 300, left }));
    const boxes = [...recents, ...favourites];
    const travel: NavLayout = { vertical: "row", horizontal: true, page: 4 };
    assert.equal(to("ArrowDown", 2, boxes.length, travel, undefined, boxes), 5);
    assert.equal(to("ArrowDown", 5, boxes.length, travel, undefined, boxes), 8);
    assert.equal(to("ArrowUp", 8, boxes.length, travel, undefined, boxes), 5);
    assert.equal(to("ArrowUp", 4, boxes.length, travel, undefined, boxes), 1);
    assert.equal(to("ArrowRight", 3, boxes.length, travel, undefined, boxes), 4);
  });
  it("pages by the rows that fit, keeping one for context", () => {
    const box = (clientHeight: number, offsetHeight = 0) => ({ clientHeight, offsetHeight });
    assert.equal(listPage(box(400), box(0, 40)), 9);
    assert.equal(listPage(box(400), null), 9);
    assert.equal(listPage(box(30), box(0, 40)), 1);
  });
  it("nudges by the step an arrow points, and nothing for other keys", () => {
    assert.deepEqual(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map(name => arrowOffset(name, 16)), [{ x: -16, y: 0 }, { x: 16, y: 0 }, { x: 0, y: -16 }, { x: 0, y: 16 }]);
    assert.equal(arrowOffset("Enter", 16), null);
  });
});
