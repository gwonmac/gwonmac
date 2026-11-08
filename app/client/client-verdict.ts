/**
 * Decides where this launch's certification comes from: this install's signed
 * record of the last complete verifier pass for this exact build, or one fresh
 * pass. It owns the one acceptance step both sources share.
 *
 * Either way the answer is the verifier's own output and passes the same
 * guards: `acceptLocalClientVerification` for the requested launch, and the
 * per-stage guards bound to the input Main actually holds. A record that
 * authenticates but fails that boundary is discarded and the build is proved
 * again. A pass that crashes, hits its hard bound, answers malformed or names
 * a stage that failed to check is never stored; the affected launch reports
 * `check-failed` and the next start tries again.
 *
 * The pass proves the requested launch first, and a launch waits for that
 * report at most `LAUNCH_BUDGET_MS`. A slow Mac that misses it plays this
 * launch on the official module with `check-failed`, but the pass is not
 * stopped: it finishes at low priority and stores its record, so the next
 * launch is instant. One pass runs per install at a time; a newer build's
 * activation cancels an older build's pass, which then stores nothing.
 */
import { performance } from "node:perf_hooks";
import {
  acceptLocalClientVerification,
  type LocalClientVerification,
} from "./certification/local-client-verifier.js";
import {
  CLIENT_VERIFICATION_PASS_ABI,
  CLIENT_VERIFICATION_STAGE_ABIS,
  CLIENT_VERIFICATION_STAGES,
  launchCapabilities,
  sameLaunch,
  type ClientVerificationLaunch,
  type ClientVerificationStage,
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
  readonly launches: readonly (ClientVerificationLaunch & {
    readonly verification: unknown;
    readonly failedStages: readonly ClientVerificationStage[];
  })[];
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
      || !("failedStages" in launch) || !boundedArray(launch.failedStages)
    ) return null;
    const failedStages: ClientVerificationStage[] = [];
    for (const stage of launch.failedStages) {
      const known = CLIENT_VERIFICATION_STAGES.find((name) => name === stage);
      if (!known) return null;
      failedStages.push(known);
    }
    launches.push({
      requestedProfile: launch.requestedProfile,
      cartography: launch.cartography,
      verification: launch.verification,
      failedStages,
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
  /** Stages of this launch that failed to check; they report `check-failed`. */
  readonly failedStages: readonly ClientVerificationStage[];
  readonly friendObserver: (inputSha256: string) => FriendObserverBuild | null;
  readonly cartography: (inputSha256: string) => CartographySpikeBuild | null;
  readonly nativeDoubleClick: (inputSha256: string) => NativeDoubleClickBuild | null;
  readonly extendedMemory: (
    jsInputSha256: string,
    wasmInputSha256: string,
  ) => ExtendedMemoryStructuralProof | null;
  /**
   * True once a stage guard threw on this answer. The answer is malformed, so
   * the caller serves the official module with `check-failed` instead.
   */
  readonly guardFailed: () => boolean;
}

/**
 * The verdict for `launch`, or null when the result has none that passes the
 * boundary. A guard that throws on malformed output is a failed check, never
 * an exception for the caller.
 */
export function acceptLaunchVerdict(
  result: UntrustedPassResult,
  launch: ClientVerificationLaunch,
  officialSha256: string,
): ClientVerdict | null {
  try {
    const capabilities = launchCapabilities(launch);
    const entry = result.launches.find((candidate) => sameLaunch(candidate, launch));
    if (!capabilities || !entry) return null;
    const verification = acceptLocalClientVerification(
      entry.verification,
      officialSha256,
      capabilities,
    );
    if (!verification) return null;
    let guardFailed = false;
    const guarded = <Build>(lookup: () => Build | undefined): Build | null => {
      try {
        return lookup() ?? null;
      } catch {
        guardFailed = true;
        return null;
      }
    };
    const find = <Build>(
      builds: readonly unknown[],
      guard: (value: unknown, inputSha256: string) => value is Build,
    ) => (inputSha256: string): Build | null =>
      guarded(() => builds.find((build): build is Build => guard(build, inputSha256)));
    return Object.freeze({
      verification,
      failedStages: entry.failedStages,
      friendObserver: find(result.friendObserver, isFriendObserverBuild),
      cartography: find(result.cartography, isCartographySpikeBuild),
      nativeDoubleClick: find(result.nativeDoubleClick, isDerivedNativeDoubleClickBuild),
      extendedMemory: (jsInputSha256: string, wasmInputSha256: string) =>
        guarded(() => result.extendedMemory.find((proof): proof is ExtendedMemoryStructuralProof =>
          isExtendedMemoryStructuralProof(proof, jsInputSha256, wasmInputSha256))),
      guardFailed: () => guardFailed,
    });
  } catch {
    return null;
  }
}

/** A complete pass may be stored only when every launch passed and no stage failed to check. */
function storable(result: UntrustedPassResult, officialSha256: string): boolean {
  return result.launches.every((launch) =>
    launch.failedStages.length === 0
    && acceptLaunchVerdict(result, launch, officialSha256) !== null);
}

/** One running verifier pass, as the host reports it. */
export interface VerifierPass {
  /** Resolves with the first report, which holds the requested launch; null on any failure. */
  readonly requested: Promise<unknown>;
  /** Resolves with the whole pass only when every launch completed; else null. */
  readonly complete: Promise<unknown>;
  /** Lower the pass's priority: the launch stopped waiting for it. */
  readonly background: () => void;
  /** Stop the pass; `complete` then resolves null. */
  readonly cancel: () => void;
}

export type RunVerifierPass = (options: Readonly<{
  wasmPath: string;
  wasmSha256: string;
  jsPath: string;
  jsSha256: string;
  launches: readonly ClientVerificationLaunch[];
  /** False lets the requested launch report before its 4 GB proof. */
  extendedMemoryFirst: boolean;
}>) => VerifierPass;

/** How long a launch waits for its own report before it plays unchecked. */
export const LAUNCH_BUDGET_MS = 120_000;

interface RunningPass {
  readonly id: string;
  readonly pass: VerifierPass;
  readonly stored: Promise<"stored" | "not-stored">;
}

/** The one pass this install runs at a time. Owned by the client runtime. */
export interface VerifierPassSlot {
  current: RunningPass | null;
}

export function createVerifierPassSlot(): VerifierPassSlot {
  return { current: null };
}

export type ClientVerdictOutcome = Readonly<{
  /** Null only when the check itself failed; a refusal is a verdict. */
  verdict: ClientVerdict | null;
  source: "record" | "pass";
  /** How long Play waited for the pass, or null when the record answered. */
  passMs: number | null;
  /** Settles once the pass is stored or dropped; "not-stored" for a record. */
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
  /** Whether this launch uses 4 GB, so its report waits for that proof. */
  extendedMemoryRequested: boolean;
  runPass: RunVerifierPass;
  slot: VerifierPassSlot;
  launchBudgetMs?: number;
}>): Promise<ClientVerdictOutcome> {
  const key: ClientVerdictRecordKey = {
    officialWasmSha256: options.wasmSha256,
    officialJsSha256: options.jsSha256,
    verifierAbi: SEMANTIC_VERIFIER_ABI,
    passAbi: CLIENT_VERIFICATION_PASS_ABI,
    stageAbis: CLIENT_VERIFICATION_STAGE_ABIS,
    appVersion: options.appVersion,
  };
  const id = JSON.stringify(key);
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
  const { slot } = options;
  // A pass for another build is stale; it must not finish and store.
  if (slot.current && slot.current.id !== id) {
    slot.current.pass.cancel();
    slot.current = null;
  }
  let running = slot.current;
  if (!running) {
    const pass = options.runPass({
      wasmPath: options.wasmPath,
      wasmSha256: options.wasmSha256,
      jsPath: options.jsPath,
      jsSha256: options.jsSha256,
      launches: passLaunches(options.launch, options.releaseLaunches),
      extendedMemoryFirst: options.extendedMemoryRequested,
    });
    const entry: { current: RunningPass | null } = { current: null };
    const stored = pass.complete.then(async (value): Promise<"stored" | "not-stored"> => {
      const complete = readPassResult(value);
      // A newer activation took the slot: this pass stores nothing.
      if (!installKey || !complete || slot.current !== entry.current) return "not-stored";
      if (!storable(complete, options.wasmSha256)) return "not-stored";
      await writeClientVerdictRecord(options.recordPath, key, value, installKey);
      return "stored";
    }).catch((): "not-stored" => "not-stored").finally(() => {
      if (slot.current === entry.current) slot.current = null;
    });
    running = { id, pass, stored };
    entry.current = running;
    slot.current = running;
  }

  // The first report answers a fresh pass. A pass already running for another
  // launch of this build answers only once it completes.
  const budget = options.launchBudgetMs ?? LAUNCH_BUDGET_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), budget); });
  const accept = (value: unknown) => {
    const result = readPassResult(value);
    return result ? acceptLaunchVerdict(result, options.launch, options.wasmSha256) : null;
  };
  const verdict = accept(await Promise.race([running.pass.requested, expired]))
    ?? accept(await Promise.race([running.pass.complete, expired]));
  clearTimeout(timer);
  if (!verdict) running.pass.background();
  return {
    verdict,
    source: "pass",
    passMs: Math.round(performance.now() - started),
    stored: running.stored,
  };
}
