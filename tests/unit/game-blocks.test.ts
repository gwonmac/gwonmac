// game.target and game.region over the real observation substrate and the real
// play-region feed. What would go wrong without these tests: the kernel keeps
// computing target data with nobody listening (or never starts), a listener sees
// a stale target from before it subscribed, every game tick reaches a feature as
// a "change", or a build without the proof hands out values anyway.
import assert from "node:assert/strict";
import test from "node:test";
import { createGameBlocks, type GameRegion, type GameTarget } from "../../app/renderer/game-blocks.ts";
import type { CompanionPlayRegionState } from "../../app/renderer/companion-play-region-snapshot.ts";
import type { CompanionSnapshot } from "../../app/renderer/companion-snapshot.ts";
import { createPlayRegionObservationInstallation } from "../../app/renderer/play-region-state-installation.ts";
import { createToolsSubstrates } from "../../app/renderer/tools-companion-substrates.ts";
import { COMPANION_FEATURE_BITS } from "../../app/shared/companion-abi.ts";
import { capabilityRecord, type EnhancementCapability } from "../../app/shared/enhancement-contracts.ts";

const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));

function setup(t: test.TestContext, without: readonly EnhancementCapability[] = []) {
  const capabilities = capabilityRecord((capability) => !without.includes(capability));
  const { observation } = createToolsSubstrates(EMPTY_MODULE, capabilities, "none");
  const pointer = { pointer: 0 };
  // The installer hands each part Core's activation; observation reads only Core's pointers.
  const session = observation.prepared.activate({
    core: { snapshot: pointer, toolbox: pointer, party: pointer },
  } as unknown as Parameters<typeof observation.prepared.activate>[0]);
  const playRegions = createPlayRegionObservationInstallation(capabilities.playRegionObservation);
  playRegions.setActive(true);
  t.after(() => playRegions.dispose());
  let syncs = 0;
  const game = createGameBlocks({ capabilities, observation, playRegions, syncObservers: () => { syncs += 1; } });
  return {
    game,
    get syncs() { return syncs; },
    /** What the kernel is asked to compute: the target bit and the game snapshot. */
    observing: () => ({
      target: (session.activeFeatures() & COMPANION_FEATURE_BITS.targetObservation) !== 0,
      state: session.observer.state?.enabled() ?? false,
    }),
    snapshot: (state: CompanionSnapshot) => session.observer.state?.update(state),
    region: (state: CompanionPlayRegionState) => playRegions.sink?.update(state),
  };
}

function inGame(target: Readonly<{ distance: number; rangeBand: number; rangeName: GameTarget["range"] }> | null) {
  return Object.freeze({
    status: "ready", sequence: 2, tickCount: 1, mapId: 248, instanceType: 1, playRegion: "pve",
    playerId: 7, playerX: 0, playerY: 0, xunlaiAccess: null, onWorldMap: false, instanceName: "Explorable",
    ...(target === null
      ? { targetId: 0, agentTypeBits: 0, targetX: 0, targetY: 0, distance: 0, rangeBand: 0,
          targetValid: false, targetKind: "None", rangeName: "None" }
      : { targetId: 9, agentTypeBits: 0xdb, targetX: 1, targetY: 1, targetValid: true, targetKind: "Living", ...target }),
  } as const) satisfies CompanionSnapshot;
}

const LOADING = Object.freeze({ status: "waiting", reason: "loading", sequence: 4, tickCount: 2 } as const);

test("game.target asks the kernel for the target only while someone listens", (t) => {
  const run = setup(t);
  assert.deepEqual(run.observing(), { target: false, state: false });

  const stopFirst = run.game.target.subscribe(() => {});
  assert.deepEqual(run.observing(), { target: true, state: true });
  const stopSecond = run.game.target.subscribe(() => {});
  assert.equal(run.syncs, 1, "only the first listener changes the demand");

  stopFirst();
  stopFirst();
  assert.deepEqual(run.observing(), { target: true, state: true });
  stopSecond();
  assert.deepEqual(run.observing(), { target: false, state: false });
  assert.equal(run.syncs, 2);
});

test("game.target gives the selected target once per change and nothing for other states", (t) => {
  const run = setup(t);
  const seen: (GameTarget | null)[] = [];
  const stop = run.game.target.subscribe((target) => seen.push(target));
  for (const state of [
    inGame({ distance: 1012.5, rangeBand: 5, rangeName: "Spellcast" }),
    inGame({ distance: 1012.5, rangeBand: 5, rangeName: "Spellcast" }),
    inGame({ distance: 80, rangeBand: 1, rangeName: "Adjacent" }),
    inGame(null),
    inGame({ distance: 80, rangeBand: 1, rangeName: "Adjacent" }),
    LOADING,
  ]) run.snapshot(state);
  assert.deepEqual(seen, [
    null,
    { distance: 1012.5, range: "Spellcast" },
    { distance: 80, range: "Adjacent" },
    null,
    { distance: 80, range: "Adjacent" },
    null,
  ]);

  run.snapshot(inGame({ distance: 300, rangeBand: 3, rangeName: "Area" }));
  stop();
  run.snapshot(inGame({ distance: 900, rangeBand: 5, rangeName: "Spellcast" }));
  const later: (GameTarget | null)[] = [];
  run.game.target.subscribe((target) => later.push(target));
  assert.equal(seen.length, 7, "a stopped listener hears nothing more");
  assert.deepEqual(later, [null], "a new listener never starts from a target read before it listened");
});

test("game.region gives the area once per change and null while it is unknown", (t) => {
  const run = setup(t);
  const seen: (GameRegion | null)[] = [];
  const area = (sequence: number, playRegion: "pve" | "pvp", instanceType: number, mapId: number) => Object.freeze({
    status: "ready", sequence, mapId, instanceType, playRegion, travelContext: "world", characterKey: null,
    unlockedMapWords: null, guildHall: false, hasGuildHall: false,
  } as const) satisfies CompanionPlayRegionState;

  run.region(area(2, "pve", 0, 248));
  const stop = run.game.region.subscribe((region) => seen.push(region));
  for (const state of [
    area(4, "pve", 0, 248),
    area(6, "pve", 1, 249),
    Object.freeze({ status: "waiting", reason: "loading" } as const),
    area(8, "pvp", 1, 249),
  ]) run.region(state);
  stop();
  run.region(area(10, "pve", 0, 248));
  assert.deepEqual(seen, [
    { area: "pve", instance: "outpost", mapId: 248 },
    { area: "pve", instance: "explorable", mapId: 249 },
    null,
    { area: "pvp", instance: "explorable", mapId: 249 },
  ]);
});

test("a build without the proof offers no value and asks the kernel for nothing", (t) => {
  const run = setup(t, ["targetObservation", "playRegionObservation"]);
  for (const block of [run.game.target, run.game.region]) {
    assert.deepEqual({ available: block.available, reason: block.available ? null : block.reason },
      { available: false, reason: "not-proven" });
    const seen: unknown[] = [];
    const stop = block.subscribe((value) => seen.push(value));
    run.snapshot(inGame({ distance: 80, rangeBand: 1, rangeName: "Adjacent" }));
    stop();
    assert.deepEqual(seen, [null]);
  }
  assert.deepEqual(run.observing(), { target: false, state: false });
  assert.equal(run.syncs, 0);
});
