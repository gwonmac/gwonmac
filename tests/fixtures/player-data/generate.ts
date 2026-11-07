// Writes tests/fixtures/player-data/<tag>/ with the writer code of that
// released tag, so the fixtures are bytes a real install could hold. See the
// README beside this file. Run once per release, from the repository root:
//
//   node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts v2026.11.0
//
// Every value is invented: no credentials, account names or real characters.
// The tag's modules are another release's code, so they are imported untyped.
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [tag] = process.argv.slice(2);
if (!tag || !/^v\d+\.\d+\.\d+$/u.test(tag)) throw new Error("usage: generate.ts <release tag, for example v2026.11.0>");

// Where each writer lives: `src/` up to 2026.x, `app/` from 1.0.0.
const MODULES = {
  defaults: ["src/shared/contracts.ts", "app/shared/settings/index.ts"],
  settings: ["src/main/core/settings.ts", "app/main/core/settings.ts"],
  travelPreferences: ["src/main/core/travel-preferences.ts", "app/main/core/travel-preferences.ts"],
  travelHistory: ["src/main/core/travel-history.ts", "app/features/travel/main/travel-history.ts"],
  parseLibrary: ["src/shared/builds/parse-library.ts", "app/shared/builds/parse-library.ts"],
  buildLibrary: ["src/main/core/build-library.ts", "app/main/core/build-library.ts"],
  accounts: ["src/main/core/multiple-accounts.ts", "app/main/core/multiple-accounts.ts"],
  templates: ["src/main/core/account-template-library.ts", "app/main/core/account-template-library.ts"],
  launcherState: ["src/main/core/launcher-state.ts", "app/main/core/launcher-state.ts"],
} as const;

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

  const userData = path.join(work, "userData");
  await mkdir(path.join(userData, "multi", "shared"), { recursive: true });
  const file = (...parts: string[]) => path.join(userData, ...parts);

  // settings.json: every boolean flipped from its default, plus a non-default
  // value for each enum and range the tag knows.
  const { DEFAULT_SETTINGS } = await old("defaults");
  const { saveSettings, loadSettings } = await old("settings");
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, value] of Object.entries(settings)) if (typeof value === "boolean") settings[key] = !value;
  const chosen: Record<string, unknown> = {
    renderScale: 1.5,
    uiStyle: "obsidian",
    uiFont: "georgia",
    uiTextSize: 150,
    uiPanelOpacity: 80,
    controllerPromptStyle: "playstation",
    cartographyRevealMode: "birds-eye",
    compassRangeTheme: "monochrome",
    // 778 is the Piken Square ID that v2026.8.9 to v2026.8.12 stored.
    travelShortcuts: [
      { mapId: tag === "v2026.8.12" ? 778 : 779, district: "international", districtNumber: 0 },
      { mapId: 55, district: "europe-german", districtNumber: 2 },
      null,
      ...(DEFAULT_SETTINGS.travelShortcuts as unknown[]).slice(3),
    ],
  };
  for (const [key, value] of Object.entries(chosen)) if (key in settings) settings[key] = value;
  await saveSettings(file("settings.json"), settings);

  // travel-preferences.json and travel-history.json.
  const { updateTravelPreferences } = await old("travelPreferences");
  await updateTravelPreferences(file("travel-preferences.json"), {
    synonyms: [{ term: "pre", mapId: tag === "v2026.8.12" ? 778 : 779 }, { term: "lion", mapId: 55 }],
  });
  const { TravelHistoryStore } = await old("travelHistory");
  const history = new TravelHistoryStore(file("travel-history.json"));
  for (const mapId of [55, tag === "v2026.8.12" ? 778 : 779, 81]) await history.record("0123456789abcdef", mapId);

  // build-library.json: one build, its variant, and a team that uses both.
  const { parseBuildLibrary } = await old("parseLibrary");
  const { saveBuildLibrary } = await old("buildLibrary");
  const build = (id: string, name: string, parent: string | null) => ({
    id, name, parent, origin: null,
    professions: ["Mo", "Me"],
    skills: [282, 283, 281, 887, null, null, null, 2],
    attributes: { HealingPrayers: 12, DivineFavor: 11 },
    tags: ["heal"],
    notes: "Fixture build.",
    favourite: parent === null,
    lastUsed: parent === null ? 1_760_000_000_000 : null,
  });
  const slot = (buildRef: string | null) => ({ build: buildRef, hero: null, behaviour: null });
  await saveBuildLibrary(file("build-library.json"), parseBuildLibrary({
    version: 3,
    tags: ["heal"],
    builds: [build("b1", "Healer", null), build("b2", "Healer, energy variant", "b1")],
    teams: [{
      id: "t1", name: "Fixture team", tags: ["heal"], mode: "none", favourite: false, lastUsed: null, notes: "",
      slots: [slot("b1"), slot("b2"), slot(null), slot(null), slot(null), slot(null), slot(null), slot(null)],
    }],
  }));

  // Accounts metadata: Multiple Accounts mode with one added account, and its
  // shared template library. Credentials live in the Keychain, never here.
  const accounts = await old("accounts");
  // From 1.0.0 the app only reads launcher-mode.json; it never writes one.
  if (accounts.saveAccountMode) await accounts.saveAccountMode(file("launcher-mode.json"), "multi");
  const workspace = accounts.addMultiProfile(accounts.createMultiWorkspace(), {
    id: "11111111-2222-4333-8444-555555555555", name: "Second account", templates: "shared", builds: "shared",
  });
  await accounts.saveMultiWorkspace(file("multi", "workspace.json"), workspace);
  const { saveAccountTemplateLibrary } = await old("templates");
  await saveAccountTemplateLibrary(file("multi", "shared", "templates.json"), {
    revision: 2,
    entries: [{ path: "Monk/Healer.txt", contents: "OwAT043A5RsS8cTHUHeTnQbB" }],
  });

  // launcher-state.json exists from v2026.11.0, the first launcher release.
  const launcherState = await old("launcherState");
  if (launcherState) {
    const { loadOrCreateLauncherState, LauncherStateStore } = launcherState;
    const { document } = await loadOrCreateLauncherState(file("launcher-state.json"), "migrated-single");
    const store = new LauncherStateStore(file("launcher-state.json"), document);
    await store.completeSetup();
    await store.dismissMigrationNotice();
    await store.setSelection([workspace.profiles[0].id]);
    await store.updateAppearance(workspace.profiles[0].id, { icon: "crown", color: "#3366cc" });
    await store.updatePreferences({ content: { dailies: false, officialNews: false, autoRotateNews: false } });
  }

  // The tag must read its own files back without recovery, or they are not
  // what that release could hold.
  await loadSettings(file("settings.json"), () => { throw new Error(`${tag} refused its own settings.json`); });

  await rm(output, { recursive: true, force: true });
  await cp(userData, output, { recursive: true });
  console.log(`wrote ${path.relative(repository, output)}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
