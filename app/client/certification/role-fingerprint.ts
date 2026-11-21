/**
 * Owns the relocation-aware identity of one client function playing a proved
 * role. Call targets, mutable statics and immutable data addresses are
 * replaced by their role in the function (first callee, second state word, a
 * witness of the data they point at), so a relink that only moves code and
 * data keeps the fingerprint. Field offsets, constants and control flow stay
 * literal, so a changed struct layout or behaviour changes it.
 */
import { createHash } from "node:crypto";
import type { DecodedFunction, ModuleShape } from "./enhancement-evidence-types.js";
import { functionBody, type WasmEvidence } from "./wasm-evidence.js";
import { relocationAwareFingerprint, type RelocationSpan } from "./semantic-proof.js";

const text = new TextEncoder();
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/** One decoded module, as every role proof reads it. */
export interface RoleProofView {
  readonly evidence: WasmEvidence;
  readonly module: ModuleShape;
  readonly decoded: ReadonlyMap<number, DecodedFunction>;
}

/** The view of `evidence` with every defined function decoded once. */
export function roleProofView(evidence: WasmEvidence): RoleProofView {
  return {
    evidence,
    module: evidence.moduleView(),
    decoded: new Map(evidence.decodeFunctions([]).map((entry) => [entry.functionIndex, entry])),
  };
}

export function signatureKey(module: ModuleShape, functionIndex: number): string {
  const typeIndex = module.functionTypeIndices[functionIndex];
  const signature = typeIndex === undefined ? undefined : module.types[typeIndex];
  return signature
    ? `${signature.params.join(",")}=>${signature.results.join(",")}`
    : "missing";
}

function printableCString(value: string | null): value is string {
  return value !== null
    && value.length >= 3
    && [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13
        || (code >= 32 && code <= 126);
    });
}

function immutableWitness(evidence: WasmEvidence, address: number): string | null {
  const value = evidence.data.readCString(address);
  const bytes = printableCString(value)
    ? text.encode(`${value}\0`)
    : evidence.data.readBytes(address, 32);
  if (!bytes) return null;
  const occurrences = evidence.data.addresses(bytes).length;
  if (occurrences < 1) return null;
  return `${sha256(bytes)}:${occurrences}`;
}

/**
 * The fingerprint of `functionIndex`, or null when it has no decoded body or
 * points at data no witness can name. `extraSpans` lets a role relocate
 * operands only it can classify, such as table slots it registers.
 */
export function roleFingerprint(
  view: RoleProofView,
  functionIndex: number,
  extraSpans: readonly RelocationSpan[] = [],
): string | null {
  const body = functionBody(view.module, functionIndex);
  const decoded = view.decoded.get(functionIndex);
  if (!decoded) return null;
  const spans: RelocationSpan[] = [];

  const targetRoles = new Map<number, number>();
  const calls = [...decoded.callSites]
    .flatMap(([target, sites]) => sites.map((site) => ({ target, site })))
    .sort((left, right) => left.site.offset - right.site.offset);
  for (const { target, site } of calls) {
    if (!targetRoles.has(target)) targetRoles.set(target, targetRoles.size);
    spans.push({
      start: site.offset + 1,
      end: site.operandEnd,
      addressClass: "function-index",
      role: `callee-${targetRoles.get(target)}:${signatureKey(view.module, target)}`,
    });
  }

  const operandSites = [...decoded.constantSites, ...decoded.memorySites];
  const mutableSites = operandSites
    .filter((site) =>
      site.value >= view.evidence.data.zeroInitializedBase
      && site.value < view.evidence.data.initialMemoryBytes
    )
    .sort((left, right) => left.offset - right.offset);
  const mutableRoles = new Map<number, number>();
  for (const site of mutableSites) {
    if (!mutableRoles.has(site.value)) mutableRoles.set(site.value, mutableRoles.size);
    spans.push({
      start: site.operandStart,
      end: site.operandEnd,
      addressClass: "mutable-static",
      role: `state-${mutableRoles.get(site.value)}`,
    });
  }

  for (const site of operandSites) {
    if (!view.evidence.data.contains(site.value)) continue;
    const witness = immutableWitness(view.evidence, site.value);
    if (!witness) return null;
    spans.push({
      start: site.operandStart,
      end: site.operandEnd,
      addressClass: "immutable-data",
      role: witness,
    });
  }

  spans.push(...extraSpans);
  return relocationAwareFingerprint(body, spans);
}
