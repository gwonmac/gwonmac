/**
 * The one lookup for per-client reviewed facts.
 *
 * Each ArenaNet client generation that needed review has one file,
 * `reviewed-client-<id>.ts`: its exact Enhancement records, the relocation
 * identities measured on its bytes for the reviewed body digests and role
 * fingerprints that proofs name, and the proof facts its review added. Proofs
 * never name a client. They ask `reviewedBuilds()`, `reviewedIdentities()`,
 * `reviewedAlternatives()` and `reviewedEntries()`, which read only the active
 * generations.
 *
 * The verifier runs with every generation unless a caller passes fewer: the
 * offline replay passes only the generations older than the client it replays,
 * so a patch is judged with exactly the facts that existed before it. The scope
 * is synchronous and restored on exit; verification never awaits inside it.
 * Retiring a generation deletes its file and its entry below.
 */
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";
import type { ResignChatPath } from "./enhancement-resign-proof.js";
import type { WhisperPath } from "./enhancement-whisper-proof.js";
import type { NativeRenderFamily } from "./native-render-reference.js";
import type { PathingFamily } from "./pathing-spike-proof.js";
import type { CartographySurfaces } from "./cartography-layout-proof.js";
import type { FriendLifecycleRoleFamily } from "./friend-lifecycle-evidence.js";
import type { GuildHallAreaTypeFamily } from "./enhancement-local-actions-proof.js";
import { AUGUST_FACTS } from "./reviewed-client-2026-08-build-1eb07e32.js";
import { OCTOBER_1_FACTS } from "./reviewed-client-2026-10-01-7b4c3548d670.js";
import { OCTOBER_22_FACTS } from "./reviewed-client-2026-10-22-ce3192033b14.js";
import { OCTOBER_22_REBUILD_FACTS } from "./reviewed-client-2026-10-22-5f149ad09879.js";
import { NOVEMBER_3_FACTS } from "./reviewed-client-2026-11-03-f2a2b07c9c56.js";

export type ClientGeneration = Readonly<{
  /** The evidence-store bundle reference: `YYYY-MM-DD-<generation-12>`. */
  id: string;
  /** Exact Enhancement records for this generation's template-save outputs. */
  builds: readonly KnownEnhancementBuild[];
  /**
   * A reviewed body digest or role fingerprint, mapped to the relocation
   * identities of the bodies it named on this generation's modules.
   */
  identities: Readonly<Record<string, readonly string[]>>;
  /**
   * Player-effect bodies of this client, keyed by the August reference digest.
   * That proof's boundary accepts only reviewed digests, so a relink of these
   * bodies needs a new entry.
   */
  playerEffectBodies?: Readonly<Record<string, string>>;
  /**
   * `memoryCodeSha256` of this generation's template output. Facts reviewed
   * only as structure offsets (Quick Item Move's item and trade fields) carry
   * to a module with the same digest.
   */
  memoryCodeSha256?: string;
  /** The per-client proof facts this generation's review added. */
  facts?: GenerationFacts;
}>;

/**
 * Per-client facts that a proof cannot derive from the bytes alone, each in
 * the shape its proof owns. A proof reads them only through `reviewedEntries`
 * or `perReviewedFacts`, so a replay sees only the facts of active generations.
 */
export type GenerationFacts = Readonly<{
  /**
   * Alternatives this review accepted for a reviewed reference literal (a
   * body digest or role fingerprint): another digest or same-length
   * fingerprint, or a role fingerprint over a body of another length with the
   * reference role's spans and signature.
   */
  alternatives?: Readonly<Record<string, readonly ReviewedAlternative[]>>;
  resignChatPaths?: readonly ResignChatPath[];
  whisperPaths?: readonly WhisperPath[];
  nativeRenderFamilies?: readonly NativeRenderFamily[];
  pathingFamilies?: readonly PathingFamily[];
  /** Cartography surface owners this client's review accepted. */
  cartographySurfaces?: readonly CartographySurfaces[];
  friendLifecycleRoles?: readonly FriendLifecycleRoleFamily[];
  guildHallAreaTypeFamilies?: readonly GuildHallAreaTypeFamily[];
  /** Template-saving helper bodies, keyed by `<role>@<call offset>` or `helper:<name>`. */
  templateCalleeBodies?: Readonly<Record<string, readonly string[]>>;
}>;

/**
 * Every reviewed generation, oldest client first. The verifier's oldest-match
 * and newest-baseline rules read this order, and the offline replay judges a
 * client with the generations before it.
 */
export const REVIEWED_GENERATIONS: readonly ClientGeneration[] = Object.freeze([
  AUGUST_FACTS,
  OCTOBER_1_FACTS,
  OCTOBER_22_FACTS,
  OCTOBER_22_REBUILD_FACTS,
  NOVEMBER_3_FACTS,
]);

let active: readonly ClientGeneration[] = REVIEWED_GENERATIONS;

/** Runs `run` with only `generations` as reviewed facts. */
export function withReviewedFacts<Value>(
  generations: readonly ClientGeneration[],
  run: () => Value,
): Value {
  const previous = active;
  active = generations;
  try {
    return run();
  } finally {
    active = previous;
  }
}

export function reviewedGenerations(): readonly ClientGeneration[] {
  return active;
}

export type ReviewedAlternative = string | Readonly<{ bodyLength: number; fingerprint: string }>;

const alternativeIndex = perReviewedFacts((generations) => {
  const index = new Map<string, ReviewedAlternative[]>();
  for (const generation of generations) {
    for (const [literal, alternatives] of Object.entries(generation.facts?.alternatives ?? {})) {
      index.set(literal, [...index.get(literal) ?? [], ...alternatives]);
    }
  }
  return index;
});

/** The alternatives that active generations reviewed for `literal`. */
export function reviewedAlternatives(literal: string): readonly ReviewedAlternative[] {
  return alternativeIndex().get(literal) ?? [];
}

/** `derive` over the active generations, computed once per active set. */
export function perReviewedFacts<Value>(
  derive: (generations: readonly ClientGeneration[]) => Value,
): () => Value {
  const cache = new WeakMap<readonly ClientGeneration[], { value: Value }>();
  return () => {
    const cached = cache.get(active);
    if (cached) return cached.value;
    const value = derive(active);
    cache.set(active, { value });
    return value;
  };
}

/** The entries every active generation's facts hold under `pick`, oldest first. */
export function reviewedEntries<Entry>(
  pick: (facts: GenerationFacts) => readonly Entry[] | undefined,
): () => readonly Entry[] {
  return perReviewedFacts((generations) => Object.freeze(generations.flatMap((generation) =>
    generation.facts ? pick(generation.facts) ?? [] : [])));
}

/** The active generation that holds `build`, if any. */
export function generationOf(build: KnownEnhancementBuild): ClientGeneration | null {
  return active.find((generation) => generation.builds.includes(build)) ?? null;
}

export function reviewedBuilds(): readonly KnownEnhancementBuild[] {
  return active.flatMap((generation) => generation.builds);
}

const identityIndex = new WeakMap<
  readonly ClientGeneration[],
  ReadonlyMap<string, ReadonlySet<string>>
>();

/** Relocation identities that any active generation reviewed for `literal`. */
export function reviewedIdentities(literal: string): ReadonlySet<string> {
  let index = identityIndex.get(active);
  if (!index) {
    const built = new Map<string, Set<string>>();
    for (const generation of active) {
      for (const [key, identities] of Object.entries(generation.identities)) {
        const set = built.get(key) ?? new Set<string>();
        for (const identity of identities) set.add(identity);
        built.set(key, set);
      }
    }
    index = built;
    identityIndex.set(active, index);
  }
  return index.get(literal) ?? EMPTY;
}

const EMPTY: ReadonlySet<string> = new Set();

type IdentityRecorder = (literal: string, identity: string) => void;
let recorder: IdentityRecorder | null = null;

/**
 * Collects every reviewed literal that matched a body exactly, with that
 * body's relocation identity. Only `certification reviewed-identities` uses it,
 * to write a generation's identity table.
 */
export function withIdentityRecorder<Value>(record: IdentityRecorder, run: () => Value): Value {
  const previous = recorder;
  recorder = record;
  try {
    return run();
  } finally {
    recorder = previous;
  }
}

export function recordExactMatch(literal: string, identity: () => string): void {
  if (recorder) recorder(literal, identity());
}
