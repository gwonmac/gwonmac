/**
 * Type-only declaration for the isolated Vue launcher document.
 * Runtime ownership stays in the launcher preload (app/preload/launcher.ts).
 */
import type { LauncherNativeApi } from "../shared/launcher-contracts.js";

declare global {
  interface Window {
    launcherNative: LauncherNativeApi;
  }
}

export {};
