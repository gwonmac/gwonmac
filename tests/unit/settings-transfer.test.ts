/** Copy settings and Paste settings carry a player's setup as text, and nothing that belongs to one Mac. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, type AppSettings } from "../../app/shared/settings/index.js";
import { DEFAULT_LAUNCHER_PREFERENCES } from "../../app/main/core/launcher-state.js";
import { settingsFromText, settingsToText } from "../../app/main/core/settings-transfer.js";

const mine: AppSettings = {
  ...DEFAULT_SETTINGS,
  gwonmacTools: true,
  targetReadout: true,
  disableSteamLogin: true,
  renderScale: DEFAULT_SETTINGS.renderScale,
  lastUpdateCheckAt: 1_700_000_000_000,
  overlayPlacement: { compassButtons: false, compassOffset: { x: 12, y: -8 }, targetDistance: { corner: "top-right", x: 20, y: 40 } },
};
const content = { ...DEFAULT_LAUNCHER_PREFERENCES.content, simple: true, dailies: false };

test("copied settings come back as the same choices", () => {
  const { settings, launcherContent, skipped } = settingsFromText(settingsToText(mine, content));
  assert.equal(settings.gwonmacTools, true);
  assert.equal(settings.targetReadout, true);
  assert.equal(settings.disableSteamLogin, true);
  assert.deepEqual(settings.overlayPlacement, mine.overlayPlacement);
  assert.deepEqual(launcherContent, content);
  assert.deepEqual(skipped, []);
});

test("what belongs to one Mac is never copied and never applied", () => {
  const text = settingsToText(mine, content);
  for (const name of ["lastUpdateCheckAt", "compatibilityNoticeSeenFor", "travelShortcuts", "username", "password"]) {
    assert.equal(text.includes(`"${name}"`), false, name);
  }
  const forged = JSON.parse(text) as { settings: Record<string, unknown> };
  forged.settings.compatibilityNoticeSeenFor = "a".repeat(64);
  forged.settings.lastUpdateCheckAt = 5;
  const { settings, skipped } = settingsFromText(JSON.stringify(forged));
  assert.equal("compatibilityNoticeSeenFor" in settings, false);
  assert.equal("lastUpdateCheckAt" in settings, false);
  assert.deepEqual([...skipped].sort(), ["compatibilityNoticeSeenFor", "lastUpdateCheckAt"]);
});

test("a name this build does not use is left out and reported, and the rest still applies", () => {
  const newer = JSON.parse(settingsToText(mine, content)) as { settings: Record<string, unknown> };
  newer.settings.someFutureSwitch = true;
  const { settings, skipped } = settingsFromText(JSON.stringify(newer));
  assert.deepEqual(skipped, ["someFutureSwitch"]);
  assert.equal(settings.targetReadout, true);
});

test("text that is not copied settings, or holds a malformed value, is refused whole", () => {
  for (const text of ["", "hello", "[]", "{}", JSON.stringify({ kind: "other", version: 1, settings: {} }),
    JSON.stringify({ kind: "gwonmac-settings", version: 2, settings: {} }),
    JSON.stringify({ kind: "gwonmac-settings", version: 1 })]) {
    assert.throws(() => settingsFromText(text), JSON.stringify(text));
  }
  const bad = JSON.parse(settingsToText(mine, content)) as { settings: Record<string, unknown>; launcherContent: Record<string, unknown> };
  bad.settings.targetReadout = "yes";
  assert.throws(() => settingsFromText(JSON.stringify(bad)));
  const badContent = JSON.parse(settingsToText(mine, content)) as { launcherContent: Record<string, unknown> };
  badContent.launcherContent.simple = "yes";
  assert.throws(() => settingsFromText(JSON.stringify(badContent)));
});

test("settings copied without launcher choices leave the launcher's alone", () => {
  const withoutLauncher = JSON.parse(settingsToText(mine, content)) as Record<string, unknown>;
  delete withoutLauncher.launcherContent;
  assert.equal(settingsFromText(JSON.stringify(withoutLauncher)).launcherContent, null);
});
