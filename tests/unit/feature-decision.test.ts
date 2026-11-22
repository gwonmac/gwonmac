// Main's one Feature decision (app/main/feature-decision.ts) on a replayed patch day.
// What would go wrong without this test: the launcher, a menu or a shortcut offers a Feature that
// the verifier refused for the served build, the facts main sends leave out the verifier's
// statuses (every checked Feature reads "Checking this Guild Wars build…" forever), or one game
// window's failed installation leaks into another window.
import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserWindow } from "electron";
import { attachFeatureLaunch, featureFacts, featureOn } from "../../app/main/feature-decision.ts";
import { FEATURES, FEATURE_SELECTION_POLICIES } from "../../app/shared/feature-contracts.ts";
import { resolve, resolveFeature } from "../../app/shared/feature-resolve.ts";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.ts";
import { provenChecks } from "../helpers/feature-facts.ts";

/**
 * The recorded result of tests/client-artifact/patch-day-replay.test.ts for the November 3 client
 * (2026-11-03-f2a2b07c9c56) with only the facts its patch day had: every capability proved but
 * Quick Item Move, whose memory-code digest changed. The replay needs the maintainer's evidence
 * store, so this test uses its recorded row.
 */
const NOVEMBER_3 = provenChecks({ quickItemMove: { status: "unavailable", reason: "game-update" } });
const SETTINGS = { ...DEFAULT_SETTINGS, gwonmacTools: true, quickItemMove: true, whispersEnabled: true };

test("the facts main sends carry the verifier's statuses, so a patch day reads as a needed update", (t) => {
  const failedWindow = {} as BrowserWindow;
  attachFeatureLaunch({
    stage: "stable", toolsAtLaunch: true,
    program: "none",
    checks: (win) => win === failedWindow
      ? provenChecks({ whisperChat: { status: "unavailable", reason: "preparation-failed" } })
      : NOVEMBER_3,
    provenForTests: false,
  });
  t.after(() => attachFeatureLaunch(null));

  const facts = featureFacts(SETTINGS);
  assert.deepEqual(facts.features, NOVEMBER_3);
  assert.deepEqual(resolveFeature("quickItemMove", { ...facts, playRegion: "unknown" }), { on: false, reason: "needs-update" });
  assert.equal(featureOn("quickItemMove", SETTINGS), false, "menus and shortcuts withhold it");
  assert.equal(featureOn("whispers", SETTINGS), true, "only its area is missing in main");
  // The facts hold only the switches that select Features, not every setting.
  assert.deepEqual(Object.keys(facts.settings).sort(), Object.values(FEATURE_SELECTION_POLICIES).flatMap((policy) => policy.switch ?? []).sort());

  assert.equal(featureOn("whispers", SETTINGS, failedWindow), false, "a failed installation stays in its window");
  assert.deepEqual(resolveFeature("whispers", { ...featureFacts(SETTINGS, failedWindow), playRegion: "pve" }), { on: false, reason: "not-proven" });
});

test("before bootstrap attaches the launch, every Feature reads off", () => {
  attachFeatureLaunch(null);
  const facts = featureFacts(SETTINGS);
  for (const feature of FEATURES) assert.equal(resolve(feature, { ...facts, playRegion: "pve" }).on, false, feature.id);
});
