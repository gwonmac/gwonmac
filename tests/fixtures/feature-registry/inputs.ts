// Inputs for baseline.json: values tried against every setting, and settings.json
// documents as the app wrote them before app/features (2026-11-07).
export const PROBES: readonly unknown[] = [
  true, "invalid", "all", "monochrome", "normal", 1.5, -1, 1, 14, 64, 101, {}, null,
];

const TRAVEL_SHORTCUTS = [{ mapId: 55, district: "international", districtNumber: 0 }, null, { mapId: 81, district: "international", districtNumber: 2 }];

export const settingsFixtures: readonly { name: string; raw: unknown }[] = [
  { name: "empty object", raw: {} },
  { name: "public alpha without formatVersion", raw: { renderScale: 1.5, gwonmacTools: true, travelPalette: false } },
  { name: "unknown fields are ignored", raw: { formatVersion: 1, nativeCursor: true, updateTrack: "beta", uiStyle: "obsidian" } },
  { name: "released teamManagement alias", raw: { formatVersion: 1, teamManagement: false } },
  { name: "buildLibrary wins over teamManagement", raw: { formatVersion: 1, teamManagement: false, buildLibrary: true } },
  { name: "unreadable format version", raw: { formatVersion: 2 } },
  { name: "not an object", raw: [] },
  {
    name: "every field away from its default",
    raw: {
      formatVersion: 1,
      renderScale: 1, uiStyle: "custom", uiFont: "inter", controllerPromptStyle: "playstation",
      uiPanelOpacity: 80, uiTextSize: 150,
      cartographyEnabled: false, cartographyOverlayEnabled: true, cartographyGridEnabled: true,
      cartographyCompassGridEnabled: true, compassRangeIndicatorsEnabled: true, compassRangeEarshotEnabled: false,
      compassRangeCastEnabled: false, compassRangeSpiritEnabled: false, compassRangeSpiritExtendedEnabled: false,
      compassRangeEarshotOpacity: 40, compassRangeCastOpacity: 41, compassRangeSpiritOpacity: 42,
      compassRangeSpiritExtendedOpacity: 43, compassRangeTheme: "monochrome", cartographyRevealMode: "birds-eye",
      cartographyWalkabilityOpacity: 30, cartographyGridOpacity: 31, cartographyControlIdleOpacity: 60,
      eliteSkillsEnabled: false, eliteMissionMapMarkers: "all",
      gwonmacTools: true, buildLibrary: false, tradeChat: false, xunlaiStorage: true, quickItemMove: true,
      travelPalette: false, characterSwitchEnabled: false, resignEnabled: true, whispersEnabled: true,
      callTargetEnabled: true, characterSwitchProfession: false, characterSwitchLevel: false,
      characterSwitchLocation: false, travelShortcuts: TRAVEL_SHORTCUTS, targetReadout: true,
      shortcutOverrides: { "travel.open": { key: "y", shift: true, option: false }, "game.resign": null },
      hubShortcuts: [],
      skillKeyBindings: [null, null, null, null, null, null, null, {
        input: { kind: "keyboard", code: "KeyQ" }, modifiers: { control: false, option: true, shift: false, command: false },
      }],
      skillKeyLabelsEnabled: true, chatFiltersEnabled: true, chatFilterAllyDrops: false,
      chatFilterHallOfHeroes: false, chatFilterTitleAchievements: false, skillCooldownOverlayEnabled: false,
      effectTimersEnabled: true, alcoholTimerEnabled: true, remindersEnabled: true, reminderCons: false,
      reminderPcons: false, reminderAlcohol: false, reminderBeforeEnd: false, reminderAtEnd: false, reminderSound: true,
      alcoholTimerPosition: { corner: "bottom-right", x: 10, y: 20, locked: false },
      skillCooldownColor: { kind: "custom", value: "#12ab34" },
      extendedMemoryEnabled: true, autoRelogAfterReload: true, memoryWarningPosition: { x: 0.25, y: 0.75 },
      showDiagnostics: true, autoCheckUpdates: false, lastUpdateCheckAt: 1_780_000_000_000,
      compatibilityNoticeSeenFor: "b".repeat(64),
    },
  },
];
