/**
 * The launcher window's channels: every channel string, argument tuple and
 * result the launcher preload and main share, declared once.
 * `LauncherNativeApi` (launcher-contracts.ts) types its methods from these
 * entries; main's launcher handlers must answer them (app/main/launcher-ipc.ts).
 */
import type { CacheInfo } from "../contracts.js";
import type { ShortcutAction } from "../keyboard-shortcuts.js";
import type {
  GlobalToolUpdate,
  LauncherDestination,
  LauncherExternalLink,
  LauncherFeedback,
  LauncherPreferencesPatch,
  LauncherProfileCreateInput,
  LauncherProfileUpdate,
  LauncherSettingsPatch,
  LauncherShortcutCaptureResult,
  LauncherSnapshot,
  ShortcutReplacement,
} from "../launcher-contracts.js";
import type { ProfileId } from "../multiple-accounts.js";
import type { TexturePackImportResult } from "../texture-packs.js";
import { event, invoke } from "./channel-table.js";

export const LAUNCHER_CHANNELS = {
  stateGet: invoke<[], LauncherSnapshot>("gw:launcher:state:get"),
  stateEvent: event<[snapshot: LauncherSnapshot]>("gw:launcher:state:event"),
  navigationEvent: event<[destination: LauncherDestination]>("gw:launcher:navigation:event"),
  profilesCreate: invoke<[input: LauncherProfileCreateInput], void>("gw:launcher:profiles:create"),
  profilesUpdate: invoke<[input: LauncherProfileUpdate], void>("gw:launcher:profiles:update"),
  profilesSetSelection: invoke<[ids: readonly ProfileId[]], void>("gw:launcher:profiles:setSelection"),
  profilesPlay: invoke<[ids: readonly ProfileId[]], void>("gw:launcher:profiles:play"),
  profilesShow: invoke<[id: ProfileId], void>("gw:launcher:profiles:show"),
  profilesCancelQueued: invoke<[ids: readonly ProfileId[]], void>("gw:launcher:profiles:cancelQueued"),
  profilesArchive: invoke<[id: ProfileId], void>("gw:launcher:profiles:archive"),
  profilesRestore: invoke<[id: ProfileId], void>("gw:launcher:profiles:restore"),
  profilesDelete: invoke<[id: ProfileId], void>("gw:launcher:profiles:delete"),
  experienceDismissMigration: invoke<[], void>("gw:launcher:experience:dismissMigration"),
  experienceDismissPreferencesReset: invoke<[], void>("gw:launcher:experience:dismissPreferencesReset"),
  experienceCompleteSetup: invoke<[input: { readonly enableTools: boolean }], void>("gw:launcher:experience:completeSetup"),
  experienceUpdatePreferences: invoke<[patch: LauncherPreferencesPatch], void>("gw:launcher:experience:updatePreferences"),
  settingsUpdate: invoke<[patch: LauncherSettingsPatch], void>("gw:launcher:settings:update"),
  settingsReset: invoke<[], void>("gw:launcher:settings:reset"),
  toolsSetMasterEnabled: invoke<[enabled: boolean], void>("gw:launcher:tools:setMasterEnabled"),
  toolsSetFeature: invoke<[input: GlobalToolUpdate], void>("gw:launcher:tools:setFeature"),
  toolsCaptureShortcut: invoke<[action: ShortcutAction], LauncherShortcutCaptureResult>("gw:launcher:tools:captureShortcut"),
  toolsReplaceShortcut: invoke<[input: ShortcutReplacement], void>("gw:launcher:tools:replaceShortcut"),
  toolsRestartToApply: invoke<[], void>("gw:launcher:tools:restartToApply"),
  gameFilesInfo: invoke<[], CacheInfo>("gw:launcher:gameFiles:info"),
  gameFilesRepair: invoke<[], void>("gw:launcher:gameFiles:repair"),
  gameFilesPauseDownload: invoke<[], void>("gw:launcher:gameFiles:pauseDownload"),
  gameFilesResumeDownload: invoke<[], void>("gw:launcher:gameFiles:resumeDownload"),
  gameFilesResetAndRestart: invoke<[], void>("gw:launcher:gameFiles:resetAndRestart"),
  newsOpen: invoke<[id: string], void>("gw:launcher:news:open"),
  texturePacksImport: invoke<[], TexturePackImportResult>("gw:launcher:texturePacks:import"),
  texturePacksSelect: invoke<[id: string | null], void>("gw:launcher:texturePacks:select"),
  texturePacksRemove: invoke<[id: string], void>("gw:launcher:texturePacks:remove"),
  feedbackSend: invoke<[input: LauncherFeedback], void>("gw:launcher:feedback:send"),
  externalOpen: invoke<[kind: LauncherExternalLink], void>("gw:launcher:external:open"),
  externalOpenUrl: invoke<[url: string], void>("gw:launcher:external:openUrl"),
  externalRevealLogs: invoke<[], void>("gw:launcher:external:revealLogs"),
  updatesCheck: invoke<[], void>("gw:launcher:updates:check"),
  updatesRestartAndInstall: invoke<[], void>("gw:launcher:updates:restartAndInstall"),
} as const;

export type LauncherChannels = typeof LAUNCHER_CHANNELS;
