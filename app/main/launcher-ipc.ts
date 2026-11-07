/**
 * Registers only the unified launcher's validated IPC commands. The dedicated
 * preload exposes this vocabulary; game preloads never receive these methods.
 */
import type { BrowserWindow } from "electron";
import type {
  LauncherShortcutCaptureResult,
  LauncherSnapshot,
  LauncherPreferencesPatch,
  LauncherExternalLink,
  LauncherFeedback,
  LauncherProfileCreateInput,
  LauncherInvokeChannel,
  LauncherProfileUpdate,
  SettingsWrite,
} from "../shared/launcher-contracts.js";
import {
  parseGlobalToolUpdate,
  parseLauncherExternalLink,
  parseLauncherGuideUrl,
  parseLauncherFeedback,
  parseLauncherNewsId,
  parseLauncherProfileAppearance,
  parseLauncherPreferencesPatch,
  parseLauncherSettingsPatch,
  parseShortcutReplacement,
} from "../shared/launcher-contracts.js";
import type { CacheInfo } from "../shared/contracts.js";
import { parseShortcutAction, type ShortcutAction } from "../shared/keyboard-shortcuts.js";
import {
  parseProfileId,
  parseProfileName,
  type ProfileId,
} from "../shared/multiple-accounts.js";
import { parseProfileIds } from "./accounts-ipc-values.js";
import { channel, register, type AnyChannelDef } from "./ipc-channel-registry.js";
import { nothing, one } from "./ipc-values.js";
import type { WindowRegistry } from "./window-registry.js";
import { parseTexturePackId, type TexturePackImportResult } from "../shared/texture-packs.js";

export interface LauncherIpcContext {
  readonly windows: WindowRegistry;
  readonly connected: () => void;
  readonly snapshot: () => LauncherSnapshot;
  readonly create: (input: LauncherProfileCreateInput) => Promise<void>;
  readonly updateProfile: (input: LauncherProfileUpdate) => Promise<void>;
  readonly setSelection: (ids: readonly ProfileId[]) => Promise<void>;
  readonly play: (ids: readonly ProfileId[]) => Promise<void>;
  readonly show: (id: ProfileId) => Promise<void>;
  readonly cancelQueued: (ids: readonly ProfileId[]) => void;
  readonly archive: (id: ProfileId) => Promise<void>;
  readonly restore: (id: ProfileId) => Promise<void>;
  readonly delete: (win: BrowserWindow, id: ProfileId) => Promise<void>;
  readonly dismissMigrationNotice: () => Promise<void>;
  readonly dismissPreferencesReset: () => Promise<void>;
  readonly completeSetup: (enableTools: boolean) => Promise<void>;
  readonly updatePreferences: (patch: LauncherPreferencesPatch) => Promise<void>;
  readonly writeSettings: (change: SettingsWrite) => Promise<void>;
  readonly resetSettings: (win: BrowserWindow) => Promise<void>;
  readonly captureShortcut: (win: BrowserWindow, action: ShortcutAction) => Promise<LauncherShortcutCaptureResult>;
  readonly restartToApplyTools: (win: BrowserWindow) => Promise<void>;
  readonly cacheInfo: () => Promise<CacheInfo>;
  readonly repairGameFiles: (win: BrowserWindow) => Promise<void>;
  readonly pauseDownload: () => Promise<void>;
  readonly resumeDownload: () => Promise<void>;
  readonly resetGameFiles: (win: BrowserWindow) => Promise<void>;
  readonly importTexturePack: (win: BrowserWindow) => Promise<TexturePackImportResult>;
  readonly selectTexturePack: (id: string | null) => Promise<void>;
  readonly removeTexturePack: (win: BrowserWindow, id: string) => Promise<void>;
  readonly sendFeedback: (feedback: LauncherFeedback) => Promise<void>;
  readonly openExternal: (kind: LauncherExternalLink) => Promise<void>;
  readonly openUrl: (url: string) => Promise<void>;
  readonly openNews: (id: string) => Promise<void>;
  readonly revealLogs: () => void;
  readonly checkUpdates: () => Promise<void>;
  readonly restartAndInstall: (win: BrowserWindow) => Promise<void>;
}

const profileIds = one(parseProfileIds);
const profileId = one(parseProfileId);
const profileCreate = one((value: unknown): LauncherProfileCreateInput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("profile request must be an object");
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !["name", "appearance"].includes(key))) throw new Error("profile request has an unknown field");
  const name = parseProfileName(source.name);
  if (source.appearance === undefined) return { name };
  return { name, appearance: parseLauncherProfileAppearance(source.appearance) };
});
const booleanValue = one((value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error("value must be a boolean");
  return value;
});
const nullableTexturePackId = one((value: unknown): string | null =>
  value === null ? null : parseTexturePackId(value));
const setup = one((value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("setup request must be an object");
  const source = value as Record<string, unknown>;
  if (Object.keys(source).length !== 1 || typeof source.enableTools !== "boolean") throw new Error("setup request is invalid");
  return source.enableTools;
});
const profileUpdate = one((value: unknown): LauncherProfileUpdate => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("profile update must be an object");
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !["id", "name", "icon", "color"].includes(key))) throw new Error("profile update has an unknown field");
  const id = parseProfileId(source.id);
  const name = parseProfileName(source.name);
  const appearance = parseLauncherProfileAppearance({ icon: source.icon, color: source.color });
  return { id, name, ...appearance };
});
export function registerLauncherIpc(ctx: LauncherIpcContext): void {
  const connected = new WeakSet<BrowserWindow>();
  register(ctx.windows, "launcher", {
    stateGet: channel(nothing, (win) => {
      if (!connected.has(win)) {
        connected.add(win);
        ctx.connected();
      }
      return ctx.snapshot();
    }),
    profilesCreate: channel(profileCreate, (_win, input) => ctx.create(input)),
    profilesUpdate: channel(profileUpdate, (_win, input) => ctx.updateProfile(input)),
    profilesSetSelection: channel(profileIds, (_win, ids) => ctx.setSelection(ids)),
    profilesPlay: channel(profileIds, (_win, ids) => ctx.play(ids)),
    profilesShow: channel(profileId, (_win, id) => ctx.show(id)),
    profilesCancelQueued: channel(profileIds, (_win, ids) => ctx.cancelQueued(ids)),
    profilesArchive: channel(profileId, (_win, id) => ctx.archive(id)),
    profilesRestore: channel(profileId, (_win, id) => ctx.restore(id)),
    profilesDelete: channel(profileId, (win, id) => ctx.delete(win, id)),
    experienceDismissMigration: channel(nothing, () => ctx.dismissMigrationNotice()),
    experienceDismissPreferencesReset: channel(nothing, () => ctx.dismissPreferencesReset()),
    experienceCompleteSetup: channel(setup, (_win, enableTools) => ctx.completeSetup(enableTools)),
    experienceUpdatePreferences: channel(one(parseLauncherPreferencesPatch), (_win, patch) => ctx.updatePreferences(patch)),
    settingsUpdate: channel(one(parseLauncherSettingsPatch), (_win, patch) => ctx.writeSettings({ kind: "settings", patch })),
    settingsReset: channel(nothing, (win) => ctx.resetSettings(win)),
    toolsSetMasterEnabled: channel(booleanValue, (_win, enabled) => ctx.writeSettings({ kind: "master", enabled })),
    toolsSetFeature: channel(one(parseGlobalToolUpdate), (_win, input) => ctx.writeSettings({ kind: "tool", ...input })),
    toolsCaptureShortcut: channel(one(parseShortcutAction), (win, action) => ctx.captureShortcut(win, action)),
    toolsReplaceShortcut: channel(one(parseShortcutReplacement), (_win, input) => ctx.writeSettings({ kind: "shortcut", ...input })),
    toolsRestartToApply: channel(nothing, (win) => ctx.restartToApplyTools(win)),
    gameFilesInfo: channel(nothing, () => ctx.cacheInfo()),
    gameFilesRepair: channel(nothing, (win) => ctx.repairGameFiles(win)),
    gameFilesPauseDownload: channel(nothing, () => ctx.pauseDownload()),
    gameFilesResumeDownload: channel(nothing, () => ctx.resumeDownload()),
    gameFilesResetAndRestart: channel(nothing, (win) => ctx.resetGameFiles(win)),
    newsOpen: channel(one(parseLauncherNewsId), (_win, id) => ctx.openNews(id)),
    texturePacksImport: channel(nothing, (win) => ctx.importTexturePack(win)),
    texturePacksSelect: channel(nullableTexturePackId, (_win, id) => ctx.selectTexturePack(id)),
    texturePacksRemove: channel(one(parseTexturePackId), (win, id) => ctx.removeTexturePack(win, id)),
    feedbackSend: channel(one(parseLauncherFeedback), (_win, feedback) => ctx.sendFeedback(feedback)),
    externalOpen: channel(one(parseLauncherExternalLink), (_win, kind) => ctx.openExternal(kind)),
    externalOpenUrl: channel(one(parseLauncherGuideUrl), (_win, url) => ctx.openUrl(url)),
    externalRevealLogs: channel(nothing, () => ctx.revealLogs()),
    updatesCheck: channel(nothing, () => ctx.checkUpdates()),
    updatesRestartAndInstall: channel(nothing, (win) => ctx.restartAndInstall(win)),
  } satisfies Record<LauncherInvokeChannel, AnyChannelDef>);
}
