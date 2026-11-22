/**
 * Owns the one live decision of which Features are on. resolve
 * (app/shared/feature-resolve.ts) decides; this module gives it the facts only
 * main knows: the saved switches, whether this launch loaded Features, the
 * developer program, the stage this build shows (app/shared/release.ts), and
 * the verifier's status of every capability for the
 * client build the app or one game window serves. Main's own gates (menus,
 * shortcuts, the Tools main parts) ask `featureOn`; the launcher reads the
 * facts in its snapshot, and the app shell pushes every game window its own
 * facts whenever they change (app-shell.ts). A game window adds only where the
 * character stands.
 */
import type { BrowserWindow } from "electron";
import type { ClientCompatibility } from "../shared/contracts.js";
import type { EnhancementProgram } from "../shared/enhancement-contracts.js";
import type { ReleaseStage } from "../shared/release.js";
import {
  featureSwitchSettings,
  type FeatureSwitchSettings,
  type FeatureId,
} from "../shared/feature-contracts.js";
import { EVERY_CAPABILITY_PROVED, onWhereAllowed, type FeatureFacts } from "../shared/feature-resolve.js";

type Checks = ClientCompatibility["features"] | null;

/** What one launch fixes for the decision, and where the verifier's statuses are read. */
export type FeatureLaunch = Readonly<{
  /** Whether this launch loaded Features (the Tools launch), not a plain-game Core launch. */
  toolsAtLaunch: boolean;
  program: EnhancementProgram;
  /** The stage this build shows, from whether it is packaged and its version (bootstrap derives it once). */
  stage: ReleaseStage;
  /** The statuses the app serves (no window) or one game window serves; null until the client is prepared. */
  checks(win?: BrowserWindow): Checks;
  /**
   * Unpackaged Electron tests only (GW_TEST_FEATURES_PROVEN=1, read in bootstrap): their
   * one-function stand-in client proves nothing, so specs that drive a Feature's surfaces with
   * stand-in commands have every capability read as proved. It changes the facts, never the
   * bytes served.
   */
  provenForTests: boolean;
}>;


let launch: FeatureLaunch | null = null;

/**
 * Bootstrap attaches the launch once the client service exists; until then every Feature reads off
 * and the build shows only stable items.
 */
export function attachFeatureLaunch(next: FeatureLaunch | null): void {
  launch = next;
}

/** The facts for one game window, or for the app (launcher, menus, Tools main parts) without one. */
export function featureFacts(
  settings: Partial<FeatureSwitchSettings>,
  win?: BrowserWindow,
): FeatureFacts {
  return Object.freeze({
    stage: launch?.stage ?? "stable",
    toolsAtLaunch: launch?.toolsAtLaunch ?? false,
    settings: featureSwitchSettings(settings),
    program: launch?.program ?? "none",
    features: launch === null ? null : launch.provenForTests ? EVERY_CAPABILITY_PROVED : launch.checks(win),
  });
}

/** Main's gates: whether a feature is on wherever its region allows (main stands in no area). */
export function featureOn(
  id: FeatureId,
  settings: Partial<FeatureSwitchSettings>,
  win?: BrowserWindow,
): boolean {
  return onWhereAllowed(id, featureFacts(settings, win));
}
