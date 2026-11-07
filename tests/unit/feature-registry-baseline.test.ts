// The settings and feature tables must not move while app/features becomes their
// source. tests/fixtures/feature-registry/baseline.json holds them as the hand-written
// code produced them (2026-11-07, written with WRITE_FEATURE_BASELINE=1 before any
// table was derived); every table today must still deep-equal that copy.
// Delete this test and its fixtures once no hand-written table is left to compare.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { parseLauncherSettingsPatch, GLOBAL_TOOLS, GLOBAL_TOOL_FEATURES } from "../../app/shared/launcher-contracts.ts";
import { DEFAULT_SETTINGS, RENDERER_WRITABLE_SETTINGS, type AppSettings } from "../../app/shared/contracts.ts";
import { parseRendererSettingsPatch, parseSettings, parseSettingsPatch } from "../../app/main/core/settings.ts";
import { HUB_SETTINGS_FIELDS } from "../../app/shared/hub-settings.ts";
import { FEATURE_SELECTION_POLICIES } from "../../app/shared/feature-contracts.ts";
import { enhancementRuntimePolicy } from "../../app/renderer/enhancement-runtime-policy.ts";
import { ENHANCEMENT_PROGRAMS } from "../../app/shared/enhancement-contracts.ts";
import { TOOL_PRESENTATION } from "../../app/shared/tool-presentation.ts";
import { SETTINGS } from "../../app/shared/settings-catalogue.ts";
import { allGlobalToolsPatch, globalToolPatch, launcherToolSettings } from "../../app/main/core/launcher-tools.ts";
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, SHORTCUT_LABELS, resolveShortcuts } from "../../app/shared/keyboard-shortcuts.ts";
import { PROBES, settingsFixtures } from "../fixtures/feature-registry/inputs.ts";

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
      probes: Object.fromEntries(launcherKeys.map(key => [key, PROBES.map(value => outcome(() => parseLauncherSettingsPatch({ [key]: value })[key]))])),
      // launcher-orchestrator.ts snapshot(): the hand-written settings projection.
      projection: [
        "uiStyle", "uiFont", "uiCustomTheme", "uiPanelOpacity", "uiTextSize", "controllerPromptStyle",
        "autoRelogAfterReload", "characterSwitchProfession", "characterSwitchLevel", "characterSwitchLocation",
        "skillKeyBindings", "skillCooldownColor", "alcoholTimerPosition", "chatFilterAllyDrops",
        "chatFilterHallOfHeroes", "chatFilterTitleAchievements", "reminderCons", "reminderPcons", "reminderAlcohol",
        "reminderBeforeEnd", "reminderAtEnd", "reminderSound", "autoCheckUpdates", "renderScale",
        "extendedMemoryEnabled", "showDiagnostics", "cartographyOverlayEnabled", "cartographyGridEnabled",
        "cartographyCompassGridEnabled", "compassRangeIndicatorsEnabled", "compassRangeEarshotEnabled",
        "compassRangeCastEnabled", "compassRangeSpiritEnabled", "compassRangeSpiritExtendedEnabled",
        "compassRangeEarshotOpacity", "compassRangeCastOpacity", "compassRangeSpiritOpacity",
        "compassRangeSpiritExtendedOpacity", "compassRangeTheme", "cartographyRevealMode", "cartographyPresetLibrary",
        "cartographyWalkabilityOpacity", "cartographyGridOpacity", "cartographyControlIdleOpacity",
        "eliteSkillsEnabled", "eliteMissionMapMarkers",
      ].sort(),
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
    // window-shortcuts.ts SHORTCUT_FEATURES (not exported).
    windowShortcutFeatures: {
      "game.call-target": "callTarget", "game.resign": "resign", "character.switch": "characterSwitch",
      "tools.toggle": "buildLibrary", "whispers.toggle": "whispers", "trade.toggle": "tradeChat",
      "storage.open": "xunlaiStorage", "travel.open": "travel", "cartography.grid.toggle": "cartography",
      "cartography.walkability.toggle": "cartography",
    },
    // window-menu.ts TOOL_MENU_FEATURES (not exported).
    toolMenuFeatures: {
      "toggle-tools": { feature: "buildLibrary", action: "tools.toggle" },
      "open-whispers": { feature: "whispers", action: "whispers.toggle" },
      "toggle-trade": { feature: "tradeChat", action: "trade.toggle" },
      "open-xunlai-storage": { feature: "xunlaiStorage", action: "storage.open" },
      "open-travel": { feature: "travel", action: "travel.open" },
      "resign-game": { feature: "resign", action: "game.resign" },
      "switch-character": { feature: "characterSwitch", action: "character.switch" },
    },
    // renderer/hub.ts commandExamples() KEY_TOOLS + toolKeys, in display order.
    hubKeyTools: [
      { command: "travel", tool: "quick-travel", action: "travel.open", label: TOOL_PRESENTATION["quick-travel"].label },
      { command: "character", tool: "character-switch", action: "character.switch", label: TOOL_PRESENTATION["character-switch"].label },
      { command: "builds", tool: "build-management", action: "tools.toggle", label: TOOL_PRESENTATION["build-management"].label },
      { command: "trade", tool: "trade-chat", action: "trade.toggle", label: TOOL_PRESENTATION["trade-chat"].label },
      { command: "whispers", tool: "whispers", action: "whispers.toggle", label: TOOL_PRESENTATION["whispers"].label },
    ],
    // shared/hub.ts HubSource.feature union.
    hubSourceSettings: ["buildLibrary", "characterSwitchEnabled", "tradeChat", "travelPalette", "whispersEnabled"],
    // renderer/harness.ts window.gwToolsSettings before any settings arrive; calculatorRates is absent then.
    rendererToolsSettingsBeforeSettings: {
      hubShortcuts: [], shortcutOverrides: {}, gwonmacTools: false, buildLibrary: true, tradeChat: true,
      xunlaiStorage: false, travelPalette: false, targetReadout: false, characterSwitchEnabled: true,
      resignEnabled: false, whispersEnabled: false, callTargetEnabled: false, cartographyEnabled: true,
      cartographyOverlayEnabled: false, cartographyGridEnabled: false, compassRangeIndicatorsEnabled: false,
      eliteSkillsEnabled: true, eliteMissionMapMarkers: "saved",
      skillKeyBindings: [null, null, null, null, null, null, null, null], skillKeyLabelsEnabled: false,
      skillCooldownOverlayEnabled: true, chatFiltersEnabled: false, chatFilterAllyDrops: false,
      chatFilterHallOfHeroes: false, chatFilterTitleAchievements: false, quickItemMove: false,
      effectTimersEnabled: false, alcoholTimerEnabled: false, remindersEnabled: false, reminderCons: true,
      reminderPcons: true, reminderAlcohol: true, reminderBeforeEnd: true, reminderAtEnd: true, reminderSound: false,
      alcoholTimerPosition: { corner: "top-left", x: 4, y: 58, locked: true },
      skillCooldownColor: { kind: "preset", preset: "red" },
    },
    // With settings, the same keys plus calculatorRates, each read from the settings.
    rendererToolsSettingKeys: [
      "hubShortcuts", "calculatorRates", "shortcutOverrides", "gwonmacTools", "buildLibrary", "tradeChat",
      "xunlaiStorage", "travelPalette", "targetReadout", "characterSwitchEnabled", "resignEnabled",
      "whispersEnabled", "callTargetEnabled", "cartographyEnabled", "cartographyOverlayEnabled",
      "cartographyGridEnabled", "compassRangeIndicatorsEnabled", "eliteSkillsEnabled", "eliteMissionMapMarkers",
      "skillKeyBindings", "skillKeyLabelsEnabled", "skillCooldownOverlayEnabled", "chatFiltersEnabled",
      "chatFilterAllyDrops", "chatFilterHallOfHeroes", "chatFilterTitleAchievements", "quickItemMove",
      "effectTimersEnabled", "alcoholTimerEnabled", "remindersEnabled", "reminderCons", "reminderPcons",
      "reminderAlcohol", "reminderBeforeEnd", "reminderAtEnd", "reminderSound", "alcoholTimerPosition",
      "skillCooldownColor",
    ].sort(),
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

test("the baseline names every table this test projects", () => {
  assert.deepEqual(Object.keys(current).sort(), Object.keys(baseline).sort());
});
for (const [table, frozen] of Object.entries(baseline)) {
  test(`${table} equals its frozen copy`, () => assert.deepEqual(current[table], frozen));
}
