/**
 * The one retained-evidence acceptance rule for Enhancement facts. The
 * verifier applies it before it emits a feature; the process boundary repeats
 * it on the message it receives.
 *
 * A feature is accepted when every fact it needs matches one retained record,
 * so a new client can carry its cursor facts from one record and its Party
 * facts from another. A refused feature withdraws itself and the features that
 * need its facts; the capability registry decides which those are.
 */
import { isDeepStrictEqual } from "node:util";
import { isDigest } from "../../shared/digest.js";
import {
  ENHANCEMENT_CAPABILITY_FIELDS,
  intersectEnhancementCapabilities,
  type EnhancementCapabilities,
  type EnhancementCapability,
} from "../../shared/enhancement-contracts.js";
import { isAlcoholObservationProof } from "./enhancement-alcohol-proof.js";
import {
  ENHANCEMENT_BUILDS,
  supportedEnhancementCapabilities,
  type KnownEnhancementBuild,
} from "./enhancement-builds.js";
import { isEffectIconGeometryProof, isPlayerEffectObservationProof } from
  "./enhancement-player-effect-proof.js";
import { isResignNativeSender } from "./enhancement-resign-proof.js";
import { isSkillSlotGeometryProof } from "./enhancement-skill-slot-geometry-proof.js";
import { isNativeHudRenderingProof } from "./native-hud-transform.js";

function isIndex(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

type SemanticBuild = Readonly<Partial<KnownEnhancementBuild>>;

function matchesCoreProof(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  return build.programId === baseline.programId
    && isDeepStrictEqual(build.hookParams, baseline.hookParams)
    && isDeepStrictEqual(build.hookResults, baseline.hookResults);
}

function matchesCursorProof(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.cursorEvent;
  if (candidate === undefined) return true;
  const expected = baseline.cursorEvent;
  return expected !== undefined
    && isIndex(candidate.functionIndex)
    && isIndex(candidate.tableSlot)
    && candidate.producerFunctions.length === 2
    && candidate.producerFunctions.every(isIndex)
    && candidate.producerBodySha256.length === 2
    && candidate.producerBodySha256.every(isDigest)
    && Object.values(candidate.layout).every(isIndex)
    && Object.keys(candidate.layout).sort().join()
      === Object.keys(expected.layout).sort().join()
    && isDeepStrictEqual(build.hookParams, baseline.hookParams)
    && isDeepStrictEqual(build.hookResults, baseline.hookResults)
    && isDeepStrictEqual(candidate.params, expected.params)
    && isDeepStrictEqual(candidate.results, expected.results)
    && isDigest(candidate.bodySha256)
    && isDeepStrictEqual(candidate.producerParams, expected.producerParams)
    && isDeepStrictEqual(candidate.producerResults, expected.producerResults)
    && isDeepStrictEqual(
      candidate.tableNeighbourBodySha256,
      expected.tableNeighbourBodySha256,
    )
    && candidate.layout.cursorSoftwareModel
      === candidate.layout.cursorActiveArt + 4
    && candidate.layout.cursorShowCount === candidate.layout.cursorActiveArt + 8
    && candidate.layout.cursorArtHotspot === expected.layout.cursorArtHotspot
    && candidate.layout.cursorArtTexture === expected.layout.cursorArtTexture
    && candidate.layout.cursorHandleKey === expected.layout.cursorHandleKey
    && candidate.layout.cursorHandleObject === expected.layout.cursorHandleObject
    && candidate.layout.cursorViewTexture === expected.layout.cursorViewTexture
    && candidate.layout.cursorTextureType === expected.layout.cursorTextureType
    && candidate.layout.cursorTextureWidth === expected.layout.cursorTextureWidth
    && candidate.layout.cursorTextureHeight === expected.layout.cursorTextureHeight;
}

function matchesObservationBase(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.observationBase?.layout;
  if (candidate === undefined) return true;
  const expected = baseline.observationBase?.layout;
  return expected !== undefined
    && Object.keys(candidate).sort().join() === Object.keys(expected).sort().join()
    && Object.values(candidate).every(isIndex)
    && candidate.contextRoot % 4 === 0
    && candidate.agentArray % 4 === 0
    && candidate.areaInfo % 4 === 0
    && Object.entries(expected).every(([key, value]) =>
      key === "contextRoot" || key === "agentArray" || key === "areaInfo"
        || candidate[key as keyof typeof candidate] === value);
}

function matchesPlayRegionObservation(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.playRegionObservation?.layout;
  if (candidate === undefined) return true;
  const expected = baseline.playRegionObservation?.layout;
  if (
    expected === undefined
    || Object.keys(candidate).sort().join() !== Object.keys(expected).sort().join()
    || !Object.values(candidate).every(isIndex)
    || Object.entries(expected).some(([key, value]) =>
      key !== "contextRoot" && key !== "areaInfo"
      && candidate[key as keyof typeof candidate] !== value)
  ) return false;
  const observation = build.observationBase?.layout;
  return observation === undefined || Object.entries(candidate).every(
    ([key, value]) => observation[key as keyof typeof observation] === value,
  );
}

function matchesTargetObservation(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.targetObservation?.layout;
  if (candidate === undefined) return true;
  const expected = baseline.targetObservation?.layout;
  const candidateObservation = build.observationBase?.layout;
  return matchesObservationBase(build, baseline)
    && expected !== undefined
    && candidateObservation !== undefined
    && Object.keys(candidate).sort().join() === Object.keys(expected).sort().join()
    && Object.values(candidate).every(isIndex)
    && candidate.manualTargetAgentId === candidate.automaticTargetAgentId + 4;
}

function matchesUiDispatcher(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.uiDispatcher;
  if (candidate === undefined) return true;
  const expected = baseline.uiDispatcher;
  return expected !== undefined
    && isIndex(candidate.functionIndex)
    && isDigest(candidate.bodySha256)
    && isDeepStrictEqual(candidate.params, expected.params)
    && isDeepStrictEqual(candidate.results, expected.results)
    && candidate.playerChatMessage === expected.playerChatMessage
    && candidate.hideHeroPanelMessage === expected.hideHeroPanelMessage
    && candidate.showHeroPanelMessage === expected.showHeroPanelMessage;
}

function matchesGameThreadSafePoint(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.gameThread?.drain;
  if (candidate === undefined) return true;
  const expected = baseline.gameThread?.drain;
  return expected !== undefined
    && isIndex(candidate.functionIndex)
    && isIndex(candidate.tableSlot)
    && isDigest(candidate.bodySha256)
    && isDeepStrictEqual(candidate.params, expected.params)
    && isDeepStrictEqual(candidate.results, expected.results);
}

function matchesTravelAction(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.travelAction;
  if (candidate === undefined) return true;
  const expected = baseline.travelAction;
  return expected !== undefined
    && candidate.enqueueExport === expected.enqueueExport
    && candidate.configureExport === expected.configureExport
    && candidate.toggleExport === expected.toggleExport
    && candidate.messageId === expected.messageId
    && (candidate.guildHall === undefined || ENHANCEMENT_BUILDS.some(known =>
      isDeepStrictEqual(candidate.guildHall, known.travelAction?.guildHall)))
    && isIndex(candidate.producer.functionIndex)
    && isDigest(candidate.producer.bodySha256)
    && isDeepStrictEqual(candidate.producer.params, expected.producer.params)
    && isDeepStrictEqual(candidate.producer.results, expected.producer.results)
    && isIndex(candidate.contextResolver.functionIndex)
    && isDigest(candidate.contextResolver.bodySha256)
    && isDeepStrictEqual(
      candidate.contextResolver.params,
      expected.contextResolver.params,
    )
    && isDeepStrictEqual(
      candidate.contextResolver.results,
      expected.contextResolver.results,
    )
    && isDeepStrictEqual(candidate.unlockProof.layout, expected.unlockProof.layout)
    && isIndex(candidate.unlockProof.accessor.functionIndex)
    && isDigest(candidate.unlockProof.accessor.bodySha256)
    && isDeepStrictEqual(
      candidate.unlockProof.accessor.params,
      expected.unlockProof.accessor.params,
    )
    && isDeepStrictEqual(
      candidate.unlockProof.accessor.results,
      expected.unlockProof.accessor.results,
    )
    && isIndex(candidate.unlockProof.consumer.functionIndex)
    && isDigest(candidate.unlockProof.consumer.bodySha256)
    && isDeepStrictEqual(
      candidate.unlockProof.consumer.params,
      expected.unlockProof.consumer.params,
    )
    && isDeepStrictEqual(
      candidate.unlockProof.consumer.results,
      expected.unlockProof.consumer.results,
    );
}

function matchesXunlaiAction(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.xunlaiAction;
  if (candidate === undefined) return true;
  const expected = baseline.xunlaiAction;
  const readers = candidate.accessProof?.readers;
  const expectedReaders = expected?.accessProof?.readers;
  const layout = candidate.accessProof?.layout;
  const expectedLayout = expected?.accessProof?.layout;
  return expected !== undefined
    && readers !== undefined
    && expectedReaders !== undefined
    && layout !== undefined
    && expectedLayout !== undefined
    && candidate.openExport === expected.openExport
    && candidate.configureExport === expected.configureExport
    && Object.keys(readers).sort().join() === Object.keys(expectedReaders).sort().join()
    && Object.entries(readers).every(([name, reader]) => {
      const expectedReader = expectedReaders[name as keyof typeof expectedReaders];
      return expectedReader !== undefined
        && isIndex(reader.functionIndex)
        && isDigest(reader.bodySha256)
        && isDeepStrictEqual(reader.params, expectedReader.params)
        && isDeepStrictEqual(reader.results, expectedReader.results);
    })
    && isDeepStrictEqual(layout, expectedLayout)
    && isIndex(candidate.handler.functionIndex)
    && isDigest(candidate.handler.bodySha256)
    && isDeepStrictEqual(candidate.handler.params, expected.handler.params)
    && isDeepStrictEqual(candidate.handler.results, expected.handler.results);
}

function matchesChatAliases(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.chatAliases?.parser;
  if (candidate === undefined) return true;
  const expected = baseline.chatAliases?.parser;
  return expected !== undefined
    && isIndex(candidate.functionIndex)
    && isDigest(candidate.bodySha256)
    && isDeepStrictEqual(candidate.params, expected.params)
    && isDeepStrictEqual(candidate.results, expected.results);
}

function matchesChatFiltering(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.chatFiltering;
  if (candidate === undefined) return true;
  const expected = baseline.chatFiltering;
  return expected !== undefined
    && isDeepStrictEqual(
      {
        ...candidate,
        producer: {
          ...candidate.producer,
          functionIndex: expected.producer.functionIndex,
          bodySha256: expected.producer.bodySha256,
        },
      },
      expected,
    )
    && isIndex(candidate.producer.functionIndex)
    && isDigest(candidate.producer.bodySha256);
}

function matchesPartyObservation(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.partyObservation;
  if (candidate === undefined) return true;
  const expected = baseline.partyObservation;
  return expected !== undefined
    && candidate.playerChatSites === 3
    && isIndex(candidate.playerChatProducer)
    && candidate.nearbyPlayerMessageProducers.length === 2
    && candidate.nearbyPlayerMessageProducers.every(isIndex)
    && isDeepStrictEqual(candidate.partyDirtyMessages, expected.partyDirtyMessages)
    && isDeepStrictEqual(candidate.nearbyPlayerMessages, expected.nearbyPlayerMessages)
    && isDeepStrictEqual(candidate.layout, expected.layout);
}

function matchesSkillSlotGeometry(build: SemanticBuild): boolean {
  return build.skillSlotGeometry === undefined
    || isSkillSlotGeometryProof(build.skillSlotGeometry);
}

function matchesTeamApply(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.teamApply;
  if (candidate === undefined) return true;
  const expected = baseline.teamApply;
  return expected !== undefined
    && candidate.thunkExport === expected.thunkExport
    && candidate.professionTrace.readerExport === expected.professionTrace.readerExport
    && isIndex(candidate.professionTrace.sender.functionIndex)
    && isDigest(candidate.professionTrace.sender.bodySha256)
    && isDeepStrictEqual(
      candidate.professionTrace.sender.params,
      expected.professionTrace.sender.params,
    )
    && isDeepStrictEqual(
      candidate.professionTrace.sender.results,
      expected.professionTrace.sender.results,
    )
    && candidate.entries.length === expected.entries.length
    && candidate.entries.every((entry, index) => {
      const expectedEntry = expected.entries[index];
      return expectedEntry !== undefined
        && entry.opcode === expectedEntry.opcode
        && entry.label === expectedEntry.label
        && isIndex(entry.functionIndex)
        && isDigest(entry.bodySha256)
        && isDeepStrictEqual(entry.params, expectedEntry.params)
        && isDeepStrictEqual(entry.results, expectedEntry.results);
    });
}

function matchesSkillCooldownObservation(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.skillCooldownObservation;
  if (candidate === undefined) return true;
  const expected = baseline.skillCooldownObservation;
  return expected !== undefined
    && isIndex(candidate.reader.functionIndex)
    && isIndex(candidate.reader.timerCallOperand)
    && isDigest(candidate.reader.bodySha256)
    && isDeepStrictEqual(candidate.reader.params, expected.reader.params)
    && isDeepStrictEqual(candidate.reader.results, expected.reader.results)
    && isIndex(candidate.timer.functionIndex)
    && isDigest(candidate.timer.bodySha256)
    && isDeepStrictEqual(candidate.timer.params, expected.timer.params)
    && isDeepStrictEqual(candidate.timer.results, expected.timer.results)
    && isDeepStrictEqual(candidate.layout, expected.layout);
}

function matchesPlayerEffectObservation(
  build: SemanticBuild,
): boolean {
  const candidate = build.playerEffectObservation;
  return candidate === undefined || isPlayerEffectObservationProof(candidate);
}

function matchesEffectIconGeometry(build: SemanticBuild): boolean {
  const candidate = build.effectIconGeometry;
  return candidate === undefined || isEffectIconGeometryProof(candidate);
}

function matchesPreGameControls(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.preGameControls;
  if (candidate === undefined) return true;
  const expected = baseline.preGameControls;
  return expected !== undefined
    && isIndex(candidate.hashFunction.functionIndex)
    && isDigest(candidate.hashFunction.bodySha256)
    && isDeepStrictEqual(candidate.hashFunction.params, expected.hashFunction.params)
    && isDeepStrictEqual(candidate.hashFunction.results, expected.hashFunction.results)
    && Object.values(candidate.labels).every(isIndex)
    && isDeepStrictEqual(candidate.labelHashes, expected.labelHashes)
    && Object.keys(candidate.layout).sort().join()
      === Object.keys(expected.layout).sort().join()
    && candidate.layout.frameCount === candidate.layout.frameArray + 8
    && candidate.layout.frameBytes === expected.layout.frameBytes
    && candidate.layout.frameId === expected.layout.frameId
    && candidate.layout.frameHashId === expected.layout.frameHashId
    && candidate.layout.frameState === expected.layout.frameState
    && candidate.layout.gameContextSlot === expected.layout.gameContextSlot
    && candidate.layout.characterContext === expected.layout.characterContext
    && candidate.layout.characterUuid === expected.layout.characterUuid
    && candidate.layout.currentInstanceType === expected.layout.currentInstanceType
    && isIndex(candidate.layout.contextRoot);
}

function matchesPlayerSkillbarObservation(
  build: SemanticBuild,
  baseline: KnownEnhancementBuild,
): boolean {
  const candidate = build.playerSkillbarObservation;
  const expected = baseline.playerSkillbarObservation;
  if (candidate === undefined) return true;
  if (expected === undefined) return false;
  const proof = (
    value: Readonly<{
      functionIndex: number;
      bodySha256: string;
      params: readonly string[];
      results: readonly string[];
    }>,
    reference: Readonly<{
      functionIndex: number;
      bodySha256: string;
      params: readonly string[];
      results: readonly string[];
    }>,
  ) => isIndex(value.functionIndex)
    && isDigest(value.bodySha256)
    && isDeepStrictEqual(value.params, reference.params)
    && isDeepStrictEqual(value.results, reference.results);
  return proof(candidate.worldLifecycle, expected.worldLifecycle)
    && proof(candidate.update, expected.update)
    && proof(candidate.rowReader, expected.rowReader)
    && proof(candidate.slotReader, expected.slotReader)
    && isDeepStrictEqual(candidate.coreLayout, expected.coreLayout)
    && isDeepStrictEqual(candidate.partyLayout, expected.partyLayout);
}

/** Accessor identities with the build-specific function index removed. */
function withoutIndices(accessors: object): unknown {
  return Object.fromEntries(Object.entries(accessors)
    .map(([name, accessor]) => [name, { ...(accessor as object), functionIndex: 0 }]));
}

type OptionalKeys<Value> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? Key : never;
}[keyof Value];

/** One optional fact of a derived build, such as `cursorEvent` or `gameThread`. */
export type EnhancementFact = OptionalKeys<KnownEnhancementBuild>;

/**
 * How one fact is accepted. A `retained` fact must match the same retained
 * record as the core and every other retained fact of the feature. An
 * `independent` fact carries its complete proof shape, or names the records it
 * matches itself.
 */
type FactRule =
  | Readonly<{ retained: (build: SemanticBuild, baseline: KnownEnhancementBuild) => boolean }>
  | Readonly<{ independent: (build: SemanticBuild) => boolean }>;

const FACT_RULES: Readonly<Record<EnhancementFact, FactRule>> = Object.freeze({
  cursorEvent: { retained: matchesCursorProof },
  observationBase: { retained: matchesObservationBase },
  playRegionObservation: { retained: matchesPlayRegionObservation },
  targetObservation: { retained: matchesTargetObservation },
  uiDispatcher: { retained: matchesUiDispatcher },
  gameThread: { retained: matchesGameThreadSafePoint },
  travelAction: { retained: matchesTravelAction },
  xunlaiAction: { retained: matchesXunlaiAction },
  chatAliases: { retained: matchesChatAliases },
  chatFiltering: { retained: matchesChatFiltering },
  partyObservation: { retained: matchesPartyObservation },
  playerSkillbarObservation: { retained: matchesPlayerSkillbarObservation },
  teamApply: { retained: matchesTeamApply },
  skillCooldownObservation: { retained: matchesSkillCooldownObservation },
  preGameControls: { retained: matchesPreGameControls },
  skillSlotGeometry: { independent: matchesSkillSlotGeometry },
  playerEffectObservation: { independent: matchesPlayerEffectObservation },
  effectIconGeometry: { independent: matchesEffectIconGeometry },
  alcoholObservation: {
    independent: (build) => isAlcoholObservationProof(build.alcoholObservation),
  },
  // The HUD draws into proved skill-slot or effect-icon geometry.
  nativeHudRendering: {
    independent: (build) => isNativeHudRenderingProof(build.nativeHudRendering)
      && (build.skillSlotGeometry !== undefined || build.effectIconGeometry !== undefined),
  },
  whisperChat: { independent: (build) => isResignNativeSender(build.whisperChat) },
  resignAction: { independent: (build) => isResignNativeSender(build.resignAction) },
  // The validator may move between builds; its exact body and signature may not.
  chatPrint: {
    independent: (build) => isIndex(build.chatPrint?.validator.functionIndex)
      && ENHANCEMENT_BUILDS.some((baseline) => baseline.chatPrint !== undefined
        && isDeepStrictEqual(
          { ...build.chatPrint?.validator, functionIndex: 0 },
          { ...baseline.chatPrint.validator, functionIndex: 0 },
        )),
  },
  // Accessors may move between builds; their exact bodies and layout may not.
  progressObservation: {
    independent: (build) => ENHANCEMENT_BUILDS.some((baseline) =>
      baseline.progressObservation !== undefined
      && build.progressObservation !== undefined
      && isDeepStrictEqual(build.progressObservation.layout, baseline.progressObservation.layout)
      && isDeepStrictEqual(
        withoutIndices(build.progressObservation.accessors),
        withoutIndices(baseline.progressObservation.accessors),
      )),
  },
  // Item and trade fields are reviewed for one exact post-template input.
  quickItemMove: {
    independent: (build) => ENHANCEMENT_BUILDS.some((baseline) =>
      baseline.sha256 === build.sha256
      && isDeepStrictEqual(build.quickItemMove, baseline.quickItemMove)),
  },
});

function isFact(key: string): key is EnhancementFact {
  return Object.hasOwn(FACT_RULES, key);
}

const FACTS: readonly EnhancementFact[] = Object.freeze(
  Object.keys(FACT_RULES).filter(isFact),
);

function presentFacts(build: KnownEnhancementBuild): EnhancementFact[] {
  return FACTS.filter((fact) => build[fact] !== undefined);
}

function withoutFacts(
  build: KnownEnhancementBuild,
  facts: ReadonlySet<EnhancementFact>,
): KnownEnhancementBuild {
  const reduced: KnownEnhancementBuild = { ...build };
  for (const fact of facts) delete reduced[fact];
  return Object.freeze(reduced);
}

function acceptsFacts(
  build: KnownEnhancementBuild,
  facts: readonly EnhancementFact[],
): boolean {
  const retained: ((build: SemanticBuild, baseline: KnownEnhancementBuild) => boolean)[] = [];
  for (const fact of facts) {
    const rule = FACT_RULES[fact];
    if ("retained" in rule) retained.push(rule.retained);
    else if (!rule.independent(build)) return false;
  }
  return ENHANCEMENT_BUILDS.some((baseline) =>
    matchesCoreProof(build, baseline)
    && retained.every((matches) => matches(build, baseline)));
}

/**
 * The facts each supported feature needs, read from the capability registry:
 * a fact is needed when the feature is unsupported without it.
 */
function neededFacts(
  build: KnownEnhancementBuild,
): ReadonlyMap<EnhancementCapability, readonly EnhancementFact[]> {
  const present = presentFacts(build);
  const supportedWithout = present.map((fact) => ({
    fact,
    supported: supportedEnhancementCapabilities(withoutFacts(build, new Set([fact]))),
  }));
  return new Map(ENHANCEMENT_CAPABILITY_FIELDS.map((feature) => [
    feature,
    supportedWithout.filter(({ supported }) => !supported[feature]).map(({ fact }) => fact),
  ]));
}

/**
 * Removes every feature the retained evidence refuses, with the facts no kept
 * feature needs, until each remaining feature is accepted. A present fact no
 * kept feature needs must be accepted on its own. Returns the same object when
 * nothing is refused.
 */
export function withdrawRefusedFeatures(
  build: KnownEnhancementBuild,
  requested: EnhancementCapabilities,
): KnownEnhancementBuild {
  let current = build;
  for (;;) {
    const wanted = intersectEnhancementCapabilities(
      requested,
      supportedEnhancementCapabilities(current),
    );
    const needs = neededFacts(current);
    const factsOf = (feature: EnhancementCapability) => needs.get(feature) ?? [];
    const accepted: Record<EnhancementCapability, boolean> = { ...wanted };
    for (const feature of ENHANCEMENT_CAPABILITY_FIELDS) {
      if (accepted[feature] && !acceptsFacts(current, factsOf(feature))) {
        accepted[feature] = false;
      }
    }
    const kept = intersectEnhancementCapabilities(accepted, wanted);
    const keptFeatures = ENHANCEMENT_CAPABILITY_FIELDS.filter((feature) => kept[feature]);
    const users = (fact: EnhancementFact) =>
      keptFeatures.filter((feature) => factsOf(feature).includes(fact)).length;
    const withdrawn = new Set<EnhancementFact>();
    for (const feature of ENHANCEMENT_CAPABILITY_FIELDS) {
      if (!wanted[feature] || kept[feature]) continue;
      const own = factsOf(feature).filter((fact) => users(fact) === 0);
      // A refused feature whose facts kept features all share cannot be
      // withdrawn alone, so the whole Enhancement build is withdrawn.
      for (const fact of own.length > 0 ? own : presentFacts(current)) withdrawn.add(fact);
    }
    for (const fact of presentFacts(current)) {
      if (users(fact) === 0 && !acceptsFacts(current, [fact])) withdrawn.add(fact);
    }
    if (withdrawn.size === 0) return current;
    current = withoutFacts(current, withdrawn);
  }
}

/** True when the retained evidence accepts every fact and requested feature. */
export function acceptsEnhancementBuild(
  build: KnownEnhancementBuild,
  requested: EnhancementCapabilities,
): boolean {
  return withdrawRefusedFeatures(build, requested) === build;
}
