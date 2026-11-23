import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  LauncherStateStore,
  classifyLauncherInstallation,
  loadOrCreateLauncherState,
} from "../../app/main/core/launcher-state.ts";
import { parseProfileId } from "../../app/shared/multiple-accounts.ts";
import {
  parseLauncherExternalLink,
  parseLauncherPreferencesPatch,
  parseLauncherProfileAppearance,
  parseLauncherSettingsPatch,
} from "../../app/shared/launcher-contracts.ts";
import { DEFAULT_CUSTOM_UI_THEME } from "../../app/shared/ui-theme.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "gw-launcher-state-"));
  roots.push(root);
  return join(root, "launcher-state.json");
}

describe("launcher presentation state", () => {
  it("persists the starting page across content changes and restart", async () => {
    const path = await fixture();
    const loaded = await loadOrCreateLauncherState(path, "migrated-multi");
    const store = new LauncherStateStore(path, loaded.document);
    await store.updatePreferences(parseLauncherPreferencesPatch({ lastPlayPage: "accounts" }));
    await store.updatePreferences({ content: { autoRotateNews: false } });
    const restarted = await loadOrCreateLauncherState(path, "migrated-multi");
    assert.equal(restarted.document.preferences.lastPlayPage, "accounts");
    assert.equal(restarted.document.preferences.content.autoRotateNews, false);
    assert.throws(() => parseLauncherPreferencesPatch({ lastPlayPage: "settings" }));
  });

  it("validates account appearance before profile creation", () => {
    assert.deepEqual(parseLauncherProfileAppearance({ icon: "map", color: "#496b58" }), { icon: "map", color: "#496b58" });
    assert.throws(() => parseLauncherProfileAppearance({ icon: "url", color: "#496b58" }));
    assert.throws(() => parseLauncherProfileAppearance({ icon: "map", color: "red" }));
    assert.throws(() => parseLauncherProfileAppearance({ icon: "map", color: "#496b58", extra: true }));
  });
  it("accepts valid launcher settings patches unchanged", () => {
    const accepted: Record<string, Record<string, unknown>> = {
      "render quality": { renderScale: 1.5 },
      "independent Compass grid": { cartographyCompassGridEnabled: true },
      "Elite Skills": { eliteMissionMapMarkers: "all" },
      "Compass range": {
        compassRangeCastEnabled: false,
        compassRangeCastOpacity: 62,
        compassRangeTheme: "monochrome",
      },
      "restored appearance": {
        uiStyle: "custom", uiFont: "inter", uiPanelOpacity: 80,
        controllerPromptStyle: "playstation", uiCustomTheme: DEFAULT_CUSTOM_UI_THEME,
      },
      "customization": {
        characterSwitchLocation: false, autoRelogAfterReload: true,
        skillCooldownColor: { kind: "custom", value: "#123456" },
      },
    };
    for (const [name, patch] of Object.entries(accepted)) {
      assert.deepEqual(parseLauncherSettingsPatch(patch), patch, name);
    }
  });

  it("refuses invalid launcher settings, including feature switches on the generic channel", () => {
    const invalidPatches = [
      { renderScale: 3 },
      { cartographyCompassGridEnabled: 1 },
      { eliteSkillsEnabled: 0 }, { eliteMissionMapMarkers: "boss" },
      { compassRangeCastEnabled: 1 }, { compassRangeCastOpacity: 101 },
      { compassRangeCastOpacity: 62.5 }, { compassRangeTheme: "sepia" },
      { uiStyle: "unknown" }, { uiFont: "url(https://example.com)" },
      { controllerPromptStyle: "unknown" }, { uiPanelOpacity: 64 },
      { uiPanelOpacity: 101 }, { uiPanelOpacity: 80.5 },
      { uiPanelOpacity: "80" }, { uiCustomTheme: {} },
      { uiCustomTheme: { ...DEFAULT_CUSTOM_UI_THEME, accent: "red" } },
      { uiCustomTheme: { ...DEFAULT_CUSTOM_UI_THEME, extra: true } },
      { characterSwitchLocation: "false" }, { cartographyGridEnabled: true },
      { characterSwitchEnabled: false }, { skillKeyBindings: [] },
      { skillCooldownColor: { kind: "custom", value: "red" } },
    ];
    const accepted = invalidPatches.filter((patch) => {
      try {
        parseLauncherSettingsPatch(patch);
        return true;
      } catch {
        return false;
      }
    });
    assert.deepEqual(accepted, []);
  });
  it("accepts the official support destination on the launcher boundary", () => {
    assert.equal(parseLauncherExternalLink("arenaNetSupport"), "arenaNetSupport");
    assert.throws(() => parseLauncherExternalLink("https://example.com"));
  });
  it("validates customization without accepting feature switches on the generic settings channel", () => {
    assert.deepEqual(parseLauncherSettingsPatch({ characterSwitchLocation: false, autoRelogAfterReload: true, skillCooldownColor: { kind: "custom", value: "#123456" } }), {
      characterSwitchLocation: false, autoRelogAfterReload: true, skillCooldownColor: { kind: "custom", value: "#123456" },
    });
    for (const invalid of [
      { characterSwitchLocation: "false" }, { cartographyGridEnabled: true },
      { characterSwitchEnabled: false }, { skillKeyBindings: [] },
      { skillCooldownColor: { kind: "custom", value: "red" } },
    ]) assert.throws(() => parseLauncherSettingsPatch(invalid));
  });
  it("classifies every supported starting state before account bootstrap", () => {
    assert.equal(classifyLauncherInstallation({ legacySingleData: false, existingWorkspace: false }), "fresh");
    assert.equal(classifyLauncherInstallation({ legacySingleData: true, existingWorkspace: false }), "migrated-single");
    assert.equal(classifyLauncherInstallation({ legacySingleData: false, existingWorkspace: true }), "migrated-multi");
    assert.equal(classifyLauncherInstallation({ legacySingleData: true, existingWorkspace: true }), "mixed");
  });

  it("creates fresh setup state once and reloads it idempotently", async () => {
    const path = await fixture();
    const first = await loadOrCreateLauncherState(path, "fresh");
    const second = await loadOrCreateLauncherState(path, "migrated-single");
    assert.equal(first.document.installationKind, "fresh");
    assert.equal(first.document.setupVersion, 0);
    assert.deepEqual(first.document.preferences.content, {
      news: true,
      dailies: true,
      first: "news",
      officialNews: true,
      reforgedNews: true,
      eventNews: true,
      autoRotateNews: true,
    });
    assert.deepEqual(second.document, first.document);
  });

  it("keeps the simple launcher off until the player turns it on, across restart", async () => {
    const path = await fixture();
    const loaded = await loadOrCreateLauncherState(path, "fresh");
    assert.equal(loaded.document.preferences.content.simple, undefined);
    const store = new LauncherStateStore(path, loaded.document);
    await store.updatePreferences(parseLauncherPreferencesPatch({ content: { simple: true } }));
    const restarted = await loadOrCreateLauncherState(path, "fresh");
    assert.equal(restarted.document.preferences.content.simple, true);
    assert.equal(restarted.document.preferences.content.news, true);
    assert.throws(() => parseLauncherPreferencesPatch({ content: { simple: "yes" } }));
  });

  it("accepts candidate format-1 state written before durable reset notices", async () => {
    const path = await fixture();
    const created = await loadOrCreateLauncherState(path, "migrated-single");
    const earlierFormatOne: Record<string, unknown> = { ...created.document };
    delete earlierFormatOne.preferencesResetPending;
    await writeFile(path, JSON.stringify(earlierFormatOne));

    const loaded = await loadOrCreateLauncherState(path, "fresh");

    assert.equal(loaded.document.installationKind, "migrated-single");
    assert.equal(loaded.document.preferencesResetPending, false);
    assert.equal(
      (await readdir(join(path, ".."))).some((name) =>
        name.startsWith("launcher-state.json.corrupt-")),
      false,
    );
  });

  it("skips forced setup and preserves corrupt bytes when classification is uncertain", async () => {
    const path = await fixture();
    const corruptBytes = Buffer.from([0xff, 0x00, 0x7b, 0x0a]);
    await writeFile(path, corruptBytes);
    const loaded = await loadOrCreateLauncherState(path, "fresh");
    assert.equal(loaded.document.preferencesResetPending, true);
    assert.equal(loaded.document.installationKind, "migrated-single");
    assert.equal(loaded.document.setupVersion, 1);
    const names = await readdir(join(path, ".."));
    const backup = names.find((name) => name.startsWith("launcher-state.json.corrupt-"));
    assert.ok(backup);
    assert.deepEqual(await readFile(join(path, "..", backup)), corruptBytes);

    const restarted = await loadOrCreateLauncherState(path, "fresh");
    assert.equal(restarted.document.installationKind, "migrated-single");
    assert.equal(restarted.document.setupVersion, 1);
    assert.equal(restarted.document.preferencesResetPending, true);

    const store = new LauncherStateStore(
      path,
      restarted.document,
    );
    await store.dismissPreferencesReset();
    const acknowledged = await loadOrCreateLauncherState(path, "fresh");
    assert.equal(acknowledged.document.preferencesResetPending, false);
    assert.equal(acknowledged.document.migrationNoticeDismissed, false);
  });

  it("normalizes remembered selection and Home order, and serializes concurrent changes", async () => {
    const path = await fixture();
    const loaded = await loadOrCreateLauncherState(path, "migrated-multi");
    const store = new LauncherStateStore(path, loaded.document);
    const id = parseProfileId("ba46cb0e-55c2-4c05-9808-5c35ce83b0b0");
    await store.setSelection([id, id]);
    await store.updatePreferences({ content: { news: false, dailies: true, first: "news" } });
    assert.deepEqual(store.get().selectedProfileIds, [id]);
    assert.equal(store.get().preferences.content.first, "dailies");

    const other = parseProfileId("2d31e565-9fc8-4dde-9fd4-9d644f8283ae");
    await Promise.all([
      store.setSelection([other]),
      store.updatePreferences({ content: { dailies: false } }),
    ]);
    assert.deepEqual(store.get().selectedProfileIds, [other]);
    assert.equal(store.get().preferences.content.dailies, false);
  });

  it("persists setup and validated appearance", async () => {
    const path = await fixture();
    const loaded = await loadOrCreateLauncherState(path, "fresh");
    const store = new LauncherStateStore(path, loaded.document);
    const id = parseProfileId("ba46cb0e-55c2-4c05-9808-5c35ce83b0b0");
    await store.completeSetup();
    await store.updateAppearance(id, { icon: "archive", color: "#496b58" });
    assert.equal(store.get().setupVersion, 1);
    assert.deepEqual(store.appearance(id), { icon: "archive", color: "#496b58" });
    await assert.rejects(store.updateAppearance(id, { icon: "archive", color: "red" }));
  });
});
