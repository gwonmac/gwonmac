/**
 * The maintainer review packet for a changed ArenaNet client.
 *
 * It judges the candidate client with only the generations older than it, as
 * on its patch day, and for each feature the previous client proves and the
 * candidate refuses it names the reviewed bodies that feature relied on and
 * that the candidate no longer holds. For each such body it pairs the previous
 * function with the candidate's corresponding one (by unchanged callers, then
 * callees, then signature and length), lists both side by side with every
 * relocatable operand normalised, and drafts the generation-file alternative
 * that would accept it.
 *
 * A draft grants nothing. It becomes a fact only when a maintainer approves it
 * and writes it into the generation file, and the verifier still has to prove
 * every feature from the bytes with it. The packet holds ArenaNet code, so it
 * stays in the private evidence store on the maintainer's Mac.
 */
import { isDeepStrictEqual } from "node:util";
import type { SemanticRole } from "../client/certification/enhancement-evidence-types.js";
import type { ModuleShape } from "../client/certification/enhancement-evidence-types.js";
import { verifyLocalClientBytes, type LocalClientVerification } from "../client/certification/local-client-verifier.js";
import {
  functionLocalIdentity,
  orderedCallees,
  relocatableOperands,
} from "../client/certification/relocation-identity.js";
import {
  withReviewedFacts,
  type ClientGeneration,
  type ReviewedAlternative,
} from "../client/certification/reviewed-facts.js";
import { relocationAwareFingerprint } from "../client/certification/semantic-proof.js";
import {
  functionBodySha256,
  functionMatchesReviewedBody,
  roleFunctions,
  wasmEvidence,
  withReviewedLookupRecorder,
  type ReviewedLookup,
} from "../client/certification/wasm-evidence.js";
import { instructionStarts } from "../client/certification/wasm-instruction-evidence.js";
import {
  capabilityRecord,
  ENHANCEMENT_CAPABILITY_CONTRACTS,
  ENHANCEMENT_CAPABILITY_FIELDS,
  ENHANCEMENT_CAPABILITY_PRESETS,
  NO_ENHANCEMENT_CAPABILITIES,
  type EnhancementCapabilities,
  type EnhancementCapability,
} from "../shared/enhancement-contracts.js";

/** Template saving is reviewed like a feature: every feature runs on its output. */
export const TEMPLATE_SAVING = "templateSaving";
export type ReviewedFeature = EnhancementCapability | typeof TEMPLATE_SAVING;

export type FunctionListing = Readonly<{
  functionIndex: number;
  bodySha256: string;
  signature: string;
  /** One normalised instruction per line. */
  instructions: readonly string[];
}>;

export type MissingBody = Readonly<{
  /** The reviewed literal: a body digest, or a role's fingerprint. */
  literal: string;
  kind: "body" | "role";
  previous: FunctionListing;
  pairedBy: "callers" | "callees" | "signature-and-length" | "none";
  candidateCount: number;
  /** The first few candidates. */
  candidates: readonly FunctionListing[];
  /** The alternative that accepts the one candidate, or null when there is not exactly one. */
  draft: ReviewedAlternative | null;
}>;

export type FeatureReview = Readonly<{
  feature: ReviewedFeature;
  /** The candidate's verdict with only older facts. */
  invariant: string;
  candidates: number | null;
  missing: readonly MissingBody[];
  /** The candidate's verdict with the older facts and the draft. */
  provesWithDraft: boolean;
}>;

export type ReviewPacket = Readonly<{
  candidateSha256: string;
  previousSha256: string;
  features: readonly FeatureReview[];
  /** Every drafted alternative, keyed by its reviewed literal. */
  alternatives: Readonly<Record<string, readonly ReviewedAlternative[]>>;
}>;

const ALL = ENHANCEMENT_CAPABILITY_PRESETS.all;
const MAX_LISTED_CANDIDATES = 3;
const MAX_FALLBACK_CANDIDATES = 8;

/** A generation that holds only drafted alternatives, to judge a draft before it is written. */
export function draftGeneration(
  id: string,
  alternatives: Readonly<Record<string, readonly ReviewedAlternative[]>>,
): ClientGeneration {
  return Object.freeze({ id, builds: Object.freeze([]), identities: Object.freeze({}), facts: Object.freeze({ alternatives }) });
}

function featureProves(verification: LocalClientVerification, feature: ReviewedFeature): boolean {
  return feature === TEMPLATE_SAVING
    ? verification.templateSaveBuild !== null
    : verification.featureVerdicts?.[feature].status === "proved";
}

/** `feature` and every capability its contract requires, so it can be verified alone. */
function requestFor(feature: ReviewedFeature): EnhancementCapabilities {
  if (feature === TEMPLATE_SAVING) return NO_ENHANCEMENT_CAPABILITIES;
  const wanted = new Set<EnhancementCapability>();
  const add = (id: EnhancementCapability) => {
    if (wanted.has(id)) return;
    wanted.add(id);
    const contract = ENHANCEMENT_CAPABILITY_CONTRACTS.find((entry) => entry.id === id);
    for (const dependency of [...contract?.requiresAll ?? [], ...contract?.requiresAny ?? []]) add(dependency);
  };
  add(feature);
  return capabilityRecord((id) => wanted.has(id));
}

type Lookup = Readonly<{ key: string; lookup: ReviewedLookup; functionIndex: number }>;

/** The reviewed literals that matched `bytes` while verifying `request`. */
function lookupsWhileVerifying(
  bytes: Uint8Array,
  request: EnhancementCapabilities,
  generations: readonly ClientGeneration[],
): ReadonlyMap<string, Lookup> {
  const found = new Map<string, Lookup>();
  withReviewedLookupRecorder((lookup, functionIndex) => {
    const key = lookup.kind === "body" ? `body:${lookup.literal}` : `role:${lookup.role.fingerprint}`;
    if (!found.has(key)) found.set(key, { key, lookup, functionIndex });
  }, () => verifyLocalClientBytes(bytes, request, generations));
  return found;
}

function signatureOf(module: ModuleShape, functionIndex: number): string {
  const type = module.types[module.functionTypeIndices[functionIndex] ?? -1];
  return type ? `(${type.params.join(",")})->(${type.results.join(",")})` : "?";
}

function definedFunctions(module: ModuleShape): number[] {
  return Array.from({ length: module.bodies.length }, (_, local) => module.functionImportCount + local);
}

/** Whether any function of `module` still matches the reviewed literal. */
function stillMatches(module: ModuleShape, lookup: ReviewedLookup, signature: string): boolean {
  if (lookup.kind === "role") return roleFunctions(module, lookup.role).length > 0;
  return definedFunctions(module).some((functionIndex) => signatureOf(module, functionIndex) === signature
    && functionMatchesReviewedBody(module, functionIndex, lookup.literal));
}

// WebAssembly 1.0 mnemonics by opcode; the listing only has to be readable.
const MNEMONICS: Readonly<Record<number, string>> = Object.freeze(Object.fromEntries([
  [0x00, "unreachable"], [0x01, "nop"], [0x02, "block"], [0x03, "loop"], [0x04, "if"], [0x05, "else"],
  [0x0b, "end"], [0x0c, "br"], [0x0d, "br_if"], [0x0e, "br_table"], [0x0f, "return"], [0x10, "call"],
  [0x11, "call_indirect"], [0x1a, "drop"], [0x1b, "select"], [0x20, "local.get"], [0x21, "local.set"],
  [0x22, "local.tee"], [0x23, "global.get"], [0x24, "global.set"], [0x28, "i32.load"], [0x29, "i64.load"],
  [0x2a, "f32.load"], [0x2b, "f64.load"], [0x2c, "i32.load8_s"], [0x2d, "i32.load8_u"], [0x2e, "i32.load16_s"],
  [0x2f, "i32.load16_u"], [0x36, "i32.store"], [0x37, "i64.store"], [0x38, "f32.store"], [0x39, "f64.store"],
  [0x3a, "i32.store8"], [0x3b, "i32.store16"], [0x3f, "memory.size"], [0x40, "memory.grow"],
  [0x41, "i32.const"], [0x42, "i64.const"], [0x43, "f32.const"], [0x44, "f64.const"], [0x45, "i32.eqz"],
  [0x46, "i32.eq"], [0x47, "i32.ne"], [0x48, "i32.lt_s"], [0x49, "i32.lt_u"], [0x4a, "i32.gt_s"],
  [0x4b, "i32.gt_u"], [0x4c, "i32.le_s"], [0x4d, "i32.le_u"], [0x4e, "i32.ge_s"], [0x4f, "i32.ge_u"],
  [0x67, "i32.clz"], [0x6a, "i32.add"], [0x6b, "i32.sub"], [0x6c, "i32.mul"], [0x6d, "i32.div_s"],
  [0x6e, "i32.div_u"], [0x6f, "i32.rem_s"], [0x70, "i32.rem_u"], [0x71, "i32.and"], [0x72, "i32.or"],
  [0x73, "i32.xor"], [0x74, "i32.shl"], [0x75, "i32.shr_s"], [0x76, "i32.shr_u"],
]));

const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");

/**
 * One line per instruction: its mnemonic and immediate bytes, with each
 * relocatable operand replaced by the name the relocation identity gives it.
 * Two relocations of one body list the same lines.
 */
export function normalisedListing(module: ModuleShape, functionIndex: number): FunctionListing {
  const body = module.bodies[functionIndex - module.functionImportCount]!;
  const operands = relocatableOperands(module, functionIndex);
  const starts = instructionStarts(body);
  const instructions = starts.map((start, index) => {
    const end = starts[index + 1] ?? body.byteLength;
    const opcode = body[start]!;
    const parts = [MNEMONICS[opcode] ?? `op:${opcode.toString(16).padStart(2, "0")}`];
    let cursor = start + 1;
    for (const operand of operands.filter((site) => site.start >= cursor && site.end <= end)) {
      if (operand.start > cursor) parts.push(hex(body.subarray(cursor, operand.start)));
      parts.push(`<${operand.name.startsWith("call:") ? `call ${operand.name.slice(5, 17)}` : operand.name.slice(0, 17)}>`);
      cursor = operand.end;
    }
    if (end > cursor) parts.push(hex(body.subarray(cursor, end)));
    return parts.join(" ");
  });
  return Object.freeze({
    functionIndex,
    bodySha256: functionBodySha256(module, functionIndex),
    signature: signatureOf(module, functionIndex),
    instructions: Object.freeze(instructions),
  });
}

/** Indexes over one module that pairing needs, built once. */
function moduleIndex(module: ModuleShape) {
  const callers = new Map<number, [caller: number, ordinal: number][]>();
  const byLocalIdentity = new Map<string, number[]>();
  for (const functionIndex of definedFunctions(module)) {
    orderedCallees(module, functionIndex).forEach((callee, ordinal) => {
      callers.set(callee, [...callers.get(callee) ?? [], [functionIndex, ordinal]]);
    });
    const identity = functionLocalIdentity(module, functionIndex);
    byLocalIdentity.set(identity, [...byLocalIdentity.get(identity) ?? [], functionIndex]);
  }
  return { module, callers, byLocalIdentity };
}
type ModuleIndex = ReturnType<typeof moduleIndex>;

/**
 * The candidate functions that correspond to `previousFunction`: the callee at
 * the same position of each caller whose own body is unchanged; else the
 * functions that call the same callees in the same order; else the functions
 * with the same signature and body length.
 */
function pair(previous: ModuleIndex, candidate: ModuleIndex, previousFunction: number): Readonly<{
  pairedBy: MissingBody["pairedBy"];
  candidates: readonly number[];
}> {
  const signature = signatureOf(previous.module, previousFunction);
  const sameSignature = (functionIndex: number) => signatureOf(candidate.module, functionIndex) === signature;
  const votes = new Set<number>();
  for (const [caller, ordinal] of previous.callers.get(previousFunction) ?? []) {
    const twins = candidate.byLocalIdentity.get(functionLocalIdentity(previous.module, caller)) ?? [];
    const callee = twins.length === 1 ? orderedCallees(candidate.module, twins[0]!)[ordinal] : undefined;
    if (callee !== undefined && sameSignature(callee)) votes.add(callee);
  }
  if (votes.size > 0) return { pairedBy: "callers", candidates: [...votes] };
  const calleeIdentities = orderedCallees(previous.module, previousFunction)
    .map((callee) => functionLocalIdentity(previous.module, callee));
  if (calleeIdentities.length > 0) {
    const callingAlike = definedFunctions(candidate.module).filter((functionIndex) => sameSignature(functionIndex)
      && isDeepStrictEqual(orderedCallees(candidate.module, functionIndex)
        .map((callee) => functionLocalIdentity(candidate.module, callee)), calleeIdentities));
    if (callingAlike.length > 0) return { pairedBy: "callees", candidates: callingAlike };
  }
  const length = previous.module.bodies[previousFunction - previous.module.functionImportCount]!.byteLength;
  const alike = definedFunctions(candidate.module).filter((functionIndex) => sameSignature(functionIndex)
    && candidate.module.bodies[functionIndex - candidate.module.functionImportCount]!.byteLength === length);
  return alike.length > 0 && alike.length <= MAX_FALLBACK_CANDIDATES
    ? { pairedBy: "signature-and-length", candidates: alike }
    : { pairedBy: "none", candidates: [] };
}

/** The alternative under which the proof accepts `functionIndex` for `lookup`. */
function alternativeFor(module: ModuleShape, functionIndex: number, lookup: ReviewedLookup): ReviewedAlternative | null {
  if (lookup.kind === "body") return functionBodySha256(module, functionIndex);
  const role: SemanticRole = lookup.role;
  const body = module.bodies[functionIndex - module.functionImportCount]!;
  let fingerprint: string;
  try {
    fingerprint = relocationAwareFingerprint(body, role.spans);
  } catch {
    return null;
  }
  return body.byteLength === role.bodyLength ? fingerprint : Object.freeze({ bodyLength: body.byteLength, fingerprint });
}

/**
 * Several reviewed families can name one body (each generation's chat path
 * names its own sender digest). One alternative is enough: the literal that is
 * the previous body's own digest, else the first in order.
 */
function draftedLiteral(module: ModuleShape, functionIndex: number, gone: readonly Lookup[]): string | undefined {
  const literals = gone.flatMap(({ lookup, functionIndex: index }) =>
    lookup.kind === "body" && index === functionIndex ? [lookup.literal] : []).sort();
  const own = functionBodySha256(module, functionIndex);
  return literals.includes(own) ? own : literals[0];
}

function addAlternative(
  alternatives: Map<string, ReviewedAlternative[]>,
  literal: string,
  alternative: ReviewedAlternative,
): void {
  const known = alternatives.get(literal) ?? [];
  if (!known.some((entry) => isDeepStrictEqual(entry, alternative))) alternatives.set(literal, [...known, alternative]);
}

/**
 * Reviews `candidate` against `previous` with only `generations` as facts.
 * `previous` is the newest client those generations reviewed.
 */
export function reviewClient(input: Readonly<{
  candidate: Uint8Array;
  previous: Uint8Array;
  generations: readonly ClientGeneration[];
  /** The id the drafted generation will carry. */
  id: string;
}>): ReviewPacket {
  const { candidate, previous, generations } = input;
  const candidateResult = verifyLocalClientBytes(candidate, ALL, generations);
  const previousResult = verifyLocalClientBytes(previous, ALL, generations);
  const refused = ([TEMPLATE_SAVING, ...ENHANCEMENT_CAPABILITY_FIELDS] as const).filter((feature) =>
    featureProves(previousResult, feature) && !featureProves(candidateResult, feature));
  const previousModule = wasmEvidence(previous)?.moduleView();
  const candidateModule = wasmEvidence(candidate)?.moduleView();
  if (!previousModule || !candidateModule) throw new Error("review: both clients must be supported modules");
  const previousIndex = moduleIndex(previousModule);
  const candidateIndex = moduleIndex(candidateModule);

  const templateLookups = lookupsWhileVerifying(previous, NO_ENHANCEMENT_CAPABILITIES, generations);
  const alternatives = new Map<string, ReviewedAlternative[]>();
  const pairs = new Map<number, ReturnType<typeof pair>>();
  const reviews = refused.map((feature) => {
    const lookups = feature === TEMPLATE_SAVING
      ? [...templateLookups.values()]
      : [...lookupsWhileVerifying(previous, requestFor(feature), generations).values()]
        .filter(({ key }) => !templateLookups.has(key));
    // A body that another reviewed literal still names on the candidate (an
    // older family's digest beside the newest one's) needs nothing.
    const kept = withReviewedFacts(generations, () => lookups.filter(({ lookup, functionIndex }) =>
      stillMatches(candidateModule, lookup, signatureOf(previousModule, functionIndex))));
    const covered = new Set(kept.map(({ functionIndex }) => functionIndex));
    const gone = lookups.filter((entry) => !kept.includes(entry) && !covered.has(entry.functionIndex));
    const missing = gone.map(({ lookup, functionIndex }): MissingBody => {
      const paired = pairs.get(functionIndex) ?? pair(previousIndex, candidateIndex, functionIndex);
      pairs.set(functionIndex, paired);
      const literal = lookup.kind === "body" ? lookup.literal : lookup.role.fingerprint;
      const draft = paired.candidates.length === 1
        && (lookup.kind === "role" || literal === draftedLiteral(previousModule, functionIndex, gone))
        ? alternativeFor(candidateModule, paired.candidates[0]!, lookup) : null;
      if (draft !== null) addAlternative(alternatives, literal, draft);
      return Object.freeze({
        literal,
        kind: lookup.kind,
        previous: normalisedListing(previousModule, functionIndex),
        pairedBy: paired.pairedBy,
        candidateCount: paired.candidates.length,
        candidates: Object.freeze(paired.candidates.slice(0, MAX_LISTED_CANDIDATES)
          .map((functionIndex) => normalisedListing(candidateModule, functionIndex))),
        draft,
      });
    });
    const verdict = feature === TEMPLATE_SAVING ? null : candidateResult.featureVerdicts?.[feature];
    return {
      feature,
      invariant: feature === TEMPLATE_SAVING
        ? candidateResult.reasons[0] ?? "template-refused"
        : verdict && "invariant" in verdict ? verdict.invariant : verdict?.status ?? "unknown",
      candidates: verdict && "candidates" in verdict ? verdict.candidates : null,
      missing: Object.freeze(missing),
    };
  });

  const drafted = Object.freeze(Object.fromEntries([...alternatives].map(([literal, entries]) =>
    [literal, Object.freeze(entries)])));
  const withDraft = alternatives.size === 0 ? candidateResult
    : verifyLocalClientBytes(candidate, ALL, [...generations, draftGeneration(input.id, drafted)]);
  return Object.freeze({
    candidateSha256: candidateResult.officialSha256,
    previousSha256: previousResult.officialSha256,
    features: Object.freeze(reviews.map((review) => Object.freeze({
      ...review,
      provesWithDraft: featureProves(withDraft, review.feature),
    }))),
    alternatives: drafted,
  });
}

/** Rows of a side-by-side listing: common lines, and changed runs paired in order. */
export function sideBySide(
  left: readonly string[],
  right: readonly string[],
): readonly Readonly<{ left: string | null; right: string | null; same: boolean }>[] {
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < left.length - prefix && suffix < right.length - prefix
    && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix += 1;
  const rows: { left: string | null; right: string | null; same: boolean }[] = [];
  for (let index = 0; index < prefix; index += 1) rows.push({ left: left[index]!, right: right[index]!, same: true });
  const oldMiddle = left.slice(prefix, left.length - suffix);
  const newMiddle = right.slice(prefix, right.length - suffix);
  for (let index = 0; index < Math.max(oldMiddle.length, newMiddle.length); index += 1) {
    rows.push({ left: oldMiddle[index] ?? null, right: newMiddle[index] ?? null, same: false });
  }
  for (let index = left.length - suffix; index < left.length; index += 1) {
    rows.push({ left: left[index]!, right: right[index - left.length + right.length]!, same: true });
  }
  return rows;
}

const CONTEXT = 3;
const COLUMN = 48;

function formatSideBySide(previous: FunctionListing, candidate: FunctionListing): string {
  const rows = sideBySide(previous.instructions, candidate.instructions);
  const near = (index: number) => rows.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some((row) => !row.same);
  const lines: string[] = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    if (row.same && !near(index)) {
      skipped += 1;
      return;
    }
    if (skipped > 0) lines.push(`  … ${skipped} equal instructions …`);
    skipped = 0;
    const mark = row.same ? " " : "!";
    lines.push(`${mark} ${(row.left ?? "").slice(0, COLUMN).padEnd(COLUMN)} │ ${row.right ?? ""}`);
  });
  if (skipped > 0) lines.push(`  … ${skipped} equal instructions …`);
  return lines.join("\n");
}

/** The packet as Markdown for the maintainer who reviews it. */
export function formatReviewPacket(packet: ReviewPacket, id: string): string {
  const out = [
    `# Review packet ${id}`,
    "",
    `Candidate ${packet.candidateSha256}, judged with the generations older than it and compared with ${packet.previousSha256}.`,
    "A draft grants nothing: approve it, write it with `pnpm certification review --apply`, and the verifier must still prove each feature.",
    "",
  ];
  if (packet.features.length === 0) out.push("Every feature the previous client proves also proves on the candidate.", "");
  for (const review of packet.features) {
    out.push(`## ${review.feature}`, "",
      `- First failing invariant: \`${review.invariant}\``,
      `- Candidates: ${review.candidates ?? "n/a"}`,
      `- With the draft: ${review.provesWithDraft ? "proves" : "still refuses"}`, "");
    if (review.missing.length === 0) {
      out.push(review.feature === "quickItemMove"
        // Its item and trade fields are reviewed as structure offsets, not bodies.
        ? "Quick Item Move carries only to a module with a reviewed memory-code digest. Review its item and trade fields by hand; the generation file's `memoryCodeSha256` records that review."
        : "Every reviewed body it relied on is still present; a relation the proof checks changed. Review it by hand.", "");
    }
    for (const body of review.missing) {
      out.push(`### ${body.kind} ${body.literal}`, "",
        `Previous function ${body.previous.functionIndex} ${body.previous.signature}; paired by ${body.pairedBy}, ` +
        `${body.candidateCount} candidate(s)${body.candidates.map((entry) => ` ${entry.functionIndex}`).join(",")}.`, "");
      const [only] = body.candidates;
      if (body.candidateCount === 1 && only) {
        out.push("```text", formatSideBySide(body.previous, only), "```", "", body.draft === null
          ? "No draft: another reviewed literal for this body carries it."
          : `Draft: \`alternatives["${body.literal}"]\` += \`${JSON.stringify(body.draft)}\``, "");
      } else {
        out.push("No draft: pair this body by hand.", "");
      }
    }
  }
  return `${out.join("\n")}\n`;
}
