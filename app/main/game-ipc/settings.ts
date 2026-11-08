/**
 * The game window's settings channels: the renderer's own settings reads and
 * writes, and the Hub's Settings page (its snapshot, writes and shortcut capture).
 */
import { errorCode } from "../../shared/errors.js";
import { hubSettingsSnapshot, parseHubSettingsChange } from "../../shared/hub-settings.js";
import { parseShortcutAction } from "../../shared/keyboard-shortcuts.js";
import { parseRendererSettingsPatch } from "../core/settings.js";
import { logEvent } from "../diagnostics.js";
import { channel } from "../ipc-channel-registry.js";
import { nothing, one } from "../ipc-values.js";
import {
  cancelAppShortcutCapture,
  captureLauncherShortcut,
} from "../launcher-shortcut-capture.js";
import { applySettingsChange } from "../settings-actions.js";
import type { GameHandlers, GameIpcInput } from "./part.js";

export default ({ preferences, launcher, currentSettings }: GameIpcInput) => ({
  channels: {
    settingsGet: channel(nothing, async () => {
      try {
        return await preferences.getSettings();
      } catch (error) {
        logEvent({ k: "settings.loadFailed", code: errorCode(error) });
        throw error;
      }
    }),
    settingsSet: channel(one(parseRendererSettingsPatch), (_win, patch) =>
      applySettingsChange(patch, (value) => preferences.write({ kind: "renderer", patch: value }))),
    hubSettingsGet: channel(nothing, () => hubSettingsSnapshot(launcher.snapshot())),
    hubSettingsUpdate: channel(one(parseHubSettingsChange), async (_win, change) => {
      await preferences.write(change);
    }),
    hubShortcutCapture: channel(one(parseShortcutAction), (win, action) =>
      captureLauncherShortcut(win, action, currentSettings)),
    hubShortcutCaptureCancel: channel(nothing, (win) => cancelAppShortcutCapture(win)),
  } satisfies GameHandlers,
});
