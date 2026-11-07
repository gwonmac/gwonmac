// Players install 1.0.0 over a 2026.x app and keep everything (AGENTS.md,
// "Must stay"). tests/fixtures/player-data/<tag>/ holds files that tag's own
// writer code produced; this loads each one through the current loaders. A
// reader that refuses an old value would quarantine the file and reset it to
// defaults, silently, for every upgraded player: here it fails instead.
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { loadAccountTemplateLibrary } from "../../app/main/core/account-template-library.js";
import { loadBuildLibrary } from "../../app/main/core/build-library.js";
import { loadOrCreateLauncherState } from "../../app/main/core/launcher-state.js";
import { loadAccountMode, loadMultiWorkspace } from "../../app/main/core/multiple-accounts.js";
import { loadSettings } from "../../app/main/core/settings.js";
import { loadTravelPreferences } from "../../app/main/core/travel-preferences.js";
import { TravelHistoryStore } from "../../app/features/travel/main/travel-history.js";
import { SETTING_KEYS } from "../../app/shared/settings/index.js";
import type { TravelCharacterKey } from "../../app/shared/travel-history.js";
import { travelShortcutsFromStored } from "../../app/shared/travel.js";

const FIXTURES = "tests/fixtures/player-data";
// Settings the 1.0 clean cut removed on purpose (49da271f, b1caffa2).
const REMOVED_SETTINGS = ["dataStrategy", "teamManagement", "updateTrack"];

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const tags = (await readdir(FIXTURES, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const files = async (root: string) => (await readdir(root, { recursive: true })).sort();
const json = async (file: string): Promise<Record<string, unknown>> => JSON.parse(await readFile(file, "utf8"));

/** Every field the old file stored is still there with the same value. */
function assertKept(loaded: object, stored: Record<string, unknown>, label: string) {
  for (const [key, value] of Object.entries(stored)) {
    assert.deepEqual((loaded as Record<string, unknown>)[key], value, `${label}: ${key}`);
  }
}

describe("player data written by released apps", () => {
  it("has fixtures for both releases players upgrade from", () => {
    assert.deepEqual(tags.sort(), ["v2026.11.0", "v2026.8.12"]);
  });

  for (const tag of tags) {
    it(`${tag}: every file loads with its values and without recovery`, async () => {
      const root = await mkdtemp(join(tmpdir(), "gwonmac-player-data-"));
      roots.push(root);
      await cp(join(FIXTURES, tag), root, { recursive: true });
      const before = await files(root);
      const recovered: string[] = [];
      const onRecovered = (backup: string) => { recovered.push(backup); };

      const { formatVersion, ...storedSettings } = await json(join(root, "settings.json"));
      assert.equal(formatVersion, 1);
      const dropped = Object.keys(storedSettings).filter((key) => !SETTING_KEYS.some((known) => known === key)).sort();
      assert.deepEqual(dropped, REMOVED_SETTINGS.filter((key) => key in storedSettings), "settings the current app no longer reads");
      const kept = Object.fromEntries(Object.entries(storedSettings).filter(([key]) => !dropped.includes(key)));
      const settings = await loadSettings(join(root, "settings.json"), onRecovered);
      assertKept(settings, kept, "settings.json");
      // v2026.8.9 to v2026.8.12 stored Piken Square (pre-Searing) as 778; every
      // file keeps its stored shape and travel reads the official 779.
      assert.deepEqual(travelShortcutsFromStored(settings.travelShortcuts)[0], { mapId: 779 });

      assert.deepEqual(await loadTravelPreferences(join(root, "travel-preferences.json"), onRecovered), {
        formatVersion: 1,
        synonyms: [{ term: "pre", mapId: 779 }, { term: "lion", mapId: 55 }],
      });
      assert.deepEqual(await new TravelHistoryStore(join(root, "travel-history.json")).get("0123456789abcdef" as TravelCharacterKey), [81, 779, 55]);

      assertKept(await loadBuildLibrary(join(root, "build-library.json"), onRecovered), await json(join(root, "build-library.json")), "build-library.json");
      assert.equal(await loadAccountMode(join(root, "launcher-mode.json")), "multi");
      assert.deepEqual(await loadMultiWorkspace(join(root, "multi/workspace.json")), await json(join(root, "multi/workspace.json")));
      assert.deepEqual(await loadAccountTemplateLibrary(join(root, "multi/shared/templates.json")), {
        revision: 2,
        entries: [{ path: "Monk/Healer.txt", contents: "OwAT043A5RsS8cTHUHeTnQbB" }],
      });
      if (before.includes("launcher-state.json")) {
        const stored = await json(join(root, "launcher-state.json"));
        assertKept((await loadOrCreateLauncherState(join(root, "launcher-state.json"), "migrated-single")).document, stored, "launcher-state.json");
      }

      assert.deepEqual(recovered, []);
      // Quarantine and corrupt-copy recovery leave a file beside the original.
      assert.deepEqual(await files(root), before);
    });
  }
});
