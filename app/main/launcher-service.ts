/**
 * The launcher: its orchestrator over accounts, client, updates, news, and
 * texture packs, and every launcher IPC action with its native confirmations.
 *
 * `launcher-ipc.ts` owns sender validation and parsing; this module owns what
 * each validated request does.
 */
import { app, dialog, net, shell as electronShell, type BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import { EXTERNAL_URLS, type AppSettings } from "../shared/contracts.js";
import { LAUNCHER_IPC } from "../shared/launcher-contracts.js";
import type { ClientRuntime } from "../client/client-runtime.js";
import type { AppShell } from "./app-shell.js";
import { sendLauncherFeedback } from "./core/launcher-feedback.js";
import type { LauncherNewsService } from "./core/launcher-news.js";
import type { LauncherStateStore } from "./core/launcher-state.js";
import { allGlobalToolsPatch } from "./core/launcher-tools.js";
import type { TexturePackManager } from "./core/texture-pack-manager.js";
import { logEvent } from "./diagnostics.js";
import { sendIfLive } from "./ipc-channel-registry.js";
import { registerLauncherIpc } from "./launcher-ipc.js";
import { LauncherOrchestrator } from "./launcher-orchestrator.js";
import { captureLauncherShortcut } from "./launcher-shortcut-capture.js";
import type { MultipleAccountsController } from "./multiple-accounts-controller.js";
import type { GamePaths } from "./paths.js";
import type { ToolsRuntime } from "./tools-runtime.js";
import type { UpdaterService } from "./updater-service.js";
import { refreshNativeAccountsMenu } from "./window-menu.js";
import { windowRegistry } from "./window-registry.js";

export function createLauncherService(input: Readonly<{
  shell: AppShell;
  paths: GamePaths;
  hostVersion: string;
  settings: AppSettings;
  accounts: MultipleAccountsController;
  launcherState: LauncherStateStore;
  launcherNews: LauncherNewsService;
  texturePacks: TexturePackManager;
  clientRuntime: ClientRuntime;
  updater: UpdaterService;
  toolsLoaded: boolean;
  toolsRuntime: ToolsRuntime | null;
  allowUnreadyLaunch: boolean;
}>): LauncherOrchestrator {
  const {
    shell,
    paths,
    settings,
    accounts,
    launcherState,
    launcherNews,
    texturePacks,
    clientRuntime,
    updater,
    toolsRuntime,
  } = input;
  const { preferences } = shell;
  const orchestrator = new LauncherOrchestrator({
    accounts,
    state: launcherState,
    hasActiveClient: () => clientRuntime.active !== null,
    getProgress: () => clientRuntime.progress,
    getAppUpdate: () => updater.state(),
    getSettings: () => shell.currentSettings() ?? settings,
    getNews: (contentPreferences) => launcherNews.snapshot(contentPreferences),
    toolsLoaded: () => input.toolsLoaded,
    getTexturePacks: () => texturePacks.snapshot(),
    getExtendedMemory: () => clientRuntime.extendedMemory,
    allowUnreadyLaunch: input.allowUnreadyLaunch,
    publish: (snapshot) => {
      const launcher = windowRegistry.launcherWindow();
      if (launcher) sendIfLive(launcher, LAUNCHER_IPC.stateEvent, snapshot);
      refreshNativeAccountsMenu();
    },
  });
  shell.attachLauncher(orchestrator);

  let feedbackInFlight = false;
  registerLauncherIpc({
    windows: windowRegistry,
    connected: () => {
      logEvent({ k: "launcher.connected" });
      void launcherNews.refresh().then(() => orchestrator.publish());
    },
    snapshot: () => orchestrator.snapshot(),
    create: async ({ name, appearance }) => {
      const previousIds = new Set(accounts.state().profiles.map((profile) => profile.id));
      const next = await accounts.create({ name });
      const created = next.profiles.find((profile) => !previousIds.has(profile.id));
      if (!created) throw new Error("Created account was not published");
      if (appearance) await orchestrator.updateAppearance(created.id, appearance);
    },
    updateProfile: async ({ id, name, icon, color }) => {
      await accounts.rename(id, name);
      await orchestrator.updateAppearance(id, { icon, color });
    },
    setSelection: (ids) => orchestrator.setSelection(ids),
    play: (ids) => orchestrator.play(ids),
    show: (id) => orchestrator.show(id),
    cancelQueued: (ids) => orchestrator.cancel(ids),
    archive: async (id) => {
      await accounts.archive(id);
    },
    restore: async (id) => {
      await accounts.restore(id);
    },
    delete: async (win, id) => {
      await accounts.delete(win, id);
    },
    dismissMigrationNotice: () => orchestrator.dismissMigrationNotice(),
    dismissPreferencesReset: () => orchestrator.dismissPreferencesReset(),
    completeSetup: async (enableTools) => {
      if (enableTools) {
        await preferences.write({ kind: "settings", patch: allGlobalToolsPatch(true) });
      }
      await orchestrator.completeSetup();
      if (enableTools) {
        app.relaunch();
        app.quit();
      }
    },
    updatePreferences: (patch) => orchestrator.updatePreferences(patch),
    openNews: (id) => launcherNews.open(id),
    writeSettings: async (change) => {
      await preferences.write(change);
    },
    resetSettings: async (win) => {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Reset Settings", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: "Reset all app settings?",
        detail: "This resets launcher and game preferences, Tools, shortcuts, custom map styles, and custom panel colors. Original textures will be selected. Accounts, saved logins, game files, imported texture packs, builds, templates, screenshots, and chat logs are kept.",
      });
      if (response !== 0) return;
      await (toolsRuntime?.resetSettings() ?? preferences.resetCoreSettings());
      await launcherState.resetPresentation();
      await texturePacks.select(null);
      logEvent({ k: "settings.reset" });
      orchestrator.publish();
    },
    captureShortcut: (win, action) => captureLauncherShortcut(
      win,
      action,
      () => shell.currentSettings() ?? settings,
    ),
    restartToApplyTools: async (_win) => {
      if (windowRegistry.gameWindows().length > 0) return;
      app.relaunch();
      app.quit();
    },
    cacheInfo: () => clientRuntime.cacheInfo(),
    repairGameFiles: async (win) => {
      if (windowRegistry.gameWindows().length > 0) {
        await dialog.showMessageBox(win, {
          type: "info",
          buttons: ["OK"],
          message: "Close your game windows first",
          detail: "Open games stay usable. Repair can start after every account is closed.",
        });
        return;
      }
      await clientRuntime.retryClient(() => {
        app.relaunch();
        app.quit();
      });
    },
    pauseDownload: () => clientRuntime.stopDownload(),
    resumeDownload: async () => {
      await clientRuntime.downloadAll();
    },
    resetGameFiles: async (win) => {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Reset and Redownload", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: "Reset and redownload game files?",
        detail: "Accounts, saved logins, settings, Tools, shortcuts, builds, templates, screenshots, and chat logs are kept.",
      });
      if (response !== 0) return;
      await writeFile(paths.cacheClearRequest, "launcher-full-reset-v1", { mode: 0o600 });
      app.relaunch();
      app.quit();
    },
    importTexturePack: async (win: BrowserWindow) => {
      const result = await dialog.showOpenDialog(win, {
        title: "Import Texture Pack",
        properties: ["openFile"],
        filters: [{ name: "TexMod texture packs", extensions: ["tpf"] }],
      });
      if (result.canceled || result.filePaths.length !== 1) return { status: "cancelled" as const };
      return texturePacks.importFile(result.filePaths[0]!);
    },
    selectTexturePack: (id: string | null) => texturePacks.select(id),
    removeTexturePack: async (win: BrowserWindow, id: string) => {
      const pack = texturePacks.snapshot().packs.find((candidate) => candidate.id === id);
      if (!pack) throw new Error("Texture pack is not installed");
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Remove", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: `Remove ${pack.name}?`,
        detail: "The managed copy is deleted. Game windows that are already open keep their current appearance until they close.",
      });
      if (response === 0) await texturePacks.remove(id);
    },
    sendFeedback: async (feedback) => {
      // One report at a time: a second click must not post the same text twice.
      if (feedbackInFlight) throw new Error("feedback is already being sent");
      feedbackInFlight = true;
      try {
        await sendLauncherFeedback((url, init) => net.fetch(url, init), feedback, {
          appVersion: input.hostVersion,
          macosVersion: process.getSystemVersion(),
        });
      } finally {
        feedbackInFlight = false;
      }
    },
    openExternal: async (kind) => {
      await electronShell.openExternal(EXTERNAL_URLS[kind]);
    },
    openUrl: (url) => electronShell.openExternal(url),
    revealLogs: () => electronShell.showItemInFolder(paths.diagnostics),
    checkUpdates: () => updater.check(),
    restartAndInstall: (win) => updater.restartAndInstall(win),
  });
  return orchestrator;
}
