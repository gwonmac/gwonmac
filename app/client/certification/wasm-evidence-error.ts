/**
 * Shared refusal vocabulary for bounded WASM evidence collection.
 * Feature locators translate these failures into their own verdicts.
 */
import type { EnhancementEvidenceFailure } from "./enhancement-evidence-types.js";
import { ProofRefusal } from "./stage-refusal.js";

export class EvidenceError extends ProofRefusal {
  readonly code: EnhancementEvidenceFailure;

  constructor(code: EnhancementEvidenceFailure) {
    super(code);
    this.code = code;
  }
}
