/**
 * Tells a stage that refused its input from a stage that failed to check it.
 *
 * A refusal is the proof's own answer about these exact bytes: the stage
 * throws a plain `Error` from its `fail()` helper, or the shared refusal
 * vocabulary (`EvidenceError`, `ProofLimitError`). It is deterministic, so a
 * complete pass may store it. Anything else (a `TypeError`, a `RangeError`
 * from a stack overflow or an allocation, a non-Error value) is a defect or a
 * resource failure, says nothing about the build, and must never be stored:
 * the next start checks again.
 */
import { ProofLimitError } from "./semantic-proof.js";
import { EvidenceError } from "./wasm-evidence-error.js";

export function isStageRefusal(error: unknown): boolean {
  return error instanceof EvidenceError
    || error instanceof ProofLimitError
    || (error instanceof Error && Object.getPrototypeOf(error) === Error.prototype);
}

/** For a stage's catch block: a refusal is "no proof"; any other failure propagates. */
export function refusedOrRethrow(error: unknown): null {
  if (isStageRefusal(error)) return null;
  throw error;
}
