/**
 * Isolated semantic qualification for the Cartography transform.
 *
 * Cartography is not tied to a whole-client hash. Instead, the verifier derives
 * the exact frame, game-context, area-table, and agent-array layout consumed by
 * the transform and sealed reachability kernel. The main process receives only
 * this bounded certificate and independently reproduces its exact output.
 */
import { createHash } from "node:crypto";
import { refusedOrRethrow } from "./stage-refusal.js";
import { deriveCartographyLayout } from "./cartography-layout-proof.js";
import {
  CARTOGRAPHY_SPIKE_TRANSFORM_ABI,
  transformCartographySpikeWasm,
} from "./pathing-spike-transform.js";

const SHA256 = /^[0-9a-f]{64}$/;

export interface CartographySpikeBuild {
  readonly inputSha256: string;
  readonly transformAbi: typeof CARTOGRAPHY_SPIKE_TRANSFORM_ABI;
  /** The roots the derived client's manifest publishes for the kernel. */
  readonly contextRoot: number;
  readonly agentArray: number;
  readonly outputSha256: string;
}

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/** Derive one exact Cartography transaction from semantically unchanged input. */
export function deriveCartographySpikeBuild(
  input: Uint8Array,
): CartographySpikeBuild | null {
  try {
    const layout = deriveCartographyLayout(input);
    if (!layout) return null;
    const roots = Object.freeze({ contextRoot: layout.contextRoot, agentArray: layout.agentArray });
    return Object.freeze({
      inputSha256: sha256(input),
      transformAbi: CARTOGRAPHY_SPIKE_TRANSFORM_ABI,
      ...roots,
      outputSha256: sha256(transformCartographySpikeWasm(input, roots)),
    });
  } catch (error) {
    return refusedOrRethrow(error);
  }
}

/** A native root the kernel can be given: a nonzero, aligned 32-bit address. */
const isRoot = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 0xffff_ffff && Number(value) % 4 === 0;

/**
 * Validate the small record returned across the utility-process boundary. It
 * checks shape only; the transform derives the roots again and refuses others.
 */
export function isCartographySpikeBuild(
  value: unknown,
  inputSha256: string,
): value is CartographySpikeBuild {
  if (!value || typeof value !== "object") return false;
  const build = value as Partial<CartographySpikeBuild>;
  return Object.keys(value).length === 5
    && build.inputSha256 === inputSha256
    && SHA256.test(build.inputSha256)
    && build.transformAbi === CARTOGRAPHY_SPIKE_TRANSFORM_ABI
    && isRoot(build.contextRoot)
    && isRoot(build.agentArray)
    && typeof build.outputSha256 === "string"
    && SHA256.test(build.outputSha256);
}

/** The Cartography module for one certified input; the transform rechecks it. */
export function rewriteCartographySpikeWasm(
  input: Uint8Array,
  build: CartographySpikeBuild,
): Uint8Array {
  return transformCartographySpikeWasm(input, { contextRoot: build.contextRoot, agentArray: build.agentArray });
}
