/**
 * Main's Feature facts (app/main/feature-decision.ts) as a test needs them: a
 * launch that loaded Features, these switches, and a client build that proved
 * every capability, unless `changed` gives some another status.
 */
import type { ClientCompatibility, OptionalFeatureStatus } from "../../app/shared/contracts.ts";
import { capabilityRecord, type EnhancementCapability } from "../../app/shared/enhancement-contracts.ts";
import { featureActivationSettings, type FeatureActivationSettings } from "../../app/shared/feature-contracts.ts";
import type { FeatureFacts } from "../../app/shared/feature-resolve.ts";

export function provenChecks(
  changed: Partial<Record<EnhancementCapability, OptionalFeatureStatus>> = {},
): ClientCompatibility["features"] {
  return {
    gameFileSaving: { status: "available" },
    nativeDoubleClick: { status: "available" },
    ...capabilityRecord((capability) => changed[capability] ?? { status: "available" }),
  };
}

export function provenFacts(settings: Partial<FeatureActivationSettings>): FeatureFacts {
  return { toolsAtLaunch: true, settings: featureActivationSettings(settings), program: "none", features: provenChecks() };
}
