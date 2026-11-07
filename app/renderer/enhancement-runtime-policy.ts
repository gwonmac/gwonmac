/**
 * Computes the one fail-closed policy for optional observers, UI, and commands.
 * Saved product settings and explicit developer programs meet only here; each
 * feature names the developer programs that select it (app/features).
 */
import type { FeatureDefinition } from "../features/define.js";
import type { EnhancementProgram } from "../shared/enhancement-contracts.js";
import {
  FEATURES,
  featureActivationRequested,
  featureRegionAllowsRequest,
  type FeatureActivationSettings,
  type FeatureId,
} from "../shared/feature-contracts.js";

export type OptionalToolSettings = FeatureActivationSettings;

export type RuntimePlayRegion = "pve" | "pvp" | "unknown";
type RuntimeFeaturePolicy = Readonly<Record<FeatureId, boolean>>;

/** One fail-closed answer for optional observers, UI, and commands. */
export function enhancementRuntimePolicy(
  program: EnhancementProgram,
  settings: OptionalToolSettings,
  playRegion: RuntimePlayRegion,
): RuntimeFeaturePolicy {
  return Object.freeze(Object.fromEntries(FEATURES.map((feature) => {
    const programs: FeatureDefinition["programs"] = "programs" in feature ? feature.programs : undefined;
    return [feature.id, featureRegionAllowsRequest(feature.id, playRegion)
      && (programs?.includes(program) === true || featureActivationRequested(feature.id, settings))];
  })) as RuntimeFeaturePolicy);
}
