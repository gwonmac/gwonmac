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
  uiStyle: "obsidian",
  alcoholTimerPosition: { corner: "bottom-right", x: 12, y: 30, locked: true },
  lastUpdateCheckAt: 1_700_000_000_000,
  compatibilityNoticeSeenFor: "a".repeat(64),
  travelShortcuts: DEFAULT_SETTINGS.travelShortcuts,
};
const content = { ...DEFAULT_LAUNCHER_PREFERENCES.content, dailies: false };
type Copied = { settings: Record<string, unknown>; launcherContent: Record<string, unknown> };
const copied = (): Copied => JSON.parse(settingsToText(mine, content)) as Copied;

function transfer(text: string) {
  const read = settingsFromText(text);
  assert.ok(read.ok, `refused: ${read.ok ? "" : read.reason}`);
  return read.transfer;
}

test("copied settings come back as the same choices", () => {
  const { settings, launcherContent, skipped } = transfer(settingsToText(mine, content));
  assert.equal(settings.targetReadout, true);
  assert.equal(settings.uiStyle, "obsidian");
  assert.deepEqual(settings.alcoholTimerPosition, mine.alcoholTimerPosition);
  assert.deepEqual(launcherContent, content);
  assert.deepEqual(skipped, []);
});

test("the launch mode and what belongs to one Mac are never copied and never applied", () => {
  const local = ["gwonmacTools", "lastUpdateCheckAt", "compatibilityNoticeSeenFor", "travelShortcuts"];
  const text = copied();
  for (const name of local) assert.equal(name in text.settings, false, name);
  // Text written by hand, or by another tool, still cannot set them.
  text.settings.gwonmacTools = true;
  text.settings.lastUpdateCheckAt = 5;
  text.settings.compatibilityNoticeSeenFor = "b".repeat(64);
  text.settings.travelShortcuts = DEFAULT_SETTINGS.travelShortcuts;
  const { settings, skipped } = transfer(JSON.stringify(text));
  for (const name of local) assert.equal(name in settings, false, name);
  assert.deepEqual([...skipped].sort(), [...local].sort());
});

test("a name this build does not use is left out and reported, and the rest still applies", () => {
  const newer = copied();
  newer.settings.someFutureSwitch = true;
  newer.launcherContent.someFutureChoice = true;
  const { settings, launcherContent, skipped } = transfer(JSON.stringify(newer));
  assert.deepEqual(skipped, ["someFutureSwitch", "launcherContent.someFutureChoice"]);
  assert.equal(settings.targetReadout, true);
  assert.deepEqual(launcherContent, content);
});

test("text that is not readable copied settings is refused whole, with the reason", () => {
  const malformedSetting = copied();
  malformedSetting.settings.targetReadout = "yes";
  const malformedContent = copied();
  malformedContent.launcherContent.dailies = "no";
  const cases: readonly (readonly [string, string])[] = [
    ["", "not-settings"],
    ["hello", "not-settings"],
    ["[]", "not-settings"],
    [JSON.stringify({ kind: "other", version: 1, settings: {} }), "not-settings"],
    [" ".repeat(4 * 1024 * 1024 + 1), "not-settings"],
    [JSON.stringify({ kind: "gwonmac-settings", version: 2, settings: {} }), "other-version"],
    [JSON.stringify({ kind: "gwonmac-settings", version: 1 }), "damaged"],
    [JSON.stringify({ kind: "gwonmac-settings", version: 1, settings: {}, launcherContent: [] }), "damaged"],
    [JSON.stringify(malformedSetting), "damaged"],
    [JSON.stringify(malformedContent), "damaged"],
  ];
  for (const [text, reason] of cases) {
    assert.deepEqual(settingsFromText(text), { ok: false, reason }, text.slice(0, 60));
  }
});

test("settings copied without launcher choices leave the launcher's alone", () => {
  const withoutLauncher = copied() as Partial<Copied>;
  delete withoutLauncher.launcherContent;
  assert.equal(transfer(JSON.stringify(withoutLauncher)).launcherContent, null);
});
