// A feature built with featurePart (app/renderer/tools-companion-part.ts) runs while its
// feature is on, and only on a build that proved every capability its manifest names.
// Skill Cooldowns runs here on the real blocks and feeds; only the native HUD is a stub.
// What would go wrong without this test: the countdowns stay on the skill bar after the
// player turned them off, the recharge feed keeps running for nobody, a color change
// does not reach the bar, or a build without the native renderer still reads the feeds.
import assert from "node:assert/strict";
import test from "node:test";
import skillCooldowns from "../../app/features/skill-cooldowns/companion.ts";
import { createGameBlocks, createUiBlocks } from "../../app/renderer/game-blocks.ts";
import type { NativeHudItem, NativeHudLayer } from "../../app/renderer/native-hud-layer.ts";
import { createPlayRegionObservationInstallation } from "../../app/renderer/play-region-state-installation.ts";
import type { PreparedToolsPart, ToolsActivation, ToolsPrepareInput } from "../../app/renderer/tools-companion-part.ts";
import { createToolsSubstrates } from "../../app/renderer/tools-companion-substrates.ts";
import { capabilityRecord, type EnhancementCapability } from "../../app/shared/enhancement-contracts.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "../../app/shared/settings/index.ts";

const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));

function start(t: test.TestContext, without: readonly EnhancementCapability[] = []) {
  const capabilities = capabilityRecord((capability) => !without.includes(capability));
  const { observation, skills } = createToolsSubstrates(EMPTY_MODULE, capabilities, "none");
  const playRegions = createPlayRegionObservationInstallation(capabilities.playRegionObservation);
  t.after(() => { skills.geometry.dispose(); skills.cooldowns.dispose(); playRegions.dispose(); });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  const document = { defaultView: null, getElementById: () => canvas } as unknown as Document;
  let drawn: readonly (NativeHudItem | null)[] = [];
  const hud: NativeHudLayer = { update(channel, items) { if (channel === "cooldowns") drawn = items; }, dispose() {} };
  const syncObservers = () => {};
  let settings: AppSettings = { ...DEFAULT_SETTINGS, skillCooldownColor: { kind: "custom", value: "#abcdef" } };
  let on = true;
  const context = {
    snapshot: () => ({ settings }),
    policy: () => ({ skillCooldowns: on }),
    game: createGameBlocks({ capabilities, observation, playRegions, skills, syncObservers }),
    ui: createUiBlocks({ capabilities, hud, skills, document, syncObservers }),
  } as unknown as ToolsActivation;
  const prepared = skillCooldowns.prepare({ capabilities } as ToolsPrepareInput) as PreparedToolsPart;
  const session = prepared.activate!(context);
  session.mount?.();
  return {
    session,
    skills,
    texts: () => drawn.map((item) => item?.text ?? null),
    color: () => drawn.find((item) => item !== null)?.color,
    reading: () => ({ slots: skills.geometry.active, recharge: skills.cooldowns.active }),
    turn(next: boolean) { on = next; session.syncFeeds?.(); },
    change(patch: Partial<AppSettings>) { settings = { ...settings, ...patch }; session.syncFeeds?.(); },
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

test("Skill Cooldowns shows the recharge on the skill bar while it is on, and stops reading once off", (t) => {
  const run = start(t);
  assert.deepEqual(run.reading(), { slots: true, recharge: true });
  run.skills.geometry.sink?.update(bar(2));
  run.skills.cooldowns.sink?.update(recharge(2));
  assert.deepEqual(run.texts(), ["2.9", "15", null, null, null, null, null, "0.4"]);
  assert.equal(run.color(), "#abcdef");

  run.change({ skillCooldownColor: { kind: "preset", preset: "gold" } });
  assert.equal(run.color(), "#e4b957");

  run.turn(false);
  assert.deepEqual(run.texts(), []);
  assert.deepEqual(run.reading(), { slots: false, recharge: false });

  run.turn(true);
  assert.deepEqual(run.reading(), { slots: true, recharge: true });
  for (const stop of run.session.disposePresentation ?? []) stop();
  assert.deepEqual(run.reading(), { slots: false, recharge: false });
  assert.deepEqual(run.texts(), []);
});

test("a feature never starts on a build that did not prove a capability its manifest names", (t) => {
  const run = start(t, ["nativeHudRendering"]);
  run.turn(true);
  assert.deepEqual(run.reading(), { slots: false, recharge: false });
  assert.deepEqual(run.texts(), []);
});
