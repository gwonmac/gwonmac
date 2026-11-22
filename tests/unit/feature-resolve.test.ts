import assert from "node:assert/strict";
import test from "node:test";
import type { ClientCompatibility, OptionalFeatureStatus } from "../../app/shared/contracts.js";
import { capabilityRecord, type EnhancementCapability } from "../../app/shared/enhancement-contracts.js";
import { FEATURES, FEATURE_SELECTION_POLICIES, type FeatureSwitchSettings, type FeatureId } from "../../app/shared/feature-contracts.js";
import {
  onWhereAllowed,
  resolve,
  type FeatureFacts,
  type FeatureResolution,
  type FeatureState,
} from "../../app/shared/feature-resolve.js";

type Features = ClientCompatibility["features"];

const AVAILABLE = { status: "available" } as const;

function features(changed: Partial<Record<EnhancementCapability, OptionalFeatureStatus>> = {}): Features {
  return {
    gameFileSaving: AVAILABLE,
    nativeDoubleClick: AVAILABLE,
    ...capabilityRecord((capability) => changed[capability] ?? AVAILABLE),
  };
}

const SWITCHES = Object.values(FEATURE_SELECTION_POLICIES).flatMap((policy) => policy.switch ?? []);

const PLAYING: FeatureState = Object.freeze({
  toolsAtLaunch: true,
  settings: Object.fromEntries(SWITCHES.map((key) => [key, true])),
  program: "none",
  playRegion: "pve",
  features: features(),
});
const feature = (id: FeatureId) => FEATURES.find((each) => each.id === id)!;
const playing = (changed: Partial<FeatureState>, settings: Partial<FeatureSwitchSettings> = {}): FeatureState =>
  ({ ...PLAYING, ...changed, settings: { ...PLAYING.settings, ...settings } });

test("resolve names the first reason a feature is off", () => {
  const cases: readonly [string, FeatureId, FeatureState, FeatureResolution][] = [
    ["on while playing", "whispers", PLAYING, { on: true }],
    ["Tools off", "whispers", playing({}, { gwonmacTools: false }), { on: false, reason: "plain-game" }],
    ["Tools off before the own switch", "whispers", playing({}, { gwonmacTools: false, whispersEnabled: false }), { on: false, reason: "plain-game" }],
    ["Tools switched on after the start", "whispers", playing({ toolsAtLaunch: false }), { on: false, reason: "needs-restart" }],
    ["own switch off", "whispers", playing({}, { whispersEnabled: false }), { on: false, reason: "switched-off" }],
    ["Progress without Travel", "progress", playing({}, { travelPalette: false }), { on: false, reason: "needs", feature: "travel" }],
    ["Apply team without Build Library", "teamApply", playing({}, { buildLibrary: false }), { on: false, reason: "needs", feature: "buildLibrary" }],
    ["Progress when Travel needs an update", "progress", playing({ features: features({ travelAction: { status: "unavailable", reason: "game-update" } }) }), { on: false, reason: "needs-update" }],
    ["own capability changed by an update", "whispers", playing({ features: features({ whisperChat: { status: "unavailable", reason: "game-update" } }) }), { on: false, reason: "needs-update" }],
    ["build check failed", "whispers", playing({ features: features({ whisperChat: { status: "unavailable", reason: "check-failed" } }) }), { on: false, reason: "not-proven" }],
    ["preparation failed", "whispers", playing({ features: features({ whisperChat: { status: "unavailable", reason: "preparation-failed" } }) }), { on: false, reason: "not-proven" }],
    ["capability not asked for", "whispers", playing({ features: features({ whisperChat: { status: "off" } }) }), { on: false, reason: "not-proven" }],
    ["an update outranks a retry", "skillCooldowns", playing({ features: features({
      skillSlotGeometry: { status: "unavailable", reason: "check-failed" },
      skillCooldownObservation: { status: "unavailable", reason: "game-update" },
    }) }), { on: false, reason: "needs-update" }],
    ["verifier not reported yet", "whispers", playing({ features: null }), { on: false, reason: "checking" }],
    ["a feature without capabilities does not wait", "callTarget", playing({ features: null }), { on: true }],
    ["PvE feature in PvP", "whispers", playing({ playRegion: "pvp" }), { on: false, reason: "wrong-area" }],
    ["PvE feature before a map", "whispers", playing({ playRegion: "unknown" }), { on: false, reason: "wrong-area" }],
    ["update before area", "whispers", playing({ playRegion: "pvp", features: features({ whisperChat: { status: "unavailable", reason: "game-update" } }) }), { on: false, reason: "needs-update" }],
    ["non-PvP feature before a map", "quickItemMove", playing({ playRegion: "unknown" }), { on: true }],
    ["Character Switch in the plain game", "characterSwitch", playing({ toolsAtLaunch: false }, { gwonmacTools: false }), { on: false, reason: "plain-game" }],
    ["Character Switch off", "characterSwitch", playing({}, { characterSwitchEnabled: false }), { on: false, reason: "switched-off" }],
    ["a developer program selects with switches off", "travel", playing({ program: "toolbox-commands" }, { gwonmacTools: false, travelPalette: false }), { on: true }],
    ["a developer program needs the Tools launch", "travel", playing({ program: "toolbox-commands", toolsAtLaunch: false }), { on: false, reason: "needs-restart" }],
  ];
  for (const [name, id, state, expected] of cases) assert.deepEqual(resolve(feature(id), state), expected, name);
});

test("surfaces outside the game area show a feature that waits only for its area", () => {
  const facts = (state: FeatureState): FeatureFacts => ({ toolsAtLaunch: state.toolsAtLaunch, settings: state.settings, program: state.program, features: state.features });
  const cases: readonly [string, FeatureId, FeatureState, boolean][] = [
    ["a PvE feature before a map", "whispers", playing({ playRegion: "unknown" }), true],
    ["a feature this build changed", "quickItemMove", playing({ features: features({ quickItemMove: { status: "unavailable", reason: "game-update" } }) }), false],
    ["the plain game", "travel", playing({}, { gwonmacTools: false }), false],
    ["waiting for a restart", "travel", playing({ toolsAtLaunch: false }), false],
    ["the verifier has not reported", "whispers", playing({ features: null }), false],
  ];
  for (const [name, id, state, expected] of cases) assert.equal(onWhereAllowed(id, facts(state)), expected, name);
});
