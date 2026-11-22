// The safety rules of Feature selection, as rules over every Feature in
// FEATURES: a confirmed PvP map turns Features off, an unknown area keeps live
// PvE Features off while local Tools stay, developer programs replace the saved
// selection, and a Feature runs only with the switches it needs. A new Feature
// adds nothing here: its manifest puts it under every rule. Per-Feature values
// live in tests/unit/feature-selection.test.ts.
import assert from "node:assert/strict";
import test from "node:test";
import {
  enhancementRuntimePolicy,
  type OptionalToolSettings,
  type RuntimePlayRegion,
} from "../../app/renderer/enhancement-runtime-policy.js";
import { ENHANCEMENT_PROGRAMS } from "../../app/shared/enhancement-contracts.js";
import { FEATURES, FEATURE_SELECTION_POLICIES, LAUNCH_MODE_SWITCH } from "../../app/shared/feature-contracts.js";

const SWITCHES = Object.values(FEATURE_SELECTION_POLICIES).flatMap((policy) => policy.switch ?? []);
const every = (value: boolean) =>
  Object.freeze(Object.fromEntries(SWITCHES.map((key) => [key, value]))) as OptionalToolSettings;
const off = every(false);
const on = every(true);
const REGIONS: readonly RuntimePlayRegion[] = ["pve", "pvp", "unknown"];

test("runtime policy projects every registered feature exactly once", () => {
  assert.deepEqual(
    Object.keys(enhancementRuntimePolicy("none", off, "unknown")).sort(),
    Object.keys(FEATURE_SELECTION_POLICIES).sort(),
  );
  assert.deepEqual(FEATURES.map((feature) => feature.id).sort(), Object.keys(FEATURE_SELECTION_POLICIES).sort());
});

// Only a Feature whose manifest says `region: "any"` may run on a PvP map, and
// only these do. A new one is a safety decision, so it changes this list.
test("only Character Switch and Call Target may run on a PvP map", () => {
  assert.deepEqual(
    FEATURES.filter((feature) => feature.region === "any").map((feature) => feature.id).sort(),
    ["callTarget", "characterSwitch"],
  );
});

test("a confirmed PvP map turns off every Feature not allowed there, for every program and switch", () => {
  for (const program of ENHANCEMENT_PROGRAMS) {
    for (const settings of [on, off]) {
      const policy = enhancementRuntimePolicy(program, settings, "pvp");
      for (const feature of FEATURES) {
        if (feature.region === "any") continue;
        assert.equal(policy[feature.id], false, `${feature.id} ran on a PvP map (${program})`);
      }
    }
  }
});

test("an unknown area keeps live PvE Features off while local Tools stay", () => {
  for (const program of ENHANCEMENT_PROGRAMS) {
    for (const settings of [on, off]) {
      const unknown = enhancementRuntimePolicy(program, settings, "unknown");
      const pve = enhancementRuntimePolicy(program, settings, "pve");
      for (const feature of FEATURES) {
        assert.equal(
          unknown[feature.id],
          feature.region === "pve" ? false : pve[feature.id],
          `${feature.id} (${feature.region}) in an unknown area (${program})`,
        );
      }
    }
  }
  // Local Tools really stay: with every switch on, each non-PvE Feature runs in an unknown area.
  const unknown = enhancementRuntimePolicy("none", on, "unknown");
  for (const feature of FEATURES) {
    if (feature.region !== "pve") assert.equal(unknown[feature.id], true, feature.id);
  }
});

test("developer programs replace saved selection in PvE", () => {
  for (const program of ENHANCEMENT_PROGRAMS) {
    if (program === "none") continue;
    const policy = enhancementRuntimePolicy(program, off, "pve");
    for (const feature of FEATURES) {
      const programs: readonly string[] = "programs" in feature ? feature.programs : [];
      assert.equal(policy[feature.id], programs.includes(program), `${program} selection of ${feature.id}`);
    }
  }
});

test("without a program, every Feature needs the launch-mode switch and its own switch", () => {
  const all = enhancementRuntimePolicy("none", on, "pve");
  for (const feature of FEATURES) assert.equal(all[feature.id], true, `${feature.id} with every switch on`);
  const plainGame = enhancementRuntimePolicy("none", { ...on, [LAUNCH_MODE_SWITCH]: false }, "pve");
  for (const feature of FEATURES) assert.equal(plainGame[feature.id], false, `${feature.id} in the plain game`);
  for (const feature of FEATURES) {
    const own = FEATURE_SELECTION_POLICIES[feature.id].switch;
    if (own === null) continue;
    for (const playRegion of REGIONS) {
      const policy = enhancementRuntimePolicy("none", { ...on, [own]: false }, playRegion);
      assert.equal(policy[feature.id], false, `${feature.id} ran with ${own} off in ${playRegion}`);
    }
  }
});

test("local Tools require their setting or developer program and PvP maps block them", () => {
  const regions = ["pve", "pvp", "unknown"] as const;
  const programs = [
    "none",
    "cursor-observer",
    "target-observer",
    "toolbox-foundation",
    "toolbox-commands",
    "xunlai-storage",
  ] as const;
  for (const program of programs) {
    for (const playRegion of regions) {
      for (const enabled of [false, true]) {
        for (const buildLibrary of [false, true]) {
          for (const targetReadout of [false, true]) {
            for (const xunlaiStorage of [false, true]) {
              const policy = enhancementRuntimePolicy(program, {
                ...off,
                gwonmacTools: enabled,
                buildLibrary,
                xunlaiStorage,
                targetReadout,
              }, playRegion);
              assert.equal(
                policy.tools,
                playRegion !== "pvp" && (
                  enabled
                    || program === "toolbox-foundation"
                    || program === "toolbox-commands"
                    || program === "xunlai-storage"
                ),
                `${program}/${playRegion} coupled local Tools to a live feature`,
              );
            }
          }
        }
      }
    }
  }
});

test("Resign requires both Tools switches and a known PvE region", () => {
  const settings = { ...off, gwonmacTools: true, resignEnabled: true };
  assert.equal(enhancementRuntimePolicy("toolbox-foundation", settings, "pve").resign, true);
  assert.equal(enhancementRuntimePolicy("toolbox-foundation", settings, "pvp").resign, false);
  assert.equal(enhancementRuntimePolicy("toolbox-foundation", settings, "unknown").resign, false);
  assert.equal(enhancementRuntimePolicy("toolbox-foundation", { ...settings, resignEnabled: false }, "pve").resign, false);
  assert.equal(enhancementRuntimePolicy("toolbox-foundation", { ...settings, gwonmacTools: false }, "pve").resign, false);
});
