/** The overlay placement that main stores and a game window may write is one bounded value. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.js";
import { parseHubSettingsChange } from "../../app/shared/hub-settings.js";
import { copyOverlayPlacement, DEFAULT_OVERLAY_PLACEMENT, isOverlayPlacement } from "../../app/shared/overlay-placement.js";
import { parseRendererSettingsPatch, parseSettings } from "../../app/main/core/settings.js";

const moved = {
  compassButtons: false,
  compassOffset: { x: -40, y: 12 },
  targetDistance: { corner: "bottom-right" as const, x: 30, y: 80 },
};

test("by default the compass buttons show beside the compass and Target Distance is top centre", () => {
  assert.deepEqual(DEFAULT_SETTINGS.overlayPlacement, {
    compassButtons: true, compassOffset: { x: 0, y: 0 }, targetDistance: null,
  });
  assert.ok(isOverlayPlacement(DEFAULT_OVERLAY_PLACEMENT));
});

test("a moved placement is accepted and copied, not shared", () => {
  assert.ok(isOverlayPlacement(moved));
  const copy = copyOverlayPlacement(moved);
  assert.deepEqual(copy, moved);
  assert.notEqual(copy.compassOffset, moved.compassOffset);
  assert.notEqual(copy.targetDistance, moved.targetDistance);
});

test("a malformed placement is refused", () => {
  for (const bad of [
    null, [], "top", {},
    { ...moved, extra: 1 },
    { ...moved, compassButtons: "yes" },
    { ...moved, compassOffset: { x: 1 } },
    { ...moved, compassOffset: { x: 1, y: Number.NaN } },
    { ...moved, compassOffset: { x: 100_000, y: 0 } },
    { ...moved, compassOffset: { x: 1, y: 2, z: 3 } },
    { ...moved, targetDistance: { corner: "middle", x: 1, y: 1 } },
    { ...moved, targetDistance: { corner: "top-left", x: -1, y: 1 } },
    { ...moved, targetDistance: { corner: "top-left", x: 1, y: 1, locked: true } },
    { compassButtons: true, compassOffset: { x: 0, y: 0 } },
  ]) assert.equal(isOverlayPlacement(bad), false, JSON.stringify(bad));
});

test("settings read it, default it when absent, and refuse a malformed one", () => {
  assert.deepEqual(parseSettings({ ...DEFAULT_SETTINGS, overlayPlacement: moved }).overlayPlacement, moved);
  const older: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  delete older.overlayPlacement;
  assert.deepEqual(parseSettings(older).overlayPlacement, DEFAULT_OVERLAY_PLACEMENT);
  // An earlier build stored an adjusting flag; it is read and dropped.
  assert.deepEqual(parseSettings({ ...DEFAULT_SETTINGS, overlayPlacement: { ...moved, adjusting: true } }).overlayPlacement, moved);
  assert.throws(() => parseSettings({ ...DEFAULT_SETTINGS, overlayPlacement: { ...moved, compassButtons: "no" } }));
});

test("a game window may save it, through the renderer bridge and the Hub settings page", () => {
  assert.deepEqual(parseRendererSettingsPatch({ overlayPlacement: moved }), { overlayPlacement: moved });
  assert.throws(() => parseRendererSettingsPatch({ overlayPlacement: { ...moved, compassOffset: null } }));
  assert.deepEqual(parseHubSettingsChange({ kind: "settings", patch: { overlayPlacement: moved } }),
    { kind: "settings", patch: { overlayPlacement: moved } });
});
