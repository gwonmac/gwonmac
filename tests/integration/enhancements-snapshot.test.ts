import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decoded,
  readCompanionSnapshot,
  rejected,
  snapshot,
} from "../fixtures/enhancements.ts";

describe("Companion snapshot ABI", () => {
  it("decodes stable player and target state", () => {
    const state = decoded(readCompanionSnapshot(snapshot(), 0));
    assert.equal(state.status, "ready");
    assert.equal(state.mapId, 133);
    assert.equal(state.instanceName, "Outpost");
    assert.equal(state.playerId, 7);
    assert.equal(state.targetId, 9);
    assert.equal(state.targetKind, "Living");
    assert.equal(state.rangeName, "Adjacent");
    assert.equal(state.xunlaiAccess, null);
    assert.equal(state.onWorldMap, true);
  });

  it("decodes the Xunlai access tri-state and an absent target", () => {
    const state = (flags: number) => decoded(readCompanionSnapshot(snapshot({ flags }), 0));
    assert.equal(state(3).targetValid, false);
    assert.equal(state(3 | 0x10).xunlaiAccess, false);
    assert.equal(state(3 | 0x10 | 0x20).xunlaiAccess, true);
  });

  it("rejects torn, incompatible, loading, impossible, and non-finite snapshots", () => {
    const corruptAbi = snapshot();
    new DataView(corruptAbi).setUint16(4, 1, true);
    const cases: [name: string, buffer: ArrayBuffer, reason: string][] = [
      ["odd sequence", snapshot({ sequence: 3 }), "writing"],
      ["wrong ABI", corruptAbi, "snapshot"],
      ["loading flag", snapshot({ flags: 8 }), "loading"],
      ["Xunlai bit 0x20 without 0x10", snapshot({ flags: 3 | 0x20 }), "snapshot"],
      ["unknown flag 0x80", snapshot({ flags: 0x80 }), "snapshot"],
      ["unknown flag 0x40", snapshot({ flags: 0x40 }), "snapshot"],
      ["player id 0", snapshot({ playerId: 0 }), "corrupt"],
      ["range band 9", snapshot({ rangeBand: 9 }), "corrupt"],
      ["NaN distance", snapshot({ distance: Number.NaN }), "corrupt"],
    ];
    for (const [name, buffer, reason] of cases) {
      assert.equal(rejected(readCompanionSnapshot(buffer, 0)), reason, name);
    }
  });
});
