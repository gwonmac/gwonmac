import assert from "node:assert/strict";
import test from "node:test";
import {
  quickItemMoveExports,
  startQuickItemMove,
} from "../../app/features/quick-item-move/renderer/quick-item-move-installation.js";

function keyboard(type: "keydown" | "keyup", ctrlKey: boolean, shiftKey: boolean): Event {
  return Object.assign(new Event(type), { ctrlKey, shiftKey });
}

test("Quick Item Move publishes Control and Shift while it runs and clears them on blur and stop", () => {
  const target = new EventTarget();
  const configurations: number[][] = [];
  const modifiers: number[] = [];
  const running = startQuickItemMove({
    configure: (enabled, pointer) => (configurations.push([enabled, pointer]), 1),
    setModifiers: (value) => (modifiers.push(value), 1),
    scratchPointer: 64,
    target,
  });

  assert.deepEqual(configurations, [[1, 64]]);
  target.dispatchEvent(keyboard("keydown", true, false));
  target.dispatchEvent(keyboard("keydown", true, true));
  target.dispatchEvent(new Event("blur"));
  target.dispatchEvent(keyboard("keydown", true, false));
  running.stop();

  assert.deepEqual(configurations, [[1, 64], [0, 64]]);
  assert.deepEqual(modifiers, [0, 1, 3, 0, 1, 0]);
});

test("Quick Item Move refuses an incomplete transformed export pair", () => {
  assert.equal(quickItemMoveExports({}), null);
  assert.equal(quickItemMoveExports({
    enhancement_configure_quick_item_move: () => 1,
  }), null);
  assert.ok(quickItemMoveExports({
    enhancement_configure_quick_item_move: () => 1,
    enhancement_quick_item_move_modifiers: () => 1,
  }));
});

test("Quick Item Move does not leak listeners when starting fails", () => {
  const target = new EventTarget();
  let modifierCalls = 0;
  assert.throws(() => startQuickItemMove({
    configure: () => { throw new Error("configuration failed"); },
    setModifiers: () => (modifierCalls += 1),
    scratchPointer: 64,
    target,
  }), /configuration failed/);

  target.dispatchEvent(keyboard("keydown", true, false));
  assert.equal(modifierCalls, 1);
});
