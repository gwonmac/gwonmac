import assert from "node:assert/strict";
import test from "node:test";
import { effectiveCapabilities } from "../../app/renderer/effective-enhancement-capabilities.js";
import { enhancementRuntimePolicy } from "../../app/renderer/enhancement-runtime-policy.js";
import type { ClientCompatibility, OptionalFeatureStatus } from "../../app/shared/contracts.js";
import {
  capabilityRecord,
  type EnhancementCapability,
  type EnhancementProgram,
} from "../../app/shared/enhancement-contracts.js";
import { FEATURES, type FeatureActivationSettings, type FeatureId } from "../../app/shared/feature-contracts.js";
import { resolve, type FeatureResolution, type FeatureState } from "../../app/shared/feature-resolve.js";

type Features = ClientCompatibility["features"];
type Feature = (typeof FEATURES)[number];

const AVAILABLE = { status: "available" } as const;
const NOT_AVAILABLE: readonly OptionalFeatureStatus[] = [
  { status: "off" },
  { status: "unavailable", reason: "game-update" },
  { status: "unavailable", reason: "check-failed" },
  { status: "unavailable", reason: "preparation-failed" },
];

function features(changed: Partial<Record<EnhancementCapability, OptionalFeatureStatus>> = {}): Features {
  return {
    gameFileSaving: AVAILABLE,
    nativeDoubleClick: AVAILABLE,
    ...capabilityRecord((capability) => changed[capability] ?? AVAILABLE),
  };
}

/**
 * The capabilities each feature's code checks before it does anything, read from today's
 * code: its companion part, the skill HUD substrate (skill-overlays-installation.ts) and the
 * Core companion (Character Switch). Progress reports to Travel's installation, which exists
 * only with travelAction. Features left out run without any capability.
 */
const TODAY_CAPABILITY_GATES: Partial<Record<FeatureId, readonly EnhancementCapability[]>> = {
  whispers: ["whisperChat"],
  resign: ["resignAction"],
  characterSwitch: ["characterSwitchAction"],
  teamApply: ["teamApply"],
  travel: ["travelAction"],
  progress: ["progressObservation", "travelAction"],
  xunlaiStorage: ["xunlaiAction"],
  quickItemMove: ["quickItemMove"],
  targetReadout: ["targetObservation"],
  skillKeyLabels: ["nativeHudRendering", "skillSlotGeometry"],
  skillCooldowns: ["nativeHudRendering", "skillSlotGeometry", "skillCooldownObservation"],
  chatFilters: ["chatFiltering"],
  effectTimers: ["nativeHudRendering", "effectIconGeometry"],
  alcoholTimer: ["alcoholObservation"],
  reminders: ["chatPrint"],
};

/** Code that runs without the Tools launch: the Core companion and the input host. */
const TODAY_RUNS_WITHOUT_TOOLS: ReadonlySet<FeatureId> = new Set(["characterSwitch", "callTarget"]);

/**
 * Today's answer, from today's functions: the selection policy every companion part reads
 * (`policy()`), the launch that decides whether Tools code is loaded at all, and the
 * capability booleans the parts read from the served session.
 */
function today(feature: Feature, state: FeatureState): boolean {
  const capabilities = state.features === null
    ? null
    : effectiveCapabilities({ appVersion: "test", compatibility: { clientSha256: "test", features: state.features }, healthToken: null });
  return (state.toolsAtLaunch || TODAY_RUNS_WITHOUT_TOOLS.has(feature.id))
    && enhancementRuntimePolicy(state.program, state.settings as FeatureActivationSettings, state.playRegion)[feature.id]
    && (TODAY_CAPABILITY_GATES[feature.id] ?? []).every((capability) => capabilities?.[capability] === true);
}

/**
 * Differences between `resolve` and today that a PR listed for a decision instead of copying
 * today. Both features run from code a plain-game launch already has, and read only the
 * switches, so they start as soon as the plain game is turned off in a running session:
 * Call Target's key chord (app/renderer/input.ts) and Character Switch (the Core companion).
 */
function knownDifference(feature: Feature, state: FeatureState): boolean {
  return (feature.id === "callTarget" || feature.id === "characterSwitch") && !state.toolsAtLaunch;
}

const ACTIVATION_SETTINGS = [...new Set(FEATURES.flatMap((feature) =>
  feature.activation.kind === "setting" ? [feature.activation.setting, feature.activation.master] : [feature.activation.setting]))];

function relevantSettings(feature: Feature): (keyof FeatureActivationSettings)[] {
  const keys = new Set<keyof FeatureActivationSettings>();
  const add = (each: Feature) => {
    keys.add(each.activation.setting);
    if (each.activation.kind === "setting") keys.add(each.activation.master);
    for (const required of "requires" in each ? each.requires : []) add(FEATURES.find(({ id }) => id === required)!);
  };
  add(feature);
  return [...keys];
}

/** Every combination of the switches, programs, launches, areas and capability statuses that bear on one feature. */
function* statesFor(feature: Feature): Generator<FeatureState> {
  const keys = relevantSettings(feature);
  const capabilities = [...new Set([...(TODAY_CAPABILITY_GATES[feature.id] ?? []), ...("uses" in feature ? feature.uses : [])])];
  const capabilityStates: (Features | null)[] = [null, features(),
    ...capabilities.flatMap((capability) => NOT_AVAILABLE.map((status) => features({ [capability]: status })))];
  const programs: EnhancementProgram[] = ["none", ...("programs" in feature ? feature.programs : []), "cursor-observer"];
  for (let mask = 0; mask < 2 ** (keys.length + 1); mask += 1) {
    const rest = (mask & (1 << keys.length)) !== 0;
    const settings: Partial<FeatureActivationSettings> = Object.fromEntries(ACTIVATION_SETTINGS.map((key) => [key, rest]));
    keys.forEach((key, index) => { settings[key] = (mask & (1 << index)) !== 0; });
    for (const toolsAtLaunch of [false, true]) {
      for (const program of programs) {
        for (const playRegion of ["pve", "pvp", "unknown"] as const) {
          for (const served of capabilityStates) yield { toolsAtLaunch, settings, program, playRegion, features: served };
        }
      }
    }
  }
}

test("resolve turns every feature on exactly when today's activation does", () => {
  let compared = 0;
  const differences = new Set<FeatureId>();
  for (const feature of FEATURES) {
    for (const state of statesFor(feature)) {
      const actual = resolve(feature, state).on;
      const expected = today(feature, state);
      if (actual !== expected && knownDifference(feature, state)) { differences.add(feature.id); continue; }
      assert.equal(actual, expected, `${feature.id} ${JSON.stringify({ ...state, features: state.features && "set" })}`);
      compared += 1;
    }
  }
  assert.ok(compared > 10_000, `compared only ${compared} states`);
  // The listed difference is real; when a call site changes, drop it from the list.
  assert.deepEqual([...differences].sort(), ["callTarget", "characterSwitch"]);
});

const PLAYING: FeatureState = Object.freeze({
  toolsAtLaunch: true,
  settings: Object.fromEntries(ACTIVATION_SETTINGS.map((key) => [key, true])),
  program: "none",
  playRegion: "pve",
  features: features(),
});
const feature = (id: FeatureId) => FEATURES.find((each) => each.id === id)!;
const playing = (changed: Partial<FeatureState>, settings: Partial<FeatureActivationSettings> = {}): FeatureState =>
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
