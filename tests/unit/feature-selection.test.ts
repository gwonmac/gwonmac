// What the switches, the developer program and the area select for the
// Features these cases name, as literal values. A newer Feature takes its rows
// from the rules over every Feature in tests/certification/feature-region-gating.test.ts,
// so a new Feature adds nothing here.
import assert from "node:assert/strict";
import test from "node:test";
import {
  enhancementRuntimePolicy,
  type OptionalToolSettings,
} from "../../app/renderer/enhancement-runtime-policy.js";
import { FEATURE_SELECTION_POLICIES, type FeatureId } from "../../app/shared/feature-contracts.js";

const off = Object.freeze(Object.fromEntries(Object.values(FEATURE_SELECTION_POLICIES)
  .flatMap((policy) => policy.switch === null ? [] : [[policy.switch, false]]))) as OptionalToolSettings;

/** The policy's values for the Features `expected` names. */
const named = (policy: Readonly<Record<FeatureId, boolean>>, expected: Readonly<Record<string, boolean>>) =>
  Object.fromEntries(Object.entries(policy).filter(([id]) => Object.hasOwn(expected, id)));

function assertSelects(policy: Readonly<Record<FeatureId, boolean>>, expected: Readonly<Record<string, boolean>>, message?: string) {
  assert.deepEqual(named(policy, expected), expected, message);
}

test("developer programs replace saved optional-tool selection in PvE", () => {
  assertSelects(enhancementRuntimePolicy("toolbox-foundation", off, "pve"), {
    characterSwitch: false,
    resign: false,
    whispers: false,
    callTarget: false,
    cartography: false,
    tools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: false,
    teamApply: false,
    xunlaiStorage: false,
    travel: false,
    skillKeyLabels: false,
    skillCooldowns: false,
    chatFilters: false,
    quickItemMove: false,
    effectTimers: false,
    alcoholTimer: false,
    progress: false,
    reminders: false,
  });
  assertSelects(enhancementRuntimePolicy("toolbox-commands", off, "pve"), {
    characterSwitch: false,
    resign: false,
    whispers: false,
    callTarget: false,
    cartography: false,
    tools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: false,
    teamApply: true,
    xunlaiStorage: true,
    travel: true,
    skillKeyLabels: false,
    skillCooldowns: false,
    chatFilters: false,
    quickItemMove: false,
    effectTimers: false,
    alcoholTimer: false,
    progress: true,
    reminders: false,
  });
  assertSelects(enhancementRuntimePolicy("xunlai-storage", off, "pve"), {
    characterSwitch: false,
    resign: false,
    whispers: false,
    callTarget: false,
    cartography: false,
    tools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: false,
    teamApply: false,
    xunlaiStorage: true,
    travel: true,
    skillKeyLabels: false,
    skillCooldowns: false,
    chatFilters: false,
    quickItemMove: false,
    effectTimers: false,
    alcoholTimer: false,
    progress: true,
    reminders: false,
  });
  assertSelects(enhancementRuntimePolicy("target-observer", off, "pve"), {
    characterSwitch: false,
    resign: false,
    whispers: false,
    callTarget: false,
    cartography: false,
    tools: false,
    buildLibrary: false,
    tradeChat: false,
    targetReadout: true,
    teamApply: false,
    xunlaiStorage: false,
    travel: false,
    skillKeyLabels: false,
    skillCooldowns: false,
    chatFilters: false,
    quickItemMove: false,
    effectTimers: false,
    alcoholTimer: false,
    progress: false,
    reminders: false,
  });
});

test("unknown regions keep local Tools while live PvE features fail closed", () => {
  const on = Object.freeze({
    ...off,
    gwonmacTools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: true,
    xunlaiStorage: true,
    travelPalette: true,
    chatFiltersEnabled: true,
  });
  assertSelects(enhancementRuntimePolicy("none", on, "unknown"), {
    characterSwitch: false,
    resign: false,
    whispers: false,
    callTarget: false,
    cartography: false,
    tools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: false,
    teamApply: false,
    xunlaiStorage: true,
    travel: false,
    skillKeyLabels: false,
    skillCooldowns: false,
    chatFilters: true,
    quickItemMove: false,
    effectTimers: false,
    alcoholTimer: false,
    progress: false,
    reminders: false,
  });
});

test("a confirmed PvP map disables every product and developer tool", () => {
  const on = Object.freeze({
    ...off,
    gwonmacTools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: true,
    xunlaiStorage: true,
    travelPalette: true,
    skillKeyLabelsEnabled: true,
    skillCooldownOverlayEnabled: true,
    chatFiltersEnabled: true,
  });
  for (const program of [
    "none",
    "target-observer",
    "toolbox-foundation",
    "toolbox-commands",
    "xunlai-storage",
  ] as const) {
    assertSelects(enhancementRuntimePolicy(program, on, "pvp"), {
      characterSwitch: false,
      resign: false,
      whispers: false,
      callTarget: false,
      cartography: false,
      tools: false,
      buildLibrary: false,
      tradeChat: false,
      targetReadout: false,
      teamApply: false,
      xunlaiStorage: false,
      travel: false,
      skillKeyLabels: false,
      skillCooldowns: false,
      chatFilters: false,
      quickItemMove: false,
      effectTimers: false,
      alcoholTimer: false,
      progress: false,
      reminders: false,
    }, program);
  }
});

test("product tool settings remain live once the capability is present", () => {
  assertSelects(enhancementRuntimePolicy("none", {
    ...off,
    gwonmacTools: true,
    buildLibrary: true,
    tradeChat: true,
    travelPalette: true,
    skillCooldownOverlayEnabled: true,
  }, "pve"), {
    characterSwitch: false,
    resign: false,
    whispers: false,
    callTarget: false,
    cartography: false,
    tools: true,
    buildLibrary: true,
    tradeChat: true,
    targetReadout: false,
    teamApply: true,
    xunlaiStorage: false,
    travel: true,
    skillKeyLabels: false,
    skillCooldowns: true,
    chatFilters: false,
    quickItemMove: false,
    effectTimers: false,
    alcoholTimer: false,
    progress: true,
    reminders: false,
  });
});

test("skill feature selection distinguishes labels from cooldowns", () => {
  const empty = enhancementRuntimePolicy("none", { ...off, gwonmacTools: true }, "pve");
  assert.equal(empty.skillKeyLabels, false);
  assert.equal(empty.skillCooldowns, false);
  const labels = enhancementRuntimePolicy("none", { ...off, gwonmacTools: true, skillKeyLabelsEnabled: true }, "pve");
  assert.equal(labels.skillKeyLabels, true);
  assert.equal(labels.skillCooldowns, false);
});

test("Quick Item Move follows its single Tools switch and withdraws in PvP", () => {
  const settings = { ...off, gwonmacTools: true, quickItemMove: true };
  assert.equal(enhancementRuntimePolicy("none", settings, "pve").quickItemMove, true);
  assert.equal(enhancementRuntimePolicy("none", settings, "unknown").quickItemMove, true);
  assert.equal(enhancementRuntimePolicy("none", settings, "pvp").quickItemMove, false);
  assert.equal(enhancementRuntimePolicy("none", { ...settings, gwonmacTools: false }, "pve").quickItemMove, false);
});

test("effect observation is PvE-only for both product and developer selection", () => {
  const product = { ...off, gwonmacTools: true, effectTimersEnabled: true };
  assert.equal(enhancementRuntimePolicy("none", product, "pve").effectTimers, true);
  assert.equal(enhancementRuntimePolicy("none", product, "unknown").effectTimers, false);
  assert.equal(enhancementRuntimePolicy("none", product, "pvp").effectTimers, false);
  assert.equal(enhancementRuntimePolicy("effect-observer", off, "pve").effectTimers, true);
  assert.equal(enhancementRuntimePolicy("effect-observer", off, "pvp").effectTimers, false);
});
