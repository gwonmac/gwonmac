/**
 * The registry of retained exact-build Enhancement certificates.
 * Certificate structure and validation live in enhancement-build-model.
 */
import {
  hasValidEnhancementProfileHashes,
  type KnownEnhancementBuild,
} from "./enhancement-build-model.js";
import { REVIEWED_GENERATIONS, reviewedBuilds } from "./reviewed-facts.js";
export * from "./enhancement-build-model.js";

// Retained regression facts for one reviewed generation. Runtime certification
// never grants a capability from this input hash or its historic output hashes;
// the isolated semantic verifier re-derives every requested fact first.
//
// The input is the template-save client, not the raw official module: that
// transform is the floor every launch lands on, and the Enhancement transform is
// layered on top so opting in never costs template save/load. It only appends
// functions and reserves one new terminal table entry, so the main-loop index,
// original table size and every data address below are certified separately for
// each template-save output. The semantic roles use these reviewed facts as
// evidence or regression expectations, not as a launch allowlist.
//
// Every generation's records live in its own `reviewed-client-<id>.ts` and
// reach proofs through `reviewed-facts.ts`.
export const ENHANCEMENT_BUILDS: readonly KnownEnhancementBuild[] = Object.freeze(
  REVIEWED_GENERATIONS.flatMap((generation) => generation.builds),
);

export function findEnhancementBuild(
  sha256: string,
): KnownEnhancementBuild | null {
  return (
    reviewedBuilds().find(
      (build) =>
        build.sha256 === sha256 && hasValidEnhancementProfileHashes(build),
    ) ?? null
  );
}
