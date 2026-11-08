/**
 * Relocation identity: one fingerprint per function that an equivalent
 * ArenaNet relink leaves unchanged.
 *
 * A relink renumbers functions and moves static data. LLVM encodes every
 * relocatable operand (call targets, static addresses, table indices) as a
 * padded five-byte LEB, so a relink keeps body lengths and changes only those
 * operands. The identity hashes the exact body with each such operand replaced:
 *
 * - a `call` target by its callee's local identity (its body with its own
 *   call targets named by signature), so a retargeted call changes the
 *   identity unless the new callee has the same body up to its own call
 *   targets. A role identity names each callee by its signature instead;
 * - a padded constant or memory offset by its class: the text it points to for
 *   a C string in static data, `data` for other static data, else `other`.
 *
 * Every replaced operand also carries the ordinal of its first occurrence in
 * the body, so "the same callee or address twice" and "two different ones"
 * stay distinct. Opcodes, branches, locals, unpadded constants, call order and
 * the signature stay exact. A role identity also erases the spans its semantic
 * role checks itself. The identity grants nothing: proofs compare it with a
 * reviewed identity and still check every relationship they own. The
 * memory-code digest summarizes every memory-accessing body the same way.
 */
import { createHash } from "node:crypto";
import type { ModuleShape } from "./enhancement-evidence-types.js";
import { dataEvidence } from "./wasm-data-evidence.js";
import { cachedFor } from "./module-views.js";
import type { RelocationSpan } from "./semantic-proof.js";
import { decodeFunctions } from "./wasm-instruction-evidence.js";

const PADDED_OPERAND_BYTES = 5;
const MAX_CACHED_MODULES = 4;
const PRINTABLE_TEXT = /^[\t\n\x20-\x7e]{2,}$/u;

/** One relocatable operand: its byte range, what it names, and its class. */
type Site = Readonly<{ start: number; end: number; key: string; callee: number | null; marker: string }>;
type Identities = Readonly<{
  local: readonly string[];
  full: readonly string[];
  sites: readonly (readonly Site[] | undefined)[];
  memoryCodeSha256: string;
}>;

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

/** Equal bytes identify a module, so two parses of one client share their identities. */
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

function hashBody(
  module: ModuleShape,
  functionIndex: number,
  sites: readonly Site[],
  callee: (target: number) => string,
): string {
  const body = module.bodies[functionIndex - module.functionImportCount]!;
  const ordinals = new Map<string, number>();
  const hash = createHash("sha256");
  hash.update(`${signature(module, functionIndex)}\0`);
  let cursor = 0;
  for (const site of sites) {
    if (!ordinals.has(site.key)) ordinals.set(site.key, ordinals.size);
    const marker = site.callee === null ? site.marker : `call:${callee(site.callee)}`;
    hash.update(body.subarray(cursor, site.start));
    hash.update(`\0${marker}#${ordinals.get(site.key)}\0`);
    cursor = site.end;
  }
  hash.update(body.subarray(cursor));
  return hash.digest("hex");
}

function computeIdentities(module: ModuleShape): Identities {
  const data = dataEvidence(module);
  const staticClass = (value: number): string => {
    const inData = module.dataSegments.some((segment) =>
      value >= segment.base && value < segment.base + segment.bytes.byteLength);
    if (!inData) return "other";
    const text = data.readCString(value);
    return text !== null && PRINTABLE_TEXT.test(text)
      ? `text:${createHash("sha256").update(text).digest("hex").slice(0, 24)}`
      : "data";
  };
  const sites: (readonly Site[] | undefined)[] = [];
  const touchesMemory: number[] = [];
  for (const fn of decodeFunctions(module, [])) {
    if (fn.memorySites.length > 0) touchesMemory.push(fn.functionIndex);
    const found: Site[] = [];
    for (const [target, calls] of fn.callSites) {
      for (const call of calls) {
        found.push({ start: call.offset + 1, end: call.operandEnd, key: `call:${target}`, callee: target, marker: "" });
      }
    }
    for (const site of fn.constantSites) {
      if (
        site.operandEnd - site.operandStart === PADDED_OPERAND_BYTES
        && minimalSlebBytes(site.value) < PADDED_OPERAND_BYTES
      ) {
        found.push({
          start: site.operandStart, end: site.operandEnd, key: `static:${site.value}`,
          callee: null, marker: staticClass(site.value),
        });
      }
    }
    for (const site of fn.memorySites) {
      if (
        site.operandEnd - site.operandStart === PADDED_OPERAND_BYTES
        && minimalUlebBytes(site.value) < PADDED_OPERAND_BYTES
      ) {
        found.push({
          start: site.operandStart, end: site.operandEnd, key: `static:${site.value}`,
          callee: null, marker: staticClass(site.value),
        });
      }
    }
    found.sort((left, right) => left.start - right.start);
    sites[fn.functionIndex] = Object.freeze(found);
  }
  const pass = (callee: (target: number) => string): string[] =>
    module.functionTypeIndices.map((_, functionIndex) =>
      functionIndex < module.functionImportCount
        ? `import:${functionIndex}:${signature(module, functionIndex)}`
        : hashBody(module, functionIndex, sites[functionIndex] ?? [], callee));
  const local = pass((target) => signature(module, target));
  const full = pass((target) => local[target] ?? "?");
  const memoryCode = touchesMemory.map((functionIndex) => local[functionIndex]!).sort();
  return Object.freeze({
    local: Object.freeze(local),
    full: Object.freeze(full),
    sites,
    memoryCodeSha256: createHash("sha256").update(memoryCode.join("\n")).digest("hex"),
  });
}

function identities(module: ModuleShape): Identities {
  return cachedFor(viewCache, module, (shared) => {
    const key = moduleKey(shared);
    const cached = identityCache.get(key);
    if (cached) return cached;
    const computed = computeIdentities(shared);
    if (identityCache.size >= MAX_CACHED_MODULES) {
      identityCache.delete(identityCache.keys().next().value!);
    }
    identityCache.set(key, computed);
    return computed;
  });
}

/** The relocation identity of one defined or imported function. */
export function functionIdentity(module: ModuleShape, functionIndex: number): string {
  const identity = identities(module).full[functionIndex];
  if (identity === undefined) throw new RangeError("relocation identity: no such function");
  return identity;
}

const functionsByIdentity = new WeakMap<Identities, ReadonlyMap<string, readonly number[]>>();

/** The functions of `module` whose relocation identity is `identity`. */
export function functionsWithIdentity(module: ModuleShape, identity: string): readonly number[] {
  const known = identities(module);
  let index = functionsByIdentity.get(known);
  if (!index) {
    const built = new Map<string, number[]>();
    known.full.forEach((value, functionIndex) => {
      if (functionIndex >= module.functionImportCount) {
        built.set(value, [...built.get(value) ?? [], functionIndex]);
      }
    });
    index = built;
    functionsByIdentity.set(known, index);
  }
  return index.get(identity) ?? [];
}

/**
 * The local identity of a function: its relocation identity with each callee
 * named by its signature only, so a change in a callee's body leaves it equal.
 */
export function functionLocalIdentity(module: ModuleShape, functionIndex: number): string {
  const identity = identities(module).local[functionIndex];
  if (identity === undefined) throw new RangeError("relocation identity: no such function");
  return identity;
}

/**
 * Each relocatable operand of a defined function, in body order: its byte
 * range in the body and the name the relocation identity gives it (a callee's
 * local identity, or a static operand's class).
 */
export function relocatableOperands(
  module: ModuleShape,
  functionIndex: number,
): readonly Readonly<{ start: number; end: number; name: string }>[] {
  const known = identities(module);
  return (known.sites[functionIndex] ?? []).map((site) => Object.freeze({
    start: site.start,
    end: site.end,
    name: site.callee === null ? site.marker : `call:${known.local[site.callee] ?? "?"}`,
  }));
}

/**
 * The distinct functions `functionIndex` calls directly, in the order of their
 * first call. Two functions with one identity call corresponding callees at
 * the same position.
 */
export function orderedCallees(module: ModuleShape, functionIndex: number): readonly number[] {
  const callees: number[] = [];
  for (const site of identities(module).sites[functionIndex] ?? []) {
    if (site.callee !== null && !callees.includes(site.callee)) callees.push(site.callee);
  }
  return callees;
}

/**
 * The distinct relocatable static operands of a function, in the order of
 * their first occurrence: the ordinals its identity names. Two functions with
 * one identity hold their corresponding addresses at the same ordinal.
 */
export function staticOperands(module: ModuleShape, functionIndex: number): readonly number[] {
  const values: number[] = [];
  for (const site of identities(module).sites[functionIndex] ?? []) {
    if (site.callee !== null) continue;
    const value = Number(site.key.slice("static:".length));
    if (!values.includes(value)) values.push(value);
  }
  return values;
}

/**
 * The relocation identity of a function seen through a semantic role: the
 * role's own spans are erased the way its fingerprint erases them, because the
 * role's proof checks their values, and each callee is named by its signature.
 * A role proof checks the relations it owns itself, so a change in a callee's
 * body refuses only the features that own that callee: the game-thread drain
 * calls nineteen subsystems, cursor art among them.
 */
export function functionRoleIdentity(
  module: ModuleShape,
  functionIndex: number,
  spans: readonly RelocationSpan[],
): string {
  if (functionIndex < module.functionImportCount) return functionIdentity(module, functionIndex);
  const known = identities(module);
  const kept = (known.sites[functionIndex] ?? []).filter((site) =>
    !spans.some((span) => site.start < span.end && span.start < site.end));
  const erased = spans.map((span): Site => ({
    start: span.start, end: span.end, key: `role:${span.role}`, callee: null,
    marker: `role:${span.addressClass}:${span.role}`,
  }));
  const sites = [...kept, ...erased].sort((left, right) => left.start - right.start);
  return hashBody(module, functionIndex, sites, (target) => signature(module, target));
}


/**
 * The sha256 over the sorted local identities (callees named by signature) of
 * every function that loads or stores memory. Two modules with equal digests
 * access memory with the same code up to relocation, so every structure field
 * offset that one module's code uses, the other's uses too.
 */
export function memoryCodeSha256(module: ModuleShape): string {
  return identities(module).memoryCodeSha256;
}
