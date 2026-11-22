import { describe, expect, it } from "vitest";
import { BUILD_CHECK_FAILED } from "@shared/contracts";
import type { FeatureId } from "@shared/feature-contracts";
import type { GlobalTool, LauncherSnapshot } from "@shared/launcher-contracts";
import {
  badgeOf,
  cardFeature,
  featureOptions,
  featureStatus,
  launcherFeatureState,
  parseChangelog,
} from "./features";
import { showsReason } from "@shared/feature-status";
import { fixtureFacts, fixtureFeatureChecksFor, fixtureSnapshot } from "./fixtures";

type Tools = LauncherSnapshot["tools"];
const loaded: Tools = { ...fixtureSnapshot.tools, configured: true, loaded: true, restartRequired: false };
const withSwitches = (tools: Tools, switches: Partial<Record<GlobalTool, boolean>>): Tools => ({
  ...tools,
  features: { ...tools.features, ...Object.fromEntries(Object.entries(switches).map(([tool, enabled]) => [tool, { enabled }])) },
});
const card = (id: FeatureId) => cardFeature(id)!;
type Checks = Parameters<typeof fixtureFacts>[1];
const statusOf = (id: FeatureId, tools: Tools, checks: Checks) => featureStatus(card(id), launcherFeatureState(fixtureFacts(tools, checks)), tools);
const proved = fixtureFeatureChecksFor("?checks=proved");
const patchDay = fixtureFeatureChecksFor("?checks=patch-day");

describe("Features tab status", () => {
  // Each row is one thing a player can see on a card; the words come from the canvas States board.
  it.each([
    { state: "plain game", id: "travel", tools: { ...loaded, configured: false }, checks: proved, text: "Off while you play the plain game.", tone: "muted", locked: true, shown: true },
    { state: "waiting for a restart", id: "travel", tools: { ...loaded, loaded: false, restartRequired: true }, checks: proved, text: "Starts the next time you open Guild Wars.", tone: "warning", locked: false, shown: true },
    { state: "switched off while waiting for a restart", id: "whispers", tools: { ...loaded, loaded: false, restartRequired: true }, checks: proved, text: "Off", tone: "muted", locked: false, shown: false },
    { state: "needs another feature", id: "progress", tools: withSwitches(loaded, { "quick-travel": false }), checks: proved, text: "Needs Travel. Turn it on first.", tone: "warning", locked: false, shown: true },
    { state: "switched off", id: "whispers", tools: loaded, checks: proved, text: "Off", tone: "muted", locked: false, shown: false },
    { state: "needs a GWonMac update", id: "quickItemMove", tools: withSwitches(loaded, { "quick-item-move": true }), checks: patchDay, text: "Needs a GWonMac update for this Guild Wars build.", tone: "muted", locked: false, shown: true },
    { state: "build check failed", id: "chatFilters", tools: withSwitches(loaded, { "chat-filters": true }), checks: patchDay, text: BUILD_CHECK_FAILED, tone: "warning", locked: false, shown: true },
    // The launcher has no build checks until plan step 7.1, so the switch must keep working.
    { state: "checking the build", id: "skillCooldowns", tools: loaded, checks: null, text: "Checking this Guild Wars build…", tone: "warning", locked: false, shown: true },
    // The launcher stands in no game area; a PvE feature is on and starts in PvE.
    { state: "on, waiting for its area", id: "cartography", tools: loaded, checks: proved, text: "", tone: "muted", locked: false, shown: false },
    { state: "on", id: "skillCooldowns", tools: loaded, checks: proved, text: "", tone: "muted", locked: false, shown: false },
  ] as const)("$state", ({ id, tools, checks, text, tone, locked, shown }) => {
    const status = statusOf(id, tools, checks);
    expect({ text: status.text, tone: status.tone, locked: status.locked, shown: showsReason(status) }).toEqual({ text, tone, locked, shown });
  });

});

describe("Features tab CHANGELOG", () => {
  it.each([
    { name: "only unreleased notes", text: "# Changelog\n\n## Unreleased\n\n- New thing.\n", versions: [] },
    { name: "a released version", text: "## Unreleased\n\n## 1.2.0\n\n- Shows the route.\n- Saves faster.\n", versions: [{ version: "1.2.0", count: 2 }] },
    { name: "an empty released section", text: "## 1.3.0\n\n## 1.2.0\n\n- Shows the route.\n", versions: [{ version: "1.2.0", count: 1 }] },
  ])("reads $name", ({ text, versions }) => {
    expect(parseChangelog(text).map(({ version, items }) => ({ version, count: items.length }))).toEqual(versions);
  });

  it.each([
    { name: "new in this version", text: "## 1.2.0\n\n- Added.\n", badge: "New" },
    { name: "changed in this version", text: "## 1.2.0\n\n- Changed.\n\n## 1.1.0\n\n- Added.\n", badge: "Updated" },
    { name: "changed earlier", text: "## 1.1.0\n\n- Added.\n", badge: null },
  ])("badges a feature $name", ({ text, badge }) => {
    expect(badgeOf(parseChangelog(text), "1.2.0")).toBe(badge);
  });
});

describe("Features tab options", () => {
  it("leaves the on and off switch to the page header", () => {
    const maps = card("cartography");
    const keys = featureOptions(maps, "stable").map((option) => option.key);
    expect(keys).not.toContain("cartographyEnabled");
    expect(keys).toContain("cartographyGridEnabled");
  });
});
