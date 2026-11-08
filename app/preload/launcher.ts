// The launcher's deliberately small sandbox bridge. Built to
// build/preload/preload-launcher.cjs; every channel comes from the launcher
// channel table (app/shared/ipc/launcher.ts), bundled in, so there is no
// parallel IPC list.
import { contextBridge } from "electron";
import { LAUNCHER_CHANNELS } from "../shared/ipc/launcher.js";
import type { LauncherNativeApi } from "../shared/launcher-contracts.js";
import { ipcBridge } from "./ipc-bridge.js";

const invoke = ipcBridge.invoker(LAUNCHER_CHANNELS);
const listen = ipcBridge.listener(LAUNCHER_CHANNELS);

const launcherApi: LauncherNativeApi = {
  navigation: {
    onRequest: (callback) => listen("navigationEvent", callback),
  },
  state: {
    get: () => invoke("stateGet"),
    onChange: (callback) => listen("stateEvent", callback),
  },
  profiles: {
    create: (input) => invoke("profilesCreate", input),
    update: (input) => invoke("profilesUpdate", input),
    setSelection: (ids) => invoke("profilesSetSelection", ids),
    play: (ids) => invoke("profilesPlay", ids),
    show: (id) => invoke("profilesShow", id),
    cancelQueued: (ids) => invoke("profilesCancelQueued", ids),
    archive: (id) => invoke("profilesArchive", id),
    restore: (id) => invoke("profilesRestore", id),
    delete: (id) => invoke("profilesDelete", id),
  },
  experience: {
    completeSetup: (input) => invoke("experienceCompleteSetup", input),
    dismissMigrationNotice: () => invoke("experienceDismissMigration"),
    dismissPreferencesReset: () => invoke("experienceDismissPreferencesReset"),
    updatePreferences: (patch) => invoke("experienceUpdatePreferences", patch),
  },
  settings: {
    update: (patch) => invoke("settingsUpdate", patch),
    reset: () => invoke("settingsReset"),
  },
  tools: {
    setMasterEnabled: (enabled) => invoke("toolsSetMasterEnabled", enabled),
    setFeature: (input) => invoke("toolsSetFeature", input),
    captureShortcut: (tool) => invoke("toolsCaptureShortcut", tool),
    replaceShortcut: (input) => invoke("toolsReplaceShortcut", input),
    restartToApply: () => invoke("toolsRestartToApply"),
  },
  gameFiles: {
    info: () => invoke("gameFilesInfo"),
    repair: () => invoke("gameFilesRepair"),
    pauseDownload: () => invoke("gameFilesPauseDownload"),
    resumeDownload: () => invoke("gameFilesResumeDownload"),
    resetAndRestart: () => invoke("gameFilesResetAndRestart"),
  },
  news: {
    open: (id) => invoke("newsOpen", id),
  },
  texturePacks: {
    import: () => invoke("texturePacksImport"),
    select: (id) => invoke("texturePacksSelect", id),
    remove: (id) => invoke("texturePacksRemove", id),
  },
  feedback: {
    send: (input) => invoke("feedbackSend", input),
  },
  external: {
    open: (kind) => invoke("externalOpen", kind),
    openUrl: (url) => invoke("externalOpenUrl", url),
    revealLogs: () => invoke("externalRevealLogs"),
  },
  updates: {
    check: () => invoke("updatesCheck"),
    restartAndInstall: () => invoke("updatesRestartAndInstall"),
  },
};

for (const namespace of Object.values(launcherApi)) Object.freeze(namespace);
Object.freeze(launcherApi);
contextBridge.exposeInMainWorld("launcherNative", launcherApi);
