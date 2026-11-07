// The settings and feature tables must not move while app/features becomes their
// source. tests/fixtures/feature-registry/baseline.json holds them as the hand-written
// code produced them (2026-11-07, written with WRITE_FEATURE_BASELINE=1 before any
// table was derived); every table today must still deep-equal that copy. The one
// intended change is DRIFT_FIX below: the renderer's Tools defaults now are DEFAULT_SETTINGS.
// Delete this test and its fixtures once no hand-written table is left to compare.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { launcherSettings, parseLauncherSettingsPatch, GLOBAL_TOOLS, GLOBAL_TOOL_FEATURES } from "../../app/shared/launcher-contracts.ts";
import { DEFAULT_SETTINGS, RENDERER_WRITABLE_SETTINGS, type AppSettings } from "../../app/shared/contracts.ts";
import { parseRendererSettingsPatch, parseSettings, parseSettingsPatch } from "../../app/main/core/settings.ts";
import { HUB_SETTINGS_FIELDS } from "../../app/shared/hub-settings.ts";
import { FEATURE_SELECTION_POLICIES } from "../../app/shared/feature-contracts.ts";
import { enhancementRuntimePolicy } from "../../app/renderer/enhancement-runtime-policy.ts";
import { ENHANCEMENT_PROGRAMS } from "../../app/shared/enhancement-contracts.ts";
import { HUB_COMMAND_SHORTCUTS, HUB_TOOL_KEYS, TOOL_PRESENTATION } from "../../app/shared/tool-presentation.ts";
import { SETTINGS } from "../../app/shared/settings-catalogue.ts";
import { allGlobalToolsPatch, globalToolPatch, launcherToolSettings } from "../../app/main/core/launcher-tools.ts";
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, SHORTCUT_FEATURES, SHORTCUT_LABELS, SHORTCUT_MENU_ITEMS, resolveShortcuts } from "../../app/shared/keyboard-shortcuts.ts";
import { TOOLS_SETTINGS, toolsSettings } from "../../app/shared/settings/index.ts";
import { DEFAULT_CALCULATOR_RATES } from "../../app/shared/hub-calculator.ts";
import { FEATURES, type HubFeatureSetting } from "../../app/features/index.ts";
import { PROBES, settingsFixtures } from "../fixtures/feature-registry/inputs.ts";
import type { AppSettingsBefore } from "../fixtures/feature-registry/app-settings-before.ts";

// Checked by `tsc -p tsconfig.tests.json`: the derived type is the hand-written one,
// key for key and modifier for modifier.
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const appSettingsTypeUnchanged: Exact<AppSettings, AppSettingsBefore> = true;
// shared/hub.ts HubSource.feature, as the hand-written union named it.
const hubSourceTypeUnchanged: Exact<HubFeatureSetting, "buildLibrary" | "characterSwitchEnabled" | "tradeChat" | "travelPalette" | "whispersEnabled"> = true;
void appSettingsTypeUnchanged, hubSourceTypeUnchanged;

const outcome = (run: () => unknown) => {
  try { return { ok: run() }; } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), code: (error as { code?: string }).code ?? null };
  }
};

function currentTables() {
  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
  const launcherKeys = keys.filter(key => !("error" in outcome(() => parseLauncherSettingsPatch({ [key]: DEFAULT_SETTINGS[key] }))));
  const featureSettings = Object.fromEntries([...new Set(Object.values(FEATURE_SELECTION_POLICIES).flatMap(policy =>
    "master" in policy.activation ? [policy.activation.setting, policy.activation.master] : [policy.activation.setting]))].map(key => [key, false]));
  const allOn = Object.fromEntries(Object.keys(featureSettings).map(key => [key, true]));
  return {
    settingKeys: [...keys].sort(),
    defaults: DEFAULT_SETTINGS,
    rendererWritable: [...RENDERER_WRITABLE_SETTINGS].sort(),
    rendererPatchKeys: keys.filter(key => !("error" in outcome(() => parseRendererSettingsPatch({ [key]: DEFAULT_SETTINGS[key] })))).sort(),
    parse: settingsFixtures.map(({ name, raw }) => ({ name, result: outcome(() => parseSettings(raw)) })),
    probes: Object.fromEntries(keys.map(key => [key, PROBES.map(value => outcome(() => parseSettings({ [key]: value })[key]))])),
    patch: {
      unknown: ["teamManagement", "mystery", "formatVersion"].map(key => outcome(() => parseSettingsPatch({ [key]: true }))),
      every: outcome(() => parseSettingsPatch(DEFAULT_SETTINGS)),
    },
    launcher: {
      keys: [...launcherKeys].sort(),
      probes: Object.fromEntries(launcherKeys.map(key => [key, PROBES.map(value => outcome(() => (parseLauncherSettingsPatch({ [key]: value }) as Record<string, unknown>)[key]))])),
      // launcher-orchestrator.ts snapshot(): the settings projection.
      projection: Object.keys(launcherSettings(DEFAULT_SETTINGS)).sort(),
    },
    hubSettingsFields: [...HUB_SETTINGS_FIELDS].sort(),
    featurePolicies: FEATURE_SELECTION_POLICIES,
    runtimePolicy: Object.fromEntries(ENHANCEMENT_PROGRAMS.map(program => [program, Object.fromEntries(
      (["pve", "pvp", "unknown"] as const).map(region => [region, {
        off: enhancementRuntimePolicy(program, featureSettings as never, region),
        on: enhancementRuntimePolicy(program, allOn as never, region),
      }]),
    )])),
    globalTools: GLOBAL_TOOLS,
    globalToolFeatures: GLOBAL_TOOL_FEATURES,
    toolPresentation: TOOL_PRESENTATION,
    settingsCatalogue: SETTINGS,
    launcherToolSettings: launcherToolSettings(DEFAULT_SETTINGS),
    globalToolPatch: Object.fromEntries(GLOBAL_TOOLS.map(tool => [tool, globalToolPatch(tool, true)])),
    allGlobalToolsPatch: { on: allGlobalToolsPatch(true), off: allGlobalToolsPatch(false) },
    shortcutActions: [...SHORTCUT_ACTIONS].sort(),
    defaultShortcuts: DEFAULT_SHORTCUTS,
    shortcutLabels: SHORTCUT_LABELS,
    resolvedDefaults: resolveShortcuts({}),
    // Were window-shortcuts.ts SHORTCUT_FEATURES and window-menu.ts TOOL_MENU_FEATURES.
    windowShortcutFeatures: SHORTCUT_FEATURES,
    toolMenuFeatures: SHORTCUT_MENU_ITEMS,
    // Was renderer/hub.ts commandExamples() KEY_TOOLS + toolKeys, in display order.
    hubKeyTools: HUB_TOOL_KEYS,
    // shared/hub.ts HubSource.feature union, as the runtime list of Hub source settings.
    hubSourceSettings: FEATURES.flatMap(feature => "tool" in feature && "hub" in feature.tool && "keyOrder" in feature.tool.hub
      ? [feature.activation.setting] : []).sort(),
    // renderer/harness.ts window.gwToolsSettings before any settings arrive.
    rendererToolsSettingsBeforeSettings: toolsSettings(null),
    // With settings, the same keys, each read from the settings.
    rendererToolsSettingKeys: [...TOOLS_SETTINGS].sort(),
  };
}

const baselineFile = new URL("../fixtures/feature-registry/baseline.json", import.meta.url);
// A JSON round trip: the frozen copy is JSON, and so is every value a table holds.
const current = JSON.parse(JSON.stringify(currentTables())) as Record<string, unknown>;

if (process.env.WRITE_FEATURE_BASELINE === "1") {
  // One line per table keeps the file small and still lets a diff name the table that moved.
  const lines = Object.entries(current).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`);
  writeFileSync(baselineFile, `{\n${lines.join(",\n")}\n}\n`);
}
const baseline = JSON.parse(readFileSync(baselineFile, "utf8")) as Record<string, unknown>;

// The renderer's defaults drifted from DEFAULT_SETTINGS in these keys; calculatorRates
// was absent until settings arrived. Every other value, and every other table, is unchanged.
const DRIFT_FIX = {
  travelPalette: true,
  chatFilterAllyDrops: true,
  chatFilterHallOfHeroes: true,
  chatFilterTitleAchievements: true,
  calculatorRates: JSON.parse(JSON.stringify(DEFAULT_CALCULATOR_RATES)),
};
const expected: Record<string, unknown> = {
  ...baseline,
  rendererToolsSettingsBeforeSettings: { ...(baseline.rendererToolsSettingsBeforeSettings as object), ...DRIFT_FIX },
};

test("the baseline names every table this test projects", () => {
  assert.deepEqual(Object.keys(current).sort(), Object.keys(baseline).sort());
});
for (const [table, frozen] of Object.entries(expected)) {
  test(`${table} equals its frozen copy`, () => assert.deepEqual(current[table], frozen));
}

test("the renderer's Tools settings default to DEFAULT_SETTINGS", () => {
  assert.deepEqual(toolsSettings(null), Object.fromEntries(TOOLS_SETTINGS.map(key => [key, DEFAULT_SETTINGS[key]])));
});

test("each Hub command row shows the shortcut renderer/hub.ts named by hand", () => {
  assert.deepEqual(HUB_COMMAND_SHORTCUTS, {
    travel: "travel.open", character: "character.switch", builds: "tools.toggle",
    trade: "trade.toggle", whispers: "whispers.toggle", storage: "storage.open",
  });
});
