import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPANION_PLAY_REGION_BYTES,
  COMPANION_PLAY_REGION_ABI,
  readCompanionPlayRegion,
} from "../../app/renderer/companion-play-region-snapshot.ts";

function snapshot(overrides: Readonly<{
  magic?: number;
  abi?: number;
  bytes?: number;
  sequence?: number;
  flags?: number;
  mapId?: number;
  instanceType?: number;
  playRegion?: number;
  characterLow?: number;
  characterHigh?: number;
  unlockedMapWords?: readonly number[];
}> = {}) {
  const buffer = new ArrayBuffer(COMPANION_PLAY_REGION_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, overrides.magic ?? 0x5250_5747, true);
  view.setUint16(4, overrides.abi ?? COMPANION_PLAY_REGION_ABI, true);
  view.setUint16(6, overrides.bytes ?? COMPANION_PLAY_REGION_BYTES, true);
  view.setUint32(8, overrides.sequence ?? 2, true);
  view.setUint32(12, overrides.flags ?? 1, true);
  view.setUint32(16, overrides.mapId ?? 133, true);
  view.setUint32(20, overrides.instanceType ?? 0, true);
  view.setUint32(24, overrides.playRegion ?? 1, true);
  view.setUint32(28, overrides.characterLow ?? 0, true);
  view.setUint32(32, overrides.characterHigh ?? 0, true);
  overrides.unlockedMapWords?.forEach((word, index) =>
    view.setUint32(36 + index * 4, word, true));
  return buffer;
}

const read = (overrides: Parameters<typeof snapshot>[0] = {}) =>
  readCompanionPlayRegion(snapshot(overrides), 0);

const ready = (overrides: Record<string, unknown> = {}) => ({
  status: "ready",
  sequence: 2,
  mapId: 133,
  instanceType: 0,
  playRegion: "pve",
  travelContext: "world",
  characterKey: null,
  unlockedMapWords: null,
  guildHall: false,
  hasGuildHall: false,
  ...overrides,
});

describe("play-region snapshot ABI", () => {
  it("decodes only a complete certified PvE or PvP record", () => {
    assert.deepEqual(read(), ready());
    assert.deepEqual(
      read({ mapId: 248, instanceType: 1, playRegion: 2 }),
      ready({ mapId: 248, instanceType: 1, playRegion: "pvp" }),
    );
  });

  it("publishes Pre-Searing and Guild Hall flags only beside a ready record", () => {
    assert.deepEqual(
      read({ flags: 17, mapId: 148 }),
      ready({ mapId: 148, travelContext: "pre-searing" }),
    );
    assert.deepEqual(read({ flags: 65 }), ready({ hasGuildHall: true }));
    assert.deepEqual(
      read({ flags: 97 }),
      ready({ guildHall: true, hasGuildHall: true }),
    );
  });

  it("fails closed for memory, torn headers, contradictory flags, and values", () => {
    const cleared = { mapId: 0, instanceType: 0, playRegion: 0 };
    const cases: [name: string, state: ReturnType<typeof read>, reason: string][] = [
      ["short buffer", readCompanionPlayRegion(new ArrayBuffer(COMPANION_PLAY_REGION_BYTES - 1), 0), "memory"],
      ["odd sequence", read({ sequence: 3 }), "writing"],
      ["wrong magic", read({ magic: 0 }), "snapshot"],
      ["flags 3", read({ flags: 3 }), "snapshot"],
      ["map id out of range", read({ mapId: 2_001 }), "corrupt"],
      ["ready without a region", read({ playRegion: 0 }), "corrupt"],
      ["flags 33", read({ flags: 33 }), "corrupt"],
      ["pre-searing with PvP", read({ flags: 17, mapId: 148, instanceType: 1, playRegion: 2 }), "corrupt"],
      ["pre-searing without a ready record", read({ flags: 16, ...cleared }), "snapshot"],
      ["loading clears every value", read({ flags: 2, ...cleared }), "loading"],
      ["unavailable clears every value", read({ flags: 0, ...cleared }), "game"],
      ["loading with values", read({ flags: 2 }), "corrupt"],
      ["unavailable with values", read({ flags: 0 }), "corrupt"],
    ];
    for (const [name, state, reason] of cases) {
      assert.deepEqual(state, { status: "waiting", reason }, name);
    }
  });
});
