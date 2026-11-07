/** Checks persistence validation and the untrusted snapshot boundary. */
import assert from "node:assert/strict";
import test from "node:test";
import { isAlcoholTimerPosition, formatAlcoholTimer } from "../../src/shared/alcohol-timer.ts";
import { readCompanionAlcohol } from "../../src/renderer/companion-alcohol-snapshot.ts";

test("saved alcohol offsets are finite, bounded and exact", () => {
  for (const value of [null, {}, { x: 0, y: 0, locked: true }, { corner: "top-left", x: NaN, y: 0, locked: true },
    { corner: "top-left", x: 0, y: 32769, locked: true }, { corner: "top-left", x: 0, y: 0, locked: 1 },
    { corner: "top-left", x: 0, y: 0, locked: true, extra: 1 }]) {
    assert.equal(isAlcoholTimerPosition(value), false);
  }
  for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
    assert.equal(isAlcoholTimerPosition({ corner, x: 8, y: 12, locked: true }), true);
  }
  for (const value of [{ corner: "center", x: 0, y: 0, locked: true },
    { corner: "top-left", x: -1, y: 0, locked: true },
    { corner: "bottom-right", x: 0, y: Infinity, locked: true }]) {
    assert.equal(isAlcoholTimerPosition(value), false);
  }
  assert.equal(formatAlcoholTimer(59999), "1:00");
  assert.equal(formatAlcoholTimer(1001), "0:02");
  assert.equal(formatAlcoholTimer(0), "0:00");
});
test("alcohol rejects torn, unidentified and out-of-range snapshots", () => {
  const buffer = new ArrayBuffer(64);
  const words = new Uint32Array(buffer, 4, 8);
  const seed = () => words.set([0x414c5747, (32 << 16) | 1, 2, 1, 1000, 60000, 1, 0]);
  seed(); assert.deepEqual(readCompanionAlcohol(buffer, 4), { status: "ready", sequence: 2, gameTimer: 1000, remainingMs: 60000 });
  for (const [index, value] of [[0, 0], [1, (32 << 16) | 2], [2, 3], [3, 2], [5, 300001], [6, 0]] as const) {
    seed(); words[index] = value; assert.deepEqual(readCompanionAlcohol(buffer, 4), { status: "waiting" });
  }
  for (const pointer of [-4, 0, 5, 36, NaN]) assert.deepEqual(readCompanionAlcohol(buffer, pointer), { status: "waiting" });
});
