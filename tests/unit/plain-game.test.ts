/** The plain game is stored as the two masters it turned off, and never travels between Macs as a mode. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, type AppSettings } from "../../app/shared/settings/index.js";
import { parseHubSettingsChange } from "../../app/shared/hub-settings.js";
import { parseLauncherSettingsPatch } from "../../app/shared/launcher-contracts.js";
import { DEFAULT_LAUNCHER_PREFERENCES } from "../../app/main/core/launcher-state.js";
import { parseRendererSettingsPatch, parseSettings } from "../../app/main/core/settings.js";
import { settingsFromText, settingsToText } from "../../app/main/core/settings-transfer.js";

const remembered = { gwonmacTools: true, characterSwitchEnabled: true };
const plain: AppSettings = { ...DEFAULT_SETTINGS, gwonmacTools: false, characterSwitchEnabled: false, plainGame: remembered };

test("the plain game is off by default", () => {
  assert.equal(DEFAULT_SETTINGS.plainGame, null);
});

test("settings read the remembered masters and refuse another shape", () => {
  assert.deepEqual(parseSettings(plain).plainGame, remembered);
  assert.equal(parseSettings({ ...plain, plainGame: null }).plainGame, null);
  for (const bad of [true, "on", [], {}, { gwonmacTools: true }, { ...remembered, extra: 1 }, { gwonmacTools: 1, characterSwitchEnabled: true }]) {
    assert.throws(() => parseSettings({ ...plain, plainGame: bad }), JSON.stringify(bad));
  }
});

test("only its own launcher command changes it: no settings patch from the launcher page or a game window can", () => {
  assert.throws(() => parseLauncherSettingsPatch({ plainGame: remembered }));
  assert.throws(() => parseLauncherSettingsPatch({ plainGame: null }));
  assert.throws(() => parseRendererSettingsPatch({ plainGame: null }));
  assert.throws(() => parseHubSettingsChange({ kind: "settings", patch: { plainGame: null } }));
});

test("copied settings carry the masters a player chose, not the mode", () => {
  const text = settingsToText(plain, DEFAULT_LAUNCHER_PREFERENCES.content);
  assert.equal(text.includes('"plainGame"'), false);
  const { settings } = settingsFromText(text);
  assert.equal(settings.gwonmacTools, true);
  assert.equal(settings.characterSwitchEnabled, true);
  assert.equal("plainGame" in settings, false);
});
