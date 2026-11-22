// A feature built with featurePart (app/renderer/tools-companion-part.ts) runs while resolve
// (app/shared/feature-resolve.ts) has it on: its switch, the plain game, and a build that proved
// every capability its manifest uses, from main's facts.
// Each feature runs here on the real blocks and feeds; only the native HUD, the game's
// exports and Travel's link are stubs.
// What would go wrong without this test: a feature draws or prints nothing after it moved
// onto the blocks, its drawing stays after the player turned it off, a feed keeps running
// for nobody, a settings change does not reach it, or a build without the native renderer
// still reads the feeds, or a patch day or the plain game leaves it running.
import assert from "node:assert/strict";
import test from "node:test";
import cartography from "../../app/features/cartography/companion.ts";
import { readCartographyQuestMarker } from "../../app/features/cartography/renderer/cartography-player-state.ts";
import effectTimers from "../../app/features/effect-timers/companion.ts";
import progress from "../../app/features/progress/companion.ts";
import reminders from "../../app/features/reminders/companion.ts";
import skillCooldowns from "../../app/features/skill-cooldowns/companion.ts";
import skillKeyLabels from "../../app/features/skill-key-labels/companion.ts";
import { provideLink } from "../../app/renderer/feature-links.ts";
import { createGameBlocks, createUiBlocks } from "../../app/renderer/game-blocks.ts";
import type { NativeHudChannel, NativeHudItem, NativeHudLayer } from "../../app/renderer/native-hud-layer.ts";
import { createPlayRegionObservationInstallation } from "../../app/renderer/play-region-state-installation.ts";
import type { PreparedToolsPart, ToolsActivation, ToolsCompanionPart, ToolsPrepareInput } from "../../app/renderer/tools-companion-part.ts";
import { createToolsSubstrates } from "../../app/renderer/tools-companion-substrates.ts";
import { CHAT_PRINT_MAILBOX, CHAT_PRINT_STATUS } from "../../app/shared/chat-print.ts";
import type { OptionalFeatureStatus } from "../../app/shared/contracts.ts";
import { capabilityRecord, type EnhancementCapability } from "../../app/shared/enhancement-contracts.ts";
import { FEATURES, FEATURE_SELECTION_POLICIES, featureSwitchSettings, type FeatureId } from "../../app/shared/feature-contracts.ts";
import { resolveFeature, type FeatureFacts } from "../../app/shared/feature-resolve.ts";
import type { GameProgressState } from "../../app/shared/game-progress.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "../../app/shared/settings/index.ts";
import { EMPTY_SKILL_KEY_MODIFIERS } from "../../app/shared/skill-key-bindings.ts";

const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));

type Options = Readonly<{
  without?: readonly EnhancementCapability[];
  /** Capabilities main's facts prove but this renderer's installation does not carry. */
  notInstalled?: readonly EnhancementCapability[];
  settings?: Partial<AppSettings>;
}>;

/**
 * Runs one part the way the installer does: prepare, memory, activate, mount. The part asks
 * resolve, with facts as main sends them: Features loaded, the feature switched on, and every
 * capability proved but those `without` names, which this build changed.
 */
/** The switch that runs a feature: its own, or for one without (Progress), the switch of the feature it requires. */
function switchThatRuns(id: FeatureId): string {
  const feature = FEATURES.find((each) => each.id === id)!;
  return FEATURE_SELECTION_POLICIES[id].switch ?? switchThatRuns(("requires" in feature ? feature.requires : [])[0]!);
}

function start(t: test.TestContext, part: ToolsCompanionPart, id: FeatureId, { without = [], notInstalled = [], settings: patch = {} }: Options = {}) {
  const capabilities = capabilityRecord((capability) => !without.includes(capability) && !notInstalled.includes(capability));
  const substrates = createToolsSubstrates(EMPTY_MODULE, capabilities, "none");
  const { skills } = substrates;
  const playRegions = createPlayRegionObservationInstallation(capabilities.playRegionObservation);
  t.after(() => { skills.geometry.dispose(); skills.cooldowns.dispose(); playRegions.dispose(); });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  const document = { defaultView: null, getElementById: () => canvas } as unknown as Document;
  const drawn: Partial<Record<NativeHudChannel, readonly (NativeHudItem | null)[]>> = {};
  const hud: NativeHudLayer = { update(channel, items) { drawn[channel] = items; }, dispose() {} };
  // The game's side: chat print hands each line to the game thread through its mailbox.
  const memory = new WebAssembly.Memory({ initial: 1 });
  const printed: string[] = [];
  const configured: number[] = [];
  let mailbox = 0;
  const exports = {
    enhancement_configure_chat_print: (_pointer: number, enabled: number) => { configured.push(enabled); return 1; },
    enhancement_print_chat: () => {
      const view = new DataView(memory.buffer);
      const length = view.getUint32(mailbox + CHAT_PRINT_MAILBOX.length, true);
      printed.push(String.fromCharCode(...Array.from({ length }, (_, at) => view.getUint16(mailbox + CHAT_PRINT_MAILBOX.source + at * 2, true))));
      // The game thread prints it at once.
      view.setUint32(mailbox + CHAT_PRINT_MAILBOX.status, CHAT_PRINT_STATUS.printed, true);
      return 1;
    },
  } as unknown as WebAssembly.Exports;
  const trips: GameProgressState[] = [];
  const syncObservers = () => {};
  let settings: AppSettings = { ...DEFAULT_SETTINGS, ...patch };
  const own = switchThatRuns(id);
  let facts: FeatureFacts = {
    stage: "dev", toolsAtLaunch: true,
    settings: { ...featureSwitchSettings(settings), gwonmacTools: true, [own]: true },
    program: "none",
    features: {
      gameFileSaving: { status: "available" },
      nativeDoubleClick: { status: "available" },
      cartography: { status: "available" },
      ...capabilityRecord((capability) => without.includes(capability)
        ? { status: "unavailable", reason: "game-update" } : { status: "available" }),
    },
  };
  // Travel's link, which Progress reports to; a link reads main's facts in the game window.
  const globals = globalThis as { window?: EventTarget };
  const ownWindow = globals.window === undefined;
  const browserWindow = globals.window ?? new EventTarget();
  Object.assign(browserWindow, { gwFeatureFacts: () => facts });
  if (ownWindow) globals.window = browserWindow;
  const stopLink = provideLink("travel", {
    friendTripBlocked: () => "unavailable", toFriend: () => "unavailable", toggle: () => "unavailable",
    showProgress: (state) => { trips.push(state); return "shown"; },
  });
  t.after(() => { stopLink(); if (ownWindow) Reflect.deleteProperty(globals, "window"); });
  const context = {
    memory,
    snapshot: () => ({ settings, facts, playRegion: "pve", playRegionState: { status: "waiting", reason: "game" } }),
    on: (feature: FeatureId) => resolveFeature(feature, { ...facts, playRegion: "pve" }).on,
    playRegion: () => "pve",
    game: createGameBlocks({ capabilities, substrates, playRegions, syncObservers }),
    ui: createUiBlocks({ capabilities, hud, substrates, document, syncObservers }),
  } as unknown as ToolsActivation;
  const prepared = part.prepare({ exports, module: EMPTY_MODULE, capabilities, program: "none", substrates } as ToolsPrepareInput) as PreparedToolsPart;
  prepared.allocate?.((bytes) => { mailbox = 1024; return bytes > 0 ? mailbox : 0; });
  prepared.initialize?.(memory);
  const session = prepared.activate!(context);
  const sync = () => { session.syncFeeds?.(); session.sync?.(); };
  session.mount?.();
  sync();
  return {
    session,
    substrates,
    drawn,
    printed,
    configured,
    trips,
    /** Hands queued chat lines to the game, one per frame. */
    frames(count: number) { for (let frame = 0; frame < count; frame += 1) for (const poller of session.pollers ?? []) poller.poll(); },
    /** The feature's own switch, as main's facts carry it. */
    turn(next: boolean) { facts = { ...facts, settings: { ...facts.settings, [own]: next } }; sync(); },
    /** The plain-game switch. */
    plainGame(next: boolean) { facts = { ...facts, settings: { ...facts.settings, gwonmacTools: !next } }; sync(); },
    /** The verifier's status of one capability for this build, as main's facts carry it. */
    check(capability: EnhancementCapability, status: OptionalFeatureStatus) {
      facts = { ...facts, features: { ...facts.features!, [capability]: status } };
      sync();
    },
    change(next: Partial<AppSettings>) { settings = { ...settings, ...next }; session.syncFeeds?.(); session.sync?.(); },
    stop() { for (const stop of session.disposePresentation ?? []) stop(); },
  };
}

const bar = (sequence: number) => Object.freeze({
  status: "ready", sequence, frameId: 43, viewportWidth: 800, viewportHeight: 600,
  slots: Object.freeze(Array.from({ length: 8 }, (_, slot) => Object.freeze({ left: 100 + slot * 50, bottom: 20, right: 148 + slot * 50, top: 68 }))),
} as const);
const recharge = (sequence: number) => Object.freeze({
  status: "ready", sequence, generation: 1, gameTimer: 10_000, playerAgentId: 7,
  rechargeTimestamps: Object.freeze([12_899, 24_001, 0, 0, 0, 0, 0, 10_400]),
} as const);
const effectsAt = (gameTimer: number, applied: readonly (readonly [skillId: number, durationMs: number, appliedAtGameMs: number])[]) =>
  Object.freeze({
    status: "ready", sequence: gameTimer, generation: 1, gameTimer, playerAgentId: 7,
    effects: Object.freeze(applied.map(([skillId, durationMs, appliedAtGameMs], index) => Object.freeze({
      effectId: 100 + index, skillId, attributeLevel: 0, maintainerAgentId: 0, durationMs, appliedAtGameMs }))),
  } as const);
const CELERITY = 2522, CUPCAKE = 1945, MINUTE = 60_000, THIRTY = 30 * MINUTE;

test("Skill Cooldowns shows the recharge on the skill bar while it is on, and stops reading once off", (t) => {
  const run = start(t, skillCooldowns, "skillCooldowns", { settings: { skillCooldownColor: { kind: "custom", value: "#abcdef" } } });
  const { skills } = run.substrates;
  const reading = () => ({ slots: skills.geometry.active, recharge: skills.cooldowns.active });
  const texts = () => run.drawn.cooldowns?.map((item) => item?.text ?? null);
  assert.deepEqual(reading(), { slots: true, recharge: true });
  skills.geometry.sink?.update(bar(2));
  skills.cooldowns.sink?.update(recharge(2));
  assert.deepEqual(texts(), ["2.9", "15", null, null, null, null, null, "0.4"]);
  assert.equal(run.drawn.cooldowns?.find((item) => item !== null)?.color, "#abcdef");

  run.change({ skillCooldownColor: { kind: "preset", preset: "gold" } });
  assert.equal(run.drawn.cooldowns?.find((item) => item !== null)?.color, "#e4b957");

  run.turn(false);
  assert.deepEqual(texts(), []);
  assert.deepEqual(reading(), { slots: false, recharge: false });

  run.turn(true);
  assert.deepEqual(reading(), { slots: true, recharge: true });
  run.stop();
  assert.deepEqual(reading(), { slots: false, recharge: false });
  assert.deepEqual(texts(), []);
});

test("a feature never starts on a build that did not prove a capability its manifest uses", (t) => {
  for (const options of [
    { without: ["nativeHudRendering"] },
    // Main's facts describe the build; a part runs only with what its installation carries.
    { notInstalled: ["skillCooldownObservation"] },
  ] satisfies Options[]) {
    const run = start(t, skillCooldowns, "skillCooldowns", options);
    run.turn(true);
    assert.deepEqual([run.substrates.skills.geometry.active, run.substrates.skills.cooldowns.active], [false, false], JSON.stringify(options));
    assert.equal(run.drawn.cooldowns, undefined, JSON.stringify(options));
  }
});

test("a running feature stops when main's facts say this build needs an update, and starts when proved", (t) => {
  const run = start(t, skillCooldowns, "skillCooldowns");
  const reading = () => [run.substrates.skills.geometry.active, run.substrates.skills.cooldowns.active];
  assert.deepEqual(reading(), [true, true]);
  run.check("skillCooldownObservation", { status: "unavailable", reason: "game-update" });
  assert.deepEqual(reading(), [false, false]);
  run.check("skillCooldownObservation", { status: "available" });
  assert.deepEqual(reading(), [true, true]);
});

test("the plain game stops every running feature, and turning it off starts them again", (t) => {
  const cooldowns = start(t, skillCooldowns, "skillCooldowns");
  const timers = start(t, effectTimers, "effectTimers");
  const travelProgress = start(t, progress, "progress");
  const running = () => [cooldowns.substrates.skills.cooldowns.active, timers.substrates.effects.playerEffects.active,
    travelProgress.substrates.progress.installation.active];
  assert.deepEqual(running(), [true, true, true]);
  for (const run of [cooldowns, timers, travelProgress]) run.plainGame(true);
  assert.deepEqual(running(), [false, false, false]);
  for (const run of [cooldowns, timers, travelProgress]) run.plainGame(false);
  assert.deepEqual(running(), [true, true, true]);
});

test("Skill Key Labels draws the player's key on its slot and 1 to 8 on the others, until it is off", (t) => {
  const keyX = { input: { kind: "keyboard", code: "KeyX" }, modifiers: { ...EMPTY_SKILL_KEY_MODIFIERS, command: true } } as const;
  const run = start(t, skillKeyLabels, "skillKeyLabels", { settings: { skillKeyBindings: [null, null, null, null, null, null, null, keyX] } });
  const { geometry } = run.substrates.skills;
  geometry.sink?.update(bar(2));
  assert.deepEqual(run.drawn.keys?.map((item) => item && [item.parent, item.child, item.binding?.input]),
    Array.from({ length: 8 }, (_, slot) => [43, slot, slot === 7 ? keyX.input : { kind: "keyboard", code: `Digit${slot + 1}` }]));
  assert.equal(run.drawn.keys?.[7]?.binding?.modifiers.command, true);

  run.change({ skillKeyBindings: [keyX, null, null, null, null, null, null, null] });
  assert.deepEqual(run.drawn.keys?.[0]?.binding?.input, keyX.input);
  assert.deepEqual(run.drawn.keys?.[7]?.binding?.input, { kind: "keyboard", code: "Digit8" });

  run.turn(false);
  assert.deepEqual(run.drawn.keys, []);
  assert.equal(geometry.active, false, "nothing reads the slot positions once it is off");
});

test("Effect Timers writes the time left on each icon in its urgency colour, until it is off", (t) => {
  const run = start(t, effectTimers, "effectTimers");
  const { playerEffects, effectIcons } = run.substrates.effects;
  assert.deepEqual([playerEffects.active, effectIcons.active], [true, true]);
  effectIcons.sink?.update(Object.freeze({
    status: "ready", sequence: 2, generation: 1, frameId: 55, viewportWidth: 800, viewportHeight: 600,
    anchor: Object.freeze({ left: 100, bottom: 100, right: 132, top: 132 }),
    icons: Object.freeze([Object.freeze({ skillId: 10, left: 100, bottom: 100, right: 132, top: 132 })]),
  } as const));
  playerEffects.sink?.update(effectsAt(1_000, [[10, 2_400, 0], [10, 900, 0]]));
  assert.deepEqual(run.drawn.effects, [{ parent: 55, child: 14, width: 32, height: 32, text: "1.4", color: "#c86c65" }]);

  run.turn(false);
  assert.deepEqual(run.drawn.effects, []);
  assert.deepEqual([playerEffects.active, effectIcons.active], [false, false]);
});

test("Reminders prints a line before a con runs out, and reads only the feeds an option asks for", (t) => {
  const run = start(t, reminders, "reminders");
  const { effects, alcohol } = run.substrates;
  assert.deepEqual([effects.playerEffects.active, alcohol.installation.active], [true, true]);
  effects.playerEffects.sink?.update(effectsAt(THIRTY - 2 * MINUTE, [[CELERITY, THIRTY, 0], [CUPCAKE, THIRTY, 0]]));
  effects.playerEffects.sink?.update(effectsAt(THIRTY - 50_000, [[CELERITY, THIRTY, 0], [CUPCAKE, THIRTY, 0]]));
  run.frames(3);
  assert.deepEqual(run.printed, ["[gwonmac] Essence of Celerity ends in 1 minute.", "[gwonmac] Birthday Cupcake ends in 1 minute."]);

  run.change({ reminderCons: false, reminderPcons: false });
  assert.deepEqual([effects.playerEffects.active, alcohol.installation.active], [false, true]);
  run.change({ reminderBeforeEnd: false, reminderAtEnd: false });
  assert.equal(alcohol.installation.active, false);
  assert.deepEqual(run.configured, [1, 0], "chat print stops when nothing can print");

  run.change({ reminderBeforeEnd: true });
  run.turn(false);
  assert.deepEqual([effects.playerEffects.active, alcohol.installation.active], [false, false]);
  assert.deepEqual(run.configured, [1, 0, 1, 0]);
});

test("Progress hands Travel's page the character's progress while it is on", (t) => {
  const run = start(t, progress, "progress");
  const { installation } = run.substrates.progress;
  assert.equal(installation.active, true);
  installation.sink?.update(Object.freeze({ status: "ready", sequence: 2, mapId: 248, characterKey: "000000010000000a",
    missions: null, vanquished: null, cartographer: null, areas: Object.freeze([]), quest: null } as const));
  assert.deepEqual(run.trips.map((state) => state.status === "ready" ? state.mapId : state.status), ["waiting", 248]);

  run.turn(false);
  assert.equal(installation.active, false);
});

test("Maps reads the active quest from game.progress while its quest route is on, with Progress off", (t) => {
  // Elite Skills (off here) listens on the window for a skill to find.
  const globals = globalThis as { window?: unknown; cancelAnimationFrame?: unknown };
  const previous = { window: globals.window, cancelAnimationFrame: globals.cancelAnimationFrame };
  Object.assign(globals, { window: new EventTarget(), cancelAnimationFrame: () => {} });
  t.after(() => Object.assign(globals, previous));
  const run = start(t, cartography, "cartography",
    { settings: { eliteSkillsEnabled: false, cartographyRouteEnabled: true, cartographyQuestRouteEnabled: true } });
  const { installation } = run.substrates.progress;
  assert.equal(installation.active, true);
  installation.sink?.update(Object.freeze({ status: "ready", sequence: 2, mapId: 13, characterKey: "000000010000000a",
    missions: null, vanquished: null, cartographer: null, areas: Object.freeze([]),
    quest: Object.freeze({ id: 31, mapId: 81, marker: Object.freeze({ x: -1_250.5, y: 3_400 }) }) } as const));
  assert.deepEqual(readCartographyQuestMarker(), { mapId: 13, x: -1_250.5, y: 3_400 });

  run.change({ cartographyQuestRouteEnabled: false });
  assert.equal(installation.active, false);
  assert.equal(readCartographyQuestMarker(), null);
  run.stop();
});
