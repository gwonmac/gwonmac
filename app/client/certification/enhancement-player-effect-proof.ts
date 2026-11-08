/**
 * Owns current-client semantic proof for controlled-player timed effects.
 * It refuses the capability unless every function role has one match: a
 * reviewed body, or on a relink the one function with a reviewed body's
 * relocation identity (only callees and addresses renumbered).
 */
import {
  functionBody,
  functionBodySha256,
  recordReviewedLookup,
  signatureMatches,
  unsignedOperand,
} from "./wasm-evidence.js";
import type { ModuleShape } from "./enhancement-evidence-types.js";
import type { KnownEnhancementBuild } from "./enhancement-builds.js";
import { functionIdentity, functionsWithIdentity } from "./relocation-identity.js";
import {
  recordExactMatch,
  reviewedGenerations,
  reviewedIdentities,
  type ClientGeneration,
} from "./reviewed-facts.js";

type PlayerEffectProof = NonNullable<
  KnownEnhancementBuild["playerEffectObservation"]
>;
type EffectIconProof = NonNullable<KnownEnhancementBuild["effectIconGeometry"]>;

type ExactRole = Readonly<{
  /** The August reference digest this role stands for. */
  reference: string;
  /** This family's body digest for the reference. */
  hash: string;
  bodyLength: number;
  params: readonly string[];
  results: readonly string[];
}>;

// A generation's `playerEffectBodies` maps each August reference digest to
// that client's complete body; the boundary accepts only these digests.
function effectProofFamily(bodies: Readonly<Record<string, string>> | undefined) {
  const reviewed = (reference: string) => ({ reference, hash: bodies?.[reference] ?? reference });
  const record = (role: ExactRole, index: number) => recordReviewedLookup({
    kind: "effect", literal: role.hash, reference: role.reference, family: bodies ?? {},
  }, index);
  const ACCESSORS: readonly ExactRole[] = Object.freeze([
    { ...reviewed("7df2376537653cac9b32172fb51073fa57503b1a2bcceb317a6d282d1e13fb0b"), bodyLength: 30, params: ["i32", "i32", "i32", "i32", "i32"], results: [] },
    { ...reviewed("18899c4be6bf2fd51f6dbf6e52241456cdaed94d912ed23f307c95917bf615b8"), bodyLength: 24, params: ["i32", "i32"], results: [] },
    { ...reviewed("1f2d462100add0c160d62265d2eaf292a00bfd1cde84c38c1e51f2aac0a2cc57"), bodyLength: 30, params: ["i32", "i32", "i32", "i32", "i32"], results: [] },
    { ...reviewed("a560a223d9756fc3579f057137601853ec23c2b6bbd57248216b77ce550d29af"), bodyLength: 30, params: ["i32", "i32", "i32", "i32", "f32"], results: [] },
    { ...reviewed("ecfa62c1bfaaebe98c2047ad986e137e9695a3cf2f0f7d5f6367b6e44cc10894"), bodyLength: 28, params: ["i32", "i32", "i32", "f32"], results: [] },
    { ...reviewed("3fecf883ff7543db3cfdd8f3d77fc5cf3ef1e78282252f4f3caedbbe4f80bac0"), bodyLength: 24, params: ["i32", "i32"], results: [] },
  ]);
  const ADD_TIMED: ExactRole = { ...reviewed("fe97a736b61e83cc5ea5a84f38aecedd384476339c5b02594fcefeebc5ce5203"), bodyLength: 758, params: ["i32", "i32", "i32", "i32", "i32", "f32"], results: [] };
  const RENEW: ExactRole = { ...reviewed("cafd172e56cbc1efcc64eb281fd8dadcfb6aa305eb4c165c0959f0903f98f769"), bodyLength: 442, params: ["i32", "i32", "i32", "i32", "f32"], results: [] };
  const REMOVE: ExactRole = { ...reviewed("5e0ab6365510501ff760de8c3bdfb8682bf918e092d9263441d8fc7f56403533"), bodyLength: 429, params: ["i32", "i32", "i32"], results: [] };
  const TIMERS: readonly ExactRole[] = Object.freeze([
    { ...reviewed("7340dbe70f3f4bf731d23f80882df99553e837f825d8bbebee7f8eac45d8ef58"), bodyLength: 80, params: [], results: ["i32"] },
    { ...reviewed("c1f93ac7e783305bff7d976dbf55365b67fa6696243305685aa1fb0fb7901030"), bodyLength: 80, params: [], results: ["i32"] },
  ]);
  const EFFECTS_INITIALIZER: ExactRole = {
    ...reviewed("9267c76c395a6ca5bc2efd0f9eb1cd3234feb5c95041a3e6230c98f23f9a4d60"),
    bodyLength: 374, params: ["i32", "i32"], results: [],
  };
  const CHILD_BUILDER: ExactRole = {
    ...reviewed("d5e3a36c3336cf3e42867228919ae973072dc54fb442d80244067a3f308b5fd5"),
    bodyLength: 245, params: ["i32", "i32"], results: [],
  };
  const EFFECTS_FRAME_HASH = 0x66e6211f;
  const FIXED_FRAME_LAYOUT = Object.freeze({
    frameBytes: 0x1c8, frameChildOffsetId: 0xb8, frameId: 0xbc,
    framePositionFlags: 0xd8, frameViewportWidth: 0x104,
    frameViewportHeight: 0x108, frameScreenLeft: 0x10c,
    frameScreenBottom: 0x110, frameScreenRight: 0x114,
    frameScreenTop: 0x118, frameRelation: 0x128, frameState: 0x18c,
  });
  const DIRTY_MESSAGES = Object.freeze([
    // October moved the effect-dirty message with its producer and consumer.
    0x10000055, 0x10000056, 0x10000057, bodies === undefined ? 0x10000141 : 0x10000142,
  ] as const);
  const PLAYER_EFFECT_LAYOUT = Object.freeze({
    worldPartyEffects: 0x508,
    agentEffectsStride: 0x24,
    agentEffectsAgentId: 0,
    agentEffectsEffects: 0x14,
    effectStride: 0x18,
    effectSkillId: 0,
    effectAttributeLevel: 4,
    effectId: 8,
    effectMaintainerAgentId: 0x0c,
    effectDuration: 0x10,
    effectTimestamp: 0x14,
  });

  function index(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 0;
  }

  function exactKeys(value: object, keys: readonly string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
      && actual.every((key, position) => key === expected[position]);
  }

  function sameStrings(value: unknown, expected: readonly string[]): boolean {
    return Array.isArray(value)
      && value.length === expected.length
      && value.every((entry, position) => entry === expected[position]);
  }

  /** Strict boundary proof for the fixed semantic contract this locator owns. */
  function isPlayerEffectObservationProof(
    value: unknown,
  ): value is PlayerEffectProof {
    if (!value || typeof value !== "object") return false;
    const proof = value as Partial<PlayerEffectProof>;
    if (!exactKeys(value, ["accessors", "mutations", "timer", "dirtyMessages", "layout"])
      || !Array.isArray(proof.accessors)
      || proof.accessors.length !== ACCESSORS.length
      || !proof.accessors.every((accessor, position) => {
        const role = ACCESSORS[position];
        return role !== undefined
          && accessor !== null
          && typeof accessor === "object"
          && exactKeys(accessor, ["functionIndex", "params", "results", "bodySha256"])
          && index(accessor.functionIndex)
          && accessor.bodySha256 === role.hash
          && sameStrings(accessor.params, role.params)
          && sameStrings(accessor.results, role.results);
      })) return false;
    const mutations = proof.mutations;
    const timer = proof.timer;
    return mutations !== undefined
      && exactKeys(mutations, ["addTimed", "renewTimed", "remove"])
      && exactKeys(mutations.addTimed, ["functionIndex", "bodySha256"])
      && index(mutations.addTimed.functionIndex)
      && mutations.addTimed.bodySha256 === ADD_TIMED.hash
      && exactKeys(mutations.renewTimed, ["functionIndex", "bodySha256"])
      && index(mutations.renewTimed.functionIndex)
      && mutations.renewTimed.bodySha256 === RENEW.hash
      && exactKeys(mutations.remove, ["functionIndex", "bodySha256"])
      && index(mutations.remove.functionIndex)
      && mutations.remove.bodySha256 === REMOVE.hash
      && timer !== undefined
      && exactKeys(timer, ["functionIndex", "params", "results", "bodySha256"])
      && index(timer.functionIndex)
      && sameStrings(timer.params, [])
      && sameStrings(timer.results, ["i32"])
      && TIMERS.some((role) => role.hash === timer.bodySha256)
      && Array.isArray(proof.dirtyMessages)
      && proof.dirtyMessages.length === DIRTY_MESSAGES.length
      && proof.dirtyMessages.every((message, position) =>
        message === DIRTY_MESSAGES[position])
      && proof.layout !== undefined
      && exactKeys(proof.layout, Object.keys(PLAYER_EFFECT_LAYOUT))
      && Object.entries(PLAYER_EFFECT_LAYOUT).every(([key, expected]) =>
        proof.layout?.[key as keyof typeof PLAYER_EFFECT_LAYOUT] === expected);
  }

  /**
   * The functions each role names: its exact reviewed body and, on a relink,
   * every function with that body's reviewed relocation identity.
   */
  function scan(module: ModuleShape, roles: readonly ExactRole[], relinked = false) {
    const indices = roles.map(() => new Set<number>());
    for (let index = module.functionImportCount; index < module.functionTypeIndices.length; index += 1) {
      const bodyLength = module.bodies[index - module.functionImportCount]?.byteLength;
      const matchingSignatures = roles.flatMap((role, roleIndex) =>
        bodyLength === role.bodyLength
          && signatureMatches(module, index, role.params, role.results) ? [roleIndex] : []);
      if (matchingSignatures.length === 0) continue;
      const hash = functionBodySha256(module, index);
      for (const roleIndex of matchingSignatures) {
        const role = roles[roleIndex];
        if (role?.hash !== hash) continue;
        indices[roleIndex]?.add(index);
        record(role, index);
        recordExactMatch(hash, () => functionIdentity(module, index));
      }
    }
    if (relinked) {
      roles.forEach((role, roleIndex) => {
        for (const identity of reviewedIdentities(role.hash)) {
          for (const index of functionsWithIdentity(module, identity)) {
            if (!signatureMatches(module, index, role.params, role.results)) continue;
            indices[roleIndex]?.add(index);
            record(role, index);
          }
        }
      });
    }
    return Object.freeze(indices.map((matches) => Object.freeze([...matches])));
  }

  function playerEffectCandidateCounts(module: ModuleShape): readonly number[] {
    const fixed = scan(module, [...ACCESSORS, ADD_TIMED, RENEW, REMOVE]);
    const timer = new Set(scan(module, TIMERS).flat());
    return Object.freeze([...fixed.map((matches) => matches.length), timer.size]);
  }

  function derivePlayerEffectObservation(
    module: ModuleShape,
    relinked: boolean,
  ): NonNullable<KnownEnhancementBuild["playerEffectObservation"]> | null {
    const roles = [...ACCESSORS, ADD_TIMED, RENEW, REMOVE] as const;
    const matches = scan(module, roles, relinked);
    if (matches.some((candidate) => candidate.length !== 1)) return null;
    const timerRoles = scan(module, TIMERS, relinked);
    const timerMatches = [...new Set(timerRoles.flat())];
    if (timerMatches.length !== 1) return null;
    const located = matches.map((candidate) => candidate[0]!);
    const accessors = ACCESSORS.map((role, index) => [role, located[index]!] as const);
    const addTimed = located[ACCESSORS.length]!;
    const renewTimed = located[ACCESSORS.length + 1]!;
    const remove = located[ACCESSORS.length + 2]!;
    const timer = timerMatches[0]!;
    // The reviewed timer body this function is, exactly or by relocation.
    const timerHash = TIMERS[timerRoles.findIndex((candidates) => candidates.includes(timer))]!.hash;
    return Object.freeze({
      accessors: Object.freeze(accessors.map(([role, functionIndex]) => Object.freeze({
        functionIndex, params: Object.freeze([...role.params]),
        results: Object.freeze([...role.results]), bodySha256: role.hash,
      }))),
      mutations: Object.freeze({
        addTimed: Object.freeze({ functionIndex: addTimed, bodySha256: ADD_TIMED.hash }),
        renewTimed: Object.freeze({ functionIndex: renewTimed, bodySha256: RENEW.hash }),
        remove: Object.freeze({ functionIndex: remove, bodySha256: REMOVE.hash }),
      }),
      timer: Object.freeze({ functionIndex: timer, params: [] as const, results: ["i32"] as const, bodySha256: timerHash }),
      dirtyMessages: DIRTY_MESSAGES,
      layout: PLAYER_EFFECT_LAYOUT,
    });
  }

  function effectIconCandidateCounts(module: ModuleShape): readonly number[] {
    return Object.freeze(scan(module, [EFFECTS_INITIALIZER, CHILD_BUILDER])
      .map((matches) => matches.length));
  }

  /** Strict boundary proof for the independently located native icon geometry. */
  function isEffectIconGeometryProof(value: unknown): value is EffectIconProof {
    if (!value || typeof value !== "object") return false;
    const proof = value as Partial<EffectIconProof>;
    const initializer = proof.initializer;
    const constructor = proof.constructor;
    const child = proof.childBuilder;
    const layout = proof.layout;
    return exactKeys(value, ["frameHash", "initializer", "constructor", "childBuilder", "layout"])
      && proof.frameHash === EFFECTS_FRAME_HASH
      && initializer !== undefined
      && exactKeys(initializer, ["functionIndex", "params", "results", "bodySha256", "constructorCallOperand"])
      && index(initializer.functionIndex)
      && initializer.constructorCallOperand === 168
      && initializer.bodySha256 === EFFECTS_INITIALIZER.hash
      && sameStrings(initializer.params, EFFECTS_INITIALIZER.params)
      && sameStrings(initializer.results, EFFECTS_INITIALIZER.results)
      && constructor !== undefined
      && exactKeys(constructor, ["functionIndex", "params", "results", "bodySha256"])
      && index(constructor.functionIndex)
      && /^[0-9a-f]{64}$/u.test(constructor.bodySha256)
      && sameStrings(constructor.params, ["i32", "i32", "i32", "i32", "i32", "i32"])
      && sameStrings(constructor.results, ["i32"])
      && child !== undefined
      && exactKeys(child, ["functionIndex", "params", "results", "bodySha256", "childOffset"])
      && index(child.functionIndex)
      && child.childOffset === 4
      && child.bodySha256 === CHILD_BUILDER.hash
      && sameStrings(child.params, CHILD_BUILDER.params)
      && sameStrings(child.results, CHILD_BUILDER.results)
      && layout !== undefined
      && index(layout.frameArray) && layout.frameArray > 0
      && layout.frameCount === layout.frameArray + 8
      && Object.entries(FIXED_FRAME_LAYOUT).every(([key, expected]) =>
        layout[key as keyof typeof FIXED_FRAME_LAYOUT] === expected);
  }

  function deriveEffectIconGeometry(
    module: ModuleShape,
    skillGeometry: NonNullable<KnownEnhancementBuild["skillSlotGeometry"]> | null,
    relinked: boolean,
  ): EffectIconProof | null {
    const matches = scan(module, [EFFECTS_INITIALIZER, CHILD_BUILDER], relinked);
    if (matches.some((candidate) => candidate.length !== 1) || skillGeometry === null) return null;
    const initializer = matches[0]![0]!;
    const childBuilder = matches[1]![0]!;
    const initializerBody = functionBody(module, initializer);
    if (
      initializerBody[167] !== 0x10
      || unsignedOperand(initializerBody, 168)
        !== skillGeometry.constructor.functionIndex
    ) return null;
    return Object.freeze({
      frameHash: EFFECTS_FRAME_HASH,
      initializer: Object.freeze({
        functionIndex: initializer,
        params: ["i32", "i32"] as const,
        results: [] as const,
        bodySha256: EFFECTS_INITIALIZER.hash,
        constructorCallOperand: 168,
      }),
      constructor: skillGeometry.constructor,
      childBuilder: Object.freeze({
        functionIndex: childBuilder,
        params: ["i32", "i32"] as const,
        results: [] as const,
        bodySha256: CHILD_BUILDER.hash,
        childOffset: 4 as const,
      }),
      layout: skillGeometry.layout,
    });
  }
  return { isPlayerEffectObservationProof, playerEffectCandidateCounts,
    derivePlayerEffectObservation, effectIconCandidateCounts,
    isEffectIconGeometryProof, deriveEffectIconGeometry };
}

const AUGUST_FAMILY = effectProofFamily(undefined);
const familyCache = new WeakMap<readonly ClientGeneration[], readonly EffectProofFamily[]>();

/** The August reference family, then one family per active reviewed generation. */
function families(): readonly EffectProofFamily[] {
  const generations = reviewedGenerations();
  let found = familyCache.get(generations);
  if (!found) {
    found = Object.freeze([AUGUST_FAMILY, ...generations.flatMap((generation) =>
      generation.playerEffectBodies ? [effectProofFamily(generation.playerEffectBodies)] : [])]);
    familyCache.set(generations, found);
  }
  return found;
}

export function isPlayerEffectObservationProof(value: unknown): value is PlayerEffectProof {
  return families().some(family => family.isPlayerEffectObservationProof(value));
}
export function isEffectIconGeometryProof(value: unknown): value is EffectIconProof {
  return families().some(family => family.isEffectIconGeometryProof(value));
}
type EffectProofFamily = ReturnType<typeof effectProofFamily>;

/** The function indices a proof names, without the reviewed digests it cites. */
const locations = (proof: unknown) =>
  JSON.stringify(proof, (key, value: unknown) => key === "bodySha256" ? undefined : value);

/**
 * The proof of the families whose reviewed bodies the module holds exactly.
 * Only when no family matches exactly, of those whose bodies it holds as
 * relocations. Families that match must name the same functions; generations
 * with equal identities do, and the newest one's digests are cited.
 */
function uniqueFamilyProof<Proof>(
  derive: (family: EffectProofFamily, relinked: boolean) => Proof | null,
): Proof | null {
  for (const relinked of [false, true]) {
    const matches = families().flatMap((family) => {
      const proof = derive(family, relinked);
      return proof === null ? [] : [proof];
    });
    const newest = matches.at(-1);
    if (newest === undefined) continue;
    return matches.every((proof) => locations(proof) === locations(newest)) ? newest : null;
  }
  return null;
}

export function derivePlayerEffectObservation(module: ModuleShape): PlayerEffectProof | null {
  return uniqueFamilyProof((family, relinked) => family.derivePlayerEffectObservation(module, relinked));
}
export function deriveEffectIconGeometry(module: ModuleShape,
  skillGeometry: NonNullable<KnownEnhancementBuild["skillSlotGeometry"]> | null): EffectIconProof | null {
  return uniqueFamilyProof((family, relinked) =>
    family.deriveEffectIconGeometry(module, skillGeometry, relinked));
}
export function playerEffectCandidateCounts(module: ModuleShape): readonly number[] {
  const counts = families().map(family => family.playerEffectCandidateCounts(module));
  return counts[0]!.map((_, index) => Math.max(...counts.map(count => count[index]!)));
}
export function effectIconCandidateCounts(module: ModuleShape): readonly number[] {
  const counts = families().map(family => family.effectIconCandidateCounts(module));
  return counts[0]!.map((_, index) => Math.max(...counts.map(count => count[index]!)));
}
