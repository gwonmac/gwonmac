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
 * repeats every transform it has to build.
 */
import { createHash } from "node:crypto";
import {
  enhancementCapabilitiesForProfile,
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
import { enhancementOutputSha256 } from "./enhancement-builds.js";
import { transformEnhancementWasm } from "./enhancement-transform.js";
import { enhancementCandidates } from "./client-module.js";
import {
  deriveFriendObserverStage,
  isFriendObserverBuild,
  rewriteFriendObserverWasm,
  type FriendObserverBuild,
} from "./friend-observer-transform.js";
import {
  deriveCartographySpikeBuild,
  isCartographySpikeBuild,
  type CartographySpikeBuild,
} from "./cartography-spike-verifier.js";
import { rewriteCartographySpikeWasm } from "./cartography-spike-client.js";
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
export const CLIENT_VERIFICATION_PASS_ABI = 1;

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

export interface ClientVerificationLaunchResult extends ClientVerificationLaunch {
  readonly verification: LocalClientVerification | null;
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

/** A stage that throws has refused, like one that returns no proof. */
function attempt<Value>(stage: () => Value): Value | null {
  try {
    return stage();
  } catch {
    return null;
  }
}

/**
 * Prove each launch in order and report after each one, so the caller can
 * start the requested launch before the rest of the pass has finished.
 */
export async function runClientVerificationPass(
  official: Uint8Array,
  officialJs: string,
  launches: readonly ClientVerificationLaunch[],
  onLaunch: (result: ClientVerificationPassResult, complete: boolean) => void,
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

  for (const [index, launch] of launches.entries()) {
    const capabilities = launchCapabilities(launch);
    const verification = capabilities === null ? null : attempt(() =>
      acceptLocalClientVerification(
        verifyLocalClientBytes(official, capabilities),
        officialSha256,
        capabilities,
      ));
    launchResults.push(Object.freeze({ ...launch, verification }));

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
          attempt(() => rewriteTemplateSaveWasm(official, template)),
        );
      }
      advance(templateOutputs.get(template.outputSha256) ?? null, template.outputSha256);
    }

    let travelAction = false;
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
          attempt(() => transformEnhancementWasm(bytes, enhancement, candidate)),
          enhancementOutputSha256(enhancement, candidate),
        );
        if (inputSha256 !== before) {
          travelAction = candidate.travelAction;
          break;
        }
      }
    }

    if (travelAction) {
      const known = provedFor(friendObserver, inputSha256, isFriendObserverBuild);
      const proved = bytes;
      const stage = known
        ? { build: known, output: attempt(() => rewriteFriendObserverWasm(proved, known.certificate)) }
        : attempt(() => deriveFriendObserverStage(proved));
      if (stage && isFriendObserverBuild(stage.build, inputSha256)) {
        remember(friendObserver, stage.build, inputSha256, isFriendObserverBuild);
        advance(stage.output, stage.build.outputSha256);
      }
    }

    if (launch.cartography) {
      const build = provedFor(cartography, inputSha256, isCartographySpikeBuild)
        ?? attempt(() => deriveCartographySpikeBuild(bytes));
      if (isCartographySpikeBuild(build, inputSha256)) {
        remember(cartography, build, inputSha256, isCartographySpikeBuild);
        advance(
          attempt(() => rewriteCartographySpikeWasm(bytes, build)),
          build.outputSha256,
        );
      }
    }

    const doubleClick = provedFor(nativeDoubleClick, inputSha256, isDerivedNativeDoubleClickBuild)
      ?? attempt(() => deriveNativeDoubleClickBuild(bytes));
    if (isDerivedNativeDoubleClickBuild(doubleClick, inputSha256)) {
      remember(nativeDoubleClick, doubleClick, inputSha256, isDerivedNativeDoubleClickBuild);
      const proved = bytes;
      advance(
        attempt(() => rewriteWithBuild(proved, doubleClick)),
        nativeDoubleClickOutputSha256(doubleClick, inputSha256),
      );
    }

    // Proved whether or not this launch asks for 4 GB, so switching it on
    // later never needs another pass.
    const memoryInput = bytes;
    const memory = extendedMemory.find((proof) =>
      isExtendedMemoryStructuralProof(proof, jsSha256, inputSha256))
      ?? attempt(() => deriveExtendedMemoryStructuralProof(officialJs, memoryInput));
    if (isExtendedMemoryStructuralProof(memory, jsSha256, inputSha256)) {
      if (!extendedMemory.includes(memory)) extendedMemory.push(memory);
    }

    onLaunch(snapshot(), index === launches.length - 1);
    // Yield, so the report leaves the process before the next launch's proof
    // occupies this thread for seconds.
    await new Promise((resolve) => setImmediate(resolve));
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
