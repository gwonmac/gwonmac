/**
 * Runs the one verifier pass and owns everything the proof itself may not:
 * the bounded child process and its time budget.
 *
 * The child gets only the official artifact paths, their hashes, and the
 * launch profiles to prove, requested launch first. It reports after each
 * profile; this host hands on the first report, which holds the requested
 * launch, and the final complete one, and nothing else. Every value stays
 * untrusted until the caller passes it through the acceptance boundary, which
 * also refuses a report that lacks the requested launch.
 *
 * The budget is the reason for the process at all: a client this app did not
 * produce must not be able to hang a launch by hanging the verifier. A crash,
 * timeout or malformed message ends the pass with no answer, which callers
 * report as a failed check and never store.
 */
import { fileURLToPath } from "node:url";
import { utilityProcess, type UtilityProcess } from "electron";
import type { ClientVerificationLaunch } from "./client-verification-pass.js";
import type { VerifierPass } from "../client-verdict.js";

/**
 * One budget for the whole pass, every launch profile included. It bounds a
 * hung or crashed parser, not a slow one: a timeout before the requested
 * launch is reported turns every proved feature off for that launch. The whole
 * pass takes about 12 s on a busy M1 Pro; the bound equals the four 30 s
 * verifier calls it replaces.
 */
export const VERIFIER_PASS_BUDGET_MS = 120_000;

export function runVerifierPass(options: Readonly<{
  wasmPath: string;
  wasmSha256: string;
  jsPath: string;
  jsSha256: string;
  launches: readonly ClientVerificationLaunch[];
}>): VerifierPass {
  let resolveRequested!: (value: unknown) => void;
  let resolveComplete!: (value: unknown) => void;
  const requested = new Promise<unknown>((resolve) => { resolveRequested = resolve; });
  const complete = new Promise<unknown>((resolve) => { resolveComplete = resolve; });
  if (options.launches.length === 0) {
    resolveRequested(null);
    resolveComplete(null);
    return { requested, complete };
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
    ], { serviceName: "Guild Wars client compatibility verifier" });
  } catch {
    resolveRequested(null);
    resolveComplete(null);
    return { requested, complete };
  }
  let settled = false;
  const finish = (value: unknown): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    child.kill();
    resolveRequested(null);
    resolveComplete(value);
  };
  const timeout = setTimeout(() => finish(null), VERIFIER_PASS_BUDGET_MS);
  child.on("message", (value: unknown) => {
    if (!value || typeof value !== "object" || !("result" in value)) {
      finish(null);
      return;
    }
    resolveRequested(value.result);
    if ("complete" in value && value.complete === true) finish(value.result);
  });
  child.once("exit", () => finish(null));
  return { requested, complete };
}
