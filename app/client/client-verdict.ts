/**
 * Decides where this launch's certification comes from: this install's signed
 * record of the last complete verifier pass for this exact build, or one fresh
 * pass. It owns the one acceptance step both sources share.
 *
 * Either way the answer is the verifier's own output and passes the same
 * guards: `acceptLocalClientVerification` for the requested launch, and the
 * per-stage guards bound to the input Main actually holds. A record that
 * authenticates but fails that boundary is discarded and the build is proved
 * again. A pass that times out, crashes or answers malformed is never stored
 * and reports `check-failed`; the next start tries again.
 *
 * The pass proves the requested launch first, so Play waits only for that
 * chain. The other release launches finish in the background and the record
 * is written only once the whole pass completed, so switching Tools or 4 GB
 * later never needs another pass on this build.
 */
import { performance } from "node:perf_hooks";
import {
  acceptLocalClientVerification,
  type LocalClientVerification,
} from "./certification/local-client-verifier.js";
import {
  CLIENT_VERIFICATION_PASS_ABI,
  launchCapabilities,
  sameLaunch,
  type ClientVerificationLaunch,
} from "./certification/client-verification-pass.js";
import { SEMANTIC_VERIFIER_ABI } from "./certification/semantic-proof.js";
import {
  isFriendObserverBuild,
  type FriendObserverBuild,
} from "./certification/friend-observer-transform.js";
import {
  isCartographySpikeBuild,
  type CartographySpikeBuild,
} from "./certification/cartography-spike-verifier.js";
import {
  isDerivedNativeDoubleClickBuild,
  type NativeDoubleClickBuild,
} from "./certification/native-double-click.js";
import {
  isExtendedMemoryStructuralProof,
  type ExtendedMemoryStructuralProof,
} from "./certification/extended-memory.js";
import {
  discardClientVerdictRecord,
  readClientVerdictRecord,
  writeClientVerdictRecord,
  type ClientVerdictRecordKey,
} from "./client-verdict-record.js";

/** A pass result whose shape is checked and whose contents are still untrusted. */
export interface UntrustedPassResult {
  readonly launches: readonly (ClientVerificationLaunch & { readonly verification: unknown })[];
  readonly friendObserver: readonly unknown[];
  readonly cartography: readonly unknown[];
  readonly nativeDoubleClick: readonly unknown[];
  readonly extendedMemory: readonly unknown[];
}

/** Bounds a hostile or corrupt answer before anything iterates it. */
const MAX_ENTRIES = 16;

function boundedArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length <= MAX_ENTRIES;
}

/** Shape only. Every value inside is judged later by its own guard. */
export function readPassResult(value: unknown): UntrustedPassResult | null {
  if (
    !value || typeof value !== "object"
    || !("launches" in value) || !boundedArray(value.launches)
    || !("friendObserver" in value) || !boundedArray(value.friendObserver)
    || !("cartography" in value) || !boundedArray(value.cartography)
    || !("nativeDoubleClick" in value) || !boundedArray(value.nativeDoubleClick)
    || !("extendedMemory" in value) || !boundedArray(value.extendedMemory)
  ) return null;
  const launches: UntrustedPassResult["launches"][number][] = [];
  for (const launch of value.launches) {
    if (
      !launch || typeof launch !== "object"
      || !("requestedProfile" in launch) || typeof launch.requestedProfile !== "string"
      || !("cartography" in launch) || typeof launch.cartography !== "boolean"
      || !("verification" in launch)
    ) return null;
    launches.push({
      requestedProfile: launch.requestedProfile,
      cartography: launch.cartography,
      verification: launch.verification,
    });
  }
  return {
    launches,
    friendObserver: value.friendObserver,
    cartography: value.cartography,
    nativeDoubleClick: value.nativeDoubleClick,
    extendedMemory: value.extendedMemory,
  };
}

/**
 * Certification for one launch, accepted at the process boundary. Each stage
 * lookup returns only a proof the stage's own guard accepts for that exact
 * input; anything else is "no proof", as a refused stage always was.
 */
export interface ClientVerdict {
  readonly verification: LocalClientVerification;
  readonly friendObserver: (inputSha256: string) => FriendObserverBuild | null;
  readonly cartography: (inputSha256: string) => CartographySpikeBuild | null;
  readonly nativeDoubleClick: (inputSha256: string) => NativeDoubleClickBuild | null;
  readonly extendedMemory: (
    jsInputSha256: string,
    wasmInputSha256: string,
  ) => ExtendedMemoryStructuralProof | null;
}

/** The verdict for `launch`, or null when the result has none that passes the boundary. */
export function acceptLaunchVerdict(
  result: UntrustedPassResult,
  launch: ClientVerificationLaunch,
  officialSha256: string,
): ClientVerdict | null {
  const capabilities = launchCapabilities(launch);
  const entry = result.launches.find((candidate) => sameLaunch(candidate, launch));
  if (!capabilities || !entry) return null;
  const verification = acceptLocalClientVerification(
    entry.verification,
    officialSha256,
    capabilities,
  );
  if (!verification) return null;
  const find = <Build>(
    builds: readonly unknown[],
    guard: (value: unknown, inputSha256: string) => value is Build,
  ) => (inputSha256: string): Build | null =>
    builds.find((build): build is Build => guard(build, inputSha256)) ?? null;
  return Object.freeze({
    verification,
    friendObserver: find(result.friendObserver, isFriendObserverBuild),
    cartography: find(result.cartography, isCartographySpikeBuild),
    nativeDoubleClick: find(result.nativeDoubleClick, isDerivedNativeDoubleClickBuild),
    extendedMemory: (jsInputSha256: string, wasmInputSha256: string) =>
      result.extendedMemory.find((proof): proof is ExtendedMemoryStructuralProof =>
        isExtendedMemoryStructuralProof(proof, jsInputSha256, wasmInputSha256)) ?? null,
  });
}

/** The two answers one verifier pass gives: this launch's, and the whole pass. */
export interface VerifierPass {
  /** Resolves as soon as the requested launch is proved; null on any failure. */
  readonly requested: Promise<unknown>;
  /** Resolves with the whole pass only when every launch completed; else null. */
  readonly complete: Promise<unknown>;
}

export type RunVerifierPass = (options: Readonly<{
  wasmPath: string;
  wasmSha256: string;
  jsPath: string;
  jsSha256: string;
  launches: readonly ClientVerificationLaunch[];
}>) => VerifierPass;

export type ClientVerdictOutcome = Readonly<{
  /** Null only when the check itself failed; a refusal is a verdict. */
  verdict: ClientVerdict | null;
  source: "record" | "pass";
  /** How long Play waited for the pass, or null when the record answered. */
  passMs: number | null;
  /** Settles once the background part of the pass is stored or dropped. */
  stored: Promise<"stored" | "not-stored">;
}>;

/** Requested launch first, then every other release launch, each once. */
export function passLaunches(
  requested: ClientVerificationLaunch,
  releases: readonly ClientVerificationLaunch[],
): ClientVerificationLaunch[] {
  return [requested, ...releases].filter((launch, index, all) =>
    all.findIndex((other) => sameLaunch(other, launch)) === index);
}

export async function obtainClientVerdict(options: Readonly<{
  recordPath: string;
  appVersion: string;
  /** The install key from the Keychain, or null when none can be used. */
  installKey: () => Promise<Uint8Array | null>;
  wasmPath: string;
  wasmSha256: string;
  jsPath: string;
  jsSha256: string;
  launch: ClientVerificationLaunch;
  releaseLaunches: readonly ClientVerificationLaunch[];
  runPass: RunVerifierPass;
}>): Promise<ClientVerdictOutcome> {
  const key: ClientVerdictRecordKey = {
    officialWasmSha256: options.wasmSha256,
    officialJsSha256: options.jsSha256,
    verifierAbi: SEMANTIC_VERIFIER_ABI,
    passAbi: CLIENT_VERIFICATION_PASS_ABI,
    appVersion: options.appVersion,
  };
  const installKey = await options.installKey().catch(() => null);
  if (installKey) {
    const stored = readPassResult(
      await readClientVerdictRecord(options.recordPath, key, installKey),
    );
    const verdict = stored
      ? acceptLaunchVerdict(stored, options.launch, options.wasmSha256)
      : null;
    if (verdict) {
      return { verdict, source: "record", passMs: null, stored: Promise.resolve("not-stored") };
    }
    // An authenticated record this boundary refuses is not kept as a cache.
    if (stored) await discardClientVerdictRecord(options.recordPath).catch(() => undefined);
  }

  const started = performance.now();
  const pass = options.runPass({
    wasmPath: options.wasmPath,
    wasmSha256: options.wasmSha256,
    jsPath: options.jsPath,
    jsSha256: options.jsSha256,
    launches: passLaunches(options.launch, options.releaseLaunches),
  });
  const requested = readPassResult(await pass.requested);
  const verdict = requested
    ? acceptLaunchVerdict(requested, options.launch, options.wasmSha256)
    : null;
  const passMs = Math.round(performance.now() - started);
  const stored = pass.complete.then(async (value): Promise<"stored" | "not-stored"> => {
    const complete = readPassResult(value);
    if (
      !verdict
      || !installKey
      || !complete
      || !complete.launches.every((launch) =>
        acceptLaunchVerdict(complete, launch, options.wasmSha256) !== null)
    ) return "not-stored";
    await writeClientVerdictRecord(options.recordPath, key, value, installKey);
    return "stored";
  }).catch((): "not-stored" => "not-stored");
  return { verdict, source: "pass", passMs, stored };
}
