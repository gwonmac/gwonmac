/**
 * Verifies native HUD atlas reuse and lifecycle without mounting browser overlays. What each
 * feature draws runs on the blocks (feature-parts-start-and-stop-with-their-feature.test.ts).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createNativeHudLayer } from "../../app/renderer/native-hud-layer.js";
import { EMPTY_SKILL_KEY_MODIFIERS } from "../../app/shared/skill-key-bindings.js";
import { skillKeyPlateLayout } from "../../app/renderer/skill-key-artwork.js";
import { NATIVE_HUD_MAGIC, NATIVE_HUD_HEADER as HEADER, NATIVE_HUD_KEYCAP } from "../../app/shared/native-hud.js";

test("all HUDs share cached artwork; countdowns, urgency and resize upload only glyph quads", async () => {
  const context = {save() {}, restore() {}, translate() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, roundRect() {}, fill() {}, stroke() {}, fillRect() {}, strokeText() {}, fillText() {},
    createLinearGradient: () => ({addColorStop() {}}), measureText: (text: string) => ({width: text === "1" ? 12 : text === "7" ? 22 : text.length * 28,
      actualBoundingBoxLeft: text === "7" ? -3 : -1,
      actualBoundingBoxRight: text === "1" ? 10 : text === "7" ? 18 : text.length * 26,
      actualBoundingBoxAscent: text === "1" ? 31 : 33, actualBoundingBoxDescent: 0}),
    getImageData: () => ({data: new Uint8ClampedArray(1024 * 1024 * 4)})};
  const canvas = {width: 0, height: 0, getContext: () => context};
  const view = new EventTarget();
  const document = {defaultView: view, createElement(tag: string) { assert.equal(tag, "canvas"); return canvas; }} as unknown as Document;
  const memory = new WebAssembly.Memory({initial: 80});
  let uploads = 0, publications = 0, resets = 0, allocated = 0, freed = 0, atlasResult = 1;
  const labels = new Map<number, number>();
  const positions = new Map<number, number[]>();
  const layer = createNativeHudLayer({memory,
    malloc: () => { allocated++; return 1024; }, free: () => { freed++; },
    gwonmac_hud_reset: () => { resets++; },
    gwonmac_hud_atlas: () => { uploads++; return atlasResult; },
    gwonmac_hud_label: (region: number, bytes: number) => {
      const v = new DataView(memory.buffer, region, bytes);
      assert.equal(v.getUint32(0, true), NATIVE_HUD_MAGIC); assert.equal(v.getUint32(4, true), bytes);
      const count = v.getUint32(20, true); labels.set(v.getUint32(8, true), count);
      const flags = v.getUint32(24, true);
      if (count > (flags ? 1 : 0)) positions.set(v.getUint32(8, true), [0, 4, 8, 12].map(at => v.getFloat32(HEADER + (flags ? 32 : 0) + at, true)));
      for (let at = HEADER; at < bytes; at += 4) { const value = v.getFloat32(at, true); assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${at}: ${value}`); }
      if (flags === NATIVE_HUD_KEYCAP && count >= 1) {
        assert.ok(Math.abs(v.getFloat32(HEADER, true) + v.getFloat32(HEADER + 8, true) - 55 / 56) < 1e-6, "key plate hugs the right corner");
        assert.ok(Math.abs(v.getFloat32(HEADER + 4, true) + v.getFloat32(HEADER + 12, true) - 55 / 56) < 1e-6, "key plate hugs the bottom corner");
      }
      publications++; return 1;
    },
  }, document);
  const item = {parent: 43, child: 0, width: 64, height: 64, text: "15", color: "#abcdef"};
  layer.update("cooldowns", [item]);
  layer.update("keys", [{...item, binding: {input: {kind: "keyboard", code: "Digit1"}, modifiers: EMPTY_SKILL_KEY_MODIFIERS}}]);
  layer.update("effects", [{...item, parent: 55, child: 14, text: "5.1", color: "#eadcc2"}]);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(uploads, 1); assert.equal(labels.get(0), 3, "one combined keycap and two-digit timer publication"); assert.equal(labels.get(8), 3);
  for (const size of [24, 32, 48, 64, 96]) {
    layer.update("effects", [{...item, parent: 55, child: 14, width: size, height: size, text: "11", color: "#eadcc2"}]);
    const [, top, , height] = positions.get(8)!;
    assert.ok(top! >= 0 && top! + height! <= .840001, "effect number stays inside artwork above the duration strip at every scale");
  }
  const before = publications;
  layer.update("cooldowns", [item]); assert.equal(publications, before);
  layer.update("cooldowns", [{...item, text: "2.9"}]);
  layer.update("effects", [{...item, parent: 55, child: 14, text: "1.9", color: "#c86c65"}]);
  layer.update("cooldowns", [{...item, text: "2.8", width: 128, height: 128}]);
  assert.equal(uploads, 1);
  layer.update("effects", []); assert.equal(labels.get(8), 0);
  layer.update("effects", [{...item, parent: 55, child: 14, text: "4.2", color: "#e5ad52"}]);
  assert.equal(uploads, 1, "urgency sprites remain cached after expiry");
  const digitPositions: number[][] = [];
  for (const text of ["1", "7", "8", "6", "9"]) {
    layer.update("cooldowns", [{...item, text}]);
    digitPositions.push(positions.get(0)!);
  }
  for (const position of digitPositions) assert.deepEqual(position, digitPositions[0], "proportional font digits share a fixed cell and anchor");
  assert.equal(uploads, 1, "digit changes still reuse the atlas");
  layer.update("cooldowns", []); assert.equal(labels.get(0), 1, "expiry keeps the keycap in its existing composition");
  layer.update("cooldowns", [{...item, text: "9"}]); assert.equal(labels.get(0), 2);
  layer.update("keys", []); assert.equal(labels.get(0), 1, "disabling shortcuts preserves the timer");
  layer.update("keys", [{...item, binding: {input: {kind: "keyboard", code: "Digit1"}, modifiers: EMPTY_SKILL_KEY_MODIFIERS}}]);
  assert.equal(labels.get(0), 2);
  layer.update("cooldowns", [{...item, parent: 99, text: "8"}]);
  assert.equal(labels.get(0), 1, "different icon generations must not be merged");
  // A new color repacks the atlas. While a native icon still holds the current
  // atlas, the upload is busy: labels stay as they are and the repack retries.
  atlasResult = 2; const resetsBeforeBusy = resets; const publishedBeforeBusy = publications;
  layer.update("cooldowns", [{...item, parent: 99, text: "8", color: "#123456"}]);
  assert.equal(uploads, 2); assert.equal(resets, resetsBeforeBusy, "a busy atlas never resets native labels");
  assert.equal(publications, publishedBeforeBusy);
  atlasResult = 1; layer.update("cooldowns", [{...item, parent: 99, text: "8", color: "#123456"}]);
  assert.equal(uploads, 3); assert.ok(publications > publishedBeforeBusy, "the retried repack publishes the labels");
  view.dispatchEvent(new Event("gw:graphics-context-reset")); assert.equal(uploads, 4);
  layer.dispose(); layer.dispose(); assert.equal(resets, 2); assert.equal(allocated, freed); assert.equal(canvas.width, 0);
  layer.update("keys", []); assert.equal(allocated, freed);
});


test("keycaps retain stock proportions and corner position at every interface scale", () => {
  for (const icon of [28, 35, 48, 56, 64, 84, 112, 168]) {
    for (const artwork of [62, 138, 240]) {
      const layout = skillKeyPlateLayout(icon, icon, artwork);
      assert.equal(layout.inset / icon, 1 / 56);
      assert.ok(Math.abs(layout.width / layout.height - artwork / 64) < 1e-9);
      assert.ok(layout.width + 2 * layout.inset <= icon + 1e-9);
      if (artwork <= 138) assert.ok(Math.abs(layout.height / icon - 17 / 56) < 1e-9);
    }
  }
});


for (const addressBase of [0, 0x80000000]) test(`inactive HUDs allocate nothing and atlas repacks withdraw removed native labels at ${addressBase}`, async () => {
  let canvases = 0, uploads = 0, frees = 0, allocations = 0;
  const memory = new WebAssembly.Memory({initial: addressBase / 65536 + 80});
  const records = new Map<number, number>();
  const context = {save() {}, restore() {}, translate() {}, clearRect() {}, strokeText() {}, fillText() {},
    measureText: () => ({width: 28}), getImageData: () => ({data: new Uint8ClampedArray(1024 * 1024 * 4)})};
  const document = {defaultView: new EventTarget(), createElement() {
    canvases++; return {width: 0, height: 0, getContext: () => context};
  }} as unknown as Document;
  const layer = createNativeHudLayer({memory,
    malloc() { allocations++; return (addressBase + 1024) | 0; },
    free(region: number) { assert.equal(region, addressBase + 1024); frees++; },
    gwonmac_hud_atlas() { uploads++; return 1; },
    gwonmac_hud_reset() { records.clear(); },
    gwonmac_hud_label(region: number) {
      const view = new DataView(memory.buffer, region);
      records.set(view.getUint32(8, true), view.getUint32(20, true)); return 1;
    },
  }, document);
  await Promise.resolve(); await Promise.resolve();
  layer.update("keys", []); layer.update("cooldowns", []); layer.update("effects", []);
  assert.deepEqual({canvases, uploads, allocations}, {canvases: 0, uploads: 0, allocations: 0});
  const item = {parent: 43, child: 0, width: 56, height: 56, text: "15", color: "#abcdef"};
  layer.update("cooldowns", [item, {...item, child: 1, text: "9"}]);
  assert.equal(records.get(1), 1);
  // A new color repacks the atlas in the same update that slot 1 expires.
  layer.update("cooldowns", [{...item, color: "#123456"}, null]);
  assert.equal(uploads, 2);
  assert.equal(records.get(1), 0, "repacking must not forget a previously published slot");
  layer.update("cooldowns", []);
  layer.update("cooldowns", [{...item, color: "#123456"}]);
  assert.equal(uploads, 2, "a short idle gap retains the existing atlas");
  assert.equal(canvases, 1);
  layer.dispose();
  assert.equal(allocations, frees);
});


test("a failed native reset still releases HUD listeners and diagnostic ownership", () => {
  const view = new EventTarget() as EventTarget & {gwNativeHudStats?: unknown};
  const document = {defaultView: view} as unknown as Document;
  let resets = 0;
  const layer = createNativeHudLayer({gwonmac_hud_reset() {
    resets++; throw new Error("graphics context unavailable");
  }}, document);
  assert.equal(typeof view.gwNativeHudStats, "function");
  assert.throws(() => layer.dispose(), /graphics context unavailable/);
  assert.equal(view.gwNativeHudStats, undefined);
  layer.dispose();
  view.dispatchEvent(new Event("gw:graphics-context-reset"));
  assert.equal(resets, 1);
});
