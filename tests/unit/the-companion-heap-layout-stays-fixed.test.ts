// The Tools companion allocates its memory in COMPANION_PARTS order, and that
// order is the heap layout the kernel and the proofs expect. Building blocks
// (app/renderer/game-blocks.ts) wrap the substrates and must not move it: a
// block that allocated, or a part that changed place, would shift every region
// after it without failing typecheck. This test pins the layout with every
// capability on.
import assert from "node:assert/strict";
import test from "node:test";
import { COMPANION_PARTS } from "../../app/features/companion-parts.ts";
import { prepareToolsCompanionExtension } from "../../app/renderer/certified-companion-tools-installation.ts";
import { capabilityRecord } from "../../app/shared/enhancement-contracts.ts";
import {
  FRIEND_OBSERVER_MANIFEST_SECTION,
  FRIEND_OBSERVER_SEMANTIC_SHA256,
  FRIEND_OBSERVER_TRANSFORM_ABI,
} from "../../app/shared/friend-observer-contract.ts";

/** An empty module that carries one friend observer manifest, as a certified build does. */
function moduleWithFriendManifest(): WebAssembly.Module {
  const encoder = new TextEncoder();
  const name = encoder.encode(FRIEND_OBSERVER_MANIFEST_SECTION);
  const payload = encoder.encode(JSON.stringify({
    transformAbi: FRIEND_OBSERVER_TRANSFORM_ABI,
    inputSha256: "0".repeat(64),
    semanticSha256: FRIEND_OBSERVER_SEMANTIC_SHA256,
    root: 4096,
  }));
  const leb = (value: number) => {
    const bytes: number[] = [];
    do {
      let byte = value & 0x7f;
      value >>>= 7;
      if (value !== 0) byte |= 0x80;
      bytes.push(byte);
    } while (value !== 0);
    return bytes;
  };
  const body = [...leb(name.length), ...name, ...payload];
  return new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 0, ...leb(body.length), ...body]));
}

test("the Tools companion allocates the same regions in the same order", async (t) => {
  const previousWindow = globalThis.window;
  // Xunlai Storage reads the development flag while it prepares.
  globalThis.window = { gwNative: { init: { development: false } } } as unknown as typeof globalThis.window;
  t.after(() => { globalThis.window = previousWindow; });
  // Every certified export the parts look for answers as a function; no part calls one while preparing.
  const exports = new Proxy({}, { get: () => () => 0, has: () => true }) as WebAssembly.Exports;

  const extension = await prepareToolsCompanionExtension(
    exports, moduleWithFriendManifest(), capabilityRecord(() => true), "none");
  let next = 4096;
  extension.allocate((bytes: number) => {
    const pointer = next;
    next += Math.ceil(bytes / 16) * 16;
    return pointer;
  });

  assert.deepEqual(COMPANION_PARTS.map((part) => part.id), [
    "observation", "friends", "quickItemMove", "whispers", "reminders", "skillHud", "alcohol",
    "alcoholTimer", "progress", "effects", "effectTimers", "xunlaiStorage", "travel", "teamApply",
    "tools", "cartography", "targetReadout", "resign", "tradeChat", "chatFilters",
  ]);
  assert.deepEqual(extension.ownedRegions().map(({ name, pointer, size, align }) => [name, pointer, size, align]), [
    ["friend snapshot", 4096, 12312, 4],
    ["Quick Item Move payload", 16416, 1580, 4],
    ["whispers", 18000, 9828, 4],
    ["chat-print", 27840, 512, 4],
    ["skill slots", 28352, 164, 4],
    ["skill cooldowns", 28528, 60, 4],
    ["alcohol", 28592, 32, 4],
    ["progress", 28624, 18616, 4],
    ["player effects", 47248, 1572, 4],
    ["effect icons", 48832, 1340, 4],
    ["storage payload", 50176, 12, 4],
    ["travel payload", 50192, 16, 4],
  ]);
  assert.deepEqual(Object.keys(extension.kernelRegions), [
    "friendRoot", "friends", "whispers", "skillSlots", "skillCooldowns", "alcohol", "progress",
    "playerEffects", "effectIcons",
  ]);
  assert.equal(extension.kernelRegions.friendRoot, 4096);
  assert.equal(extension.featureFlags, 0x3f3e);
  assert.deepEqual(extension.memoryNeeds, {
    snapshot: true, toolbox: true, commandPayloadBytes: 160, professionTrace: false, professionTraceBytes: 128,
  });
});
