/**
 * The durable state a launch opens before any window exists: released Single
 * data, owned directories, and the browser storage a Single profile adopted.
 */
import { session } from "electron";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { errorCode } from "../shared/errors.js";
import { sweepOrphanDirectories } from "./core/atomic-file.js";
import { loadAccountMode } from "./core/multiple-accounts.js";
import { documentDirectories } from "./core/paths.js";
import { logEvent } from "./diagnostics.js";
import type { AppPhase } from "./diagnostics/schema-fields.js";
import { gamePaths } from "./paths.js";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Classify released Single data before the candidate publishes any owner. */
export async function hasReleasedSingleData(paths: ReturnType<typeof gamePaths>): Promise<boolean> {
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

export async function ensureDirs(): Promise<void> {
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

export async function clearBrowserNetworkCache(): Promise<void> {
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
