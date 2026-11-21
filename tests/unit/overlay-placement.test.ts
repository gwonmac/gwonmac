/** A dragged overlay's place is one bounded value that main stores and a game window may write. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.js";
import { parseHubSettingsChange } from "../../app/shared/hub-settings.js";
import { readCornerPlacement, readOverlayOffset } from "../../app/shared/overlay-placement.js";
import { parseRendererSettingsPatch, parseSettings } from "../../app/main/core/settings.js";

const corner = { corner: "bottom-right", x: 30, y: 80 } as const;
const offset = { x: -40, y: 12 };

test("Target Distance starts at the top centre and the compass buttons beside the Compass, shown", () => {
  assert.equal(DEFAULT_SETTINGS.targetReadoutPosition, null);
  assert.deepEqual(DEFAULT_SETTINGS.compassButtonsOffset, { x: 0, y: 0 });
  assert.equal(DEFAULT_SETTINGS.compassButtonsShown, true);
});

test("a stored place is read as a copy, and a malformed or off-screen one is refused", () => {
  const readCorner = readCornerPlacement(corner);
  assert.deepEqual(readCorner, corner);
  assert.notEqual(readCorner, corner);
  assert.deepEqual(readOverlayOffset(offset), offset);
  for (const bad of [null, [], "top", {}, { corner: "middle", x: 1, y: 1 }, { corner: "top-left", x: -1, y: 1 },
    { corner: "top-left", x: 1, y: 40_000 }, { ...corner, locked: true }, { corner: "top-left", x: 1 }]) {
    assert.equal(readCornerPlacement(bad), undefined, JSON.stringify(bad));
  }
  for (const bad of [null, [], {}, { x: 1 }, { x: 1, y: Number.NaN }, { x: 100_000, y: 0 }, { x: 1, y: 2, z: 3 }, { x: "1", y: 2 }]) {
    assert.equal(readOverlayOffset(bad), undefined, JSON.stringify(bad));
  }
});

test("settings files keep a dragged place, default it when absent, and refuse a malformed one", () => {
  const moved = { ...DEFAULT_SETTINGS, targetReadoutPosition: corner, compassButtonsOffset: offset, compassButtonsShown: false };
  const read = parseSettings(moved);
  assert.deepEqual([read.targetReadoutPosition, read.compassButtonsOffset, read.compassButtonsShown], [corner, offset, false]);
  const older: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  delete older.targetReadoutPosition; delete older.compassButtonsOffset; delete older.compassButtonsShown;
  assert.deepEqual(parseSettings(older), DEFAULT_SETTINGS);
  assert.throws(() => parseSettings({ ...DEFAULT_SETTINGS, compassButtonsOffset: { x: 1 } }));
  assert.throws(() => parseSettings({ ...DEFAULT_SETTINGS, targetReadoutPosition: { corner: "nowhere", x: 0, y: 0 } }));
});

test("a game window may save a dragged place and the Hub's Settings may reset or hide it", () => {
  assert.deepEqual(parseRendererSettingsPatch({ targetReadoutPosition: corner }), { targetReadoutPosition: corner });
  assert.deepEqual(parseRendererSettingsPatch({ compassButtonsOffset: offset }), { compassButtonsOffset: offset });
  assert.throws(() => parseRendererSettingsPatch({ compassButtonsOffset: null }));
  // Hiding the buttons is a Settings choice, not something a game window writes on its own.
  assert.throws(() => parseRendererSettingsPatch({ compassButtonsShown: false }));
  assert.deepEqual(parseHubSettingsChange({ kind: "settings", patch: { compassButtonsShown: false, targetReadoutPosition: null } }),
    { kind: "settings", patch: { compassButtonsShown: false, targetReadoutPosition: null } });
});
