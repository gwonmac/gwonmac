// Players install 1.0.0 over a 2026.x app and keep everything (AGENTS.md,
// "Must stay"). tests/fixtures/player-data/<tag>/<variant>/ holds the files that
// tag's own writer code produced (`defaults`: nothing changed yet; `custom`: one
// non-default value per field family). Each row below loads one of them through
// the CURRENT loader. A validator that refuses an old value would quarantine the
// file and reset it to defaults, silently, for every upgraded player: here the
// row fails instead. It fails on any of: a value that did not survive, a recovery
// callback, or a new file next to the original (quarantine and corrupt copies).
//
// Regenerate for a new release, from the repository root (see the README beside
// the fixtures and docs/releasing.md):
//   node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts <tag>
//
// Files a release does not write have no row for it, on purpose:
//   v2026.8.12  has no launcher-state.json, launcher-window-state.json,
//               cartography-map-knowledge.json, elite-tracking.json or
//               texture-packs/selection.json: those features arrived later.
//   v2026.11.0  has no launcher-mode.json: the launcher release stopped
//               writing it (the current app still reads one from 2026.8).
//   both        travel-history.json and cartography-map-knowledge.json have no
//               `defaults` variant: the stores write only after a first visit.
//   both        a selected texture pack needs an imported .tpf, so only the
//               empty selection exists; launcher-news-cache.json is a network
//               cache the app refetches (losing it costs one request); client
//               generation markers (game/**) belong to the client-lifecycle
//               tests; credentials live in the Keychain, never in a file.
import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, it } from "node:test";
import { loadAccountTemplateLibrary } from "../../app/main/core/account-template-library.js";
import { loadBuildLibrary } from "../../app/main/core/build-library.js";
import { loadDiagnosticProfile } from "../../app/main/core/diagnostic-profile.js";
import { loadOrCreateLauncherState } from "../../app/main/core/launcher-state.js";
import { loadAccountMode, loadMultiWorkspace } from "../../app/main/core/multiple-accounts.js";
import { loadSettings } from "../../app/main/core/settings.js";
import { TexturePackManager } from "../../app/main/core/texture-pack-manager.js";
import { loadTravelPreferences } from "../../app/main/core/travel-preferences.js";
import { loadWindowState } from "../../app/main/core/window-state.js";
import { CartographyMapKnowledgeStore } from "../../app/features/cartography/main/cartography-map-knowledge.js";
import { EliteTrackingStore } from "../../app/features/cartography/main/elite-tracking.js";
import { TradeSavedStore } from "../../app/features/trade-chat/main/trade-saved-store.js";
import { TravelHistoryStore } from "../../app/features/travel/main/travel-history.js";
import type { TravelCharacterKey } from "../../app/shared/travel-history.js";
import { travelShortcutsFromStored } from "../../app/shared/travel.js";

const FIXTURES = "tests/fixtures/player-data";
const OLD = "v2026.8.12";
const NEW = "v2026.11.0";
const PROFILE_B = "multi/profiles/00000000-0000-4000-8000-00000000000b";
const CHARACTER_A = "00000000000000a1" as TravelCharacterKey;
const CHARACTER_B = "00000000000000b2" as TravelCharacterKey;
const CLIENT = "ab".repeat(32);
const KERNEL = "cd".repeat(32);

interface Context {
  readonly file: string;
  readonly recovered: string[];
}

/** One current loader, called the way the app calls it. */
const LOADERS: Record<string, (context: Context) => Promise<unknown>> = {
  loadSettings: ({ file, recovered }) => loadSettings(file, ({ backupPath }) => { recovered.push(backupPath); }),
  "travelShortcutsFromStored(loadSettings)": async ({ file, recovered }) =>
    travelShortcutsFromStored((await loadSettings(file, ({ backupPath }) => { recovered.push(backupPath); })).travelShortcuts),
  loadTravelPreferences: ({ file, recovered }) => loadTravelPreferences(file, (backup) => { recovered.push(backup); }),
  "TravelHistoryStore.get": async ({ file }) => {
    const store = new TravelHistoryStore(file);
    return { [CHARACTER_A]: await store.get(CHARACTER_A), [CHARACTER_B]: await store.get(CHARACTER_B) };
  },
  "TradeSavedStore.get": ({ file }) => new TradeSavedStore(file).get(),
  loadBuildLibrary: ({ file, recovered }) => loadBuildLibrary(file, (backup) => { recovered.push(backup); }),
  loadWindowState: ({ file, recovered }) => loadWindowState(file, () => { recovered.push("window state refused"); }),
  loadDiagnosticProfile: ({ file }) => loadDiagnosticProfile(file),
  loadAccountMode: ({ file }) => loadAccountMode(file),
  loadMultiWorkspace: ({ file }) => loadMultiWorkspace(file),
  loadAccountTemplateLibrary: ({ file }) => loadAccountTemplateLibrary(file),
  loadOrCreateLauncherState: async ({ file }) => (await loadOrCreateLauncherState(file, "migrated-single")).document,
  "CartographyMapKnowledgeStore.get": ({ file }) => new CartographyMapKnowledgeStore(file).get(CLIENT, KERNEL),
  "EliteTrackingStore.get": async ({ file }) => ({
    [CHARACTER_A]: await new EliteTrackingStore().get(file, CHARACTER_A),
  }),
  "TexturePackManager.initialise": async ({ file }) => {
    const root = join(file, "..");
    const manager = new TexturePackManager(
      { root, packs: join(root, "packs"), staging: join(root, "staging"), selection: file },
      () => undefined,
    );
    await manager.initialise();
    return manager.snapshot();
  },
};

interface Row {
  readonly tag: string;
  readonly variant: "defaults" | "custom";
  /** Path inside the variant folder, as under the app's userData folder. */
  readonly file: string;
  readonly loader: keyof typeof LOADERS;
  /** The loader rule this fixture holds in place. */
  readonly guards: string;
  /** The loaded value, or for `partial` rows the fields it must contain. */
  readonly expect: unknown;
  readonly partial?: true;
  /** Settings the current app drops on purpose: the loaded value must not have them. */
  readonly absent?: readonly string[];
}

/** The same row for several tags, when each tag's file loads to the same value. */
const each = (tags: readonly string[], row: Omit<Row, "tag">): Row[] => tags.map((tag) => ({ tag, ...row }));
const BOTH = [OLD, NEW];

// 1.0 clean cut (49da271f): these three are no longer read, so they are not kept.
const DROPPED_SETTINGS = ["dataStrategy", "teamManagement", "updateTrack"];

const EMPTY_LIBRARY = { version: 3, builds: [], teams: [], tags: [] };
const EMPTY_TEMPLATES = { revision: 0, entries: [] };
const TEMPLATES = { revision: 3, entries: [{ path: "Monk/Fixture Healer.txt", contents: "OwAT043A5RsS8cTHUHeTnQbB" }] };
const LIBRARY = {
  version: 3,
  builds: [{
    id: "b1", name: "Fixture Healer", professions: ["Mo", "Me"], skills: [282, 283, 281, 887, null, null, null, 2],
    attributes: { HealingPrayers: 12, DivineFavor: 11 }, tags: ["heal"], notes: "Fixture build.", favourite: true,
    lastUsed: 1_760_000_000_000, parent: null, origin: null,
  }],
  teams: [{
    id: "t1", name: "Fixture team", tags: ["heal"], mode: "hard", favourite: true, lastUsed: 1_760_000_000_000, notes: "Fixture team.",
    slots: [
      { build: "b1", hero: null, behaviour: null },
      { build: null, hero: 1, behaviour: "fight" },
      ...Array.from({ length: 6 }, () => ({ build: null, hero: null, behaviour: "guard" })),
    ],
  }],
  tags: ["heal"],
};
const library = (build: string, team: string) => ({
  ...LIBRARY,
  builds: LIBRARY.builds.map((entry) => ({ ...entry, id: build })),
  teams: LIBRARY.teams.map((entry) => ({ ...entry, id: team, slots: [{ build, hero: null, behaviour: null }, ...entry.slots.slice(1)] })),
});
const DEFAULT_PLACEMENT = {
  bounds: { x: 80, y: 50, width: 1280, height: 800 }, mode: "normal", displayWorkArea: { x: 0, y: 0, width: 1440, height: 900 },
};
const placement = (x: number, width: number, height: number) => ({
  bounds: { x, y: 80, width, height }, mode: "maximized", displayWorkArea: { x: 0, y: 0, width: 1440, height: 900 },
});
const WORKSPACE = {
  formatVersion: 1,
  profiles: [
    { id: "00000000-0000-4000-8000-00000000000a", name: "Fixture Main", archived: false, templates: "shared", builds: "shared" },
    { id: "00000000-0000-4000-8000-00000000000b", name: "Fixture Second", archived: true, templates: "private", builds: "private" },
  ],
  deletingProfileIds: [],
};
const THEME = {
  material: "modern", window: "#0B0B0B", titlebar: "#292927", surface: "#202225", recessed: "#080807",
  selected: "#1B3554", accent: "#5FB4A2", text: "#F1EBDD", mutedText: "#B7B09F", border: "#D8D2BF", windowGradient: false,
};
const SKILL_KEYS = [
  { input: { kind: "keyboard", code: "KeyQ" }, modifiers: { control: false, option: false, shift: false, command: false } },
  { input: { kind: "mouse-button", button: 3 }, modifiers: { control: false, option: false, shift: true, command: false } },
  null, null, null, null, null,
  { input: { kind: "wheel", direction: "up" }, modifiers: { control: true, option: false, shift: false, command: false } },
];
const STORED_SHORTCUTS = [
  { mapId: 778, district: "international", districtNumber: 0 },
  { mapId: 55, district: "europe-english", districtNumber: 2 },
  null,
  { mapId: 194, district: "international", districtNumber: 0 },
  { mapId: 642, district: "international", districtNumber: 0 },
  { mapId: 857, district: "international", districtNumber: 0 },
];
// Fields both releases customised in the `custom` settings.json.
const CUSTOM_SETTINGS_BOTH = {
  renderScale: 1.5, uiStyle: "obsidian", uiCustomTheme: THEME, uiFont: "inter", controllerPromptStyle: "playstation",
  uiPanelOpacity: 80, gwonmacTools: true, buildLibrary: false, tradeChat: false, xunlaiStorage: true, travelPalette: false,
  travelShortcuts: STORED_SHORTCUTS, targetReadout: true, skillKeyBindings: SKILL_KEYS, skillKeyLabelsEnabled: true,
  skillCooldownOverlayEnabled: false, skillCooldownColor: { kind: "custom", value: "#33AAFF" }, extendedMemoryEnabled: true,
  autoRelogAfterReload: true, showDiagnostics: true, autoCheckUpdates: false, lastUpdateCheckAt: 1_760_000_000_000,
  compatibilityNoticeSeenFor: CLIENT,
};
const CUSTOM_PRESET_STYLE = {
  walkability: { veilColor: "#102030", boundaryColor: "#F2A900", boundaryWidth: 1, boundaryCasingColor: "#050709" },
  grid: {
    casingColor: "#050709",
    lattice: { color: "#E8E1D0", width: 2, pattern: "solid" },
    unseen: { color: "#FF7A1A", marker: "diamond" },
    noWalkableColor: "#8F99A3",
    current: { color: "#FFFFFF", width: 3, pattern: "solid" },
    hover: { color: "#FFE45C", width: 4, pattern: "solid" },
    normalRange: { color: "#00D9FF", width: 4, pattern: "solid" },
    birdsEyeRange: { color: "#FF4FD8", width: 4, pattern: "dash-dot" },
  },
};
const ELITE_VIEW = {
  search: "", professions: { kind: "all" }, region: "", learned: "missing", mode: "browse", worldMap: true,
  panelOpen: false, panelHeightRatio: 0.8, focusedSkill: null,
};
const LAUNCHER_DEFAULTS = {
  formatVersion: 1, installationKind: "fresh", setupVersion: 0, migrationNoticeDismissed: true, preferencesResetPending: false,
  selectedProfileIds: [],
  preferences: { content: { news: true, dailies: true, first: "news", officialNews: true, reforgedNews: true, eventNews: true, autoRotateNews: true } },
  appearances: {},
};

const ROWS: readonly Row[] = [
  // ---- settings.json
  ...each(BOTH, {
    variant: "defaults", file: "settings.json", loader: "loadSettings", partial: true, absent: DROPPED_SETTINGS,
    guards: "every default-valued setting passes its validator (a narrowed enum or range would reset the file)",
    expect: {
      renderScale: 2, uiStyle: "guild-wars", uiFont: "guild-wars", controllerPromptStyle: "game-default", uiPanelOpacity: 94,
      buildLibrary: true, tradeChat: true, travelPalette: true, autoCheckUpdates: true, lastUpdateCheckAt: null,
      compatibilityNoticeSeenFor: null,
    },
  }),
  {
    tag: OLD, variant: "custom", file: "settings.json", loader: "loadSettings", partial: true, absent: DROPPED_SETTINGS,
    guards: "each setting family keeps a non-default value: enums, ranges, booleans, bindings, colours, positions, timestamps",
    expect: {
      ...CUSTOM_SETTINGS_BOTH,
      shortcutOverrides: { "storage.open": { key: "j", shift: true, option: false } },
    },
  },
  {
    tag: NEW, variant: "custom", file: "settings.json", loader: "loadSettings", partial: true, absent: DROPPED_SETTINGS,
    guards: "each setting family keeps a non-default value: enums, ranges, booleans, bindings, colours, positions, timestamps",
    expect: {
      ...CUSTOM_SETTINGS_BOTH,
      uiTextSize: 125,
      cartographyEnabled: false, cartographyOverlayEnabled: true, cartographyGridEnabled: true, cartographyCompassGridEnabled: true,
      compassRangeIndicatorsEnabled: true, compassRangeEarshotEnabled: false, compassRangeCastEnabled: false,
      compassRangeSpiritEnabled: false, compassRangeSpiritExtendedEnabled: false,
      compassRangeEarshotOpacity: 40, compassRangeCastOpacity: 50, compassRangeSpiritOpacity: 60, compassRangeSpiritExtendedOpacity: 70,
      compassRangeTheme: "monochrome", cartographyRevealMode: "normal",
      cartographyPresetLibrary: {
        activePreset: { kind: "custom", id: "fixture-preset" },
        customPresets: [{ id: "fixture-preset", name: "Fixture preset", style: CUSTOM_PRESET_STYLE }],
      },
      cartographyWalkabilityOpacity: 30, cartographyGridOpacity: 45, cartographyControlIdleOpacity: 50,
      eliteSkillsEnabled: false, eliteMissionMapMarkers: "all", quickItemMove: true,
      characterSwitchEnabled: false, resignEnabled: true, whispersEnabled: true, callTargetEnabled: true,
      characterSwitchProfession: false, characterSwitchLevel: false, characterSwitchLocation: false,
      shortcutOverrides: { "game.resign": { key: "r", shift: true, option: false, command: true, control: false } },
      hubShortcuts: [{ id: "travel", phrase: "fast travel", pinned: true }],
      calculatorRates: { mode: "manual", ecto: "2", armbrace: "3", zkey: "4" },
      chatFiltersEnabled: true, chatFilterAllyDrops: false, chatFilterHallOfHeroes: false, chatFilterTitleAchievements: false,
      effectTimersEnabled: true, alcoholTimerEnabled: true, remindersEnabled: true, reminderCons: false, reminderPcons: false,
      reminderAlcohol: false, reminderBeforeEnd: false, reminderAtEnd: false, reminderSound: true,
      alcoholTimerPosition: { corner: "bottom-right", x: 120, y: 200, locked: false }, memoryWarningPosition: { x: 0.25, y: 0.75 },
    },
  },
  ...each(BOTH, {
    variant: "custom", file: "settings.json", loader: "travelShortcutsFromStored(loadSettings)",
    guards: "Piken Square (pre-Searing) stored as 778 by 2026.8.9 to 2026.8.12 reads as the official 779",
    expect: [{ mapId: 779 }, { mapId: 55 }, null, { mapId: 194 }, { mapId: 642 }, { mapId: 857 }, null, null, null],
  }),

  // ---- travel
  ...each(BOTH, {
    variant: "defaults", file: "travel-preferences.json", loader: "loadTravelPreferences",
    guards: "the rollback-safe shape (recentLimit, recentMapIds beside synonyms) is accepted",
    expect: { formatVersion: 1, synonyms: [] },
  }),
  ...each(BOTH, {
    variant: "custom", file: "travel-preferences.json", loader: "loadTravelPreferences",
    guards: "synonyms keep their terms, and the stored Piken Square 778 reads as 779",
    expect: { formatVersion: 1, synonyms: [{ term: "my piken", mapId: 779 }, { term: "home base", mapId: 55 }] },
  }),
  ...each(BOTH, {
    variant: "custom", file: "travel-history.json", loader: "TravelHistoryStore.get",
    guards: "per-character history keeps its order and maps stored 778 to 779",
    expect: { [CHARACTER_A]: [55, 779, 81], [CHARACTER_B]: [449] },
  }),

  // ---- trade
  ...each(BOTH, {
    variant: "defaults", file: "trade-saved.json", loader: "TradeSavedStore.get",
    guards: "an empty saved-trade document is valid", expect: { offers: [], players: [] },
  }),
  ...each(BOTH, {
    variant: "custom", file: "trade-saved.json", loader: "TradeSavedStore.get",
    guards: "a starred offer and player keep source, timestamps, sender and message",
    expect: {
      offers: [{ source: "kamadan", timestamp: 1_760_000_000_000, sender: "Fixture Seller", message: "WTS fixture item 5k", savedAt: 1_760_000_100_000 }],
      players: [{ sender: "Fixture Seller", savedAt: 1_760_000_200_000 }],
    },
  }),

  // ---- builds
  ...each(BOTH, {
    variant: "defaults", file: "build-library.json", loader: "loadBuildLibrary",
    guards: "an empty library is not treated as corrupt (a quarantined library is a player's collection gone)",
    expect: EMPTY_LIBRARY,
  }),
  ...each(BOTH, {
    variant: "custom", file: "build-library.json", loader: "loadBuildLibrary",
    guards: "a build, its attributes and a team with a hero slot keep every field and reference",
    expect: library("b1", "t1"),
  }),

  // ---- window placement and diagnostics
  ...each(BOTH, {
    variant: "defaults", file: "window-state.json", loader: "loadWindowState",
    guards: "a saved window placement is kept, not cleared as invalid", expect: DEFAULT_PLACEMENT,
  }),
  ...each(BOTH, {
    variant: "custom", file: "window-state.json", loader: "loadWindowState",
    guards: "a maximized placement keeps its mode and display work area", expect: placement(120, 1100, 700),
  }),
  ...each(BOTH, {
    variant: "defaults", file: "diagnostic-profile.json", loader: "loadDiagnosticProfile",
    guards: "the standard profile reads back", expect: "standard",
  }),
  ...each(BOTH, {
    variant: "custom", file: "diagnostic-profile.json", loader: "loadDiagnosticProfile",
    guards: "a non-standard graphics profile is not reset to standard", expect: "direct-canvas",
  }),

  // ---- accounts
  { tag: OLD, variant: "defaults", file: "launcher-mode.json", loader: "loadAccountMode", guards: "the 2026.8 account mode document is still read", expect: "single" },
  { tag: OLD, variant: "custom", file: "launcher-mode.json", loader: "loadAccountMode", guards: "a player in Multiple Accounts mode stays in it", expect: "multi" },
  ...each(BOTH, {
    variant: "defaults", file: "multi/workspace.json", loader: "loadMultiWorkspace",
    guards: "an empty workspace is valid", expect: { formatVersion: 1, profiles: [], deletingProfileIds: [] },
  }),
  ...each(BOTH, {
    variant: "custom", file: "multi/workspace.json", loader: "loadMultiWorkspace",
    guards: "active and archived profiles keep id, name and library scopes", expect: WORKSPACE,
  }),
  ...each(BOTH, {
    variant: "defaults", file: "multi/single-template-import.json", loader: "loadAccountTemplateLibrary",
    guards: "an empty first-account template snapshot is valid", expect: EMPTY_TEMPLATES,
  }),
  ...each(BOTH, {
    variant: "custom", file: "multi/single-template-import.json", loader: "loadAccountTemplateLibrary",
    guards: "a pending first-account template snapshot keeps its entries and revision", expect: TEMPLATES,
  }),
  ...each(BOTH, {
    variant: "defaults", file: "multi/shared/templates.json", loader: "loadAccountTemplateLibrary",
    guards: "an empty shared template library is valid", expect: EMPTY_TEMPLATES,
  }),
  ...each(BOTH, {
    variant: "custom", file: "multi/shared/templates.json", loader: "loadAccountTemplateLibrary",
    guards: "shared templates keep path, code and revision", expect: TEMPLATES,
  }),
  ...each(BOTH, {
    variant: "defaults", file: "multi/shared/build-library.json", loader: "loadBuildLibrary",
    guards: "an empty shared library is not treated as corrupt", expect: EMPTY_LIBRARY,
  }),
  ...each(BOTH, {
    variant: "custom", file: "multi/shared/build-library.json", loader: "loadBuildLibrary",
    guards: "the shared library keeps its builds and teams", expect: library("b2", "t2"),
  }),
  ...each(BOTH, {
    variant: "custom", file: `${PROFILE_B}/templates.json`, loader: "loadAccountTemplateLibrary",
    guards: "a private profile keeps its own templates", expect: TEMPLATES,
  }),
  ...each(BOTH, {
    variant: "custom", file: `${PROFILE_B}/build-library.json`, loader: "loadBuildLibrary",
    guards: "a private profile keeps its own build library", expect: library("b3", "t3"),
  }),
  ...each(BOTH, {
    variant: "custom", file: `${PROFILE_B}/window-state.json`, loader: "loadWindowState",
    guards: "a private profile keeps its own window placement", expect: placement(60, 1000, 650),
  }),

  // ---- first written by v2026.11.0, the first launcher release
  {
    tag: NEW, variant: "defaults", file: "launcher-state.json", loader: "loadOrCreateLauncherState",
    guards: "a fresh-install document is kept (setup version 0, no reset notice)", expect: LAUNCHER_DEFAULTS,
  },
  {
    tag: NEW, variant: "custom", file: "launcher-state.json", loader: "loadOrCreateLauncherState",
    guards: "selection, appearance, News visibility and setup version survive; no preferences-reset notice is raised",
    expect: {
      formatVersion: 1, installationKind: "migrated-multi", setupVersion: 1, migrationNoticeDismissed: true,
      preferencesResetPending: false,
      selectedProfileIds: ["00000000-0000-4000-8000-00000000000a"],
      preferences: { content: { news: true, dailies: false, first: "news", officialNews: false, reforgedNews: false, eventNews: false, autoRotateNews: false } },
      appearances: { "00000000-0000-4000-8000-00000000000a": { icon: "crown", color: "#3366cc" } },
    },
  },
  { tag: NEW, variant: "defaults", file: "launcher-window-state.json", loader: "loadWindowState", guards: "a saved launcher placement is kept", expect: DEFAULT_PLACEMENT },
  { tag: NEW, variant: "custom", file: "launcher-window-state.json", loader: "loadWindowState", guards: "a maximized launcher placement keeps its mode", expect: placement(200, 960, 640) },
  {
    tag: NEW, variant: "defaults", file: "elite-tracking.json", loader: "EliteTrackingStore.get",
    guards: "a character with no tracked skills keeps the default view", expect: { [CHARACTER_A]: { skills: [], activeLocation: null, view: ELITE_VIEW } },
  },
  {
    tag: NEW, variant: "custom", file: "elite-tracking.json", loader: "EliteTrackingStore.get",
    guards: "tracked elite skills and the chosen capture location survive",
    expect: { [CHARACTER_A]: { skills: [237, 1465], activeLocation: "bf158b4a20ab0f6b", view: ELITE_VIEW } },
  },
  {
    tag: NEW, variant: "custom", file: "cartography-map-knowledge.json", loader: "CartographyMapKnowledgeStore.get",
    guards: "explored-cell masks decode to the same words for the client and kernel that wrote them",
    expect: [{ kernelSha256: KERNEL, mapId: 81, continent: 1, width: 8, height: 8, revealRadius: 3, words: [305_419_896, 2_271_560_481] }],
  },
  {
    tag: NEW, variant: "defaults", file: "texture-packs/selection.json", loader: "TexturePackManager.initialise",
    guards: "the empty texture pack selection is read, not renamed aside as corrupt", expect: { selectedPackId: null, packs: [] },
  },
];

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const filesIn = async (root: string) => (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(root, join(entry.parentPath, entry.name)))
  .sort();

describe("player data written by released apps", () => {
  it("has a row for every fixture file and a fixture for every row", async () => {
    const fixtures: string[] = [];
    for (const tag of (await readdir(FIXTURES, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
      for (const file of await filesIn(join(FIXTURES, tag.name))) fixtures.push(`${tag.name}/${file}`);
    }
    assert.deepEqual(fixtures.sort(), [...new Set(ROWS.map((row) => `${row.tag}/${row.variant}/${row.file}`))].sort());
  });

  for (const row of ROWS) {
    it(`${row.tag}/${row.variant}/${row.file} loads through ${String(row.loader)}`, async () => {
      const root = await mkdtemp(join(tmpdir(), "gwonmac-player-data-"));
      roots.push(root);
      await cp(join(FIXTURES, row.tag, row.variant), root, { recursive: true });
      const before = await filesIn(root);
      const context: Context = { file: join(root, row.file), recovered: [] };

      const loaded = await LOADERS[row.loader]!(context);

      if (row.partial) {
        for (const [key, value] of Object.entries(row.expect as Record<string, unknown>)) {
          assert.deepEqual((loaded as Record<string, unknown>)[key], value, `${row.guards}: ${key}`);
        }
      } else {
        assert.deepEqual(loaded, row.expect, row.guards);
      }
      for (const key of row.absent ?? []) assert.equal(key in (loaded as object), false, `${key} is dropped on purpose`);
      assert.deepEqual(context.recovered, [], `${row.guards}: the loader recovered the file`);
      // Quarantine and corrupt-copy recovery leave a file beside the original;
      // a window placement the loader refuses is deleted.
      assert.deepEqual(await filesIn(root), before, `${row.guards}: the loader moved, copied or removed a file`);
    });
  }
});
