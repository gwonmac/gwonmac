// Writes tests/fixtures/player-data/<tag>/{defaults,custom}/ with the writer code
// of that released tag, so the fixtures are bytes a real install could hold. See
// the README beside this file. Run once per release, from the repository root:
//
//   node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts v2026.11.0
//
// `defaults` is what the tag writes before the player changes anything; `custom`
// has one realistic non-default value per field family. Every value is invented:
// no credentials, account names, real characters, local paths or packet contents.
// The tag's modules are another release's code, so they are imported untyped.
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [tag] = process.argv.slice(2);
if (!tag || !/^v\d+\.\d+\.\d+$/u.test(tag)) throw new Error("usage: generate.ts <release tag, for example v2026.11.0>");

// Where each writer lives: `src/` up to 2026.x, `app/` from 1.0.0. A module a
// release does not have is null, and the files it writes are skipped.
const MODULES = {
  defaults: ["src/shared/contracts.ts", "app/shared/settings/index.ts"],
  settings: ["src/main/core/settings.ts", "app/main/core/settings.ts"],
  overlay: ["src/shared/cartography-overlay.ts", "app/shared/cartography-overlay.ts"],
  travelMapId: ["src/shared/travel-map-id.ts", "app/shared/travel-map-id.ts"],
  travelPreferences: ["src/main/core/travel-preferences.ts", "app/main/core/travel-preferences.ts"],
  travelHistory: ["src/main/core/travel-history.ts", "app/features/travel/main/travel-history.ts"],
  tradeSaved: ["src/main/core/trade-saved-store.ts", "app/features/trade-chat/main/trade-saved-store.ts"],
  parseLibrary: ["src/shared/builds/parse-library.ts", "app/shared/builds/parse-library.ts"],
  buildLibrary: ["src/main/core/build-library.ts", "app/main/core/build-library.ts"],
  windowState: ["src/main/core/window-state.ts", "app/main/core/window-state.ts"],
  diagnosticProfile: ["src/main/core/diagnostic-profile.ts", "app/main/core/diagnostic-profile.ts"],
  accounts: ["src/main/core/multiple-accounts.ts", "app/main/core/multiple-accounts.ts"],
  templates: ["src/main/core/account-template-library.ts", "app/main/core/account-template-library.ts"],
  launcherState: ["src/main/core/launcher-state.ts", "app/main/core/launcher-state.ts"],
  mapKnowledge: ["src/main/core/cartography-map-knowledge.ts", "app/features/cartography/main/cartography-map-knowledge.ts"],
  eliteTracking: ["src/main/core/elite-tracking.ts", "app/features/cartography/main/elite-tracking.ts"],
  eliteLocations: ["src/shared/elite-locations.ts", "app/shared/elite-locations.ts"],
  texturePacks: ["src/main/core/texture-pack-manager.ts", "app/main/core/texture-pack-manager.ts"],
} as const;

// Invented identities, in the formats the app itself generates.
const PROFILE_A = "00000000-0000-4000-8000-00000000000a";
const PROFILE_B = "00000000-0000-4000-8000-00000000000b";
const CHARACTER_A = "00000000000000a1";
const CHARACTER_B = "00000000000000b2";
const FAKE_SHA256 = "ab".repeat(32);
const AREA = { x: 0, y: 0, width: 1440, height: 900 };
const PLAIN_MODIFIERS = { control: false, option: false, shift: false, command: false };

const repository = path.resolve(import.meta.dirname, "../../..");
const output = path.join(import.meta.dirname, tag);
const work = await mkdtemp(path.join(tmpdir(), "gwonmac-player-data-"));
try {
  // The tag's own sources, outside node_modules so Node strips their types,
  // with this checkout's packages beside them for their imports.
  const roots = execFileSync("git", ["ls-tree", "--name-only", tag], { cwd: repository, encoding: "utf8" })
    .split("\n").filter((name) => name === "src" || name === "app");
  execFileSync("sh", ["-c", `git archive ${tag} ${roots.join(" ")} | tar -x -C "${work}"`], { cwd: repository });
  await symlink(path.join(repository, "node_modules"), path.join(work, "node_modules"));
  const exists = (file: string) => access(path.join(work, file)).then(() => true, () => false);
  /** The tag's module for one writer, or null when that release has none. */
  const old = async (name: keyof typeof MODULES) => {
    for (const candidate of MODULES[name]) if (await exists(candidate)) return import(path.join(work, candidate));
    return null;
  };

  const { DEFAULT_SETTINGS } = await old("defaults");
  const settings = await old("settings");
  const overlay = await old("overlay");
  const travelMapId = await old("travelMapId");
  const travelPreferences = await old("travelPreferences");
  const travelHistory = await old("travelHistory");
  const tradeSaved = await old("tradeSaved");
  const { parseBuildLibrary, EMPTY_LIBRARY } = await old("parseLibrary");
  const buildLibrary = await old("buildLibrary");
  const windowState = await old("windowState");
  const diagnosticProfile = await old("diagnosticProfile");
  const accounts = await old("accounts");
  const templates = await old("templates");
  const launcherState = await old("launcherState");
  const mapKnowledge = await old("mapKnowledge");
  const eliteTracking = await old("eliteTracking");
  const eliteLocations = await old("eliteLocations");
  const texturePacks = await old("texturePacks");

  // 778 is the Piken Square (pre-Searing) ID that v2026.8.9 to v2026.8.12
  // stored. Later releases keep it in files but use 779 in memory.
  const piken = travelMapId ? travelMapId.PIKEN_SQUARE_PRE_SEARING_MAP_ID : 778;

  /** settings.json: every boolean flipped, a non-default value for each other field family. */
  function customSettings() {
    const next: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const [key, value] of Object.entries(next)) if (typeof value === "boolean") next[key] = !value;
    const theme = DEFAULT_SETTINGS.uiCustomTheme;
    const chosen: Record<string, unknown[]> = {
      renderScale: [1.5],
      uiStyle: ["obsidian"],
      uiCustomTheme: [theme && { ...theme, material: "modern", accent: "#5FB4A2", windowGradient: !theme.windowGradient }],
      uiFont: ["inter"],
      controllerPromptStyle: ["playstation"],
      uiPanelOpacity: [80],
      uiTextSize: [125],
      compassRangeEarshotOpacity: [40],
      compassRangeCastOpacity: [50],
      compassRangeSpiritOpacity: [60],
      compassRangeSpiritExtendedOpacity: [70],
      compassRangeTheme: ["monochrome"],
      cartographyRevealMode: ["normal"],
      cartographyWalkabilityOpacity: [30],
      cartographyGridOpacity: [45],
      cartographyControlIdleOpacity: [50],
      eliteMissionMapMarkers: ["all"],
      calculatorRates: [{ mode: "manual", ecto: "2", armbrace: "3", zkey: "4" }],
      hubShortcuts: [[{ id: "travel", phrase: "fast travel", pinned: true }]],
      // The binding grew a `control` flag after 2026.8.
      shortcutOverrides: [
        { "game.resign": { key: "r", shift: true, option: false, command: true, control: false } },
        { "storage.open": { key: "j", shift: true, option: false } },
      ],
      skillKeyBindings: [[
        { input: { kind: "keyboard", code: "KeyQ" }, modifiers: PLAIN_MODIFIERS },
        { input: { kind: "mouse-button", button: 3 }, modifiers: { ...PLAIN_MODIFIERS, shift: true } },
        null, null, null, null, null,
        { input: { kind: "wheel", direction: "up" }, modifiers: { ...PLAIN_MODIFIERS, control: true } },
      ]],
      skillCooldownColor: [{ kind: "custom", value: "#33AAFF" }],
      travelShortcuts: [[
        { mapId: 778, district: "international", districtNumber: 0 },
        { mapId: 55, district: "europe-english", districtNumber: 2 },
        null,
        ...DEFAULT_SETTINGS.travelShortcuts.slice(3),
      ]],
      // Betas of 2026.9 to 2026.10 stored a position without `corner`; Stable 2026.11 writes one.
      alcoholTimerPosition: [
        { corner: "bottom-right", x: 120, y: 200, locked: false },
        { x: 120, y: 200, locked: false },
      ],
      memoryWarningPosition: [{ x: 0.25, y: 0.75 }],
      lastUpdateCheckAt: [1_760_000_000_000],
      compatibilityNoticeSeenFor: [FAKE_SHA256],
      updateTrack: ["beta"],
    };
    if (overlay) {
      const base = overlay.CARTOGRAPHY_BUILTIN_PRESETS.cartographer.style;
      chosen.cartographyPresetLibrary = [{
        activePreset: { kind: "custom", id: "fixture-preset" },
        customPresets: [{
          id: "fixture-preset",
          name: "Fixture preset",
          style: { ...base, walkability: { ...base.walkability, veilColor: "#102030" } },
        }],
      }];
    }
    for (const [key, candidates] of Object.entries(chosen)) {
      if (!(key in DEFAULT_SETTINGS)) continue; // a field this release does not have
      const accepted = candidates.find((candidate) => {
        try { settings.parseSettings({ ...next, [key]: candidate }); return true; } catch { return false; }
      });
      if (accepted === undefined) throw new Error(`${tag} accepts none of the fixture values for settings.${key}`);
      next[key] = accepted;
    }
    return next;
  }

  async function write(variant: "defaults" | "custom") {
    const custom = variant === "custom";
    const dir = path.join(work, variant);
    const file = (...parts: string[]) => path.join(dir, ...parts);
    await mkdir(file("multi", "shared"), { recursive: true });

    await settings.saveSettings(file("settings.json"), custom ? customSettings() : DEFAULT_SETTINGS);

    await travelPreferences.updateTravelPreferences(file("travel-preferences.json"), {
      synonyms: custom ? [{ term: "my piken", mapId: piken }, { term: "home base", mapId: 55 }] : [],
    });
    // The store writes only after a first visit: an untouched profile has no history file.
    if (custom) {
      const history = new travelHistory.TravelHistoryStore(file("travel-history.json"));
      for (const mapId of [81, piken, 55]) await history.record(CHARACTER_A, mapId);
      await history.record(CHARACTER_B, 449);
    }
    if (tradeSaved) {
      await new tradeSaved.TradeSavedStore(file("trade-saved.json")).set(custom
        ? {
            offers: [{ source: "kamadan", timestamp: 1_760_000_000_000, sender: "Fixture Seller", message: "WTS fixture item 5k", savedAt: 1_760_000_100_000 }],
            players: [{ sender: "Fixture Seller", savedAt: 1_760_000_200_000 }],
          }
        : { offers: [], players: [] });
    }

    const library = (build: string, team: string) => !custom ? EMPTY_LIBRARY : parseBuildLibrary({
      version: 3,
      tags: ["heal"],
      builds: [{
        id: build, name: "Fixture Healer", parent: null, origin: null,
        professions: ["Mo", "Me"],
        skills: [282, 283, 281, 887, null, null, null, 2],
        attributes: { HealingPrayers: 12, DivineFavor: 11 },
        tags: ["heal"], notes: "Fixture build.", favourite: true, lastUsed: 1_760_000_000_000,
      }],
      teams: [{
        id: team, name: "Fixture team", tags: ["heal"], mode: "hard", favourite: true, lastUsed: 1_760_000_000_000, notes: "Fixture team.",
        slots: [
          { build, hero: null, behaviour: null },
          { build: null, hero: 1, behaviour: "fight" },
          ...Array.from({ length: 6 }, () => ({ build: null, hero: null, behaviour: "guard" })),
        ],
      }],
    });
    await buildLibrary.saveBuildLibrary(file("build-library.json"), library("b1", "t1"));

    const placement = (x: number, width: number, height: number) =>
      ({ bounds: { x, y: 80, width, height }, mode: custom ? "maximized" : "normal", displayWorkArea: AREA });
    await windowState.saveWindowState(file("window-state.json"), custom ? placement(120, 1100, 700) : windowState.defaultWindowState(AREA));
    // The launcher window exists from the first launcher release.
    if (launcherState) {
      await windowState.saveWindowState(file("launcher-window-state.json"), custom ? placement(200, 960, 640) : windowState.defaultWindowState(AREA));
    }
    await diagnosticProfile.saveDiagnosticProfile(file("diagnostic-profile.json"), custom ? "direct-canvas" : "standard");

    // Accounts metadata. Credentials live in the Keychain, never here. From the
    // first launcher release the app no longer writes launcher-mode.json.
    if (accounts.saveAccountMode && !launcherState) {
      await accounts.saveAccountMode(file("launcher-mode.json"), custom ? "multi" : "single");
    }
    let workspace = accounts.createMultiWorkspace();
    if (custom) {
      workspace = accounts.addMultiProfile(workspace, { id: PROFILE_A, name: "Fixture Main", templates: "shared", builds: "shared" });
      workspace = accounts.addMultiProfile(workspace, { id: PROFILE_B, name: "Fixture Second", templates: "private", builds: "private" });
      workspace = accounts.archiveMultiProfile(workspace, PROFILE_B);
    }
    await accounts.saveMultiWorkspace(file("multi", "workspace.json"), workspace);
    const templateLibrary = { revision: custom ? 3 : 0, entries: custom ? [{ path: "Monk/Fixture Healer.txt", contents: "OwAT043A5RsS8cTHUHeTnQbB" }] : [] };
    await templates.saveAccountTemplateLibrary(file("multi", "single-template-import.json"), templateLibrary);
    await templates.saveAccountTemplateLibrary(file("multi", "shared", "templates.json"), templateLibrary);
    await buildLibrary.saveBuildLibrary(file("multi", "shared", "build-library.json"), library("b2", "t2"));
    if (custom) {
      const profile = (...parts: string[]) => file("multi", "profiles", PROFILE_B, ...parts);
      await templates.saveAccountTemplateLibrary(profile("templates.json"), templateLibrary);
      await buildLibrary.saveBuildLibrary(profile("build-library.json"), library("b3", "t3"));
      await windowState.saveWindowState(profile("window-state.json"), placement(60, 1000, 650));
    }

    if (launcherState) {
      const { document } = await launcherState.loadOrCreateLauncherState(file("launcher-state.json"), custom ? "migrated-multi" : "fresh");
      if (custom) {
        const store = new launcherState.LauncherStateStore(file("launcher-state.json"), document);
        await store.setSelection([PROFILE_A]);
        await store.updateAppearance(PROFILE_A, { icon: "crown", color: "#3366cc" });
        await store.updatePreferences({
          content: { news: true, dailies: false, first: "news", officialNews: false, reforgedNews: false, eventNews: false, autoRotateNews: false },
        });
        await store.dismissMigrationNotice();
        await store.completeSetup();
      }
    }
    // Written only after a first map or character is recorded.
    if (mapKnowledge && custom) {
      await new mapKnowledge.CartographyMapKnowledgeStore(file("cartography-map-knowledge.json")).record(FAKE_SHA256, {
        kernelSha256: "cd".repeat(32), mapId: 81, continent: 1, width: 8, height: 8, revealRadius: 3,
        words: [305_419_896, 2_271_560_481],
      });
    }
    if (eliteTracking) {
      const [first, second] = eliteLocations.ELITE_LOCATIONS;
      const update = (change: unknown) =>
        new eliteTracking.EliteTrackingStore().update(file("elite-tracking.json"), { characterKey: CHARACTER_A, change });
      if (custom) {
        await update({ kind: "track", skillId: second.skillId });
        await update({ kind: "target", locationId: first.id });
      } else {
        await update({ kind: "target", locationId: null });
      }
    }
    // A selected pack needs an imported .tpf, so only the empty selection is written.
    if (texturePacks && !custom) {
      const root = file("texture-packs");
      const paths = { root, packs: path.join(root, "packs"), staging: path.join(root, "staging"), selection: path.join(root, "selection.json") };
      await new texturePacks.TexturePackManager(paths, () => undefined).initialise();
      await rm(paths.packs, { recursive: true, force: true });
      await rm(paths.staging, { recursive: true, force: true });
    }

    // The tag must read its own files back without recovery, or they are not
    // what that release could hold.
    await settings.loadSettings(file("settings.json"), () => { throw new Error(`${tag} refused its own settings.json`); });
    const leftovers = (await readdir(dir, { recursive: true })).filter((name) => name.includes(".corrupt-") || name.includes(".tmp"));
    if (leftovers.length > 0) throw new Error(`${tag} left recovery or temporary files: ${leftovers.join(", ")}`);
  }

  await write("defaults");
  await write("custom");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(work, "defaults"), path.join(output, "defaults"), { recursive: true });
  await cp(path.join(work, "custom"), path.join(output, "custom"), { recursive: true });
  console.log(`wrote ${path.relative(repository, output)}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
