/**
 * Tells a stage that refused its input from a stage that failed to check it.
 *
 * A refusal is the proof's own answer about these exact bytes: a
 * `ProofRefusal`, which every proof's `fail()` throws and which the shared
 * refusal vocabulary (`EvidenceError`, `ProofLimitError`) extends, or the
 * shared WASM codec's `WasmFormatError` for bytes it cannot read. It is
 * deterministic, so a complete pass may store it. Anything else (a `TypeError`
 * from a bug, a `RangeError` from a stack overflow or a failed allocation, a
 * plain `Error`, a non-Error value) is a defect or a resource failure, says
 * nothing about the build, and must never be stored: the next start checks
 * again.
 *
 * Every catch under `app/client/certification/` decides through
 * `refusedOrRethrow`; tests/policy/certification-catches-only-refusals.test.ts
 * names the few that may not and why.
 */
import { WasmFormatError } from "../../main/core/wasm-binary.js";

/** A proof's refusal of the exact bytes it was given. */
export class ProofRefusal extends Error {}

export function isStageRefusal(error: unknown): boolean {
  return error instanceof ProofRefusal || error instanceof WasmFormatError;
}

/** For a stage's catch block: a refusal is "no proof"; any other failure propagates. */
export function refusedOrRethrow(error: unknown): null {
  if (isStageRefusal(error)) return null;
  throw error;
}
