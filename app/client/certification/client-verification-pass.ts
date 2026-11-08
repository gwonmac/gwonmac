/**
 * One verifier pass over one official client generation: every stage of the
 * derived client chain, for every launch profile this install can select, on
 * bytes read once.
 *
 * This runs inside the isolated verifier process and is pure: it reads only the
 * bytes it is handed and writes nothing. It walks the chain exactly as Main
 * prepares it (official, template saving, Enhancement, friends, Cartography,
 * native double-click, 4 GB), each stage proved on the previous stage's
 * output, so Main can later find the proof for whatever input it actually
 * holds. A stage that refuses records nothing and the next stage proves the
 * previous output, which is the same degradation Main applies.
 *
 * The result is the verifier's own output, never a decision: Main still
 * accepts every part through the same guards a fresh answer passes, and still
 * repeats every transform it has to build. A stage that fails to check (it
 * throws something other than a refusal, see `stage-refusal.ts`) is named in
 * `failedStages`; Main never stores a pass that names one.
 */
import { createHash } from "node:crypto";
import { isStageRefusal } from "./stage-refusal.js";
import {
  enhancementCapabilitiesForProfile,
  enhancementCapabilityProfile,
  enhancementCapabilitiesRequested,
  NO_ENHANCEMENT_CAPABILITIES,
  type EnhancementCapabilities,
} from "../../shared/enhancement-contracts.js";
import {
  acceptLocalClientVerification,
  verifyLocalClientBytes,
  type LocalClientVerification,
} from "./local-client-verifier.js";
import {
  rewriteTemplateSaveWasm,
  TEMPLATE_SAVE_TRANSFORM_ABI,
} from "./template-save-compat.js";
import { ENHANCEMENT_TRANSFORM_ABI } from "../../shared/enhancement-contracts.js";
import { FRIEND_OBSERVER_TRANSFORM_ABI } from "../../shared/friend-observer-contract.js";
import { CARTOGRAPHY_SPIKE_TRANSFORM_ABI } from "./pathing-spike-transform.js";
import { enhancementCandidates, enhancementOutputSha256 } from "./enhancement-builds.js";
import { transformEnhancementWasm } from "./enhancement-transform.js";
import {
  deriveFriendObserverStage,
  isFriendObserverBuild,
  rewriteFriendObserverWasm,
  type FriendObserverBuild,
} from "./friend-observer-transform.js";
import {
  deriveCartographySpikeBuild,
  isCartographySpikeBuild,
  rewriteCartographySpikeWasm,
  type CartographySpikeBuild,
} from "./cartography-spike-verifier.js";
import {
  deriveNativeDoubleClickBuild,
  isDerivedNativeDoubleClickBuild,
  nativeDoubleClickOutputSha256,
  NATIVE_DOUBLE_CLICK_TRANSFORM_ABI,
  rewriteWithBuild,
  type NativeDoubleClickBuild,
} from "./native-double-click.js";
import {
  deriveExtendedMemoryStructuralProof,
  EXTENDED_MEMORY_TRANSFORM_ABI,
  EXTENDED_MEMORY_VERIFIER_ABI,
  isExtendedMemoryStructuralProof,
  type ExtendedMemoryStructuralProof,
} from "./extended-memory.js";

/**
 * Bumped whenever the shape of a pass result changes, so a stored record from
 * an older shape is a key mismatch instead of a parse question.
 */
export const CLIENT_VERIFICATION_PASS_ABI = 2;

/**
 * The ABI of every stage a pass proves. A stored pass made under any other
 * value is a key mismatch, so a stage change re-proves the build even when the
 * app version did not change (development and preview builds).
 */
export const CLIENT_VERIFICATION_STAGE_ABIS = Object.freeze({
  template: TEMPLATE_SAVE_TRANSFORM_ABI,
  enhancement: ENHANCEMENT_TRANSFORM_ABI,
  friendObserver: FRIEND_OBSERVER_TRANSFORM_ABI,
  cartography: CARTOGRAPHY_SPIKE_TRANSFORM_ABI,
  nativeDoubleClick: NATIVE_DOUBLE_CLICK_TRANSFORM_ABI,
  extendedMemoryTransform: EXTENDED_MEMORY_TRANSFORM_ABI,
  extendedMemoryVerifier: EXTENDED_MEMORY_VERIFIER_ABI,
});

/** One module chain a launch can select. */
export interface ClientVerificationLaunch {
  /** `none` or an Enhancement capability profile, as the launch requests it. */
  readonly requestedProfile: string;
  /** Tools launches add Cartography; Core launches never install it. */
  readonly cartography: boolean;
}

/** The stages of one launch's chain, in chain order. */
export const CLIENT_VERIFICATION_STAGES = [
  "verification",
  "template",
  "enhancement",
  "friendObserver",
  "cartography",
  "nativeDoubleClick",
  "extendedMemory",
] as const;

export type ClientVerificationStage = (typeof CLIENT_VERIFICATION_STAGES)[number];

/**
 * Failed stages as one diagnostic value: their names in chain order, joined
 * by commas; "" when every stage answered. The names are a closed list, so
 * the value can never carry a path or client data.
 */
export type FailedStagesField = string & { readonly __failedStages: unique symbol };

function joinStages(stages: readonly ClientVerificationStage[]): string {
  return CLIENT_VERIFICATION_STAGES.filter((stage) => stages.includes(stage)).join(",");
}

/** Whether `value` is exactly what `failedStagesField` can produce. */
export function isFailedStagesField(value: unknown): value is FailedStagesField {
  if (typeof value !== "string") return false;
  if (value === "") return true;
  const names = value.split(",");
  const known = names.flatMap((name) =>
    CLIENT_VERIFICATION_STAGES.filter((stage) => stage === name));
  return known.length === names.length && joinStages(known) === value;
}

export function failedStagesField(stages: readonly ClientVerificationStage[]): FailedStagesField {
  const field = joinStages(stages);
  if (!isFailedStagesField(field)) throw new TypeError("unknown verification stage");
  return field;
}

/**
 * The Enhancement candidate a chain serves, as its capability profile; null
 * when it serves none. The pass and Main name it the same way, so Main can
 * tell its own fallback from the one the pass proved.
 */
export function enhancementCandidateProfile(candidate: EnhancementCapabilities): string | null {
  return enhancementCapabilitiesRequested(candidate) ? enhancementCapabilityProfile(candidate) : null;
}

export interface ClientVerificationLaunchResult extends ClientVerificationLaunch {
  readonly verification: LocalClientVerification | null;
  /** Stages that failed to check rather than refused; empty when every stage answered. */
  readonly failedStages: readonly ClientVerificationStage[];
  /** The Enhancement candidate this chain proved, or null when none passed. */
  readonly enhancementCandidate: string | null;
}

/**
 * Everything one pass proved. Stage builds carry the input they were proved
 * on; a refused stage is simply absent for that input.
 */
export interface ClientVerificationPassResult {
  readonly launches: readonly ClientVerificationLaunchResult[];
  readonly friendObserver: readonly FriendObserverBuild[];
  readonly cartography: readonly CartographySpikeBuild[];
  readonly nativeDoubleClick: readonly NativeDoubleClickBuild[];
  readonly extendedMemory: readonly ExtendedMemoryStructuralProof[];
}

export function sameLaunch(
  left: ClientVerificationLaunch,
  right: ClientVerificationLaunch,
): boolean {
  return left.requestedProfile === right.requestedProfile
    && left.cartography === right.cartography;
}

export function launchCapabilities(
  launch: ClientVerificationLaunch,
): EnhancementCapabilities | null {
  return launch.requestedProfile === "none"
    ? NO_ENHANCEMENT_CAPABILITIES
    : enhancementCapabilitiesForProfile(launch.requestedProfile);
}

const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Prove each launch in order and report after each one, so the caller can
 * start the requested launch before the rest of the pass has finished.
 *
 * The 4 GB proof of the requested launch waits until that launch is reported,
 * unless the launch asks for 4 GB: it is proved either way, so switching 4 GB
 * on later never needs another pass, but only a launch that uses it waits.
 */
export async function runClientVerificationPass(
  official: Uint8Array,
  officialJs: string,
  launches: readonly ClientVerificationLaunch[],
  onLaunch: (result: ClientVerificationPassResult, complete: boolean) => void,
  options: Readonly<{ extendedMemoryFirst: boolean }> = { extendedMemoryFirst: true },
): Promise<void> {
  const officialSha256 = sha256(official);
  const jsSha256 = sha256(officialJs);
  const launchResults: ClientVerificationLaunchResult[] = [];
  const friendObserver: FriendObserverBuild[] = [];
  const cartography: CartographySpikeBuild[] = [];
  const nativeDoubleClick: NativeDoubleClickBuild[] = [];
  const extendedMemory: ExtendedMemoryStructuralProof[] = [];
  // Every launch starts from the same template output; derive it once.
  const templateOutputs = new Map<string, Uint8Array | null>();

  const snapshot = (): ClientVerificationPassResult => Object.freeze({
    launches: Object.freeze([...launchResults]),
    friendObserver: Object.freeze([...friendObserver]),
    cartography: Object.freeze([...cartography]),
    nativeDoubleClick: Object.freeze([...nativeDoubleClick]),
    extendedMemory: Object.freeze([...extendedMemory]),
  });
  const report = async (complete: boolean) => {
    onLaunch(snapshot(), complete);
    // Yield, so the report leaves the process before the next proof occupies
    // this thread for seconds.
    await new Promise((resolve) => setImmediate(resolve));
  };

  for (const [index, launch] of launches.entries()) {
    const failedStages = new Set<ClientVerificationStage>();
    /** A refusal is "no proof"; any other throw marks the stage as not checked. */
    const attempt = <Value>(stage: ClientVerificationStage, run: () => Value): Value | null => {
      try {
        return run();
      } catch (error) {
        if (!isStageRefusal(error)) failedStages.add(stage);
        return null;
      }
    };
    const capabilities = launchCapabilities(launch);
    const verification = capabilities === null ? null : attempt("verification", () =>
      acceptLocalClientVerification(
        verifyLocalClientBytes(official, capabilities),
        officialSha256,
        capabilities,
      ));

    let bytes = official;
    let inputSha256 = officialSha256;
    const advance = (output: Uint8Array | null, expectedSha256: string | null) => {
      if (!output || expectedSha256 === null) return;
      const outputSha256 = sha256(output);
      if (outputSha256 !== expectedSha256) return;
      bytes = output;
      inputSha256 = outputSha256;
    };

    const template = verification?.templateSaveBuild ?? null;
    if (template && template.sha256 === officialSha256) {
      if (!templateOutputs.has(template.outputSha256)) {
        templateOutputs.set(
          template.outputSha256,
          attempt("template", () => rewriteTemplateSaveWasm(official, template)),
        );
      }
      advance(templateOutputs.get(template.outputSha256) ?? null, template.outputSha256);
    }

    let travelAction = false;
    let enhancementCandidate: string | null = null;
    const enhancement = verification?.enhancementBuild ?? null;
    if (
      capabilities
      && enhancement
      && enhancement.sha256 === inputSha256
      && enhancementCapabilitiesRequested(capabilities)
    ) {
      for (const candidate of enhancementCandidates(enhancement, capabilities)) {
        const before = inputSha256;
        advance(
          attempt("enhancement", () => transformEnhancementWasm(bytes, enhancement, candidate)),
          enhancementOutputSha256(enhancement, candidate),
        );
        if (inputSha256 !== before) {
          travelAction = candidate.travelAction;
          enhancementCandidate = enhancementCandidateProfile(candidate);
          break;
        }
      }
    }

    if (travelAction) {
      const known = provedFor(friendObserver, inputSha256, isFriendObserverBuild);
      const proved = bytes;
      const stage = known
        ? {
            build: known,
            output: attempt("friendObserver", () =>
              rewriteFriendObserverWasm(proved, known.certificate)),
          }
        : attempt("friendObserver", () => deriveFriendObserverStage(proved));
      if (stage && isFriendObserverBuild(stage.build, inputSha256)) {
        remember(friendObserver, stage.build, inputSha256, isFriendObserverBuild);
        advance(stage.output, stage.build.outputSha256);
      }
    }

    if (launch.cartography) {
      const build = provedFor(cartography, inputSha256, isCartographySpikeBuild)
        ?? attempt("cartography", () => deriveCartographySpikeBuild(bytes));
      if (isCartographySpikeBuild(build, inputSha256)) {
        remember(cartography, build, inputSha256, isCartographySpikeBuild);
        advance(
          attempt("cartography", () => rewriteCartographySpikeWasm(bytes, build)),
          build.outputSha256,
        );
      }
    }

    const doubleClick = provedFor(nativeDoubleClick, inputSha256, isDerivedNativeDoubleClickBuild)
      ?? attempt("nativeDoubleClick", () => deriveNativeDoubleClickBuild(bytes));
    if (isDerivedNativeDoubleClickBuild(doubleClick, inputSha256)) {
      remember(nativeDoubleClick, doubleClick, inputSha256, isDerivedNativeDoubleClickBuild);
      const proved = bytes;
      advance(
        attempt("nativeDoubleClick", () => rewriteWithBuild(proved, doubleClick)),
        nativeDoubleClickOutputSha256(doubleClick, inputSha256),
      );
    }

    const memoryInput = bytes;
    const memoryInputSha256 = inputSha256;
    const proveMemory = () => {
      const memory = extendedMemory.find((proof) =>
        isExtendedMemoryStructuralProof(proof, jsSha256, memoryInputSha256))
        ?? attempt("extendedMemory", () =>
          deriveExtendedMemoryStructuralProof(officialJs, memoryInput));
      if (
        isExtendedMemoryStructuralProof(memory, jsSha256, memoryInputSha256)
        && !extendedMemory.includes(memory)
      ) extendedMemory.push(memory);
    };
    const last = index === launches.length - 1;
    const memoryLater = index === 0 && !options.extendedMemoryFirst;
    if (!memoryLater) proveMemory();

    launchResults.push(Object.freeze({
      ...launch,
      verification,
      failedStages: Object.freeze([...failedStages]),
      enhancementCandidate,
    }));
    await report(last && !memoryLater);
    if (memoryLater) {
      proveMemory();
      // Replace the reported entry, so a deferred 4 GB failure reaches the
      // final report.
      launchResults[index] = Object.freeze({
        ...launch,
        verification,
        failedStages: Object.freeze([...failedStages]),
        enhancementCandidate,
      });
      if (last) await report(true);
    }
  }
}

function provedFor<Build>(
  builds: readonly Build[],
  inputSha256: string,
  guard: (value: unknown, inputSha256: string) => value is Build,
): Build | null {
  return builds.find((build) => guard(build, inputSha256)) ?? null;
}

function remember<Build>(
  builds: Build[],
  build: Build,
  inputSha256: string,
  guard: (value: unknown, inputSha256: string) => value is Build,
): void {
  if (provedFor(builds, inputSha256, guard) === null) builds.push(build);
}
