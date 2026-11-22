// game.target, game.region, game.session, game.skillbar and ui.skillLabels over the real
// substrates and feeds. What would go wrong without these tests: the kernel keeps
// computing target or skill data with nobody listening (or never starts), a
// listener sees a stale value from before it subscribed, every game tick reaches a
// feature as a "change", the skill text lands on the wrong slot or repaints every
// frame, a zone change reads as a new character (and drops a feature's state), a
// relog to another character keeps the old one's state, or a build without the
// proof hands out values anyway.
import assert from "node:assert/strict";
import test from "node:test";
import { createGameBlocks, createUiBlocks, type GameRegion, type GameSession, type GameSkillbar, type GameTarget } from "../../app/renderer/game-blocks.ts";
import type { NativeHudChannel, NativeHudItem, NativeHudLayer } from "../../app/renderer/native-hud-layer.ts";
import type { CompanionPlayRegionState } from "../../app/renderer/companion-play-region-snapshot.ts";
import type { CompanionSnapshot } from "../../app/renderer/companion-snapshot.ts";
import { createPlayRegionObservationInstallation } from "../../app/renderer/play-region-state-installation.ts";
import { createToolsSubstrates } from "../../app/renderer/tools-companion-substrates.ts";
import { COMPANION_FEATURE_BITS } from "../../app/shared/companion-abi.ts";
import { capabilityRecord, type EnhancementCapability } from "../../app/shared/enhancement-contracts.ts";

const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));

function setup(t: test.TestContext, without: readonly EnhancementCapability[] = []) {
  const capabilities = capabilityRecord((capability) => !without.includes(capability));
  const { observation, chat, skills } = createToolsSubstrates(EMPTY_MODULE, capabilities, "none");
  t.after(() => { skills.geometry.dispose(); skills.cooldowns.dispose(); });
  const pointer = { pointer: 0 };
  // The installer hands each part Core's activation; observation reads only Core's pointers.
  const session = observation.prepared.activate({
    core: { snapshot: pointer, toolbox: pointer, party: pointer },
  } as unknown as Parameters<typeof observation.prepared.activate>[0]);
  const playRegions = createPlayRegionObservationInstallation(capabilities.playRegionObservation);
  playRegions.setActive(true);
  t.after(() => playRegions.dispose());
  let syncs = 0;
  const syncObservers = () => { syncs += 1; };
  const game = createGameBlocks({ capabilities, observation, chat, playRegions, skills, syncObservers });
  // The game's canvas fills an 800 × 600 window.
  const view = new EventTarget();
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  const document = { defaultView: view, getElementById: (id: string) => id === "canvas" ? canvas : null };
  const drawn: (readonly (NativeHudItem | null)[])[] = [];
  const hud: NativeHudLayer = { update(channel: NativeHudChannel, items) { if (channel === "cooldowns") drawn.push(items); }, dispose() {} };
  const ui = createUiBlocks({ capabilities, hud, skills, document: document as unknown as Document, syncObservers });
  return {
    game,
    ui,
    view,
    drawn,
    skills,
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

const recharge = (sequence: number, gameTimer: number, rechargeTimestamps: readonly number[]) =>
  Object.freeze({ status: "ready", sequence, generation: 1, gameTimer, playerAgentId: 7, rechargeTimestamps } as const);

const bar = (sequence: number, frameId = 43) => Object.freeze({
  status: "ready", sequence, frameId, viewportWidth: 800, viewportHeight: 600,
  slots: Object.freeze(Array.from({ length: 8 }, (_, slot) => Object.freeze({ left: 100 + slot * 50, bottom: 20, right: 148 + slot * 50, top: 68 }))),
} as const);

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

const GAME = Object.freeze({ status: "waiting", reason: "game" } as const);
const MAP_LOADING = Object.freeze({ status: "waiting", reason: "loading" } as const);
/** A ready map; `character` is the key the game publishes, null while it has not yet. */
const map = (mapId: number, character: string | null, playRegion: "pve" | "pvp" = "pve") => (sequence: number) =>
  Object.freeze({
    status: "ready", sequence, mapId, instanceType: 0, playRegion, travelContext: "world", characterKey: character,
    unlockedMapWords: null, guildHall: false, hasGuildHall: false,
  } as const) satisfies CompanionPlayRegionState;
const MO = "000000010000000a";
const KAI = "000000010000000b";

test("game.session gives one session per character through login, relog, character select and zone changes", async (t) => {
  // Each row is what the play region publishes; the expected list names each session
  // the block gave by letter, in the order it gave them.
  const rows: readonly (readonly [string, readonly (CompanionPlayRegionState | ((sequence: number) => CompanionPlayRegionState))[], readonly (string | null)[]])[] = [
    ["login: the first outpost adopts the key it publishes later",
      [GAME, MAP_LOADING, map(248, null), map(248, MO)], [null, "A"]],
    ["zone change: loading and a moment of unavailable game keep the session",
      [map(248, MO), MAP_LOADING, GAME, MAP_LOADING, map(249, null), map(249, MO)], [null, "A"]],
    ["relog to another character starts a new session on its first key",
      [map(248, MO), GAME, MAP_LOADING, map(248, null), map(248, KAI)], [null, "A", "B"]],
    ["relog to the same character keeps the session",
      [map(248, MO), GAME, MAP_LOADING, map(248, MO)], [null, "A"]],
    ["character select before the key is known ends the session",
      [map(248, null), GAME, MAP_LOADING, map(248, KAI)], [null, "A", null, "B"]],
    ["a different key without character select starts a new session",
      [map(248, MO), map(248, KAI)], [null, "A", "B"]],
    ["a PvP map is in the game too",
      [map(249, MO, "pvp"), MAP_LOADING, map(248, MO)], [null, "A"]],
  ];
  for (const [name, states, expected] of rows) {
    await t.test(name, (t) => {
      const run = setup(t);
      const seen: (GameSession | null)[] = [];
      const stop = run.game.session.subscribe((session) => seen.push(session));
      states.forEach((state, index) => run.region(typeof state === "function" ? state(2 + index * 2) : state));
      stop();
      const letters = new Map<number, string>();
      assert.deepEqual(seen.map((session) => session === null ? null
        : letters.get(session.id) ?? (letters.set(session.id, String.fromCharCode(65 + letters.size)), letters.get(session.id)!)), expected);
    });
  }
});

test("game.session reads the region only while someone listens and never repeats an id", (t) => {
  const run = setup(t);
  run.region(map(248, MO)(2));
  const first: (GameSession | null)[] = [];
  const stop = run.game.session.subscribe((session) => first.push(session));
  const late: (GameSession | null)[] = [];
  const stopLate = run.game.session.subscribe((session) => late.push(session));
  assert.equal(first.length, 1);
  assert.deepEqual(late, first, "a later listener starts from the current session");
  stop();
  stopLate();
  run.region(map(248, KAI)(4));
  assert.equal(first.length, 1, "a stopped listener hears nothing more");

  const again: (GameSession | null)[] = [];
  run.game.session.subscribe((session) => again.push(session))();
  assert.equal(again.length, 1);
  assert.notEqual(again[0]?.id, first[0]?.id);
});

test("a build without the proof offers no value and asks the kernel for nothing", (t) => {
  const run = setup(t, ["targetObservation", "playRegionObservation"]);
  for (const block of [run.game.target, run.game.region, run.game.session]) {
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

test("game.skillbar reads the recharge feed only while someone listens and gives each change once", (t) => {
  const run = setup(t);
  const seen: (GameSkillbar | null)[] = [];
  assert.equal(run.skills.cooldowns.active, false);
  const stop = run.game.skillbar.subscribe((skillbar) => seen.push(skillbar));
  assert.equal(run.skills.cooldowns.active, true);
  assert.equal(run.skills.activeFeatureFlags, COMPANION_FEATURE_BITS.skillCooldownObservation);

  for (const state of [
    recharge(2, 10_000, [12_899, 24_001, 0, 0, 0, 0, 0, 10_400]),
    // A new publication with the same times changes nothing a feature can show.
    recharge(4, 10_000, [12_899, 24_001, 0, 0, 0, 0, 0, 10_400]),
    // A time already passed is ready.
    recharge(6, 13_000, [12_899, 24_001, 0, 0, 0, 0, 0, 10_400]),
    // The game's 32-bit timer wraps between now and the time a skill is ready.
    recharge(8, 0xffff_ff00, [0x100, 0, 0, 0, 0, 0, 0, 0]),
    recharge(10, 10_000, [1, 2, 3]),
  ]) run.skills.cooldowns.sink?.update(state);
  stop();
  assert.equal(run.skills.cooldowns.active, false);
  assert.deepEqual(seen, [
    null,
    { rechargeMs: [2_899, 14_001, 0, 0, 0, 0, 0, 400] },
    { rechargeMs: [0, 11_001, 0, 0, 0, 0, 0, 0] },
    { rechargeMs: [0x200, 0, 0, 0, 0, 0, 0, 0] },
    null,
  ]);
});

test("ui.skillLabels draws each text on its own slot, repaints only on a change and cleans up", (t) => {
  const run = setup(t);
  const labels = run.ui.skillLabels.claim();
  assert.equal(run.skills.geometry.active, true, "a claim reads the slot positions");
  assert.throws(() => run.ui.skillLabels.claim(), /already claimed/u);
  run.skills.geometry.sink?.update(bar(2));
  const texts = ["2.9", "15", null, null, null, null, null, "0.4"];
  labels.show(texts, "#abcdef");
  const painted = run.drawn.length;
  assert.deepEqual(run.drawn.at(-1)?.map((item) => item && [item.parent, item.child, item.text, item.color, item.width, item.height]), [
    [43, 0, "2.9", "#abcdef", 48, 48], [43, 1, "15", "#abcdef", 48, 48], null, null, null, null, null, [43, 7, "0.4", "#abcdef", 48, 48],
  ]);
  labels.show([...texts], "#abcdef");
  assert.equal(run.drawn.length, painted, "the same texts cost no repaint");
  run.view.dispatchEvent(new Event("resize"));
  assert.equal(run.drawn.length, painted + 1, "a resize repaints");
  run.skills.geometry.sink?.update(Object.freeze({ status: "waiting", reason: "memory" } as const));
  assert.deepEqual(run.drawn.at(-1), [], "no slot positions, no text");

  labels.stop();
  labels.stop();
  assert.equal(run.skills.geometry.active, false);
  assert.deepEqual(run.drawn.at(-1), []);
  run.view.dispatchEvent(new Event("resize"));
  labels.show(texts, "#abcdef");
  assert.deepEqual(run.drawn.at(-1), [], "a stopped claim draws nothing");
  run.ui.skillLabels.claim().stop();
});

test("a build without the skill proofs offers no skill values and draws nothing", (t) => {
  const run = setup(t, ["skillCooldownObservation", "nativeHudRendering"]);
  for (const block of [run.game.skillbar, run.ui.skillLabels]) {
    assert.deepEqual({ available: block.available, reason: block.available ? null : block.reason },
      { available: false, reason: "not-proven" });
  }
  const seen: unknown[] = [];
  run.game.skillbar.subscribe((value) => seen.push(value))();
  run.ui.skillLabels.claim().show(["1"], "#fff");
  assert.deepEqual(seen, [null]);
  assert.deepEqual(run.drawn, []);
  assert.equal(run.skills.cooldowns.active, false);
  assert.equal(run.skills.geometry.active, false);
  assert.equal(run.syncs, 0);
});
