import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RendererSettingsPatch } from "../../app/shared/contracts.js";
import { DEFAULT_SETTINGS, TOOLS_SETTINGS, toolsSettings } from "../../app/shared/settings/index.js";
import { LAST_UPDATE_CHECK_AT_MAX } from "../../app/shared/settings/core.js";
import { DEFAULT_CUSTOM_UI_THEME } from "../../app/shared/ui-theme.js";
import { AppError } from "../../app/shared/errors.js";
import type { FeatureDefinition } from "../../app/features/define.js";
import { FEATURES } from "../../app/features/index.js";
import {
  CARTOGRAPHY_BUILTIN_PRESETS,
  type CartographyPresetRef,
} from "../../app/shared/cartography-overlay.js";
import {
  loadSettings,
  parseSettings,
  parseSettingsPatch,
  parseRendererSettingsPatch,
  saveSettings,
  type SettingsRecovery,
} from "../../app/main/core/settings.js";

const definitions: readonly FeatureDefinition[] = FEATURES;
/**
 * The settings of every Feature that owns none of `named`: a Feature added after a literal list
 * below was written. Each list stays literal for what it names (a released Feature's or Core's
 * setting missing from it still fails); a newer Feature's settings join it from its manifest.
 */
const newerFeatureSettings = (named: Iterable<string>): string[] => {
  const known = new Set(named);
  return definitions.flatMap((feature) => {
    const keys = Object.keys(feature.settings ?? {});
    return keys.some((key) => known.has(key)) ? [] : keys;
  });
};

describe("settings", () => {
  it("makes preset selection and library replacement exclusive for renderer callers", () => {
    const accepts = (patch: RendererSettingsPatch): RendererSettingsPatch => patch;
    const selection: CartographyPresetRef = { kind: "builtin", id: "monochrome" };
    assert.deepEqual(accepts({ cartographyPresetSelection: selection }), {
      cartographyPresetSelection: selection,
    });
    const invalid: RendererSettingsPatch = {
      cartographyPresetSelection: selection,
      // @ts-expect-error A semantic selection cannot carry a stale library snapshot.
      cartographyPresetLibrary: DEFAULT_SETTINGS.cartographyPresetLibrary,
    };
    assert.ok(invalid);
  });

  it("exposes the documented defaults", () => {
    const documented = {
      renderScale: 2,
      uiStyle: "guild-wars",
      uiCustomTheme: DEFAULT_CUSTOM_UI_THEME,
      uiFont: "guild-wars",
      controllerPromptStyle: "game-default",
      uiPanelOpacity: 94,
      uiTextSize: 100,
      cartographyEnabled: true,
      characterSwitchEnabled: true,
      resignEnabled: false,
      whispersEnabled: false,
      callTargetEnabled: false,
      cartographyOverlayEnabled: false,
      cartographyGridEnabled: false,
      cartographyRouteEnabled: true,
      cartographyQuestRouteEnabled: true,
      cartographyCompassGridEnabled: false,
      compassRangeIndicatorsEnabled: false,
      compassRangeEarshotEnabled: true,
      compassRangeCastEnabled: true,
      compassRangeSpiritEnabled: true,
      compassRangeSpiritExtendedEnabled: true,
      compassRangeEarshotOpacity: 95,
      compassRangeCastOpacity: 95,
      compassRangeSpiritOpacity: 95,
      compassRangeSpiritExtendedOpacity: 95,
      compassRangeTheme: "color",
      cartographyRevealMode: "off",
      cartographyPresetLibrary: DEFAULT_SETTINGS.cartographyPresetLibrary,
      cartographyWalkabilityOpacity: 55,
      cartographyGridOpacity: 65,
      cartographyControlIdleOpacity: 35,
      eliteSkillsEnabled: true,
      eliteMissionMapMarkers: "saved",
      hubShortcuts: [],
      calculatorRates: { mode: 'automatic', ecto: '', armbrace: '', zkey: '' },
      gwonmacTools: false,
      buildLibrary: true,
      tradeChat: true,
      tradeChatWindowPosition: null,
      xunlaiStorage: false,
      travelPalette: true,
      characterSwitchProfession: true,
      characterSwitchLevel: true,
      characterSwitchLocation: true,
      travelShortcuts: DEFAULT_SETTINGS.travelShortcuts,
      targetReadout: false,
      shortcutOverrides: {},
      skillKeyBindings: [null, null, null, null, null, null, null, null],
      skillKeyLabelsEnabled: false,
      chatFiltersEnabled: false,
      chatFilterAllyDrops: true,
      chatFilterHallOfHeroes: true,
      chatFilterTitleAchievements: true,
      skillCooldownOverlayEnabled: true,
      quickItemMove: false,
      effectTimersEnabled: false,
      alcoholTimerEnabled: false,
      remindersEnabled: false,
      reminderCons: true,
      reminderPcons: true,
      reminderAlcohol: true,
      reminderBeforeEnd: true,
      reminderAtEnd: true,
      reminderSound: false,
      alcoholTimerPosition: { corner: "top-left", x: 4, y: 58, locked: true },
      targetReadoutPosition: null,
      compassButtonsShown: true,
      compassButtonsOffset: { x: 0, y: 0 },
      skillCooldownColor: { kind: "preset", preset: "red" },
      autoRelogAfterReload: false,
      memoryWarningPosition: null,
      showDiagnostics: false,
      disableSteamLogin: false,
      pasteCleanup: true,
      hubCalculators: true,
      whispersIcon: true,
      whispersIconPosition: null,
      // Automatic app-update checks remain a separate preference from the
      // required ArenaNet game-data download.
      autoCheckUpdates: true,
      lastUpdateCheckAt: null,
      // No client build has been warned about yet, so every build warns once.
      compatibilityNoticeSeenFor: null,
    };
    const newer = newerFeatureSettings(Object.keys(documented));
    assert.deepEqual(DEFAULT_SETTINGS, {
      ...documented,
      ...Object.fromEntries(Object.entries(DEFAULT_SETTINGS).filter(([key]) => newer.includes(key))),
    });
  });

  it("defaults the Compass grid off for existing settings and validates its opt-in", () => {
    assert.equal(parseSettings({ cartographyGridEnabled: true }).cartographyCompassGridEnabled, false);
    assert.deepEqual(parseSettingsPatch({ cartographyCompassGridEnabled: true }), { cartographyCompassGridEnabled: true });
    assert.throws(() => parseSettingsPatch({ cartographyCompassGridEnabled: "true" }), AppError);
  });

  it("defaults Elite Skills on for existing settings and validates its Mission Map markers", () => {
    assert.equal(parseSettings({ cartographyEnabled: true }).eliteSkillsEnabled, true);
    assert.throws(() => parseSettingsPatch({ eliteMissionMapMarkers: "target" }), AppError);
    assert.deepEqual(parseRendererSettingsPatch({ eliteSkillsEnabled: false, eliteMissionMapMarkers: "all" }), {
      eliteSkillsEnabled: false,
      eliteMissionMapMarkers: "all",
    });
    assert.throws(() => parseSettingsPatch({ eliteSkillsEnabled: "false" }), AppError);
    assert.throws(() => parseSettingsPatch({ eliteMissionMapMarkers: "boss" }), AppError);
  });

  it("preserves each selected Compass range and bounds its opacity", () => {
    assert.deepEqual(parseRendererSettingsPatch({
      compassRangeIndicatorsEnabled: true,
      compassRangeCastEnabled: false,
      compassRangeCastOpacity: 62,
    }), {
      compassRangeIndicatorsEnabled: true,
      compassRangeCastEnabled: false,
      compassRangeCastOpacity: 62,
    });
    assert.throws(() => parseSettingsPatch({ compassRangeSpiritEnabled: "true" }), AppError);
    assert.throws(() => parseSettingsPatch({ compassRangeSpiritOpacity: 101 }), AppError);
    assert.throws(() => parseSettingsPatch({ compassRangeCastOpacity: 94.5 }), AppError);
  });

  it("drops retired cursor fields from an alpha profile", () => {
    // A profile written before the cursor became a boolean carries
    // `cursorTheme` and a selectable input mode. They are unknown fields now,
    // so they are ignored rather than rejected: nothing else the player chose
    // may be lost with them. The exact deepEqual proves no retired key survives.
    //
    // Such a profile also predates the default flip. It gets the new default
    // rather than the old one: an alpha install that never expressed a
    // preference is not an install that said no.
    assert.deepEqual(parseSettings({
      cursorTheme: "guild-wars-2",
      renderScale: 1,
      touchMode: "off",
      showDiagnostics: true,
    }), { ...DEFAULT_SETTINGS, renderScale: 1, showDiagnostics: true });
  });

  it("fills missing fields and ignores unknown keys on read", () => {
    const got = parseSettings({
      patchMode: "fullImage",
      renderScale: 2,
      mystery: true,
    });
    assert.equal("patchMode" in got, false);
    assert.equal(got.renderScale, 2);
    assert.equal("mystery" in got, false);
  });

  it("hard-cuts the unreleased combined Character Switch detail setting", () => {
    const got = parseSettings({ characterSwitchDetails: false });
    assert.equal("characterSwitchDetails" in got, false);
    assert.equal(got.characterSwitchProfession, true);
    assert.equal(got.characterSwitchLevel, true);
    assert.equal(got.characterSwitchLocation, true);
  });

  it("preserves every explicit supported render scale", () => {
    for (const renderScale of [1, 1.5, 2]) {
      assert.equal(parseSettings({ renderScale }).renderScale, renderScale);
    }
  });

  it("accepts only supported interface styles", () => {
    for (const uiStyle of ["guild-wars", "obsidian", "custom"]) {
      assert.equal(parseSettings({ uiStyle }).uiStyle, uiStyle);
    }
    assert.throws(() => parseSettings({ uiStyle: "jade" }), AppError);
    assert.throws(() => parseSettings({ uiStyle: true }), AppError);
  });

  it("normalises and validates the permanent custom theme contract", () => {
    const custom = {
      ...DEFAULT_CUSTOM_UI_THEME,
      window: "#abcdef",
      recessed: "#123456",
      selected: "#789abc",
      accent: "#fedcba",
      windowGradient: false,
    };
    assert.deepEqual(parseSettings({ uiCustomTheme: custom }).uiCustomTheme, {
      ...DEFAULT_CUSTOM_UI_THEME,
      window: "#ABCDEF",
      recessed: "#123456",
      selected: "#789ABC",
      accent: "#FEDCBA",
      windowGradient: false,
    });
    assert.throws(() => parseSettings({ uiCustomTheme: { ...custom, accent: "#fff" } }), AppError);
    assert.throws(() => parseSettings({ uiCustomTheme: { ...custom, extra: true } }), AppError);
    assert.throws(() => parseSettings({ uiCustomTheme: { ...custom, windowGradient: "yes" } }), AppError);
  });

  it("validates the cartography preset library and independent opacities", () => {
    const library = {
      activePreset: { kind: "custom", id: "night-run" },
      customPresets: [{
        id: "night-run",
        name: " Night Run ",
        style: CARTOGRAPHY_BUILTIN_PRESETS.synthwave.style,
      }],
    } as const;
    assert.deepEqual(parseSettingsPatch({
      cartographyOverlayEnabled: true,
      cartographyGridEnabled: true,
      cartographyRevealMode: "birds-eye",
      cartographyPresetLibrary: library,
      cartographyWalkabilityOpacity: 72,
      cartographyGridOpacity: 61,
      cartographyControlIdleOpacity: 44,
      compassRangeTheme: "monochrome",
    }), {
      cartographyOverlayEnabled: true,
      cartographyGridEnabled: true,
      cartographyRevealMode: "birds-eye",
      cartographyPresetLibrary: {
        activePreset: { kind: "custom", id: "night-run" },
        customPresets: [{
          id: "night-run",
          name: "Night Run",
          style: CARTOGRAPHY_BUILTIN_PRESETS.synthwave.style,
        }],
      },
      cartographyWalkabilityOpacity: 72,
      cartographyGridOpacity: 61,
      cartographyControlIdleOpacity: 44,
      compassRangeTheme: "monochrome",
    });
    assert.throws(() => parseSettingsPatch({ cartographyGridEnabled: "yes" }), AppError);
    assert.throws(() => parseSettingsPatch({ cartographyRevealMode: "wide" }), AppError);
    assert.throws(() => parseSettingsPatch({ cartographyWalkabilityOpacity: 101 }), AppError);
    assert.throws(() => parseSettingsPatch({ cartographyGridOpacity: -1 }), AppError);
    assert.throws(() => parseSettingsPatch({ cartographyControlIdleOpacity: 14 }), AppError);
    assert.throws(() => parseSettingsPatch({ compassRangeTheme: "sepia" }), AppError);
    assert.throws(() => parseSettingsPatch({
      cartographyPresetLibrary: {
        ...library,
        activePreset: { kind: "custom", id: "missing" },
      },
    }), AppError);
    assert.throws(() => parseSettingsPatch({ cartographyOverlayStyle: "contrast" }), AppError);
    assert.deepEqual(parseSettings({
      cartographyOverlayStyle: "contrast",
      cartographyOverlayOpacity: 99,
      cartographyOverlayCustomStyle: {},
    }).cartographyPresetLibrary, DEFAULT_SETTINGS.cartographyPresetLibrary);
  });

  it("accepts only the supported interface fonts", () => {
    for (const uiFont of ["guild-wars", "inter", "system", "avenir", "georgia", "palatino"]) {
      assert.equal(parseSettings({ uiFont }).uiFont, uiFont);
    }
    assert.throws(() => parseSettings({ uiFont: "papyrus" }), AppError);
    assert.throws(() => parseSettings({ uiFont: false }), AppError);
  });

  it("accepts only the two supported controller prompt styles", () => {
    for (const controllerPromptStyle of ["game-default", "playstation"]) {
      assert.equal(parseSettings({ controllerPromptStyle }).controllerPromptStyle, controllerPromptStyle);
    }
    assert.throws(() => parseSettings({ controllerPromptStyle: "nintendo" }), AppError);
    assert.throws(() => parseSettings({ controllerPromptStyle: true }), AppError);
  });

  it("rejects unknown types", () => {
    assert.throws(() => parseSettings({ renderScale: 3 }), AppError);
    // The bounds are the setting's meaning: below 65% a panel stops being
    // readable over moving art.
    assert.throws(() => parseSettings({ uiPanelOpacity: 64 }), AppError);
    assert.throws(() => parseSettings({ uiPanelOpacity: 94.5 }), AppError);
    for (const uiTextSize of [99, 201, 100.5, "200"]) assert.throws(() => parseSettings({ uiTextSize }), AppError);
    assert.equal(parseSettings({ uiTextSize: 200 }).uiTextSize, 200);
    assert.equal("uiTheme" in parseSettings({ uiTheme: "jade" }), false);
    assert.equal("uiDensity" in parseSettings({ uiDensity: "compact" }), false);
    assert.equal("uiBorderWidth" in parseSettings({ uiBorderWidth: 4 }), false);
    assert.equal("uiRadius" in parseSettings({ uiRadius: 16 }), false);
    assert.equal("nativeCursor" in parseSettings({ nativeCursor: "yes" }), false);
    // Older apps wrote the retired game-data strategy; it is read and dropped.
    assert.equal("dataStrategy" in parseSettings({ dataStrategy: "quick" }), false);
    assert.throws(() => parseSettings([]), AppError);
  });

  it("takes the update fields only in the shapes the renderer can produce", () => {
    assert.equal(parseSettings({ autoCheckUpdates: true }).autoCheckUpdates, true);
    assert.throws(() => parseSettings({ autoCheckUpdates: "yes" }), AppError);
    // Older apps wrote a Stable/Beta track. The app is Stable only and drops it.
    assert.equal("updateTrack" in parseSettings({ updateTrack: "beta" }), false);

    for (const lastUpdateCheckAt of [null, 0, 1_800_000_000_000, LAST_UPDATE_CHECK_AT_MAX]) {
      assert.equal(parseSettings({ lastUpdateCheckAt }).lastUpdateCheckAt, lastUpdateCheckAt);
    }
    // Epoch milliseconds, not a date, not a duration, not a negative.
    assert.throws(() => parseSettings({ lastUpdateCheckAt: -1 }), AppError);
    assert.throws(() => parseSettings({ lastUpdateCheckAt: 1.5 }), AppError);
    assert.throws(() => parseSettings({ lastUpdateCheckAt: Number.NaN }), AppError);
    assert.throws(
      () => parseSettings({ lastUpdateCheckAt: LAST_UPDATE_CHECK_AT_MAX + 1 }),
      AppError,
    );
    assert.throws(() => parseSettings({ lastUpdateCheckAt: 1e300 }), AppError);
    assert.throws(() => parseSettings({ lastUpdateCheckAt: "2026-07-26" }), AppError);
  });

  it("accepts only bounded shortcut overrides", () => {
    assert.deepEqual(parseSettings({
      shortcutOverrides: {
        "tools.toggle": { key: "k", shift: true, option: false },
        "storage.open": null,
      },
    }).shortcutOverrides, {
      "tools.toggle": { key: "k", shift: true, option: false },
      "storage.open": null,
    });
    assert.throws(() => parseSettings({
      shortcutOverrides: {
        "tools.toggle": { key: "F1", shift: false, option: false },
      },
    }), AppError);
    assert.throws(() => parseSettingsPatch({
      shortcutOverrides: { "unknown.action": null },
    }), AppError);
  });

  it("accepts exactly eight display-only skill bindings", () => {
    const binding = {
      input: { kind: "keyboard" as const, code: "KeyC" },
      modifiers: { control: true, option: true, shift: true, command: true },
    };
    const skillKeyBindings = [null, null, null, null, null, null, null, binding];
    assert.deepEqual(parseSettings({ skillKeyBindings }).skillKeyBindings, skillKeyBindings);
    assert.deepEqual(parseSettingsPatch({ skillKeyBindings }), { skillKeyBindings });
    assert.throws(() => parseSettings({ skillKeyBindings: skillKeyBindings.slice(1) }), AppError);
    assert.throws(() => parseSettings({
      skillKeyBindings: [{ ...binding, input: { kind: "keyboard", code: "Unknown" } },
        ...skillKeyBindings.slice(1)],
    }), AppError);
    assert.equal(parseSettings({
      skillKeyBindings,
      skillKeyLabelsEnabled: false,
      chatFiltersEnabled: false,
      chatFilterAllyDrops: false,
      chatFilterHallOfHeroes: false,
      chatFilterTitleAchievements: false,
    }).skillKeyLabelsEnabled, false);
  });

  it("takes the acknowledged client build only as a client hash", () => {
    const hash = "b0319704f3072d6948a66026a35af5eb0af12b48d70986783c293e7c77e98483";
    for (const seen of [hash, null]) {
      assert.equal(parseSettings({ compatibilityNoticeSeenFor: seen }).compatibilityNoticeSeenFor, seen);
    }
    // It names a build, so a boolean, a truncated hash or upper case — the
    // shapes a "notice shown" flag would arrive as — are all refused.
    assert.throws(() => parseSettings({ compatibilityNoticeSeenFor: true }), AppError);
    assert.throws(() => parseSettings({ compatibilityNoticeSeenFor: "b031" }), AppError);
    assert.throws(
      () => parseSettings({ compatibilityNoticeSeenFor: hash.toUpperCase() }),
      AppError,
    );
  });

  it("accepts one canonical cooldown switch and color", () => {
    assert.equal(parseSettings({ skillCooldownOverlayEnabled: false }).skillCooldownOverlayEnabled, false);
    assert.deepEqual(parseSettingsPatch({
      skillCooldownColor: { kind: "custom", value: "#12aBcF" },
    }), { skillCooldownColor: { kind: "custom", value: "#12aBcF" } });
    for (const value of [
      { kind: "custom", value: "#fff" },
      { kind: "custom", value: "#12345g" },
      { kind: "preset", preset: "green" },
      { kind: "preset", preset: "red", extra: true },
    ]) assert.throws(() => parseSettings({ skillCooldownColor: value }), AppError);
  });

  it("validates patches without filling fields from defaults", () => {
    assert.throws(() => parseSettingsPatch({ nativeCursor: true }), AppError);
    for (const patch of [
      { lastUpdateCheckAt: 1_000 },
      { targetReadout: true },
      { autoRelogAfterReload: true },
      { uiStyle: "obsidian" },
      { uiCustomTheme: DEFAULT_CUSTOM_UI_THEME },
      { uiFont: "inter" },
      { controllerPromptStyle: "playstation" },
      { quickItemMove: true },
    ]) assert.deepEqual(parseSettingsPatch(patch), patch, JSON.stringify(patch));
    assert.throws(() => parseSettingsPatch({ updateTrack: "beta" }), AppError);
    assert.throws(() => parseSettingsPatch({ mystery: true }), AppError);
    assert.throws(() => parseSettingsPatch({ touchMode: "dbltap" }), AppError);
    // A renderer that still names a retired key is a bug, not a migration.
    assert.throws(() => parseSettingsPatch({ cursorTheme: "system" }), AppError);
  });

  it("keeps launcher policy off the game renderer settings channel", () => {
    assert.deepEqual(parseRendererSettingsPatch({ autoRelogAfterReload: true }), {
      autoRelogAfterReload: true,
    });
    assert.deepEqual(parseRendererSettingsPatch({ cartographyRevealMode: "birds-eye" }), {
      cartographyRevealMode: "birds-eye",
    });
    assert.throws(() => parseRendererSettingsPatch({ cartographyRevealMode: "wide" }), /RevealMode is invalid/u);
    assert.deepEqual(parseRendererSettingsPatch({
      cartographyPresetSelection: { kind: "builtin", id: "synthwave" },
    }), {
      cartographyPresetSelection: { kind: "builtin", id: "synthwave" },
    });
    assert.throws(
      () => parseRendererSettingsPatch({
        travelShortcuts: DEFAULT_SETTINGS.travelShortcuts,
      }),
      /cannot update "travelShortcuts"/u,
    );
    assert.throws(
      () => parseRendererSettingsPatch({ renderScale: 1.5 }),
      /cannot update "renderScale"/u,
    );
    assert.throws(
      () => parseRendererSettingsPatch({ gwonmacTools: true }),
      /cannot update "gwonmacTools"/u,
    );
    assert.throws(
      () => parseRendererSettingsPatch({
        cartographyPresetSelection: { kind: "builtin", id: "unknown" },
      }),
      /PresetSelection is invalid/u,
    );
    assert.throws(
      () => parseRendererSettingsPatch({
        cartographyPresetSelection: { kind: "builtin", id: "synthwave" },
        cartographyPresetLibrary: DEFAULT_SETTINGS.cartographyPresetLibrary,
      }),
      /cannot update "cartographyPresetLibrary"/u,
    );
  });

  it("loads defaults for missing or corrupt files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    const path = join(dir, "settings.json");
    const missing = await loadSettings(path);
    assert.deepEqual(missing, DEFAULT_SETTINGS);
    await writeFile(path, "{not json");
    let backup = "";
    const corrupt = await loadSettings(path, ({ backupPath }) => {
      backup = backupPath ?? "not preserved";
    });
    assert.deepEqual(corrupt, DEFAULT_SETTINGS);
    assert.match(backup, /settings\.json\.corrupt-\d+-[0-9a-f-]{36}$/u);
    assert.equal(await readFile(backup, "utf8"), "{not json");
    assert.deepEqual(await readdir(dir), [backup.split("/").at(-1)]);
  });

  it("saves only known fields, including text size across reload (HUB-116)", async context => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    context.after(() => rm(dir, { recursive: true, force: true }));
    const path = join(dir, "settings.json");
    const saved = await saveSettings(path, {
      ...DEFAULT_SETTINGS,
      showDiagnostics: true,
      autoRelogAfterReload: true,
      renderScale: 1.5,
      uiTextSize: 150,
      hubShortcuts: [],
      calculatorRates: { mode: 'automatic', ecto: '', armbrace: '', zkey: '' },
      gwonmacTools: false,
      xunlaiStorage: false,
      travelPalette: false,
      travelShortcuts: DEFAULT_SETTINGS.travelShortcuts,
      targetReadout: false,
    });
    assert.equal((await loadSettings(path)).uiTextSize, 150);
    assert.equal((await loadSettings(path)).renderScale, 1.5);
    assert.equal(saved.showDiagnostics, true);
    assert.equal(saved.autoRelogAfterReload, true);
    assert.equal((await loadSettings(path)).autoRelogAfterReload, true);
    const disk = JSON.parse(await readFile(path, "utf8"));
    const known = [
      "alcoholTimerEnabled",
      "alcoholTimerPosition",
      "autoCheckUpdates",
      "autoRelogAfterReload",
      "buildLibrary",
      "calculatorRates",
      "callTargetEnabled",
      "cartographyCompassGridEnabled",
      "cartographyControlIdleOpacity",
      "cartographyEnabled",
      "cartographyGridEnabled",
      "cartographyGridOpacity",
      "cartographyOverlayEnabled",
      "cartographyPresetLibrary",
      "cartographyQuestRouteEnabled",
      "cartographyRevealMode",
      "cartographyRouteEnabled",
      "cartographyWalkabilityOpacity",
      "characterSwitchEnabled",
      "characterSwitchLevel",
      "characterSwitchLocation",
      "characterSwitchProfession",
      "chatFilterAllyDrops",
      "chatFilterHallOfHeroes",
      "chatFilterTitleAchievements",
      "chatFiltersEnabled",
      "compassButtonsOffset",
      "compassButtonsShown",
      "compassRangeCastEnabled",
      "compassRangeCastOpacity",
      "compassRangeEarshotEnabled",
      "compassRangeEarshotOpacity",
      "compassRangeIndicatorsEnabled",
      "compassRangeSpiritEnabled",
      "compassRangeSpiritExtendedEnabled",
      "compassRangeSpiritExtendedOpacity",
      "compassRangeSpiritOpacity",
      "compassRangeTheme",
      "compatibilityNoticeSeenFor",
      "controllerPromptStyle",
      "disableSteamLogin",
      "effectTimersEnabled",
      "eliteMissionMapMarkers",
      "eliteSkillsEnabled",
      "formatVersion",
      "gwonmacTools",
      "hubCalculators",
      "hubShortcuts",
      "lastUpdateCheckAt",
      "memoryWarningPosition",
      "pasteCleanup",
      "quickItemMove",
      "reminderAlcohol",
      "reminderAtEnd",
      "reminderBeforeEnd",
      "reminderCons",
      "reminderPcons",
      "reminderSound",
      "remindersEnabled",
      "renderScale",
      "resignEnabled",
      "shortcutOverrides",
      "showDiagnostics",
      "skillCooldownColor",
      "skillCooldownOverlayEnabled",
      "skillKeyBindings",
      "skillKeyLabelsEnabled",
      "targetReadout",
      "targetReadoutPosition",
      "tradeChat",
      "tradeChatWindowPosition",
      "travelPalette",
      "travelShortcuts",
      "uiCustomTheme",
      "uiFont",
      "uiPanelOpacity",
      "uiStyle",
      "uiTextSize",
      "whispersEnabled",
      "whispersIcon",
      "whispersIconPosition",
      "xunlaiStorage",
    ];
    assert.deepEqual(Object.keys(disk).sort(), [...known, ...newerFeatureSettings(known)].sort());
    assert.equal(disk.formatVersion, 1);
  });

  it("preserves the legacy Apply Team opt-out without restoring a second setting", () => {
    assert.equal(parseSettings({
      gwonmacTools: true,
      teamManagement: false,
    }).buildLibrary, false);
    assert.equal(parseSettings({
      gwonmacTools: true,
      teamManagement: true,
    }).buildLibrary, true);
    assert.equal(parseSettings({
      buildLibrary: true,
      teamManagement: false,
    }).buildLibrary, true, "the canonical key must win");
    assert.equal(parseSettings({
      buildLibrary: false,
      teamManagement: "malformed legacy shadow",
    }).buildLibrary, false, "the canonical key must bypass the legacy shadow");
    assert.throws(
      () => parseSettings({ teamManagement: "false" }),
      /settings\.teamManagement must be a boolean/u,
    );
  });

  it("loads an alpha-written bare-JSON file with every value intact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    const path = join(dir, "settings.json");
    // Byte-for-byte what v0.0.1-alpha.1 wrote: no formatVersion, and retired
    // cursor/input keys that build had and this one does not.
    const alpha = {
      renderScale: 1.5,
      hubShortcuts: [],
      calculatorRates: { mode: 'automatic', ecto: '', armbrace: '', zkey: '' },
      gwonmacTools: false,
      teamManagement: true,
      xunlaiStorage: false,
      targetReadout: false,
      nativeCursor: true,
      touchMode: "translate",
      showDiagnostics: true,
      cursorTheme: "guild-wars-2",
    };
    await writeFile(path, JSON.stringify(alpha));

    let recovered = "";
    const loaded = await loadSettings(path, ({ backupPath }) => {
      recovered = backupPath ?? "not preserved";
    });
    assert.equal(recovered, "", "an alpha profile must not be treated as corrupt");
    // Fields alpha never wrote arrive at their defaults, deliberately including
    // the update check, which defaults on. The exact deepEqual also proves the
    // retired cursor/input keys and the legacy teamManagement shadow are gone.
    assert.deepEqual(loaded, { ...DEFAULT_SETTINGS, renderScale: 1.5, showDiagnostics: true });
    // Nothing was moved aside, so the file the player had is still the file.
    assert.deepEqual(await readdir(dir), ["settings.json"]);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), alpha);

    // The next save is the only thing that rewrites it. Unrelated values stay;
    // retired input and cursor fields disappear without a migration marker.
    await saveSettings(path, loaded);
    const rewritten = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(rewritten, {
      formatVersion: 1,
      ...loaded,
    });
    assert.deepEqual(await loadSettings(path), loaded);
  });

  it("reads and keeps released district shortcuts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    const path = join(dir, "settings.json");
    await writeFile(path, JSON.stringify({
      renderScale: 1.5,
      travelShortcuts: [
        { mapId: 55, district: "europe-english", districtNumber: 2 },
        null,
        { mapId: 449, district: "international", districtNumber: 0 },
      ],
    }));

    const loaded = await loadSettings(path);
    assert.equal(loaded.renderScale, 1.5);
    assert.deepEqual(loaded.travelShortcuts, [
      { mapId: 55, district: "europe-english", districtNumber: 2 },
      null,
      { mapId: 449, district: "international", districtNumber: 0 },
    ]);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")).travelShortcuts, [
      { mapId: 55, district: "europe-english", districtNumber: 2 },
      null,
      { mapId: 449, district: "international", districtNumber: 0 },
    ]);
    assert.deepEqual(parseSettingsPatch({ travelShortcuts: loaded.travelShortcuts }), {
      travelShortcuts: loaded.travelShortcuts,
    });
  });

  it("keeps the three newest corrupt backups and drops the rest", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    const path = join(dir, "settings.json");
    for (const epoch of [1000, 2000, 3000, 4000]) {
      await writeFile(`${path}.corrupt-${epoch}`, `stale ${epoch}`);
    }
    // Neighbours in the same profile directory that this must not touch.
    await writeFile(join(dir, "window-state.json"), "{}");
    await writeFile(`${path}.corrupt-not-an-epoch`, "hand-written");
    await writeFile(path, "{not json");

    let backup = "";
    await loadSettings(path, ({ backupPath }) => {
      backup = backupPath ?? "not preserved";
    });
    const kept = (await readdir(dir)).sort();
    assert.deepEqual(kept, [
      "settings.json.corrupt-3000",
      "settings.json.corrupt-4000",
      "settings.json.corrupt-not-an-epoch",
      backup.split("/").at(-1),
      "window-state.json",
    ].sort());
    // The newest three are the new one and the two most recent older ones.
    assert.equal(await readFile(`${path}.corrupt-4000`, "utf8"), "stale 4000");
    assert.equal(await readFile(backup, "utf8"), "{not json");
  });

  it("resets only a value this build no longer accepts and keeps every other value", async (context) => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    context.after(() => rm(dir, { recursive: true, force: true }));
    const path = join(dir, "settings.json");
    const released = JSON.parse(await readFile(
      new URL("../fixtures/player-data/v2026.11.0/custom/settings.json", import.meta.url),
      "utf8",
    ));
    // A value from a wider, older enum: "jade" was a theme before uiStyle narrowed.
    const written = JSON.stringify({ ...released, uiStyle: "jade" });
    await writeFile(path, written);

    const recoveries: SettingsRecovery[] = [];
    const loaded = await loadSettings(path, (recovery) => { recoveries.push(recovery); });

    assert.deepEqual(loaded, { ...parseSettings(released), uiStyle: DEFAULT_SETTINGS.uiStyle });
    const [recovery] = recoveries;
    assert.ok(recoveries.length === 1 && recovery?.kind === "fields" && recovery.backupPath !== null);
    assert.deepEqual(recovery.fields, ["uiStyle"], "names only, never values");
    assert.equal(await readFile(recovery.backupPath, "utf8"), written, "the original bytes are preserved");
    // The repaired file is written, so the reset is reported once.
    assert.deepEqual(await loadSettings(path, () => assert.fail("reported twice")), loaded);
    assert.equal((await readdir(dir)).length, 2);
  });

  it("still starts with the repaired values when the repair cannot be written", {
    skip: process.getuid?.() === 0 ? "root ignores the read-only folder this test relies on" : false,
  }, async (context) => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    const path = join(dir, "settings.json");
    const written = JSON.stringify({ formatVersion: 1, renderScale: 1.5, uiStyle: "jade" });
    await writeFile(path, written);
    // A folder that refuses new files: the backup and the repair both fail.
    await chmod(dir, 0o500);
    context.after(async () => {
      await chmod(dir, 0o700);
      await rm(dir, { recursive: true, force: true });
    });

    const recoveries: SettingsRecovery[] = [];
    const loaded = await loadSettings(path, (recovery) => { recoveries.push(recovery); });

    assert.equal(loaded.renderScale, 1.5);
    assert.equal(loaded.uiStyle, DEFAULT_SETTINGS.uiStyle);
    assert.deepEqual(recoveries, [{ kind: "fields", backupPath: null, fields: ["uiStyle"] }]);
    assert.equal(await readFile(path, "utf8"), written, "the unrepaired file waits for the next load");
  });

  it("moves aside a settings format this build cannot read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gw-settings-"));
    const path = join(dir, "settings.json");
    const future = { formatVersion: 2, renderScale: 1, touchMode: "off" };
    await writeFile(path, JSON.stringify(future));
    assert.throws(() => parseSettings(future), AppError);

    let backup = "";
    assert.deepEqual(
      await loadSettings(path, ({ backupPath }) => {
        backup = backupPath ?? "not preserved";
      }),
      DEFAULT_SETTINGS,
    );
    // Refused, not reinterpreted, and not destroyed: the bytes are still there.
    assert.deepEqual(JSON.parse(await readFile(backup, "utf8")), future);
  });
});


describe("memory warning position", () => {
  it("stores only bounded viewport ratios", () => {
    assert.equal(parseSettings({}).memoryWarningPosition, null);
    assert.deepEqual(parseSettingsPatch({ memoryWarningPosition: { x: 0.25, y: 1 } }), {
      memoryWarningPosition: { x: 0.25, y: 1 },
    });
    for (const value of [{ x: -1, y: 0 }, { x: 0, y: 2 }, { x: NaN, y: 0 },
      { x: 0, y: Infinity }, { x: 0 }, { x: 0, y: 0, extra: true }, "0,0"]) {
      assert.throws(() => parseSettingsPatch({ memoryWarningPosition: value }), AppError);
    }
  });
});

it('saves calculator estimates through real settings without changing unrelated player preferences', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'gwonmac-calculator-rates-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'settings.json');
  const initial = { ...DEFAULT_SETTINGS, renderScale: 1 as const, hubShortcuts: [{ id: 'travel', phrase: 'go places', pinned: true }] };
  await saveSettings(path, initial);
  const patch = parseRendererSettingsPatch({ calculatorRates: { mode: 'manual', ecto: '5k', armbrace: '30', zkey: '.5' } });
  await saveSettings(path, { ...(await loadSettings(path)), ...patch });
  const reloaded = await loadSettings(path);
  assert.deepEqual(reloaded.calculatorRates, { mode: 'manual', ecto: '5000', armbrace: '30', zkey: '0.5' });
  assert.deepEqual(reloaded.hubShortcuts, [{ id: 'travel', phrase: 'go places', pinned: true }]);
  assert.equal(reloaded.renderScale, 1);
  for (const rates of [
    { mode: 'manual', ecto: '-1', armbrace: '', zkey: '' },
    { mode: 'remote', ecto: '', armbrace: '', zkey: '' },
    { mode: 'manual', ecto: '', armbrace: '', zkey: '', extra: true },
  ]) assert.throws(() => parseRendererSettingsPatch({ calculatorRates: rates }), /calculatorRates/);
});

// The renderer once kept its own Tools defaults, and Travel and three chat filters drifted to off.
it("gives the renderer the same Tools defaults as DEFAULT_SETTINGS", () => {
  assert.deepEqual(toolsSettings(null, "dev"), Object.fromEntries(TOOLS_SETTINGS.map(key => [key, DEFAULT_SETTINGS[key]])));
});
