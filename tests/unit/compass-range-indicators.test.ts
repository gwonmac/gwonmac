import assert from "node:assert/strict";
import test from "node:test";
import { placeCompassDock } from "../../app/features/cartography/renderer/compass-dock.js";
import {
  compassRangeAtPoint,
  projectCompassRangeIndicators,
  visibleCompassRanges,
} from "../../app/features/cartography/renderer/compass-range-layer.js";
import { COMPASS_RANGE_INDICATORS } from "../../app/shared/compass-ranges.js";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.js";

test("projects standard ranges from the native Compass edge", () => {
  const projection = projectCompassRangeIndicators({
    left: 900, top: 20, width: 245, height: 260,
  });
  assert.ok(projection);
  assert.equal(projection.centerX, 122.5);
  assert.equal(projection.centerY, 122.5);
  assert.equal(projection.clipRadius, 96);
  assert.deepEqual(
    projection.rings.map(({ id, units }) => ({ id, units })),
    COMPASS_RANGE_INDICATORS.map(({ id, units }) => ({ id, units })),
  );
  assert.deepEqual(
    projection.rings.map(({ radiusPixels }) => Number(radiusPixels.toFixed(3))),
    [19.43, 23.962, 48.23, 67.2],
  );
});

test("rescales ranges with the current Compass frame", () => {
  const regular = projectCompassRangeIndicators({ left: 0, top: 0, width: 245, height: 260 });
  const doubled = projectCompassRangeIndicators({ left: 0, top: 0, width: 490, height: 520 });
  assert.ok(regular);
  assert.ok(doubled);
  assert.equal(doubled.clipRadius, regular.clipRadius * 2);
  for (let index = 0; index < regular.rings.length; index += 1) {
    assert.equal(doubled.rings[index]!.radiusPixels, regular.rings[index]!.radiusPixels * 2);
  }
});

test("refuses malformed or clipped Compass frames", () => {
  assert.equal(projectCompassRangeIndicators({ left: 0, top: 0, width: 0, height: 260 }), null);
  assert.equal(projectCompassRangeIndicators({ left: 0, top: 0, width: 245, height: 200 }), null);
  assert.equal(projectCompassRangeIndicators({ left: Number.NaN, top: 0, width: 245, height: 260 }), null);
  assert.equal(projectCompassRangeIndicators(
    { left: 0, top: 0, width: 245, height: 260 },
    [{ id: "cast", opacity: 101 }],
  ), null);
});

test("resolves a short hover label only near the closest ring", () => {
  const projection = projectCompassRangeIndicators({ left: 0, top: 0, width: 245, height: 260 });
  assert.ok(projection);
  assert.equal(
    compassRangeAtPoint(projection, projection.centerX + 19, projection.centerY)?.label,
    "Shout",
  );
  assert.equal(
    compassRangeAtPoint(projection, projection.centerX + 24, projection.centerY)?.label,
    "Cast",
  );
  assert.equal(compassRangeAtPoint(projection, projection.centerX, projection.centerY), null);
});

test("master visibility preserves independent range choices", () => {
  const selected = {
    ...DEFAULT_SETTINGS,
    compassRangeIndicatorsEnabled: true,
    compassRangeCastEnabled: false,
    compassRangeSpiritExtendedEnabled: false,
  };
  assert.deepEqual(visibleCompassRanges(selected), [
    { id: "earshot", opacity: 95 },
    { id: "spirit", opacity: 95 },
  ]);
  assert.deepEqual(visibleCompassRanges({
    ...selected,
    compassRangeIndicatorsEnabled: false,
  }), []);
});

test("projects saved and preview opacity without changing range geometry", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    compassRangeIndicatorsEnabled: true,
    compassRangeCastOpacity: 40,
  };
  assert.deepEqual(visibleCompassRanges(settings).map(({ id, opacity }) => ({ id, opacity })), [
    { id: "earshot", opacity: 95 },
    { id: "cast", opacity: 40 },
    { id: "spirit", opacity: 95 },
    { id: "spirit-extended", opacity: 95 },
  ]);
  assert.equal(
    visibleCompassRanges(settings, (key) => key === "compassRangeCastOpacity" ? 72 : null)[1]?.opacity,
    72,
  );
});

test("offers a high-contrast monochrome theme without changing range geometry", () => {
  const box = { left: 0, top: 0, width: 245, height: 260 };
  const color = projectCompassRangeIndicators(box);
  const monochrome = projectCompassRangeIndicators(box, undefined, "monochrome");
  assert.ok(color !== null && monochrome !== null);
  assert.deepEqual(monochrome.rings.map(({ color: ringColor }) => ringColor), [
    "#F2F2F0", "#F2F2F0", "#F2F2F0", "#F2F2F0",
  ]);
  assert.deepEqual(
    monochrome.rings.map(({ radiusPixels }) => radiusPixels),
    color.rings.map(({ radiusPixels }) => radiusPixels),
  );
});

// Wrong behaviours: the dock button drifts off the Compass's middle, opens its panel off-screen,
// or is placed from a box the Compass snapshot could not measure.
test("the dock button sits centred beside the Compass, on the side with room for its panel", () => {
  const viewport = { width: 1_440, height: 900 };
  const box = { left: 900, top: 20, width: 245, height: 260 };
  const right = placeCompassDock(box, viewport, 228);
  assert.ok(right);
  assert.equal(right.top + 15, box.top + box.height / 2);
  assert.equal(right.panelSide, "left");
  assert.equal(right.left, box.left - 30 - 5);
  assert.equal(placeCompassDock({ ...box, left: 10 }, viewport, 228)?.panelSide, "right");
  assert.equal(placeCompassDock({ ...box, width: 0 }, viewport, 228), null);
  assert.equal(placeCompassDock({ ...box, top: -400 }, viewport, 228)?.top, 6);
});
