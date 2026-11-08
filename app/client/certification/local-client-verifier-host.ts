/**
 * Runs the one verifier pass and owns everything the proof itself may not:
 * the bounded child process, its hard time bound and its priority.
 *
 * The child gets only the official artifact paths, their hashes, the launch
 * profiles to prove (requested launch first) and whether that launch waits
 * for its 4 GB proof. It reports after each profile; this host hands on the
 * first report, which holds the requested launch, and the final complete one,
 * and nothing else. Every value stays untrusted until the caller passes it
 * through the acceptance boundary, which also refuses a report that lacks the
 * requested launch.
 *
 * How long a launch waits is the caller's decision. This host bounds only the
 * whole pass, so a client this app did not produce can never keep a verifier
 * running: a crash, the hard bound or a malformed message ends the pass with
 * no answer, which callers report as a failed check and never store. A child
 * that ignores the stop is killed after a short grace period.
 */
import { fileURLToPath } from "node:url";
import { constants, setPriority } from "node:os";
import { utilityProcess, type UtilityProcess } from "electron";
import type { ClientVerificationLaunch } from "./client-verification-pass.js";
import type { VerifierPass } from "../client-verdict.js";
import { stoppableVerifierChild } from "./verifier-child-stop.js";

/**
 * The hard bound on one pass, every launch profile included. It bounds a hung
 * parser, not a slow Mac: the pass takes about 12 s on a busy M1 Pro and
 * about 3 minutes on starved efficiency cores, and after the requested launch
 * it runs at low priority while the game plays.
 */
export const VERIFIER_PASS_BOUND_MS = 10 * 60_000;

export function runVerifierPass(options: Readonly<{
  wasmPath: string;
  wasmSha256: string;
  jsPath: string;
  jsSha256: string;
  launches: readonly ClientVerificationLaunch[];
  extendedMemoryFirst: boolean;
}>): VerifierPass {
  let resolveRequested!: (value: unknown) => void;
  let resolveComplete!: (value: unknown) => void;
  const requested = new Promise<unknown>((resolve) => { resolveRequested = resolve; });
  const complete = new Promise<unknown>((resolve) => { resolveComplete = resolve; });
  const none: VerifierPass = { requested, complete, background: () => {}, cancel: () => {} };
  if (options.launches.length === 0) {
    resolveRequested(null);
    resolveComplete(null);
    return none;
  }
  const entry = fileURLToPath(
    new URL("./local-client-verifier-process.js", import.meta.url),
  );
  let child: UtilityProcess;
  try {
    child = utilityProcess.fork(entry, [
      "pass",
      options.wasmPath,
      options.wasmSha256,
      options.jsPath,
      options.jsSha256,
      JSON.stringify(options.launches.map(({ requestedProfile, cartography }) =>
        ({ requestedProfile, cartography }))),
      options.extendedMemoryFirst ? "memory-first" : "memory-later",
    ], { serviceName: "Guild Wars client compatibility verifier" });
  } catch {
    resolveRequested(null);
    resolveComplete(null);
    return none;
  }
  const stop = stoppableVerifierChild(child);
  let settled = false;
  const finish = (value: unknown): void => {
    if (settled) return;
    settled = true;
    clearTimeout(bound);
    stop();
    resolveRequested(null);
    resolveComplete(value);
  };
  const bound = setTimeout(() => finish(null), VERIFIER_PASS_BOUND_MS);
  child.on("message", (value: unknown) => {
    if (!value || typeof value !== "object" || !("result" in value)) {
      finish(null);
      return;
    }
    resolveRequested(value.result);
    if ("complete" in value && value.complete === true) finish(value.result);
  });
  child.once("exit", () => finish(null));
  return {
    requested,
    complete,
    background: () => {
      // The child lowers itself after its first report; this covers a launch
      // that stopped waiting before that report arrived.
      if (settled || child.pid === undefined) return;
      try {
        setPriority(child.pid, constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {
        // Priority is a courtesy to the running game, not a requirement.
      }
    },
    cancel: () => finish(null),
  };
}
