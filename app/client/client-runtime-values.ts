/**
 * Small boundary projections shared by client selection and rollback paths.
 * They turn verified runtime facts into closed diagnostics values.
 */
import type {
  ClientCompatibility,
  ExtendedMemoryRuntimeStatus,
  OptionalFeatureStatus,
  RuntimeEnhancementVerification,
} from "../shared/contracts.js";
import {
  capabilityRecord,
  ENHANCEMENT_CAPABILITY_FIELDS,
} from "../shared/enhancement-contracts.js";
import { isDigest, type Digest } from "../shared/digest.js";
import type { LocalFeatureVerdicts } from
  "./certification/local-client-verification-contract.js";
import type { ClientVerificationStage } from "./certification/client-verification-pass.js";

/** Convert a verified client fingerprint into the diagnostics schema safely. */
export function diagnosticDigest(
  value: string | null | undefined,
): Digest | null {
  return typeof value === "string" && isDigest(value) ? value : null;
}

/** Explain why one requested enhancement did or did not reach the renderer. */
export function optionalFeatureStatus(
  requested: boolean,
  effective: boolean,
  supported: boolean,
  preparationFailed: boolean,
): OptionalFeatureStatus {
  if (!requested) return { status: "off" };
  if (effective) return { status: "available" };
  return {
    status: "unavailable",
    reason: supported && preparationFailed
      ? "preparation-failed"
      : "game-update",
  };
}

/** Which served features a reason replaces: the upstream chain, or single later stages. */
export interface StageScope {
  /** Any stage before native double-click: file saving and every capability. */
  readonly upstream: boolean;
  readonly nativeDoubleClick: boolean;
  readonly extendedMemory: boolean;
}

const WHOLE_CHAIN: StageScope = { upstream: true, nativeDoubleClick: true, extendedMemory: true };

/**
 * The features of a launch whose named stages failed to check. A later stage
 * is proved on the output of the last stage that passed, so a failure reaches
 * only its own features; a failure before native double-click names no single
 * served feature and covers every capability.
 */
export function failedStageScope(stages: readonly ClientVerificationStage[]): StageScope {
  return {
    upstream: stages.some((stage) =>
      stage !== "nativeDoubleClick" && stage !== "extendedMemory"),
    nativeDoubleClick: stages.includes("nativeDoubleClick"),
    extendedMemory: stages.includes("extendedMemory"),
  };
}

/**
 * Re-attribute the update-style refusals of the features in `scope`. A check
 * that failed is not the game build's doing (`check-failed`); neither is a
 * later stage whose proof was made for an Enhancement output Main could not
 * build (`preparation-failed`). Preparation failures and off features stay.
 */
export function withStageReason(
  compatibility: ClientCompatibility,
  extendedMemory: ExtendedMemoryRuntimeStatus,
  reason: "check-failed" | "preparation-failed",
  scope: StageScope = WHOLE_CHAIN,
): { compatibility: ClientCompatibility; extendedMemory: ExtendedMemoryRuntimeStatus } {
  const { features } = compatibility;
  const replace = <Status extends OptionalFeatureStatus>(status: Status, inScope: boolean) =>
    inScope ? withReason(status, reason) : status;
  return {
    compatibility: {
      ...compatibility,
      features: {
        gameFileSaving: replace(features.gameFileSaving, scope.upstream),
        nativeDoubleClick: replace(
          features.nativeDoubleClick,
          scope.upstream || scope.nativeDoubleClick,
        ),
        ...capabilityRecord((capability) => replace(features[capability], scope.upstream)),
      },
    },
    extendedMemory: (scope.upstream || scope.extendedMemory)
      && extendedMemory.status === "unavailable"
      && extendedMemory.fallbackReason === "unsupported-client"
      ? { ...extendedMemory, fallbackReason: reason }
      : extendedMemory,
  };
}

/** When the build could not be checked at all, every update-style refusal is the failed check. */
export function withFailedCheck(
  compatibility: ClientCompatibility,
  extendedMemory: ExtendedMemoryRuntimeStatus,
): { compatibility: ClientCompatibility; extendedMemory: ExtendedMemoryRuntimeStatus } {
  return withStageReason(compatibility, extendedMemory, "check-failed");
}

/**
 * The reasons a launch serves. With no verdict the whole check failed; a
 * verdict may still name stages that failed to check. When Main fell back
 * from the Enhancement candidate the pass proved, the later stages were proved
 * for an output Main does not hold, so their misses are preparation failures.
 */
export function servedReasons(
  compatibility: ClientCompatibility,
  extendedMemory: ExtendedMemoryRuntimeStatus,
  failedStages: readonly ClientVerificationStage[] | null,
  enhancementFellBack: boolean,
): { compatibility: ClientCompatibility; extendedMemory: ExtendedMemoryRuntimeStatus } {
  if (failedStages === null) return withFailedCheck(compatibility, extendedMemory);
  const checked = withStageReason(
    compatibility,
    extendedMemory,
    "check-failed",
    failedStageScope(failedStages),
  );
  return enhancementFellBack
    ? withStageReason(checked.compatibility, checked.extendedMemory, "preparation-failed", {
        upstream: false,
        nativeDoubleClick: true,
        extendedMemory: true,
      })
    : checked;
}

function withReason<Status extends OptionalFeatureStatus>(
  status: Status,
  reason: "check-failed" | "preparation-failed",
): Status | Readonly<{ status: "unavailable"; reason: "check-failed" | "preparation-failed" }> {
  return status.status === "unavailable" && status.reason === "game-update"
    ? { status: "unavailable", reason }
    : status;
}

/** Retain one bounded, closed verdict per capability for the active generation. */
export function runtimeFeatureVerdicts(
  verdicts: LocalFeatureVerdicts | null,
): RuntimeEnhancementVerification["featureVerdicts"] {
  if (!verdicts) return null;
  return Object.freeze(Object.fromEntries(
    ENHANCEMENT_CAPABILITY_FIELDS.map((feature) => {
      const verdict = verdicts[feature];
      return [feature, Object.freeze({
        status: verdict.status === "not-requested" ? "off" : verdict.status,
        invariant: "invariant" in verdict ? verdict.invariant : null,
        candidates: verdict.status === "ambiguous" ? verdict.candidates : null,
      })];
    }),
  )) as RuntimeEnhancementVerification["featureVerdicts"];
}
