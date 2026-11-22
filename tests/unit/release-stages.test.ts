// A Feature or option with a manifest `stage` stays out of builds that do not show it
// (docs/feature-contract.md#release-stages): every surface a Stable player has leaves it out,
// and its code reads it as off.
import assert from "node:assert/strict";
import test from "node:test";
import { FEATURES, FEATURE_SELECTION_POLICIES } from "../../app/shared/feature-contracts.ts";
import { resolve, type FeatureState } from "../../app/shared/feature-resolve.ts";
import { buildStage, type ReleaseStage } from "../../app/shared/release.ts";
import { searchSettings, settingsAt } from "../../app/shared/settings-catalogue.ts";
import { DEFAULT_SETTINGS, SETTING_TABLE, toolsSettings } from "../../app/shared/settings/index.ts";
import { provenChecks } from "../helpers/feature-facts.ts";

// Wrong behaviour: an RC build hides beta items from its testers, or a Stable build shows dev ones.
test("a build's stage comes from whether it is packaged and its version", () => {
  const cases: readonly [packaged: boolean, version: string, stage: ReleaseStage][] = [
    [false, "1.4.0", "dev"],
    [true, "1.4.0", "stable"],
    [true, "1.4.0-beta.1", "beta"],
    [true, "1.4.0-rc.1", "beta"],
    [true, "not-a-version", "stable"],
  ];
  for (const [packaged, version, stage] of cases) assert.equal(buildStage(packaged, version), stage, `${packaged} ${version}`);
});

// Wrong behaviour: a Stable player sees, finds or runs something still in development.
test("a Stable build shows no beta or dev item", () => {
  const switches = Object.values(FEATURE_SELECTION_POLICIES).flatMap((policy) => policy.switch ?? []);
  const state = (stage: ReleaseStage): FeatureState => ({
    stage, toolsAtLaunch: true, program: "none", playRegion: "pve", features: provenChecks(),
    settings: Object.fromEntries(switches.map((key) => [key, true])),
  });
  // No Feature is staged today, so the check plants one.
  const maps = FEATURES.find((feature) => feature.id === "cartography")!;
  for (const stage of ["beta", "dev"] as const) {
    const planted = Object.assign({}, maps, { stage });
    assert.deepEqual(resolve(planted, state("stable")), { on: false, reason: "not-in-release" }, stage);
    assert.deepEqual(resolve(planted, state("dev")), { on: true }, stage);
  }

  // Every staged option, stored on: the game reads it as off, and Settings neither lists nor finds it.
  const staged = [...SETTING_TABLE].flatMap(([key, spec]) => spec.stage === undefined ? [] : [{ key, label: spec.label ?? key }]);
  const stored = { ...DEFAULT_SETTINGS, ...Object.fromEntries(staged.map(({ key }) => [key, true])) };
  const found = new Set(settingsAt("stable").map((entry) => entry.id));
  const game = (stage: ReleaseStage): Readonly<Record<string, unknown>> => toolsSettings(stored, stage);
  for (const { key, label } of staged) {
    if (key in game("dev")) {
      assert.equal(game("stable")[key], false, key);
      assert.equal(game("dev")[key], true, key);
    }
    assert.equal(found.has(key), false, key);
    assert.deepEqual(searchSettings(label, "stable").filter((entry) => entry.id === key), [], key);
    assert.equal(searchSettings(label, "dev").some((entry) => entry.id === key), true, key);
  }
});
