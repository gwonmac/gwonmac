/**
 * The sound decode repair: makes the client's MP3 decode task free its
 * decoder's seek index, so a sound-dense fight no longer fills the 2 GB heap.
 *
 * The decode task (`HDecodeTask`, Engine/Sound/SndThread.cpp) holds a minimp3
 * `mp3dec_ex_t` at `this + 88`, opens it in its constructor and never calls
 * `mp3dec_ex_close`. Opening builds a seek index through a callback that
 * reallocates `index.frames` (`+6680` in the decoder), so every decoded sound
 * abandons a 64 KiB block. Found and measured by foogw (gwonmac/gwonmac#20).
 *
 * The repair inserts three statements and moves nothing:
 * - the constructor first zeroes `index.frames`, because the open returns
 *   before clearing the decoder when it refuses its arguments;
 * - both destructors (complete and deleting) first `free(index.frames)`.
 *
 * The proof locates every role by its relocation-aware fingerprint and checks
 * how they connect: the destructors and constructor share the task's vtable,
 * the constructor passes `this + 88` to the open, the open registers the index
 * callback and clears 11,424 bytes, and the callback is the only function in
 * the module that touches `+6680`, so nothing else frees the index. A build
 * where any of this changed is refused and runs without the repair.
 */
import { createHash } from "node:crypto";
import { ProofRefusal, refusedOrRethrow } from "./stage-refusal.js";
import {
  concat,
  encodeCode,
  encodeSection,
  readUleb,
  sectionById,
  splitSections,
  valueTypeName,
  WASM_HEADER,
  type Section,
} from "../../main/core/wasm-binary.js";
import type { ModuleShape } from "./enhancement-evidence-types.js";
import type { DecodedFunction } from "./enhancement-evidence-types.js";
import { functionBody, wasmEvidence } from "./wasm-evidence.js";
import { roleFingerprint, roleProofView, type RoleProofView } from "./role-fingerprint.js";
import type { RelocationSpan } from "./semantic-proof.js";
import { call, i32Const, i32Load, i32Store, localGet } from "./wasm-emit.js";

declare const WebAssembly: {
  validate(bytes: Uint8Array): boolean;
};

export const SOUND_DECODE_REPAIR_TRANSFORM_ABI = 1;

/** Where the task keeps its decoder, and where the decoder keeps `index.frames`. */
export const DECODE_TASK_DECODER_OFFSET = 88;
export const DECODER_INDEX_FRAMES_OFFSET = 6_680;
/** `this->decoder.index.frames`, as the inserted statements address it. */
export const DECODE_TASK_INDEX_FRAMES_OFFSET = DECODE_TASK_DECODER_OFFSET + DECODER_INDEX_FRAMES_OFFSET;
/** `sizeof(mp3dec_ex_t)`: what the open clears before it builds the index. */
const DECODER_SIZE = 11_424;

type Role = "destructor" | "deletingDestructor" | "constructor" | "open" | "indexCallback";

interface RoleSpec {
  readonly bodyLength: number;
  readonly signature: string;
  readonly fingerprint: string;
}

/** Identical in every retained client from before August 26 through f2a2b07c9c56. */
const ROLE_SPECS: Readonly<Record<Role, RoleSpec>> = Object.freeze({
  destructor: { bodyLength: 34, signature: "i32=>i32", fingerprint: "d084c036aeb94451994dbd3214708e8ef67fd56f2b53dd31e2b5674519cd9532" },
  deletingDestructor: { bodyLength: 44, signature: "i32=>", fingerprint: "ff8db6b5e766f8170cfff3f43e287891d16279c98fff59f43cece6c5ca51ba72" },
  constructor: { bodyLength: 423, signature: "i32,i32,i32,i32,i32,i32,i32=>i32", fingerprint: "4b1202d9d9239ca85afe3def3c7dbd0a5bd413b3d90c3102949cd72c0c0ed2b7" },
  open: { bodyLength: 288, signature: "i32,i32,i32,i32=>i32", fingerprint: "d9ce3129ef9b0e98f2fb684baeeb6f4ba3ffda71228e8d16a2e1f61aaeef0fad" },
  indexCallback: { bodyLength: 666, signature: "i32,i32,i32,i32,i32,i64,i32=>i32", fingerprint: "b2360619b9c15a37ed68f9b220b1b583a8c3d2c3abaafbffe342eec6ed14a9d8" },
});

/** Body offsets the proof reads: the open call in the constructor, the callback slot in the open. */
const CONSTRUCTOR_OPEN_CALL = 196;
const OPEN_CALLBACK_SLOT = 140;
const OPEN_DECODER_SIZE = 91;

export const SOUND_DECODE_REPAIR_PROOF_SHA256 = createHash("sha256").update(JSON.stringify({
  roles: ROLE_SPECS,
  offsets: [DECODE_TASK_DECODER_OFFSET, DECODER_INDEX_FRAMES_OFFSET, DECODER_SIZE],
  sites: [CONSTRUCTOR_OPEN_CALL, OPEN_CALLBACK_SLOT, OPEN_DECODER_SIZE],
  contract: "decode-task-vtable-open-index-callback-sole-owner-v1",
})).digest("hex");

/** What production rewrites, bound to the exact bodies the proof located. */
export interface SoundDecodeRepairBuild {
  readonly proofSha256: string;
  readonly constructorFunctionIndex: number;
  readonly destructorFunctionIndex: number;
  readonly deletingDestructorFunctionIndex: number;
  /** The module's exported `free`. */
  readonly freeFunctionIndex: number;
  /** SHA-256 of the constructor, destructor and deleting destructor bodies, before the rewrite. */
  readonly bodySha256: readonly [string, string, string];
  /** The one input this build was proved on -> the exact hash this stage produces. */
  readonly derivations: Readonly<Record<string, string>>;
}

/** A function's signature in value type names, such as `i32,i32=>i32`. */
function signatureOf(module: ModuleShape, functionIndex: number): string | null {
  const typeIndex = module.functionTypeIndices[functionIndex];
  const type = typeIndex === undefined ? undefined : module.types[typeIndex];
  return type
    ? `${type.params.map(valueTypeName).join(",")}=>${type.results.map(valueTypeName).join(",")}`
    : null;
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const isSha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const isIndex = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function fail(message: string): never {
  throw new ProofRefusal(`sound decode repair: ${message}`);
}

export function soundDecodeRepairOutputSha256(build: SoundDecodeRepairBuild, inputSha256: string): string | null {
  return build.derivations[inputSha256] ?? null;
}

/** Validate a record that crossed the isolated-process boundary. */
export function isSoundDecodeRepairBuild(value: unknown, inputSha256: string): value is SoundDecodeRepairBuild {
  if (!value || typeof value !== "object") return false;
  const build = value as Partial<SoundDecodeRepairBuild>;
  return build.proofSha256 === SOUND_DECODE_REPAIR_PROOF_SHA256
    && isIndex(build.constructorFunctionIndex)
    && isIndex(build.destructorFunctionIndex)
    && isIndex(build.deletingDestructorFunctionIndex)
    && isIndex(build.freeFunctionIndex)
    && Array.isArray(build.bodySha256)
    && build.bodySha256.length === 3
    && build.bodySha256.every(isSha256)
    && !!build.derivations
    && typeof build.derivations === "object"
    && Object.keys(build.derivations).length === 1
    && isSha256(build.derivations[inputSha256]);
}

/** The open's callback slot is a table index, so a relink may move it. */
function openSlotSpans(decoded: DecodedFunction): readonly RelocationSpan[] | null {
  const site = decoded.constantSites.find((entry) => entry.opcode === 0x41 && entry.offset === OPEN_CALLBACK_SLOT);
  return site
    ? [{ start: site.operandStart, end: site.operandEnd, addressClass: "function-index", role: "index-callback-slot" }]
    : null;
}

function fingerprint(view: RoleProofView, functionIndex: number, role: Role): string | null {
  if (role !== "open") return roleFingerprint(view, functionIndex);
  const decoded = view.decoded.get(functionIndex);
  const spans = decoded ? openSlotSpans(decoded) : null;
  return spans ? roleFingerprint(view, functionIndex, spans) : null;
}

function uniqueRole(view: RoleProofView, role: Role): number | null {
  const spec = ROLE_SPECS[role];
  let match: number | null = null;
  for (let index = view.module.functionImportCount; index < view.module.functionTypeIndices.length; index += 1) {
    if (
      view.module.bodies[index - view.module.functionImportCount]!.byteLength !== spec.bodyLength
      || signatureOf(view.module, index) !== spec.signature
      || fingerprint(view, index, role) !== spec.fingerprint
    ) continue;
    if (match !== null) return null;
    match = index;
  }
  return match;
}

const constantAt = (decoded: DecodedFunction, offset: number): number | null =>
  decoded.constantSites.find((site) => site.opcode === 0x41 && site.offset === offset)?.value ?? null;

const callTargetAt = (decoded: DecodedFunction, offset: number): number | null =>
  [...decoded.callSites].find(([, sites]) => sites.some((site) => site.offset === offset))?.[0] ?? null;

/** The task's vtable: the first constant both destructors store into `this`. */
const vtable = (decoded: DecodedFunction): number | null => decoded.constantSites[0]?.value ?? null;

function exportedFree(view: RoleProofView): number | null {
  const free = view.module.exports.filter((entry) => entry.name === "free" && entry.kind === 0);
  return free.length === 1 && signatureOf(view.module, free[0]!.index) === "i32=>" ? free[0]!.index : null;
}

function prove(view: RoleProofView): Omit<SoundDecodeRepairBuild, "derivations"> | null {
  const roles = Object.fromEntries(
    (Object.keys(ROLE_SPECS) as Role[]).map((role) => [role, uniqueRole(view, role)]),
  ) as Record<Role, number | null>;
  if (Object.values(roles).some((index) => index === null)) return null;
  const located = roles as Record<Role, number>;
  const decoded = (role: Role) => view.decoded.get(located[role])!;
  const task = vtable(decoded("destructor"));
  const callbackSlots = view.evidence.tableRelations.get(located.indexCallback) ?? [];
  const slot = constantAt(decoded("open"), OPEN_CALLBACK_SLOT);
  const free = exportedFree(view);
  if (
    task === null
    || vtable(decoded("deletingDestructor")) !== task
    || !decoded("constructor").constantSites.some((site) => site.value === task)
    || callTargetAt(decoded("constructor"), CONSTRUCTOR_OPEN_CALL) !== located.open
    || slot === null
    || !callbackSlots.includes(slot)
    || constantAt(decoded("open"), OPEN_DECODER_SIZE) !== DECODER_SIZE
    || DECODER_INDEX_FRAMES_OFFSET + 4 > DECODER_SIZE
    || free === null
  ) return null;
  // The callback is the index's only owner: nothing else could free it twice.
  const owners = [...view.decoded.values()].filter((entry) =>
    entry.memorySites.some((site) => site.value === DECODER_INDEX_FRAMES_OFFSET));
  if (owners.length !== 1 || owners[0]!.functionIndex !== located.indexCallback) return null;
  const body = (role: Role) => sha256(functionBody(view.module, located[role]));
  return {
    proofSha256: SOUND_DECODE_REPAIR_PROOF_SHA256,
    constructorFunctionIndex: located.constructor,
    destructorFunctionIndex: located.destructor,
    deletingDestructorFunctionIndex: located.deletingDestructor,
    freeFunctionIndex: free,
    bodySha256: [body("constructor"), body("destructor"), body("deletingDestructor")],
  };
}

/** Prove `input` and return the build with the module it produces, or null when it does not prove. */
export function deriveSoundDecodeRepairStage(
  input: Uint8Array,
): Readonly<{ build: SoundDecodeRepairBuild; output: Uint8Array }> | null {
  try {
    const evidence = wasmEvidence(input);
    if (!evidence) return null;
    const proved = prove(roleProofView(evidence));
    if (!proved) return null;
    const output = rewriteWithBuild(input, { ...proved, derivations: {} });
    return Object.freeze({
      build: Object.freeze({ ...proved, derivations: Object.freeze({ [evidence.inputSha256]: sha256(output) }) }),
      output,
    });
  } catch (error) {
    return refusedOrRethrow(error);
  }
}

/** Where a body's local declarations end and its instructions begin. */
function instructionsStart(body: Uint8Array): number {
  const cursor = { offset: 0 };
  for (let groups = readUleb(body, cursor); groups > 0; groups -= 1) {
    readUleb(body, cursor);
    cursor.offset += 1;
  }
  return cursor.offset;
}

const prepend = (body: Uint8Array, statement: Uint8Array): Uint8Array => {
  const start = instructionsStart(body);
  return concat(body.subarray(0, start), statement, body.subarray(start));
};

/**
 * The rewrite itself, against a build supplied rather than proved here. The
 * production caller supplies the isolated verifier's record, so the bodies it
 * names are checked again before anything is inserted.
 */
export function rewriteWithBuild(input: Uint8Array, build: SoundDecodeRepairBuild): Uint8Array {
  const evidence = wasmEvidence(input);
  if (!evidence) fail("invalid or unsupported input module");
  const module = evidence.moduleView();
  const targets = [build.constructorFunctionIndex, build.destructorFunctionIndex, build.deletingDestructorFunctionIndex];
  targets.forEach((functionIndex, index) => {
    if (functionIndex < module.functionImportCount || sha256(functionBody(module, functionIndex)) !== build.bodySha256[index]) {
      fail(`function ${functionIndex} is not the certified body`);
    }
  });
  if (!module.exports.some((entry) => entry.name === "free" && entry.kind === 0 && entry.index === build.freeFunctionIndex)) {
    fail("free is not the certified export");
  }

  const clear = concat(localGet(0), i32Const(0), i32Store(DECODE_TASK_INDEX_FRAMES_OFFSET));
  const release = concat(localGet(0), i32Load(DECODE_TASK_INDEX_FRAMES_OFFSET), call(build.freeFunctionIndex));
  const bodies = [...module.bodies];
  const local = (functionIndex: number) => functionIndex - module.functionImportCount;
  bodies[local(build.constructorFunctionIndex)] = prepend(functionBody(module, build.constructorFunctionIndex), clear);
  for (const functionIndex of [build.destructorFunctionIndex, build.deletingDestructorFunctionIndex]) {
    bodies[local(functionIndex)] = prepend(functionBody(module, functionIndex), release);
  }
  const sections = splitSections(input);
  if (!sectionById(sections, 10)) fail("module has no code section");
  const output = concat(
    WASM_HEADER,
    ...sections.map((section): Section => (section.id === 10 ? { id: 10, body: encodeCode(bodies) } : section)).map(encodeSection),
  );
  if (!WebAssembly.validate(output)) fail("rewritten module failed validation");
  return output;
}
