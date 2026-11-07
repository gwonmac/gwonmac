/**
 * Relocation identity: one fingerprint per function that an equivalent
 * ArenaNet relink leaves unchanged.
 *
 * A relink renumbers functions and moves static data. LLVM encodes every
 * relocatable operand (call targets, static addresses, table indices) as a
 * padded five-byte LEB, so a relink keeps body lengths and changes only those
 * operands. The identity hashes the exact body with each such operand replaced:
 *
 * - a `call` target by its callee's local identity, so a retargeted call
 *   changes the identity unless the new callee has the same body up to its own
 *   call targets;
 * - a padded constant or memory offset by its class: the text it points to for
 *   a C string in static data, `data` for other static data, else `other`.
 *
 * Every replaced operand also carries the ordinal of its first occurrence in
 * the body, so "the same callee or address twice" and "two different ones"
 * stay distinct. Opcodes, branches, locals, unpadded constants, call order and
 * the signature stay exact. The identity grants nothing: proofs compare it with
 * a reviewed identity and still check every relationship they own.
 */
import { createHash } from "node:crypto";
import type { ModuleShape } from "./enhancement-evidence-types.js";
import { dataEvidence } from "./wasm-data-evidence.js";
import { decodeFunctions } from "./wasm-instruction-evidence.js";

const PADDED_OPERAND_BYTES = 5;
const MAX_CACHED_MODULES = 4;
const PRINTABLE_TEXT = /^[\t\n\x20-\x7e]{2,}$/u;

type Identities = Readonly<{ local: readonly string[]; full: readonly string[] }>;

const identityCache = new Map<string, Identities>();
const viewCache = new WeakMap<ModuleShape, Identities>();

function minimalSlebBytes(value: number): number {
  let bytes = 1;
  while (value < -(2 ** (7 * bytes - 1)) || value >= 2 ** (7 * bytes - 1)) bytes += 1;
  return bytes;
}

function minimalUlebBytes(value: number): number {
  let bytes = 1;
  while (value >= 2 ** (7 * bytes)) bytes += 1;
  return bytes;
}

function signature(module: ModuleShape, functionIndex: number): string {
  const type = module.types[module.functionTypeIndices[functionIndex] ?? -1];
  return type ? `${type.params.join(",")}>${type.results.join(",")}` : "?";
}

/** Bodies identify a module view: clones of one module share their key. */
function moduleKey(module: ModuleShape): string {
  const hash = createHash("sha256");
  hash.update(`${module.functionImportCount}:${module.functionTypeIndices.length}:`);
  for (const body of module.bodies) hash.update(body);
  for (const segment of module.dataSegments) {
    hash.update(`${segment.base}:`);
    hash.update(segment.bytes);
  }
  return hash.digest("hex");
}

function computeIdentities(module: ModuleShape): Identities {
  const data = dataEvidence(module);
  const decoded = decodeFunctions(module, []);
  const staticClass = (value: number): string => {
    const inData = module.dataSegments.some((segment) =>
      value >= segment.base && value < segment.base + segment.bytes.byteLength);
    if (!inData) return "other";
    const text = data.readCString(value);
    return text !== null && PRINTABLE_TEXT.test(text)
      ? `text:${createHash("sha256").update(text).digest("hex").slice(0, 24)}`
      : "data";
  };
  const pass = (callee: (target: number) => string): string[] => {
    const identities: string[] = module.functionTypeIndices.map((_, functionIndex) =>
      functionIndex < module.functionImportCount
        ? `import:${functionIndex}:${signature(module, functionIndex)}`
        : "");
    for (const fn of decoded) {
      const body = module.bodies[fn.functionIndex - module.functionImportCount]!;
      const spans: [start: number, end: number, key: string, marker: string][] = [];
      for (const [target, sites] of fn.callSites) {
        for (const site of sites) {
          spans.push([site.offset + 1, site.operandEnd, `call:${target}`, `call:${callee(target)}`]);
        }
      }
      for (const site of fn.constantSites) {
        if (
          site.operandEnd - site.operandStart === PADDED_OPERAND_BYTES
          && minimalSlebBytes(site.value) < PADDED_OPERAND_BYTES
        ) spans.push([site.operandStart, site.operandEnd, `static:${site.value}`, staticClass(site.value)]);
      }
      for (const site of fn.memorySites) {
        if (
          site.operandEnd - site.operandStart === PADDED_OPERAND_BYTES
          && minimalUlebBytes(site.value) < PADDED_OPERAND_BYTES
        ) spans.push([site.operandStart, site.operandEnd, `static:${site.value}`, staticClass(site.value)]);
      }
      spans.sort((left, right) => left[0] - right[0]);
      const ordinals = new Map<string, number>();
      const hash = createHash("sha256");
      hash.update(`${signature(module, fn.functionIndex)}\0`);
      let cursor = 0;
      for (const [start, end, key, marker] of spans) {
        if (!ordinals.has(key)) ordinals.set(key, ordinals.size);
        hash.update(body.subarray(cursor, start));
        hash.update(`\0${marker}#${ordinals.get(key)}\0`);
        cursor = end;
      }
      hash.update(body.subarray(cursor));
      identities[fn.functionIndex] = hash.digest("hex");
    }
    return identities;
  };
  const local = pass((target) => signature(module, target));
  const full = pass((target) => local[target] ?? "?");
  return Object.freeze({ local: Object.freeze(local), full: Object.freeze(full) });
}

function identities(module: ModuleShape): Identities {
  const viewed = viewCache.get(module);
  if (viewed) return viewed;
  const key = moduleKey(module);
  const cached = identityCache.get(key);
  if (cached) {
    viewCache.set(module, cached);
    return cached;
  }
  const computed = computeIdentities(module);
  if (identityCache.size >= MAX_CACHED_MODULES) {
    identityCache.delete(identityCache.keys().next().value!);
  }
  identityCache.set(key, computed);
  viewCache.set(module, computed);
  return computed;
}

/** The relocation identity of one defined or imported function. */
export function functionIdentity(module: ModuleShape, functionIndex: number): string {
  const identity = identities(module).full[functionIndex];
  if (identity === undefined) throw new RangeError("relocation identity: no such function");
  return identity;
}

/** Every function index whose relocation identity is `identity`. */
export function functionsWithIdentity(module: ModuleShape, identity: string): readonly number[] {
  const matches: number[] = [];
  identities(module).full.forEach((candidate, functionIndex) => {
    if (candidate === identity && functionIndex >= module.functionImportCount) {
      matches.push(functionIndex);
    }
  });
  return matches;
}
