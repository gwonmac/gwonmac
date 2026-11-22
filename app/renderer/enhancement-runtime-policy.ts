/**
 * The companion's names for the saved Tools settings and the play region, and
 * the selection view of the one decision: which Features the switches, the
 * developer program and the area select, with the build's checks left out.
 * Whether a Feature runs is decided only by resolve
 * (app/shared/feature-resolve.ts) from main's facts; this view asks the same
 * function with every capability proved and Features loaded at launch, so it
 * cannot disagree with it about selection.
 */
import type { EnhancementProgram } from "../shared/enhancement-contracts.js";
import { FEATURES, type FeatureSwitchSettings, type FeatureId } from "../shared/feature-contracts.js";
import { EVERY_CAPABILITY_PROVED, resolve } from "../shared/feature-resolve.js";

export type OptionalToolSettings = FeatureSwitchSettings;

export type RuntimePlayRegion = "pve" | "pvp" | "unknown";

/** Which Features the switches, the program and the area select (tests/unit/enhancement-runtime-policy.test.ts). */
export function enhancementRuntimePolicy(
  program: EnhancementProgram,
  settings: OptionalToolSettings,
  playRegion: RuntimePlayRegion,
): Readonly<Record<FeatureId, boolean>> {
  const state = { toolsAtLaunch: true, settings, program, playRegion, features: EVERY_CAPABILITY_PROVED };
  return Object.freeze(Object.fromEntries(FEATURES.map((feature) =>
    [feature.id, resolve(feature, state).on])) as Record<FeatureId, boolean>);
}
