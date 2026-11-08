/**
 * The launcher: its orchestrator over accounts, client, updates, news, and
 * texture packs, published to the launcher window, and the launcher channels
 * (launcher-ipc.ts) that act on it.
 */
import type { ClientRuntime } from "../client/client-runtime.js";
import { LAUNCHER_CHANNELS } from "../shared/ipc/launcher.js";
import type { AppSettings } from "../shared/settings/index.js";
import type { AppShell } from "./app-shell.js";
import type { LauncherNewsService } from "./core/launcher-news.js";
import type { LauncherStateStore } from "./core/launcher-state.js";
import type { TexturePackManager } from "./core/texture-pack-manager.js";
import { emit } from "./ipc-channel-registry.js";
import { registerLauncherIpc } from "./launcher-ipc.js";
import { LauncherOrchestrator } from "./launcher-orchestrator.js";
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
  const { shell, settings, accounts, launcherState, launcherNews, texturePacks, clientRuntime, updater } = input;
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
      if (launcher) emit(launcher, LAUNCHER_CHANNELS.stateEvent, snapshot);
      refreshNativeAccountsMenu();
    },
  });
  shell.attachLauncher(orchestrator);

  registerLauncherIpc({ ...input, orchestrator });
  return orchestrator;
}
