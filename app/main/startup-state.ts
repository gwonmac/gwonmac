/**
 * The durable state a launch opens before any window exists: released Single
 * data, the launcher and account documents, pending resets, owned directories,
 * the diagnostics recorder, secret storage policy, and the Settings file.
 *
 * The order is the launch contract: a pending reset runs before any owner can
 * mount the storage it clears, and diagnostics start before any event that
 * must be recorded.
 */
import { app, dialog, net, session, shell } from "electron";
import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "../shared/settings/index.js";
import {
  distributionCapabilities,
  type DistributionCapabilities,
  type DistributionChannel,
} from "../shared/distribution-channel.js";
import { errorCode } from "../shared/errors.js";
import { packagedDistributionChannel } from "./app-identity.js";
import { sweepOrphanDirectories } from "./core/atomic-file.js";
import { LauncherNewsService } from "./core/launcher-news.js";
import {
  LauncherStateStore,
  classifyLauncherInstallation,
  loadOrCreateLauncherState,
} from "./core/launcher-state.js";
import { cleanupLegacySecretFiles } from "./core/legacy-secret-cleanup.js";
import {
  bootstrapAccountWorkspace,
  loadAccountMode,
} from "./core/multiple-accounts.js";
import { documentDirectories } from "./core/paths.js";
import { resolveAdoptedProfileStorage } from "./core/profile-storage.js";
import { loadSettings } from "./core/settings.js";
import { logEvent, startDiagnostics } from "./diagnostics.js";
import type { AppPhase } from "./diagnostics/schema-fields.js";
import { gamePaths, type GamePaths } from "./paths.js";
import {
  applyPendingCacheClear,
  applyPendingGameStorageReset,
} from "./settings-actions.js";

/** The diagnostics owner of the adopted Single profile and of app-wide events. */
export const SINGLE_DIAGNOSTIC_OWNER_ID = 1;

export interface StartupState {
  readonly paths: GamePaths;
  readonly launcherState: LauncherStateStore;
  readonly launcherNews: LauncherNewsService;
  readonly accountWorkspace: Awaited<ReturnType<typeof bootstrapAccountWorkspace>>;
  readonly adoptedStorage: ReturnType<typeof resolveAdoptedProfileStorage>;
  readonly distributionChannel: DistributionChannel | null;
  readonly distribution: DistributionCapabilities;
  readonly persistentSecrets: boolean;
  readonly settings: AppSettings;
}

/**
 * Opens every document a launch needs, in launch order. Returns null when the
 * player chose Quit because the account workspace could not be opened.
 */
export async function openStartupState(): Promise<StartupState | null> {
  const paths = gamePaths();
  const legacySingleData = await hasReleasedSingleData(paths);
  const workspaceExisted = await pathExists(paths.multiWorkspace);
  const loadedLauncherState = await loadOrCreateLauncherState(
    paths.launcherState,
    classifyLauncherInstallation({ legacySingleData, existingWorkspace: workspaceExisted }),
  );
  const launcherState = new LauncherStateStore(
    paths.launcherState,
    loadedLauncherState.document,
  );
  const launcherNews = new LauncherNewsService({
    cachePath: paths.launcherNewsCache,
    fetch: (url, init) => net.fetch(url, init),
    openExternal: (url) => shell.openExternal(url),
  });
  await launcherNews.loadCache();
  let accountWorkspace;
  for (;;) {
    try {
      accountWorkspace = await bootstrapAccountWorkspace(
        paths.multiWorkspace,
        legacySingleData,
      );
      break;
    } catch {
      const { response } = await dialog.showMessageBox({
        type: "warning",
        buttons: ["Retry", "Quit"],
        defaultId: 0,
        cancelId: 1,
        message: "Account profiles could not be opened",
        detail:
          "No account data was changed. Retry after fixing the workspace, or quit and report the problem.",
      });
      if (response === 0) continue;
      app.quit();
      return null;
    }
  }
  const adoptedStorage = resolveAdoptedProfileStorage(accountWorkspace, paths);
  await applyPendingCacheClear(paths);
  if (adoptedStorage) {
    await applyPendingGameStorageReset(paths, SINGLE_DIAGNOSTIC_OWNER_ID);
  }
  await ensureDirs();
  await startDiagnostics();
  const distributionChannel = packagedDistributionChannel();
  const distribution = distributionCapabilities(distributionChannel);
  if (!app.isPackaged) {
    console.warn(
      "Saved login is memory-only in pnpm dev; use pnpm dev:signed for persistent development credentials.",
    );
  }
  const persistentSecrets =
    app.isPackaged
    && distribution.persistentSecrets
    && !app.commandLine.hasSwitch("gw-volatile-secrets");
  if (
    adoptedStorage
    && persistentSecrets
    && distribution.cleanupLegacySecrets
  ) {
    const legacySecretFailures = await cleanupLegacySecretFiles(
      app.getPath("userData"),
      rm,
    );
    for (const failure of legacySecretFailures) {
      logEvent({ k: "legacySecrets.cleanupFailed", code: errorCode(failure) });
    }
  }
  if (adoptedStorage) {
    await clearBrowserCookies("startup");
    await clearBrowserNetworkCache();
  }
  logEvent({ k: "electron.ready" });
  const settings = await loadSettings(paths.settings, async () => {
    logEvent({ k: "settings.corruptRecovered" });
    await dialog.showMessageBox({
      type: "warning",
      buttons: ["Continue"],
      message: "Settings were reset",
      detail:
        "The settings file was corrupt. Defaults were restored and a diagnostic copy was preserved.",
    });
  });
  return {
    paths,
    launcherState,
    launcherNews,
    accountWorkspace,
    adoptedStorage,
    distributionChannel,
    distribution,
    persistentSecrets,
    settings,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Classify released Single data before the candidate publishes any owner. */
async function hasReleasedSingleData(paths: ReturnType<typeof gamePaths>): Promise<boolean> {
  if (await pathExists(paths.launcherMode)) {
    try {
      return await loadAccountMode(paths.launcherMode) === "single";
    } catch {
      // The old mode document is not operational state anymore. Preserve it
      // byte-for-byte and fall back to canonical Single-owned evidence.
    }
  }
  return (await Promise.all([
    paths.settings,
    paths.buildLibrary,
    paths.windowState,
    path.join(paths.userData, "IndexedDB"),
    path.join(paths.userData, "Local Storage"),
  ].map(pathExists))).some(Boolean);
}

async function ensureDirs(): Promise<void> {
  const paths = gamePaths();
  await mkdir(paths.game, { recursive: true });
  await mkdir(paths.chunks, { recursive: true });
  await mkdir(paths.diagnostics, { recursive: true });
  // On the first open of the directories we own, remove incomplete atomic
  // writes. A process killed between
  // write and rename leaves `<name>.<pid>.<hex>.tmp` behind, and boot is the
  // only moment at which every one of those directories is known to be idle.
  const roots = documentDirectories(paths);
  roots.push(paths.multiRoot, paths.multiProfiles);
  const removed = await sweepOrphanDirectories(roots);
  if (removed > 0) logEvent({ k: "orphanTemps.swept", removed });
}

export async function clearBrowserCookies(phase: AppPhase): Promise<void> {
  try {
    await session.defaultSession.clearStorageData({ storages: ["cookies"] });
    logEvent({ k: "browserCookies.cleared", phase });
  } catch (error) {
    logEvent({
      k: "browserCookies.clearFailed",
      phase,
      code: errorCode(error),
    });
  }
}

async function clearBrowserNetworkCache(): Promise<void> {
  try {
    // Snapshot chunks are canonical in the native content-addressed store.
    // Chromium's HTTP cache would only duplicate them and can retain stale
    // same-URL client artifacts between exact-hash updates.
    await session.defaultSession.clearCache();
    logEvent({ k: "browserCache.cleared", phase: "startup" });
  } catch (error) {
    logEvent({
      k: "browserCache.clearFailed",
      phase: "startup",
      code: errorCode(error),
    });
  }
}
