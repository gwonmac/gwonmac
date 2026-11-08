/**
 * The launch after `ready`: it builds each service in launch order, wires them
 * to one another, registers quit cleanup, and opens the launcher.
 *
 * The order of the statements here is the startup contract. Quit cleanup runs
 * in reverse registration order (see `lifecycle.ts`), so moving a registration
 * changes shutdown as well as startup.
 */
import { app, Menu, systemPreferences } from "electron";
import { EXTERNAL_URLS } from "../shared/contracts.js";
import { RELEASE_REPO } from "../shared/project-identity.js";
import { INITIAL_PROGRESS } from "../shared/progress.js";
import { createLauncherWindow, prepareLauncherWindowState } from "./accounts-window.js";
import type { AppShell } from "./app-shell.js";
import { wireCaptureControl } from "./capture-control.js";
import { createClientService, selectLaunch } from "./client-service.js";
import { registerGameIpc } from "./game-ipc/register.js";
import {
  VolatileNativeKeychain,
  type NativeKeychain,
} from "./core/native-keychain.js";
import { matchesExpectedProfile } from "./core/paths.js";
import { TexturePackManager } from "./core/texture-pack-manager.js";
import { logEvent, stopDiagnostics } from "./diagnostics.js";
import { INJECT_STARTUP_FAILURE } from "./fatal-exit.js";
import { recordMainInput } from "./input-trace.js";
import { createLauncherService } from "./launcher-service.js";
import { onAppQuit } from "./lifecycle.js";
import { MultipleAccountsController } from "./multiple-accounts-controller.js";
import {
  installMacosCommandKeyUps,
  loadNativeHost,
  type NativeHost,
} from "./native-host.js";
import { sendRendererCommand } from "./renderer-commands.js";
import { createSocketManager } from "./socket-wiring.js";
import {
  SINGLE_DIAGNOSTIC_OWNER_ID,
  clearBrowserCookies,
  openStartupState,
} from "./startup-state.js";
import { createUpdaterService } from "./updater-service.js";
import {
  flushWindowState,
  prepareWindowState,
  updateLongRunningTaskFeedback,
} from "./window.js";
import { createWindowHost } from "./window-host.js";
import { windowRegistry } from "./window-registry.js";
import { releaseWindowShortcutKey } from "./window-shortcuts.js";

export async function startApp(shell: AppShell, hostVersion: string): Promise<void> {
  if (INJECT_STARTUP_FAILURE) {
    throw new Error("injected startup failure");
  }
  // AppKit reads this bundle-specific persistent preference when it creates
  // text clients. Set it before any BrowserWindow can construct one. This does
  // not change the global macOS keyboard preference or synthesize cadence.
  if (process.platform === "darwin") {
    systemPreferences.setUserDefault(
      "ApplePressAndHoldEnabled",
      "boolean",
      false,
    );
  }
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: hostVersion,
    version: hostVersion,
    copyright:
      "Independent GPL-3.0 project · Guild Wars © ArenaNet LLC.",
    credits:
      `${RELEASE_REPO} · App icon artwork © ArenaNet LLC · QT Friz Quad © 1992 QualiType (SIL OFL 1.1) · Not affiliated with ArenaNet or NCSOFT.`,
    website: EXTERNAL_URLS.github,
  });
  const nativeHost = startNativeHost();
  const startup = await openStartupState();
  if (!startup) return;
  const { paths, settings, adoptedStorage, distribution } = startup;
  const { preferences, windowCoordinator, revealLauncher } = shell;
  shell.settingsLoaded(settings);
  const texturePacks = new TexturePackManager({
    root: paths.texturePacks,
    selection: paths.texturePackSelection,
    packs: paths.texturePackSources,
    staging: paths.texturePackStaging,
  }, () => shell.launcher()?.publish());
  await texturePacks.initialise();
  const launch = await selectLaunch(paths, settings);
  if (adoptedStorage) {
    await prepareWindowState(SINGLE_DIAGNOSTIC_OWNER_ID, adoptedStorage.windowState);
  }
  const keychain: NativeKeychain = startup.persistentSecrets
    ? nativeHost
    : new VolatileNativeKeychain();
  const expectedUserData = process.env.GW_EXPECT_USER_DATA;
  const profileMatches = await matchesExpectedProfile(app.getPath("userData"), expectedUserData);
  const client = createClientService({
    paths,
    hostVersion,
    settings,
    launch,
    keychain,
    onProgress: shell.setProgress,
  });
  const clientRuntime = client.runtime;
  const sockets = createSocketManager();
  const updater = createUpdaterService({
    hostVersion,
    capable: distribution.automaticUpdates,
    lastUpdateCheckAt: settings.lastUpdateCheckAt,
    preferences,
    publish: () => {
      shell.launcher()?.publish();
    },
  });
  client.pauseDownloadsDuringSleep();
  const protocolDeps = {
    getActiveClient: () => clientRuntime.active,
    getTexturePackAsset: (generation: string, asset: "manifest.json" | "textures.rgba") =>
      texturePacks.runtimeAsset(generation, asset),
    diagnosticOwnerId: () => SINGLE_DIAGNOSTIC_OWNER_ID,
    launcherNewsImage: (key: string) => startup.launcherNews.image(key),
  };
  const host = createWindowHost({
    shell,
    clientRuntime,
    sockets,
    enhancementSelection: launch.enhancementSelection,
    enhancementProgram: launch.enhancementProgram,
    diagnosticProfile: launch.diagnosticProfile,
  });
  const allowUnreadyLaunch =
    (!app.isPackaged || startup.distributionChannel === null)
    && process.env.GW_TEST_ALLOW_UNREADY_LAUNCH === "1";
  const accounts = new MultipleAccountsController({
    workspace: startup.accountWorkspace,
    paths,
    keychain,
    clientRuntime,
    protocol: protocolDeps,
    windowHost: host,
    windows: windowCoordinator,
    publishState: () => {
      shell.launcher()?.publish();
    },
    texturePackGeneration: () => texturePacks.acquireCurrentGeneration(),
    releaseTexturePackGeneration: (generation) => texturePacks.releaseGeneration(generation),
    allowUnreadyLaunch,
  });
  await accounts.resumePendingDeletions();

  // Tools code loads only for a launch that selected Tools. A static import
  // would evaluate it in every Core launch (tests/policy/core-tools-launch-boundary).
  const toolsRuntime = launch.enhancementSelection.tools
    ? (await import("./tools-runtime.js")).createToolsRuntime({
        paths,
        windows: windowRegistry,
        accounts,
        preferences,
        initialSettings: settings,
        clientFingerprint: () => clientRuntime.active?.clientFingerprint,
        getClientSession: client.clientSession,
      })
    : null;
  shell.attachToolsSettings(toolsRuntime?.applySettings ?? null);
  await toolsRuntime?.applySettings(settings);

  const currentSettings = () => shell.currentSettings() ?? settings;
  const launcher = createLauncherService({
    shell,
    paths,
    hostVersion,
    settings,
    accounts,
    launcherState: startup.launcherState,
    launcherNews: startup.launcherNews,
    texturePacks,
    clientRuntime,
    updater,
    toolsLoaded: launch.enhancementSelection.tools,
    toolsRuntime,
    allowUnreadyLaunch,
  });
  const ipcCleanup = registerGameIpc({
    paths,
    windows: windowRegistry,
    sockets,
    accounts,
    client,
    preferences,
    host,
    launcher,
    currentSettings,
  });

  onAppQuit(async () => {
    const gameWindows = windowRegistry.gameWindows();
    await Promise.all(gameWindows.map(async (win) => {
      if (!win.isDestroyed()) {
        const outcome = await sendRendererCommand(win, {
          type: "filesystem.sync",
        });
        if (outcome !== "completed") {
          logEvent({ k: "quit.rendererSyncIncomplete", outcome });
        }
      }
    }));
    await ipcCleanup.drainSecrets();
    await Promise.all(gameWindows.map((win) => flushWindowState(win)));
    sockets.closeAll();
    await toolsRuntime?.dispose();
    shell.attachToolsSettings(null);
    updateLongRunningTaskFeedback(INITIAL_PROGRESS, null);
    await clientRuntime.shutdown();
    if (adoptedStorage) await clearBrowserCookies("quit");
    await stopDiagnostics();
  });

  await prepareLauncherWindowState();
  const win = createLauncherWindow(
    protocolDeps,
    windowCoordinator,
    revealLauncher,
    host.accounts,
  );
  app.dock?.setMenu(Menu.buildFromTemplate([
    {
      id: "show-launcher",
      label: "Show Launcher",
      click: () => revealLauncher(),
    },
  ]));
  updater.startAutomaticChecks({
    clientRuntime,
    sockets,
    attachSchedule: shell.attachAutomaticUpdateCheck,
  });
  if (shell.secondInstanceRequested()) win.once("ready-to-show", shell.revealMainWindow);
  wireCaptureControl(() => preferences.getSettings());
  if (profileMatches) {
    void clientRuntime.requestUpdate();
  } else {
    logEvent({ k: "app.unexpectedUserData" });
    shell.setProgress({ phase: "error", errorCode: "wrong_profile" });
  }

  app.on("did-resign-active", () => {
    windowCoordinator.captureActivationTarget();
  });
  app.on("activate", () => {
    if (!windowCoordinator.restoreMostRecentWindow()) {
      createLauncherWindow(protocolDeps, windowCoordinator, revealLauncher, host.accounts);
    }
  });
  app.on("child-process-gone", (_event, details) => {
    logEvent({ k: "childProcess.gone",
      exitCode: details.exitCode,
    });
  });
}

/**
 * Load the native host and route the Command-held key releases it observes to
 * the focused game window until the app quits.
 */
function startNativeHost(): NativeHost {
  const nativeHost = loadNativeHost({
    packaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
  });
  const stopCommandKeyUps = installMacosCommandKeyUps(nativeHost, {
    focusedGameTarget() {
      return windowRegistry.focusedGameWindow();
    },
    release(win, code) {
      releaseWindowShortcutKey(win, code);
      recordMainInput(win, {
        source: 'appkit',
        kind: 'native-key',
        phase: 'up',
        key: code.startsWith('Key') || code.startsWith('Digit')
          ? 'printable'
          : 'other',
        repeat: false,
        decision: 'normalized-release',
      });
      void sendRendererCommand(win, { type: "input.release", code });
    },
  });
  app.once("will-quit", () => stopCommandKeyUps());
  return nativeHost;
}
